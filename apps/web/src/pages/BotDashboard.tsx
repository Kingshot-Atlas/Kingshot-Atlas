import React, { useState, useEffect, useCallback } from 'react';
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
  created_at: string;
  updated_at: string;
}

type EventType = 'bear_hunt' | 'viking_vengeance' | 'swordland_showdown' | 'tri_alliance_clash';

interface TimeSlot {
  hour: number;
  minute: number;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const EVENT_META: Record<EventType, {
  label: string;
  icon: string;
  color: string;
  schedule: string;
  maxSlots: number;
  days: string;
}> = {
  bear_hunt: {
    label: 'Bear Hunt',
    icon: '🐻',
    color: '#f59e0b',
    schedule: 'Daily',
    maxSlots: 2,
    days: 'Every day',
  },
  viking_vengeance: {
    label: 'Viking Vengeance',
    icon: '⚔️',
    color: '#ef4444',
    schedule: 'Biweekly',
    maxSlots: 2,
    days: 'Tuesday & Thursday',
  },
  swordland_showdown: {
    label: 'Swordland Showdown',
    icon: '🗡️',
    color: '#a855f7',
    schedule: 'Biweekly',
    maxSlots: 2,
    days: 'Sunday',
  },
  tri_alliance_clash: {
    label: 'Tri-Alliance Clash',
    icon: '🛡️',
    color: '#3b82f6',
    schedule: 'Monthly',
    maxSlots: 2,
    days: 'Saturday',
  },
};

const REMINDER_OPTIONS = [5, 10, 15, 30, 60];

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatTime(slot: TimeSlot): string {
  return `${String(slot.hour).padStart(2, '0')}:${String(slot.minute).padStart(2, '0')}`;
}

function parseTime(str: string): TimeSlot | null {
  const parts = str.split(':');
  const h = parseInt(parts[0] || '', 10);
  const m = parseInt(parts[1] || '', 10);
  if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) return null;
  return { hour: h, minute: m };
}

// ─── Sub-Components ─────────────────────────────────────────────────────────

const StatusDot: React.FC<{ active: boolean }> = ({ active }) => (
  <div style={{
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: active ? colors.success : colors.textMuted,
    boxShadow: active ? `0 0 6px ${colors.success}` : 'none',
    flexShrink: 0,
  }} />
);

const Toggle: React.FC<{ enabled: boolean; onChange: (v: boolean) => void; color?: string }> = ({ enabled, onChange, color = colors.primary }) => (
  <button
    onClick={() => onChange(!enabled)}
    style={{
      width: '44px',
      height: '24px',
      borderRadius: '12px',
      border: 'none',
      backgroundColor: enabled ? color : '#333',
      position: 'relative',
      cursor: 'pointer',
      transition: 'background-color 0.2s',
      flexShrink: 0,
    }}
  >
    <div style={{
      width: '18px',
      height: '18px',
      borderRadius: '50%',
      backgroundColor: '#fff',
      position: 'absolute',
      top: '3px',
      left: enabled ? '23px' : '3px',
      transition: 'left 0.2s',
    }} />
  </button>
);

interface TimeSlotEditorProps {
  slots: TimeSlot[];
  maxSlots: number;
  onChange: (slots: TimeSlot[]) => void;
  color: string;
}

