import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { logger } from '../utils/logger';
import type { User } from '@supabase/supabase-js';
import {
  GuildSettings, AllianceEvent, GuildAdmin, EventHistoryRow,
  DiscordChannel, DiscordRole, DiscordCategory,
  ReactionRoleConfig,
  EVENT_ORDER, FIXED_REFERENCE_DATES,
} from '../pages/BotDashboardComponents';

interface UseBotDashboardDataProps {
  user: User | null;
  discordId: string | null | undefined;
}

/**
 * Extracts all data-loading state and functions from BotDashboard.
 * Keeps CRUD actions and UI state in the parent component.
 */
export function useBotDashboardData({ user, discordId }: UseBotDashboardDataProps) {
  // ─── Core Data State ────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [guilds, setGuilds] = useState<GuildSettings[]>([]);
  const [selGuild, setSelGuild] = useState<string | null>(null);
  const [events, setEvents] = useState<AllianceEvent[]>([]);
  const [admins, setAdmins] = useState<GuildAdmin[]>([]);
  const [hist, setHist] = useState<EventHistoryRow[]>([]);

  // ─── Discord Metadata ───────────────────────────────────────────────────
  const [dChannels, setDChannels] = useState<DiscordChannel[]>([]);
  const [dRoles, setDRoles] = useState<DiscordRole[]>([]);
  const [dCategories, setDCategories] = useState<DiscordCategory[]>([]);
  const [loadingDiscord, setLoadingDiscord] = useState(false);

  // ─── Reaction Roles Data ────────────────────────────────────────────────
  const [rrConfigs, setRrConfigs] = useState<ReactionRoleConfig[]>([]);

  // ─── Derived ────────────────────────────────────────────────────────────
  const guild = useMemo(() => guilds.find(g => g.guild_id === selGuild) || null, [guilds, selGuild]);

  const sortedEvents = useMemo(() => {
    const order = new Map(EVENT_ORDER.map((t, i) => [t, i]));
    return [...events].sort((a, b) => (order.get(a.event_type) ?? 99) - (order.get(b.event_type) ?? 99));
  }, [events]);

  // ─── Data Loading ───────────────────────────────────────────────────────

  const loadGuilds = useCallback(async () => {
    if (!supabase || !user) return;
    setLoading(true);
    try {
      const { data: ar } = await supabase.from('bot_guild_admins').select('guild_id').eq('user_id', user.id);
      const { data: og } = await supabase.from('bot_guild_settings').select('*').eq('created_by', user.id);
      const ids = new Set([...(ar || []).map(r => r.guild_id), ...(og || []).map(g => g.guild_id)]);
      if (ids.size === 0) { setGuilds([]); setLoading(false); return; }
      const { data } = await supabase.from('bot_guild_settings').select('*').in('guild_id', Array.from(ids));
      const gs = data || [];
      setGuilds(gs);
      if (gs.length > 0 && !selGuild) setSelGuild(gs[0].guild_id);
    } catch (e) { logger.error('Load guilds failed:', e); }
    finally { setLoading(false); }
  }, [user, selGuild]);

  const loadEv = useCallback(async (gid: string) => {
    if (!supabase) return;
    const { data } = await supabase.from('bot_alliance_events').select('*').eq('guild_id', gid).order('event_type');
    if (data) setEvents(data);
  }, []);

  const loadAdm = useCallback(async (gid: string) => {
    if (!supabase) return;
    const { data } = await supabase.from('bot_guild_admins').select('*').eq('guild_id', gid).order('role');
    if (data) {
      const uids = data.map(a => a.user_id);
      const { data: ps } = await supabase.from('profiles').select('id, username, discord_username').in('id', uids);
      const pm = new Map((ps || []).map(p => [p.id, p.discord_username || p.username]));
      setAdmins(data.map(a => ({ ...a, username: pm.get(a.user_id) || 'Unknown' })));
    }
  }, []);

  const loadHist = useCallback(async (gid: string) => {
    if (!supabase) return;
    const { data } = await supabase.from('bot_event_history').select('*').eq('guild_id', gid).order('sent_at', { ascending: false }).limit(50);
    if (data) setHist(data);
  }, []);

  const loadRr = useCallback(async (gid: string) => {
    if (!supabase) return;
    const { data } = await supabase.from('bot_reaction_roles').select('*').eq('guild_id', gid).order('created_at', { ascending: false });
    if (data) setRrConfigs(data);
  }, []);

  // ─── Fetch Discord Channels & Roles ─────────────────────────────────────
  const fetchDiscordData = useCallback(async (gid: string) => {
    if (!supabase || !discordId) return;
    setLoadingDiscord(true);
    try {
      const [chRes, roRes] = await Promise.all([
        supabase.functions.invoke('verify-guild-permissions', {
          body: { action: 'list-channels', guild_id: gid, discord_id: discordId },
        }),
        supabase.functions.invoke('verify-guild-permissions', {
          body: { action: 'list-roles', guild_id: gid, discord_id: discordId },
        }),
      ]);
      setDChannels(chRes.data?.channels || []);
      setDCategories(chRes.data?.categories || []);
      setDRoles(roRes.data?.roles || []);
    } catch (e) { logger.error('Failed to fetch Discord data:', e); }
    finally { setLoadingDiscord(false); }
  }, [discordId]);

  // ─── Effects ────────────────────────────────────────────────────────────
  useEffect(() => { loadGuilds(); }, [loadGuilds]);
  useEffect(() => { if (selGuild) { loadEv(selGuild); loadAdm(selGuild); loadHist(selGuild); loadRr(selGuild); } }, [selGuild, loadEv, loadAdm, loadHist, loadRr]);
  useEffect(() => { if (selGuild) fetchDiscordData(selGuild); }, [selGuild, fetchDiscordData]);

  // Auto-set fixed reference dates for non-Bear-Hunt events that have none
  useEffect(() => {
    const sb = supabase;
    if (!sb) return;
    events.forEach(ev => {
      if (ev.event_type !== 'bear_hunt' && !ev.reference_date && FIXED_REFERENCE_DATES[ev.event_type]) {
        const fixedDate = FIXED_REFERENCE_DATES[ev.event_type]!;
        setEvents(p => p.map(e => e.id === ev.id ? { ...e, reference_date: fixedDate } : e));
        sb.from('bot_alliance_events').update({ reference_date: fixedDate, updated_at: new Date().toISOString() }).eq('id', ev.id).then(() => {});
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events.length]); // Only when events array length changes (initial load)

  return {
    // State
    loading, guilds, selGuild, events, admins, hist,
    dChannels, dRoles, dCategories, loadingDiscord,
    rrConfigs,
    // Derived
    guild, sortedEvents,
    // Setters (for CRUD operations in the component)
    setGuilds, setSelGuild, setEvents, setAdmins, setRrConfigs,
    // Load functions (for refreshes after CRUD)
    loadGuilds, loadEv, loadAdm, loadHist, loadRr,
    fetchDiscordData,
  };
}
