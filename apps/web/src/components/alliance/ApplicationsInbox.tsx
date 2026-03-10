import React, { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../Toast';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { logAllianceActivity } from './logAllianceActivity';

// ─── Applications Inbox (managers only) ───
type AppRow = { id: string; applicant_username: string; applicant_player_id: string; applicant_user_id: string; message: string | null; status: string; created_at: string; resolved_at?: string };
const ApplicationsInbox: React.FC<{
  allianceId: string;
  canManage: boolean;
  isMobile: boolean;
  onResolved: () => void;
}> = ({ allianceId, canManage, isMobile, onResolved }) => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [apps, setApps] = useState<AppRow[]>([]);
  const [history, setHistory] = useState<AppRow[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);

  const fetchApps = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) return;
    setLoading(true);
    const { data } = await supabase
      .from('alliance_applications')
      .select('id, applicant_username, applicant_player_id, applicant_user_id, message, status, created_at, resolved_at')
      .eq('alliance_id', allianceId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true });
    setApps(data || []);
    setSelected(new Set());
    setLoading(false);
  }, [allianceId]);

  const fetchHistory = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) return;
    const { data } = await supabase
      .from('alliance_applications')
      .select('id, applicant_username, applicant_player_id, applicant_user_id, message, status, created_at, resolved_at')
      .eq('alliance_id', allianceId)
      .in('status', ['approved', 'rejected'])
      .order('resolved_at', { ascending: false })
      .limit(50);
    setHistory(data || []);
  }, [allianceId]);

  useEffect(() => { fetchApps(); }, [fetchApps]);
  useEffect(() => { if (showHistory) fetchHistory(); }, [showHistory, fetchHistory]);

  const handleAction = async (appId: string, status: 'approved' | 'rejected') => {
    if (!supabase) return;
    setProcessing(appId);
    const currentUser = (await supabase.auth.getUser()).data.user;
    const now = new Date().toISOString();
    const app = apps.find(a => a.id === appId);

    const { error } = await supabase
      .from('alliance_applications')
      .update({ status, resolved_by: currentUser?.id, resolved_at: now })
      .eq('id', appId);
    setProcessing(null);
    if (error) {
      showToast(t('allianceCenter.applicationActionFailed', 'Failed to process application'), 'error');
    } else {
      // On approval: add applicant to alliance roster
      if (status === 'approved' && app) {
        await supabase.from('alliance_members').insert({
          alliance_id: allianceId,
          player_name: app.applicant_username,
          player_id: app.applicant_player_id,
          added_by: currentUser?.id,
        });
      }
      // Notify the applicant
      if (app) {
        await supabase.from('notifications').insert({
          user_id: app.applicant_user_id,
          type: 'alliance_application_result',
          title: status === 'approved'
            ? t('allianceCenter.notifApprovedTitle', 'Application Approved!')
            : t('allianceCenter.notifRejectedTitle', 'Application Update'),
          message: status === 'approved'
            ? t('allianceCenter.notifApprovedMsg', 'You\'ve been accepted into the alliance! Welcome aboard.')
            : t('allianceCenter.notifRejectedMsg', 'Your alliance application was not accepted at this time.'),
          link: '/tools/alliance-center',
          metadata: { alliance_id: allianceId, status },
        });
      }
      // Log activity
      if (app && currentUser) {
        logAllianceActivity({
          allianceId,
          actorUserId: currentUser.id,
          actorName: currentUser.user_metadata?.username || currentUser.email || 'Unknown',
          action: status === 'approved' ? 'application_approved' : 'application_rejected',
          targetName: app.applicant_username,
        });
      }
      showToast(
        status === 'approved'
          ? t('allianceCenter.applicationApproved', 'Application approved — member added!')
          : t('allianceCenter.applicationRejected', 'Application rejected'),
        status === 'approved' ? 'success' : 'info'
      );
      onResolved();
      fetchApps();
      if (showHistory) fetchHistory();
    }
  };

  const handleBulkAction = async (status: 'approved' | 'rejected') => {
    if (!supabase || selected.size === 0) return;
    setBulkProcessing(true);
    const currentUser = (await supabase.auth.getUser()).data.user;
    const now = new Date().toISOString();
    const selectedApps = apps.filter(a => selected.has(a.id));

    const results = await Promise.all(
      Array.from(selected).map(appId =>
        supabase!.from('alliance_applications').update({ status, resolved_by: currentUser?.id, resolved_at: now }).eq('id', appId)
      )
    );
    const failures = results.filter(r => r.error);

    // On approval: add all approved applicants to roster + notify
    if (status === 'approved' && failures.length < selectedApps.length) {
      const approvedApps = selectedApps.filter((_, i) => !results[i]?.error);
      if (approvedApps.length > 0) {
        await supabase.from('alliance_members').insert(
          approvedApps.map(app => ({
            alliance_id: allianceId,
            player_name: app.applicant_username,
            player_id: app.applicant_player_id,
            added_by: currentUser?.id,
          }))
        );
      }
    }
    // Notify all processed applicants
    const processed = selectedApps.filter((_, i) => !results[i]?.error);
    if (processed.length > 0) {
      await supabase.from('notifications').insert(
        processed.map(app => ({
          user_id: app.applicant_user_id,
          type: 'alliance_application_result',
          title: status === 'approved'
            ? t('allianceCenter.notifApprovedTitle', 'Application Approved!')
            : t('allianceCenter.notifRejectedTitle', 'Application Update'),
          message: status === 'approved'
            ? t('allianceCenter.notifApprovedMsg', 'You\'ve been accepted into the alliance! Welcome aboard.')
            : t('allianceCenter.notifRejectedMsg', 'Your alliance application was not accepted at this time.'),
          link: '/tools/alliance-center',
          metadata: { alliance_id: allianceId, status },
        }))
      );
    }

    // Log activity for each processed app
    if (currentUser && processed.length > 0) {
      for (const app of processed) {
        logAllianceActivity({
          allianceId,
          actorUserId: currentUser.id,
          actorName: currentUser.user_metadata?.username || currentUser.email || 'Unknown',
          action: status === 'approved' ? 'application_approved' : 'application_rejected',
          targetName: app.applicant_username,
        });
      }
    }

    setBulkProcessing(false);
    if (failures.length > 0) {
      showToast(t('allianceCenter.applicationActionFailed', 'Failed to process application'), 'error');
    } else {
      showToast(
        status === 'approved'
          ? t('allianceCenter.applicationApproved', 'Application approved — member added!')
          : t('allianceCenter.applicationRejected', 'Application rejected'),
        status === 'approved' ? 'success' : 'info'
      );
      onResolved();
    }
    fetchApps();
    if (showHistory) fetchHistory();
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleSelectAll = () => {
    if (selected.size === apps.length) setSelected(new Set());
    else setSelected(new Set(apps.map(a => a.id)));
  };

  if (!canManage) return null;

  return (
    <div style={{ padding: isMobile ? '0 0.75rem 0.75rem' : '0 1rem 1rem' }}>
      {/* Sub-header: count + history toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem', flexWrap: 'wrap' }}>
        {apps.length > 0 && (
          <span style={{ color: '#9ca3af', fontSize: '0.7rem' }}>
            {apps.length} {t('allianceCenter.pendingLabel', 'pending')}
          </span>
        )}
        <button
          onClick={() => setShowHistory(!showHistory)}
          style={{
            marginLeft: 'auto', fontSize: '0.65rem', color: '#6b7280', background: 'none',
            border: '1px solid #ffffff10', borderRadius: '6px', padding: '0.2rem 0.5rem',
            cursor: 'pointer', transition: 'color 0.2s',
          }}
        >
          {showHistory ? t('allianceCenter.hideHistory', 'Hide History') : t('allianceCenter.showHistory', 'History')}
        </button>
      </div>

      {/* Bulk actions bar */}
      {apps.length > 1 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem',
          padding: '0.35rem 0.5rem', backgroundColor: '#0d1117', borderRadius: '6px', border: '1px solid #1e1e24',
          flexWrap: 'wrap',
        }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer', fontSize: '0.7rem', color: '#9ca3af' }}>
            <input
              type="checkbox"
              checked={selected.size === apps.length && apps.length > 0}
              onChange={toggleSelectAll}
              style={{ accentColor: '#a855f7' }}
            />
            {t('allianceCenter.selectAll', 'Select All')} ({selected.size}/{apps.length})
          </label>
          {selected.size > 0 && (
            <>
              <button
                onClick={() => handleBulkAction('approved')}
                disabled={bulkProcessing}
                style={{
                  fontSize: '0.65rem', fontWeight: 600, padding: '0.25rem 0.5rem', borderRadius: '5px',
                  backgroundColor: '#22c55e15', border: '1px solid #22c55e30', color: '#22c55e',
                  cursor: bulkProcessing ? 'default' : 'pointer', minHeight: isMobile ? '44px' : 'auto',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                {bulkProcessing ? '...' : `✅ ${t('allianceCenter.bulkApprove', 'Approve Selected')}`}
              </button>
              <button
                onClick={() => handleBulkAction('rejected')}
                disabled={bulkProcessing}
                style={{
                  fontSize: '0.65rem', fontWeight: 600, padding: '0.25rem 0.5rem', borderRadius: '5px',
                  backgroundColor: '#ef444410', border: '1px solid #ef444425', color: '#ef4444',
                  cursor: bulkProcessing ? 'default' : 'pointer', minHeight: isMobile ? '44px' : 'auto',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                {bulkProcessing ? '...' : `❌ ${t('allianceCenter.bulkReject', 'Reject Selected')}`}
              </button>
            </>
          )}
        </div>
      )}

      {/* Pending list */}
      {loading ? (
        <div style={{ color: '#6b7280', fontSize: '0.75rem', padding: '0.5rem 0' }}>{t('common.loading', 'Loading...')}</div>
      ) : apps.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '0.75rem 0' }}>
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ margin: '0 auto 0.5rem', display: 'block', opacity: 0.4 }}>
            <rect x="8" y="6" width="32" height="36" rx="4" stroke="#4b5563" strokeWidth="2" fill="none" />
            <line x1="14" y1="16" x2="34" y2="16" stroke="#4b5563" strokeWidth="1.5" opacity="0.4" />
            <line x1="14" y1="22" x2="30" y2="22" stroke="#4b5563" strokeWidth="1.5" opacity="0.3" />
            <line x1="14" y1="28" x2="26" y2="28" stroke="#4b5563" strokeWidth="1.5" opacity="0.2" />
            <circle cx="24" cy="34" r="4" stroke="#4b5563" strokeWidth="1.5" fill="none" strokeDasharray="3 2" />
            <path d="M22 34h4M24 32v4" stroke="#4b5563" strokeWidth="1" opacity="0.5" />
          </svg>
          <div style={{ color: '#4b5563', fontSize: '0.75rem' }}>{t('allianceCenter.noApplications', 'No pending applications')}</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {apps.map(app => (
            <div key={app.id} style={{
              display: 'flex', alignItems: isMobile ? 'flex-start' : 'center',
              flexDirection: isMobile ? 'column' : 'row',
              justifyContent: 'space-between', gap: isMobile ? '0.4rem' : '0.5rem',
              padding: '0.5rem 0.6rem', backgroundColor: selected.has(app.id) ? '#a855f710' : '#0d1117',
              borderRadius: '8px', border: `1px solid ${selected.has(app.id) ? '#a855f730' : '#1e1e24'}`,
              transition: 'background-color 0.15s',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                {apps.length > 1 && (
                  <input
                    type="checkbox"
                    checked={selected.has(app.id)}
                    onChange={() => toggleSelect(app.id)}
                    style={{ accentColor: '#a855f7', flexShrink: 0 }}
                  />
                )}
                <div>
                  <div style={{ color: '#e5e7eb', fontSize: '0.85rem', fontWeight: 600 }}>{app.applicant_username}</div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.15rem' }}>
                    <span style={{ color: '#4b5563', fontSize: '0.65rem' }}>ID: {app.applicant_player_id}</span>
                    <span style={{ color: '#4b5563', fontSize: '0.6rem' }}>
                      {new Date(app.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                  {app.message && (
                    <div style={{ color: '#6b7280', fontSize: '0.7rem', marginTop: '0.25rem', fontStyle: 'italic', maxWidth: '300px' }}>
                      "{app.message}"
                    </div>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.3rem', flexShrink: 0 }}>
                <button
                  onClick={() => handleAction(app.id, 'approved')}
                  disabled={!!processing || bulkProcessing}
                  style={{
                    padding: isMobile ? '0.5rem 0.75rem' : '0.3rem 0.6rem',
                    minHeight: isMobile ? '44px' : 'auto',
                    fontSize: '0.7rem', fontWeight: 600,
                    backgroundColor: '#22c55e15', border: '1px solid #22c55e30', borderRadius: '6px',
                    color: '#22c55e', cursor: processing || bulkProcessing ? 'default' : 'pointer',
                    transition: 'all 0.2s', WebkitTapHighlightColor: 'transparent',
                  }}
                >
                  {processing === app.id ? '...' : `✅ ${t('common.approve', 'Approve')}`}
                </button>
                <button
                  onClick={() => handleAction(app.id, 'rejected')}
                  disabled={!!processing || bulkProcessing}
                  style={{
                    padding: isMobile ? '0.5rem 0.75rem' : '0.3rem 0.6rem',
                    minHeight: isMobile ? '44px' : 'auto',
                    fontSize: '0.7rem', fontWeight: 600,
                    backgroundColor: '#ef444410', border: '1px solid #ef444425', borderRadius: '6px',
                    color: '#ef4444', cursor: processing || bulkProcessing ? 'default' : 'pointer',
                    transition: 'all 0.2s', WebkitTapHighlightColor: 'transparent',
                  }}
                >
                  {processing === app.id ? '...' : `❌ ${t('common.reject', 'Reject')}`}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* History section */}
      {showHistory && (
        <div style={{ marginTop: '0.75rem', borderTop: '1px solid #1e1e24', paddingTop: '0.6rem' }}>
          <div style={{ color: '#6b7280', fontSize: '0.7rem', fontWeight: 600, marginBottom: '0.4rem' }}>
            {t('allianceCenter.historyTitle', 'History')}
          </div>
          {history.length === 0 ? (
            <div style={{ color: '#4b5563', fontSize: '0.7rem' }}>{t('allianceCenter.noHistory', 'No resolved applications yet')}</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              {history.map(h => (
                <div key={h.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '0.35rem 0.5rem', backgroundColor: '#0d1117', borderRadius: '6px',
                  border: '1px solid #1e1e24', fontSize: '0.75rem',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0 }}>
                    <span style={{ fontSize: '0.7rem' }}>{h.status === 'approved' ? '✅' : '❌'}</span>
                    <span style={{ color: '#e5e7eb', fontWeight: 600 }}>{h.applicant_username}</span>
                    <span style={{ color: '#4b5563', fontSize: '0.6rem' }}>ID: {h.applicant_player_id}</span>
                  </div>
                  <span style={{ color: '#4b5563', fontSize: '0.6rem', flexShrink: 0 }}>
                    {h.resolved_at ? new Date(h.resolved_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ApplicationsInbox;
