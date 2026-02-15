import React, { useState } from 'react';
import { colors } from '../../utils/styles';
import { getAuthHeaders } from '../../services/authHeaders';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

type SpotlightReason = 'supporter' | 'ambassador' | 'booster';

const REASON_CONFIG: Record<SpotlightReason, { label: string; emoji: string; color: string }> = {
  supporter: { label: 'Became a Supporter', emoji: '💎', color: '#22d3ee' },
  ambassador: { label: 'Became an Ambassador', emoji: '🏛️', color: '#a855f7' },
  booster: { label: 'Boosted the Server', emoji: '🚀', color: '#f472b6' },
};

const SUPPORTER_MESSAGES = [
  "🎉 A new legend rises! **{user}** just became an **Atlas Supporter**! Your belief in this community fuels everything we build. From the bottom of our hearts — thank you. 💎",
  "⚡ **{user}** just leveled up to **Atlas Supporter**! Every kingdom, every score, every feature — you make it possible. We don't take that for granted. Thank you! 💎",
  "🌟 Shoutout to **{user}** for becoming an **Atlas Supporter**! You're not just supporting a tool — you're investing in the competitive Kingshot community. That means the world. 💎",
  "💎 **{user}** has joined the ranks of **Atlas Supporters**! The intelligence gets stronger, the tools get sharper — all because of people like you. Thank you for believing in Atlas!",
  "🏆 Big moment! **{user}** just subscribed as an **Atlas Supporter**! Your contribution keeps this community-powered project alive and growing. We salute you! 💎",
  "✨ Welcome to the Supporter family, **{user}**! Your support means more kingdoms tracked, better tools, and a stronger community. Atlas wouldn't be Atlas without you. 💎",
];

const AMBASSADOR_MESSAGES = [
  "🏛️ **{user}** has earned the title of **Atlas Ambassador**! By spreading the word and bringing players into the fold, you've proven yourself a true champion of this community. 🙌",
  "⚡ A new **Ambassador** has emerged! **{user}** has been rallying players and building bridges across kingdoms. Your referrals strengthen us all. Thank you! 🏛️",
  "🌟 Hats off to **{user}** — our newest **Atlas Ambassador**! You didn't just join the community, you grew it. That kind of dedication doesn't go unnoticed. 🏛️",
  "🏛️ **{user}** just unlocked **Ambassador** status! Every player you've brought to Atlas makes our intelligence network stronger. You're a legend. Keep building! 💜",
  "🎉 The Atlas community grows thanks to people like **{user}**, our newest **Ambassador**! Your referrals bring kingdoms together and make everyone's experience richer. 🏛️",
];

const BOOSTER_MESSAGES = [
  "🚀 **{user}** just **boosted** the Atlas Discord server! You're literally powering up our community hub. That's next-level support — thank you! 💖",
  "✨ Server boost incoming! **{user}** just gave the Atlas Discord a boost! Better quality, better emojis, better everything — all thanks to you. 🚀",
  "🎉 **{user}** dropped a **server boost** on the Atlas Discord! You're making this community shine brighter. We see you, we appreciate you! 🚀💖",
  "💖 Big thanks to **{user}** for **boosting** our Discord server! Every boost makes this space better for hundreds of competitive players. You're a real one! 🚀",
  "🚀 The Atlas Discord just got an upgrade! **{user}** boosted the server — better audio, better streams, better vibes for everyone. Thank you! 💖",
];

const MESSAGE_POOLS: Record<SpotlightReason, string[]> = {
  supporter: SUPPORTER_MESSAGES,
  ambassador: AMBASSADOR_MESSAGES,
  booster: BOOSTER_MESSAGES,
};

const getRandomMessage = (reason: SpotlightReason, discordUsername: string): string => {
  const pool = MESSAGE_POOLS[reason];
  const idx = Math.floor(Math.random() * pool.length);
  const template = pool[idx] ?? pool[0] ?? '';
  return template.replace(/\{user\}/g, discordUsername);
};

