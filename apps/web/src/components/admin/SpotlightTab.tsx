import React, { useState, useEffect, useCallback, useRef } from 'react';
import { colors } from '../../utils/styles';
import { getAuthHeaders } from '../../services/authHeaders';
import { supabase } from '../../lib/supabase';
import { useIsMobile } from '../../hooks/useMediaQuery';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
const SPOTLIGHT_AVATAR = 'https://ks-atlas.com/AtlasBotAvatar.webp';
const SPOTLIGHT_NAME = 'Atlas';

type SpotlightReason = 'supporter' | 'ambassador' | 'booster';

const REASON_CONFIG: Record<SpotlightReason, { label: string; emoji: string; color: string }> = {
  supporter: { label: 'Became a Supporter', emoji: '💎', color: '#22d3ee' },
  ambassador: { label: 'Became an Ambassador', emoji: '🏛️', color: '#a855f7' },
  booster: { label: 'Boosted the Server', emoji: '🚀', color: '#f472b6' },
};

const SUPPORTER_MESSAGES = [
  "🎉 A new legend rises! {user} just became an **Atlas Supporter**! Your belief in this community fuels everything we build. From the bottom of our hearts — thank you. 💎",
  "⚡ {user} just leveled up to **Atlas Supporter**! Every kingdom, every score, every feature — you make it possible. We don't take that for granted. Thank you! 💎",
  "🌟 Shoutout to {user} for becoming an **Atlas Supporter**! You're not just supporting a tool — you're investing in the competitive Kingshot community. That means the world. 💎",
  "💎 {user} has joined the ranks of **Atlas Supporters**! The intelligence gets stronger, the tools get sharper — all because of people like you. Thank you for believing in Atlas!",
  "🏆 Big moment! {user} just subscribed as an **Atlas Supporter**! Your contribution keeps this community-powered project alive and growing. We salute you! 💎",
  "✨ Welcome to the Supporter family, {user}! Your support means more kingdoms tracked, better tools, and a stronger community. Atlas wouldn't be Atlas without you. 💎",
  "🔥 {user} just unlocked **Atlas Supporter** status! You're powering the tools that thousands of players rely on every day. That's legendary. Thank you! 💎",
  "💪 The Atlas army grows stronger! {user} just joined as an **Atlas Supporter**. Your backing keeps the scoreboard running and the data flowing. We appreciate you! 💎",
  "🎯 {user} has stepped up as an **Atlas Supporter**! You're the reason we can keep building the best kingdom intelligence out there. Massive respect. 💎",
  "⭐ A new Supporter enters the arena! {user}, your contribution goes straight into making Atlas better for every player. From all of us — thank you! 💎",
  "🛡️ {user} just became an **Atlas Supporter** and joined the backbone of this community! Every feature, every update — you make it happen. Thank you for standing with us! 💎",
  "🌍 {user} is now an **Atlas Supporter**! You're helping build the #1 intelligence platform for competitive Kingshot players worldwide. That's something to be proud of. 💎",
];

const AMBASSADOR_MESSAGES = [
  "🏛️ {user} has earned the title of **Atlas Ambassador**! By spreading the word and bringing players into the fold, you've proven yourself a true champion of this community. 🙌",
  "⚡ A new **Ambassador** has emerged! {user} has been rallying players and building bridges across kingdoms. Your referrals strengthen us all. Thank you! 🏛️",
  "🌟 Hats off to {user} — our newest **Atlas Ambassador**! You didn't just join the community, you grew it. That kind of dedication doesn't go unnoticed. 🏛️",
  "🏛️ {user} just unlocked **Ambassador** status! Every player you've brought to Atlas makes our intelligence network stronger. You're a legend. Keep building! 💜",
  "🎉 The Atlas community grows thanks to people like {user}, our newest **Ambassador**! Your referrals bring kingdoms together and make everyone's experience richer. 🏛️",
  "👑 {user} has been crowned an **Atlas Ambassador**! Your dedication to growing this community is unmatched. Twenty referrals and counting — you're a force of nature! 🏛️",
  "🔥 From player to legend — {user} just became an **Atlas Ambassador**! You've brought an incredible number of players into the fold. The community salutes you! 🏛️",
  "💜 {user} is now officially an **Atlas Ambassador**! Your tireless work spreading the word about Atlas has made a real difference. We couldn't do this without you. 🏛️",
  "🏛️ Bow before {user}, our newest **Atlas Ambassador**! You've proven that one person truly can grow a community. Your referrals are legendary. 👏",
  "🌍 {user} just reached **Ambassador** tier! By connecting players across kingdoms, you've helped build something bigger than any one kingdom. Thank you, Ambassador! 🏛️",
  "⭐ {user} has achieved **Atlas Ambassador** status! Your passion for this community shines through every referral. We're honored to have you leading the charge! 🏛️",
  "🎯 The network expands! {user} just became an **Atlas Ambassador** through pure dedication and community spirit. You're an inspiration to us all. 🏛️",
];

