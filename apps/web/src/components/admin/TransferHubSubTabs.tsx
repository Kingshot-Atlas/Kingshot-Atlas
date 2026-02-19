import React from 'react';
import { colors } from '../../utils/styles';
import {
  EditorClaim,
  TransferHubStats,
  STATUS_COLORS,
} from './transferHubTypes';

// =============================================
// SHARED HELPERS
// =============================================

export const actionBtn = (bg: string, border: string, color: string, disabled?: boolean): React.CSSProperties => ({
  padding: '0.2rem 0.5rem',
  backgroundColor: disabled ? colors.surfaceHover : bg,
  border: `1px solid ${disabled ? colors.border : border}`,
  borderRadius: '4px',
  color: disabled ? colors.textMuted : color,
  fontSize: '0.6rem',
  fontWeight: 600,
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.5 : 1,
});

export const ConfirmDialog: React.FC<{
  action: { id: string; action: string; name: string };
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ action, loading, onConfirm, onCancel }) => (
  <div style={{
    padding: '0.5rem 0.75rem',
    backgroundColor: `${colors.error}10`,
    border: `1px solid ${colors.error}30`,
    borderRadius: '6px',
    marginTop: '0.5rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '0.7rem',
  }}>
    <span style={{ color: colors.error }}>
      {action.action === 'remove' ? `Remove ${action.name}?` : `${action.action} ${action.name}?`}
    </span>
    <button
      onClick={onConfirm}
      disabled={loading}
      style={actionBtn(`${colors.error}20`, `${colors.error}40`, colors.error, loading)}
    >
      {loading ? '...' : 'Confirm'}
    </button>
    <button onClick={onCancel} style={actionBtn('transparent', colors.border, colors.textMuted)}>
      Cancel
    </button>
  </div>
);

// =============================================
// OVERVIEW TAB
// =============================================

