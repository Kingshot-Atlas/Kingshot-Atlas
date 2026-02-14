import React from 'react';
import { useTranslation } from 'react-i18next';
import { colors } from '../../utils/styles';

interface NoEditorStateProps {
  pendingInvite: { id: string; kingdom_number: number; assigned_by: string | null } | null;
  onAcceptInvite: () => Promise<void>;
  onDeclineInvite: () => Promise<void>;
}

const NoEditorState: React.FC<NoEditorStateProps> = ({ pendingInvite, onAcceptInvite, onDeclineInvite }) => {
  const { t } = useTranslation();

  return (
    <div style={{
      textAlign: 'center', padding: '3rem 1rem',
      backgroundColor: colors.surface, borderRadius: '12px',
      border: `1px solid ${colors.border}`,
    }}>
      {pendingInvite && pendingInvite.assigned_by ? (
        <>
          <p style={{ color: colors.text, fontSize: '1rem', marginBottom: '0.5rem' }}>🎉 {t('recruiter.coEditorInvitation', 'Co-Editor Invitation')}</p>
          <p style={{ color: colors.textMuted, fontSize: '0.85rem', marginBottom: '1rem' }}>
            {t('recruiter.invitedCoEditor', "You've been invited to be a co-editor for Kingdom {{kingdom}}'s recruiter dashboard.", { kingdom: pendingInvite.kingdom_number })}
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
            <button
              onClick={onAcceptInvite}
              style={{
                padding: '0.5rem 1.25rem', backgroundColor: '#22c55e15', border: '1px solid #22c55e40',
                borderRadius: '8px', color: '#22c55e', fontSize: '0.85rem', fontWeight: '600', cursor: 'pointer', minHeight: '44px',
              }}
            >
              {t('recruiter.accept', 'Accept')}
            </button>
            <button
              onClick={onDeclineInvite}
              style={{
                padding: '0.5rem 1.25rem', backgroundColor: '#ef444415', border: '1px solid #ef444440',
                borderRadius: '8px', color: '#ef4444', fontSize: '0.85rem', fontWeight: '600', cursor: 'pointer', minHeight: '44px',
              }}
            >
              {t('recruiter.decline', 'Decline')}
            </button>
          </div>
        </>
      ) : pendingInvite ? (
        <>
          <p style={{ color: colors.text, fontSize: '1rem', marginBottom: '0.5rem' }}>📨 {t('recruiter.coEditorRequestPending', 'Co-Editor Request Pending')}</p>
          <p style={{ color: colors.textMuted, fontSize: '0.85rem' }}>
            {t('recruiter.requestAwaitingApproval', 'Your request to co-edit Kingdom {{kingdom}} is pending editor approval. You\'ll be notified when it\'s reviewed.', { kingdom: pendingInvite.kingdom_number })}
          </p>
        </>
      ) : (
        <>
          <p style={{ color: colors.text, fontSize: '1rem', marginBottom: '0.5rem' }}>{t('recruiter.noActiveRole', 'No Active Editor Role')}</p>
          <p style={{ color: colors.textMuted, fontSize: '0.85rem' }}>
            {t('recruiter.needEditorRole', 'You need to be an active editor for a kingdom to access the Recruiter Dashboard. Claim your kingdom first through the Editor Claiming process.')}
          </p>
        </>
      )}
    </div>
  );
};

export default NoEditorState;
