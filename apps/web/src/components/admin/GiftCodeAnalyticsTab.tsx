import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { getAuthHeaders } from '../../services/authHeaders';
import { useTranslation } from 'react-i18next';
import { colors } from '../../utils/styles';
import { logger } from '../../utils/logger';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

interface DailyRedemption {
  date: string;
  total: number;
  success: number;
  failed: number;
}

interface TopCode {
  code: string;
  attempts: number;
  successes: number;
  successRate: number;
}

interface GiftCodeStats {
  total24h: number;
  totalAll: number;
  successRate: number;
  uniquePlayers: number;
  dailyRedemptions: DailyRedemption[];
  topCodes: TopCode[];
  recentRedemptions: Array<{
    code: string;
    player_id: string;
    success: boolean;
    message: string | null;
    created_at: string;
  }>;
}

interface ActiveGiftCode {
  id: string;
  code: string;
  source: string;
  is_active: boolean;
  expire_date: string | null;
  created_at: string;
}

export const GiftCodeAnalyticsTab: React.FC = () => {
  const { t } = useTranslation();
  const [stats, setStats] = useState<GiftCodeStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | 'all'>('7d');
  const [activeCodes, setActiveCodes] = useState<ActiveGiftCode[]>([]);
  const [loadingCodes, setLoadingCodes] = useState(true);
  const [newCode, setNewCode] = useState('');
  const [newExpiry, setNewExpiry] = useState('');
  const [addingCode, setAddingCode] = useState(false);
  const [activeSection, setActiveSection] = useState<'manage' | 'analytics'>('manage');

  const fetchActiveCodes = useCallback(async () => {
    setLoadingCodes(true);
    try {
      if (!supabase) return;
      const { data, error } = await supabase
        .from('gift_codes')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setActiveCodes(data || []);
    } catch (err) {
      logger.error('Failed to fetch gift codes:', err);
    } finally {
      setLoadingCodes(false);
    }
  }, []);

  useEffect(() => {
    fetchActiveCodes();
  }, [fetchActiveCodes]);

  useEffect(() => {
    fetchStats();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRange]);

  const handleAddCode = async () => {
    if (!newCode.trim()) return;
    setAddingCode(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_URL}/api/v1/player-link/gift-codes/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({
          code: newCode.trim(),
          expire_date: newExpiry || null,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setNewCode('');
      setNewExpiry('');
      await fetchActiveCodes();
    } catch (err) {
      logger.error('Failed to add gift code:', err);
    } finally {
      setAddingCode(false);
    }
  };

  const handleDeactivate = async (code: string) => {
    try {
      if (!supabase) return;
      await supabase.from('gift_codes').update({ is_active: false }).eq('code', code);
      await fetchActiveCodes();
    } catch (err) {
      logger.error('Failed to deactivate code:', err);
    }
  };

  const handleActivate = async (code: string) => {
    try {
      if (!supabase) return;
      await supabase.from('gift_codes').update({ is_active: true }).eq('code', code);
      await fetchActiveCodes();
    } catch (err) {
      logger.error('Failed to activate code:', err);
    }
  };

  const fetchStats = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const rangeStart = timeRange === '7d'
        ? new Date(now.getTime() - 7 * 86400000).toISOString()
        : timeRange === '30d'
          ? new Date(now.getTime() - 30 * 86400000).toISOString()
          : '2020-01-01T00:00:00Z';

      const last24h = new Date(now.getTime() - 86400000).toISOString();

      // Fetch all redemptions in range
      if (!supabase) throw new Error('Supabase not initialized');
      const { data: redemptions, error } = await supabase
        .from('gift_code_redemptions')
        .select('code, player_id, success, message, error_code, created_at')
        .gte('created_at', rangeStart)
        .order('created_at', { ascending: false })
        .limit(5000);

      if (error) throw error;
      const rows = redemptions || [];

      // 24h count
      const total24h = rows.filter(r => r.created_at >= last24h).length;

      // Success rate
      const successes = rows.filter(r => r.success).length;
      const successRate = rows.length > 0 ? (successes / rows.length) * 100 : 0;

      // Unique players
      const uniquePlayers = new Set(rows.map(r => r.player_id)).size;

      // Daily aggregation
      const dailyMap = new Map<string, { total: number; success: number; failed: number }>();
      rows.forEach(r => {
        const day = r.created_at.slice(0, 10);
        const entry = dailyMap.get(day) || { total: 0, success: 0, failed: 0 };
        entry.total++;
        if (r.success) entry.success++;
        else entry.failed++;
        dailyMap.set(day, entry);
      });
      const dailyRedemptions = [...dailyMap.entries()]
        .map(([date, data]) => ({ date, ...data }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // Top codes
      const codeMap = new Map<string, { attempts: number; successes: number }>();
      rows.forEach(r => {
        const entry = codeMap.get(r.code) || { attempts: 0, successes: 0 };
        entry.attempts++;
        if (r.success) entry.successes++;
        codeMap.set(r.code, entry);
      });
      const topCodes = [...codeMap.entries()]
        .map(([code, data]) => ({
          code,
          attempts: data.attempts,
          successes: data.successes,
          successRate: data.attempts > 0 ? (data.successes / data.attempts) * 100 : 0,
        }))
        .sort((a, b) => b.attempts - a.attempts)
        .slice(0, 10);

      // Recent redemptions (last 20)
      const recentRedemptions = rows.slice(0, 20).map(r => ({
        code: r.code,
        player_id: r.player_id,
        success: r.success,
        message: r.message,
        created_at: r.created_at,
      }));

      setStats({
        total24h,
        totalAll: rows.length,
        successRate,
        uniquePlayers,
        dailyRedemptions,
        topCodes,
        recentRedemptions,
      });
    } catch (err) {
      logger.error('Failed to fetch gift code stats:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem', color: colors.textMuted, textAlign: 'center' }}>
        Loading gift code analytics...
      </div>
    );
  }

  if (!stats) {
    return (
      <div style={{ padding: '2rem', color: colors.textMuted, textAlign: 'center' }}>
        Failed to load analytics data.
      </div>
    );
  }

  return (
    <div>
      {/* Section Toggle */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        {(['manage', 'analytics'] as const).map(section => (
          <button
            key={section}
            onClick={() => setActiveSection(section)}
            style={{
              padding: '0.4rem 0.8rem',
              backgroundColor: activeSection === section ? `${colors.primary}20` : 'transparent',
              color: activeSection === section ? colors.primary : colors.textMuted,
              border: activeSection === section ? `1px solid ${colors.primary}40` : `1px solid ${colors.border}`,
              borderRadius: '6px',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '0.8rem',
            }}
          >
            {section === 'manage' ? '🎁 Manage Codes' : '📊 Analytics'}
          </button>
        ))}
      </div>

      {/* Manage Codes Section */}
      {activeSection === 'manage' && (
        <div>
          {/* Add New Code Form */}
          <div style={{ padding: '1rem', backgroundColor: colors.cardAlt, borderRadius: '10px', border: `1px solid ${colors.border}`, marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.75rem', color: colors.textSecondary, fontWeight: 600, marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Add Gift Code
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ flex: '1 1 180px' }}>
                <label style={{ fontSize: '0.65rem', color: colors.textMuted, display: 'block', marginBottom: '0.2rem' }}>Code *</label>
                <input
                  value={newCode}
                  onChange={e => setNewCode(e.target.value.toUpperCase())}
                  placeholder="e.g. KINGSHOT2026"
                  style={{
                    width: '100%', padding: '0.4rem 0.6rem', backgroundColor: colors.bg,
                    border: `1px solid ${colors.border}`, borderRadius: '6px', color: colors.text,
                    fontSize: '0.8rem', fontFamily: 'monospace', boxSizing: 'border-box',
                  }}
                />
              </div>
              <div style={{ flex: '0 0 160px' }}>
                <label style={{ fontSize: '0.65rem', color: colors.textMuted, display: 'block', marginBottom: '0.2rem' }}>Expiry Date (optional)</label>
                <input
                  type="date"
                  value={newExpiry}
                  onChange={e => setNewExpiry(e.target.value)}
                  style={{
                    width: '100%', padding: '0.4rem 0.6rem', backgroundColor: colors.bg,
                    border: `1px solid ${colors.border}`, borderRadius: '6px', color: colors.text,
                    fontSize: '0.8rem', boxSizing: 'border-box',
                  }}
                />
              </div>
              <button
                onClick={handleAddCode}
                disabled={!newCode.trim() || addingCode}
                style={{
                  padding: '0.4rem 1rem',
                  backgroundColor: newCode.trim() ? `${colors.success}20` : colors.surfaceHover,
                  color: newCode.trim() ? colors.success : colors.textMuted,
                  border: newCode.trim() ? `1px solid ${colors.success}40` : `1px solid ${colors.border}`,
                  borderRadius: '6px',
                  fontWeight: 600,
                  cursor: newCode.trim() ? 'pointer' : 'not-allowed',
                  fontSize: '0.8rem',
                  whiteSpace: 'nowrap',
                }}
              >
                {addingCode ? 'Adding...' : '+ Add Code'}
              </button>
            </div>
            <div style={{ fontSize: '0.6rem', color: colors.textMuted, marginTop: '0.5rem' }}>
              Codes are automatically uppercased. Duplicates are handled via upsert (existing codes get updated).
            </div>
          </div>

          {/* Active Codes List */}
          <div style={{ padding: '1rem', backgroundColor: colors.cardAlt, borderRadius: '10px', border: `1px solid ${colors.border}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <div style={{ fontSize: '0.75rem', color: colors.textSecondary, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                All Gift Codes ({activeCodes.length})
              </div>
              <button
                onClick={fetchActiveCodes}
                style={{ padding: '0.25rem 0.5rem', backgroundColor: 'transparent', border: `1px solid ${colors.border}`, borderRadius: '4px', color: colors.textMuted, fontSize: '0.7rem', cursor: 'pointer' }}
              >
                ↻ Refresh
              </button>
            </div>
            {loadingCodes ? (
              <div style={{ color: colors.textMuted, fontSize: '0.8rem', padding: '1rem', textAlign: 'center' }}>Loading...</div>
            ) : activeCodes.length === 0 ? (
              <div style={{ color: colors.textMuted, fontSize: '0.8rem', padding: '2rem', textAlign: 'center' }}>
                No gift codes in database yet. Add one above or they&apos;ll auto-sync from kingshot.net.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                {activeCodes.map(c => (
                  <div key={c.id} style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    padding: '0.4rem 0.6rem', borderRadius: '6px',
                    backgroundColor: c.is_active ? `${colors.success}06` : `${colors.error}06`,
                    border: `1px solid ${c.is_active ? `${colors.success}15` : `${colors.error}15`}`,
                    fontSize: '0.75rem',
                  }}>
                    <span style={{
                      width: '8px', height: '8px', borderRadius: '50%',
                      backgroundColor: c.is_active ? colors.success : colors.error,
                      flexShrink: 0,
                    }} />
                    <span style={{ color: colors.text, fontFamily: 'monospace', fontWeight: 600, minWidth: '120px' }}>
                      {c.code}
                    </span>
                    <span style={{ color: colors.textMuted, flex: 1, fontSize: '0.65rem' }}>
                      {new Date(c.created_at).toLocaleDateString()}
                    </span>
                    <span style={{
                      padding: '0.15rem 0.4rem', borderRadius: '4px', fontSize: '0.6rem', fontWeight: 600,
                      backgroundColor: c.source === 'manual' ? `${colors.orange}15` : `${colors.blue}15`,
                      color: c.source === 'manual' ? colors.orange : colors.blue,
                      border: `1px solid ${c.source === 'manual' ? `${colors.orange}30` : `${colors.blue}30`}`,
                    }}>
                      {c.source}
                    </span>
                    {c.expire_date && (
                      <span style={{ color: colors.textMuted, fontSize: '0.6rem' }}>
                        exp {new Date(c.expire_date).toLocaleDateString()}
                      </span>
                    )}
                    <button
                      onClick={() => c.is_active ? handleDeactivate(c.code) : handleActivate(c.code)}
                      style={{
                        padding: '0.2rem 0.5rem',
                        backgroundColor: c.is_active ? `${colors.error}10` : `${colors.success}10`,
                        color: c.is_active ? colors.error : colors.success,
                        border: `1px solid ${c.is_active ? `${colors.error}30` : `${colors.success}30`}`,
                        borderRadius: '4px',
                        fontSize: '0.6rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {c.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Analytics Section */}
      {activeSection === 'analytics' && (
      <div>
      {/* Time Range Selector */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        {(['7d', '30d', 'all'] as const).map(range => (
          <button
            key={range}
            onClick={() => setTimeRange(range)}
            style={{
              padding: '0.35rem 0.7rem',
              backgroundColor: timeRange === range ? `${colors.orange}20` : 'transparent',
              color: timeRange === range ? colors.orange : colors.textMuted,
              border: timeRange === range ? `1px solid ${colors.orange}40` : '1px solid transparent',
              borderRadius: '6px',
              fontWeight: 500,
              cursor: 'pointer',
              fontSize: '0.8rem',
            }}
          >
            {range === '7d' ? 'Last 7 Days' : range === '30d' ? 'Last 30 Days' : 'All Time'}
          </button>
        ))}
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
        {[
          { label: 'Last 24h', value: stats.total24h.toString(), color: colors.primary },
          { label: 'Total Redemptions', value: stats.totalAll.toString(), color: colors.orange },
          { label: 'Success Rate', value: `${stats.successRate.toFixed(1)}%`, color: stats.successRate >= 50 ? colors.success : colors.error },
          { label: 'Unique Players', value: stats.uniquePlayers.toString(), color: colors.purple },
        ].map(card => (
          <div key={card.label} style={{
            padding: '0.75rem', backgroundColor: colors.cardAlt, borderRadius: '10px',
            border: `1px solid ${colors.border}`,
          }}>
            <div style={{ fontSize: '0.65rem', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem' }}>
              {card.label}
            </div>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, color: card.color }}>
              {card.value}
            </div>
          </div>
        ))}
      </div>

      {/* Daily Redemptions Chart (simple bar visualization) */}
      {stats.dailyRedemptions.length > 0 && (
        <div style={{ marginBottom: '1.25rem', padding: '1rem', backgroundColor: colors.cardAlt, borderRadius: '10px', border: `1px solid ${colors.border}` }}>
          <div style={{ fontSize: '0.75rem', color: colors.textSecondary, fontWeight: 600, marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Redemptions / Day
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '80px' }}>
            {stats.dailyRedemptions.slice(-14).map(day => {
              const maxTotal = Math.max(...stats.dailyRedemptions.slice(-14).map(d => d.total), 1);
              const height = Math.max((day.total / maxTotal) * 100, 4);
              const successPct = day.total > 0 ? (day.success / day.total) * 100 : 0;
              return (
                <div
                  key={day.date}
                  title={`${day.date}: ${day.total} total, ${day.success} success, ${day.failed} failed`}
                  style={{
                    flex: 1,
                    height: `${height}%`,
                    borderRadius: '3px 3px 0 0',
                    background: `linear-gradient(180deg, ${colors.success} ${successPct}%, ${colors.error} ${successPct}%)`,
                    minWidth: '6px',
                    cursor: 'pointer',
                    opacity: 0.8,
                    transition: 'opacity 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '0.8')}
                />
              );
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.3rem' }}>
            <span style={{ fontSize: '0.55rem', color: colors.textMuted }}>
              {stats.dailyRedemptions.slice(-14)[0]?.date}
            </span>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <span style={{ fontSize: '0.55rem', color: colors.success }}>■ Success</span>
              <span style={{ fontSize: '0.55rem', color: colors.error }}>■ Failed</span>
            </div>
            <span style={{ fontSize: '0.55rem', color: colors.textMuted }}>
              {stats.dailyRedemptions.slice(-14)[stats.dailyRedemptions.slice(-14).length - 1]?.date}
            </span>
          </div>
        </div>
      )}

      {/* Top Codes Table */}
      {stats.topCodes.length > 0 && (
        <div style={{ marginBottom: '1.25rem', padding: '1rem', backgroundColor: colors.cardAlt, borderRadius: '10px', border: `1px solid ${colors.border}` }}>
          <div style={{ fontSize: '0.75rem', color: colors.textSecondary, fontWeight: 600, marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Top Codes
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: '0.4rem 1rem', fontSize: '0.75rem' }}>
            <div style={{ color: colors.textMuted, fontWeight: 600 }}>{t('admin.code', 'Code')}</div>
            <div style={{ color: colors.textMuted, fontWeight: 600, textAlign: 'right' }}>{t('admin.attempts', 'Attempts')}</div>
            <div style={{ color: colors.textMuted, fontWeight: 600, textAlign: 'right' }}>{t('admin.success', 'Success')}</div>
            <div style={{ color: colors.textMuted, fontWeight: 600, textAlign: 'right' }}>{t('admin.rate', 'Rate')}</div>
            {stats.topCodes.map(tc => (
              <React.Fragment key={tc.code}>
                <div style={{ color: colors.text, fontFamily: 'monospace', fontSize: '0.7rem' }}>{tc.code}</div>
                <div style={{ color: colors.textSecondary, textAlign: 'right' }}>{tc.attempts}</div>
                <div style={{ color: colors.success, textAlign: 'right' }}>{tc.successes}</div>
                <div style={{
                  textAlign: 'right',
                  color: tc.successRate >= 70 ? colors.success : tc.successRate >= 40 ? colors.orange : colors.error,
                }}>
                  {tc.successRate.toFixed(0)}%
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      {/* Recent Redemptions */}
      {stats.recentRedemptions.length > 0 && (
        <div style={{ padding: '1rem', backgroundColor: colors.cardAlt, borderRadius: '10px', border: `1px solid ${colors.border}` }}>
          <div style={{ fontSize: '0.75rem', color: colors.textSecondary, fontWeight: 600, marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Recent Redemptions
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            {stats.recentRedemptions.map((r, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.35rem 0.5rem', borderRadius: '6px',
                backgroundColor: r.success ? `${colors.success}08` : `${colors.error}08`,
                fontSize: '0.7rem',
              }}>
                <span style={{ color: r.success ? colors.success : colors.error, fontWeight: 600, width: '12px' }}>
                  {r.success ? '✓' : '✗'}
                </span>
                <span style={{ color: colors.text, fontFamily: 'monospace', minWidth: '100px' }}>{r.code}</span>
                <span style={{ color: colors.textMuted, flex: 1 }}>Player {r.player_id.slice(0, 6)}...</span>
                <span style={{ color: colors.textMuted, fontSize: '0.6rem' }}>
                  {new Date(r.created_at).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {stats.totalAll === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem', color: colors.textMuted }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📭</div>
          <p style={{ fontSize: '0.85rem' }}>No gift code redemption data yet.</p>
          <p style={{ fontSize: '0.7rem' }}>Data will appear once users start redeeming codes through Atlas.</p>
        </div>
      )}
      </div>
      )}
    </div>
  );
};

export default GiftCodeAnalyticsTab;
