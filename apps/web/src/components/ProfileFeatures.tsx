import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';
import { Kingdom, getPowerTier, TIER_COLORS } from '../types';
import { MiniKingdomCard } from './profile-features';
import { reviewService, Review } from '../services/reviewService';
import { isSupabaseConfigured } from '../lib/supabase';
import { useFavoritesContext } from '../contexts/FavoritesContext';

const ProfileFeatures: React.FC = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { favorites, toggleFavorite } = useFavoritesContext();
  const [watchlist, setWatchlist] = useState<number[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [homeKingdomData, setHomeKingdomData] = useState<Kingdom | null>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [showAllFavorites, setShowAllFavorites] = useState(false);
  const [showAllReviews, setShowAllReviews] = useState(false);
  const [favoriteKingdoms, setFavoriteKingdoms] = useState<Kingdom[]>([]);
  const [totalHelpfulCount, setTotalHelpfulCount] = useState(0);
  const [isTopReviewer, setIsTopReviewer] = useState(false);

  const themeColor = profile?.theme_color || '#22d3ee';
  
  // Sort reviews by created_at (most recent first)
  const sortedReviews = [...reviews].sort((a, b) => 
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const neonGlow = (color: string) => ({
    color: color,
    textShadow: `0 0 8px ${color}40, 0 0 12px ${color}20`
  });

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    // Load watchlist
    const watchKey = 'kingshot_watchlist';
    const savedWatch = localStorage.getItem(watchKey);
    if (savedWatch) setWatchlist(JSON.parse(savedWatch));

    // Load user's reviews from Supabase
    if (user?.id && isSupabaseConfigured) {
      reviewService.getUserReviews(user.id).then(userReviews => {
        setReviews(userReviews);
        // Calculate total helpful count
        const totalHelpful = userReviews.reduce((sum, r) => sum + (r.helpful_count || 0), 0);
        setTotalHelpfulCount(totalHelpful);
        setIsTopReviewer(totalHelpful >= 5);
      });
    }
  }, [user?.id]);

  useEffect(() => {
    // Load home kingdom data
    if (profile?.home_kingdom) {
      apiService.getKingdomProfile(profile.home_kingdom)
        .then(setHomeKingdomData)
        .catch(() => setHomeKingdomData(null));
    }
  }, [profile?.home_kingdom]);

  // Load all favorite kingdoms data
  useEffect(() => {
    if (favorites.length > 0) {
      Promise.all(favorites.map(k => apiService.getKingdomProfile(k).catch(() => null)))
        .then(kingdoms => {
          const valid: Kingdom[] = [];
          for (const k of kingdoms) {
            if (k !== null) {
              valid.push(k as Kingdom);
            }
          }
          // Sort by Atlas Score descending
          valid.sort((a, b) => b.overall_score - a.overall_score);
          setFavoriteKingdoms(valid);
        });
    } else {
      setFavoriteKingdoms([]);
    }
  }, [favorites]);

  const removeFromFavorites = (kingdomNumber: number) => {
    toggleFavorite(kingdomNumber);
  };

  const removeFromWatchlist = (kingdomNumber: number) => {
    const newWatchlist = watchlist.filter(k => k !== kingdomNumber);
    setWatchlist(newWatchlist);
    localStorage.setItem('kingshot_watchlist', JSON.stringify(newWatchlist));
  };

  const KingdomCard = ({ kingdom, onRemove, showRemove = true }: { kingdom: Kingdom | null; onRemove?: () => void; showRemove?: boolean }) => {
    if (!kingdom) return null;
    
    const tier = kingdom.power_tier ?? getPowerTier(kingdom.overall_score);
    const tierColors = TIER_COLORS;

    return (
      <div style={{
        backgroundColor: '#111116',
        borderRadius: '12px',
        padding: isMobile ? '1rem' : '1.25rem',
        border: '1px solid #2a2a2a',
        position: 'relative',
        transition: 'transform 0.2s, border-color 0.2s',
        cursor: 'pointer'
      }}
      onClick={() => navigate(`/kingdom/${kingdom.kingdom_number}`)}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.borderColor = themeColor + '40';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.borderColor = '#1f1f1f';
      }}
    >
      {showRemove && onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          style={{
            position: 'absolute',
            top: '0.5rem',
            right: '0.5rem',
            background: 'none',
            border: 'none',
            color: '#ef4444',
            cursor: 'pointer',
            fontSize: '1.25rem',
            opacity: 0.7,
            transition: 'opacity 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
          onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'}
        >
          ✕
        </button>
      )}
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ color: '#fff', fontSize: isMobile ? '1.1rem' : '1.25rem', fontWeight: 'bold' }}>
            K-{kingdom.kingdom_number}
          </span>
          <span style={{
            padding: '0.2rem 0.5rem',
            borderRadius: '4px',
            fontSize: '0.7rem',
            fontWeight: 'bold',
            backgroundColor: `${tierColors[tier]}20`,
            color: tierColors[tier]
          }}>
            {tier}-Tier
          </span>
        </div>
        <span style={{ ...neonGlow(themeColor), fontSize: isMobile ? '1.1rem' : '1.25rem', fontWeight: 'bold' }}>
          {kingdom.overall_score.toFixed(1)}
        </span>
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', fontSize: '0.8rem' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#6b7280' }}>KvKs</div>
          <div style={{ color: themeColor, fontWeight: 'bold' }}>{kingdom.total_kvks}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#6b7280' }}>Prep</div>
          <div style={{ color: kingdom.prep_win_rate >= 0.8 ? '#22c55e' : '#ef4444', fontWeight: 'bold' }}>
            {Math.round(kingdom.prep_win_rate * 100)}%
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#6b7280' }}>Battle</div>
          <div style={{ color: kingdom.battle_win_rate >= 0.8 ? '#22c55e' : '#ef4444', fontWeight: 'bold' }}>
            {Math.round(kingdom.battle_win_rate * 100)}%
          </div>
        </div>
      </div>
    </div>
  );
  };

  const ReviewCard = ({ review }: { review: Review }) => (
    <div style={{
      backgroundColor: '#131318',
      borderRadius: '12px',
      padding: '1.25rem',
      border: '1px solid #2a2a2a',
      cursor: 'pointer',
      transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
    }}
    onClick={() => navigate(`/kingdom/${review.kingdom_number}`)}
    onMouseEnter={(e) => {
      e.currentTarget.style.transform = 'translateY(-2px)';
      e.currentTarget.style.borderColor = themeColor + '50';
      e.currentTarget.style.boxShadow = `0 8px 24px rgba(0, 0, 0, 0.3), 0 0 12px ${themeColor}10`;
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.transform = 'translateY(0)';
      e.currentTarget.style.borderColor = '#2a2a2a';
      e.currentTarget.style.boxShadow = 'none';
    }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <span style={{ 
            color: '#fff', 
            fontSize: '1.1rem', 
            fontWeight: '700',
            fontFamily: "'Cinzel', 'Times New Roman', serif"
          }}>
            Kingdom {review.kingdom_number}
          </span>
          <span style={{ color: '#fbbf24', fontSize: '0.9rem' }}>
            {'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}
          </span>
          {review.helpful_count > 0 && (
            <span style={{ 
              fontSize: '0.75rem', 
              color: '#22d3ee',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem'
            }}>
              👍 {review.helpful_count}
            </span>
          )}
        </div>
        <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>
          {new Date(review.created_at).toLocaleDateString()}
        </span>
      </div>
      <p style={{ color: '#9ca3af', fontSize: '0.9rem', lineHeight: 1.6, margin: 0 }}>
        {review.comment}
      </p>
    </div>
  );

  // Quick Actions Bar - mobile optimized with proper touch targets
  const QuickActionsBar = () => (
    <div style={{
      display: 'flex',
      flexDirection: isMobile ? 'column' : 'row',
      flexWrap: 'wrap',
      gap: isMobile ? '0.5rem' : '0.75rem',
      marginBottom: isMobile ? '1rem' : '1.5rem'
    }}>
      {profile?.home_kingdom && (
        <button
          onClick={() => navigate(`/kingdom/${profile.home_kingdom}`)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: isMobile ? 'center' : 'flex-start',
            gap: '0.5rem',
            padding: isMobile ? '0.875rem 1rem' : '0.6rem 1rem',
            minHeight: isMobile ? '48px' : 'auto',
            width: isMobile ? '100%' : 'auto',
            backgroundColor: '#131318',
            border: `1px solid ${themeColor}40`,
            borderRadius: '10px',
            color: '#fff',
            fontSize: isMobile ? '0.9rem' : '0.85rem',
            fontWeight: '500',
            cursor: 'pointer',
            transition: 'all 0.2s',
            WebkitTapHighlightColor: 'transparent'
          }}
          onMouseEnter={(e) => {
            if (!isMobile) {
              e.currentTarget.style.backgroundColor = `${themeColor}15`;
              e.currentTarget.style.borderColor = themeColor;
            }
          }}
          onMouseLeave={(e) => {
            if (!isMobile) {
              e.currentTarget.style.backgroundColor = '#131318';
              e.currentTarget.style.borderColor = `${themeColor}40`;
            }
          }}
        >
          <span>🏠</span>
          <span>View Home Kingdom</span>
        </button>
      )}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Quick Actions Bar */}
      <QuickActionsBar />

      {/* Home Kingdom Stats */}
      {homeKingdomData && (
        <div style={{
          backgroundColor: '#111116',
          borderRadius: '12px',
          padding: isMobile ? '1.25rem' : '1.5rem',
          border: `1px solid ${themeColor}30`
        }}>
          <h3 style={{ color: '#fff', fontSize: '1.1rem', fontWeight: '600', marginBottom: '1rem', textAlign: 'center' }}>
            Home Kingdom Stats
          </h3>
          <KingdomCard kingdom={homeKingdomData} showRemove={false} />
        </div>
      )}


      {/* Favorite Kingdoms - Top 5 by Atlas Score */}
      {favoriteKingdoms.length > 0 && (
        <div style={{
          backgroundColor: '#111116',
          borderRadius: '12px',
          padding: isMobile ? '1.25rem' : '1.5rem',
          border: '1px solid #2a2a2a'
        }}>
          <h3 style={{ color: '#fff', fontSize: '1.1rem', fontWeight: '600', marginBottom: '1rem', textAlign: 'center' }}>
              Favorites
              <span style={{ fontSize: '0.8rem', color: '#6b7280', fontWeight: 'normal', marginLeft: '0.5rem' }}>
                ({favoriteKingdoms.length})
              </span>
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
            {(showAllFavorites ? favoriteKingdoms : favoriteKingdoms.slice(0, 5)).map((kingdom) => (
              <MiniKingdomCard 
                key={kingdom.kingdom_number} 
                kingdom={kingdom} 
                rank={kingdom.rank || 0}
                onRemove={() => removeFromFavorites(kingdom.kingdom_number)} 
                themeColor={themeColor} 
                isMobile={isMobile}
                navigate={navigate}
              />
            ))}
          </div>
          {favoriteKingdoms.length > 5 && (
            <button
              onClick={() => setShowAllFavorites(!showAllFavorites)}
              style={{
                width: '100%',
                padding: '0.75rem',
                marginTop: '1rem',
                backgroundColor: 'transparent',
                border: `1px solid ${themeColor}40`,
                borderRadius: '8px',
                color: themeColor,
                fontSize: '0.85rem',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = `${themeColor}10`;
                e.currentTarget.style.borderColor = themeColor;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.borderColor = `${themeColor}40`;
              }}
            >
              {showAllFavorites ? '▲ Show Less' : `▼ View All ${favoriteKingdoms.length} Favorites`}
            </button>
          )}
        </div>
      )}

      {/* Kingdom Watchlist */}
      {watchlist.length > 0 && (
        <div style={{
          backgroundColor: '#111116',
          borderRadius: '12px',
          padding: isMobile ? '1.25rem' : '1.5rem',
          border: '1px solid #2a2a2a'
        }}>
          <h3 style={{ color: '#fff', fontSize: '1.1rem', fontWeight: '600', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            👁️ Watchlist ({watchlist.length})
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            {watchlist.map(kingdomNumber => (
              <KingCardLoader key={kingdomNumber} kingdomNumber={kingdomNumber} onRemove={() => removeFromWatchlist(kingdomNumber)} themeColor={themeColor} isMobile={isMobile} />
            ))}
          </div>
        </div>
      )}

      {/* Review History - Most Recent 5 */}
      {reviews.length > 0 && (
        <div style={{
          backgroundColor: '#111116',
          borderRadius: '12px',
          padding: isMobile ? '1.25rem' : '1.5rem',
          border: '1px solid #2a2a2a'
        }}>
          <h3 style={{ color: '#fff', fontSize: '1.1rem', fontWeight: '600', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              Review History
              <span style={{ fontSize: '0.8rem', color: '#6b7280', fontWeight: 'normal' }}>
                ({reviews.length})
              </span>
              {/* Top Reviewer Badge */}
              {isTopReviewer && (
                <span style={{
                  fontSize: '0.65rem',
                  padding: '0.2rem 0.5rem',
                  backgroundColor: '#22d3ee15',
                  border: '1px solid #22d3ee40',
                  borderRadius: '4px',
                  color: '#22d3ee',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem'
                }}>
                  ⭐ TOP REVIEWER
                </span>
              )}
              {/* Helpful count */}
              {totalHelpfulCount > 0 && (
                <span style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 'normal' }}>
                  • 👍 {totalHelpfulCount} helpful
                </span>
              )}
            </span>
            <span style={{ fontSize: '0.7rem', color: '#6b7280', fontWeight: 'normal' }}>
              Most Recent First
            </span>
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {(showAllReviews ? sortedReviews : sortedReviews.slice(0, 5)).map(review => (
              <ReviewCard key={review.id} review={review} />
            ))}
          </div>
          {reviews.length > 5 && (
            <button
              onClick={() => setShowAllReviews(!showAllReviews)}
              style={{
                width: '100%',
                padding: '0.75rem',
                marginTop: '1rem',
                backgroundColor: 'transparent',
                border: `1px solid ${themeColor}40`,
                borderRadius: '8px',
                color: themeColor,
                fontSize: '0.85rem',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = `${themeColor}10`;
                e.currentTarget.style.borderColor = themeColor;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.borderColor = `${themeColor}40`;
              }}
            >
              {showAllReviews ? '▲ Show Less' : `▼ View All ${reviews.length} Reviews`}
            </button>
          )}
        </div>
      )}

      {/* Empty State - mobile optimized */}
      {favorites.length === 0 && watchlist.length === 0 && reviews.length === 0 && !homeKingdomData && (
        <div style={{
          backgroundColor: '#111116',
          borderRadius: isMobile ? '10px' : '12px',
          padding: isMobile ? '2rem 1.25rem' : '3rem 2rem',
          border: '1px solid #2a2a2a',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: isMobile ? '2.5rem' : '3rem', marginBottom: isMobile ? '0.75rem' : '1rem' }}>🎯</div>
          <h3 style={{ 
            color: '#fff', 
            fontSize: isMobile ? '1.1rem' : '1.25rem', 
            fontWeight: '600', 
            marginBottom: '0.75rem' 
          }}>
            Start Building Your Profile
          </h3>
          <p style={{ 
            color: '#6b7280', 
            fontSize: isMobile ? '0.875rem' : '0.95rem', 
            marginBottom: isMobile ? '1.25rem' : '1.5rem', 
            lineHeight: 1.6,
            padding: isMobile ? '0 0.5rem' : 0
          }}>
            Add kingdoms to your favorites, create a watchlist, and write reviews to personalize your profile.
          </p>
          <Link 
            to="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: isMobile ? '0.875rem 2rem' : '0.75rem 2rem',
              minHeight: isMobile ? '48px' : 'auto',
              background: `linear-gradient(135deg, ${themeColor} 0%, ${themeColor}80 100%)`,
              border: 'none',
              borderRadius: '10px',
              color: '#000',
              fontWeight: 'bold',
              fontSize: isMobile ? '0.95rem' : '1rem',
              textDecoration: 'none',
              transition: 'transform 0.2s, box-shadow 0.2s',
              WebkitTapHighlightColor: 'transparent'
            }}
            onMouseEnter={(e) => {
              if (!isMobile) {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = `0 4px 20px ${themeColor}40`;
              }
            }}
            onMouseLeave={(e) => {
              if (!isMobile) {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }
            }}
          >
            Browse Kingdoms
          </Link>
        </div>
      )}
    </div>
  );
};

