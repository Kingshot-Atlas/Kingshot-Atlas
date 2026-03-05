import React from 'react';
import { useTranslation } from 'react-i18next';
import { colors } from '../../utils/styles';
import type { Conversation } from './types';
import ConversationListItem from './ConversationListItem';

interface ConversationListPanelProps {
  conversations: Conversation[];
  activeConvo: string | null;
  isMobile: boolean;
  currentUserId: string;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  formatTime: (iso: string) => string;
  setActiveConvo: (id: string | null) => void;
}

const ConversationListPanel: React.FC<ConversationListPanelProps> = ({
  conversations,
  activeConvo,
  isMobile,
  currentUserId,
  searchQuery,
  setSearchQuery,
  formatTime,
  setActiveConvo,
}) => {
  const { t } = useTranslation();

  return (
    <div style={{
      width: isMobile ? '100%' : '320px',
      borderRight: isMobile ? 'none' : `1px solid ${colors.border}`,
      overflowY: 'auto',
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Search bar */}
      <div style={{
        padding: '0.5rem',
        borderBottom: `1px solid ${colors.border}`,
        position: 'sticky',
        top: 0,
        backgroundColor: '#0a0a0a',
        zIndex: 1,
      }}>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t('messages.searchPlaceholder', 'Search conversations...')}
          style={{
            width: '100%',
            padding: '0.4rem 0.6rem',
            backgroundColor: '#111',
            border: `1px solid ${colors.border}`,
            borderRadius: '6px',
            color: colors.text,
            fontSize: '0.75rem',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
      {conversations.length === 0 && searchQuery.trim() ? (
        <div style={{ padding: '1.5rem', textAlign: 'center', color: colors.textMuted, fontSize: '0.75rem' }}>
          {t('messages.noSearchResults', 'No conversations found.')}
        </div>
      ) : conversations.map(convo => (
        <ConversationListItem
          key={convo.application_id}
          convo={convo}
          isActive={activeConvo === convo.application_id}
          isMobile={isMobile}
          currentUserId={currentUserId}
          formatTime={formatTime}
          onClick={() => setActiveConvo(convo.application_id)}
        />
      ))}
      </div>
    </div>
  );
};

export default ConversationListPanel;