const TimeSlotEditor: React.FC<TimeSlotEditorProps> = ({ slots, maxSlots, onChange, color }) => {
  const [editValue, setEditValue] = useState('');

  const addSlot = () => {
    const parsed = parseTime(editValue);
    if (!parsed || slots.length >= maxSlots) return;
    if (slots.some(s => s.hour === parsed.hour && s.minute === parsed.minute)) return;
    onChange([...slots, parsed].sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute)));
    setEditValue('');
  };

  const removeSlot = (idx: number) => {
    onChange(slots.filter((_, i) => i !== idx));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
        {slots.map((slot, idx) => (
          <div key={idx} style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.3rem',
            padding: '0.3rem 0.6rem',
            backgroundColor: `${color}15`,
            border: `1px solid ${color}40`,
            borderRadius: '6px',
            fontSize: '0.85rem',
            fontFamily: "'JetBrains Mono', monospace",
            color: color,
            fontWeight: 600,
          }}>
            {formatTime(slot)} UTC
            <button
              onClick={() => removeSlot(idx)}
              style={{
                background: 'none',
                border: 'none',
                color: colors.textMuted,
                cursor: 'pointer',
                fontSize: '0.75rem',
                padding: '0 0.15rem',
                lineHeight: 1,
              }}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      {slots.length < maxSlots && (
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          <input
            type="time"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addSlot(); }}
            style={{
              backgroundColor: '#1a1a1a',
              border: `1px solid ${colors.border}`,
              borderRadius: '6px',
              color: colors.text,
              padding: '0.35rem 0.5rem',
              fontSize: '0.8rem',
              fontFamily: "'JetBrains Mono', monospace",
              outline: 'none',
              width: '110px',
            }}
          />
          <button
            onClick={addSlot}
            disabled={!editValue}
            style={{
              padding: '0.35rem 0.75rem',
              backgroundColor: editValue ? color : colors.border,
              border: 'none',
              borderRadius: '6px',
              color: editValue ? '#fff' : colors.textMuted,
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: editValue ? 'pointer' : 'default',
              transition: 'all 0.2s',
            }}
          >
            + Add
          </button>
          <span style={{ color: colors.textMuted, fontSize: '0.7rem' }}>UTC</span>
        </div>
      )}
    </div>
  );
};

interface EventCardProps {
  event: AllianceEvent;
  onUpdate: (updates: Partial<AllianceEvent>) => void;
  isMobile: boolean;
}

