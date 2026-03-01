import React from 'react';
import { useTranslation } from 'react-i18next';
import { colors } from '../../utils/styles';
import type { Conversation } from './types';

interface ConversationListItemProps {
  convo: Conversation;
  isActive: boolean;
  isMobile: boolean;
  currentUserId: string;
  formatTime: (dateStr: string) => string;
  onClick: () => void;
}

const ConversationListItem: React.FC<ConversationListItemProps> = ({
  convo, isActive, isMobile, currentUserId, formatTime, onClick,
}) => {
  const { t } = useTranslation();
  const isUnread = convo.unread_count > 0;
  const isMine = convo.last_sender_id === currentUserId;

  return (
    <div
      onClick={onClick}
      style={{
        padding: isMobile ? '0.85rem 1rem' : '0.75rem 0.85rem',
        cursor: 'pointer',
        backgroundColor: isActive ? '#22d3ee08' : 'transparent',
        borderBottom: `1px solid ${colors.border}`,
        borderLeft: isActive ? '3px solid #22d3ee' : '3px solid transparent',
        transition: 'background-color 0.15s',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{
              fontWeight: isUnread ? '700' : '500',
              color: isUnread ? '#fff' : colors.text,
              fontSize: '0.82rem',
            }}>
              {convo.other_party_name}
            </span>
            {convo.is_pre_app && (
              <span style={{
                padding: '0.05rem 0.3rem',
                backgroundColor: '#3b82f610',
                border: '1px solid #3b82f620',
                borderRadius: '3px',
                fontSize: '0.5rem',
                color: '#3b82f6',
                fontWeight: '600',
                textTransform: 'uppercase',
              }}>
                {t('messages.preApp', 'Pre-App')}
              </span>
            )}
            <span style={{
              padding: '0.05rem 0.3rem',
              backgroundColor: convo.role === 'recruiter' ? '#a855f710' : '#22d3ee10',
              border: `1px solid ${convo.role === 'recruiter' ? '#a855f720' : '#22d3ee20'}`,
              borderRadius: '3px',
              fontSize: '0.5rem',
              color: convo.role === 'recruiter' ? '#a855f7' : '#22d3ee',
              fontWeight: '600',
              textTransform: 'uppercase',
            }}>
              {convo.role === 'recruiter' ? t('messages.candidate', 'Candidate') : t('messages.recruiterTag', 'Recruiter')}
            </span>
          </div>
          {convo.last_message && (
            <p style={{
              margin: '0.15rem 0 0',
              fontSize: '0.72rem',
              color: isUnread ? '#d1d5db' : colors.textMuted,
              fontWeight: isUnread ? '500' : '400',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {isMine ? `${t('messages.you', 'You')}: ` : ''}{convo.last_message}
            </p>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.2rem', flexShrink: 0 }}>
          <span style={{ fontSize: '0.6rem', color: isUnread ? '#22d3ee' : colors.textMuted }}>
            {formatTime(convo.last_message_at)}
          </span>
          {isUnread && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              minWidth: '18px', height: '18px', padding: '0 5px',
              backgroundColor: '#ef4444', borderRadius: '9px',
              fontSize: '0.55rem', fontWeight: '700', color: '#fff',
            }}>{convo.unread_count}</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConversationListItem;
