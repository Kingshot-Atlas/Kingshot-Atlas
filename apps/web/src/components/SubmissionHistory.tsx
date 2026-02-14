// C1: Show submission status history in user profile
// C3: Add appeal option for rejected submissions
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { contributorService, type ContributorStats, type UserNotification } from '../services/contributorService';
import { useToast } from './Toast';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { colors } from '../utils/styles';

interface DataCorrection {
  id: string;
  kingdom_number: number;
  field: string;
  current_value: string;
  suggested_value: string;
  reason: string;
  submitter_id: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  review_notes?: string;
  appeal?: { reason: string; submitted_at: string };
}

interface KvKError {
  id: string;
  kingdom_number: number;
  kvk_number: number | null;
  error_type_label: string;
  description: string;
  submitted_by: string;
  submitted_at: string;
  status: 'pending' | 'approved' | 'rejected';
  review_notes?: string;
  appeal?: { reason: string; submitted_at: string };
}

const SubmissionHistory: React.FC<{ userId?: string; themeColor?: string }> = ({ userId, themeColor = '#22d3ee' }) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'submissions' | 'notifications' | 'badges'>('submissions');
  const [corrections, setCorrections] = useState<DataCorrection[]>([]);
  const [kvkErrors, setKvkErrors] = useState<KvKError[]>([]);
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [stats, setStats] = useState<ContributorStats | null>(null);
  const [appealModal, setAppealModal] = useState<{ type: 'correction' | 'kvkError'; id: string } | null>(null);
  const [appealReason, setAppealReason] = useState('');

  const targetUserId = userId || user?.id;

  useEffect(() => {
    if (!targetUserId) return;

    // Load all data from Supabase (single source of truth)
    const loadAllData = async () => {
      if (!isSupabaseConfigured || !supabase) {
        setCorrections([]);
        setKvkErrors([]);
        setNotifications([]);
        setStats(null);
        return;
      }

      try {
        // Fetch data corrections from Supabase
        const { data: correctionsData } = await supabase
          .from('data_corrections')
          .select('*')
          .eq('submitted_by', targetUserId)
          .order('created_at', { ascending: false });

        if (correctionsData) {
          setCorrections(correctionsData.map(c => ({
            id: c.id,
            kingdom_number: c.kingdom_number,
            field: c.field,
            current_value: c.current_value,
            suggested_value: c.suggested_value,
            reason: c.reason || '',
            submitter_id: c.submitted_by,
            status: c.status,
            created_at: c.created_at,
            review_notes: c.review_notes
          })));
        }

        // Fetch KvK errors from Supabase
        const { data: kvkErrorsData } = await supabase
          .from('kvk_errors')
          .select('*')
          .eq('submitted_by', targetUserId)
          .order('created_at', { ascending: false });

        if (kvkErrorsData) {
          setKvkErrors(kvkErrorsData.map(e => ({
            id: e.id,
            kingdom_number: e.kingdom_number,
            kvk_number: e.kvk_number,
            error_type_label: e.error_type_label,
            description: e.description,
            submitted_by: e.submitted_by,
            submitted_at: e.submitted_at || e.created_at,
            status: e.status,
            review_notes: e.review_notes
          })));
        }

        // Fetch notifications and stats
        const [notifs, userStats] = await Promise.all([
          contributorService.getNotifications(targetUserId),
          contributorService.getContributorStats(targetUserId)
        ]);
        setNotifications(notifs);
        setStats(userStats);
      } catch {
        setCorrections([]);
        setKvkErrors([]);
        setNotifications([]);
        setStats(null);
      }
    };

    loadAllData();
  }, [targetUserId]);

  // C3: Submit appeal (Note: appeals not yet supported in Supabase schema - would need appeal column)
  // For now, show message that appeals should be submitted via Discord
  const submitAppeal = () => {
    if (!appealModal || !appealReason.trim()) {
      showToast('Please provide a reason for your appeal', 'error');
      return;
    }

    // Appeals require direct admin contact for now
    showToast('Appeal noted. Please contact an admin on Discord for faster resolution.', 'info');
    setAppealModal(null);
    setAppealReason('');
  };

  const markAllRead = async () => {
    await Promise.all(notifications.map(n => contributorService.markNotificationRead(n.id)));
    setNotifications(notifications.map(n => ({ ...n, read: true })));
  };

  const allSubmissions = [
    ...corrections.map(c => ({ ...c, type: 'correction' as const, date: c.created_at })),
    ...kvkErrors.map(e => ({ ...e, type: 'kvkError' as const, date: e.submitted_at }))
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div style={{
      backgroundColor: '#111116',
      borderRadius: '16px',
      padding: '1.5rem',
      border: `1px solid ${colors.border}`
    }}>
      <h3 style={{ color: '#fff', fontSize: '1rem', fontWeight: '600', marginBottom: '1rem', textAlign: 'center' }}>
        {t('submissionHistory.myContributions')}
      </h3>

      {/* Stats Summary */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', marginBottom: '1rem' }}>
          <div style={{ padding: '0.5rem', backgroundColor: colors.bg, borderRadius: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.25rem', fontWeight: '700', color: themeColor }}>
              {stats.totals.approved}
            </div>
            <div style={{ fontSize: '0.65rem', color: colors.textMuted }}>{t('submissionHistory.approved')}</div>
          </div>
          <div style={{ padding: '0.5rem', backgroundColor: colors.bg, borderRadius: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.25rem', fontWeight: '700', color: '#fbbf24' }}>
              {stats.totals.pending}
            </div>
            <div style={{ fontSize: '0.65rem', color: colors.textMuted }}>{t('submissionHistory.pending')}</div>
          </div>
          <div style={{ padding: '0.5rem', backgroundColor: colors.bg, borderRadius: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.25rem', fontWeight: '700', color: '#22c55e' }}>{stats.reputation}</div>
            <div style={{ fontSize: '0.65rem', color: colors.textMuted }}>{t('submissionHistory.reputation')}</div>
          </div>
          <div style={{ padding: '0.5rem', backgroundColor: colors.bg, borderRadius: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.25rem', fontWeight: '700', color: '#a855f7' }}>{stats.badges.length}</div>
            <div style={{ fontSize: '0.65rem', color: colors.textMuted }}>{t('submissionHistory.badges')}</div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid #2a2a2a', paddingBottom: '0.5rem' }}>
        {[
          { id: 'submissions', label: t('submissionHistory.submissions'), count: allSubmissions.length },
          { id: 'notifications', label: t('submissionHistory.notifications'), count: unreadCount },
          { id: 'badges', label: t('submissionHistory.badges'), count: stats?.badges.length || 0 }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            style={{
              padding: '0.4rem 0.75rem',
              backgroundColor: activeTab === tab.id ? themeColor : 'transparent',
              color: activeTab === tab.id ? '#0a0a0a' : '#9ca3af',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 500,
              cursor: 'pointer',
              fontSize: '0.8rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem'
            }}
          >
            {tab.label}
            {tab.count > 0 && (
              <span style={{
                backgroundColor: activeTab === tab.id ? '#0a0a0a' : (tab.id === 'notifications' && unreadCount > 0 ? '#ef4444' : '#3a3a3a'),
                color: activeTab === tab.id ? themeColor : '#fff',
                fontSize: '0.65rem',
                fontWeight: 700,
                padding: '0.1rem 0.35rem',
                borderRadius: '9999px'
              }}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === 'submissions' && (
        <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
          {allSubmissions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: colors.textMuted, fontSize: '0.85rem' }}>
              {t('submissionHistory.noSubmissions')}
            </div>
          ) : (
            allSubmissions.map((item) => (
              <div key={item.id} style={{
                padding: '0.75rem',
                backgroundColor: colors.bg,
                borderRadius: '8px',
                marginBottom: '0.5rem',
                border: '1px solid #1a1a1f'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ color: themeColor, fontSize: '0.85rem', fontWeight: 600 }}>
                    K{item.kingdom_number} - {item.type === 'correction' ? (item as DataCorrection).field : (item as KvKError).error_type_label}
                  </span>
                  <span style={{
                    padding: '0.15rem 0.5rem',
                    borderRadius: '9999px',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    backgroundColor: item.status === 'pending' ? '#fbbf2420' : item.status === 'approved' ? '#22c55e20' : '#ef444420',
                    color: item.status === 'pending' ? '#fbbf24' : item.status === 'approved' ? '#22c55e' : '#ef4444'
                  }}>
                    {item.status.toUpperCase()}
                  </span>
                </div>
                <div style={{ fontSize: '0.75rem', color: colors.textMuted }}>
                  {new Date(item.date).toLocaleDateString()}
                  {item.review_notes && <span style={{ color: colors.textSecondary }}> • {item.review_notes}</span>}
                </div>
                {/* C3: Appeal button for rejected items */}
                {item.status === 'rejected' && !item.appeal && (
                  <button
                    onClick={() => setAppealModal({ type: item.type, id: item.id })}
                    style={{
                      marginTop: '0.5rem',
                      padding: '0.4rem 0.75rem',
                      minHeight: '44px',
                      backgroundColor: '#fbbf2420',
                      border: '1px solid #fbbf2450',
                      borderRadius: '4px',
                      color: '#fbbf24',
                      fontSize: '0.75rem',
                      cursor: 'pointer'
                    }}
                  >
                    {t('submissionHistory.appealDecision')}
                  </button>
                )}
                {item.appeal && (
                  <div style={{ marginTop: '0.5rem', padding: '0.4rem', backgroundColor: '#fbbf2410', borderRadius: '4px', fontSize: '0.7rem', color: '#fbbf24' }}>
                    {t('submissionHistory.appealSubmitted')} {item.appeal.reason.substring(0, 50)}...
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'notifications' && (
        <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
          {unreadCount > 0 && (
            <button onClick={markAllRead} style={{
              marginBottom: '0.75rem',
              padding: '0.4rem 0.75rem',
              minHeight: '44px',
              backgroundColor: 'transparent',
              border: '1px solid #3a3a3a',
              borderRadius: '6px',
              color: colors.textSecondary,
              fontSize: '0.75rem',
              cursor: 'pointer'
            }}>
              {t('submissionHistory.markAllRead')}
            </button>
          )}
          {notifications.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: colors.textMuted, fontSize: '0.85rem' }}>
              {t('submissionHistory.noNotifications')}
            </div>
          ) : (
            notifications.map((notif) => (
              <div
                key={notif.id}
                onClick={() => { contributorService.markNotificationRead(notif.id); }}
                style={{
                  padding: '0.75rem',
                  backgroundColor: notif.read ? '#0a0a0a' : '#0a0a0a',
                  borderRadius: '8px',
                  marginBottom: '0.5rem',
                  border: notif.read ? '1px solid #1a1a1f' : `1px solid ${themeColor}50`,
                  cursor: 'pointer'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <span style={{ color: '#fff', fontSize: '0.85rem', fontWeight: notif.read ? 400 : 600 }}>
                    {notif.title}
                  </span>
                  {!notif.read && <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: themeColor }} />}
                </div>
                <div style={{ fontSize: '0.75rem', color: colors.textSecondary }}>{notif.message}</div>
                <div style={{ fontSize: '0.65rem', color: colors.textMuted, marginTop: '0.25rem' }}>
                  {new Date(notif.createdAt).toLocaleDateString()}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'badges' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
          {stats?.badges.length === 0 ? (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '2rem', color: colors.textMuted, fontSize: '0.85rem' }}>
              {t('submissionHistory.noBadges')}
            </div>
          ) : (
            stats?.badges.map((badgeId) => {
              const badge = contributorService.getBadgeInfo(badgeId);
              return (
                <div key={badgeId} style={{
                  padding: '0.75rem',
                  backgroundColor: colors.bg,
                  borderRadius: '8px',
                  border: '1px solid #1a1a1f',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <span style={{ fontSize: '1.5rem' }}>{badge.icon}</span>
                  <div>
                    <div style={{ color: '#fff', fontSize: '0.8rem', fontWeight: 600 }}>{badge.name}</div>
                    <div style={{ color: colors.textMuted, fontSize: '0.65rem' }}>{badge.description}</div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Appeal Modal */}
      {appealModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }} onClick={() => setAppealModal(null)}>
          <div style={{
            backgroundColor: colors.card,
            borderRadius: '16px',
            border: `1px solid ${colors.border}`,
            padding: '1.5rem',
            maxWidth: '400px',
            width: '90%'
          }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ color: '#fff', fontSize: '1rem', marginBottom: '1rem' }}>{t('submissionHistory.appealRejection')}</h3>
            <p style={{ color: colors.textSecondary, fontSize: '0.85rem', marginBottom: '1rem' }}>
              {t('submissionHistory.appealExplain')}
            </p>
            <textarea
              value={appealReason}
              onChange={(e) => setAppealReason(e.target.value)}
              placeholder={t('submissionHistory.appealPlaceholder')}
              rows={4}
              style={{
                width: '100%',
                padding: '0.75rem',
                backgroundColor: colors.bg,
                border: `1px solid ${colors.border}`,
                borderRadius: '8px',
                color: '#fff',
                fontSize: '0.85rem',
                resize: 'vertical',
                marginBottom: '1rem'
              }}
            />
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setAppealModal(null)} style={{
                padding: '0.5rem 1rem',
                minHeight: '44px',
                backgroundColor: 'transparent',
                border: '1px solid #3a3a3a',
                borderRadius: '6px',
                color: colors.textSecondary,
                cursor: 'pointer'
              }}>{t('submissionHistory.cancel')}</button>
              <button onClick={submitAppeal} style={{
                padding: '0.5rem 1rem',
                minHeight: '44px',
                backgroundColor: '#fbbf24',
                border: 'none',
                borderRadius: '6px',
                color: '#0a0a0a',
                fontWeight: 600,
                cursor: 'pointer'
              }}>{t('submissionHistory.submitAppeal')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubmissionHistory;
