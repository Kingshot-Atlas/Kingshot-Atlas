// C4: Leaderboard for top data contributors
import React from 'react';
import { Link } from 'react-router-dom';
import { contributorService } from '../services/contributorService';

interface ContributorLeaderboardProps {
  limit?: number;
  showBadges?: boolean;
  themeColor?: string;
}

const ContributorLeaderboard: React.FC<ContributorLeaderboardProps> = ({ 
  limit = 10, 
  showBadges = true,
  themeColor = '#22d3ee'
}) => {
  const leaderboard = contributorService.getLeaderboard(limit);

  if (leaderboard.length === 0) {
    return (
      <div style={{
        backgroundColor: '#111116',
        borderRadius: '16px',
        padding: '1.5rem',
        border: '1px solid #2a2a2a',
        textAlign: 'center'
      }}>
        <h3 style={{ color: '#fff', fontSize: '1rem', fontWeight: '600', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
          <span>🏆</span> Top Data Contributors
        </h3>
        <p style={{ color: '#6b7280', fontSize: '0.85rem' }}>
          No contributions yet. Be the first to help improve our data!
        </p>
      </div>
    );
  }

  const getMedalEmoji = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  return (
    <div style={{
      backgroundColor: '#111116',
      borderRadius: '16px',
      padding: '1.5rem',
      border: '1px solid #2a2a2a'
    }}>
      <h3 style={{ color: '#fff', fontSize: '1rem', fontWeight: '600', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span>🏆</span> Top Data Contributors
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {leaderboard.map((contributor, index) => {
          const totalApproved = contributor.submissions.approved + contributor.corrections.approved + contributor.kvkErrors.approved;
          const rank = index + 1;
          const isTopThree = rank <= 3;

          return (
            <Link
              key={contributor.userId}
              to={`/profile/${contributor.userId}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem',
                backgroundColor: isTopThree ? `${themeColor}10` : '#0a0a0a',
                borderRadius: '8px',
                border: isTopThree ? `1px solid ${themeColor}30` : '1px solid #1a1a1f',
                textDecoration: 'none',
                transition: 'all 0.2s'
              }}
            >
              {/* Rank */}
              <div style={{
                minWidth: '2rem',
                textAlign: 'center',
                fontSize: isTopThree ? '1.25rem' : '0.85rem',
                fontWeight: isTopThree ? 700 : 500,
                color: isTopThree ? '#fff' : '#6b7280'
              }}>
                {getMedalEmoji(rank)}
              </div>

              {/* User Info */}
              <div style={{ flex: 1 }}>
                <div style={{ 
                  color: '#fff', 
                  fontSize: '0.9rem', 
                  fontWeight: isTopThree ? 600 : 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  {contributor.username}
                  {/* Show top badges */}
                  {showBadges && contributor.badges.slice(0, 3).map(badgeId => {
                    const badge = contributorService.getBadgeInfo(badgeId);
                    return (
                      <span key={badgeId} title={badge.name} style={{ fontSize: '0.9rem' }}>
                        {badge.icon}
                      </span>
                    );
                  })}
                </div>
                <div style={{ color: '#6b7280', fontSize: '0.7rem' }}>
                  Rep: {contributor.reputation} • {contributor.badges.length} badges
                </div>
              </div>

              {/* Stats */}
              <div style={{ textAlign: 'right' }}>
                <div style={{ 
                  color: themeColor, 
                  fontSize: '1.1rem', 
                  fontWeight: 700 
                }}>
                  {totalApproved}
                </div>
                <div style={{ color: '#6b7280', fontSize: '0.65rem' }}>approved</div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* CTA */}
      <div style={{ 
        marginTop: '1rem', 
        padding: '0.75rem', 
        backgroundColor: '#0a0a0a', 
        borderRadius: '8px',
        textAlign: 'center'
      }}>
        <p style={{ color: '#9ca3af', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
          Help improve kingdom data and climb the leaderboard!
        </p>
        <Link to="/kingdoms" style={{
          display: 'inline-block',
          padding: '0.4rem 0.75rem',
          backgroundColor: `${themeColor}20`,
          border: `1px solid ${themeColor}50`,
          borderRadius: '6px',
          color: themeColor,
          fontSize: '0.8rem',
          textDecoration: 'none',
          fontWeight: 500
        }}>
          Browse Kingdoms →
        </Link>
      </div>
    </div>
  );
};

export default ContributorLeaderboard;
