import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { useAnalytics } from '../../hooks/useAnalytics';
import { supabase } from '../../lib/supabase';
import { FONT_DISPLAY, colors } from '../../utils/styles';
import { useToast } from '../Toast';
import type { EditorInfo, FundInfo, TransfereeProfile } from './types';
import { formatTCLevel, LANGUAGE_OPTIONS, inputStyle } from './types';
import { getTransferGroup, getTransferGroupLabel } from '../../config/transferGroups';

const BROWSE_PAGE_SIZE = 25;

interface BrowseTransfereesTabProps {
  fund: FundInfo | null;
  editorInfo: EditorInfo | null;
}

const BrowseTransfereesTab: React.FC<BrowseTransfereesTabProps> = ({ fund, editorInfo }) => {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { trackFeature } = useAnalytics();

  // Determine recruiter's transfer group for filtering
  const transferGroup = editorInfo ? getTransferGroup(editorInfo.kingdom_number) : null;

  const [transferees, setTransferees] = useState<TransfereeProfile[]>([]);
  const [loadingTransferees, setLoadingTransferees] = useState(false);
  const [hasMoreTransferees, setHasMoreTransferees] = useState(true);
  const [browseFilters, setBrowseFilters] = useState<{ minTc: string; minPower: string; language: string; sortBy: string }>({ minTc: '', minPower: '', language: '', sortBy: 'newest' });
  const [compareList, setCompareList] = useState<Set<string>>(new Set());
  const [showCompare, setShowCompare] = useState(false);
  const [sentInviteIds, setSentInviteIds] = useState<Set<string>>(new Set());
  const [usedInvites, setUsedInvites] = useState(0);

  // Auto-load transferees on mount
  useEffect(() => {
    if (editorInfo && fund && transferees.length === 0) {
      loadTransferees();
    }
  }, [editorInfo, fund]);

  // Real-time subscription for new transferee profiles
  useEffect(() => {
    if (!supabase) return;
    const sb = supabase;
    const channel = sb
      .channel('browse-transferees')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'transfer_profiles',
      }, (payload) => {
        const newProfile = payload.new as TransfereeProfile;
        // Filter by transfer group + exclude own kingdom
        const inGroup = !transferGroup || (newProfile.current_kingdom >= transferGroup[0] && newProfile.current_kingdom <= transferGroup[1]);
        if (newProfile.is_active && newProfile.visible_to_recruiters && newProfile.current_kingdom !== editorInfo?.kingdom_number && inGroup) {
          setTransferees(prev => [newProfile, ...prev]);
        }
      })
      .subscribe();
    return () => { sb.removeChannel(channel); };
  }, []);

  const getInviteBudget = () => {
    if (!editorInfo || !fund) return { total: 35, used: usedInvites, bonus: 0 };
    const base = 35;
    const bonus = fund.tier === 'gold' ? 5 : 0;
    return { total: base + bonus, used: usedInvites, bonus };
  };

  const loadTransferees = async (loadMore = false) => {
    if (!supabase || !editorInfo || !fund) return;
    setLoadingTransferees(true);
    try {
      const offset = loadMore ? transferees.length : 0;
      let query = supabase
        .from('transfer_profiles')
        .select('id, username, current_kingdom, tc_level, power_million, power_range, main_language, kvk_availability, saving_for_kvk, group_size, player_bio, looking_for, is_anonymous, is_active, visible_to_recruiters, last_active_at')
        .eq('is_active', true)
        .eq('visible_to_recruiters', true)
        .neq('current_kingdom', editorInfo.kingdom_number);

      // Filter by transfer group — only show players from kingdoms in the same group
      if (transferGroup) {
        query = query.gte('current_kingdom', transferGroup[0]).lte('current_kingdom', transferGroup[1]);
      }

      const { data } = await query
        .order('created_at', { ascending: false })
        .range(offset, offset + BROWSE_PAGE_SIZE - 1);
      const results = (data as TransfereeProfile[]) || [];
      if (loadMore) {
        setTransferees(prev => [...prev, ...results]);
      } else {
        setTransferees(results);
      }
      setHasMoreTransferees(results.length === BROWSE_PAGE_SIZE);

      // Record profile views (fire-and-forget, one per profile per day)
      if (results.length > 0 && user) {
        const views = results.map(tp => ({
          transfer_profile_id: tp.id,
          viewer_user_id: user.id,
          viewer_kingdom_number: editorInfo.kingdom_number,
        }));
        supabase.from('transfer_profile_views').upsert(views, {
          onConflict: 'transfer_profile_id,viewer_user_id,view_date',
          ignoreDuplicates: true,
        }).then(() => {});
      }
    } catch {
      // silent
    } finally {
      setLoadingTransferees(false);
    }
  };

  return (
    <div>
      {/* Transfer Group Info Banner */}
      {transferGroup && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.4rem',
          padding: '0.4rem 0.75rem',
          backgroundColor: '#22d3ee08',
          border: '1px solid #22d3ee20',
          borderRadius: '8px',
          marginBottom: '0.75rem',
          fontSize: '0.7rem',
        }}>
          <span>🔀</span>
          <span style={{ color: '#22d3ee', fontWeight: '600' }}>
            {t('recruiter.transferGroupFilter', 'Transfer Group')}: {getTransferGroupLabel(transferGroup)}
          </span>
          <span style={{ color: colors.textMuted }}>
            {t('recruiter.showingPlayersInGroup', 'Showing players from kingdoms in your transfer group')}
          </span>
        </div>
      )}

      {/* Budget Banner */}
      {fund && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0.5rem 0.75rem',
          backgroundColor: '#111111',
          borderRadius: '8px',
          border: '1px solid #2a2a2a',
          marginBottom: '0.75rem',
        }}>
          <span style={{ color: colors.textSecondary, fontSize: '0.75rem' }}>
            {t('recruiter.inviteBudget', 'Invite Budget')}: <strong style={{ color: colors.text }}>{getInviteBudget().total - getInviteBudget().used}</strong> {t('recruiter.remaining', 'remaining')}
            {getInviteBudget().bonus > 0 && <span style={{ color: colors.gold, fontSize: '0.6rem' }}> (+{getInviteBudget().bonus} Gold bonus)</span>}
          </span>
          <button onClick={() => loadTransferees()} style={{
            padding: '0.25rem 0.5rem', backgroundColor: '#22d3ee10', border: '1px solid #22d3ee25',
            borderRadius: '6px', color: '#22d3ee', fontSize: '0.65rem', cursor: 'pointer', minHeight: '32px',
          }}>
            ↻ {t('recruiter.refresh', 'Refresh')}
          </button>
        </div>
      )}

      {/* Browse Filters */}
      <div style={{
        display: 'flex', gap: '0.4rem', marginBottom: '0.75rem',
        flexWrap: 'wrap', alignItems: 'flex-end',
      }}>
        <div style={{ flex: '1 1 100px', minWidth: '80px' }}>
          <span style={{ color: '#6b7280', fontSize: '0.6rem', display: 'block', marginBottom: '0.15rem' }}>{t('recruiter.minTC', 'Min TC')}</span>
          <select
            value={browseFilters.minTc}
            onChange={(e) => setBrowseFilters(f => ({ ...f, minTc: e.target.value }))}
            style={{ ...inputStyle, fontSize: '0.7rem', padding: '0.35rem 0.5rem', minHeight: '36px' }}
          >
            <option value="">Any</option>
            {[15, 20, 25, 30, 35, 40, 45, 50, 55, 60].map(lvl => (
              <option key={lvl} value={lvl}>{formatTCLevel(lvl)}</option>
            ))}
          </select>
        </div>
        <div style={{ flex: '1 1 100px', minWidth: '80px' }}>
          <span style={{ color: '#6b7280', fontSize: '0.6rem', display: 'block', marginBottom: '0.15rem' }}>{t('recruiter.minPower', 'Min Power')}</span>
          <input
            type="number"
            placeholder="e.g. 100"
            value={browseFilters.minPower}
            onChange={(e) => setBrowseFilters(f => ({ ...f, minPower: e.target.value }))}
            style={{ ...inputStyle, fontSize: '0.7rem', padding: '0.35rem 0.5rem', minHeight: '36px' }}
          />
        </div>
        <div style={{ flex: '1 1 120px', minWidth: '90px' }}>
          <span style={{ color: '#6b7280', fontSize: '0.6rem', display: 'block', marginBottom: '0.15rem' }}>{t('recruiter.language', 'Language')}</span>
          <select
            value={browseFilters.language}
            onChange={(e) => setBrowseFilters(f => ({ ...f, language: e.target.value }))}
            style={{ ...inputStyle, fontSize: '0.7rem', padding: '0.35rem 0.5rem', minHeight: '36px' }}
          >
            <option value="">Any</option>
            {LANGUAGE_OPTIONS.map(lang => (
              <option key={lang} value={lang}>{lang}</option>
            ))}
          </select>
        </div>
        <div style={{ flex: '1 1 100px', minWidth: '80px' }}>
          <span style={{ color: '#6b7280', fontSize: '0.6rem', display: 'block', marginBottom: '0.15rem' }}>{t('recruiter.sortBy', 'Sort By')}</span>
          <select
            value={browseFilters.sortBy}
            onChange={(e) => setBrowseFilters(f => ({ ...f, sortBy: e.target.value }))}
            style={{ ...inputStyle, fontSize: '0.7rem', padding: '0.35rem 0.5rem', minHeight: '36px' }}
          >
            <option value="newest">{t('recruiter.newestFirst', 'Newest First')}</option>
            <option value="power_desc">{t('recruiter.powerHighLow', 'Power (High → Low)')}</option>
            <option value="tc_desc">{t('recruiter.tcHighLow', 'TC Level (High → Low)')}</option>
          </select>
        </div>
        {(browseFilters.minTc || browseFilters.minPower || browseFilters.language) && (
          <button
            onClick={() => setBrowseFilters({ minTc: '', minPower: '', language: '', sortBy: browseFilters.sortBy })}
            style={{
              padding: '0.35rem 0.5rem', backgroundColor: '#ef444410', border: '1px solid #ef444425',
              borderRadius: '6px', color: '#ef4444', fontSize: '0.6rem', cursor: 'pointer', minHeight: '36px',
              whiteSpace: 'nowrap',
            }}
          >
            {t('recruiter.clear', 'Clear Filters')}
          </button>
        )}
      </div>

      {/* Compare Bar */}
      {compareList.size > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0.4rem 0.75rem',
          backgroundColor: '#a855f708',
          border: '1px solid #a855f720',
          borderRadius: '8px',
          marginBottom: '0.75rem',
        }}>
          <span style={{ color: '#a855f7', fontSize: '0.75rem', fontWeight: '600' }}>
            {t('recruiter.selectedForComparison', '{{count}} selected for comparison', { count: compareList.size })}
          </span>
          <div style={{ display: 'flex', gap: '0.3rem' }}>
            <button
              onClick={() => setShowCompare(true)}
              disabled={compareList.size < 2}
              style={{
                padding: '0.3rem 0.6rem', backgroundColor: compareList.size >= 2 ? '#a855f715' : '#1a1a1a',
                border: `1px solid ${compareList.size >= 2 ? '#a855f730' : '#2a2a2a'}`,
                borderRadius: '6px', color: compareList.size >= 2 ? '#a855f7' : '#4b5563',
                fontSize: '0.65rem', fontWeight: '600', cursor: compareList.size >= 2 ? 'pointer' : 'not-allowed', minHeight: '32px',
              }}
            >
              {t('recruiter.compare', 'Compare')}
            </button>
            <button
              onClick={() => setCompareList(new Set())}
              style={{
                padding: '0.3rem 0.5rem', backgroundColor: 'transparent', border: '1px solid #2a2a2a',
                borderRadius: '6px', color: '#6b7280', fontSize: '0.6rem', cursor: 'pointer', minHeight: '32px',
              }}
            >
              {t('recruiter.clear', 'Clear')}
            </button>
          </div>
        </div>
      )}

      {(() => {
        // Apply browse filters
        const filtered = transferees.filter(tp => {
          if (browseFilters.minTc) {
            const min = parseInt(browseFilters.minTc);
            if ((tp.tc_level || 0) < min) return false;
          }
          if (browseFilters.minPower) {
            const min = parseInt(browseFilters.minPower);
            if ((tp.power_million || 0) < min) return false;
          }
          if (browseFilters.language) {
            if (tp.main_language !== browseFilters.language) return false;
          }
          return true;
        });
        // Apply sorting
        if (browseFilters.sortBy === 'power_desc') {
          filtered.sort((a, b) => (b.power_million || 0) - (a.power_million || 0));
        } else if (browseFilters.sortBy === 'tc_desc') {
          filtered.sort((a, b) => (b.tc_level || 0) - (a.tc_level || 0));
        }
        // 'newest' is default order from Supabase (created_at desc)

        if (loadingTransferees) return (
          <div style={{ textAlign: 'center', padding: '2rem 0', color: '#6b7280' }}>{t('recruiter.loadingTransferees', 'Loading transferees...')}</div>
        );
        if (filtered.length === 0) return (
          <div style={{
            textAlign: 'center', padding: '2.5rem 1rem',
            backgroundColor: '#111111', borderRadius: '12px',
            border: '1px solid #2a2a2a',
          }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem', opacity: 0.5 }}>
              {transferees.length > 0 ? '🔍' : '📭'}
            </div>
            <p style={{ color: '#d1d5db', fontSize: '0.9rem', fontWeight: '600', marginBottom: '0.3rem' }}>
              {transferees.length > 0 ? t('recruiter.noTransfereesMatch', 'No transferees match your filters') : t('recruiter.noActiveProfiles', 'No active transfer profiles yet')}
            </p>
            <p style={{ color: '#6b7280', fontSize: '0.75rem', marginBottom: transferees.length > 0 ? '0.75rem' : 0 }}>
              {transferees.length > 0
                ? t('recruiter.tryAdjustingFilters', 'Try adjusting your filters to broaden results.')
                : t('recruiter.playersWillAppear', 'Players who are looking to transfer will appear here once they create a profile.')}
            </p>
            {transferees.length > 0 && (
              <button
                onClick={() => setBrowseFilters({ minTc: '', minPower: '', language: '', sortBy: browseFilters.sortBy })}
                style={{
                  padding: '0.4rem 1rem', backgroundColor: '#a855f710',
                  border: '1px solid #a855f725', borderRadius: '6px',
                  color: '#a855f7', fontSize: '0.7rem', fontWeight: '600',
                  cursor: 'pointer', minHeight: '36px',
                }}
              >
                {t('recruiter.clearFilters', 'Clear Filters')}
              </button>
            )}
          </div>
        );

        // Compute match scores for "Recommended for you"
        const withScores = fund ? filtered.map(tp => {
          let matched = 0, total = 0;
          const minPwr = fund.min_power_million || 0;
          if (minPwr > 0) { total++; if ((tp.power_million || 0) >= minPwr) matched++; }
          if (fund.min_tc_level && fund.min_tc_level > 0) { total++; if ((tp.tc_level || 0) >= fund.min_tc_level) matched++; }
          if (fund.main_language) { total++; if (tp.main_language === fund.main_language) matched++; }
          const score = total > 0 ? Math.round((matched / total) * 100) : 0;
          return { ...tp, _matchScore: score };
        }) : [];
        const recommended = withScores
          .filter(tp => tp._matchScore >= 60)
          .sort((a, b) => b._matchScore - a._matchScore)
          .slice(0, 5);

        return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {/* Recommended for you section */}
          {recommended.length > 0 && !browseFilters.minTc && !browseFilters.minPower && !browseFilters.language && (
            <div style={{
              backgroundColor: '#a855f708', border: '1px solid #a855f720',
              borderRadius: '10px', padding: '0.6rem 0.75rem', marginBottom: '0.25rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem' }}>
                <span style={{ fontSize: '0.85rem' }}>⭐</span>
                <span style={{ color: '#a855f7', fontSize: '0.75rem', fontWeight: '700' }}>{t('recruiter.recommendedForYou', 'Recommended for You')}</span>
                <span style={{ color: '#6b7280', fontSize: '0.6rem' }}>{t('recruiter.basedOnRequirements', 'Based on your kingdom requirements')}</span>
              </div>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {recommended.map(tp => (
                  <div key={`rec-${tp.id}`} style={{
                    padding: '0.3rem 0.5rem', backgroundColor: '#1a1a20',
                    border: '1px solid #a855f725', borderRadius: '8px',
                    display: 'flex', alignItems: 'center', gap: '0.35rem',
                    fontSize: '0.65rem', minWidth: '120px',
                  }}>
                    <span style={{ color: '#d1d5db', fontWeight: '600' }}>
                      {(tp as { is_anonymous?: boolean }).is_anonymous ? '🔒 Anon' : ((tp as { username?: string }).username || 'Unknown')}
                    </span>
                    <span style={{ color: '#a855f7', fontWeight: 'bold' }}>{tp._matchScore}%</span>
                    <span style={{ color: '#6b7280' }}>{formatTCLevel(tp.tc_level)} · {tp.power_million ? `${tp.power_million}M` : '—'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <span style={{ color: '#4b5563', fontSize: '0.65rem' }}>{filtered.length} transferee{filtered.length !== 1 ? 's' : ''}{browseFilters.minTc || browseFilters.minPower || browseFilters.language ? ' (filtered)' : ''}</span>
          {filtered.map((tp) => {
            const isAnon = tp.is_anonymous as boolean;
            const canSeeDetails = fund && ['bronze', 'silver', 'gold'].includes(fund.tier);
            const canSendInvite = fund && ['silver', 'gold'].includes(fund.tier);
            const budgetLeft = getInviteBudget().total - getInviteBudget().used;
            return (
              <div key={tp.id} style={{
                backgroundColor: colors.bg,
                border: `1px solid ${colors.border}`,
                borderRadius: '10px',
                padding: '0.75rem',
              }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span style={{ color: colors.text, fontWeight: '600', fontSize: '0.85rem' }}>
                      {isAnon ? '🔒 Anonymous' : (tp.username || 'Unknown')}
                    </span>
                    <span style={{ color: colors.textMuted, fontSize: '0.65rem' }}>K{tp.current_kingdom}</span>
                    {tp.last_active_at && (() => {
                      const diff = Date.now() - new Date(tp.last_active_at).getTime();
                      const mins = Math.floor(diff / 60000);
                      const hrs = Math.floor(diff / 3600000);
                      const days = Math.floor(diff / 86400000);
                      const label = mins < 60 ? `${mins}m ago` : hrs < 24 ? `${hrs}h ago` : `${days}d ago`;
                      const fresh = days < 3;
                      return (
                        <span style={{ color: fresh ? '#22c55e' : '#6b7280', fontSize: '0.55rem' }}>
                          {fresh ? '🟢' : '⚪'} {label}
                        </span>
                      );
                    })()}
                  </div>
                  <div style={{ display: 'flex', gap: '0.3rem' }}>
                    <span style={{
                      padding: '0.1rem 0.35rem',
                      backgroundColor: '#eab30808',
                      border: '1px solid #eab30820',
                      borderRadius: '4px',
                      fontSize: '0.6rem',
                      color: '#eab308',
                    }}>
                      {formatTCLevel(tp.tc_level)}
                    </span>
                    <span style={{
                      padding: '0.1rem 0.35rem',
                      backgroundColor: '#f9731608',
                      border: '1px solid #f9731620',
                      borderRadius: '4px',
                      fontSize: '0.6rem',
                      color: '#f97316',
                    }}>
                      {tp.power_million ? `${tp.power_million}M` : (tp.power_range || '—')}
                    </span>
                  </div>
                </div>

                {/* Quick Stats */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginBottom: '0.4rem' }}>
                  <span style={{ color: colors.textSecondary, fontSize: '0.65rem' }}>🌐 {tp.main_language}</span>
                  {tp.kvk_availability && (
                    <span style={{ color: colors.textSecondary, fontSize: '0.65rem' }}>⚔️ {tp.kvk_availability}</span>
                  )}
                  <span style={{ color: colors.textSecondary, fontSize: '0.65rem' }}>👥 {tp.group_size}</span>
                </div>

                {/* Looking For Tags */}
                {tp.looking_for?.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2rem', marginBottom: '0.4rem' }}>
                    {tp.looking_for.map((tag) => (
                      <span key={tag} style={{
                        padding: '0.08rem 0.35rem',
                        backgroundColor: '#22d3ee08',
                        border: '1px solid #22d3ee18',
                        borderRadius: '4px',
                        fontSize: '0.55rem',
                        color: '#22d3ee',
                      }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Bio (if can see details) */}
                {canSeeDetails && tp.player_bio && (
                  <p style={{ color: colors.textSecondary, fontSize: '0.7rem', margin: '0 0 0.4rem 0', lineHeight: 1.4, fontStyle: 'italic' }}>
                    &ldquo;{tp.player_bio}&rdquo;
                  </p>
                )}

                {/* Tier Gate Message */}
                {!canSeeDetails && (
                  <p style={{ color: colors.textMuted, fontSize: '0.65rem', margin: '0.25rem 0', fontStyle: 'italic' }}>
                    🔒 {t('recruiter.upgradeBronze', 'Upgrade to Bronze+ to view full profile details')}
                  </p>
                )}

                {/* Compare + Send Invite Row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'space-between' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer', fontSize: '0.65rem', color: compareList.has(tp.id) ? '#a855f7' : '#6b7280' }}>
                    <input
                      type="checkbox"
                      checked={compareList.has(tp.id)}
                      onChange={() => {
                        setCompareList(prev => {
                          const next = new Set(prev);
                          if (next.has(tp.id)) next.delete(tp.id);
                          else if (next.size < 4) next.add(tp.id);
                          return next;
                        });
                      }}
                      style={{ accentColor: '#a855f7' }}
                    />
                    {t('recruiter.compare', 'Compare')}
                  </label>
                {canSendInvite ? (
                  <button
                    disabled={budgetLeft <= 0 || sentInviteIds.has(tp.id)}
                    onClick={async () => {
                      if (!supabase || !user || !editorInfo) return;
                      try {
                        // Check for existing pending invite
                        const { data: existing } = await supabase
                          .from('transfer_invites')
                          .select('id')
                          .eq('kingdom_number', editorInfo.kingdom_number)
                          .eq('recipient_profile_id', tp.id)
                          .eq('status', 'pending')
                          .maybeSingle();
                        if (existing) {
                          showToast('An invite is already pending for this player.', 'error');
                          setSentInviteIds(prev => new Set(prev).add(tp.id));
                          return;
                        }

                        const { error } = await supabase.from('transfer_invites').insert({
                          kingdom_number: editorInfo.kingdom_number,
                          sender_user_id: user.id,
                          recipient_profile_id: tp.id,
                        });
                        if (error) {
                          showToast('Failed to send invite: ' + error.message, 'error');
                        } else {
                          setUsedInvites(prev => prev + 1);
                          setSentInviteIds(prev => new Set(prev).add(tp.id));
                          trackFeature('Invite Sent', { kingdom: editorInfo.kingdom_number });
                          showToast('Invite sent!', 'success');
                          // Notify the transferee
                          const { data: profileRow } = await supabase
                            .from('transfer_profiles')
                            .select('user_id')
                            .eq('id', tp.id)
                            .single();
                          if (profileRow) {
                            await supabase.from('notifications').insert({
                              user_id: profileRow.user_id,
                              type: 'transfer_invite',
                              title: 'Kingdom Invite Received',
                              message: `Kingdom ${editorInfo.kingdom_number} has invited you to transfer!`,
                              link: '/transfer-hub',
                              metadata: { kingdom_number: editorInfo.kingdom_number },
                            });
                          }
                        }
                      } catch {
                        showToast('Failed to send invite.', 'error');
                      }
                    }}
                    style={{
                      padding: '0.35rem 0.75rem',
                      backgroundColor: sentInviteIds.has(tp.id) ? '#22c55e10' : budgetLeft > 0 ? '#a855f715' : '#1a1a1a',
                      border: `1px solid ${sentInviteIds.has(tp.id) ? '#22c55e30' : budgetLeft > 0 ? '#a855f730' : '#2a2a2a'}`,
                      borderRadius: '6px',
                      color: sentInviteIds.has(tp.id) ? '#22c55e' : budgetLeft > 0 ? '#a855f7' : '#4b5563',
                      fontSize: '0.7rem',
                      fontWeight: '600',
                      cursor: budgetLeft > 0 && !sentInviteIds.has(tp.id) ? 'pointer' : 'not-allowed',
                      minHeight: '36px',
                    }}
                  >
                    {sentInviteIds.has(tp.id) ? t('recruiter.invited', '✓ Invited') : budgetLeft > 0 ? t('recruiter.sendInvite', '📩 Send Invite') : t('recruiter.noInvitesRemaining', 'No invites remaining')}
                  </button>
                ) : (
                  <p style={{ color: colors.textMuted, fontSize: '0.6rem', margin: '0.25rem 0', fontStyle: 'italic' }}>
                    🔒 {t('recruiter.upgradeSilver', 'Upgrade to Silver+ to send invites')}
                  </p>
                )}
                </div>
              </div>
            );
          })}
        </div>
        );
      })()}

      {/* Load More Button */}
      {hasMoreTransferees && !loadingTransferees && transferees.length > 0 && (
        <div style={{ textAlign: 'center', padding: '1rem 0' }}>
          <button
            onClick={() => loadTransferees(true)}
            style={{
              padding: '0.5rem 1.5rem',
              backgroundColor: '#22d3ee10',
              border: '1px solid #22d3ee30',
              borderRadius: '8px',
              color: '#22d3ee',
              fontSize: '0.8rem',
              fontWeight: '600',
              cursor: 'pointer',
              minHeight: '40px',
            }}
          >
            {t('recruiter.loadMore', 'Load More')} ({transferees.length} {t('recruiter.loaded', 'loaded')})
          </button>
        </div>
      )}
      {loadingTransferees && transferees.length > 0 && (
        <div style={{ textAlign: 'center', padding: '1rem 0', color: '#6b7280', fontSize: '0.8rem' }}>
          {t('recruiter.loadingMore', 'Loading more...')}
        </div>
      )}

      {/* Comparison Modal */}
      {showCompare && compareList.size >= 2 && (() => {
        const selected = transferees.filter(tp => compareList.has(tp.id));
        if (selected.length < 2) return null;
        const fields: { key: string; label: string; render: (tp: TransfereeProfile) => string }[] = [
          { key: 'tc', label: t('recruiter.tcLevel', 'TC Level'), render: (tp) => formatTCLevel(tp.tc_level) },
          { key: 'power', label: t('recruiter.power', 'Power'), render: (tp) => tp.power_million ? `${tp.power_million}M` : (tp.power_range || '—') },
          { key: 'lang', label: t('recruiter.language', 'Language'), render: (tp) => tp.main_language || '—' },
          { key: 'kvk', label: t('recruiter.kvkAvail', 'KvK Avail.'), render: (tp) => (tp.kvk_availability || '—').replace(/_/g, ' ') },
          { key: 'saving', label: t('recruiter.savingFor', 'Saving For'), render: (tp) => (tp.saving_for_kvk || '—').replace(/_/g, ' ') },
          { key: 'group', label: t('recruiter.groupSize', 'Group Size'), render: (tp) => String(tp.group_size || '—') },
          { key: 'looking', label: t('recruiter.lookingFor', 'Looking For'), render: (tp) => tp.looking_for?.join(', ') || '—' },
        ];
        return (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.9)', zIndex: 1100,
            display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center',
            padding: isMobile ? 0 : '1rem',
          }} onClick={() => setShowCompare(false)}>
            <div style={{
              backgroundColor: '#111111', border: '1px solid #2a2a2a',
              borderRadius: isMobile ? '16px 16px 0 0' : '16px',
              padding: isMobile ? '1rem' : '1.5rem',
              maxWidth: '700px', width: '100%', maxHeight: '80vh', overflowY: 'auto',
              paddingBottom: isMobile ? 'max(1rem, env(safe-area-inset-bottom))' : '1.5rem',
            }} onClick={(e) => e.stopPropagation()}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <h3 style={{ color: '#fff', fontSize: '1rem', fontWeight: '700', margin: 0, fontFamily: FONT_DISPLAY }}>
                  {t('recruiter.profileComparison', 'Profile Comparison')}
                </h3>
                <button onClick={() => setShowCompare(false)} style={{
                  background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '1.2rem', padding: '0.25rem',
                }}>✕</button>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '0.4rem 0.5rem', color: '#6b7280', borderBottom: '1px solid #2a2a2a', fontSize: '0.65rem' }}>{t('recruiter.field', 'Field')}</th>
                      {selected.map(tp => (
                        <th key={tp.id} style={{ textAlign: 'center', padding: '0.4rem 0.5rem', color: '#22d3ee', borderBottom: '1px solid #2a2a2a', fontSize: '0.7rem', fontWeight: '600' }}>
                          {tp.is_anonymous ? '🔒 Anonymous' : (tp.username || 'Unknown')}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {fields.map(field => (
                      <tr key={field.key}>
                        <td style={{ padding: '0.4rem 0.5rem', color: '#9ca3af', borderBottom: '1px solid #1a1a1a', fontWeight: '500', whiteSpace: 'nowrap' }}>{field.label}</td>
                        {selected.map(tp => (
                          <td key={tp.id} style={{ padding: '0.4rem 0.5rem', color: '#d1d5db', borderBottom: '1px solid #1a1a1a', textAlign: 'center', textTransform: 'capitalize' }}>
                            {field.render(tp)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default BrowseTransfereesTab;