export const SpotlightTab: React.FC = () => {
  const [discordUsername, setDiscordUsername] = useState('');
  const [reason, setReason] = useState<SpotlightReason>('supporter');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [preview, setPreview] = useState('');

  const generatePreview = () => {
    if (!discordUsername.trim()) return;
    setPreview(getRandomMessage(reason, discordUsername.trim()));
  };

  const regeneratePreview = () => {
    if (!discordUsername.trim()) return;
    setPreview(getRandomMessage(reason, discordUsername.trim()));
  };

  const sendSpotlight = async () => {
    if (!discordUsername.trim() || !preview) return;
    setSending(true);
    setResult(null);

    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch(`${API_URL}/api/v1/bot/spotlight`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          content: preview,
          username: 'Atlas Spotlight',
          avatar_url: 'https://ks-atlas.com/atlas-logo.png',
        }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setResult({ success: true, message: 'Spotlight message sent successfully!' });
        setDiscordUsername('');
        setPreview('');
      } else {
        setResult({ success: false, message: `Failed: ${data.detail || response.statusText}` });
      }
    } catch (err) {
      setResult({ success: false, message: `Error: ${err instanceof Error ? err.message : 'Unknown error'}` });
    } finally {
      setSending(false);
    }
  };

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
        </div>
        <p style={{ color: colors.textMuted, fontSize: '0.75rem', margin: 0, lineHeight: 1.6 }}>
          Send a personalized thank-you message to the #spotlight channel. Recognizes members for supporting Atlas, referring users, or boosting the Discord server.
        </p>
      </div>

      {/* Form */}
      <div style={{
        backgroundColor: colors.cardAlt,
        borderRadius: '10px',
        border: `1px solid ${colors.border}`,
        padding: '1rem',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {/* Discord Username */}
          <div>
            <label style={{ color: colors.textSecondary, fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.3rem' }}>
              Discord Username
            </label>
            <input
              type="text"
              value={discordUsername}
              onChange={(e) => {
                setDiscordUsername(e.target.value);
                setPreview('');
              }}
              placeholder="e.g. @username or username#1234"
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                backgroundColor: colors.bg,
                border: `1px solid ${colors.border}`,
                borderRadius: '6px',
                color: colors.text,
                fontSize: '0.85rem',
                outline: 'none',
              }}
              onFocus={(e) => e.target.style.borderColor = colors.primary}
              onBlur={(e) => e.target.style.borderColor = colors.border}
            />
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
                    padding: '0.4rem 0.75rem',
                    backgroundColor: reason === key ? `${cfg.color}20` : 'transparent',
                    border: `1px solid ${reason === key ? `${cfg.color}50` : colors.border}`,
                    borderRadius: '6px',
                    color: reason === key ? cfg.color : colors.textMuted,
                    fontSize: '0.8rem',
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
            disabled={!discordUsername.trim()}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: discordUsername.trim() ? `${config.color}20` : `${colors.textMuted}10`,
              border: `1px solid ${discordUsername.trim() ? `${config.color}40` : colors.border}`,
              borderRadius: '8px',
              color: discordUsername.trim() ? config.color : colors.textMuted,
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: discordUsername.trim() ? 'pointer' : 'not-allowed',
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
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              backgroundColor: colors.primary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.75rem',
              fontWeight: 700,
              color: '#000',
            }}>A</div>
            <span style={{ color: config.color, fontWeight: 600, fontSize: '0.85rem' }}>Atlas Spotlight</span>
            <span style={{ color: '#72767d', fontSize: '0.65rem' }}>Today</span>
          </div>
          <div style={{ color: '#dcddde', fontSize: '0.85rem', lineHeight: 1.6, paddingLeft: '2.25rem' }}>
            {preview}
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', paddingLeft: '2.25rem' }}>
            <button
              onClick={sendSpotlight}
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
