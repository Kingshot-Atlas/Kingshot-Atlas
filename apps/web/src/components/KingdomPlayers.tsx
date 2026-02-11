import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useIsMobile } from '../hooks/useMediaQuery';
import { colors, neonGlow } from '../utils/styles';
import { getDisplayTier, SUBSCRIPTION_COLORS, SubscriptionTier, ReferralTier } from '../utils/constants';
import ReferralBadge from './ReferralBadge';
import { useTranslation } from 'react-i18next';

interface PlayerProfile {
  id: string;
  username: string;
  avatar_url: string | null;
  linked_username: string | null;
  linked_avatar_url: string | null;
  linked_tc_level: number | null;
  alliance_tag: string | null;
  theme_color: string;
  subscription_tier: string | null;
  referral_tier: string | null;
}

// Get combined sort priority: admin=0, supporter=1, ambassador=2, consul=3, recruiter=4, scout=5, free=6
const getCombinedSortPriority = (subTier: SubscriptionTier, refTier: string | null): number => {
  if (subTier === 'admin') return 0;
  if (subTier === 'supporter') return 1;
  switch (refTier) {
    case 'ambassador': return 2;
    case 'consul': return 3;
    case 'recruiter': return 4;
    case 'scout': return 5;
    default: return 6;
  }
};

// Get avatar border color (full color, not opacity)
const getAvatarBorderColor = (tier: SubscriptionTier): string => {
  switch (tier) {
    case 'admin': return SUBSCRIPTION_COLORS.admin;      // Gold
    case 'supporter': return SUBSCRIPTION_COLORS.supporter; // Pink
    default: return '#ffffff';                           // White
  }
};

interface KingdomPlayersProps {
  kingdomNumber: number;
  themeColor?: string;
}

// Get username color based on display tier (includes admin)
const getUsernameColor = (tier: SubscriptionTier): string => {
  switch (tier) {
    case 'admin': return SUBSCRIPTION_COLORS.admin;
    case 'supporter': return SUBSCRIPTION_COLORS.supporter;
    default: return colors.text;
  }
};