// Helper component to load kingdom data
const KingCardLoader: React.FC<{ kingdomNumber: number; onRemove: () => void; themeColor: string; isMobile: boolean }> = ({ kingdomNumber, onRemove, themeColor, isMobile }) => {
  const navigate = useNavigate();
  const [kingdom, setKingdom] = useState<Kingdom | null>(null);
  const [loading, setLoading] = useState(true);

  const neonGlow = (color: string) => ({
    color: color,
    textShadow: `0 0 8px ${color}40, 0 0 12px ${color}20`
  });

  useEffect(() => {
    apiService.getKingdomProfile(kingdomNumber)
      .then(setKingdom)
      .catch(() => setKingdom(null))
      .finally(() => setLoading(false));
  }, [kingdomNumber]);

  if (loading) {
    return (
      <div style={{
        backgroundColor: '#111116',
        borderRadius: '12px',
        padding: '1.25rem',
        border: '1px solid #2a2a2a',
        textAlign: 'center',
        color: '#6b7280'
      }}>
        Loading K-{kingdomNumber}...
      </div>
    );
  }

  if (!kingdom) {
    return (
      <div style={{
        backgroundColor: '#111116',
        borderRadius: '12px',
        padding: '1.25rem',
        border: '1px solid #2a2a2a',
        textAlign: 'center',
        color: '#ef4444'
      }}>
        K-{kingdomNumber} not found in database
        <button
          onClick={onRemove}
          style={{
            display: 'block',
            margin: '0.5rem auto 0',
            padding: '0.25rem 0.75rem',
            backgroundColor: '#ef4444',
            border: 'none',
            borderRadius: '4px',
            color: '#fff',
            fontSize: '0.75rem',
            cursor: 'pointer'
          }}
        >
          Remove
        </button>
      </div>
    );
  }

  const tier = kingdom.power_tier ?? getPowerTier(kingdom.overall_score);
  const tierColors = { S: '#fbbf24', A: '#22c55e', B: '#3b82f6', C: '#9ca3af', D: '#6b7280' };

  return (
    <div style={{
      backgroundColor: '#111116',
      borderRadius: '12px',
      padding: isMobile ? '1rem' : '1.25rem',
      border: '1px solid #2a2a2a',
      position: 'relative',
      transition: 'transform 0.2s, border-color 0.2s',
      cursor: 'pointer'
    }}
    onClick={() => navigate(`/kingdom/${kingdom.kingdom_number}`)}
    onMouseEnter={(e) => {
      e.currentTarget.style.transform = 'translateY(-2px)';
      e.currentTarget.style.borderColor = themeColor + '40';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.transform = 'translateY(0)';
      e.currentTarget.style.borderColor = '#1f1f1f';
    }}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        style={{
          position: 'absolute',
          top: '0.5rem',
          right: '0.5rem',
          background: 'none',
          border: 'none',
          color: '#ef4444',
          cursor: 'pointer',
          fontSize: '1.25rem',
          opacity: 0.7,
          transition: 'opacity 0.2s'
        }}
        onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
        onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'}
      >
        ✕
      </button>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ color: '#fff', fontSize: isMobile ? '1.1rem' : '1.25rem', fontWeight: 'bold' }}>
            K-{kingdom.kingdom_number}
          </span>
          <span style={{
            padding: '0.2rem 0.5rem',
            borderRadius: '4px',
            fontSize: '0.7rem',
            fontWeight: 'bold',
            backgroundColor: `${tierColors[tier]}20`,
            color: tierColors[tier]
          }}>
            {tier}-Tier
          </span>
        </div>
        <span style={{ ...neonGlow(themeColor), fontSize: isMobile ? '1.1rem' : '1.25rem', fontWeight: 'bold' }}>
          {kingdom.overall_score.toFixed(1)}
        </span>
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', fontSize: '0.8rem' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#6b7280' }}>KvKs</div>
          <div style={{ color: themeColor, fontWeight: 'bold' }}>{kingdom.total_kvks}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#6b7280' }}>Prep</div>
          <div style={{ color: kingdom.prep_win_rate >= 0.8 ? '#22c55e' : '#ef4444', fontWeight: 'bold' }}>
            {Math.round(kingdom.prep_win_rate * 100)}%
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#6b7280' }}>Battle</div>
          <div style={{ color: kingdom.battle_win_rate >= 0.8 ? '#22c55e' : '#ef4444', fontWeight: 'bold' }}>
            {Math.round(kingdom.battle_win_rate * 100)}%
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileFeatures;
