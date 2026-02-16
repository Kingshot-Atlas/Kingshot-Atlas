import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useIsMobile } from '../hooks/useMediaQuery';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { supabase } from '../lib/supabase';
import { neonGlow, FONT_DISPLAY, colors } from '../utils/styles';

// ─── Types ──────────────────────────────────────────────────────────────────

interface GuildSettings {
  id: string;
  guild_id: string;
  guild_name: string;
  guild_icon_url: string | null;
  reminder_channel_id: string | null;
  gift_code_alerts: boolean;
  gift_code_channel_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface AllianceEvent {
  id: string;
  guild_id: string;
  event_type: EventType;
  enabled: boolean;
  time_slots: TimeSlot[];
  reminder_minutes_before: number;
  channel_id: string | null;
  role_id: string | null;
  reference_date: string | null;
  last_reminded_at: string | null;
  created_at: string;
  updated_at: string;
}

interface GuildAdmin {
  id: string;
  guild_id: string;
  user_id: string;
  role: 'owner' | 'admin';
  created_at: string;
  username?: string;
}

interface EventHistoryRow {
  id: string;
  guild_id: string;
  event_type: string;
  sent_at: string;
  channel_id: string | null;
  status: 'sent' | 'failed' | 'skipped';
  error_message: string | null;
  reminder_minutes_before: number | null;
  time_slot: TimeSlot | null;
}

type EventType = 'bear_hunt' | 'viking_vengeance' | 'swordland_showdown' | 'tri_alliance_clash';
interface TimeSlot { hour: number; minute: number; }
type DashTab = 'events' | 'settings' | 'admins' | 'history';

// ─── Constants ──────────────────────────────────────────────────────────────

const SB_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SB_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const EVENT_META: Record<EventType, { label: string; icon: string; color: string; schedule: string; maxSlots: number; days: string }> = {
  bear_hunt:          { label: 'Bear Hunt',          icon: '🐻', color: '#f59e0b', schedule: 'Every 2 Days', maxSlots: 2, days: 'Every 2 days (set reference date)' },
  viking_vengeance:   { label: 'Viking Vengeance',   icon: '⚔️',  color: '#ef4444', schedule: 'Biweekly',     maxSlots: 2, days: 'Tuesday & Thursday' },
  swordland_showdown: { label: 'Swordland Showdown', icon: '🗡️',  color: '#a855f7', schedule: 'Biweekly',     maxSlots: 2, days: 'Sunday' },
  tri_alliance_clash: { label: 'Tri-Alliance Clash', icon: '🛡️',  color: '#3b82f6', schedule: 'Monthly',      maxSlots: 2, days: 'Saturday (every 4 weeks)' },
};

const REMINDER_PRESETS = [0, 5, 10, 15, 30, 60];

// ─── Helpers ────────────────────────────────────────────────────────────────

const fmt = (s: TimeSlot) => `${String(s.hour).padStart(2, '0')}:${String(s.minute).padStart(2, '0')}`;
const fmtLocal = (s: TimeSlot) => { const d = new Date(); d.setUTCHours(s.hour, s.minute, 0, 0); return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); };
const parseTime = (str: string): TimeSlot | null => { const p = str.split(':'); const h = parseInt(p[0]||'',10), m = parseInt(p[1]||'',10); return isNaN(h)||isNaN(m)||h<0||h>23||m<0||m>59 ? null : { hour: h, minute: m }; };
const ago = (iso: string) => { const d = Math.floor((Date.now() - new Date(iso).getTime())/60000); return d < 1 ? 'just now' : d < 60 ? `${d}m ago` : d < 1440 ? `${Math.floor(d/60)}h ago` : `${Math.floor(d/1440)}d ago`; };

const iS: React.CSSProperties = { width: '100%', maxWidth: '300px', backgroundColor: '#1a1a1a', border: `1px solid ${colors.border}`, borderRadius: '8px', color: colors.text, padding: '0.5rem 0.7rem', fontSize: '0.8rem', fontFamily: "'JetBrains Mono', monospace", outline: 'none', boxSizing: 'border-box' as const };
const lS: React.CSSProperties = { color: colors.textSecondary, fontSize: '0.75rem', fontWeight: 600, display: 'block' as const, marginBottom: '0.35rem' };

// ─── Sub-Components ─────────────────────────────────────────────────────────

const Dot: React.FC<{ on: boolean }> = ({ on }) => (
  <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: on ? colors.success : colors.textMuted, boxShadow: on ? `0 0 6px ${colors.success}` : 'none', flexShrink: 0 }} />
);

