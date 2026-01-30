import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useIsMobile } from '../hooks/useMediaQuery';

interface PlayerProfile {
  id: string;
  username: string;
  avatar_url: string | null;
  home_kingdom: number | null;
  linked_kingdom: number | null;
  linked_username: string | null;
  alliance_tag: string | null;
  theme_color: string;
}

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
          .select('id, username, avatar_url, home_kingdom, linked_kingdom, linked_username, alliance_tag, theme_color')
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
          {players.map((player) => (
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
                e.currentTarget.style.borderColor = player.theme_color || themeColor;
                e.currentTarget.style.backgroundColor = '#111111';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#2a2a2a';
                e.currentTarget.style.backgroundColor = '#0a0a0a';
              }}
              >
                {/* Avatar */}
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  backgroundColor: '#1a1a1a',
                  border: `2px solid ${player.theme_color || themeColor}40`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  flexShrink: 0,
                }}>
                  {player.avatar_url ? (
                    <img 
                      src={player.avatar_url} 
                      alt={player.username}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <span style={{ fontSize: '1rem', color: player.theme_color || themeColor }}>
                      {(player.username || 'U').charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ 
                    fontSize: '0.9rem', 
                    fontWeight: '600', 
                    color: '#fff',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {player.username || 'Anonymous'}
                  </div>
                  <div style={{ 
                    fontSize: '0.75rem', 
                    color: '#6b7280',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}>
                    {player.alliance_tag && (
                      <span style={{ 
                        color: player.theme_color || themeColor,
                        fontWeight: '600',
                      }}>
                        [{player.alliance_tag}]
                      </span>
                    )}
                    {player.linked_username && (
                      <span>🎮 {player.linked_username}</span>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          ))}
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
