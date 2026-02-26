import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useIsMobile } from '../hooks/useMediaQuery';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { registerChannel, unregisterChannel } from '../lib/realtimeGuard';
import { colors, neonGlow, FONT_DISPLAY } from '../utils/styles';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { logger } from '../utils/logger';
import { translateMessage, getBrowserLanguage } from '../utils/translateMessage';

// ─── Types ────────────────────────────────────────────────────
interface Conversation {
  application_id: string;
  kingdom_number: number;
  status: string;
  other_party_name: string;
  other_party_id: string;
  role: 'recruiter' | 'transferee';
  last_message: string;
  last_message_at: string;
  last_sender_id: string;
  unread_count: number;
  applied_at: string;
}

interface ChatMessage {
  id: string;
  sender_user_id: string;
  message: string;
  created_at: string;
}

// ─── Rate Limiter ─────────────────────────────────────────────
const MSG_COOLDOWN_MS = 2000;
let lastSentAt = 0;

// ─── Component ────────────────────────────────────────────────
const Messages: React.FC = () => {
  useDocumentTitle('Messages');
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const openAppId = searchParams.get('app');

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeConvo, setActiveConvo] = useState<string | null>(openAppId);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [msgText, setMsgText] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);
  const [senderNames, setSenderNames] = useState<Record<string, string>>({});
  const [loadingMessages, setLoadingMessages] = useState(false);
  const msgEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [translatingId, setTranslatingId] = useState<string | null>(null);
  const browserLang = getBrowserLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [otherReadAt, setOtherReadAt] = useState<string | null>(null);
  const [otherTyping, setOtherTyping] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingBroadcast = useRef(0);

  // ─── Load conversations ─────────────────────────────────────
  const loadConversations = useCallback(async () => {
    if (!supabase || !user) return;
    setLoading(true);
    try {
      // Get all applications where user is applicant
      const { data: myApps } = await supabase
        .from('transfer_applications')
        .select('id, kingdom_number, status, applied_at, applicant_user_id')
        .eq('applicant_user_id', user.id)
        .in('status', ['pending', 'viewed', 'accepted']);

      // Get all applications where user is kingdom editor
      const { data: editorRows } = await supabase
        .from('kingdom_editors')
        .select('kingdom_number')
        .eq('user_id', user.id);

      const editorKingdoms = (editorRows || []).map(e => e.kingdom_number);
      let recruiterApps: typeof myApps = [];
      if (editorKingdoms.length > 0) {
        const { data } = await supabase
          .from('transfer_applications')
          .select('id, kingdom_number, status, applied_at, applicant_user_id')
          .in('kingdom_number', editorKingdoms)
          .in('status', ['pending', 'viewed', 'accepted']);
        recruiterApps = data || [];
      }

      const allApps = [
        ...(myApps || []).map(a => ({ ...a, role: 'transferee' as const })),
        ...(recruiterApps || []).filter(a => a.applicant_user_id !== user.id).map(a => ({ ...a, role: 'recruiter' as const })),
      ];

      if (allApps.length === 0) {
        setConversations([]);
        setLoading(false);
        return;
      }

      const appIds = allApps.map(a => a.id);

      // Get last message per application
      const { data: lastMsgs } = await supabase
        .from('application_messages')
        .select('application_id, sender_user_id, message, created_at')
        .in('application_id', appIds)
        .order('created_at', { ascending: false });

      // Group by application - keep latest per app
      const lastMsgMap = new Map<string, { sender_user_id: string; message: string; created_at: string }>();
      (lastMsgs || []).forEach(m => {
        if (!lastMsgMap.has(m.application_id)) {
          lastMsgMap.set(m.application_id, m);
        }
      });

      // Get read statuses
      const { data: readRows } = await supabase
        .from('message_read_status')
        .select('application_id, last_read_at')
        .eq('user_id', user.id)
        .in('application_id', appIds);
      const readMap = new Map((readRows || []).map(r => [r.application_id, r.last_read_at]));

      // Count unread per app
      const unreadCounts: Record<string, number> = {};
      for (const appId of appIds) {
        const lastRead = readMap.get(appId);
        let q = supabase
          .from('application_messages')
          .select('id', { count: 'exact', head: true })
          .eq('application_id', appId)
          .neq('sender_user_id', user.id);
        if (lastRead) q = q.gt('created_at', lastRead);
        const { count } = await q;
        unreadCounts[appId] = count || 0;
      }

      // Get other party names
      const otherIds = new Set<string>();
      allApps.forEach(a => {
        if (a.role === 'recruiter') otherIds.add(a.applicant_user_id);
      });
      // For transferee apps, we need kingdom editor names
      const { data: profileRows } = await supabase
        .from('profiles')
        .select('id, username, linked_username')
        .in('id', [...otherIds]);
      const nameMap: Record<string, string> = {};
      (profileRows || []).forEach(p => { nameMap[p.id] = p.linked_username || p.username || 'Unknown'; });

      // Build conversations
      const convos: Conversation[] = allApps.map(app => {
        const lastMsg = lastMsgMap.get(app.id);
        return {
          application_id: app.id,
          kingdom_number: app.kingdom_number,
          status: app.status,
          other_party_name: app.role === 'recruiter'
            ? (nameMap[app.applicant_user_id] || t('messages.applicant', 'Applicant'))
            : `K${app.kingdom_number}`,
          other_party_id: app.applicant_user_id,
          role: app.role,
          last_message: lastMsg?.message || '',
          last_message_at: lastMsg?.created_at || app.applied_at,
          last_sender_id: lastMsg?.sender_user_id || '',
          unread_count: unreadCounts[app.id] || 0,
          applied_at: app.applied_at,
        };
      });

      // Sort by last message time (newest first), with unread on top
      convos.sort((a, b) => {
        if (a.unread_count > 0 && b.unread_count === 0) return -1;
        if (a.unread_count === 0 && b.unread_count > 0) return 1;
        return new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime();
      });

      setConversations(convos);
    } catch (err) {
      logger.error('Messages: failed to load conversations', err);
    } finally {
      setLoading(false);
    }
  }, [user, t]);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  // ─── Fetch other party's read status for active conversation ─
  useEffect(() => {
    if (!activeConvo || !supabase || !user) { setOtherReadAt(null); return; }
    const sb = supabase;
    let cancelled = false;
    const fetchReadStatus = async () => {
      const convo = conversations.find(c => c.application_id === activeConvo);
      if (!convo) return;
      const { data } = await sb
        .from('message_read_status')
        .select('last_read_at')
        .eq('application_id', activeConvo)
        .neq('user_id', user.id)
        .maybeSingle();
      if (!cancelled && data) setOtherReadAt(data.last_read_at);
    };
    fetchReadStatus();
    // Subscribe to read status changes from other party
    const rsName = `read-status-${activeConvo}`;
    if (!registerChannel(rsName)) return;
    const channel = sb
      .channel(rsName)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'message_read_status',
        filter: `application_id=eq.${activeConvo}`,
      }, (payload) => {
        const row = payload.new as { user_id: string; last_read_at: string };
        if (row.user_id !== user.id) setOtherReadAt(row.last_read_at);
      })
      .subscribe();
    return () => { cancelled = true; sb.removeChannel(channel); unregisterChannel(rsName); };
  }, [activeConvo, user, conversations]);

  // ─── Typing indicator via Supabase broadcast ───────────────
  useEffect(() => {
    if (!activeConvo || !supabase || !user) { setOtherTyping(false); return; }
    const sb = supabase;
    const typChName = `typing-${activeConvo}`;
    if (!registerChannel(typChName)) return;
    const channel = sb.channel(typChName, { config: { broadcast: { self: false } } });
    channel.on('broadcast', { event: 'typing' }, (payload) => {
      if (payload.payload?.user_id !== user.id) {
        setOtherTyping(true);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => setOtherTyping(false), 3000);
      }
    }).subscribe();
    return () => {
      sb.removeChannel(channel);
      unregisterChannel(typChName);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      setOtherTyping(false);
    };
  }, [activeConvo, user]);

  const broadcastTyping = useCallback(() => {
    if (!activeConvo || !supabase || !user) return;
    const now = Date.now();
    if (now - lastTypingBroadcast.current < 2000) return;
    lastTypingBroadcast.current = now;
    supabase.channel(`typing-${activeConvo}`).send({
      type: 'broadcast', event: 'typing', payload: { user_id: user.id },
    });
  }, [activeConvo, user]);

  // ─── Load messages for active conversation ──────────────────
  useEffect(() => {
    if (!activeConvo || !supabase || !user) { setMessages([]); return; }
    const sb = supabase;
    let cancelled = false;
    setLoadingMessages(true);
    const load = async () => {
      const { data } = await sb
        .from('application_messages')
        .select('id, sender_user_id, message, created_at')
        .eq('application_id', activeConvo)
        .order('created_at', { ascending: true });
      if (cancelled) return;
      if (data) {
        setMessages(data);
        // Fetch sender names
        const otherIds = [...new Set(data.filter(m => m.sender_user_id !== user.id).map(m => m.sender_user_id))];
        if (otherIds.length > 0) {
          const { data: profiles } = await sb.from('profiles').select('id, username, linked_username').in('id', otherIds);
          if (profiles && !cancelled) {
            const map: Record<string, string> = {};
            profiles.forEach((p: { id: string; username: string; linked_username?: string }) => {
              map[p.id] = p.linked_username || p.username || 'Unknown';
            });
            setSenderNames(prev => ({ ...prev, ...map }));
          }
        }
      }
      // Mark as read
      await sb.from('message_read_status')
        .upsert({ application_id: activeConvo, user_id: user.id, last_read_at: new Date().toISOString() }, { onConflict: 'application_id,user_id' });
      // Update local unread count
      setConversations(prev => prev.map(c =>
        c.application_id === activeConvo ? { ...c, unread_count: 0 } : c
      ));
      // Signal header badge to refresh
      window.dispatchEvent(new Event('messages-read'));
      if (!cancelled) setLoadingMessages(false);
    };
    load();

    // Real-time subscription
    const msgChName = `msg-page-${activeConvo}`;
    if (!registerChannel(msgChName)) { if (!cancelled) setLoadingMessages(false); return; }
    const channel = sb
      .channel(msgChName)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'application_messages',
        filter: `application_id=eq.${activeConvo}`,
      }, (payload) => {
        const row = payload.new as ChatMessage;
        setMessages(prev => prev.some(m => m.id === row.id) ? prev : [...prev, row]);
        // Play sound for incoming messages
        if (row.sender_user_id !== user.id) {
          try { new Audio('/sounds/message.wav').play().catch(() => {}); } catch {}
        }
        // Mark as read immediately since we're viewing
        sb.from('message_read_status')
          .upsert({ application_id: activeConvo, user_id: user.id, last_read_at: new Date().toISOString() }, { onConflict: 'application_id,user_id' })
          .then(() => { window.dispatchEvent(new Event('messages-read')); });
      })
      .subscribe();

    return () => { cancelled = true; sb.removeChannel(channel); unregisterChannel(msgChName); };
  }, [activeConvo, user]);

  // Auto-scroll
  useEffect(() => {
    if (messages.length > 0) msgEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Focus input on convo open
  useEffect(() => {
    if (activeConvo) setTimeout(() => inputRef.current?.focus(), 100);
  }, [activeConvo]);

  // ─── Send message (with rate limiting) ──────────────────────
  const sendMessage = async () => {
    if (!supabase || !user || !msgText.trim() || sendingMsg || !activeConvo) return;
    const now = Date.now();
    if (now - lastSentAt < MSG_COOLDOWN_MS) return;
    lastSentAt = now;
    setSendingMsg(true);
    try {
      const { data, error } = await supabase
        .from('application_messages')
        .insert({ application_id: activeConvo, sender_user_id: user.id, message: msgText.trim() })
        .select('id, sender_user_id, message, created_at')
        .single();
      if (!error && data) {
        setMessages(prev => [...prev, data]);
        setMsgText('');
        // Update conversation last message
        setConversations(prev => prev.map(c =>
          c.application_id === activeConvo
            ? { ...c, last_message: data.message, last_message_at: data.created_at, last_sender_id: data.sender_user_id }
            : c
        ));
        // Mark as read when sending (we're clearly viewing the conversation)
        supabase.from('message_read_status')
          .upsert({ application_id: activeConvo, user_id: user.id, last_read_at: new Date().toISOString() }, { onConflict: 'application_id,user_id' })
          .then(() => { window.dispatchEvent(new Event('messages-read')); });
      }
    } catch (err) {
      logger.error('Messages: send failed', err);
    } finally {
      setSendingMsg(false);
    }
  };

  // ─── Mark all read ──────────────────────────────────────────
  const markAllRead = async () => {
    if (!supabase || !user) return;
    const sb = supabase;
    const unreadConvos = conversations.filter(c => c.unread_count > 0);
    if (unreadConvos.length === 0) return;
    for (const c of unreadConvos) {
      await sb.from('message_read_status')
        .upsert({ application_id: c.application_id, user_id: user.id, last_read_at: new Date().toISOString() }, { onConflict: 'application_id,user_id' });
    }
    setConversations(prev => prev.map(c => ({ ...c, unread_count: 0 })));
    window.dispatchEvent(new Event('messages-read'));
  };

  // ─── Subscribe to new messages across all conversations ─────
  useEffect(() => {
    if (!supabase || !user || conversations.length === 0) return;
    const sb = supabase;
    const appIds = conversations.map(c => c.application_id);
    const channels = appIds.map(appId => {
      const listChName = `msg-list-${appId}`;
      if (!registerChannel(listChName)) return null;
      return sb
        .channel(listChName)
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'application_messages',
          filter: `application_id=eq.${appId}`,
        }, (payload) => {
          const row = payload.new as ChatMessage & { application_id: string };
          if (row.sender_user_id === user.id) return;
          // If not currently viewing this convo, increment unread
          if (activeConvo !== appId) {
            setConversations(prev => prev.map(c =>
              c.application_id === appId
                ? { ...c, unread_count: c.unread_count + 1, last_message: row.message, last_message_at: row.created_at, last_sender_id: row.sender_user_id }
                : c
            ));
            // Play sound
            try { new Audio('/sounds/message.wav').play().catch(() => {}); } catch {}
          }
        })
        .subscribe();
    });
    return () => { channels.filter(Boolean).forEach(ch => { sb.removeChannel(ch!); }); appIds.forEach(id => unregisterChannel(`msg-list-${id}`)); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, conversations.length, activeConvo]);

  // ─── Auto-open from URL param ───────────────────────────────
  useEffect(() => {
    if (openAppId && conversations.length > 0) {
      const found = conversations.find(c => c.application_id === openAppId);
      if (found) setActiveConvo(openAppId);
    }
  }, [openAppId, conversations]);

  const activeConversation = conversations.find(c => c.application_id === activeConvo);

  // Filter conversations by search query
  const filteredConversations = searchQuery.trim()
    ? conversations.filter(c =>
        c.other_party_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.last_message.toLowerCase().includes(searchQuery.toLowerCase()) ||
        `K${c.kingdom_number}`.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : conversations;
  const totalUnread = conversations.reduce((sum, c) => sum + c.unread_count, 0);

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return t('messages.justNow', 'now');
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // ─── Not logged in ──────────────────────────────────────────
  if (!user) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem 1rem', color: colors.textSecondary }}>
        <h2 style={{ fontFamily: FONT_DISPLAY, ...neonGlow('#22d3ee'), fontSize: '1.5rem', marginBottom: '0.5rem' }}>
          💬 {t('messages.title', 'Messages')}
        </h2>
        <p>{t('messages.loginRequired', 'Sign in to access your messages.')}</p>
        <Link to="/transfer-hub" style={{ color: '#22d3ee', textDecoration: 'none', fontSize: '0.85rem' }}>
          ← {t('messages.backToHub', 'Back to Transfer Hub')}
        </Link>
      </div>
    );
  }

  // ─── Loading ────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem 1rem', color: colors.textSecondary }}>
        {t('messages.loading', 'Loading conversations...')}
      </div>
    );
  }

  // ─── Chat view (mobile shows one at a time) ─────────────────
  const showConvoList = !isMobile || !activeConvo;
  const showChat = !isMobile || !!activeConvo;

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <h1 style={{
            fontFamily: FONT_DISPLAY, fontSize: isMobile ? '1.2rem' : '1.5rem',
            margin: 0, ...neonGlow('#22d3ee'),
          }}>
            💬 {t('messages.title', 'Messages')}
          </h1>
          {totalUnread > 0 && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              minWidth: '20px', height: '20px', padding: '0 6px',
              backgroundColor: '#ef4444', borderRadius: '10px',
              fontSize: '0.65rem', fontWeight: '700', color: '#fff',
            }}>{totalUnread}</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {totalUnread > 0 && (
            <button onClick={markAllRead} style={{
              padding: '0.35rem 0.6rem', backgroundColor: '#22d3ee10',
              border: '1px solid #22d3ee25', borderRadius: '6px',
              color: '#22d3ee', fontSize: '0.7rem', fontWeight: '600', cursor: 'pointer',
            }}>
              ✓ {t('messages.markAllRead', 'Mark all read')}
            </button>
          )}
          <Link to="/transfer-hub" style={{
            padding: '0.35rem 0.6rem', backgroundColor: '#ffffff08',
            border: '1px solid #ffffff15', borderRadius: '6px',
            color: colors.textSecondary, fontSize: '0.7rem', textDecoration: 'none',
          }}>
            ← {t('messages.backToHub', 'Transfer Hub')}
          </Link>
        </div>
      </div>

      {conversations.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '3rem 1rem',
          backgroundColor: colors.bg, borderRadius: '12px',
          border: `1px solid ${colors.border}`,
        }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>💬</div>
          <p style={{ color: colors.textSecondary, fontSize: '0.85rem', marginBottom: '0.75rem' }}>
            {t('messages.noConversations', 'No conversations yet.')}
          </p>
          <p style={{ color: colors.textMuted, fontSize: '0.75rem' }}>
            {t('messages.noConversationsDesc', 'Apply to a kingdom or receive an application to start messaging.')}
          </p>
          <Link to="/transfer-hub" style={{
            display: 'inline-block', marginTop: '1rem',
            padding: '0.5rem 1rem', backgroundColor: '#22d3ee15',
            border: '1px solid #22d3ee30', borderRadius: '8px',
            color: '#22d3ee', textDecoration: 'none', fontSize: '0.85rem', fontWeight: '600',
          }}>
            {t('messages.goToHub', 'Go to Transfer Hub')}
          </Link>
        </div>
      ) : (
        <div style={{
          display: 'flex', gap: 0,
          height: isMobile ? 'calc(100vh - 200px)' : '600px',
          backgroundColor: '#0a0a0a',
          borderRadius: '12px',
          border: `1px solid ${colors.border}`,
          overflow: 'hidden',
        }}>
          {/* Conversation List */}
          {showConvoList && (
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
              {filteredConversations.length === 0 && searchQuery.trim() ? (
                <div style={{ padding: '1.5rem', textAlign: 'center', color: colors.textMuted, fontSize: '0.75rem' }}>
                  {t('messages.noSearchResults', 'No conversations found.')}
                </div>
              ) : filteredConversations.map(convo => {
                const isActive = activeConvo === convo.application_id;
                const isUnread = convo.unread_count > 0;
                const isMine = convo.last_sender_id === user?.id;
                return (
                  <div
                    key={convo.application_id}
                    onClick={() => setActiveConvo(convo.application_id)}
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
                            {convo.role === 'recruiter' ? t('messages.recruiter', 'Recruiter') : t('messages.transferee', 'Recruit Candidate')}
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
              })}
              </div>
            </div>
          )}

          {/* Chat Panel */}
          {showChat && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              {activeConvo && activeConversation ? (
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
                        <Link to={`/kingdom/${activeConversation.kingdom_number}`} style={{
                          fontSize: '0.65rem', color: '#22d3ee', textDecoration: 'none',
                        }}>
                          K{activeConversation.kingdom_number}
                        </Link>
                      </div>
                      <span style={{ fontSize: '0.6rem', color: colors.textMuted }}>
                        {activeConversation.status.charAt(0).toUpperCase() + activeConversation.status.slice(1)} · {activeConversation.role === 'recruiter' ? t('messages.youAreRecruiter', 'You are recruiting') : t('messages.youAreTransferee', 'You applied')}
                      </span>
                    </div>
                    <Link to="/transfer-hub" style={{
                      padding: '0.25rem 0.5rem', backgroundColor: '#ffffff08',
                      border: '1px solid #ffffff15', borderRadius: '4px',
                      color: colors.textMuted, fontSize: '0.6rem', textDecoration: 'none',
                    }}>
                      {t('messages.viewApp', 'View App')}
                    </Link>
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
                      messages.map(msg => {
                        const isMe = msg.sender_user_id === user?.id;
                        const senderName = !isMe ? senderNames[msg.sender_user_id] : undefined;
                        const translated = translations[msg.id];
                        return (
                          <div key={msg.id} style={{
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
                                  {(() => { const d = new Date(msg.created_at); const now = new Date(); const isToday = d.toDateString() === now.toDateString(); const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1); const isYesterday = d.toDateString() === yesterday.toDateString(); const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }); if (isToday) return time; if (isYesterday) return `Yesterday ${time}`; return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${time}`; })()}
                                </span>
                                {isMe && (
                                  <span style={{ color: otherReadAt && new Date(otherReadAt) >= new Date(msg.created_at) ? '#3b82f6' : '#4b5563', fontSize: '0.5rem', fontWeight: 600 }}>
                                    {otherReadAt && new Date(otherReadAt) >= new Date(msg.created_at) ? '✓✓' : '✓'}
                                  </span>
                                )}
                                {!isMe && browserLang !== 'en' && (
                                  <button
                                    onClick={async () => {
                                      if (translated) { setTranslations(prev => { const n = { ...prev }; delete n[msg.id]; return n; }); return; }
                                      setTranslatingId(msg.id);
                                      try {
                                        const result = await translateMessage(msg.message, browserLang);
                                        setTranslations(prev => ({ ...prev, [msg.id]: result }));
                                      } catch {}
                                      setTranslatingId(null);
                                    }}
                                    disabled={translatingId === msg.id}
                                    style={{
                                      background: 'none', border: 'none',
                                      color: translated ? '#a78bfa' : '#6b7280',
                                      fontSize: '0.5rem', cursor: 'pointer', padding: '0 0.15rem',
                                      fontWeight: 600, opacity: translatingId === msg.id ? 0.5 : 1,
                                    }}
                                  >
                                    {translatingId === msg.id ? '⏳' : translated ? t('messages.hideTranslation', 'Hide') : `🌐 ${t('messages.translate', 'Translate')}`}
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
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
              ) : (
                !isMobile && (
                  <div style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexDirection: 'column', color: colors.textMuted,
                  }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>💬</div>
                    <p style={{ fontSize: '0.85rem' }}>{t('messages.selectConvo', 'Select a conversation to start chatting')}</p>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Messages;
