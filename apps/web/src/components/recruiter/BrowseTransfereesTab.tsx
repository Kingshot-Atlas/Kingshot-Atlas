import React, { useState, useEffect, useMemo } from 'react';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useAnalytics } from '../../hooks/useAnalytics';
import { supabase } from '../../lib/supabase';
import { registerChannel, unregisterChannel } from '../../lib/realtimeGuard';
import { colors } from '../../utils/styles';
import { logger } from '../../utils/logger';
import { useToast } from '../Toast';
import type { EditorInfo, FundInfo, TransfereeProfile } from './types';
import { formatTCLevel } from './types';
import BrowseTransfereesFilters from './BrowseTransfereesFilters';
import { getTransferGroup, getTransferGroupLabel } from '../../config/transferGroups';
import RecommendedSection from './RecommendedSection';
import {
  type BrowseFilters, EMPTY_FILTERS, BROWSE_PAGE_SIZE,
  browseKeys, fetchTransfereePage, fetchWatchlistIds, fetchInvitedProfileIds,
} from './browseTransfereesQueries';

interface BrowseTransfereesTabProps {
  fund: FundInfo | null;
  editorInfo: EditorInfo | null;
  initialUsedInvites?: number;
}

const BrowseTransfereesTab: React.FC<BrowseTransfereesTabProps> = ({ fund, editorInfo, initialUsedInvites = 0 }) => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { trackFeature } = useAnalytics();
  const queryClient = useQueryClient();

  // Determine recruiter's transfer group for filtering
  const transferGroup = editorInfo ? getTransferGroup(editorInfo.kingdom_number) : null;
  const kingdomNumber = editorInfo?.kingdom_number ?? 0;

  // UI-only state (declared before useInfiniteQuery so filters are available in query key)
  const [browseFilters, setBrowseFilters] = useState<BrowseFilters>(EMPTY_FILTERS);
  const [sentInviteIds, setSentInviteIds] = useState<Set<string>>(new Set());
  const [usedInvites, setUsedInvites] = useState(initialUsedInvites);
  const [selectedForInvite, setSelectedForInvite] = useState<Set<string>>(new Set());
  const [bulkInviting, setBulkInviting] = useState(false);
  const [messageOpenId, setMessageOpenId] = useState<string | null>(null);
  const [messageText, setMessageText] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [sentMessageIds, setSentMessageIds] = useState<Set<string>>(new Set());

  // Sync when parent provides updated count from DB
  useEffect(() => {
    setUsedInvites(initialUsedInvites);
  }, [initialUsedInvites]);

  // ─── React Query: watchlist IDs ────────────────────────────
  const { data: savedToWatchlist = new Set<string>() } = useQuery({
    queryKey: browseKeys.watchlistIds(user?.id || '', kingdomNumber),
    queryFn: () => fetchWatchlistIds(user!.id, kingdomNumber),
    enabled: !!user && !!editorInfo,
    staleTime: 60 * 1000,
  });

  // ─── React Query: invited profile IDs ──────────────────────
  const { data: invitedProfileIds = new Set<string>() } = useQuery({
    queryKey: browseKeys.invitedIds(kingdomNumber),
    queryFn: () => fetchInvitedProfileIds(kingdomNumber),
    enabled: !!editorInfo,
    staleTime: 60 * 1000,
  });

  // ─── React Query: infinite transferee list (server-side filtered) ─────
  const {
    data: infiniteData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: loadingTransferees,
  } = useInfiniteQuery({
    queryKey: browseKeys.transferees(kingdomNumber, transferGroup, browseFilters),
    queryFn: ({ pageParam }) => fetchTransfereePage(kingdomNumber, transferGroup, browseFilters, pageParam),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage || lastPage.length < BROWSE_PAGE_SIZE) return undefined;
      return allPages.reduce((total, page) => total + page.length, 0);
    },
    enabled: !!editorInfo && !!fund,
    staleTime: 30 * 1000,
    retry: 2,
  });

  // Flatten pages and filter out invited profiles
  const transferees = useMemo(() => {
    const all = infiniteData?.pages.flat() ?? [];
    return all.filter(tp => !invitedProfileIds.has(tp.id));
  }, [infiniteData, invitedProfileIds]);

  // Record profile views when new pages load (fire-and-forget)
  useEffect(() => {
    if (!supabase || !user || !editorInfo || !infiniteData?.pages.length) return;
    const lastPage = infiniteData.pages[infiniteData.pages.length - 1];
    if (lastPage && lastPage.length > 0) {
      const views = lastPage.map(tp => ({
        transfer_profile_id: tp.id,
        viewer_user_id: user.id,
        viewer_kingdom_number: editorInfo.kingdom_number,
      }));
      supabase.from('transfer_profile_views').upsert(views, {
        onConflict: 'transfer_profile_id,viewer_user_id,view_date',
        ignoreDuplicates: true,
      }).then(() => {});
    }
  }, [infiniteData?.pages.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Real-time subscription for new transferee profiles — invalidate cache
  useEffect(() => {
    if (!supabase) return;
    const sb = supabase;
    if (!registerChannel('browse-transferees')) return;
    const channel = sb
      .channel('browse-transferees')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'transfer_profiles',
      }, () => {
        queryClient.invalidateQueries({ queryKey: browseKeys.all });
      })
      .subscribe();
    return () => { sb.removeChannel(channel); unregisterChannel('browse-transferees'); };
  }, [kingdomNumber, queryClient]);

  const saveToWatchlist = async (tp: TransfereeProfile) => {
    if (!supabase || !user || !editorInfo) return;
    try {
      const { error } = await supabase.from('recruiter_watchlist').insert({
        recruiter_user_id: user.id,
        kingdom_number: editorInfo.kingdom_number,
        player_name: tp.is_anonymous ? `Anon-${tp.id.slice(0, 6)}` : (tp.username || 'Unknown'),
        tc_level: tp.tc_level,
        power_range: tp.power_million ? `${tp.power_million}M` : (tp.power_range || null),
        language: tp.main_language || null,
        notes: '',
        target_event: 'next',
        source: 'browse',
        transfer_profile_id: tp.id,
      });
      if (error) {
        if (error.code === '23505') {
          showToast('Already on your watchlist.', 'error');
        } else {
          showToast('Failed to save.', 'error');
        }
        return;
      }
      // Optimistically update watchlist IDs cache
      queryClient.setQueryData<Set<string>>(browseKeys.watchlistIds(user.id, kingdomNumber), (prev) =>
        new Set(prev).add(tp.id)
      );
      showToast('Saved to watchlist for future event!', 'success');
      trackFeature('Watchlist Save', { kingdom: editorInfo.kingdom_number, source: 'browse' });
    } catch (err) {
      logger.error('BrowseTransfereesTab: saveToWatchlist failed', err);
      showToast('Failed to save.', 'error');
    }
  };

  const handleBulkInvite = async () => {
    if (!supabase || !user || !editorInfo || selectedForInvite.size === 0) return;
    const sb = supabase;
    const budget = getInviteBudget();
    const budgetLeft = budget.total - budget.used;
    const ids = Array.from(selectedForInvite).slice(0, budgetLeft);
    if (ids.length === 0) { showToast('No invite budget remaining.', 'error'); return; }
    setBulkInviting(true);
    let sent = 0;
    try {
      const results = await Promise.all(ids.map(async (profileId) => {
        const { data: existing } = await sb
          .from('transfer_invites')
          .select('id')
          .eq('kingdom_number', editorInfo.kingdom_number)
          .eq('recipient_profile_id', profileId)
          .eq('status', 'pending')
          .maybeSingle();
        if (existing) return false;
        const { error } = await sb.from('transfer_invites').insert({
          kingdom_number: editorInfo.kingdom_number,
          sender_user_id: user.id,
          recipient_profile_id: profileId,
        });
        return !error;
      }));
      sent = results.filter(Boolean).length;
      if (sent > 0) {
        setUsedInvites(prev => prev + sent);
        setSentInviteIds(prev => {
          const next = new Set(prev);
          ids.forEach(id => next.add(id));
          return next;
        });
        queryClient.setQueryData<Set<string>>(browseKeys.invitedIds(kingdomNumber), (prev) => {
          const next = new Set(prev);
          ids.forEach(id => next.add(id));
          return next;
        });
        trackFeature('Bulk Invite Sent', { kingdom: editorInfo.kingdom_number, count: sent });
        showToast(`${sent} invite${sent > 1 ? 's' : ''} sent!`, 'success');
      } else {
        showToast('All selected players already have pending invites.', 'error');
      }
    } catch (err) {
      logger.error('BrowseTransfereesTab: bulk invite failed', err);
      showToast('Some invites failed to send.', 'error');
    } finally {
      setSelectedForInvite(new Set());
      setBulkInviting(false);
    }
  };

  const sendPreAppMessage = async (profileId: string) => {
    if (!supabase || !user || !editorInfo || !messageText.trim()) return;
    setSendingMessage(true);
    try {
      const { error } = await supabase.from('pre_application_messages').insert({
        kingdom_number: editorInfo.kingdom_number,
        sender_user_id: user.id,
        recipient_profile_id: profileId,
        message: messageText.trim(),
      });
      if (error) {
        showToast('Failed to send message: ' + error.message, 'error');
      } else {
        setSentMessageIds(prev => new Set(prev).add(profileId));
        setMessageText('');
        setMessageOpenId(null);
        trackFeature('Pre-App Message Sent', { kingdom: editorInfo.kingdom_number });
        showToast(t('recruiter.messageSent', 'Message sent!'), 'success');
        // Notify the recipient
        const { data: profileRow } = await supabase
          .from('transfer_profiles')
          .select('user_id')
          .eq('id', profileId)
          .single();
        if (profileRow) {
          await supabase.from('notifications').insert({
            user_id: profileRow.user_id,
            type: 'pre_app_message',
            title: t('recruiter.preAppNotifTitle', 'New Message from a Kingdom'),
            message: t('recruiter.preAppNotifBody', 'Kingdom {{kn}} sent you a message about transferring.', { kn: editorInfo.kingdom_number }),
            link: '/messages',
            metadata: { kingdom_number: editorInfo.kingdom_number },
          });
        }
      }
    } catch (err) {
      logger.error('BrowseTransfereesTab: sendPreAppMessage failed', err);
      showToast('Failed to send message.', 'error');
    } finally {
      setSendingMessage(false);
    }
  };

  const getInviteBudget = () => {
    if (!editorInfo || !fund) return { total: 35, used: usedInvites, bonus: 0 };
    const base = 35;
    return { total: base, used: usedInvites, bonus: 0 };
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

      {/* Bulk Invite Action Bar */}
      {selectedForInvite.size > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0.4rem 0.75rem',
          backgroundColor: '#a855f712',
          border: '1px solid #a855f730',
          borderRadius: '8px',
          marginBottom: '0.75rem',
        }}>
          <span style={{ color: '#a855f7', fontSize: '0.75rem', fontWeight: '600' }}>
            {selectedForInvite.size} selected
          </span>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <button
              onClick={() => setSelectedForInvite(new Set())}
              style={{
                padding: '0.25rem 0.5rem', backgroundColor: 'transparent',
                border: '1px solid #6b728025', borderRadius: '6px',
                color: '#9ca3af', fontSize: '0.65rem', cursor: 'pointer', minHeight: '32px',
              }}
            >
              {t('recruiter.clearSelection', 'Clear')}
            </button>
            <button
              onClick={handleBulkInvite}
              disabled={bulkInviting}
              style={{
                padding: '0.25rem 0.75rem', backgroundColor: '#a855f7',
                border: 'none', borderRadius: '6px',
                color: '#fff', fontSize: '0.65rem', fontWeight: '700', cursor: bulkInviting ? 'wait' : 'pointer',
                minHeight: '32px', opacity: bulkInviting ? 0.6 : 1,
              }}
            >
              {bulkInviting ? t('recruiter.sending', 'Sending...') : t('recruiter.sendInvites', `Send ${selectedForInvite.size} Invite${selectedForInvite.size > 1 ? 's' : ''}`)}
            </button>
          </div>
        </div>
      )}

      {/* Browse Filters */}
      <BrowseTransfereesFilters filters={browseFilters} onChange={setBrowseFilters} />

      {/* Recommended for You */}
      {!loadingTransferees && (
        <RecommendedSection
          transferees={transferees}
          fund={fund}
          sentInviteIds={sentInviteIds}
          canInvite={!!fund && ['silver', 'gold'].includes(fund.tier) && getInviteBudget().total - getInviteBudget().used > 0}
          onSelectForInvite={(id) => setSelectedForInvite(prev => { const next = new Set(prev); next.add(id); return next; })}
        />
      )}

      {(() => {
        const hasActiveFilters = !!(browseFilters.minTc || browseFilters.minPower || browseFilters.language);

        if (loadingTransferees) return (
          <div style={{ textAlign: 'center', padding: '2rem 0', color: '#6b7280' }}>{t('recruiter.loadingTransferees', 'Loading recruit candidates...')}</div>
        );
        if (transferees.length === 0) return (
          <div style={{
            textAlign: 'center', padding: '2.5rem 1rem',
            backgroundColor: '#111111', borderRadius: '12px',
            border: '1px solid #2a2a2a',
          }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem', opacity: 0.5 }}>
              {hasActiveFilters ? '🔍' : '📭'}
            </div>
            <p style={{ color: '#d1d5db', fontSize: '0.9rem', fontWeight: '600', marginBottom: '0.3rem' }}>
              {hasActiveFilters ? t('recruiter.noTransfereesMatch', 'No recruit candidates match your filters') : t('recruiter.noActiveProfiles', 'No active transfer profiles yet')}
            </p>
            <p style={{ color: '#6b7280', fontSize: '0.75rem', marginBottom: hasActiveFilters ? '0.75rem' : 0 }}>
              {hasActiveFilters
                ? t('recruiter.tryAdjustingFilters', 'Try adjusting your filters to broaden results.')
                : t('recruiter.playersWillAppear', 'Players who are looking to transfer will appear here once they create a profile.')}
            </p>
            {hasActiveFilters && (
              <button
                onClick={() => setBrowseFilters({ ...EMPTY_FILTERS, sortBy: browseFilters.sortBy })}
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

        return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <span style={{ color: '#4b5563', fontSize: '0.65rem' }}>{transferees.length} recruit candidate{transferees.length !== 1 ? 's' : ''}{browseFilters.minTc || browseFilters.minPower || browseFilters.language ? ' (filtered)' : ''}</span>
          {transferees.map((tp: TransfereeProfile) => {
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
                    {canSendInvite && budgetLeft > 0 && !sentInviteIds.has(tp.id) && (
                      <input
                        type="checkbox"
                        checked={selectedForInvite.has(tp.id)}
                        onChange={() => setSelectedForInvite(prev => {
                          const next = new Set(prev);
                          if (next.has(tp.id)) next.delete(tp.id); else next.add(tp.id);
                          return next;
                        })}
                        style={{ accentColor: '#a855f7', cursor: 'pointer' }}
                      />
                    )}
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

                {/* Save for Later + Send Invite Row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <button
                      disabled={savedToWatchlist.has(tp.id)}
                      onClick={() => saveToWatchlist(tp)}
                      style={{
                        padding: '0.2rem 0.45rem',
                        backgroundColor: savedToWatchlist.has(tp.id) ? '#22c55e08' : '#eab30808',
                        border: `1px solid ${savedToWatchlist.has(tp.id) ? '#22c55e25' : '#eab30820'}`,
                        borderRadius: '4px',
                        color: savedToWatchlist.has(tp.id) ? '#22c55e' : '#eab308',
                        fontSize: '0.6rem',
                        fontWeight: '600',
                        cursor: savedToWatchlist.has(tp.id) ? 'default' : 'pointer',
                        minHeight: '28px',
                      }}
                    >
                      {savedToWatchlist.has(tp.id) ? '✓ Saved' : '📋 Save for Later'}
                    </button>
                  </div>
                {canSendInvite && (
                  <button
                    onClick={() => { setMessageOpenId(messageOpenId === tp.id ? null : tp.id); setMessageText(''); }}
                    style={{
                      padding: '0.2rem 0.45rem',
                      backgroundColor: sentMessageIds.has(tp.id) ? '#22c55e08' : '#3b82f608',
                      border: `1px solid ${sentMessageIds.has(tp.id) ? '#22c55e25' : '#3b82f620'}`,
                      borderRadius: '4px',
                      color: sentMessageIds.has(tp.id) ? '#22c55e' : '#3b82f6',
                      fontSize: '0.6rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      minHeight: '28px',
                    }}
                  >
                    {sentMessageIds.has(tp.id) ? t('recruiter.messageSentShort', '✓ Messaged') : t('recruiter.messageBtn', '💬 Message')}
                  </button>
                )}
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
                          // Update invited IDs cache so the profile is filtered out
                          queryClient.setQueryData<Set<string>>(browseKeys.invitedIds(kingdomNumber), (prev) =>
                            new Set(prev).add(tp.id)
                          );
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
                      } catch (err) {
                        logger.error('BrowseTransfereesTab: sendInvite failed', err);
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

                {/* Inline Pre-App Message Composer */}
                {messageOpenId === tp.id && canSendInvite && (
                  <div style={{
                    marginTop: '0.5rem', padding: '0.5rem',
                    backgroundColor: '#3b82f606', border: '1px solid #3b82f618',
                    borderRadius: '8px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.35rem' }}>
                      <span style={{ fontSize: '0.65rem', color: '#3b82f6', fontWeight: 600 }}>
                        💬 {t('recruiter.preAppMsgLabel', 'Message this candidate')}
                      </span>
                      <span style={{ fontSize: '0.55rem', color: colors.textMuted }}>
                        {t('recruiter.preAppMsgHint', '(your kingdom identity is visible, candidate stays anonymous)')}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.3rem' }}>
                      <input
                        type="text"
                        maxLength={500}
                        value={messageText}
                        onChange={e => setMessageText(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && messageText.trim()) sendPreAppMessage(tp.id); }}
                        placeholder={t('recruiter.preAppMsgPlaceholder', 'Introduce your kingdom or ask a question...')}
                        style={{
                          flex: 1, padding: '0.4rem 0.6rem', backgroundColor: colors.bg,
                          border: `1px solid ${colors.border}`, borderRadius: '6px',
                          color: colors.text, fontSize: '0.75rem', outline: 'none',
                        }}
                      />
                      <button
                        disabled={!messageText.trim() || sendingMessage}
                        onClick={() => sendPreAppMessage(tp.id)}
                        style={{
                          padding: '0.4rem 0.75rem', backgroundColor: '#3b82f6',
                          border: 'none', borderRadius: '6px',
                          color: '#fff', fontSize: '0.7rem', fontWeight: 700,
                          cursor: !messageText.trim() || sendingMessage ? 'not-allowed' : 'pointer',
                          opacity: !messageText.trim() || sendingMessage ? 0.5 : 1,
                          minHeight: '32px',
                        }}
                      >
                        {sendingMessage ? '...' : t('recruiter.send', 'Send')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        );
      })()}

      {/* Load More Button */}
      {hasNextPage && !isFetchingNextPage && transferees.length > 0 && (
        <div style={{ textAlign: 'center', padding: '1rem 0' }}>
          <button
            onClick={() => fetchNextPage()}
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
      {isFetchingNextPage && (
        <div style={{ textAlign: 'center', padding: '1rem 0', color: '#6b7280', fontSize: '0.8rem' }}>
          {t('recruiter.loadingMore', 'Loading more...')}
        </div>
      )}

    </div>
  );
};

export default BrowseTransfereesTab;
