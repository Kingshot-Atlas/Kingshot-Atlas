import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useIsMobile } from '../hooks/useMediaQuery';
import { colors, neonGlow } from '../utils/styles';
import { getDisplayTier, SUBSCRIPTION_COLORS, SubscriptionTier } from '../utils/constants';

interface PlayerProfile {
  id: string;
  username: string;
  avatar_url: string | null;
  linked_username: string | null;
  linked_avatar_url: string | null;
  linked_tc_level: number | null;
  alliance_tag: string | null;
  theme_color: string;
  subscription_tier: 'free' | 'pro' | 'recruiter' | null;
}

interface KingdomPlayersProps {
  kingdomNumber: number;
  themeColor?: string;
}

// Get username color based on display tier (includes admin)
const getUsernameColor = (tier: SubscriptionTier): string => {
  switch (tier) {
    case 'admin': return SUBSCRIPTION_COLORS.admin;
    case 'recruiter': return SUBSCRIPTION_COLORS.recruiter;
    case 'pro': return SUBSCRIPTION_COLORS.pro;
    default: return colors.text;
  }
};

// Convert TC level to display string
const formatTCLevel = (level: number | null): string => {
  if (!level) return '';
  if (level <= 30) return `TC ${level}`;
  if (level <= 34) return 'TC 30';
  const tgTier = Math.floor((level - 35) / 5) + 1;
  return `TG${tgTier}`;
};

const KingdomPlayers: React.FC<KingdomPlayersProps> = ({ 
  kingdomNumber,
  themeColor = colors.primary
}) => {
  const isMobile = useIsMobile();
  const [players, setPlayers] = useState<PlayerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!kingdomNumber || !isSupabaseConfigured || !supabase) {
      setLoading(false);
      return;
    }

    const fetchPlayers = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data, error: fetchError } = await supabase!
          .from('profiles')
          .select('id, username, avatar_url, linked_username, linked_avatar_url, linked_tc_level, alliance_tag, theme_color, subscription_tier')
          .or(`home_kingdom.eq.${kingdomNumber},linked_kingdom.eq.${kingdomNumber}`)
          .limit(20);

        if (fetchError) {
          throw fetchError;
        }

        setPlayers(data || []);
      } catch (err) {
        console.error('Failed to fetch kingdom players:', err);
        setError('Failed to load players');
      } finally {
        setLoading(false);
      }
    };

    fetchPlayers();
  }, [kingdomNumber]);

  if (loading) {
    return (
      <div style={{
        backgroundColor: colors.surface,
        borderRadius: '12px',
        padding: '1rem',
        marginBottom: '1.5rem',
        border: `1px solid ${colors.border}`,
      }}>
        <div style={{ color: colors.textMuted, fontSize: '0.85rem' }}>Loading players...</div>
      </div>
    );
  }

  if (error || players.length === 0) {
    return null;
  }

  return (
    <div style={{
      backgroundColor: colors.surface,
      borderRadius: '12px',
      padding: isMobile ? '1rem' : '1.25rem',
      marginBottom: '1.5rem',
      border: `1px solid ${themeColor}30`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '1.1rem' }}>👥</span>
          <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: '600', color: colors.text }}>
            Atlas Users from K-{kingdomNumber}
          </h3>
        </div>
        <span style={{ fontSize: '0.75rem', color: colors.textMuted }}>
          {players.length} {players.length === 1 ? 'player' : 'players'}
        </span>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
        gap: '0.75rem',
      }}>
        {players.map((player) => {
          // Use linked_username for admin check since that's the Kingshot identity
          const displayTier = getDisplayTier(player.subscription_tier, player.linked_username || player.username);
          const usernameColor = getUsernameColor(displayTier);
          const isPaidOrAdmin = displayTier === 'pro' || displayTier === 'recruiter' || displayTier === 'admin';
          
          return (
            <Link 
              key={player.id}
              to={`/profile/${player.id}`}
              style={{ textDecoration: 'none' }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem',
                backgroundColor: colors.bg,
                borderRadius: '8px',
                border: `1px solid ${colors.border}`,
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = usernameColor + '50';
                e.currentTarget.style.backgroundColor = colors.surface;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = colors.border;
                e.currentTarget.style.backgroundColor = colors.bg;
              }}
              >
                {/* Avatar */}
                <div style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  backgroundColor: colors.card,
                  border: `2px solid ${usernameColor}40`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  flexShrink: 0,
                }}>
                  {player.linked_avatar_url || player.avatar_url ? (
                    <img 
                      src={player.linked_avatar_url || player.avatar_url || ''} 
                      alt={player.username}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <span style={{ fontSize: '1.1rem', color: usernameColor }}>
                      {(player.linked_username || player.username || 'U').charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ 
                    fontSize: '0.9rem', 
                    fontWeight: '600', 
                    color: usernameColor,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    ...(isPaidOrAdmin ? neonGlow(usernameColor) : {})
                  }}>
                    {player.linked_username || player.username || 'Anonymous'}
                  </div>
                  <div style={{ 
                    fontSize: '0.75rem', 
                    color: colors.textMuted,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    flexWrap: 'wrap',
                  }}>
                    {player.alliance_tag && (
                      <span style={{ 
                        color: player.theme_color || themeColor,
                        fontWeight: '600',
                      }}>
                        [{player.alliance_tag}]
                      </span>
                    )}
                    {player.linked_tc_level && (
                      <span>{formatTCLevel(player.linked_tc_level)}</span>
                    )}
                    {displayTier === 'admin' && (
                      <span style={{
                        fontSize: '0.6rem',
                        padding: '0.1rem 0.3rem',
                        backgroundColor: `${SUBSCRIPTION_COLORS.admin}15`,
                        border: `1px solid ${SUBSCRIPTION_COLORS.admin}40`,
                        borderRadius: '3px',
                        color: SUBSCRIPTION_COLORS.admin,
                        fontWeight: '600',
                      }}>
                        ADMIN
                      </span>
                    )}
                    {displayTier === 'pro' && (
                      <span style={{
                        fontSize: '0.6rem',
                        padding: '0.1rem 0.3rem',
                        backgroundColor: `${SUBSCRIPTION_COLORS.pro}15`,
                        border: `1px solid ${SUBSCRIPTION_COLORS.pro}40`,
                        borderRadius: '3px',
                        color: SUBSCRIPTION_COLORS.pro,
                        fontWeight: '600',
                      }}>
                        PRO
                      </span>
                    )}
                    {displayTier === 'recruiter' && (
                      <span style={{
                        fontSize: '0.6rem',
                        padding: '0.1rem 0.3rem',
                        backgroundColor: `${SUBSCRIPTION_COLORS.recruiter}15`,
                        border: `1px solid ${SUBSCRIPTION_COLORS.recruiter}40`,
                        borderRadius: '3px',
                        color: SUBSCRIPTION_COLORS.recruiter,
                        fontWeight: '600',
                      }}>
                        RECRUITER
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      <div style={{ marginTop: '1rem', textAlign: 'center' }}>
        <Link 
          to="/players"
          style={{ 
            color: themeColor, 
            fontSize: '0.75rem',
            textDecoration: 'none',
          }}
        >
          Browse All Players →
        </Link>
      </div>
    </div>
  );
};

export default KingdomPlayers;