const KingdomPlayers: React.FC<KingdomPlayersProps> = ({ 
  kingdomNumber,
  themeColor = colors.primary
}) => {
  const isMobile = useIsMobile();
  const { t } = useTranslation();
  const [players, setPlayers] = useState<PlayerProfile[]>([]);
  const [totalCount, setTotalCount] = useState(0);
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
        // First get total count
        const { count } = await supabase!
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .or(`home_kingdom.eq.${kingdomNumber},linked_kingdom.eq.${kingdomNumber}`);
        
        setTotalCount(count || 0);
        
        // Then get all users to sort them properly
        const { data, error: fetchError } = await supabase!
          .from('profiles')
          .select('id, username, avatar_url, linked_username, linked_avatar_url, linked_tc_level, alliance_tag, theme_color, subscription_tier, referral_tier')
          .or(`home_kingdom.eq.${kingdomNumber},linked_kingdom.eq.${kingdomNumber}`);

        if (fetchError) {
          throw fetchError;
        }

        // Sort by tier (admin > recruiter > pro > free) then alphabetically
        const sortedPlayers = (data || []).map(player => ({
          ...player,
          displayTier: getDisplayTier(player.subscription_tier, player.linked_username || player.username)
        })).sort((a, b) => {
          const tierDiff = getCombinedSortPriority(a.displayTier, a.referral_tier) - getCombinedSortPriority(b.displayTier, b.referral_tier);
          if (tierDiff !== 0) return tierDiff;
          const nameA = (a.linked_username || a.username || '').toLowerCase();
          const nameB = (b.linked_username || b.username || '').toLowerCase();
          return nameA.localeCompare(nameB);
        }).slice(0, 10); // Limit to 10 users

        setPlayers(sortedPlayers);
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
        <div style={{ color: colors.textMuted, fontSize: '0.85rem' }}>{t('kingdomPlayers.loading', 'Loading players...')}</div>
      </div>
    );
  }

  if (error) return null;

  if (players.length === 0) {
    return (
      <div style={{
        backgroundColor: colors.surface,
        borderRadius: '12px',
        padding: isMobile ? '1.25rem' : '1.5rem',
        marginBottom: '1.5rem',
        border: `1px solid ${themeColor}20`,
        textAlign: 'center',
      }}>
        <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>👀</div>
        <p style={{ color: colors.text, fontSize: '0.9rem', fontWeight: '600', margin: '0 0 0.25rem' }}>
          {t('kingdomPlayers.noUsers', 'No Atlas users from Kingdom {{num}} yet.', { num: kingdomNumber })}
        </p>
        <p style={{ color: '#6b7280', fontSize: '0.8rem', margin: '0 0 0.75rem', lineHeight: 1.5 }}>
          {t('kingdomPlayers.inviteThem', 'Know someone here? Invite them — every referral counts toward your Ambassador rank.')}
        </p>
        <Link
          to="/profile"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.5rem 1rem',
            backgroundColor: '#a24cf318',
            border: '1px solid #a24cf340',
            borderRadius: '8px',
            color: '#a24cf3',
            fontSize: '0.8rem',
            fontWeight: '600',
            textDecoration: 'none',
            minHeight: '40px',
          }}
        >
          {t('kingdomPlayers.referFriend', '🔗 Refer a Friend')}
        </Link>
      </div>
    );
  }

  return (
    <div style={{
      backgroundColor: colors.surface,
      borderRadius: '12px',
      padding: isMobile ? '1rem' : '1.25rem',
      marginBottom: '1.5rem',
      border: `1px solid ${themeColor}30`,
    }}>
      <h3 style={{ 
        margin: 0, 
        marginBottom: '1rem',
        fontSize: '0.9rem', 
        fontWeight: '600', 
        color: colors.text,
        textAlign: 'center'
      }}>
        {t('kingdomPlayers.title', 'Atlas Users from Kingdom {{num}}', { num: kingdomNumber })}
      </h3>

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
                {/* Avatar with tier-colored border */}
                <div style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  backgroundColor: colors.card,
                  border: `2px solid ${getAvatarBorderColor(displayTier)}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  flexShrink: 0,
                  ...(displayTier !== 'free' ? { boxShadow: `0 0 8px ${getAvatarBorderColor(displayTier)}40` } : {})
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

                {/* Info: [alliance] username (badge) */}
                <div style={{ 
                  flex: 1, 
                  minWidth: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  flexWrap: 'wrap'
                }}>
                  {player.alliance_tag && (
                    <span style={{ 
                      color: '#9ca3af',
                      fontWeight: '600',
                      fontSize: '0.85rem',
                    }}>
                      [{player.alliance_tag}]
                    </span>
                  )}
                  <span style={{ 
                    fontSize: '0.9rem', 
                    fontWeight: '600', 
                    color: usernameColor,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    ...(isPaidOrAdmin ? neonGlow(usernameColor) : {})
                  }}>
                    {player.linked_username || player.username || 'Anonymous'}
                  </span>
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
                  {player.referral_tier && (
                    <ReferralBadge tier={player.referral_tier as ReferralTier} />
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      <div style={{ 
        marginTop: '1rem', 
        display: 'flex', 
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <Link 
          to={`/players?kingdom=${kingdomNumber}`}
          style={{ 
            color: themeColor, 
            fontSize: '0.75rem',
            textDecoration: 'none',
          }}
        >
          {t('kingdomPlayers.browseAll', 'Browse all Kingdom {{num}} players →', { num: kingdomNumber })}
        </Link>
        <span style={{ fontSize: '0.7rem', color: colors.textMuted }}>
          {t('kingdomPlayers.showing', 'Showing {{count}} of {{total}} players', { count: players.length, total: totalCount })}
        </span>
      </div>
    </div>
  );
};

export default KingdomPlayers;
