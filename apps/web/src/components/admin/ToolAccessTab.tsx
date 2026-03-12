import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { colors } from '../../utils/styles';
import { logger } from '../../utils/logger';

// ─── Tool Definitions ──────────────────────────────────────────────────
const TOOLS = [
  { id: 'bot_dashboard', icon: '🤖', color: '#22d3ee' },
  { id: 'alliance_center', icon: '🏰', color: '#a855f7' },
  { id: 'prep_scheduler', icon: '📅', color: '#3b82f6' },
  { id: 'battle_registry', icon: '📋', color: '#f97316' },
  { id: 'battle_tier_list', icon: '🏆', color: '#eab308' },
  { id: 'battle_layout', icon: '🗺️', color: '#f97316' },
  { id: 'battle_planner', icon: '⚔️', color: '#ef4444' },
] as const;

type ToolId = typeof TOOLS[number]['id'];

interface AccessEntry {
  id: string;
  user_id: string;
  tool: ToolId;
  created_at: string;
  expires_at: string | null;
  linked_username: string;
  linked_kingdom: number | null;
  linked_tc_level: number | null;
  linked_avatar_url: string | null;
  username: string;
}

type GrantType = 'permanent' | 'trial';
type DurationUnit = 'hours' | 'days';

interface SearchResult {
  id: string;
  username: string;
  linked_username: string;
  linked_kingdom: number | null;
  linked_tc_level: number | null;
  linked_avatar_url: string | null;
}

