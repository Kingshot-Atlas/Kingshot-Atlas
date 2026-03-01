import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Kingdom } from '../types';
import { apiService, dataLoadError } from '../services/api';
import { DataLoadError } from '../components/DataLoadError';
import { LeaderboardSkeleton } from '../components/Skeleton';
import { logger } from '../utils/logger';
import { useIsMobile } from '../hooks/useMediaQuery';
import { neonGlow, FONT_DISPLAY, colors } from '../utils/styles';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { scoreHistoryService } from '../services/scoreHistoryService';
import { useScrollDepth } from '../hooks/useScrollDepth';
import { useTranslation } from 'react-i18next';
import Breadcrumbs from '../components/Breadcrumbs';
import { getTierColorFromScore } from '../utils/atlasScoreFormula';

const Top100Leaderboard: React.FC = () => {
  const { t } = useTranslation();
  useDocumentTitle(t('top100.pageTitle', 'Top 100 Leaderboard'));
  useScrollDepth('Top 100 Leaderboard');

  const [kingdoms, setKingdoms] = useState<Kingdom[]>([]);
  const [loading, setLoading] = useState(true);
  const [rankMovers, setRankMovers] = useState<Map<number, number>>(new Map());
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [data, movers] = await Promise.all([
        apiService.getKingdoms(),
        scoreHistoryService.getRankMovers()
      ]);
      setKingdoms(data);

      // Build rank change map from movers data
      if (movers) {
        const changeMap = new Map<number, number>();
        for (const m of movers.climbers) {
          changeMap.set(m.kingdom_number, m.rank_delta);
        }
        for (const m of movers.fallers) {
          changeMap.set(m.kingdom_number, m.rank_delta);
        }
        setRankMovers(changeMap);
      }
    } catch (error) {
      logger.error('Failed to load top 100 data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Sort by Atlas Score descending, take top 100
  const top100 = useMemo(() =>
    [...kingdoms].sort((a, b) => b.overall_score - a.overall_score).slice(0, 100),
    [kingdoms]
  );

  const breadcrumbs = [
    { name: t('common.home', 'Home'), url: '/' },
    { name: t('nav.rankings', 'Rankings'), url: '/rankings' },
    { name: t('top100.title', 'Top 100'), url: '/rankings/top-100' },
  ];

  const getRankBadge = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  const getRankStyle = (rank: number): React.CSSProperties => {
    if (rank === 1) return { ...neonGlow('#fbbf24'), fontWeight: 'bold' };
    if (rank === 2) return { ...neonGlow('#9ca3af'), fontWeight: 'bold' };
    if (rank === 3) return { ...neonGlow('#f97316'), fontWeight: 'bold' };
    return { color: colors.textMuted };
  };

  const getRankChangeDisplay = (kingdomNumber: number) => {
    const delta = rankMovers.get(kingdomNumber);
    if (delta === undefined || delta === 0) {
      return { text: '—', color: colors.textMuted, icon: '' };
    }
    if (delta > 0) {
      return { text: `${delta}`, color: '#22c55e', icon: '▲' };
    }
    return { text: `${Math.abs(delta)}`, color: '#ef4444', icon: '▼' };
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.bg }}>
      {/* Hero Section */}
      <div style={{
        padding: isMobile ? '1.25rem 1rem 1rem' : '1.75rem 2rem 1.25rem',
        textAlign: 'center',
        background: 'linear-gradient(180deg, #111111 0%, #0a0a0a 100%)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ position: 'relative', zIndex: 1, maxWidth: '800px', margin: '0 auto' }}>
          <Breadcrumbs items={breadcrumbs} />
          <h1 style={{
            fontSize: isMobile ? '1.5rem' : '2rem',
            fontWeight: 'bold',
            marginBottom: '0.5rem',
            fontFamily: FONT_DISPLAY
          }}>
            <span style={{ color: '#fff' }}>TOP 100</span>
            <span style={{ ...neonGlow(colors.primary), marginLeft: '0.5rem', fontSize: isMobile ? '1.6rem' : '2.25rem' }}>LEADERBOARD</span>
          </h1>
          <p style={{ color: colors.textMuted, fontSize: isMobile ? '0.8rem' : '0.9rem', marginBottom: '0.75rem' }}>
            {t('top100.subtitle', 'The definitive ranking of the top 100 kingdoms by Atlas Score. Track who climbs and who falls after each KvK.')}
          </p>
          {!isMobile && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: '50px', height: '2px', background: 'linear-gradient(90deg, transparent, #22d3ee)' }} />
              <div style={{ width: '6px', height: '6px', backgroundColor: '#22d3ee', transform: 'rotate(45deg)', boxShadow: '0 0 8px #22d3ee' }} />
              <div style={{ width: '50px', height: '2px', background: 'linear-gradient(90deg, #22d3ee, transparent)' }} />
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: isMobile ? '1rem' : '1.5rem 2rem' }}>
        {loading ? (
          <LeaderboardSkeleton rows={20} />
        ) : dataLoadError ? (
          <DataLoadError onRetry={loadData} />
        ) : top100.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem 0', color: colors.textMuted }}>
            <p>{t('rankings.noData', 'No kingdom data available.')}</p>
          </div>
        ) : (
          <div style={{
            backgroundColor: colors.card,
            borderRadius: '12px',
            border: `1px solid ${colors.border}`,
            overflow: 'hidden'
          }}>
            {/* Table */}
            <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: isMobile ? '0.75rem' : '0.85rem',
                minWidth: isMobile ? '520px' : 'auto'
              }}>
                <thead>
                  <tr style={{
                    borderBottom: `1px solid ${colors.border}`,
                    backgroundColor: '#0d0d12'
                  }}>
                    {[
                      { label: t('top100.colRank', '#'), width: isMobile ? '36px' : '50px', align: 'center' as const },
                      { label: t('top100.colKingdom', 'Kingdom'), width: 'auto', align: 'left' as const },
                      { label: t('top100.colAtlasScore', 'Atlas Score'), width: isMobile ? '70px' : '95px', align: 'center' as const },
                      { label: t('top100.colKvks', 'KvKs'), width: isMobile ? '40px' : '55px', align: 'center' as const },
                      { label: t('top100.colPrepWR', 'Prep WR'), width: isMobile ? '55px' : '75px', align: 'center' as const },
                      { label: t('top100.colBattleWR', 'Battle WR'), width: isMobile ? '60px' : '80px', align: 'center' as const },
                      { label: t('top100.colChange', 'Change'), width: isMobile ? '52px' : '70px', align: 'center' as const },
                    ].map((col, ci) => (
                      <th key={ci} style={{
                        padding: isMobile ? '0.65rem 0.3rem' : '0.75rem 0.6rem',
                        color: colors.textSecondary,
                        fontWeight: '600',
                        fontSize: isMobile ? '0.6rem' : '0.7rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        textAlign: col.align,
                        width: col.width,
                        whiteSpace: 'nowrap',
                      }}>
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {top100.map((kingdom, index) => {
                    const rank = index + 1;
                    const change = getRankChangeDisplay(kingdom.kingdom_number);
                    const tierColor = getTierColorFromScore(kingdom.overall_score);
                    const isTopThree = rank <= 3;

                    return (
                      <tr
                        key={kingdom.kingdom_number}
                        style={{
                          borderBottom: index < top100.length - 1 ? `1px solid ${colors.borderSubtle}` : 'none',
                          backgroundColor: isTopThree ? `${tierColor}06` : 'transparent',
                          cursor: 'pointer',
                          transition: 'background-color 0.15s',
                        }}
                        onClick={() => navigate(`/kingdom/${kingdom.kingdom_number}`)}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.surfaceHover}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = isTopThree ? `${tierColor}06` : 'transparent'}
                      >
                        {/* Rank */}
                        <td style={{
                          padding: isMobile ? '0.55rem 0.3rem' : '0.6rem 0.6rem',
                          textAlign: 'center',
                          whiteSpace: 'nowrap',
                        }}>
                          <span style={{
                            ...getRankStyle(rank),
                            fontSize: isMobile ? '0.72rem' : '0.82rem'
                          }}>
                            {getRankBadge(rank)}
                          </span>
                        </td>

                        {/* Kingdom */}
                        <td style={{
                          padding: isMobile ? '0.55rem 0.3rem' : '0.6rem 0.6rem',
                          textAlign: 'left',
                          whiteSpace: 'nowrap',
                        }}>
                          <Link
                            to={`/kingdom/${kingdom.kingdom_number}`}
                            style={{
                              color: '#fff',
                              fontWeight: isTopThree ? '600' : '500',
                              textDecoration: 'none',
                              fontSize: isMobile ? '0.75rem' : '0.85rem'
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {t('common.kingdom')} {kingdom.kingdom_number}
                          </Link>
                        </td>

                        {/* Atlas Score */}
                        <td style={{
                          padding: isMobile ? '0.55rem 0.3rem' : '0.6rem 0.6rem',
                          textAlign: 'center',
                          whiteSpace: 'nowrap',
                        }}>
                          <span style={{
                            ...neonGlow(tierColor),
                            fontWeight: 'bold',
                            fontSize: isMobile ? '0.78rem' : '0.88rem'
                          }}>
                            {kingdom.overall_score.toFixed(2)}
                          </span>
                        </td>

                        {/* KvKs */}
                        <td style={{
                          padding: isMobile ? '0.55rem 0.3rem' : '0.6rem 0.6rem',
                          textAlign: 'center',
                          color: colors.textSecondary,
                          whiteSpace: 'nowrap',
                        }}>
                          {kingdom.total_kvks}
                        </td>

                        {/* Prep WR */}
                        <td style={{
                          padding: isMobile ? '0.55rem 0.3rem' : '0.6rem 0.6rem',
                          textAlign: 'center',
                          whiteSpace: 'nowrap',
                          color: kingdom.prep_win_rate >= 0.6 ? '#22c55e' : kingdom.prep_win_rate >= 0.4 ? colors.textSecondary : '#ef4444',
                          fontWeight: '500',
                        }}>
                          {(kingdom.prep_win_rate * 100).toFixed(0)}%
                        </td>

                        {/* Battle WR */}
                        <td style={{
                          padding: isMobile ? '0.55rem 0.3rem' : '0.6rem 0.6rem',
                          textAlign: 'center',
                          whiteSpace: 'nowrap',
                          color: kingdom.battle_win_rate >= 0.6 ? '#22c55e' : kingdom.battle_win_rate >= 0.4 ? colors.textSecondary : '#ef4444',
                          fontWeight: '500',
                        }}>
                          {(kingdom.battle_win_rate * 100).toFixed(0)}%
                        </td>

                        {/* Rank Change */}
                        <td style={{
                          padding: isMobile ? '0.55rem 0.3rem' : '0.6rem 0.6rem',
                          textAlign: 'center',
                          whiteSpace: 'nowrap',
                        }}>
                          <span style={{
                            color: change.color,
                            fontWeight: change.icon ? 'bold' : '400',
                            fontSize: isMobile ? '0.72rem' : '0.82rem',
                            ...(change.icon ? neonGlow(change.color) : {})
                          }}>
                            {change.icon}{change.text}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer info */}
            <div style={{
              padding: isMobile ? '0.6rem 0.75rem' : '0.75rem 1rem',
              borderTop: `1px solid ${colors.border}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.5rem',
            }}>
              <span style={{ color: colors.textMuted, fontSize: isMobile ? '0.65rem' : '0.72rem' }}>
                {t('top100.footerTotal', '{{count}} kingdoms tracked', { count: kingdoms.length })}
              </span>
              <span style={{ color: colors.textMuted, fontSize: isMobile ? '0.65rem' : '0.72rem' }}>
                {t('top100.footerRankChange', 'Rank changes reflect the latest KvK results')}
              </span>
            </div>
          </div>
        )}

        {/* Back links */}
        <div style={{ textAlign: 'center', marginTop: '2rem', paddingBottom: '1rem', display: 'flex', justifyContent: 'center', gap: '1.5rem' }}>
          <Link to="/rankings" style={{ color: colors.primary, textDecoration: 'none', fontSize: '0.8rem' }}>
            {t('top100.backToRankings', '← Back to Rankings')}
          </Link>
          <Link to="/" style={{ color: colors.primary, textDecoration: 'none', fontSize: '0.8rem' }}>
            {t('common.backToHome', 'Back to Home')}
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Top100Leaderboard;
