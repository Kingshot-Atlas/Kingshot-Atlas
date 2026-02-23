import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { colors } from '../../utils/styles';

interface TransferApplication {
  id: string;
  kingdom_number: number;
  status: string;
  applied_at: string;
  expires_at: string;
  applicant_note: string | null;
}

interface AppMessage {
  id: string;
  sender_user_id: string;
  message: string;
  created_at: string;
}

interface StatusColor {
  bg: string;
  border: string;
  text: string;
  label: string;
}

interface TransfereeAppCardProps {
  app: TransferApplication;
  statusColor: StatusColor;
  outcomeSubmitted: boolean;
  onSubmitOutcome: (applicationId: string, didTransfer: boolean, satisfaction?: number, feedback?: string) => Promise<void>;
  onWithdraw: (applicationId: string) => Promise<void>;
  withdrawingId: string | null;
  onRate: (id: string, kingdom: number) => void;
  unreadCount?: number;
  lastMessagePreview?: string;
  lastMessageAt?: string;
}

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const getDaysLeft = (expiresAt: string) => {
  const diff = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
};

const TransfereeAppCard: React.FC<TransfereeAppCardProps> = ({
  app, statusColor: sc, outcomeSubmitted, onSubmitOutcome, onWithdraw, withdrawingId, onRate, unreadCount = 0, lastMessagePreview, lastMessageAt,
}) => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const daysLeft = getDaysLeft(app.expires_at);

  // Messaging state
  const [openMessages, setOpenMessages] = useState(false);
  const [messages, setMessages] = useState<AppMessage[]>([]);
  const [newMsg, setNewMsg] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);
  const msgEndRef = useRef<HTMLDivElement>(null);
  const [senderNames, setSenderNames] = useState<Record<string, string>>({});

  // Outcome prompt state
  const [showOutcomePrompt, setShowOutcomePrompt] = useState(false);
  const [outcomeSubmitting, setOutcomeSubmitting] = useState(false);

  // Withdraw confirm state
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);

  // Load messages + real-time subscription when message panel is open
  useEffect(() => {
    if (!openMessages || !supabase || !user) return;
    const sb = supabase;
    const loadMsgs = async () => {
      const { data } = await sb
        .from('application_messages')
        .select('id, sender_user_id, message, created_at')
        .eq('application_id', app.id)
        .order('created_at', { ascending: true });
      if (data) {
        setMessages(data);
        // Fetch sender usernames for messages not from me (recruiter names)
        const otherIds = [...new Set(data.filter((m: AppMessage) => m.sender_user_id !== user?.id).map((m: AppMessage) => m.sender_user_id))];
        if (otherIds.length > 0) {
          const { data: profiles } = await sb.from('profiles').select('id, username, linked_username').in('id', otherIds);
          if (profiles) {
            const map: Record<string, string> = {};
            profiles.forEach((p: { id: string; username: string; linked_username?: string }) => {
              map[p.id] = p.linked_username || p.username || 'Unknown';
            });
            setSenderNames(prev => ({ ...prev, ...map }));
          }
        }
      }
      // Mark as read
      sb.from('message_read_status')
        .upsert({ application_id: app.id, user_id: user.id, last_read_at: new Date().toISOString() }, { onConflict: 'application_id,user_id' })
        .then(() => {});
    };
    loadMsgs();
    const channel = sb
      .channel(`transferee-card-msgs-${app.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'application_messages',
        filter: `application_id=eq.${app.id}`,
      }, (payload) => {
        const row = payload.new as AppMessage;
        setMessages(prev => prev.some(m => m.id === row.id) ? prev : [...prev, row]);
        if (row.sender_user_id !== user?.id) {
          try { new Audio('/sounds/message.wav').play().catch(() => {}); } catch {}
        }
      })
      .subscribe();
    return () => { sb.removeChannel(channel); };
  }, [openMessages, app.id, user]);

  // Auto-scroll messages
  useEffect(() => {
    if (messages.length > 0) msgEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const lastSentRef = useRef(0);
  const handleSendMsg = async () => {
    if (!supabase || !user || !newMsg.trim()) return;
    const now = Date.now();
    if (now - lastSentRef.current < 2000) return;
    lastSentRef.current = now;
    setSendingMsg(true);
    try {
      await supabase.from('application_messages').insert({
        application_id: app.id,
        sender_user_id: user.id,
        message: newMsg.trim(),
      });
      setNewMsg('');
    } finally {
      setSendingMsg(false);
    }
  };

  const handleOutcome = async (didTransfer: boolean) => {
    setOutcomeSubmitting(true);
    try {
      await onSubmitOutcome(app.id, didTransfer, didTransfer ? 4 : undefined);
      setShowOutcomePrompt(false);
    } finally {
      setOutcomeSubmitting(false);
    }
  };

  const toggleMessages = () => {
    setOpenMessages(prev => !prev);
    if (openMessages) {
      setMessages([]);
      setNewMsg('');
    }
  };

  return (
    <div style={{
      padding: '0.6rem 0.75rem',
      backgroundColor: colors.bg,
      borderRadius: '8px',
      border: `1px solid ${sc.border}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <Link to={`/kingdom/${app.kingdom_number}`} style={{ color: colors.text, textDecoration: 'none', fontWeight: '600', fontSize: '0.85rem' }}>
          Kingdom {app.kingdom_number}
        </Link>
        <span style={{ padding: '0.1rem 0.4rem', backgroundColor: sc.bg, border: `1px solid ${sc.border}`, borderRadius: '4px', fontSize: '0.6rem', color: sc.text, fontWeight: 'bold', textTransform: 'uppercase' }}>
          {sc.label}
        </span>
        <span style={{ color: '#4b5563', fontSize: '0.65rem' }}>{formatDate(app.applied_at)}</span>
        {daysLeft <= 3 && daysLeft > 0 && (
          <span style={{ color: '#f59e0b', fontSize: '0.6rem' }}>{t('transfereeDash.daysLeft', '{{days}}d left', { days: daysLeft })}</span>
        )}

        {/* Accepted app actions */}
        {app.status === 'accepted' && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
            <button
              onClick={() => onRate(app.id, app.kingdom_number)}
              style={{ padding: '0.2rem 0.5rem', backgroundColor: '#fbbf2415', border: '1px solid #fbbf2430', borderRadius: '6px', color: '#fbbf24', fontSize: '0.65rem', fontWeight: '600', cursor: 'pointer' }}
            >
              ⭐ {t('transfereeDash.rate', 'Rate')}
            </button>
            {!outcomeSubmitted ? (
              showOutcomePrompt ? (
                <div style={{ display: 'flex', gap: '0.2rem', alignItems: 'center' }}>
                  <button onClick={() => handleOutcome(true)} disabled={outcomeSubmitting}
                    style={{ padding: '0.2rem 0.4rem', backgroundColor: '#22c55e15', border: '1px solid #22c55e30', borderRadius: '4px', color: '#22c55e', fontSize: '0.6rem', fontWeight: '600', cursor: 'pointer' }}>
                    ✅ {t('transfereeDash.yes', 'Yes')}
                  </button>
                  <button onClick={() => handleOutcome(false)} disabled={outcomeSubmitting}
                    style={{ padding: '0.2rem 0.4rem', backgroundColor: '#ef444415', border: '1px solid #ef444430', borderRadius: '4px', color: '#ef4444', fontSize: '0.6rem', fontWeight: '600', cursor: 'pointer' }}>
                    ❌ {t('transfereeDash.no', 'No')}
                  </button>
                  <button onClick={() => setShowOutcomePrompt(false)}
                    style={{ padding: '0.2rem 0.3rem', backgroundColor: 'transparent', border: 'none', color: colors.textMuted, fontSize: '0.6rem', cursor: 'pointer' }}>
                    ✕
                  </button>
                </div>
              ) : (
                <button onClick={() => setShowOutcomePrompt(true)}
                  style={{ padding: '0.2rem 0.5rem', backgroundColor: '#a855f710', border: '1px solid #a855f725', borderRadius: '6px', color: '#a855f7', fontSize: '0.6rem', cursor: 'pointer' }}>
                  📋 {t('transfereeDash.didYouTransfer', 'Did you transfer?')}
                </button>
              )
            ) : (
              <span style={{ padding: '0.1rem 0.4rem', backgroundColor: '#22c55e10', border: '1px solid #22c55e20', borderRadius: '4px', fontSize: '0.55rem', color: '#22c55e' }}>
                ✓ {t('transfereeDash.outcomeSubmitted', 'Outcome submitted')}
              </span>
            )}
          </div>
        )}

        {/* Non-accepted app actions */}
        {app.status !== 'accepted' && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
            <button onClick={toggleMessages}
              style={{ padding: '0.25rem 0.5rem', backgroundColor: '#22d3ee10', border: '1px solid #22d3ee25', borderRadius: '6px', color: '#22d3ee', fontSize: '0.65rem', cursor: 'pointer', fontWeight: '500', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
              💬 {t('transfereeDash.messages', 'Messages')}
              {!openMessages && unreadCount > 0 && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  minWidth: '16px', height: '16px', padding: '0 4px',
                  backgroundColor: '#ef4444', borderRadius: '8px',
                  fontSize: '0.5rem', fontWeight: '700', color: '#fff',
                }}>{unreadCount}</span>
              )}
            </button>
            {confirmWithdraw ? (
              <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                <span style={{ color: '#ef4444', fontSize: '0.6rem' }}>{t('transfereeDash.sure', 'Sure?')}</span>
                <button onClick={() => { setConfirmWithdraw(false); onWithdraw(app.id); }} disabled={withdrawingId === app.id}
                  style={{ padding: '0.2rem 0.4rem', backgroundColor: '#ef444415', border: '1px solid #ef444430', borderRadius: '4px', color: '#ef4444', fontSize: '0.6rem', cursor: 'pointer', fontWeight: '600' }}>
                  {withdrawingId === app.id ? '...' : t('transfereeDash.yes', 'Yes')}
                </button>
                <button onClick={() => setConfirmWithdraw(false)}
                  style={{ padding: '0.2rem 0.4rem', backgroundColor: 'transparent', border: `1px solid ${colors.border}`, borderRadius: '4px', color: colors.textSecondary, fontSize: '0.6rem', cursor: 'pointer' }}>
                  {t('transfereeDash.no', 'No')}
                </button>
              </div>
            ) : (
              <button onClick={() => setConfirmWithdraw(true)}
                style={{ padding: '0.25rem 0.5rem', backgroundColor: 'transparent', border: '1px solid #ef444425', borderRadius: '6px', color: '#ef4444', fontSize: '0.65rem', cursor: 'pointer' }}>
                {t('transfereeDash.withdraw', 'Withdraw')}
              </button>
            )}
          </div>
        )}

        {/* Accepted app message button */}
        {app.status === 'accepted' && (
          <button onClick={toggleMessages}
            style={{ padding: '0.25rem 0.5rem', backgroundColor: '#22d3ee10', border: '1px solid #22d3ee25', borderRadius: '6px', color: '#22d3ee', fontSize: '0.65rem', cursor: 'pointer', fontWeight: '500', marginLeft: '0.25rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
            💬 {t('transfereeDash.messages', 'Messages')}
            {!openMessages && unreadCount > 0 && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                minWidth: '16px', height: '16px', padding: '0 4px',
                backgroundColor: '#ef4444', borderRadius: '8px',
                fontSize: '0.5rem', fontWeight: '700', color: '#fff',
              }}>{unreadCount}</span>
            )}
          </button>
        )}
      </div>
      {/* Last message preview (collapsed) */}
      {!openMessages && lastMessagePreview && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.35rem',
          marginTop: '0.3rem', paddingTop: '0.3rem',
          borderTop: `1px solid ${colors.border}`,
        }}>
          <span style={{ color: '#22d3ee', fontSize: '0.6rem', flexShrink: 0 }}>💬</span>
          <span style={{
            color: unreadCount > 0 ? '#d1d5db' : colors.textMuted,
            fontSize: '0.68rem',
            fontWeight: unreadCount > 0 ? '500' : '400',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            flex: 1, minWidth: 0,
          }}>
            {lastMessagePreview.length > 60 ? lastMessagePreview.slice(0, 60) + '…' : lastMessagePreview}
          </span>
          {lastMessageAt && (
            <span style={{ color: colors.textMuted, fontSize: '0.55rem', flexShrink: 0 }}>
              {new Date(lastMessageAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
      )}

      {/* Message Thread Panel */}
      {openMessages && (
        <div style={{ marginTop: '0.5rem', borderTop: `1px solid ${colors.border}`, paddingTop: '0.5rem' }}>
          <div style={{
            maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.3rem',
            marginBottom: '0.4rem', padding: '0.25rem',
          }}>
            {messages.length === 0 && (
              <div style={{ textAlign: 'center', color: colors.textMuted, fontSize: '0.65rem', padding: '0.5rem' }}>
                {t('transfereeDash.noMessages', 'No messages yet. Start the conversation!')}
              </div>
            )}
            {messages.map(msg => {
              const isMe = msg.sender_user_id === user?.id;
              const senderName = !isMe ? senderNames[msg.sender_user_id] : undefined;
              return (
                <div key={msg.id} style={{
                  alignSelf: isMe ? 'flex-end' : 'flex-start',
                  maxWidth: '80%',
                  padding: '0.3rem 0.5rem',
                  backgroundColor: isMe ? '#22d3ee15' : colors.bg,
                  border: `1px solid ${isMe ? '#22d3ee25' : colors.border}`,
                  borderRadius: '8px',
                  fontSize: '0.7rem',
                  color: colors.text,
                }}>
                  {senderName && (
                    <div style={{ color: '#a78bfa', fontSize: '0.58rem', fontWeight: 600, marginBottom: '0.1rem' }}>
                      {senderName}
                    </div>
                  )}
                  <div>{msg.message}</div>
                  <div style={{ fontSize: '0.5rem', color: colors.textMuted, marginTop: '0.1rem', textAlign: isMe ? 'right' : 'left' }}>
                    {new Date(msg.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              );
            })}
            <div ref={msgEndRef} />
          </div>
          <div style={{ display: 'flex', gap: '0.3rem' }}>
            <input
              value={newMsg}
              onChange={e => setNewMsg(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMsg(); } }}
              placeholder={t('transfereeDash.typeMessage', 'Type a message...')}
              maxLength={500}
              style={{
                flex: 1, padding: '0.35rem 0.5rem', backgroundColor: colors.bg,
                border: `1px solid ${colors.border}`, borderRadius: '6px',
                color: colors.text, fontSize: '0.7rem', outline: 'none',
              }}
            />
            <button
              onClick={handleSendMsg}
              disabled={sendingMsg || !newMsg.trim()}
              style={{
                padding: '0.35rem 0.6rem', backgroundColor: '#22d3ee',
                border: 'none', borderRadius: '6px', color: '#000',
                fontSize: '0.65rem', fontWeight: '700', cursor: sendingMsg ? 'wait' : 'pointer',
                opacity: sendingMsg || !newMsg.trim() ? 0.5 : 1,
              }}
            >
              {sendingMsg ? '...' : t('transfereeDash.send', 'Send')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TransfereeAppCard;