export const ToolAccessTab: React.FC = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [activeTool, setActiveTool] = useState<ToolId>('bot_dashboard');
  const [accessList, setAccessList] = useState<AccessEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [grantType, setGrantType] = useState<GrantType>('permanent');
  const [trialDuration, setTrialDuration] = useState(24);
  const [durationUnit, setDurationUnit] = useState<DurationUnit>('hours');

  const toolConfig = TOOLS.find(t => t.id === activeTool)!;

  const fetchAccessList = useCallback(async (tool: ToolId) => {
    if (!supabase) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('tool_access')
        .select('id, user_id, tool, created_at, expires_at')
        .eq('tool', tool)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data && data.length > 0) {
        const userIds = data.map(d => d.user_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, username, linked_username, linked_kingdom, linked_tc_level, linked_avatar_url')
          .in('id', userIds);

        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
        const entries: AccessEntry[] = data.map(d => {
          const p = profileMap.get(d.user_id);
          return {
            id: d.id,
            user_id: d.user_id,
            tool: d.tool as ToolId,
            created_at: d.created_at,
            expires_at: d.expires_at || null,
            linked_username: p?.linked_username || '—',
            linked_kingdom: p?.linked_kingdom || null,
            linked_tc_level: p?.linked_tc_level || null,
            linked_avatar_url: p?.linked_avatar_url || null,
            username: p?.linked_username || p?.username || 'Unknown',
          };
        });
        setAccessList(entries);
      } else {
        setAccessList([]);
      }
    } catch (err) {
      logger.error('Failed to fetch tool access list:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccessList(activeTool);
    setSearchQuery('');
    setSearchResults([]);
  }, [activeTool, fetchAccessList]);

  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);
    if (!supabase || query.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, linked_username, linked_kingdom, linked_tc_level, linked_avatar_url')
        .not('linked_player_id', 'is', null)
        .ilike('linked_username', `%${query.trim()}%`)
        .limit(10);

      if (error) throw error;

      const existingIds = new Set(accessList.map(a => a.user_id));
      setSearchResults((data || []).filter(d => !existingIds.has(d.id)));
    } catch (err) {
      logger.error('Search failed:', err);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, [accessList]);

  const grantAccess = useCallback(async (userId: string) => {
    if (!supabase || !user) return;
    setAdding(userId);
    try {
      // Calculate expires_at for trial grants
      let expires_at: string | null = null;
      if (grantType === 'trial') {
        const ms = durationUnit === 'hours' ? trialDuration * 60 * 60 * 1000 : trialDuration * 24 * 60 * 60 * 1000;
        expires_at = new Date(Date.now() + ms).toISOString();
      }

      // Upsert: if user already has an expired trial for this tool, update it
      const { data: existing } = await supabase
        .from('tool_access')
        .select('id')
        .eq('user_id', userId)
        .eq('tool', activeTool)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('tool_access')
          .update({ expires_at, granted_by: user.id, created_at: new Date().toISOString() })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('tool_access')
          .insert({ user_id: userId, tool: activeTool, granted_by: user.id, expires_at });
        if (error) throw error;
      }

      setSearchQuery('');
      setSearchResults([]);
      await fetchAccessList(activeTool);
    } catch (err) {
      logger.error('Failed to grant access:', err);
    } finally {
      setAdding(null);
    }
  }, [user, activeTool, grantType, trialDuration, durationUnit, fetchAccessList]);

  const revokeAccess = useCallback(async (entryId: string) => {
    if (!supabase) return;
    setRemoving(entryId);
    try {
      const { error } = await supabase
        .from('tool_access')
        .delete()
        .eq('id', entryId);

      if (error) throw error;
      await fetchAccessList(activeTool);
    } catch (err) {
      logger.error('Failed to revoke access:', err);
    } finally {
      setRemoving(null);
    }
  }, [activeTool, fetchAccessList]);

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return iso;
    }
  };

  const formatTimeRemaining = (expiresAt: string) => {
    const ms = new Date(expiresAt).getTime() - Date.now();
    if (ms <= 0) return t('admin.toolAccess.expired', 'Expired');
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    const remainHours = hours % 24;
    if (days > 0) return `${days}d ${remainHours}h left`;
    const mins = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) return `${hours}h ${mins}m left`;
    return `${mins}m left`;
  };

  const isExpired = (entry: AccessEntry) => entry.expires_at ? new Date(entry.expires_at) <= new Date() : false;
  const activeEntries = accessList.filter(e => !isExpired(e));
  const expiredEntries = accessList.filter(e => isExpired(e));

  const toolLabel = (id: ToolId) => t(`admin.toolAccess.tool_${id}`, id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div style={{
        backgroundColor: colors.cardAlt, borderRadius: '12px', padding: '1.25rem',
        border: `1px solid ${colors.border}`,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <div>
            <h3 style={{ color: colors.text, margin: 0, fontSize: '1rem' }}>🔑 {t('admin.toolAccess.title', 'Tool Access Management')}</h3>
            <p style={{ color: colors.textMuted, fontSize: '0.8rem', margin: '0.25rem 0 0' }}>
              {t('admin.toolAccess.description', 'Grant or revoke access to gated tools for specific linked Kingshot users.')}
            </p>
          </div>
        </div>

        {/* Tool Selector */}
        <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          {TOOLS.map(tool => (
            <button
              key={tool.id}
              onClick={() => setActiveTool(tool.id)}
              style={{
                padding: '0.4rem 0.85rem', borderRadius: '8px',
                border: `1px solid ${activeTool === tool.id ? tool.color + '60' : colors.border}`,
                backgroundColor: activeTool === tool.id ? tool.color + '15' : 'transparent',
                color: activeTool === tool.id ? tool.color : colors.textSecondary,
                fontSize: '0.8rem', fontWeight: activeTool === tool.id ? 700 : 500,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem',
                transition: 'all 0.15s ease',
              }}
            >
              <span>{tool.icon}</span>
              {toolLabel(tool.id)}
            </button>
          ))}
        </div>

        {/* Active tool info + count */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <span style={{ color: toolConfig.color, fontSize: '0.85rem', fontWeight: 700 }}>
            {toolConfig.icon} {toolLabel(activeTool)}
          </span>
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            {expiredEntries.length > 0 && (
              <div style={{
                padding: '0.2rem 0.6rem', backgroundColor: '#ef444420',
                border: '1px solid #ef444440', borderRadius: '20px',
                color: '#ef4444', fontSize: '0.7rem', fontWeight: 600,
              }}>
                {expiredEntries.length} expired
              </div>
            )}
            <div style={{
              padding: '0.2rem 0.6rem', backgroundColor: `${toolConfig.color}20`,
              border: `1px solid ${toolConfig.color}40`, borderRadius: '20px',
              color: toolConfig.color, fontSize: '0.7rem', fontWeight: 600,
            }}>
              {activeEntries.length} {t('admin.toolAccess.users', 'active')}{activeEntries.length !== 1 ? '' : ''}
            </div>
          </div>
        </div>

        {/* Grant Type Toggle */}
        <div style={{
          display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.75rem',
          padding: '0.6rem 0.75rem', backgroundColor: colors.bg, borderRadius: '8px',
          border: `1px solid ${colors.border}`,
        }}>
          <span style={{ color: colors.textSecondary, fontSize: '0.75rem', fontWeight: 600, marginRight: '0.25rem' }}>
            {t('admin.toolAccess.grantType', 'Grant type:')}
          </span>
          {(['permanent', 'trial'] as const).map(gt => (
            <button
              key={gt}
              onClick={() => setGrantType(gt)}
              style={{
                padding: '0.3rem 0.7rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600,
                cursor: 'pointer', transition: 'all 0.15s ease',
                border: `1px solid ${grantType === gt ? (gt === 'trial' ? '#f59e0b60' : '#22c55e60') : colors.border}`,
                backgroundColor: grantType === gt ? (gt === 'trial' ? '#f59e0b15' : '#22c55e15') : 'transparent',
                color: grantType === gt ? (gt === 'trial' ? '#f59e0b' : '#22c55e') : colors.textMuted,
              }}
            >
              {gt === 'permanent' ? t('admin.toolAccess.permanent', 'Permanent') : t('admin.toolAccess.trial', 'Trial')}
            </button>
          ))}

          {grantType === 'trial' && (
            <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', marginLeft: '0.5rem' }}>
              <input
                type="number"
                min={1}
                max={durationUnit === 'hours' ? 720 : 90}
                value={trialDuration}
                onChange={e => setTrialDuration(Math.max(1, parseInt(e.target.value) || 1))}
                style={{
                  width: '60px', padding: '0.3rem 0.4rem', backgroundColor: colors.cardAlt,
                  border: '1px solid #f59e0b40', borderRadius: '6px', color: '#f59e0b',
                  fontSize: '0.8rem', fontWeight: 600, textAlign: 'center', outline: 'none',
                }}
              />
              {(['hours', 'days'] as const).map(u => (
                <button
                  key={u}
                  onClick={() => setDurationUnit(u)}
                  style={{
                    padding: '0.3rem 0.5rem', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 600,
                    cursor: 'pointer',
                    border: `1px solid ${durationUnit === u ? '#f59e0b50' : colors.border}`,
                    backgroundColor: durationUnit === u ? '#f59e0b15' : 'transparent',
                    color: durationUnit === u ? '#f59e0b' : colors.textMuted,
                  }}
                >
                  {u}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Search */}
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            value={searchQuery}
            onChange={e => handleSearch(e.target.value)}
            placeholder={t('admin.toolAccess.searchPlaceholder', 'Search by Kingshot username...')}
            style={{
              width: '100%', padding: '0.6rem 0.75rem', backgroundColor: colors.bg,
              border: `1px solid ${colors.border}`, borderRadius: '8px', color: colors.text,
              fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box',
            }}
          />
          {searching && (
            <span style={{
              position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
              color: colors.textMuted, fontSize: '0.7rem',
            }}>
              {t('admin.toolAccess.searching', 'Searching...')}
            </span>
          )}

          {/* Search Results Dropdown */}
          {searchResults.length > 0 && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
              marginTop: '4px', backgroundColor: colors.cardAlt, border: `1px solid ${colors.border}`,
              borderRadius: '8px', overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
              maxHeight: '280px', overflowY: 'auto',
            }}>
              {searchResults.map(result => (
                <button
                  key={result.id}
                  onClick={() => grantAccess(result.id)}
                  disabled={adding === result.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.6rem',
                    width: '100%', padding: '0.6rem 0.75rem', backgroundColor: 'transparent',
                    border: 'none', borderBottom: `1px solid ${colors.surfaceHover}`, cursor: 'pointer',
                    textAlign: 'left', color: colors.text, transition: 'background-color 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#1a1a2a')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  {result.linked_avatar_url ? (
                    <img
                      src={result.linked_avatar_url}
                      alt=""
                      referrerPolicy="no-referrer"
                      style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                    />
                  ) : (
                    <div style={{
                      width: '28px', height: '28px', borderRadius: '50%',
                      backgroundColor: colors.border, display: 'flex', alignItems: 'center',
                      justifyContent: 'center', flexShrink: 0, fontSize: '0.7rem',
                    }}>
                      👤
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {result.linked_username}
                    </div>
                    <div style={{ color: colors.textMuted, fontSize: '0.65rem' }}>
                      K{result.linked_kingdom || '?'} · TC{result.linked_tc_level || '?'} · @{result.username}
                    </div>
                  </div>
                  <span style={{
                    padding: '0.2rem 0.5rem',
                    backgroundColor: grantType === 'trial' ? '#f59e0b20' : `${colors.success}20`,
                    border: `1px solid ${grantType === 'trial' ? '#f59e0b40' : colors.success + '40'}`,
                    borderRadius: '6px',
                    color: grantType === 'trial' ? '#f59e0b' : colors.success,
                    fontSize: '0.65rem', fontWeight: 600, flexShrink: 0,
                  }}>
                    {adding === result.id ? '...' : grantType === 'trial'
                      ? `+ ${trialDuration}${durationUnit === 'hours' ? 'h' : 'd'} ${t('admin.toolAccess.trial', 'Trial')}`
                      : `+ ${t('admin.toolAccess.grant', 'Grant')}`}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* No results */}
          {searchQuery.trim().length >= 2 && !searching && searchResults.length === 0 && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
              marginTop: '4px', backgroundColor: colors.cardAlt, border: `1px solid ${colors.border}`,
              borderRadius: '8px', padding: '0.75rem', textAlign: 'center',
              boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
            }}>
              <span style={{ color: colors.textMuted, fontSize: '0.8rem' }}>
                {t('admin.toolAccess.noResults', 'No linked Kingshot users found matching "{{query}}"', { query: searchQuery })}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Active Access List */}
      <div style={{
        backgroundColor: colors.cardAlt, borderRadius: '12px', padding: '1.25rem',
        border: `1px solid ${colors.border}`,
      }}>
        <h4 style={{ color: colors.text, margin: '0 0 0.75rem', fontSize: '0.9rem' }}>
          {t('admin.toolAccess.authorizedUsers', 'Authorized Users')}
        </h4>

        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: colors.textMuted, fontSize: '0.8rem' }}>
            {t('admin.toolAccess.loading', 'Loading...')}
          </div>
        ) : activeEntries.length === 0 ? (
          <div style={{
            padding: '2rem', textAlign: 'center', color: colors.textMuted,
            fontSize: '0.8rem', border: `1px dashed ${colors.border}`, borderRadius: '8px',
          }}>
            {t('admin.toolAccess.noUsersYet', 'No users have access to {{tool}} yet. Search above to grant access.', { tool: toolLabel(activeTool) })}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {activeEntries.map(entry => (
              <div
                key={entry.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.6rem',
                  padding: '0.5rem 0.65rem', backgroundColor: colors.bg,
                  border: `1px solid ${colors.surfaceHover}`, borderRadius: '8px',
                }}
              >
                {entry.linked_avatar_url ? (
                  <img
                    src={entry.linked_avatar_url}
                    alt=""
                    referrerPolicy="no-referrer"
                    style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                  />
                ) : (
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '50%',
                    backgroundColor: colors.border, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', flexShrink: 0, fontSize: '0.8rem',
                  }}>
                    👤
                  </div>
                )}

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.85rem', color: colors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {entry.linked_username}
                    </span>
                    {entry.expires_at ? (
                      <span style={{
                        padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.6rem', fontWeight: 700,
                        backgroundColor: '#f59e0b18', border: '1px solid #f59e0b30', color: '#f59e0b',
                        whiteSpace: 'nowrap',
                      }}>
                        {formatTimeRemaining(entry.expires_at)}
                      </span>
                    ) : (
                      <span style={{
                        padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.6rem', fontWeight: 700,
                        backgroundColor: '#22c55e18', border: '1px solid #22c55e30', color: '#22c55e',
                      }}>
                        {t('admin.toolAccess.permanent', 'Permanent')}
                      </span>
                    )}
                  </div>
                  <div style={{ color: colors.textMuted, fontSize: '0.65rem' }}>
                    K{entry.linked_kingdom || '?'} · TC{entry.linked_tc_level || '?'} · @{entry.username} · {t('admin.toolAccess.added', 'Added')} {formatDate(entry.created_at)}
                  </div>
                </div>

                <button
                  onClick={() => revokeAccess(entry.id)}
                  disabled={removing === entry.id}
                  style={{
                    padding: '0.25rem 0.6rem', backgroundColor: `${colors.error}15`,
                    border: `1px solid ${colors.error}30`, borderRadius: '6px',
                    color: colors.error, fontSize: '0.65rem', fontWeight: 600,
                    cursor: removing === entry.id ? 'not-allowed' : 'pointer',
                    flexShrink: 0, opacity: removing === entry.id ? 0.5 : 1,
                  }}
                >
                  {removing === entry.id ? '...' : t('admin.toolAccess.revoke', 'Revoke')}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Expired Trials */}
      {!loading && expiredEntries.length > 0 && (
        <div style={{
          backgroundColor: colors.cardAlt, borderRadius: '12px', padding: '1.25rem',
          border: '1px solid #ef444420',
        }}>
          <h4 style={{ color: '#ef4444', margin: '0 0 0.75rem', fontSize: '0.9rem' }}>
            {t('admin.toolAccess.expiredTrials', 'Expired Trials')} ({expiredEntries.length})
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {expiredEntries.map(entry => (
              <div
                key={entry.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.6rem',
                  padding: '0.5rem 0.65rem', backgroundColor: colors.bg,
                  border: '1px solid #ef444415', borderRadius: '8px', opacity: 0.7,
                }}
              >
                {entry.linked_avatar_url ? (
                  <img
                    src={entry.linked_avatar_url}
                    alt=""
                    referrerPolicy="no-referrer"
                    style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0, filter: 'grayscale(50%)' }}
                  />
                ) : (
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '50%',
                    backgroundColor: colors.border, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', flexShrink: 0, fontSize: '0.8rem',
                  }}>
                    👤
                  </div>
                )}

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.85rem', color: colors.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {entry.linked_username}
                    </span>
                    <span style={{
                      padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.6rem', fontWeight: 700,
                      backgroundColor: '#ef444418', border: '1px solid #ef444430', color: '#ef4444',
                    }}>
                      {t('admin.toolAccess.expired', 'Expired')}
                    </span>
                  </div>
                  <div style={{ color: colors.textMuted, fontSize: '0.65rem' }}>
                    K{entry.linked_kingdom || '?'} · {t('admin.toolAccess.expiredOn', 'Expired')} {formatDate(entry.expires_at!)}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.3rem', flexShrink: 0 }}>
                  <button
                    onClick={() => grantAccess(entry.user_id)}
                    disabled={adding === entry.user_id}
                    style={{
                      padding: '0.25rem 0.5rem', backgroundColor: '#22c55e15',
                      border: '1px solid #22c55e30', borderRadius: '6px',
                      color: '#22c55e', fontSize: '0.65rem', fontWeight: 600,
                      cursor: adding === entry.user_id ? 'not-allowed' : 'pointer',
                      opacity: adding === entry.user_id ? 0.5 : 1,
                    }}
                  >
                    {adding === entry.user_id ? '...' : t('admin.toolAccess.renew', 'Renew')}
                  </button>
                  <button
                    onClick={() => revokeAccess(entry.id)}
                    disabled={removing === entry.id}
                    style={{
                      padding: '0.25rem 0.5rem', backgroundColor: `${colors.error}15`,
                      border: `1px solid ${colors.error}30`, borderRadius: '6px',
                      color: colors.error, fontSize: '0.65rem', fontWeight: 600,
                      cursor: removing === entry.id ? 'not-allowed' : 'pointer',
                      opacity: removing === entry.id ? 0.5 : 1,
                    }}
                  >
                    {removing === entry.id ? '...' : t('admin.toolAccess.remove', 'Remove')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
