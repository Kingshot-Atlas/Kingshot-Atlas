import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { colors } from '../../utils/styles';
import type { Conversation, ChatMessage } from './types';
import ChatBubble from './ChatBubble';

interface ChatPanelProps {
  activeConversation: Conversation | undefined;
  messages: ChatMessage[];
  loadingMessages: boolean;
  isMobile: boolean;
  currentUserId: string;
  senderNames: Record<string, string>;
  otherReadAt: string | null;
  browserLang: string;
  otherTyping: boolean;
  msgText: string;
  setMsgText: (text: string) => void;
  sendingMsg: boolean;
  sendMessage: () => void;
  broadcastTyping: () => void;
  setActiveConvo: (id: string | null) => void;
  msgEndRef: React.RefObject<HTMLDivElement | null>;
  inputRef: React.RefObject<HTMLInputElement | null>;
}

const ChatPanel: React.FC<ChatPanelProps> = ({
  activeConversation,
  messages,
  loadingMessages,
  isMobile,
  currentUserId,
  senderNames,
  otherReadAt,
  browserLang,
  otherTyping,
  msgText,
  setMsgText,
  sendingMsg,
  sendMessage,
  broadcastTyping,
  setActiveConvo,
  msgEndRef,
  inputRef,
}) => {
  const { t } = useTranslation();

  if (!activeConversation) {
    if (isMobile) return null;
    return (
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', color: colors.textMuted,
      }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>💬</div>
        <p style={{ fontSize: '0.85rem' }}>{t('messages.selectConvo', 'Select a conversation to start chatting')}</p>
      </div>
    );
  }

  return (
    <>
      {/* Chat Header */}
      <div style={{
        padding: isMobile ? '0.75rem 1rem' : '0.65rem 0.85rem',
        borderBottom: `1px solid ${colors.border}`,
        display: 'flex', alignItems: 'center', gap: '0.5rem',
        backgroundColor: '#0d0d0d',
      }}>
        {isMobile && (
          <button onClick={() => setActiveConvo(null)} style={{
            background: 'none', border: 'none', color: '#22d3ee',
            fontSize: '1.1rem', cursor: 'pointer', padding: '0.2rem',
            display: 'flex', alignItems: 'center',
          }}>
            ←
          </button>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ fontWeight: '600', color: '#fff', fontSize: '0.85rem' }}>
              {activeConversation.other_party_name}
            </span>
            <Link to={`/kingdom/${activeConversation.role === 'recruiter' && activeConversation.candidate_kingdom ? activeConversation.candidate_kingdom : activeConversation.kingdom_number}`} style={{
              fontSize: '0.65rem', color: '#22d3ee', textDecoration: 'none',
            }}>
              K{activeConversation.role === 'recruiter' && activeConversation.candidate_kingdom ? activeConversation.candidate_kingdom : activeConversation.kingdom_number}
            </Link>
          </div>
          <span style={{ fontSize: '0.6rem', color: colors.textMuted }}>
            {activeConversation.is_pre_app
              ? t('messages.preAppStatus', 'Pre-application message')
              : `${activeConversation.status.charAt(0).toUpperCase() + activeConversation.status.slice(1)} · ${activeConversation.role === 'recruiter' ? t('messages.youAreRecruiter', 'You are recruiting') : t('messages.youAreTransferee', 'You applied')}`
            }
          </span>
        </div>
        {!activeConversation.is_pre_app && (
          <Link
            to={activeConversation.role === 'recruiter'
              ? `/transfer-hub?view=recruiter&app=${activeConversation.application_id}`
              : `/transfer-hub?view=my-apps`}
            style={{
              padding: '0.25rem 0.5rem', backgroundColor: '#ffffff08',
              border: '1px solid #ffffff15', borderRadius: '4px',
              color: colors.textMuted, fontSize: '0.6rem', textDecoration: 'none',
            }}
          >
            {t('messages.viewApp', 'View App')}
          </Link>
        )}
      </div>

      {/* Messages Area */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '0.75rem',
        display: 'flex', flexDirection: 'column', gap: '0.3rem',
      }}>
        {loadingMessages ? (
          <div style={{ textAlign: 'center', color: colors.textMuted, fontSize: '0.75rem', padding: '2rem 0' }}>
            {t('messages.loadingMessages', 'Loading messages...')}
          </div>
        ) : messages.length === 0 ? (
          <div style={{ textAlign: 'center', color: colors.textMuted, fontSize: '0.75rem', padding: '2rem 0' }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>💬</div>
            {t('messages.emptyChat', 'No messages yet. Say hello!')}
          </div>
        ) : (
          messages.map(msg => (
            <ChatBubble
              key={msg.id}
              msg={msg}
              isMe={msg.sender_user_id === currentUserId}
              isMobile={isMobile}
              senderName={msg.sender_user_id !== currentUserId ? senderNames[msg.sender_user_id] : undefined}
              otherReadAt={otherReadAt}
              browserLang={browserLang}
            />
          ))
        )}
        {otherTyping && (
          <div style={{
            display: 'flex', justifyContent: 'flex-start',
            padding: '0.15rem 0',
          }}>
            <div style={{
              padding: '0.3rem 0.6rem',
              backgroundColor: '#ffffff08',
              border: '1px solid #ffffff15',
              borderRadius: '12px 12px 12px 2px',
              display: 'flex', alignItems: 'center', gap: '0.25rem',
            }}>
              <span style={{ fontSize: '0.7rem', color: colors.textMuted, fontStyle: 'italic' }}>
                {t('messages.typing', 'typing')}
              </span>
              <span style={{
                display: 'inline-flex', gap: '2px', alignItems: 'center',
              }}>
                {[0, 1, 2].map(i => (
                  <span key={i} style={{
                    width: '4px', height: '4px', borderRadius: '50%',
                    backgroundColor: '#6b7280',
                    animation: `typingDot 1.2s ${i * 0.2}s infinite`,
                  }} />
                ))}
              </span>
            </div>
          </div>
        )}
        <div ref={msgEndRef} />
      </div>

      {/* Send Box */}
      <div style={{
        padding: isMobile ? '0.6rem 0.75rem' : '0.5rem 0.75rem',
        borderTop: `1px solid ${colors.border}`,
        backgroundColor: '#0d0d0d',
        display: 'flex', gap: '0.4rem', alignItems: 'center',
      }}>
        <input
          ref={inputRef}
          type="text"
          value={msgText}
          onChange={(e) => { setMsgText(e.target.value.slice(0, 500)); broadcastTyping(); }}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
          placeholder={t('messages.typePlaceholder', 'Type a message...')}
          style={{
            flex: 1, padding: isMobile ? '0.6rem 0.75rem' : '0.4rem 0.6rem',
            backgroundColor: '#111', border: `1px solid ${colors.border}`,
            borderRadius: '8px', color: colors.text,
            fontSize: isMobile ? '1rem' : '0.8rem',
            outline: 'none', minHeight: isMobile ? '44px' : '36px',
          }}
        />
        <button
          onClick={sendMessage}
          disabled={sendingMsg || !msgText.trim()}
          style={{
            padding: isMobile ? '0.6rem 1rem' : '0.4rem 0.75rem',
            backgroundColor: sendingMsg || !msgText.trim() ? '#3b82f620' : '#3b82f6',
            border: 'none', borderRadius: '8px',
            color: sendingMsg || !msgText.trim() ? '#3b82f680' : '#fff',
            fontSize: isMobile ? '0.9rem' : '0.78rem',
            fontWeight: '600', cursor: sendingMsg || !msgText.trim() ? 'not-allowed' : 'pointer',
            minHeight: isMobile ? '44px' : '36px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {sendingMsg ? '...' : t('messages.send', 'Send')}
        </button>
      </div>
    </>
  );
};

export default ChatPanel;