const Tog: React.FC<{ on: boolean; set: (v: boolean) => void; c?: string }> = ({ on, set, c = colors.primary }) => (
  <button onClick={() => set(!on)} style={{ width: 44, height: 24, borderRadius: 12, border: 'none', backgroundColor: on ? c : '#333', position: 'relative', cursor: 'pointer', transition: 'background-color 0.2s', flexShrink: 0 }}>
    <div style={{ width: 18, height: 18, borderRadius: '50%', backgroundColor: '#fff', position: 'absolute', top: 3, left: on ? 23 : 3, transition: 'left 0.2s' }} />
  </button>
);

const SlotEditor: React.FC<{ slots: TimeSlot[]; max: number; onChange: (s: TimeSlot[]) => void; color: string; local: boolean }> = ({ slots, max, onChange, color, local }) => {
  const [v, setV] = useState('');
  const add = () => { const p = parseTime(v); if (!p || slots.length >= max || slots.some(s => s.hour === p.hour && s.minute === p.minute)) return; onChange([...slots, p].sort((a, b) => a.hour*60+a.minute-(b.hour*60+b.minute))); setV(''); };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
        {slots.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.3rem 0.6rem', backgroundColor: `${color}15`, border: `1px solid ${color}40`, borderRadius: 6, fontSize: '0.85rem', fontFamily: "'JetBrains Mono', monospace", color, fontWeight: 600 }}>
            {fmt(s)} UTC{local && <span style={{ color: colors.textMuted, fontSize: '0.7rem', fontWeight: 400 }}>({fmtLocal(s)})</span>}
            <button onClick={() => onChange(slots.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: colors.textMuted, cursor: 'pointer', fontSize: '0.75rem', padding: '0 2px', lineHeight: 1 }}>✕</button>
          </div>
        ))}
      </div>
      {slots.length < max && (
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          <input type="time" value={v} onChange={e => setV(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') add(); }} style={{ ...iS, width: 110, maxWidth: 110 }} />
          <button onClick={add} disabled={!v} style={{ padding: '0.35rem 0.75rem', backgroundColor: v ? color : colors.border, border: 'none', borderRadius: 6, color: v ? '#fff' : colors.textMuted, fontSize: '0.75rem', fontWeight: 600, cursor: v ? 'pointer' : 'default' }}>+ Add</button>
          <span style={{ color: colors.textMuted, fontSize: '0.7rem' }}>UTC</span>
        </div>
      )}
    </div>
  );
};

