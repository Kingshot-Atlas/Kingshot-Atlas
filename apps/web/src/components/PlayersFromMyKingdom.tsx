import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useIsMobile } from '../hooks/useMediaQuery';
import { getDisplayTier, SUBSCRIPTION_COLORS, SubscriptionTier } from '../utils/constants';
import { neonGlow } from '../utils/styles';

interface PlayerProfile {
  id: string;
  username: string;
  avatar_url: string | null;
  home_kingdom: number | null;
  linked_kingdom: number | null;
  linked_username: string | null;
  linked_avatar_url: string | null;
  linked_tc_level: number | null;
  alliance_tag: string | null;
  theme_color: string;
  subscription_tier: string | null;
}

// Get username color based on display tier
const getUsernameColor = (tier: SubscriptionTier): string => {
  switch (tier) {
    case 'admin': return SUBSCRIPTION_COLORS.admin;
    case 'supporter': return SUBSCRIPTION_COLORS.supporter;
    default: return '#ffffff'; // White for free users
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

interface PlayersFromMyKingdomProps {
  themeColor?: string;
}

const PlayersFromMyKingdom: React.FC<PlayersFromMyKingdomProps> = ({ 
  themeColor = '#22d3ee' 
}) => {
  const { profile, user } = useAuth();
  const isMobile = useIsMobile();
  const [players, setPlayers] = useState<PlayerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const myKingdom = profile?.linked_kingdom || profile?.home_kingdom;

  useEffect(() => {
    if (!myKingdom || !isSupabaseConfigured || !supabase) {
      setLoading(false);
      return;
    }

    const fetchPlayers = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data, error: fetchError } = await supabase!
          .from('profiles')
          .select('id, username, avatar_url, home_kingdom, linked_kingdom, linked_username, linked_avatar_url, linked_tc_level, alliance_tag, theme_color, subscription_tier')
          .or(`home_kingdom.eq.${myKingdom},linked_kingdom.eq.${myKingdom}`)
          .neq('id', user?.id || '')
          .limit(20);

        if (fetchError) {
          throw fetchError;
        }

        setPlayers(data || []);
      } catch (err) {
        console.error('Failed to fetch players:', err);
        setError('Failed to load players');
      } finally {
        setLoading(false);
      }
    };

    fetchPlayers();
  }, [myKingdom, user?.id]);

  if (!myKingdom) {
    return null;
  }

  if (loading) {
    return (
      <div style={{
        backgroundColor: '#111111',
        borderRadius: '12px',
        padding: '1rem',
        marginBottom: '1.5rem',
        border: '1px solid #2a2a2a',
      }}>
        <div style={{ color: '#6b7280', fontSize: '0.85rem' }}>Loading players...</div>
      </div>
    );
  }

  if (error) {
    return null;
  }

  return (
    <div style={{
      backgroundColor: '#111111',
      borderRadius: '12px',
      padding: isMobile ? '1rem' : '1.25rem',
      marginBottom: '1.5rem',
      border: `1px solid ${themeColor}30`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '1.1rem' }}>👥</span>
          <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: '600', color: '#fff' }}>
            Players from Kingdom {myKingdom}
          </h3>
        </div>
        <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
          {players.length} {players.length === 1 ? 'player' : 'players'}
        </span>
      </div>

      {players.length === 0 ? (
        <div style={{ 
          textAlign: 'center', 
          padding: '1.5rem',
          color: '#6b7280',
          fontSize: '0.85rem'
        }}>
          <p style={{ margin: 0 }}>No other players from your kingdom yet.</p>
          <p style={{ margin: '0.5rem 0 0', fontSize: '0.75rem' }}>
            Invite your alliance members to join!
          </p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
          gap: '0.75rem',
        }}>
          {players.map((player) => {
          // Use linked_username for admin check since that's the Kingshot identity
          const displayTier = getDisplayTier(player.subscription_tier, player.linked_username || player.username);
          const usernameColor = getUsernameColor(displayTier);
          const isPaidOrAdmin = displayTier === 'supporter' || displayTier === 'admin';
          // Use Kingshot account data if available, fallback to OAuth data
          const displayName = player.linked_username || player.username || 'Anonymous';
          const displayAvatar = player.linked_avatar_url || player.avatar_url;
          
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
                backgroundColor: '#0a0a0a',
                borderRadius: '8px',
                border: '1px solid #2a2a2a',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = usernameColor + '50';
                e.currentTarget.style.backgroundColor = '#111111';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#2a2a2a';
                e.currentTarget.style.backgroundColor = '#0a0a0a';
              }}
              >
                {/* Avatar - Use Kingshot avatar if available */}
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  backgroundColor: '#1a1a1a',
                  border: `2px solid ${usernameColor}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  flexShrink: 0,
                  ...(displayTier !== 'free' ? { boxShadow: `0 0 8px ${usernameColor}40` } : {})
                }}>
                  {displayAvatar ? (
                    <img 
                      src={displayAvatar} 
                      alt={displayName}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <span style={{ fontSize: '1rem', color: usernameColor }}>
                      {displayName.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>

                {/* Info - Use Kingshot username with tier coloring */}
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
                    {displayName}
                  </div>
                  <div style={{ 
                    fontSize: '0.75rem', 
                    color: '#6b7280',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    flexWrap: 'wrap',
                  }}>
                    {player.alliance_tag && (
                      <span style={{ 
                        color: '#9ca3af',
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
                    {displayTier === 'supporter' && (
                      <span style={{
                        fontSize: '0.6rem',
                        padding: '0.1rem 0.3rem',
                        backgroundColor: `${SUBSCRIPTION_COLORS.supporter}15`,
                        border: `1px solid ${SUBSCRIPTION_COLORS.supporter}40`,
                        borderRadius: '3px',
                        color: SUBSCRIPTION_COLORS.supporter,
                        fontWeight: '600',
                      }}>
                        SUPPORTER
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
        </div>
      )}

      <div style={{ marginTop: '1rem', textAlign: 'center' }}>
        <Link 
          to={`/kingdom/${myKingdom}`}
          style={{ 
            color: themeColor, 
            fontSize: '0.75rem',
            textDecoration: 'none',
          }}
        >
          View Kingdom {myKingdom} Profile →
        </Link>
      </div>
    </div>
  );
};

export default PlayersFromMyKingdom;