export const OverviewTab: React.FC<{ stats: TransferHubStats | null }> = ({ stats }) => {
  if (!stats) return <div style={{ textAlign: 'center', padding: '2rem', color: colors.textMuted }}>No data</div>;

  const cards = [
    { label: 'Editor Claims', value: stats.totalEditors, sub: `${stats.pendingEditors} pending · ${stats.activeEditors} active`, color: colors.purple, icon: '👑' },
    { label: 'Kingdom Funds', value: stats.totalFunds, sub: `$${stats.totalFundBalance.toFixed(2)} balance · $${stats.totalContributed.toFixed(2)} contributed`, color: colors.gold, icon: '💰' },
    { label: 'Recruiting', value: stats.recruitingKingdoms, sub: 'kingdoms actively recruiting', color: colors.success, icon: '📢' },
    { label: 'Transfer Profiles', value: stats.totalProfiles, sub: `${stats.activeProfiles} active`, color: colors.blue, icon: '🔄' },
    { label: 'Applications', value: stats.totalApplications, sub: `${stats.pendingApplications} pending · ${stats.acceptedApplications} accepted`, color: colors.primary, icon: '📨' },
    { label: 'Invites Sent', value: stats.totalInvites, sub: 'recruiter-initiated', color: colors.orange, icon: '✉️' },
    { label: 'Profile Views', value: stats.totalProfileViews, sub: 'transfer profile impressions', color: colors.pink, icon: '👁️' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
        {cards.map((card, i) => (
          <div key={i} style={{
            backgroundColor: colors.cardAlt,
            borderRadius: '10px',
            padding: '1rem',
            border: `1px solid ${colors.border}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
              <span>{card.icon}</span>
              <span style={{ color: colors.textMuted, fontSize: '0.75rem' }}>{card.label}</span>
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: card.color }}>{card.value}</div>
            <div style={{ color: colors.textMuted, fontSize: '0.7rem', marginTop: '0.25rem' }}>{card.sub}</div>
          </div>
        ))}
      </div>

      {/* Health Indicators */}
      <div style={{
        backgroundColor: colors.cardAlt,
        borderRadius: '10px',
        padding: '1rem',
        border: `1px solid ${colors.border}`,
      }}>
        <h4 style={{ color: colors.text, margin: '0 0 0.75rem', fontSize: '0.85rem' }}>Transfer Hub Health</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {[
            { label: 'Pending editor claims need attention', count: stats.pendingEditors, severity: stats.pendingEditors > 5 ? 'warning' : stats.pendingEditors > 0 ? 'info' : 'ok' },
            { label: 'Applications awaiting response', count: stats.pendingApplications, severity: stats.pendingApplications > 10 ? 'warning' : stats.pendingApplications > 0 ? 'info' : 'ok' },
            { label: 'Inactive transfer profiles', count: stats.totalProfiles - stats.activeProfiles, severity: (stats.totalProfiles - stats.activeProfiles) > 5 ? 'warning' : 'ok' },
          ].map((item, i) => (
            <div key={i} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.8rem',
            }}>
              <div style={{
                width: '8px', height: '8px', borderRadius: '50%',
                backgroundColor: item.severity === 'ok' ? colors.success : item.severity === 'info' ? colors.warning : colors.error,
              }} />
              <span style={{ color: colors.textSecondary }}>{item.label}</span>
              <span style={{
                color: item.severity === 'ok' ? colors.success : item.severity === 'info' ? colors.warning : colors.error,
                fontWeight: 600,
              }}>
                {item.count}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// =============================================
// EDITORS TAB
// =============================================

export interface EditorsTabProps {
  editors: EditorClaim[];
  timeAgo: (d: string | null) => string;
  actionLoading: string | null;
  confirmAction: { id: string; action: string; name: string } | null;
  onConfirmAction: (a: { id: string; action: string; name: string } | null) => void;
  onUpdateStatus: (id: string, status: string, userId: string, kn: number, msg: string) => void;
  onRemove: (id: string, userId: string, kn: number) => void;
  onBulkDeactivate: () => void;
}

export const EditorsTab: React.FC<EditorsTabProps> = ({
  editors, timeAgo, actionLoading, confirmAction, onConfirmAction, onUpdateStatus, onRemove, onBulkDeactivate,
}) => {
  if (editors.length === 0) {
    return <div style={{ textAlign: 'center', padding: '2rem', color: colors.textMuted }}>No editor claims yet</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ color: colors.textMuted, fontSize: '0.75rem' }}>
          {editors.length} total claim{editors.length !== 1 ? 's' : ''} · {editors.filter(e => e.status === 'pending').length} pending · {editors.filter(e => e.status === 'active').length} active
        </div>
        <button
          onClick={onBulkDeactivate}
          disabled={actionLoading === 'bulk'}
          style={actionBtn(`${colors.textMuted}10`, `${colors.textMuted}40`, colors.textMuted, actionLoading === 'bulk')}
        >
          {actionLoading === 'bulk' ? 'Processing...' : 'Deactivate 30d+ Inactive'}
        </button>
      </div>
      {editors.map(editor => {
        const sc = STATUS_COLORS[editor.status] ?? { bg: `${colors.warning}15`, border: `${colors.warning}40`, text: colors.warning };
        const endorsementPct = editor.required_endorsements > 0
          ? Math.min(100, (editor.endorsement_count / editor.required_endorsements) * 100)
          : 0;
        const displayName = editor.linked_username || editor.username || 'Unknown';
        const isLoading = actionLoading === editor.id;
        return (
          <div key={editor.id} style={{
            backgroundColor: colors.cardAlt,
            borderRadius: '10px',
            border: `1px solid ${colors.border}`,
            padding: '1rem',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <span style={{ color: colors.text, fontWeight: 600, fontSize: '0.9rem' }}>{displayName}</span>
                  <span style={{
                    padding: '0.1rem 0.4rem',
                    backgroundColor: sc.bg,
                    border: `1px solid ${sc.border}`,
                    borderRadius: '4px',
                    fontSize: '0.65rem',
                    fontWeight: 600,
                    color: sc.text,
                    textTransform: 'capitalize',
                  }}>
                    {editor.status}
                  </span>
                  <span style={{
                    padding: '0.1rem 0.4rem',
                    backgroundColor: `${colors.primary}15`,
                    border: `1px solid ${colors.primary}40`,
                    borderRadius: '4px',
                    fontSize: '0.65rem',
                    fontWeight: 600,
                    color: colors.primary,
                    textTransform: 'capitalize',
                  }}>
                    {editor.role}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.7rem', color: colors.textMuted }}>
                  <span>Kingdom <strong style={{ color: colors.primary }}>K{editor.kingdom_number}</strong></span>
                  {editor.linked_kingdom && <span>Home: K{editor.linked_kingdom}</span>}
                  {editor.linked_tc_level && <span>TC{editor.linked_tc_level > 30 ? '30+' : editor.linked_tc_level}</span>}
                  <span>Nominated {timeAgo(editor.nominated_at)}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '0.3rem', flexShrink: 0 }}>
                {editor.status !== 'active' && (
                  <button
                    onClick={() => onUpdateStatus(editor.id, 'active', editor.user_id, editor.kingdom_number, `Your editor claim for Kingdom ${editor.kingdom_number} has been activated by an admin.`)}
                    disabled={isLoading}
                    style={actionBtn(`${colors.success}15`, `${colors.success}40`, colors.success, isLoading)}
                  >Activate</button>
                )}
                {editor.status !== 'suspended' && editor.status !== 'pending' && (
                  <button
                    onClick={() => onUpdateStatus(editor.id, 'suspended', editor.user_id, editor.kingdom_number, `Your editor role for Kingdom ${editor.kingdom_number} has been suspended by an admin.`)}
                    disabled={isLoading}
                    style={actionBtn(`${colors.warning}15`, `${colors.warning}40`, colors.warning, isLoading)}
                  >Suspend</button>
                )}
                <button
                  onClick={() => onConfirmAction({ id: editor.id, action: 'remove', name: displayName })}
                  disabled={isLoading}
                  style={actionBtn(`${colors.error}15`, `${colors.error}40`, colors.error, isLoading)}
                >Remove</button>
              </div>
            </div>

            {/* Confirm dialog */}
            {confirmAction?.id === editor.id && (
              <ConfirmDialog
                action={confirmAction}
                loading={isLoading}
                onConfirm={() => onRemove(editor.id, editor.user_id, editor.kingdom_number)}
                onCancel={() => onConfirmAction(null)}
              />
            )}

            {/* Endorsement Progress */}
            <div style={{ marginTop: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                <span style={{ color: colors.textSecondary, fontSize: '0.75rem' }}>Endorsements</span>
                <span style={{
                  color: endorsementPct >= 100 ? colors.success : colors.warning,
                  fontSize: '0.75rem',
                  fontWeight: 600,
                }}>
                  {editor.endorsement_count}/{editor.required_endorsements}
                </span>
              </div>
              <div style={{
                height: '6px',
                backgroundColor: colors.surfaceHover,
                borderRadius: '3px',
                overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%',
                  width: `${endorsementPct}%`,
                  backgroundColor: endorsementPct >= 100 ? colors.success : endorsementPct >= 50 ? colors.warning : colors.error,
                  borderRadius: '3px',
                  transition: 'width 0.3s ease',
                }} />
              </div>
            </div>

            {/* Endorsement Test Link (admin tool) */}
            {editor.status === 'pending' && (
              <div style={{
                display: 'flex', gap: '0.5rem', marginTop: '0.5rem', alignItems: 'center',
                padding: '0.4rem 0.6rem',
                backgroundColor: `${colors.purple}08`,
                border: `1px solid ${colors.purple}20`,
                borderRadius: '6px',
              }}>
                <span style={{ color: colors.purple, fontSize: '0.65rem', fontWeight: 500 }}>Test endorsement flow:</span>
                <button
                  onClick={() => {
                    const link = `${window.location.origin}/transfer-hub?endorse=${editor.id}`;
                    navigator.clipboard.writeText(link);
                    const btn = document.getElementById(`copy-btn-${editor.id}`);
                    if (btn) { btn.textContent = 'Copied!'; setTimeout(() => { btn.textContent = 'Copy Link'; }, 2000); }
                  }}
                  id={`copy-btn-${editor.id}`}
                  style={{
                    padding: '0.15rem 0.5rem',
                    backgroundColor: `${colors.purple}15`,
                    border: `1px solid ${colors.purple}30`,
                    borderRadius: '4px',
                    color: colors.purple,
                    fontSize: '0.6rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >Copy Link</button>
                <button
                  onClick={() => window.open(`/transfer-hub?endorse=${editor.id}`, '_blank')}
                  style={{
                    padding: '0.15rem 0.5rem',
                    backgroundColor: `${colors.primary}15`,
                    border: `1px solid ${colors.primary}30`,
                    borderRadius: '4px',
                    color: colors.primary,
                    fontSize: '0.6rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >Open in New Tab</button>
              </div>
            )}

            {/* Timeline */}
            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', fontSize: '0.65rem', color: colors.textMuted }}>
              {editor.activated_at && <span>Activated {timeAgo(editor.activated_at)}</span>}
              {editor.last_active_at && <span>Last active {timeAgo(editor.last_active_at)}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// =============================================
// CO-EDITORS TAB
// =============================================

export interface CoEditorsTabProps {
  editors: EditorClaim[];
  timeAgo: (d: string | null) => string;
  actionLoading: string | null;
  confirmAction: { id: string; action: string; name: string } | null;
  onConfirmAction: (a: { id: string; action: string; name: string } | null) => void;
  onUpdateStatus: (id: string, status: string, userId: string, kn: number, msg: string) => void;
  onRemove: (id: string, userId: string, kn: number) => void;
  onPromote: (id: string, userId: string, kn: number) => void;
}

export const CoEditorsTab: React.FC<CoEditorsTabProps> = ({
  editors, timeAgo, actionLoading, confirmAction, onConfirmAction, onUpdateStatus, onRemove, onPromote,
}) => {
  if (editors.length === 0) {
    return <div style={{ textAlign: 'center', padding: '2rem', color: colors.textMuted }}>No co-editors yet</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ color: colors.textMuted, fontSize: '0.75rem' }}>
        {editors.length} co-editor{editors.length !== 1 ? 's' : ''} · {editors.filter(e => e.status === 'pending').length} pending · {editors.filter(e => e.status === 'active').length} active
      </div>
      {editors.map(editor => {
        const sc = STATUS_COLORS[editor.status] ?? { bg: `${colors.warning}15`, border: `${colors.warning}40`, text: colors.warning };
        const displayName = editor.linked_username || editor.username || 'Unknown';
        const isLoading = actionLoading === editor.id;
        return (
          <div key={editor.id} style={{
            backgroundColor: colors.cardAlt,
            borderRadius: '10px',
            border: `1px solid ${colors.border}`,
            padding: '1rem',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <span style={{ color: colors.text, fontWeight: 600, fontSize: '0.9rem' }}>{displayName}</span>
                  <span style={{
                    padding: '0.1rem 0.4rem',
                    backgroundColor: sc.bg,
                    border: `1px solid ${sc.border}`,
                    borderRadius: '4px',
                    fontSize: '0.65rem',
                    fontWeight: 600,
                    color: sc.text,
                    textTransform: 'capitalize',
                  }}>
                    {editor.status}
                  </span>
                  <span style={{
                    padding: '0.1rem 0.4rem',
                    backgroundColor: `${colors.purple}15`,
                    border: `1px solid ${colors.purple}40`,
                    borderRadius: '4px',
                    fontSize: '0.65rem',
                    fontWeight: 600,
                    color: colors.purple,
                  }}>
                    Co-Editor
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.7rem', color: colors.textMuted }}>
                  <span>Kingdom <strong style={{ color: colors.primary }}>K{editor.kingdom_number}</strong></span>
                  {editor.linked_kingdom && <span>Home: K{editor.linked_kingdom}</span>}
                  {editor.linked_tc_level && <span>TC{editor.linked_tc_level > 30 ? '30+' : editor.linked_tc_level}</span>}
                  <span>Nominated {timeAgo(editor.nominated_at)}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '0.3rem', flexShrink: 0 }}>
                {editor.status !== 'active' && (
                  <button
                    onClick={() => onUpdateStatus(editor.id, 'active', editor.user_id, editor.kingdom_number, `Your co-editor role for Kingdom ${editor.kingdom_number} has been activated by an admin.`)}
                    disabled={isLoading}
                    style={actionBtn(`${colors.success}15`, `${colors.success}40`, colors.success, isLoading)}
                  >Activate</button>
                )}
                <button
                  onClick={() => onConfirmAction({ id: editor.id, action: 'promote', name: displayName })}
                  disabled={isLoading}
                  style={actionBtn(`${colors.primary}15`, `${colors.primary}40`, colors.primary, isLoading)}
                >Promote to Editor</button>
                {editor.status !== 'suspended' && editor.status !== 'pending' && (
                  <button
                    onClick={() => onUpdateStatus(editor.id, 'suspended', editor.user_id, editor.kingdom_number, `Your co-editor role for Kingdom ${editor.kingdom_number} has been suspended by an admin.`)}
                    disabled={isLoading}
                    style={actionBtn(`${colors.warning}15`, `${colors.warning}40`, colors.warning, isLoading)}
                  >Suspend</button>
                )}
                <button
                  onClick={() => onConfirmAction({ id: editor.id, action: 'remove', name: displayName })}
                  disabled={isLoading}
                  style={actionBtn(`${colors.error}15`, `${colors.error}40`, colors.error, isLoading)}
                >Remove</button>
              </div>
            </div>

            {/* Confirm dialog */}
            {confirmAction?.id === editor.id && (
              <ConfirmDialog
                action={confirmAction}
                loading={isLoading}
                onConfirm={() => {
                  if (confirmAction.action === 'promote') {
                    onPromote(editor.id, editor.user_id, editor.kingdom_number);
                  } else {
                    onRemove(editor.id, editor.user_id, editor.kingdom_number);
                  }
                }}
                onCancel={() => onConfirmAction(null)}
              />
            )}

            {/* Timeline */}
            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', fontSize: '0.65rem', color: colors.textMuted }}>
              {editor.activated_at && <span>Activated {timeAgo(editor.activated_at)}</span>}
              {editor.last_active_at && <span>Last active {timeAgo(editor.last_active_at)}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// FundsTab, ProfilesTab, AuditLogTab extracted to TransferHubSubTabsExtra.tsx
export { FundsTab, ProfilesTab, AuditLogTab } from './TransferHubSubTabsExtra';
export type { FundsTabProps } from './TransferHubSubTabsExtra';