const EventCard: React.FC<EventCardProps> = ({ event, onUpdate, isMobile }) => {
  const meta = EVENT_META[event.event_type];
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={{
      backgroundColor: colors.surface,
      borderRadius: '12px',
      border: `1px solid ${event.enabled ? `${meta.color}30` : colors.border}`,
      overflow: 'hidden',
      transition: 'border-color 0.2s',
    }}>
      {/* Header */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: isMobile ? '0.85rem' : '1rem 1.25rem',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: isMobile ? '1.25rem' : '1.5rem' }}>{meta.icon}</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span style={{ color: colors.text, fontWeight: 700, fontSize: isMobile ? '0.9rem' : '0.95rem' }}>
                {meta.label}
              </span>
              <span style={{
                fontSize: '0.6rem',
                fontWeight: 600,
                color: meta.color,
                backgroundColor: `${meta.color}15`,
                padding: '0.1rem 0.4rem',
                borderRadius: '3px',
                textTransform: 'uppercase',
                letterSpacing: '0.03em',
              }}>
                {meta.schedule}
              </span>
            </div>
            <div style={{ color: colors.textMuted, fontSize: '0.7rem', marginTop: '0.15rem' }}>
              {meta.days}
              {event.time_slots.length > 0 && (
                <span style={{ color: meta.color, marginLeft: '0.4rem' }}>
                  • {event.time_slots.map(formatTime).join(', ')} UTC
                </span>
              )}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <StatusDot active={event.enabled && event.time_slots.length > 0} />
          <Toggle enabled={event.enabled} onChange={(v) => onUpdate({ enabled: v })} color={meta.color} />
          <span style={{
            color: colors.textMuted,
            fontSize: '0.8rem',
            transition: 'transform 0.2s',
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
          }}>
            ▼
          </span>
        </div>
      </div>

      {/* Expanded Config */}
      {expanded && (
        <div style={{
          padding: isMobile ? '0 0.85rem 0.85rem' : '0 1.25rem 1.25rem',
          borderTop: `1px solid ${colors.borderSubtle}`,
          paddingTop: '1rem',
        }}>
          {/* Time Slots */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ color: colors.textSecondary, fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>
              TIME SLOTS ({event.time_slots.length}/{meta.maxSlots})
            </label>
            <TimeSlotEditor
              slots={event.time_slots}
              maxSlots={meta.maxSlots}
              onChange={(slots) => onUpdate({ time_slots: slots })}
              color={meta.color}
            />
          </div>

          {/* Reminder Minutes */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ color: colors.textSecondary, fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>
              REMIND BEFORE
            </label>
            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
              {REMINDER_OPTIONS.map((mins) => (
                <button
                  key={mins}
                  onClick={() => onUpdate({ reminder_minutes_before: mins })}
                  style={{
                    padding: '0.3rem 0.6rem',
                    borderRadius: '6px',
                    border: `1px solid ${event.reminder_minutes_before === mins ? meta.color : colors.border}`,
                    backgroundColor: event.reminder_minutes_before === mins ? `${meta.color}15` : 'transparent',
                    color: event.reminder_minutes_before === mins ? meta.color : colors.textMuted,
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {mins}m
                </button>
              ))}
            </div>
          </div>

          {/* Channel Override */}
          <div style={{ marginBottom: '0.75rem' }}>
            <label style={{ color: colors.textSecondary, fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>
              CHANNEL ID <span style={{ fontWeight: 400, color: colors.textMuted }}>(optional override)</span>
            </label>
            <input
              type="text"
              value={event.channel_id || ''}
              onChange={(e) => onUpdate({ channel_id: e.target.value || null })}
              placeholder="Uses default reminder channel"
              style={{
                width: '100%',
                maxWidth: '280px',
                backgroundColor: '#1a1a1a',
                border: `1px solid ${colors.border}`,
                borderRadius: '6px',
                color: colors.text,
                padding: '0.4rem 0.6rem',
                fontSize: '0.8rem',
                outline: 'none',
              }}
            />
          </div>

          {/* Role to Mention */}
          <div>
            <label style={{ color: colors.textSecondary, fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>
              ROLE ID TO MENTION <span style={{ fontWeight: 400, color: colors.textMuted }}>(optional)</span>
            </label>
            <input
              type="text"
              value={event.role_id || ''}
              onChange={(e) => onUpdate({ role_id: e.target.value || null })}
              placeholder="e.g. 123456789012345678"
              style={{
                width: '100%',
                maxWidth: '280px',
                backgroundColor: '#1a1a1a',
                border: `1px solid ${colors.border}`,
                borderRadius: '6px',
                color: colors.text,
                padding: '0.4rem 0.6rem',
                fontSize: '0.8rem',
                outline: 'none',
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Main Component ─────────────────────────────────────────────────────────

const BotDashboard: React.FC = () => {
  useDocumentTitle('Bot Dashboard — Atlas');
  const { user, profile } = useAuth();
  const isMobile = useIsMobile();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [guild, setGuild] = useState<GuildSettings | null>(null);
  const [events, setEvents] = useState<AllianceEvent[]>([]);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // Setup form
  const [setupGuildId, setSetupGuildId] = useState('');
  const [setupGuildName, setSetupGuildName] = useState('');

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ─── Data Loading ───────────────────────────────────────────────────────

  const loadGuildData = useCallback(async () => {
    if (!supabase || !user) return;
    setLoading(true);
    try {
      // Fetch guilds user is admin of
      const { data: adminRows } = await supabase
        .from('bot_guild_admins')
        .select('guild_id')
        .eq('user_id', user.id);

      if (!adminRows || adminRows.length === 0) {
        // Check if user created any guild directly
        const { data: ownedGuilds } = await supabase
          .from('bot_guild_settings')
          .select('*')
          .eq('created_by', user.id)
          .limit(1);

        if (ownedGuilds && ownedGuilds.length > 0) {
          setGuild(ownedGuilds[0]);
          await loadEvents(ownedGuilds[0].guild_id);
        }
        setLoading(false);
        return;
      }

      const guildId = adminRows[0]?.guild_id;
      if (!guildId) { setLoading(false); return; }
      const { data: guildData } = await supabase
        .from('bot_guild_settings')
        .select('*')
        .eq('guild_id', guildId)
        .single();

      if (guildData) {
        setGuild(guildData);
        await loadEvents(guildData.guild_id);
      }
    } catch (err) {
      console.error('Failed to load guild data:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const loadEvents = async (guildId: string) => {
    if (!supabase) return;
    const { data } = await supabase
      .from('bot_alliance_events')
      .select('*')
      .eq('guild_id', guildId)
      .order('event_type');

    if (data) setEvents(data);
  };

  useEffect(() => {
    loadGuildData();
  }, [loadGuildData]);

  // ─── Setup Guild ────────────────────────────────────────────────────────

  const handleSetup = async () => {
    if (!supabase || !user || !setupGuildId.trim() || !setupGuildName.trim()) return;
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('bot_guild_settings')
        .insert({
          guild_id: setupGuildId.trim(),
          guild_name: setupGuildName.trim(),
          created_by: user.id,
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          showToast('This server is already registered.', 'error');
        } else {
          showToast(error.message, 'error');
        }
        return;
      }

      setGuild(data);
      await loadEvents(data.guild_id);
      showToast('Server registered successfully!');
    } catch (err) {
      showToast('Failed to register server', 'error');
    } finally {
      setSaving(false);
    }
  };

  // ─── Update Event ───────────────────────────────────────────────────────

  const handleEventUpdate = async (eventId: string, updates: Partial<AllianceEvent>) => {
    if (!supabase) return;

    // Optimistic update
    setEvents(prev => prev.map(e => e.id === eventId ? { ...e, ...updates } : e));

    const { error } = await supabase
      .from('bot_alliance_events')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', eventId);

    if (error) {
      showToast('Failed to save', 'error');
      if (guild) loadEvents(guild.guild_id); // Revert
    }
  };

  // ─── Update Guild Settings ──────────────────────────────────────────────

  const handleGuildUpdate = async (updates: Partial<GuildSettings>) => {
    if (!supabase || !guild) return;

    setGuild(prev => prev ? { ...prev, ...updates } : prev);

    const { error } = await supabase
      .from('bot_guild_settings')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', guild.id);

    if (error) {
      showToast('Failed to save', 'error');
      loadGuildData();
    }
  };

  // Changes save automatically via optimistic updates

  // ─── Auth Gate ──────────────────────────────────────────────────────────

  if (!user) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: colors.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div style={{ textAlign: 'center', maxWidth: '400px' }}>
          <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>🔒</span>
          <h2 style={{ color: colors.text, fontSize: '1.25rem', marginBottom: '0.5rem', fontFamily: FONT_DISPLAY }}>
            Sign In Required
          </h2>
          <p style={{ color: colors.textSecondary, fontSize: '0.85rem', marginBottom: '1.5rem', lineHeight: 1.6 }}>
            Sign in with your Atlas account to manage your Discord server's bot settings.
          </p>
          <Link
            to="/profile"
            style={{
              display: 'inline-block',
              padding: '0.7rem 1.5rem',
              backgroundColor: colors.primary,
              color: colors.bg,
              borderRadius: '8px',
              textDecoration: 'none',
              fontWeight: 600,
              fontSize: '0.9rem',
            }}
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  if (!profile?.discord_id) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: colors.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div style={{ textAlign: 'center', maxWidth: '450px' }}>
          <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>🔗</span>
          <h2 style={{ color: colors.text, fontSize: '1.25rem', marginBottom: '0.5rem', fontFamily: FONT_DISPLAY }}>
            Link Your Discord
          </h2>
          <p style={{ color: colors.textSecondary, fontSize: '0.85rem', marginBottom: '1.5rem', lineHeight: 1.6 }}>
            To manage bot settings, you need to link your Discord account first. Go to your profile and connect Discord.
          </p>
          <Link
            to="/profile"
            style={{
              display: 'inline-block',
              padding: '0.7rem 1.5rem',
              backgroundColor: colors.discord,
              color: '#fff',
              borderRadius: '8px',
              textDecoration: 'none',
              fontWeight: 600,
              fontSize: '0.9rem',
            }}
          >
            Go to Profile
          </Link>
        </div>
      </div>
    );
  }

  // ─── Loading ────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: colors.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.75rem', animation: 'pulse 1.5s infinite' }}>⚙️</div>
          <p style={{ color: colors.textMuted, fontSize: '0.85rem' }}>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // ─── Setup View ─────────────────────────────────────────────────────────

  if (!guild) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: colors.bg }}>
        {/* Header */}
        <div style={{
          padding: isMobile ? '2rem 1rem 1rem' : '2.5rem 2rem 1.5rem',
          textAlign: 'center',
          background: 'linear-gradient(180deg, #111111 0%, #0a0a0a 100%)',
        }}>
          <img
            src="/AtlasBotAvatar.webp"
            alt="Atlas Bot"
            style={{ width: '64px', height: '64px', borderRadius: '50%', margin: '0 auto 1rem', display: 'block', border: '2px solid #22d3ee30' }}
          />
          <h1 style={{ fontSize: isMobile ? '1.5rem' : '2rem', fontWeight: 'bold', marginBottom: '0.5rem', fontFamily: FONT_DISPLAY }}>
            <span style={{ color: '#fff' }}>BOT</span>
            <span style={{ ...neonGlow('#22d3ee'), marginLeft: '0.4rem' }}>DASHBOARD</span>
          </h1>
          <p style={{ color: colors.textSecondary, fontSize: isMobile ? '0.85rem' : '0.95rem', maxWidth: '500px', margin: '0 auto' }}>
            Manage Alliance Event Reminders and Gift Code alerts for your Discord server.
          </p>
        </div>

        {/* Setup Form */}
        <div style={{ maxWidth: '500px', margin: '2rem auto', padding: isMobile ? '0 1rem' : '0 2rem' }}>
          <div style={{
            backgroundColor: colors.surface,
            borderRadius: '16px',
            border: `1px solid ${colors.border}`,
            padding: isMobile ? '1.25rem' : '1.75rem',
          }}>
            <h2 style={{ color: colors.text, fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem' }}>
              Register Your Server
            </h2>
            <p style={{ color: colors.textMuted, fontSize: '0.8rem', marginBottom: '1.25rem', lineHeight: 1.5 }}>
              Enter your Discord server details to get started. You'll need your Server ID (enable Developer Mode in Discord Settings → Advanced).
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ color: colors.textSecondary, fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>
                  SERVER ID
                </label>
                <input
                  type="text"
                  value={setupGuildId}
                  onChange={(e) => setSetupGuildId(e.target.value.replace(/\D/g, ''))}
                  placeholder="e.g. 1234567890123456789"
                  style={{
                    width: '100%',
                    backgroundColor: '#1a1a1a',
                    border: `1px solid ${colors.border}`,
                    borderRadius: '8px',
                    color: colors.text,
                    padding: '0.6rem 0.8rem',
                    fontSize: '0.85rem',
                    fontFamily: "'JetBrains Mono', monospace",
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ color: colors.textSecondary, fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>
                  SERVER NAME
                </label>
                <input
                  type="text"
                  value={setupGuildName}
                  onChange={(e) => setSetupGuildName(e.target.value)}
                  placeholder="e.g. Kingdom 172 Official"
                  style={{
                    width: '100%',
                    backgroundColor: '#1a1a1a',
                    border: `1px solid ${colors.border}`,
                    borderRadius: '8px',
                    color: colors.text,
                    padding: '0.6rem 0.8rem',
                    fontSize: '0.85rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <button
                onClick={handleSetup}
                disabled={!setupGuildId.trim() || !setupGuildName.trim() || saving}
                style={{
                  padding: '0.7rem',
                  backgroundColor: setupGuildId.trim() && setupGuildName.trim() ? colors.primary : colors.border,
                  border: 'none',
                  borderRadius: '8px',
                  color: setupGuildId.trim() && setupGuildName.trim() ? colors.bg : colors.textMuted,
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  cursor: setupGuildId.trim() && setupGuildName.trim() ? 'pointer' : 'default',
                  transition: 'all 0.2s',
                }}
              >
                {saving ? 'Registering...' : 'Register Server'}
              </button>
            </div>
          </div>

          <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
            <Link to="/atlas-bot" style={{ color: colors.primary, textDecoration: 'none', fontSize: '0.8rem' }}>
              ← Back to Atlas Bot
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ─── Dashboard View ─────────────────────────────────────────────────────

  const activeEvents = events.filter(e => e.enabled && e.time_slots.length > 0).length;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.bg }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed',
          top: '1rem',
          right: '1rem',
          zIndex: 9999,
          padding: '0.6rem 1.2rem',
          borderRadius: '8px',
          backgroundColor: toast.type === 'success' ? colors.success : colors.error,
          color: '#fff',
          fontSize: '0.85rem',
          fontWeight: 600,
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
          animation: 'fadeIn 0.2s ease',
        }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{
        padding: isMobile ? '1.5rem 1rem 1rem' : '2rem 2rem 1.25rem',
        background: 'linear-gradient(180deg, #111111 0%, #0a0a0a 100%)',
        borderBottom: `1px solid ${colors.borderSubtle}`,
      }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <img src="/AtlasBotAvatar.webp" alt="Atlas Bot" style={{ width: '40px', height: '40px', borderRadius: '50%', border: '2px solid #22d3ee30' }} />
              <div>
                <h1 style={{ fontSize: isMobile ? '1.1rem' : '1.35rem', fontWeight: 'bold', fontFamily: FONT_DISPLAY, margin: 0 }}>
                  <span style={{ color: '#fff' }}>BOT</span>
                  <span style={{ ...neonGlow('#22d3ee'), marginLeft: '0.35rem' }}>DASHBOARD</span>
                </h1>
                <p style={{ color: colors.textMuted, fontSize: '0.75rem', margin: 0 }}>
                  {guild.guild_name}
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Link to="/atlas-bot" style={{ color: colors.textMuted, textDecoration: 'none', fontSize: '0.75rem', padding: '0.4rem 0.7rem', borderRadius: '6px', border: `1px solid ${colors.border}`, transition: 'all 0.15s' }}>
                ← Bot Page
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: isMobile ? '1rem' : '1.5rem 2rem 2rem' }}>

        {/* Status Strip */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
          gap: '0.75rem',
          marginBottom: '1.5rem',
        }}>
          {[
            { label: 'Active Reminders', value: String(activeEvents), color: colors.success },
            { label: 'Events Configured', value: `${events.filter(e => e.time_slots.length > 0).length}/4`, color: colors.primary },
            { label: 'Gift Code Alerts', value: guild.gift_code_alerts ? 'ON' : 'OFF', color: guild.gift_code_alerts ? colors.success : colors.textMuted },
            { label: 'Server ID', value: guild.guild_id.slice(-6), color: colors.textMuted },
          ].map((stat) => (
            <div key={stat.label} style={{
              backgroundColor: colors.surface,
              borderRadius: '10px',
              border: `1px solid ${colors.border}`,
              padding: '0.75rem',
              textAlign: 'center',
            }}>
              <div style={{ color: stat.color, fontSize: '1.1rem', fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>
                {stat.value}
              </div>
              <div style={{ color: colors.textMuted, fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', marginTop: '0.2rem' }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* Alliance Events Section */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <h2 style={{ color: colors.text, fontSize: isMobile ? '1rem' : '1.1rem', fontWeight: 700, margin: 0, fontFamily: FONT_DISPLAY }}>
              <span style={{ color: '#fff' }}>ALLIANCE</span>
              <span style={{ ...neonGlow(colors.orange), marginLeft: '0.3rem' }}>EVENTS</span>
            </h2>
            <span style={{ color: colors.textMuted, fontSize: '0.7rem' }}>
              Click to expand • Changes save automatically
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {events.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                onUpdate={(updates) => handleEventUpdate(event.id, updates)}
                isMobile={isMobile}
              />
            ))}
            {events.length === 0 && (
              <div style={{
                backgroundColor: colors.surface,
                borderRadius: '12px',
                border: `1px solid ${colors.border}`,
                padding: '2rem',
                textAlign: 'center',
                color: colors.textMuted,
                fontSize: '0.85rem',
              }}>
                No events configured. This shouldn't happen — try refreshing.
              </div>
            )}
          </div>
        </div>

        {/* General Settings Section */}
        <div style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ color: colors.text, fontSize: isMobile ? '1rem' : '1.1rem', fontWeight: 700, marginBottom: '0.75rem', fontFamily: FONT_DISPLAY }}>
            <span style={{ color: '#fff' }}>GENERAL</span>
            <span style={{ ...neonGlow(colors.primary), marginLeft: '0.3rem' }}>SETTINGS</span>
          </h2>

          <div style={{
            backgroundColor: colors.surface,
            borderRadius: '12px',
            border: `1px solid ${colors.border}`,
            padding: isMobile ? '1rem' : '1.25rem',
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Default Reminder Channel */}
              <div>
                <label style={{ color: colors.textSecondary, fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>
                  DEFAULT REMINDER CHANNEL ID
                </label>
                <input
                  type="text"
                  value={guild.reminder_channel_id || ''}
                  onChange={(e) => handleGuildUpdate({ reminder_channel_id: e.target.value || null })}
                  placeholder="Right-click channel → Copy Channel ID"
                  style={{
                    width: '100%',
                    maxWidth: '320px',
                    backgroundColor: '#1a1a1a',
                    border: `1px solid ${colors.border}`,
                    borderRadius: '8px',
                    color: colors.text,
                    padding: '0.5rem 0.7rem',
                    fontSize: '0.8rem',
                    fontFamily: "'JetBrains Mono', monospace",
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Gift Code Alerts */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.75rem',
                backgroundColor: '#0f0f0f',
                borderRadius: '8px',
                border: `1px solid ${colors.borderSubtle}`,
              }}>
                <div>
                  <div style={{ color: colors.text, fontSize: '0.85rem', fontWeight: 600 }}>
                    🎁 Gift Code Alerts
                  </div>
                  <div style={{ color: colors.textMuted, fontSize: '0.7rem', marginTop: '0.15rem' }}>
                    Automatically post new gift codes when detected
                  </div>
                </div>
                <Toggle
                  enabled={guild.gift_code_alerts}
                  onChange={(v) => handleGuildUpdate({ gift_code_alerts: v })}
                  color={colors.success}
                />
              </div>

              {/* Gift Code Channel */}
              {guild.gift_code_alerts && (
                <div>
                  <label style={{ color: colors.textSecondary, fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>
                    GIFT CODE CHANNEL ID <span style={{ fontWeight: 400, color: colors.textMuted }}>(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={guild.gift_code_channel_id || ''}
                    onChange={(e) => handleGuildUpdate({ gift_code_channel_id: e.target.value || null })}
                    placeholder="Uses default reminder channel"
                    style={{
                      width: '100%',
                      maxWidth: '320px',
                      backgroundColor: '#1a1a1a',
                      border: `1px solid ${colors.border}`,
                      borderRadius: '8px',
                      color: colors.text,
                      padding: '0.5rem 0.7rem',
                      fontSize: '0.8rem',
                      fontFamily: "'JetBrains Mono', monospace",
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* How It Works */}
        <div style={{
          backgroundColor: colors.surface,
          borderRadius: '12px',
          border: `1px solid ${colors.primary}20`,
          padding: isMobile ? '1rem' : '1.25rem',
          marginBottom: '1.5rem',
          background: `linear-gradient(135deg, ${colors.surface} 0%, ${colors.primary}05 100%)`,
        }}>
          <h3 style={{ color: colors.text, fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.6rem' }}>
            💡 How It Works
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '0.75rem' }}>
            {[
              { step: '1', title: 'Set Times', desc: 'Add your alliance\'s event times in UTC.', icon: '⏰' },
              { step: '2', title: 'Choose Channel', desc: 'Set the channel where reminders go.', icon: '📢' },
              { step: '3', title: 'Get Reminded', desc: 'Atlas Bot pings before each event.', icon: '🔔' },
            ].map((item) => (
              <div key={item.step} style={{
                display: 'flex',
                gap: '0.5rem',
                alignItems: 'flex-start',
              }}>
                <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>{item.icon}</span>
                <div>
                  <div style={{ color: colors.text, fontSize: '0.8rem', fontWeight: 600 }}>{item.title}</div>
                  <div style={{ color: colors.textMuted, fontSize: '0.7rem', lineHeight: 1.4 }}>{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer Links */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '1.5rem',
          paddingBottom: '1rem',
        }}>
          <Link to="/atlas-bot" style={{ color: colors.primary, textDecoration: 'none', fontSize: '0.8rem' }}>
            ← Atlas Bot
          </Link>
          <Link to="/tools" style={{ color: colors.textMuted, textDecoration: 'none', fontSize: '0.8rem' }}>
            All Tools
          </Link>
          <Link to="/" style={{ color: colors.textMuted, textDecoration: 'none', fontSize: '0.8rem' }}>
            Home
          </Link>
        </div>
      </div>
    </div>
  );
};

export default BotDashboard;