const BOOSTER_MESSAGES = [
  "🚀 {user} just **boosted** the Atlas Discord server! You're literally powering up our community hub. That's next-level support — thank you! 💖",
  "✨ Server boost incoming! {user} just gave the Atlas Discord a boost! Better quality, better emojis, better everything — all thanks to you. 🚀",
  "🎉 {user} dropped a **server boost** on the Atlas Discord! You're making this community shine brighter. We see you, we appreciate you! 🚀💖",
  "💖 Big thanks to {user} for **boosting** our Discord server! Every boost makes this space better for hundreds of competitive players. You're a real one! 🚀",
  "🚀 The Atlas Discord just got an upgrade! {user} boosted the server — better audio, better streams, better vibes for everyone. Thank you! 💖",
  "⚡ {user} just boosted the Atlas server! Higher quality voice channels, more emoji slots, and a bigger upload limit — all because of you. Thank you! 🚀",
  "🌟 A wild **server boost** appeared! {user} just powered up the Atlas Discord. You're the MVP of community vibes! 🚀💖",
  "💎 {user} just dropped a boost on the Atlas Discord! That's the kind of energy that makes this community special. We appreciate you! 🚀",
  "🔥 Server boost alert! {user} just made the Atlas Discord even better. More features, more fun, more competitive spirit. Thank you! 🚀💖",
  "🏆 {user} boosted the Atlas Discord and leveled up our whole community! Better streaming, better emotes, better everything. You rock! 🚀",
];

const MESSAGE_POOLS: Record<SpotlightReason, string[]> = {
  supporter: SUPPORTER_MESSAGES,
  ambassador: AMBASSADOR_MESSAGES,
  booster: BOOSTER_MESSAGES,
};

const getRandomMessage = (reason: SpotlightReason, discordUsername: string, discordUserId: string): string => {
  const pool = MESSAGE_POOLS[reason];
  const idx = Math.floor(Math.random() * pool.length);
  const template = pool[idx] ?? pool[0] ?? '';
  const mention = discordUserId.trim() ? `<@${discordUserId.trim()}>` : `**${discordUsername}**`;
  return template.replace(/\{user\}/g, mention);
};

interface SpotlightHistoryEntry {
  id: string;
  discord_username: string | null;
  discord_user_id: string | null;
  reason: string;
  message: string;
  auto_triggered: boolean;
  status: string;
  created_at: string;
  sent_at: string | null;
}

type SpotlightMode = 'template' | 'custom';
type TabView = 'compose' | 'history' | 'pending';