const EvCard: React.FC<{ ev: AllianceEvent; onUp: (u: Partial<AllianceEvent>) => void; mob: boolean; local: boolean }> = ({ ev, onUp, mob, local }) => {
  const m = EVENT_META[ev.event_type];
  const [open, setOpen] = useState(false);
  const [cMins, setCMins] = useState('');
  return (
    <div style={{ backgroundColor: colors.surface, borderRadius: 12, border: `1px solid ${ev.enabled ? `${m.color}30` : colors.border}`, overflow: 'hidden', transition: 'border-color 0.2s' }}>
      <div onClick={() => setOpen(!open)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: mob ? '0.85rem' : '1rem 1.25rem', cursor: 'pointer', userSelect: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: mob ? '1.25rem' : '1.5rem' }}>{m.icon}</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span style={{ color: colors.text, fontWeight: 700, fontSize: mob ? '0.9rem' : '0.95rem' }}>{m.label}</span>
              <span style={{ fontSize: '0.6rem', fontWeight: 600, color: m.color, backgroundColor: `${m.color}15`, padding: '0.1rem 0.4rem', borderRadius: 3, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{m.schedule}</span>
            </div>
            <div style={{ color: colors.textMuted, fontSize: '0.7rem', marginTop: '0.15rem' }}>
              {m.days}{ev.time_slots.length > 0 && <span style={{ color: m.color, marginLeft: '0.4rem' }}>• {ev.time_slots.map(s => fmt(s) + (local ? ` (${fmtLocal(s)})` : '')).join(', ')} UTC</span>}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Dot on={ev.enabled && ev.time_slots.length > 0} />
          <Tog on={ev.enabled} set={v => onUp({ enabled: v })} c={m.color} />
          <span style={{ color: colors.textMuted, fontSize: '0.8rem', transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : '' }}>▼</span>
        </div>
      </div>
      {open && (
        <div style={{ padding: mob ? '0 0.85rem 0.85rem' : '0 1.25rem 1.25rem', borderTop: `1px solid ${colors.borderSubtle}`, paddingTop: '1rem' }}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={lS}>TIME SLOTS ({ev.time_slots.length}/{m.maxSlots})</label>
            <SlotEditor slots={ev.time_slots} max={m.maxSlots} onChange={s => onUp({ time_slots: s })} color={m.color} local={local} />
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label style={lS}>REMIND BEFORE (0–60 min)</label>
            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
              {REMINDER_PRESETS.map(n => (
                <button key={n} onClick={() => onUp({ reminder_minutes_before: n })} style={{ padding: '0.3rem 0.6rem', borderRadius: 6, border: `1px solid ${ev.reminder_minutes_before === n ? m.color : colors.border}`, backgroundColor: ev.reminder_minutes_before === n ? `${m.color}15` : 'transparent', color: ev.reminder_minutes_before === n ? m.color : colors.textMuted, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>{n === 0 ? 'Now' : `${n}m`}</button>
              ))}
              <input type="number" min={0} max={60} placeholder="Custom" value={cMins} onChange={e => setCMins(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { const x = parseInt(cMins); if (!isNaN(x) && x >= 0 && x <= 60) { onUp({ reminder_minutes_before: x }); setCMins(''); } } }}
                style={{ ...iS, width: 65, maxWidth: 65, textAlign: 'center', fontSize: '0.75rem', padding: '0.3rem' }} />
              <span style={{ color: colors.textMuted, fontSize: '0.65rem' }}>min</span>
            </div>
            {!REMINDER_PRESETS.includes(ev.reminder_minutes_before) && <div style={{ color: m.color, fontSize: '0.7rem', marginTop: '0.3rem' }}>Current: {ev.reminder_minutes_before}m before</div>}
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label style={lS}>REFERENCE DATE <span style={{ fontWeight: 400, color: colors.textMuted }}>(when cycle started)</span></label>
            <input type="date" value={ev.reference_date ? ev.reference_date.split('T')[0] : ''} onChange={e => onUp({ reference_date: e.target.value ? e.target.value + 'T00:00:00Z' : null })} style={{ ...iS, width: 160, maxWidth: 160 }} />
            <div style={{ color: colors.textMuted, fontSize: '0.65rem', marginTop: '0.2rem' }}>
              {ev.event_type === 'bear_hunt' ? 'Pick any Bear Hunt day. Bot counts every 2 days from here.' : 'Pick any week this event ran. Bot counts the cycle from here.'}
            </div>
          </div>
          <div style={{ marginBottom: '0.75rem' }}>
            <label style={lS}>CHANNEL ID <span style={{ fontWeight: 400, color: colors.textMuted }}>(optional override)</span></label>
            <input type="text" value={ev.channel_id || ''} onChange={e => onUp({ channel_id: e.target.value || null })} placeholder="Uses default channel" style={iS} />
          </div>
          <div>
            <label style={lS}>ROLE ID TO MENTION <span style={{ fontWeight: 400, color: colors.textMuted }}>(optional)</span></label>
            <input type="text" value={ev.role_id || ''} onChange={e => onUp({ role_id: e.target.value || null })} placeholder="e.g. 123456789012345678" style={iS} />
          </div>
          {ev.last_reminded_at && <div style={{ color: colors.textMuted, fontSize: '0.65rem', marginTop: '0.75rem', borderTop: `1px solid ${colors.borderSubtle}`, paddingTop: '0.5rem' }}>Last reminder: {ago(ev.last_reminded_at)}</div>}
        </div>
      )}
    </div>
  );
};

// ─── Main Component ─────────────────────────────────────────────────────────

const BotDashboard: React.FC = () => {
  useDocumentTitle('Bot Dashboard — Atlas');
  const { user, profile } = useAuth();
  const mob = useIsMobile();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [guilds, setGuilds] = useState<GuildSettings[]>([]);
  const [selGuild, setSelGuild] = useState<string | null>(null);
  const [events, setEvents] = useState<AllianceEvent[]>([]);
  const [admins, setAdmins] = useState<GuildAdmin[]>([]);
  const [hist, setHist] = useState<EventHistoryRow[]>([]);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [tab, setTab] = useState<DashTab>('events');
  const [showLocal, setShowLocal] = useState(false);
  const [setupId, setSetupId] = useState('');
  const [setupName, setSetupName] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [setupErr, setSetupErr] = useState('');
  const [adminInput, setAdminInput] = useState('');
  const [addingAdmin, setAddingAdmin] = useState(false);

  const guild = useMemo(() => guilds.find(g => g.guild_id === selGuild) || null, [guilds, selGuild]);
  const flash = (msg: string, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3000); };

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
    } catch (e) { console.error('Load guilds failed:', e); }
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
      const { data: ps } = await supabase.from('profiles').select('id, username').in('id', uids);
      const pm = new Map((ps || []).map(p => [p.id, p.username]));
      setAdmins(data.map(a => ({ ...a, username: pm.get(a.user_id) || 'Unknown' })));
    }
  }, []);

  const loadHist = useCallback(async (gid: string) => {
    if (!supabase) return;
    const { data } = await supabase.from('bot_event_history').select('*').eq('guild_id', gid).order('sent_at', { ascending: false }).limit(50);
    if (data) setHist(data);
  }, []);

  useEffect(() => { if (selGuild) { loadEv(selGuild); loadAdm(selGuild); loadHist(selGuild); } }, [selGuild, loadEv, loadAdm, loadHist]);
  useEffect(() => { loadGuilds(); }, [loadGuilds]);

  // ─── Permission Verify & Setup ──────────────────────────────────────────

  const verifyAndSetup = async () => {
    if (!supabase || !user || !profile?.discord_id || !setupId.trim()) return;
    setVerifying(true); setSetupErr('');
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      const res = await fetch(`${SB_URL}/functions/v1/verify-guild-permissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'apikey': SB_ANON },
        body: JSON.stringify({ guild_id: setupId.trim(), discord_id: profile.discord_id }),
      });
      const r = await res.json();
      if (!r.allowed) { setSetupErr(r.reason || 'Permission denied.'); return; }
      if (r.guild_name && !setupName.trim()) setSetupName(r.guild_name);
      await doSetup(r.guild_name || setupName.trim(), r.guild_icon || null);
    } catch { setSetupErr('Could not verify. Is Atlas Bot in this server?'); }
    finally { setVerifying(false); }
  };

  const doSetup = async (name: string, icon: string | null) => {
    if (!supabase || !user) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.from('bot_guild_settings')
        .insert({ guild_id: setupId.trim(), guild_name: name || setupName.trim(), guild_icon_url: icon, created_by: user.id })
        .select().single();
      if (error) { flash(error.code === '23505' ? 'Server already registered.' : error.message, false); return; }
      setGuilds(p => [...p, data]); setSelGuild(data.guild_id);
      await loadEv(data.guild_id); await loadAdm(data.guild_id);
      flash('Server registered!');
    } catch { flash('Registration failed', false); }
    finally { setSaving(false); }
  };

  // ─── Updates ────────────────────────────────────────────────────────────

  const upEv = async (eid: string, u: Partial<AllianceEvent>) => {
    if (!supabase) return;
    setEvents(p => p.map(e => e.id === eid ? { ...e, ...u } : e));
    const { error } = await supabase.from('bot_alliance_events').update({ ...u, updated_at: new Date().toISOString() }).eq('id', eid);
    if (error) { flash('Save failed', false); if (guild) loadEv(guild.guild_id); }
  };

  const upGuild = async (u: Partial<GuildSettings>) => {
    if (!supabase || !guild) return;
    setGuilds(p => p.map(g => g.guild_id === guild.guild_id ? { ...g, ...u } : g));
    const { error } = await supabase.from('bot_guild_settings').update({ ...u, updated_at: new Date().toISOString() }).eq('id', guild.id);
    if (error) { flash('Save failed', false); loadGuilds(); }
  };

  const addAdmin = async () => {
    if (!supabase || !guild || !adminInput.trim()) return;
    setAddingAdmin(true);
    try {
      const { data: p } = await supabase.from('profiles').select('id, username, discord_id').eq('username', adminInput.trim()).single();
      if (!p) { flash('User not found.', false); return; }
      if (!p.discord_id) { flash('User has no Discord linked.', false); return; }
      if (admins.some(a => a.user_id === p.id)) { flash('Already an admin.', false); return; }
      const { error } = await supabase.from('bot_guild_admins').insert({ guild_id: guild.guild_id, user_id: p.id, role: 'admin' });
      if (error) { flash(error.message, false); return; }
      flash(`Added ${p.username}`); setAdminInput(''); await loadAdm(guild.guild_id);
    } catch { flash('Failed', false); }
    finally { setAddingAdmin(false); }
  };

  const rmAdmin = async (aid: string, uid: string) => {
    if (!supabase || !guild) return;
    const a = admins.find(x => x.id === aid);
    if (a?.role === 'owner') { flash('Cannot remove owner', false); return; }
    if (uid === user?.id) { flash('Cannot remove yourself', false); return; }
    const { error } = await supabase.from('bot_guild_admins').delete().eq('id', aid);
    if (error) { flash('Failed', false); return; }
    flash('Removed'); await loadAdm(guild.guild_id);
  };

  // ─── Auth Gates ─────────────────────────────────────────────────────────

  if (!user) return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div style={{ textAlign: 'center', maxWidth: 400 }}>
        <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>🔒</span>
        <h2 style={{ color: colors.text, fontSize: '1.25rem', marginBottom: '0.5rem', fontFamily: FONT_DISPLAY }}>Sign In Required</h2>
        <p style={{ color: colors.textSecondary, fontSize: '0.85rem', marginBottom: '1.5rem', lineHeight: 1.6 }}>Sign in with your Atlas account to manage bot settings.</p>
        <Link to="/profile" style={{ display: 'inline-block', padding: '0.7rem 1.5rem', backgroundColor: colors.primary, color: colors.bg, borderRadius: 8, textDecoration: 'none', fontWeight: 600, fontSize: '0.9rem' }}>Sign In</Link>
      </div>
    </div>
  );

  if (!profile?.discord_id) return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div style={{ textAlign: 'center', maxWidth: 450 }}>
        <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>🔗</span>
        <h2 style={{ color: colors.text, fontSize: '1.25rem', marginBottom: '0.5rem', fontFamily: FONT_DISPLAY }}>Link Your Discord</h2>
        <p style={{ color: colors.textSecondary, fontSize: '0.85rem', marginBottom: '1.5rem', lineHeight: 1.6 }}>Link your Discord account in your profile first.</p>
        <Link to="/profile" style={{ display: 'inline-block', padding: '0.7rem 1.5rem', backgroundColor: colors.discord, color: '#fff', borderRadius: 8, textDecoration: 'none', fontWeight: 600, fontSize: '0.9rem' }}>Go to Profile</Link>
      </div>
    </div>
  );

  if (loading) return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '2rem', marginBottom: '0.75rem', animation: 'pulse 1.5s infinite' }}>⚙️</div>
        <p style={{ color: colors.textMuted, fontSize: '0.85rem' }}>Loading dashboard...</p>
      </div>
    </div>
  );

  // ─── Setup View ─────────────────────────────────────────────────────────

  if (guilds.length === 0) return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.bg }}>
      <div style={{ padding: mob ? '2rem 1rem 1rem' : '2.5rem 2rem 1.5rem', textAlign: 'center', background: 'linear-gradient(180deg, #111 0%, #0a0a0a 100%)' }}>
        <img src="/AtlasBotAvatar.webp" alt="Atlas Bot" style={{ width: 64, height: 64, borderRadius: '50%', margin: '0 auto 1rem', display: 'block', border: '2px solid #22d3ee30' }} />
        <h1 style={{ fontSize: mob ? '1.5rem' : '2rem', fontWeight: 'bold', marginBottom: '0.5rem', fontFamily: FONT_DISPLAY }}>
          <span style={{ color: '#fff' }}>BOT</span><span style={{ ...neonGlow('#22d3ee'), marginLeft: '0.4rem' }}>DASHBOARD</span>
        </h1>
        <p style={{ color: colors.textSecondary, fontSize: mob ? '0.85rem' : '0.95rem', maxWidth: 500, margin: '0 auto' }}>Manage Alliance Event Reminders and Gift Code alerts.</p>
      </div>
      <div style={{ maxWidth: 500, margin: '2rem auto', padding: mob ? '0 1rem' : '0 2rem' }}>
        <div style={{ backgroundColor: colors.surface, borderRadius: 16, border: `1px solid ${colors.border}`, padding: mob ? '1.25rem' : '1.75rem' }}>
          <h2 style={{ color: colors.text, fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem' }}>Register Your Server</h2>
          <p style={{ color: colors.textMuted, fontSize: '0.8rem', marginBottom: '1.25rem', lineHeight: 1.5 }}>
            Enter your Server ID. Atlas Bot must be in the server and you need <strong style={{ color: colors.text }}>Manage Server</strong> permission.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={lS}>SERVER ID</label>
              <input type="text" value={setupId} onChange={e => { setSetupId(e.target.value.replace(/\D/g, '')); setSetupErr(''); }} placeholder="e.g. 1234567890123456789" style={{ ...iS, maxWidth: '100%' }} />
            </div>
            <div>
              <label style={lS}>SERVER NAME <span style={{ fontWeight: 400, color: colors.textMuted }}>(auto-filled)</span></label>
              <input type="text" value={setupName} onChange={e => setSetupName(e.target.value)} placeholder="Auto-detected from Discord" style={{ ...iS, maxWidth: '100%' }} />
            </div>
            {setupErr && <div style={{ padding: '0.6rem 0.8rem', borderRadius: 8, backgroundColor: `${colors.error}15`, border: `1px solid ${colors.error}30`, color: colors.error, fontSize: '0.8rem' }}>{setupErr}</div>}
            <button onClick={verifyAndSetup} disabled={!setupId.trim() || verifying || saving}
              style={{ padding: '0.7rem', backgroundColor: setupId.trim() ? colors.primary : colors.border, border: 'none', borderRadius: 8, color: setupId.trim() ? colors.bg : colors.textMuted, fontWeight: 700, fontSize: '0.9rem', cursor: setupId.trim() ? 'pointer' : 'default' }}>
              {verifying ? 'Verifying permissions...' : saving ? 'Registering...' : 'Verify & Register'}
            </button>
          </div>
        </div>
        <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
          <Link to="/atlas-bot" style={{ color: colors.primary, textDecoration: 'none', fontSize: '0.8rem' }}>← Back to Atlas Bot</Link>
        </div>
      </div>
    </div>
  );

  // ─── Dashboard View ─────────────────────────────────────────────────────

  const activeEv = events.filter(e => e.enabled && e.time_slots.length > 0).length;
  const tabs: { id: DashTab; label: string; icon: string }[] = [
    { id: 'events', label: 'Events', icon: '⚔️' },
    { id: 'settings', label: 'Settings', icon: '⚙️' },
    { id: 'admins', label: 'Admins', icon: '👥' },
    { id: 'history', label: 'History', icon: '📋' },
  ];

  return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.bg }}>
      {toast && <div style={{ position: 'fixed', top: '1rem', right: '1rem', zIndex: 9999, padding: '0.6rem 1.2rem', borderRadius: 8, backgroundColor: toast.ok ? colors.success : colors.error, color: '#fff', fontSize: '0.85rem', fontWeight: 600, boxShadow: '0 4px 20px rgba(0,0,0,0.4)' }}>{toast.msg}</div>}

      {/* Header */}
      <div style={{ padding: mob ? '1.5rem 1rem 1rem' : '2rem 2rem 1.25rem', background: 'linear-gradient(180deg, #111 0%, #0a0a0a 100%)', borderBottom: `1px solid ${colors.borderSubtle}` }}>
        <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <img src="/AtlasBotAvatar.webp" alt="" style={{ width: 40, height: 40, borderRadius: '50%', border: '2px solid #22d3ee30' }} />
            <div>
              <h1 style={{ fontSize: mob ? '1.1rem' : '1.35rem', fontWeight: 'bold', fontFamily: FONT_DISPLAY, margin: 0 }}>
                <span style={{ color: '#fff' }}>BOT</span><span style={{ ...neonGlow('#22d3ee'), marginLeft: '0.35rem' }}>DASHBOARD</span>
              </h1>
              {guilds.length > 1 ? (
                <select value={selGuild || ''} onChange={e => setSelGuild(e.target.value)} style={{ backgroundColor: 'transparent', border: 'none', color: colors.textMuted, fontSize: '0.75rem', outline: 'none', cursor: 'pointer', padding: 0 }}>
                  {guilds.map(g => <option key={g.guild_id} value={g.guild_id}>{g.guild_name}</option>)}
                </select>
              ) : <p style={{ color: colors.textMuted, fontSize: '0.75rem', margin: 0 }}>{guild?.guild_name}</p>}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button onClick={() => setShowLocal(!showLocal)} style={{ color: colors.textMuted, fontSize: '0.7rem', padding: '0.35rem 0.6rem', borderRadius: 6, border: `1px solid ${colors.border}`, cursor: 'pointer', backgroundColor: showLocal ? `${colors.primary}15` : 'transparent' }}>{showLocal ? '🕐 Local' : '🌐 UTC'}</button>
            <Link to="/atlas-bot" style={{ color: colors.textMuted, textDecoration: 'none', fontSize: '0.75rem', padding: '0.4rem 0.7rem', borderRadius: 6, border: `1px solid ${colors.border}` }}>← Bot</Link>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: mob ? '1rem' : '1.5rem 2rem 2rem' }}>
        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: mob ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: '0.75rem', marginBottom: '1.25rem' }}>
          {[
            { l: 'Active Reminders', v: String(activeEv), c: colors.success },
            { l: 'Configured', v: `${events.filter(e => e.time_slots.length > 0).length}/4`, c: colors.primary },
            { l: 'Gift Codes', v: guild?.gift_code_alerts ? 'ON' : 'OFF', c: guild?.gift_code_alerts ? colors.success : colors.textMuted },
            { l: 'Admins', v: String(admins.length), c: colors.textMuted },
          ].map(s => (
            <div key={s.l} style={{ backgroundColor: colors.surface, borderRadius: 10, border: `1px solid ${colors.border}`, padding: '0.75rem', textAlign: 'center' }}>
              <div style={{ color: s.c, fontSize: '1.1rem', fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>{s.v}</div>
              <div style={{ color: colors.textMuted, fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', marginTop: '0.2rem' }}>{s.l}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1.25rem', borderBottom: `1px solid ${colors.border}` }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: mob ? '0.5rem 0.75rem' : '0.6rem 1rem', backgroundColor: tab === t.id ? colors.surface : 'transparent', border: 'none', borderBottom: `2px solid ${tab === t.id ? colors.primary : 'transparent'}`, color: tab === t.id ? colors.text : colors.textMuted, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', marginBottom: -1 }}>{t.icon} {t.label}</button>
          ))}
        </div>

        {/* Events Tab */}
        {tab === 'events' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <h2 style={{ color: colors.text, fontSize: mob ? '1rem' : '1.1rem', fontWeight: 700, margin: 0, fontFamily: FONT_DISPLAY }}>
                <span style={{ color: '#fff' }}>ALLIANCE</span><span style={{ ...neonGlow(colors.orange), marginLeft: '0.3rem' }}>EVENTS</span>
              </h2>
              <span style={{ color: colors.textMuted, fontSize: '0.7rem' }}>Auto-saves</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {events.map(ev => <EvCard key={ev.id} ev={ev} onUp={u => upEv(ev.id, u)} mob={mob} local={showLocal} />)}
              {events.length === 0 && <div style={{ backgroundColor: colors.surface, borderRadius: 12, border: `1px solid ${colors.border}`, padding: '2rem', textAlign: 'center', color: colors.textMuted, fontSize: '0.85rem' }}>No events configured. Try refreshing.</div>}
            </div>
          </div>
        )}

        {/* Settings Tab */}
        {tab === 'settings' && guild && (
          <div>
            <h2 style={{ color: colors.text, fontSize: mob ? '1rem' : '1.1rem', fontWeight: 700, marginBottom: '0.75rem', fontFamily: FONT_DISPLAY }}>
              <span style={{ color: '#fff' }}>GENERAL</span><span style={{ ...neonGlow(colors.primary), marginLeft: '0.3rem' }}>SETTINGS</span>
            </h2>
            <div style={{ backgroundColor: colors.surface, borderRadius: 12, border: `1px solid ${colors.border}`, padding: mob ? '1rem' : '1.25rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div><label style={lS}>DEFAULT REMINDER CHANNEL ID</label><input type="text" value={guild.reminder_channel_id || ''} onChange={e => upGuild({ reminder_channel_id: e.target.value || null })} placeholder="Right-click channel → Copy ID" style={iS} /></div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', backgroundColor: '#0f0f0f', borderRadius: 8, border: `1px solid ${colors.borderSubtle}` }}>
                  <div><div style={{ color: colors.text, fontSize: '0.85rem', fontWeight: 600 }}>🎁 Gift Code Alerts</div><div style={{ color: colors.textMuted, fontSize: '0.7rem', marginTop: '0.15rem' }}>Auto-post new gift codes</div></div>
                  <Tog on={guild.gift_code_alerts} set={v => upGuild({ gift_code_alerts: v })} c={colors.success} />
                </div>
                {guild.gift_code_alerts && <div><label style={lS}>GIFT CODE CHANNEL ID <span style={{ fontWeight: 400, color: colors.textMuted }}>(optional)</span></label><input type="text" value={guild.gift_code_channel_id || ''} onChange={e => upGuild({ gift_code_channel_id: e.target.value || null })} placeholder="Uses default channel" style={iS} /></div>}
              </div>
            </div>
            <div style={{ backgroundColor: colors.surface, borderRadius: 12, border: `1px solid ${colors.primary}20`, padding: mob ? '1rem' : '1.25rem', marginTop: '1.25rem', background: `linear-gradient(135deg, ${colors.surface} 0%, ${colors.primary}05 100%)` }}>
              <h3 style={{ color: colors.text, fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.6rem' }}>💡 How It Works</h3>
              <div style={{ display: 'grid', gridTemplateColumns: mob ? '1fr' : 'repeat(3,1fr)', gap: '0.75rem' }}>
                {[{ t: 'Set Times', d: 'Add event times (UTC).', i: '⏰' }, { t: 'Choose Channel', d: 'Set reminder channel.', i: '📢' }, { t: 'Get Reminded', d: 'Bot pings before events.', i: '🔔' }].map(x => (
                  <div key={x.t} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>{x.i}</span>
                    <div><div style={{ color: colors.text, fontSize: '0.8rem', fontWeight: 600 }}>{x.t}</div><div style={{ color: colors.textMuted, fontSize: '0.7rem', lineHeight: 1.4 }}>{x.d}</div></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Admins Tab */}
        {tab === 'admins' && guild && (
          <div>
            <h2 style={{ color: colors.text, fontSize: mob ? '1rem' : '1.1rem', fontWeight: 700, marginBottom: '0.75rem', fontFamily: FONT_DISPLAY }}>
              <span style={{ color: '#fff' }}>SERVER</span><span style={{ ...neonGlow('#a855f7'), marginLeft: '0.3rem' }}>ADMINS</span>
            </h2>
            <p style={{ color: colors.textMuted, fontSize: '0.8rem', marginBottom: '1rem' }}>Admins can edit reminders and settings. Only add users with <strong style={{ color: colors.text }}>Manage Server</strong> Discord permission.</p>
            <div style={{ backgroundColor: colors.surface, borderRadius: 12, border: `1px solid ${colors.border}`, padding: mob ? '1rem' : '1.25rem', marginBottom: '1rem' }}>
              <label style={lS}>ADD BY ATLAS USERNAME</label>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input type="text" value={adminInput} onChange={e => setAdminInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addAdmin(); }} placeholder="Atlas username" style={iS} />
                <button onClick={addAdmin} disabled={!adminInput.trim() || addingAdmin} style={{ padding: '0.5rem 1rem', backgroundColor: adminInput.trim() ? '#a855f7' : colors.border, border: 'none', borderRadius: 8, color: adminInput.trim() ? '#fff' : colors.textMuted, fontSize: '0.8rem', fontWeight: 600, cursor: adminInput.trim() ? 'pointer' : 'default', whiteSpace: 'nowrap' }}>{addingAdmin ? '...' : '+ Add'}</button>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {admins.map(a => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface, borderRadius: 10, border: `1px solid ${colors.border}`, padding: '0.75rem 1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '1rem' }}>{a.role === 'owner' ? '👑' : '🛡️'}</span>
                    <div><div style={{ color: colors.text, fontSize: '0.85rem', fontWeight: 600 }}>{a.username}</div><div style={{ color: colors.textMuted, fontSize: '0.65rem' }}>{a.role === 'owner' ? 'Owner' : 'Admin'} • {ago(a.created_at)}</div></div>
                  </div>
                  {a.role !== 'owner' && a.user_id !== user?.id && (
                    <button onClick={() => rmAdmin(a.id, a.user_id)} style={{ padding: '0.3rem 0.6rem', backgroundColor: 'transparent', border: `1px solid ${colors.error}40`, borderRadius: 6, color: colors.error, fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer' }}>Remove</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* History Tab */}
        {tab === 'history' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <h2 style={{ color: colors.text, fontSize: mob ? '1rem' : '1.1rem', fontWeight: 700, margin: 0, fontFamily: FONT_DISPLAY }}>
                <span style={{ color: '#fff' }}>REMINDER</span><span style={{ ...neonGlow(colors.success), marginLeft: '0.3rem' }}>HISTORY</span>
              </h2>
              <button onClick={() => { if (selGuild) loadHist(selGuild); }} style={{ color: colors.textMuted, fontSize: '0.7rem', padding: '0.3rem 0.6rem', borderRadius: 6, border: `1px solid ${colors.border}`, cursor: 'pointer', backgroundColor: 'transparent' }}>↻ Refresh</button>
            </div>
            {hist.length === 0 ? (
              <div style={{ backgroundColor: colors.surface, borderRadius: 12, border: `1px solid ${colors.border}`, padding: '2rem', textAlign: 'center', color: colors.textMuted, fontSize: '0.85rem' }}>No reminders sent yet. History appears after the first reminder fires.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {hist.map(h => {
                  const em = EVENT_META[h.event_type as EventType];
                  return (
                    <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', backgroundColor: colors.surface, borderRadius: 8, border: `1px solid ${colors.border}`, padding: '0.6rem 0.85rem' }}>
                      <span style={{ fontSize: '1rem' }}>{em?.icon || '📢'}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                          <span style={{ color: colors.text, fontSize: '0.8rem', fontWeight: 600 }}>{em?.label || h.event_type}</span>
                          <span style={{ fontSize: '0.6rem', fontWeight: 600, padding: '0.05rem 0.35rem', borderRadius: 3, backgroundColor: h.status === 'sent' ? `${colors.success}20` : `${colors.error}20`, color: h.status === 'sent' ? colors.success : colors.error }}>{h.status}</span>
                          {h.time_slot && <span style={{ color: colors.textMuted, fontSize: '0.7rem', fontFamily: "'JetBrains Mono', monospace" }}>{fmt(h.time_slot)} UTC</span>}
                        </div>
                        {h.error_message && <div style={{ color: colors.error, fontSize: '0.65rem', marginTop: '0.1rem' }}>{h.error_message}</div>}
                      </div>
                      <div style={{ color: colors.textMuted, fontSize: '0.65rem', whiteSpace: 'nowrap', flexShrink: 0 }}>{ago(h.sent_at)}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', paddingTop: '1.5rem', paddingBottom: '1rem' }}>
          <Link to="/atlas-bot" style={{ color: colors.primary, textDecoration: 'none', fontSize: '0.8rem' }}>← Atlas Bot</Link>
          <Link to="/tools" style={{ color: colors.textMuted, textDecoration: 'none', fontSize: '0.8rem' }}>All Tools</Link>
          <Link to="/" style={{ color: colors.textMuted, textDecoration: 'none', fontSize: '0.8rem' }}>Home</Link>
        </div>
      </div>
    </div>
  );
};

export default BotDashboard;
