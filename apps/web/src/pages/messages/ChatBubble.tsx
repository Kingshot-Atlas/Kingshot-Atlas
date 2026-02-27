import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { translateMessage } from '../../utils/translateMessage';
import type { ChatMessage } from './types';

interface ChatBubbleProps {
  msg: ChatMessage;
  isMe: boolean;
  isMobile: boolean;
  senderName?: string;
  otherReadAt: string | null;
  browserLang: string;
}

const ChatBubble: React.FC<ChatBubbleProps> = ({
  msg, isMe, isMobile, senderName, otherReadAt, browserLang,
}) => {
  const { t } = useTranslation();
  const [translated, setTranslated] = useState<string | null>(null);
  const [translating, setTranslating] = useState(false);

  const formatMessageTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = d.toDateString() === yesterday.toDateString();
    const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    if (isToday) return time;
    if (isYesterday) return `Yesterday ${time}`;
    return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${time}`;
  };

  const handleTranslate = async () => {
    if (translated) { setTranslated(null); return; }
    setTranslating(true);
    try {
      const result = await translateMessage(msg.message, browserLang);
      setTranslated(result);
    } catch { /* translation failed silently */ }
    setTranslating(false);
  };

  return (
    <div style={{
      display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start',
    }}>
      <div style={{
        maxWidth: isMobile ? '85%' : '75%',
        padding: '0.4rem 0.6rem',
        backgroundColor: isMe ? '#3b82f615' : '#ffffff08',
        border: `1px solid ${isMe ? '#3b82f630' : '#ffffff15'}`,
        borderRadius: isMe ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
      }}>
        {senderName && (
          <div style={{ color: '#a78bfa', fontSize: '0.6rem', fontWeight: 600, marginBottom: '0.1rem' }}>
            {senderName}
          </div>
        )}
        <p style={{
          color: '#d1d5db', fontSize: isMobile ? '0.85rem' : '0.78rem',
          margin: 0, lineHeight: 1.5, wordBreak: 'break-word',
        }}>
          {msg.message}
        </p>
        {translated && (
          <p style={{
            color: '#a78bfa', fontSize: isMobile ? '0.78rem' : '0.72rem',
            margin: '0.15rem 0 0', lineHeight: 1.4, wordBreak: 'break-word',
            fontStyle: 'italic', borderTop: '1px solid #ffffff10', paddingTop: '0.15rem',
          }}>
            {translated}
          </p>
        )}
        <div style={{
          display: 'flex', alignItems: 'center',
          justifyContent: isMe ? 'flex-end' : 'flex-start',
          gap: '0.3rem', marginTop: '0.1rem',
        }}>
          <span style={{ color: '#4b5563', fontSize: '0.5rem' }}>
            {formatMessageTime(msg.created_at)}
          </span>
          {isMe && (
            <span style={{ color: otherReadAt && new Date(otherReadAt) >= new Date(msg.created_at) ? '#3b82f6' : '#4b5563', fontSize: '0.5rem', fontWeight: 600 }}>
              {otherReadAt && new Date(otherReadAt) >= new Date(msg.created_at) ? '✓✓' : '✓'}
            </span>
          )}
          {!isMe && browserLang !== 'en' && (
            <button
              onClick={handleTranslate}
              disabled={translating}
              style={{
                background: 'none', border: 'none',
                color: translated ? '#a78bfa' : '#6b7280',
                fontSize: '0.5rem', cursor: 'pointer', padding: '0 0.15rem',
                fontWeight: 600, opacity: translating ? 0.5 : 1,
              }}
            >
              {translating ? '⏳' : translated ? t('messages.hideTranslation', 'Hide') : `🌐 ${t('messages.translate', 'Translate')}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatBubble;