export const SpotlightTab: React.FC = () => {
  const isMobile = useIsMobile();
  const [tabView, setTabView] = useState<TabView>('compose');
  const [mode, setMode] = useState<SpotlightMode>('template');
  const [discordUsername, setDiscordUsername] = useState('');
  const [discordUserId, setDiscordUserId] = useState('');
  const [reason, setReason] = useState<SpotlightReason>('supporter');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [preview, setPreview] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [history, setHistory] = useState<SpotlightHistoryEntry[]>([]);
  const [pendingSpotlights, setPendingSpotlights] = useState<SpotlightHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const lookupTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const fetchHistory = useCallback(async () => {
    if (!supabase) return;
    setHistoryLoading(true);
    try {
      const { data } = await supabase
        .from('spotlight_history')
        .select('*')
        .in('status', ['sent', 'failed'])
        .order('created_at', { ascending: false })
        .limit(50);
      setHistory(data || []);
    } catch { /* ignore */ }
    setHistoryLoading(false);
  }, []);

  const fetchPending = useCallback(async () => {
    if (!supabase) return;
    try {
      const { data } = await supabase
        .from('spotlight_history')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      setPendingSpotlights(data || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchHistory();
    fetchPending();
  }, [fetchHistory, fetchPending]);

  const lookupDiscordId = useCallback(async (username: string) => {
    if (!supabase || !username.trim() || username.trim().length < 2) {
      setDiscordUserId('');
      return;
    }
    setLookupLoading(true);
    try {
      const cleanName = username.replace(/^@/, '').trim();
      const { data } = await supabase
        .from('profiles')
        .select('discord_id, discord_username')
        .or(`discord_username.ilike.%${cleanName}%,username.ilike.%${cleanName}%,display_name.ilike.%${cleanName}%`)
        .not('discord_id', 'is', null)
        .limit(1);
      const match = data?.[0];
      if (match?.discord_id) {
        setDiscordUserId(match.discord_id);
      }
    } catch { /* ignore */ }
    setLookupLoading(false);
  }, []);

  const handleUsernameChange = (value: string) => {
    setDiscordUsername(value);
    setPreview('');
    if (lookupTimeout.current) clearTimeout(lookupTimeout.current);
    lookupTimeout.current = setTimeout(() => lookupDiscordId(value), 500);
  };

  const generatePreview = () => {
    if (!discordUsername.trim() && !discordUserId.trim()) return;
    setPreview(getRandomMessage(reason, discordUsername.trim(), discordUserId.trim()));
  };

  const regeneratePreview = () => {
    if (!discordUsername.trim() && !discordUserId.trim()) return;
    setPreview(getRandomMessage(reason, discordUsername.trim(), discordUserId.trim()));
  };

  const logSpotlight = async (entry: { discord_username?: string; discord_user_id?: string; reason: string; message: string; auto_triggered: boolean; status: string }) => {
    if (!supabase) return;
    try {
      await supabase.from('spotlight_history').insert({
        ...entry,
        sent_at: entry.status === 'sent' ? new Date().toISOString() : null,
      });
    } catch { /* ignore */ }
  };

  const sendSpotlight = async (messageContent?: string) => {
    const content = messageContent || preview;
    if (!content.trim()) return;
    if (mode === 'template' && ((!discordUsername.trim() && !discordUserId.trim()) || !preview)) return;
    setSending(true);
    setResult(null);

    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch(`${API_URL}/api/v1/bot/spotlight`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          content: content,
          username: SPOTLIGHT_NAME,
          avatar_url: SPOTLIGHT_AVATAR,
        }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setResult({ success: true, message: 'Spotlight message sent successfully!' });
        await logSpotlight({
          discord_username: discordUsername.trim() || undefined,
          discord_user_id: discordUserId.trim() || undefined,
          reason: mode === 'custom' ? 'custom' : reason,
          message: content,
          auto_triggered: false,
          status: 'sent',
        });
        if (mode === 'template') {
          setDiscordUsername('');
          setDiscordUserId('');
          setPreview('');
        } else {
          setCustomMessage('');
        }
        fetchHistory();
      } else {
        setResult({ success: false, message: `Failed: ${data.detail || response.statusText}` });
        await logSpotlight({
          discord_username: discordUsername.trim() || undefined,
          discord_user_id: discordUserId.trim() || undefined,
          reason: mode === 'custom' ? 'custom' : reason,
          message: content,
          auto_triggered: false,
          status: 'failed',
        });
      }
    } catch (err) {
      setResult({ success: false, message: `Error: ${err instanceof Error ? err.message : 'Unknown error'}` });
    } finally {
      setSending(false);
    }
  };

  const sendPendingSpotlight = async (entry: SpotlightHistoryEntry) => {
    if (!supabase) return;
    setSending(true);
    const entryReason = (entry.reason as SpotlightReason) || 'supporter';
    const message = getRandomMessage(
      entryReason in MESSAGE_POOLS ? entryReason : 'supporter',
      entry.discord_username || 'Unknown',
      entry.discord_user_id || '',
    );

    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch(`${API_URL}/api/v1/bot/spotlight`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          content: message,
          username: SPOTLIGHT_NAME,
          avatar_url: SPOTLIGHT_AVATAR,
        }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        await supabase.from('spotlight_history').update({
          status: 'sent',
          message: message,
          sent_at: new Date().toISOString(),
        }).eq('id', entry.id);
        setResult({ success: true, message: `Spotlight sent for ${entry.discord_username || 'user'}!` });
      } else {
        await supabase.from('spotlight_history').update({
          status: 'failed',
          message: message,
          error_message: data.detail || response.statusText,
        }).eq('id', entry.id);
        setResult({ success: false, message: `Failed: ${data.detail || response.statusText}` });
      }
    } catch (err) {
      setResult({ success: false, message: `Error: ${err instanceof Error ? err.message : 'Unknown error'}` });
    } finally {
      setSending(false);
      fetchPending();
      fetchHistory();
    }
  };

  const skipPendingSpotlight = async (entry: SpotlightHistoryEntry) => {
    if (!supabase) return;
    await supabase.from('spotlight_history').update({ status: 'skipped' }).eq('id', entry.id);
    fetchPending();
  };

  const hasInput = discordUsername.trim() || discordUserId.trim();
  const config = REASON_CONFIG[reason];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Header */}
      <div style={{
        backgroundColor: colors.cardAlt,
        borderRadius: '10px',
        border: `1px solid ${colors.border}`,
        padding: '1rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '1.1rem' }}>✨</span>
          <span style={{ color: colors.text, fontWeight: 700, fontSize: '1rem' }}>Community Spotlight</span>
          {pendingSpotlights.length > 0 && (
            <span style={{
              backgroundColor: '#f59e0b20',
              color: '#f59e0b',
              fontSize: '0.65rem',
              fontWeight: 700,
              padding: '0.15rem 0.5rem',
              borderRadius: '10px',
              border: '1px solid #f59e0b40',
            }}>
              {pendingSpotlights.length} pending
            </span>
          )}
        </div>
        <p style={{ color: colors.textMuted, fontSize: '0.75rem', margin: 0, lineHeight: 1.6 }}>
          Send personalized thank-you messages to #spotlight. Auto-triggers for new Supporters and Ambassadors. Discord User ID is auto-populated from profiles.
        </p>
      </div>

      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: isMobile ? '0.35rem' : '0.5rem', flexWrap: 'wrap' }}>
        {([
          { key: 'compose' as TabView, label: '✏️ Compose', count: 0 },
          { key: 'pending' as TabView, label: '⏳ Pending', count: pendingSpotlights.length },
          { key: 'history' as TabView, label: '📋 History', count: history.length },
        ]).map(tab => (
          <button
            key={tab.key}
            onClick={() => { setTabView(tab.key); setResult(null); }}
            style={{
              padding: isMobile ? '0.5rem 0.7rem' : '0.4rem 0.85rem',
              backgroundColor: tabView === tab.key ? `${colors.primary}20` : 'transparent',
              border: `1px solid ${tabView === tab.key ? `${colors.primary}40` : colors.border}`,
              borderRadius: '6px',
              color: tabView === tab.key ? colors.primary : colors.textMuted,
              fontSize: isMobile ? '0.75rem' : '0.8rem',
              minHeight: '44px',
              fontWeight: tabView === tab.key ? 600 : 400,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem',
            }}
          >
            {tab.label}
            {tab.count > 0 && (
              <span style={{
                backgroundColor: tab.key === 'pending' ? '#f59e0b30' : `${colors.primary}30`,
                color: tab.key === 'pending' ? '#f59e0b' : colors.primary,
                fontSize: '0.6rem',
                fontWeight: 700,
                padding: '0.1rem 0.35rem',
                borderRadius: '8px',
                minWidth: '16px',
                textAlign: 'center',
              }}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ─── COMPOSE TAB ─── */}
      {tabView === 'compose' && (
        <>
          {/* Mode Toggle */}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {(['template', 'custom'] as SpotlightMode[]).map(m => (
              <button
                key={m}
                onClick={() => { setMode(m); setResult(null); }}
                style={{
                  padding: '0.35rem 0.7rem',
                  backgroundColor: mode === m ? `${config.color}15` : 'transparent',
                  border: `1px solid ${mode === m ? `${config.color}30` : colors.border}`,
                  borderRadius: '6px',
                  color: mode === m ? config.color : colors.textMuted,
                  fontSize: '0.75rem',
                  fontWeight: mode === m ? 600 : 400,
                  cursor: 'pointer',
                }}
              >
                {m === 'template' ? '🎨 Template' : '✏️ Custom'}
              </button>
            ))}
          </div>

          {mode === 'template' ? (
            <>
              {/* Template Form */}
              <div style={{
                backgroundColor: colors.cardAlt,
                borderRadius: '10px',
                border: `1px solid ${colors.border}`,
                padding: '1rem',
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {/* Discord Username + auto-lookup */}
                  <div>
                    <label style={{ color: colors.textSecondary, fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.3rem' }}>
                      Discord Username
                      {lookupLoading && <span style={{ color: colors.textMuted, fontWeight: 400, marginLeft: '0.4rem', fontSize: '0.65rem' }}>looking up ID...</span>}
                    </label>
                    <input
                      type="text"
                      value={discordUsername}
                      onChange={(e) => handleUsernameChange(e.target.value)}
                      placeholder="Start typing — Discord ID auto-populates from profiles"
                      style={{
                        width: '100%',
                        padding: '0.5rem 0.75rem',
                        backgroundColor: colors.bg,
                        border: `1px solid ${colors.border}`,
                        borderRadius: '6px',
                        color: colors.text,
                        fontSize: '0.85rem',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                      onFocus={(e) => e.target.style.borderColor = colors.primary}
                      onBlur={(e) => e.target.style.borderColor = colors.border}
                    />
                  </div>

                  {/* Discord User ID (auto-populated or manual) */}
                  <div>
                    <label style={{ color: colors.textSecondary, fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.3rem' }}>
                      Discord User ID
                      <span style={{ color: colors.textMuted, fontWeight: 400, marginLeft: '0.3rem', fontSize: '0.65rem' }}>(auto-populated or manual)</span>
                    </label>
                    <input
                      type="text"
                      value={discordUserId}
                      onChange={(e) => {
                        setDiscordUserId(e.target.value.replace(/[^0-9]/g, ''));
                        setPreview('');
                      }}
                      placeholder="Auto-fills from Supabase profiles, or paste manually"
                      style={{
                        width: '100%',
                        padding: '0.5rem 0.75rem',
                        backgroundColor: colors.bg,
                        border: `1px solid ${discordUserId.trim() ? '#22c55e40' : colors.border}`,
                        borderRadius: '6px',
                        color: colors.text,
                        fontSize: '0.85rem',
                        outline: 'none',
                        fontFamily: 'monospace',
                        boxSizing: 'border-box',
                      }}
                      onFocus={(e) => e.target.style.borderColor = colors.primary}
                      onBlur={(e) => e.target.style.borderColor = discordUserId.trim() ? '#22c55e40' : colors.border}
                    />
                    <p style={{ color: discordUserId.trim() ? '#22c55e' : colors.textMuted, fontSize: '0.6rem', margin: '0.25rem 0 0 0', lineHeight: 1.4 }}>
                      {discordUserId.trim()
                        ? '✅ Will ping the user with a real @mention notification'
                        : '💡 Type a username above to auto-lookup, or right-click user in Discord → Copy User ID'
                      }
                    </p>
                  </div>

                  {/* Reason */}
                  <div>
                    <label style={{ color: colors.textSecondary, fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.3rem' }}>
                      Reason
                    </label>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {(Object.entries(REASON_CONFIG) as [SpotlightReason, typeof config][]).map(([key, cfg]) => (
                        <button
                          key={key}
                          onClick={() => { setReason(key); setPreview(''); }}
                          style={{
                            padding: isMobile ? '0.5rem 0.6rem' : '0.4rem 0.75rem',
                            backgroundColor: reason === key ? `${cfg.color}20` : 'transparent',
                            border: `1px solid ${reason === key ? `${cfg.color}50` : colors.border}`,
                            borderRadius: '6px',
                            color: reason === key ? cfg.color : colors.textMuted,
                            fontSize: isMobile ? '0.75rem' : '0.8rem',
                            minHeight: '44px',
                            fontWeight: reason === key ? 600 : 400,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                          }}
                        >
                          <span>{cfg.emoji}</span>
                          {cfg.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Generate Preview */}
                  <button
                    onClick={preview ? regeneratePreview : generatePreview}
                    disabled={!hasInput}
                    style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: hasInput ? `${config.color}20` : `${colors.textMuted}10`,
                      border: `1px solid ${hasInput ? `${config.color}40` : colors.border}`,
                      borderRadius: '8px',
                      color: hasInput ? config.color : colors.textMuted,
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: hasInput ? 'pointer' : 'not-allowed',
                      width: 'fit-content',
                    }}
                  >
                    {preview ? '🔄 Regenerate Message' : '✨ Generate Preview'}
                  </button>
                </div>
              </div>

              {/* Preview */}
              {preview && (
                <div style={{
                  backgroundColor: '#2b2d31',
                  borderRadius: '10px',
                  border: `1px solid ${config.color}30`,
                  padding: '1rem',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <img src={SPOTLIGHT_AVATAR} alt="" style={{ width: 28, height: 28, borderRadius: '50%' }} />
                    <span style={{ color: config.color, fontWeight: 600, fontSize: '0.85rem' }}>{SPOTLIGHT_NAME}</span>
                    <span style={{ color: '#72767d', fontSize: '0.65rem' }}>Today</span>
                  </div>
                  <div style={{ color: '#dcddde', fontSize: '0.85rem', lineHeight: 1.6, paddingLeft: '2.25rem' }}>
                    {preview}
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', paddingLeft: '2.25rem', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => sendSpotlight()}
                      disabled={sending}
                      style={{
                        padding: '0.5rem 1rem',
                        backgroundColor: sending ? `${colors.success}10` : `${colors.success}20`,
                        border: `1px solid ${colors.success}50`,
                        borderRadius: '6px',
                        color: colors.success,
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        cursor: sending ? 'not-allowed' : 'pointer',
                        opacity: sending ? 0.6 : 1,
                      }}
                    >
                      {sending ? 'Sending...' : '📢 Send to #spotlight'}
                    </button>
                    <button
                      onClick={regeneratePreview}
                      style={{
                        padding: '0.5rem 0.75rem',
                        backgroundColor: 'transparent',
                        border: `1px solid ${colors.border}`,
                        borderRadius: '6px',
                        color: colors.textMuted,
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                      }}
                    >
                      🔄 Different Message
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Custom Message Mode */
            <div style={{
              backgroundColor: colors.cardAlt,
              borderRadius: '10px',
              border: `1px solid ${colors.border}`,
              padding: '1rem',
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div>
                  <label style={{ color: colors.textSecondary, fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.3rem' }}>
                    Message Content
                  </label>
                  <p style={{ color: colors.textMuted, fontSize: '0.7rem', margin: '0 0 0.4rem 0', lineHeight: 1.5 }}>
                    Write any message to send to #spotlight. Supports Discord markdown. Use {'<@USER_ID>'} for mentions.
                  </p>
                  <textarea
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    placeholder="Write your spotlight message here... Use **bold** for emphasis."
                    rows={6}
                    style={{
                      width: '100%',
                      padding: '0.6rem 0.75rem',
                      backgroundColor: colors.bg,
                      border: `1px solid ${colors.border}`,
                      borderRadius: '6px',
                      color: colors.text,
                      fontSize: '0.85rem',
                      outline: 'none',
                      resize: 'vertical',
                      lineHeight: 1.6,
                      fontFamily: 'inherit',
                      boxSizing: 'border-box',
                    }}
                    onFocus={(e) => e.target.style.borderColor = colors.primary}
                    onBlur={(e) => e.target.style.borderColor = colors.border}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.25rem' }}>
                    <span style={{ color: colors.textMuted, fontSize: '0.65rem' }}>
                      {customMessage.length} / 2000 characters
                    </span>
                  </div>
                </div>

                {/* Custom Preview */}
                {customMessage.trim() && (
                  <div style={{
                    backgroundColor: '#2b2d31',
                    borderRadius: '8px',
                    padding: '0.75rem',
                    border: `1px solid ${colors.border}`,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                      <img src={SPOTLIGHT_AVATAR} alt="" style={{ width: 24, height: 24, borderRadius: '50%' }} />
                      <span style={{ color: colors.primary, fontWeight: 600, fontSize: '0.8rem' }}>{SPOTLIGHT_NAME}</span>
                      <span style={{ color: '#72767d', fontSize: '0.6rem' }}>Today</span>
                    </div>
                    <div style={{ color: '#dcddde', fontSize: '0.8rem', lineHeight: 1.6, paddingLeft: '2rem', whiteSpace: 'pre-wrap' }}>
                      {customMessage}
                    </div>
                  </div>
                )}

                <button
                  onClick={() => sendSpotlight(customMessage)}
                  disabled={sending || !customMessage.trim() || customMessage.length > 2000}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: (customMessage.trim() && !sending) ? `${colors.success}20` : `${colors.textMuted}10`,
                    border: `1px solid ${(customMessage.trim() && !sending) ? `${colors.success}50` : colors.border}`,
                    borderRadius: '8px',
                    color: (customMessage.trim() && !sending) ? colors.success : colors.textMuted,
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: (customMessage.trim() && !sending) ? 'pointer' : 'not-allowed',
                    width: 'fit-content',
                    opacity: sending ? 0.6 : 1,
                  }}
                >
                  {sending ? 'Sending...' : '📢 Send to #spotlight'}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ─── PENDING TAB ─── */}
      {tabView === 'pending' && (
        <div style={{
          backgroundColor: colors.cardAlt,
          borderRadius: '10px',
          border: `1px solid ${colors.border}`,
          padding: '1rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <span style={{ color: colors.text, fontWeight: 600, fontSize: '0.9rem' }}>
              ⏳ Auto-Triggered Spotlights
            </span>
            <button
              onClick={fetchPending}
              style={{
                padding: '0.3rem 0.6rem',
                backgroundColor: 'transparent',
                border: `1px solid ${colors.border}`,
                borderRadius: '4px',
                color: colors.textMuted,
                fontSize: '0.7rem',
                cursor: 'pointer',
              }}
            >
              🔄 Refresh
            </button>
          </div>

          {pendingSpotlights.length === 0 ? (
            <p style={{ color: colors.textMuted, fontSize: '0.8rem', textAlign: 'center', padding: '2rem 0' }}>
              No pending spotlights. Auto-triggered spotlights for new Supporters and Ambassadors will appear here.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {pendingSpotlights.map(entry => {
                const reasonCfg = REASON_CONFIG[entry.reason as SpotlightReason] || { label: entry.reason, emoji: '✨', color: colors.primary };
                return (
                  <div key={entry.id} style={{
                    backgroundColor: colors.bg,
                    borderRadius: '8px',
                    border: `1px solid ${reasonCfg.color}30`,
                    padding: '0.75rem',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem', flexWrap: 'wrap', gap: '0.3rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span style={{ fontSize: '0.85rem' }}>{reasonCfg.emoji}</span>
                        <span style={{ color: reasonCfg.color, fontWeight: 600, fontSize: '0.8rem' }}>{reasonCfg.label}</span>
                        <span style={{
                          backgroundColor: '#f59e0b20',
                          color: '#f59e0b',
                          fontSize: '0.55rem',
                          fontWeight: 700,
                          padding: '0.1rem 0.35rem',
                          borderRadius: '6px',
                        }}>AUTO</span>
                      </div>
                      <span style={{ color: colors.textMuted, fontSize: '0.65rem' }}>
                        {new Date(entry.created_at).toLocaleDateString()} {new Date(entry.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div style={{ color: colors.textSecondary, fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                      <strong>{entry.discord_username || 'Unknown User'}</strong>
                      {entry.discord_user_id && <span style={{ color: colors.textMuted, fontSize: '0.7rem', marginLeft: '0.4rem' }}>({entry.discord_user_id})</span>}
                    </div>
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                      <button
                        onClick={() => sendPendingSpotlight(entry)}
                        disabled={sending}
                        style={{
                          padding: '0.35rem 0.7rem',
                          backgroundColor: `${colors.success}20`,
                          border: `1px solid ${colors.success}40`,
                          borderRadius: '6px',
                          color: colors.success,
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: sending ? 'not-allowed' : 'pointer',
                          opacity: sending ? 0.6 : 1,
                        }}
                      >
                        📢 Send Spotlight
                      </button>
                      <button
                        onClick={() => skipPendingSpotlight(entry)}
                        style={{
                          padding: '0.35rem 0.7rem',
                          backgroundColor: 'transparent',
                          border: `1px solid ${colors.border}`,
                          borderRadius: '6px',
                          color: colors.textMuted,
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                        }}
                      >
                        Skip
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── HISTORY TAB ─── */}
      {tabView === 'history' && (
        <div style={{
          backgroundColor: colors.cardAlt,
          borderRadius: '10px',
          border: `1px solid ${colors.border}`,
          padding: '1rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <span style={{ color: colors.text, fontWeight: 600, fontSize: '0.9rem' }}>
              📋 Spotlight History
            </span>
            <button
              onClick={fetchHistory}
              disabled={historyLoading}
              style={{
                padding: '0.3rem 0.6rem',
                backgroundColor: 'transparent',
                border: `1px solid ${colors.border}`,
                borderRadius: '4px',
                color: colors.textMuted,
                fontSize: '0.7rem',
                cursor: 'pointer',
              }}
            >
              {historyLoading ? '...' : '🔄 Refresh'}
            </button>
          </div>

          {history.length === 0 ? (
            <p style={{ color: colors.textMuted, fontSize: '0.8rem', textAlign: 'center', padding: '2rem 0' }}>
              No spotlight messages sent yet. Compose one above!
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {history.map(entry => {
                const reasonCfg = REASON_CONFIG[entry.reason as SpotlightReason] || { label: entry.reason, emoji: '✏️', color: colors.textSecondary };
                return (
                  <div key={entry.id} style={{
                    backgroundColor: colors.bg,
                    borderRadius: '6px',
                    padding: '0.6rem 0.75rem',
                    borderLeft: `3px solid ${entry.status === 'sent' ? reasonCfg.color : colors.error}`,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.3rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <span style={{ fontSize: '0.75rem' }}>{reasonCfg.emoji}</span>
                        <span style={{ color: colors.textSecondary, fontWeight: 600, fontSize: '0.75rem' }}>
                          {entry.discord_username || 'Custom'}
                        </span>
                        {entry.auto_triggered && (
                          <span style={{
                            backgroundColor: '#f59e0b15',
                            color: '#f59e0b',
                            fontSize: '0.5rem',
                            fontWeight: 700,
                            padding: '0.05rem 0.25rem',
                            borderRadius: '4px',
                          }}>AUTO</span>
                        )}
                        <span style={{
                          color: entry.status === 'sent' ? colors.success : colors.error,
                          fontSize: '0.6rem',
                          fontWeight: 600,
                        }}>
                          {entry.status === 'sent' ? '✅' : '❌'}
                        </span>
                      </div>
                      <span style={{ color: colors.textMuted, fontSize: '0.6rem' }}>
                        {entry.sent_at
                          ? new Date(entry.sent_at).toLocaleDateString() + ' ' + new Date(entry.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : new Date(entry.created_at).toLocaleDateString()
                        }
                      </span>
                    </div>
                    {entry.message && (
                      <p style={{
                        color: colors.textMuted,
                        fontSize: '0.7rem',
                        margin: '0.3rem 0 0 0',
                        lineHeight: 1.4,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: '100%',
                      }}>
                        {entry.message.slice(0, 120)}{entry.message.length > 120 ? '...' : ''}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Result */}
      {result && (
        <div style={{
          padding: '0.75rem 1rem',
          backgroundColor: result.success ? `${colors.success}10` : `${colors.error}10`,
          border: `1px solid ${result.success ? `${colors.success}30` : `${colors.error}30`}`,
          borderRadius: '8px',
          color: result.success ? colors.success : colors.error,
          fontSize: '0.8rem',
        }}>
          {result.success ? '✅' : '❌'} {result.message}
        </div>
      )}
    </div>
  );
};

export default SpotlightTab;
