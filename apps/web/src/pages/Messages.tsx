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
import { getBrowserLanguage } from '../utils/translateMessage';
import type { Conversation, ChatMessage } from './messages/types';
import ConversationListPanel from './messages/ConversationListPanel';
import ChatPanel from './messages/ChatPanel';
import { getAnonAlias } from '../utils/anonAlias';

// ─── Rate Limiter ─────────────────────────────────────────────
const MSG_COOLDOWN_MS = 2000;
let lastSentAt = 0;

// ─── Component ────────────────────────────────────────────────
const Messages: React.FC = () => {
  useDocumentTitle('Messages');
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
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
        .select('id, kingdom_number, status, applied_at, applicant_user_id, transfer_profile_id')
        .eq('applicant_user_id', user.id)
        .in('status', ['pending', 'viewed', 'interested', 'accepted']);

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
          .select('id, kingdom_number, status, applied_at, applicant_user_id, transfer_profile_id')
          .in('kingdom_number', editorKingdoms)
          .in('status', ['pending', 'viewed', 'interested', 'accepted']);
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

      // Get transfer profile info (anonymous status + home kingdom) for recruiter conversations
      const transferProfileIds = [...new Set(allApps.filter(a => a.role === 'recruiter' && a.transfer_profile_id).map(a => a.transfer_profile_id))];
      const transferProfileMap = new Map<string, { is_anonymous: boolean; current_kingdom: number }>();
      if (transferProfileIds.length > 0) {
        const { data: tpRows } = await supabase
          .from('transfer_profiles')
          .select('id, is_anonymous, current_kingdom')
          .in('id', transferProfileIds);
        (tpRows || []).forEach(tp => { transferProfileMap.set(tp.id, { is_anonymous: tp.is_anonymous, current_kingdom: tp.current_kingdom }); });
      }

      // Get other party names (only for non-anonymous candidates)
      const otherIds = new Set<string>();
      allApps.forEach(a => {
        if (a.role === 'recruiter') {
          const tp = transferProfileMap.get(a.transfer_profile_id);
          // Only fetch real name if not anonymous (or accepted — identity revealed)
          if (!tp?.is_anonymous || a.status === 'accepted') {
            otherIds.add(a.applicant_user_id);
          }
        }
      });
      const nameMap: Record<string, string> = {};
      if (otherIds.size > 0) {
        const { data: profileRows } = await supabase
          .from('profiles')
          .select('id, username, linked_username')
          .in('id', [...otherIds]);
        (profileRows || []).forEach(p => { nameMap[p.id] = p.linked_username || p.username || 'Unknown'; });
      }

      // Build conversations
      const convos: Conversation[] = allApps.map(app => {
        const lastMsg = lastMsgMap.get(app.id);
        const tp = app.role === 'recruiter' ? transferProfileMap.get(app.transfer_profile_id) : undefined;
        const isAnon = tp?.is_anonymous && app.status !== 'accepted';
        return {
          application_id: app.id,
          kingdom_number: app.kingdom_number,
          candidate_kingdom: tp?.current_kingdom,
          status: app.status,
          other_party_name: app.role === 'recruiter'
            ? (isAnon ? `🔒 ${getAnonAlias(app.transfer_profile_id)}` : (nameMap[app.applicant_user_id] || t('messages.applicant', 'Applicant')))
            : `K${app.kingdom_number}`,
          other_party_id: app.applicant_user_id,
          role: app.role,
          last_message: lastMsg?.message || '',
          last_message_at: lastMsg?.created_at || app.applied_at,
          last_sender_id: lastMsg?.sender_user_id || '',
          unread_count: unreadCounts[app.id] || 0,
          applied_at: app.applied_at,
          transfer_profile_id: app.transfer_profile_id,
          is_anonymous: isAnon || false,
        };
      });

      // ─── Pre-application messages (Silver/Gold kingdoms → candidates) ──
      try {
        // Messages sent TO this user's transfer profile
        const { data: myTransferProfile } = await supabase
          .from('transfer_profiles')
          .select('id, is_anonymous, current_kingdom')
          .eq('user_id', user.id)
          .maybeSingle();

        if (myTransferProfile) {
          const { data: incomingPreApp } = await supabase
            .from('pre_application_messages')
            .select('id, kingdom_number, sender_user_id, message, created_at, read_at')
            .eq('recipient_profile_id', myTransferProfile.id)
            .order('created_at', { ascending: false });

          if (incomingPreApp && incomingPreApp.length > 0) {
            // Group by kingdom_number
            const byKingdom = new Map<number, typeof incomingPreApp>();
            incomingPreApp.forEach(m => {
              const arr = byKingdom.get(m.kingdom_number) || [];
              arr.push(m);
              byKingdom.set(m.kingdom_number, arr);
            });

            for (const [kn, msgs] of byKingdom) {
              const latest = msgs[0];
              if (!latest) continue;
              const unread = msgs.filter(m => !m.read_at).length;
              const convoId = `pre-app-${kn}-${myTransferProfile.id}`;
              convos.push({
                application_id: convoId,
                kingdom_number: kn,
                candidate_kingdom: myTransferProfile.current_kingdom,
                status: 'pre-application',
                other_party_name: `K${kn}`,
                other_party_id: latest.sender_user_id,
                role: 'transferee',
                last_message: latest.message,
                last_message_at: latest.created_at,
                last_sender_id: latest.sender_user_id,
                unread_count: unread,
                applied_at: latest.created_at,
                is_pre_app: true,
                pre_app_profile_id: myTransferProfile.id,
              });
            }
          }
        }

        // Messages sent BY this user (as recruiter)
        const { data: sentPreApp } = await supabase
          .from('pre_application_messages')
          .select('id, kingdom_number, recipient_profile_id, message, created_at')
          .eq('sender_user_id', user.id)
          .order('created_at', { ascending: false });

        if (sentPreApp && sentPreApp.length > 0) {
          // Identify unique conversations the recruiter started
          const convoKeys = new Set<string>();
          sentPreApp.forEach(m => convoKeys.add(`${m.kingdom_number}-${m.recipient_profile_id}`));

          // Fetch ALL messages in those conversations (including transferee replies)
          const recipientIds = [...new Set(sentPreApp.map(m => m.recipient_profile_id))];
          const { data: allConvoMsgs } = await supabase
            .from('pre_application_messages')
            .select('id, kingdom_number, sender_user_id, recipient_profile_id, message, created_at, read_at')
            .in('recipient_profile_id', recipientIds)
            .order('created_at', { ascending: false });

          // Group by (kingdom_number, recipient_profile_id)
          const byTarget = new Map<string, NonNullable<typeof allConvoMsgs>>();
          (allConvoMsgs || []).forEach(m => {
            const key = `${m.kingdom_number}-${m.recipient_profile_id}`;
            if (!convoKeys.has(key)) return; // Only include conversations recruiter participated in
            const arr = byTarget.get(key) || [];
            arr.push(m);
            byTarget.set(key, arr);
          });

          // Fetch recipient profile info for anonymity
          const { data: recipientProfiles } = await supabase
            .from('transfer_profiles')
            .select('id, is_anonymous, current_kingdom, user_id')
            .in('id', recipientIds);
          const rpMap = new Map((recipientProfiles || []).map(rp => [rp.id, rp]));

          for (const [, msgs] of byTarget) {
            const latest = msgs[0];
            if (!latest) continue;
            const kn = latest.kingdom_number;
            const profileId = latest.recipient_profile_id;
            const rp = rpMap.get(profileId);
            const convoId = `pre-app-${kn}-${profileId}`;
            // Skip if already added from incoming side
            if (convos.some(c => c.application_id === convoId)) continue;
            // Unread = replies from transferee that recruiter hasn't read
            const unread = msgs.filter(m => m.sender_user_id !== user.id && !m.read_at).length;
            convos.push({
              application_id: convoId,
              kingdom_number: kn,
              candidate_kingdom: rp?.current_kingdom,
              status: 'pre-application',
              other_party_name: rp?.is_anonymous ? `🔒 ${getAnonAlias(profileId)}` : t('messages.candidate', 'Candidate'),
              other_party_id: rp?.user_id || '',
              role: 'recruiter',
              last_message: latest.message,
              last_message_at: latest.created_at,
              last_sender_id: latest.sender_user_id,
              unread_count: unread,
              applied_at: latest.created_at,
              is_pre_app: true,
              pre_app_profile_id: profileId,
              transfer_profile_id: profileId,
              is_anonymous: rp?.is_anonymous || false,
            });
          }
        }
      } catch (preAppErr) {
        logger.error('Messages: failed to load pre-app conversations', preAppErr);
      }

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
    const convo = conversations.find(c => c.application_id === activeConvo);
    // Skip read-status tracking for pre-app conversations
    if (!convo || convo.is_pre_app) { setOtherReadAt(null); return; }
    const sb = supabase;
    let cancelled = false;
    const fetchReadStatus = async () => {
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
    const convo = conversations.find(c => c.application_id === activeConvo);
    const isPreApp = convo?.is_pre_app;

    const load = async () => {
      let data: ChatMessage[] | null = null;

      if (isPreApp && convo?.pre_app_profile_id) {
        // Pre-app: fetch from pre_application_messages
        const { data: preAppMsgs } = await sb
          .from('pre_application_messages')
          .select('id, sender_user_id, message, created_at')
          .eq('kingdom_number', convo.kingdom_number)
          .eq('recipient_profile_id', convo.pre_app_profile_id)
          .order('created_at', { ascending: true });
        data = preAppMsgs;
        // Mark as read if recipient
        if (convo.role === 'transferee' && preAppMsgs && preAppMsgs.length > 0) {
          const unreadIds = preAppMsgs.filter(m => m.sender_user_id !== user.id).map(m => m.id);
          if (unreadIds.length > 0) {
            await sb.from('pre_application_messages')
              .update({ read_at: new Date().toISOString() })
              .in('id', unreadIds)
              .is('read_at', null);
          }
        }
      } else {
        // Standard app messages
        const { data: appMsgs } = await sb
          .from('application_messages')
          .select('id, sender_user_id, message, created_at')
          .eq('application_id', activeConvo)
          .order('created_at', { ascending: true });
        data = appMsgs;
        // Mark as read
        await sb.from('message_read_status')
          .upsert({ application_id: activeConvo, user_id: user.id, last_read_at: new Date().toISOString() }, { onConflict: 'application_id,user_id' });
      }

      if (cancelled) return;
      if (data) {
        setMessages(data);
        // Fetch sender names (respect anonymity)
        const msgOtherIds = [...new Set(data.filter(m => m.sender_user_id !== user.id).map(m => m.sender_user_id))];
        if (msgOtherIds.length > 0) {
          // If current user is recruiter and the other party should be anonymous, don't reveal names
          if (convo?.role === 'recruiter' && convo.is_anonymous && convo.transfer_profile_id) {
            const map: Record<string, string> = {};
            msgOtherIds.forEach(id => { map[id] = getAnonAlias(convo.transfer_profile_id!); });
            setSenderNames(prev => ({ ...prev, ...map }));
          } else {
            const { data: profiles } = await sb.from('profiles').select('id, username, linked_username').in('id', msgOtherIds);
            if (profiles && !cancelled) {
              const map: Record<string, string> = {};
              profiles.forEach((p: { id: string; username: string; linked_username?: string }) => {
                map[p.id] = p.linked_username || p.username || 'Unknown';
              });
              setSenderNames(prev => ({ ...prev, ...map }));
            }
          }
        }
      }
      // Update local unread count
      setConversations(prev => prev.map(c =>
        c.application_id === activeConvo ? { ...c, unread_count: 0 } : c
      ));
      // Signal header badge to refresh
      window.dispatchEvent(new Event('messages-read'));
      if (!cancelled) setLoadingMessages(false);
    };
    load();

    // Real-time subscription (skip for pre-app — no filter support)
    if (isPreApp) {
      return () => { cancelled = true; };
    }
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
          try { new Audio('/sounds/message.wav').play().catch(() => {}); } catch { /* audio play best-effort */ }
        }
        // Mark as read immediately since we're viewing
        sb.from('message_read_status')
          .upsert({ application_id: activeConvo, user_id: user.id, last_read_at: new Date().toISOString() }, { onConflict: 'application_id,user_id' })
          .then(() => { window.dispatchEvent(new Event('messages-read')); });
      })
      .subscribe();

    return () => { cancelled = true; sb.removeChannel(channel); unregisterChannel(msgChName); };
  }, [activeConvo, user]);

  // Auto-scroll to bottom: instant on chat open / initial load, smooth for new messages
  const prevMsgCountRef = useRef(0);
  useEffect(() => {
    if (messages.length === 0) { prevMsgCountRef.current = 0; return; }
    const isInitialLoad = prevMsgCountRef.current === 0;
    prevMsgCountRef.current = messages.length;
    // Use rAF to ensure DOM has painted before scrolling
    requestAnimationFrame(() => {
      msgEndRef.current?.scrollIntoView({ behavior: isInitialLoad ? 'instant' : 'smooth' });
    });
  }, [messages.length, activeConvo]);

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
    const convo = conversations.find(c => c.application_id === activeConvo);
    const isPreApp = convo?.is_pre_app;
    try {
      if (isPreApp && convo?.pre_app_profile_id) {
        // Pre-app message: insert into pre_application_messages
        const { data, error } = await supabase
          .from('pre_application_messages')
          .insert({
            kingdom_number: convo.kingdom_number,
            sender_user_id: user.id,
            recipient_profile_id: convo.pre_app_profile_id,
            message: msgText.trim(),
          })
          .select('id, sender_user_id, message, created_at')
          .single();
        if (!error && data) {
          setMessages(prev => [...prev, data]);
          setMsgText('');
          setConversations(prev => prev.map(c =>
            c.application_id === activeConvo
              ? { ...c, last_message: data.message, last_message_at: data.created_at, last_sender_id: data.sender_user_id }
              : c
          ));
        }
      } else {
        // Standard application message
        const { data, error } = await supabase
          .from('application_messages')
          .insert({ application_id: activeConvo, sender_user_id: user.id, message: msgText.trim() })
          .select('id, sender_user_id, message, created_at')
          .single();
        if (!error && data) {
          setMessages(prev => [...prev, data]);
          setMsgText('');
          setConversations(prev => prev.map(c =>
            c.application_id === activeConvo
              ? { ...c, last_message: data.message, last_message_at: data.created_at, last_sender_id: data.sender_user_id }
              : c
          ));
          // Mark as read when sending
          supabase.from('message_read_status')
            .upsert({ application_id: activeConvo, user_id: user.id, last_read_at: new Date().toISOString() }, { onConflict: 'application_id,user_id' })
            .then(() => { window.dispatchEvent(new Event('messages-read')); });
        }
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
      if (c.is_pre_app && c.pre_app_profile_id) {
        // Mark only messages from the OTHER party as read
        await sb.from('pre_application_messages')
          .update({ read_at: new Date().toISOString() })
          .eq('kingdom_number', c.kingdom_number)
          .eq('recipient_profile_id', c.pre_app_profile_id)
          .neq('sender_user_id', user.id)
          .is('read_at', null);
      } else {
        await sb.from('message_read_status')
          .upsert({ application_id: c.application_id, user_id: user.id, last_read_at: new Date().toISOString() }, { onConflict: 'application_id,user_id' });
      }
    }
    setConversations(prev => prev.map(c => ({ ...c, unread_count: 0 })));
    window.dispatchEvent(new Event('messages-read'));
  };

  // ─── Subscribe to new messages across all conversations ─────
  useEffect(() => {
    if (!supabase || !user || conversations.length === 0) return;
    const sb = supabase;
    const standardConvos = conversations.filter(c => !c.is_pre_app);
    const appIds = standardConvos.map(c => c.application_id);
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
            try { new Audio('/sounds/message.wav').play().catch(() => {}); } catch { /* audio play best-effort */ }
          }
        })
        .subscribe();
    });
    return () => { channels.filter(Boolean).forEach(ch => { sb.removeChannel(ch!); }); appIds.forEach(id => unregisterChannel(`msg-list-${id}`)); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, conversations.length, activeConvo]);

  // ─── Auto-open from URL param (consume once, then clear) ────
  useEffect(() => {
    if (openAppId && conversations.length > 0) {
      const found = conversations.find(c => c.application_id === openAppId);
      if (found) setActiveConvo(openAppId);
      // Clear ?app= so it doesn't override future manual thread selections
      setSearchParams(prev => { prev.delete('app'); return prev; }, { replace: true });
    }
  }, [openAppId, conversations, setSearchParams]);

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
            <ConversationListPanel
              conversations={filteredConversations}
              activeConvo={activeConvo}
              isMobile={isMobile}
              currentUserId={user?.id || ''}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              formatTime={formatTime}
              setActiveConvo={setActiveConvo}
            />
          )}

          {/* Chat Panel */}
          {showChat && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <ChatPanel
                activeConversation={activeConversation}
                messages={messages}
                loadingMessages={loadingMessages}
                isMobile={isMobile}
                currentUserId={user?.id || ''}
                senderNames={senderNames}
                otherReadAt={otherReadAt}
                browserLang={browserLang}
                otherTyping={otherTyping}
                msgText={msgText}
                setMsgText={setMsgText}
                sendingMsg={sendingMsg}
                sendMessage={sendMessage}
                broadcastTyping={broadcastTyping}
                setActiveConvo={setActiveConvo}
                msgEndRef={msgEndRef}
                inputRef={inputRef}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Messages;
