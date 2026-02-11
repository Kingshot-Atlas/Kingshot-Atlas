import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Kingdom, getPowerTier, TIER_DESCRIPTIONS } from '../types';
import { apiService } from '../services/api';
import { getTierColor, neonGlow, FONT_DISPLAY } from '../utils/styles';
import { useIsMobile } from '../hooks/useMediaQuery';

const MetaAnalysis: React.FC = () => {
  const { t } = useTranslation();
  const [kingdoms, setKingdoms] = useState<Kingdom[]>([]);
  const [loading, setLoading] = useState(true);
  const isMobile = useIsMobile();

  useEffect(() => {
    loadKingdoms();
  }, []);

  const loadKingdoms = async () => {
    try {
      const data = await apiService.getKingdoms();
      // apiService.getKingdoms() always returns Kingdom[]
      setKingdoms(data);
    } catch (e) {
      console.error('Failed to load kingdoms:', e);
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    if (kingdoms.length === 0) return null;

    // Tier distribution
    const tierCounts = { S: 0, A: 0, B: 0, C: 0, D: 0 };
    kingdoms.forEach(k => {
      const tier = getPowerTier(k.overall_score);
      tierCounts[tier]++;
    });

    // Average stats
    const avgScore = kingdoms.reduce((sum, k) => sum + k.overall_score, 0) / kingdoms.length;
    const avgPrepWR = kingdoms.reduce((sum, k) => sum + k.prep_win_rate, 0) / kingdoms.length;
    const avgBattleWR = kingdoms.reduce((sum, k) => sum + k.battle_win_rate, 0) / kingdoms.length;
    const avgKvks = kingdoms.reduce((sum, k) => sum + k.total_kvks, 0) / kingdoms.length;

    // Status distribution
    const statusCounts = { Leading: 0, Ordinary: 0, Unannounced: 0 };
    kingdoms.forEach(k => {
      const status = k.most_recent_status || 'Unannounced';
      if (status in statusCounts) statusCounts[status as keyof typeof statusCounts]++;
    });

    // Top performers
    const topByScore = [...kingdoms].sort((a, b) => b.overall_score - a.overall_score).slice(0, 5);
    const topByPrepWR = [...kingdoms].filter(k => k.total_kvks >= 3).sort((a, b) => b.prep_win_rate - a.prep_win_rate).slice(0, 5);
    const topByBattleWR = [...kingdoms].filter(k => k.total_kvks >= 3).sort((a, b) => b.battle_win_rate - a.battle_win_rate).slice(0, 5);

    // Undefeated kingdoms
    const undefeatedPrep = kingdoms.filter(k => k.prep_losses === 0 && k.prep_wins > 0);
    const undefeatedBattle = kingdoms.filter(k => k.battle_losses === 0 && k.battle_wins > 0);
    const undefeatedOverall = kingdoms.filter(k => k.prep_losses === 0 && k.battle_losses === 0 && k.total_kvks > 0);

    return {
      total: kingdoms.length,
      tierCounts,
      avgScore,
      avgPrepWR,
      avgBattleWR,
      avgKvks,
      statusCounts,
      topByScore,
      topByPrepWR,
      topByBattleWR,
      undefeatedPrep,
      undefeatedBattle,
      undefeatedOverall
    };
  }, [kingdoms]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div className="loading-spinner" />
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a' }}>
      {/* Header */}
      <div style={{ 
        padding: isMobile ? '1.25rem 1rem' : '1.75rem 2rem',
        textAlign: 'center',
        background: 'linear-gradient(180deg, #111111 0%, #0a0a0a 100%)'
      }}>
        <h1 style={{ 
          fontSize: isMobile ? '1.5rem' : '2rem', 
          fontWeight: 'bold',
          fontFamily: FONT_DISPLAY,
          marginBottom: '0.5rem'
        }}>
          <span style={{ color: '#fff' }}>{t('metaAnalysis.title1')}</span>
          <span style={{ ...neonGlow('#22d3ee'), marginLeft: '0.5rem' }}>{t('metaAnalysis.title2')}</span>
        </h1>
        <p style={{ color: '#6b7280', fontSize: '0.9rem' }}>
          {t('metaAnalysis.subtitle', { count: stats.total.toLocaleString() } as Record<string, string>)}
        </p>
      </div>

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: isMobile ? '1rem' : '2rem' }}>
        {/* Overview Stats */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', 
          gap: '1rem',
          marginBottom: '2rem'
        }}>
          {[
            { label: t('metaAnalysis.avgAtlasScore'), value: stats.avgScore.toFixed(2), color: '#22d3ee' },
            { label: t('metaAnalysis.avgPrepWR'), value: `${Math.round(stats.avgPrepWR * 100)}%`, color: '#eab308' },
            { label: t('metaAnalysis.avgBattleWR'), value: `${Math.round(stats.avgBattleWR * 100)}%`, color: '#f97316' },
            { label: t('metaAnalysis.avgKvks'), value: stats.avgKvks.toFixed(1), color: '#a855f7' }
          ].map((stat, i) => (
            <div key={i} style={{
              backgroundColor: '#131318',
              borderRadius: '12px',
              border: '1px solid #2a2a2a',
              padding: '1.25rem',
              textAlign: 'center'
            }}>
              <div style={{ color: stat.color, fontSize: '1.75rem', fontWeight: '700' }}>{stat.value}</div>
              <div style={{ color: '#6b7280', fontSize: '0.8rem', marginTop: '0.25rem' }}>{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Tier Distribution */}
        <div style={{
          backgroundColor: '#131318',
          borderRadius: '12px',
          border: '1px solid #2a2a2a',
          padding: '1.5rem',
          marginBottom: '2rem'
        }}>
          <h2 style={{ color: '#fff', fontSize: '1.1rem', fontWeight: '600', marginBottom: '1rem' }}>
            {t('metaAnalysis.tierDistribution')}
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {(['S', 'A', 'B', 'C', 'D'] as const).map(tier => {
              const count = stats.tierCounts[tier];
              const pct = (count / stats.total) * 100;
              const color = getTierColor(tier);
              
              return (
                <div key={tier} style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '0.5rem' : '1rem' }}>
                  <div style={{ 
                    minWidth: isMobile ? '50px' : '80px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '0.5rem' 
                  }}>
                    <span style={{ 
                      padding: '0.2rem 0.5rem', 
                      backgroundColor: `${color}20`, 
                      color, 
                      fontWeight: '600',
                      borderRadius: '4px',
                      fontSize: isMobile ? '0.7rem' : '0.8rem'
                    }}>
                      {tier}-Tier
                    </span>
                  </div>
                  <div style={{ flex: 1, height: '24px', backgroundColor: '#1a1a20', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ 
                      width: `${pct}%`, 
                      height: '100%', 
                      backgroundColor: color,
                      transition: 'width 0.5s ease'
                    }} />
                  </div>
                  <div style={{ minWidth: isMobile ? '70px' : '100px', textAlign: 'right' }}>
                    <span style={{ color: '#fff', fontWeight: '600', fontSize: isMobile ? '0.85rem' : '1rem' }}>{count}</span>
                    <span style={{ color: '#6b7280', fontSize: isMobile ? '0.7rem' : '0.8rem', marginLeft: '0.35rem' }}>({pct.toFixed(1)}%)</span>
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* Tier Legend */}
          <div style={{ 
            marginTop: '1.5rem', 
            paddingTop: '1rem', 
            borderTop: '1px solid #2a2a2a',
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(5, 1fr)',
            gap: '0.5rem'
          }}>
            {(['S', 'A', 'B', 'C', 'D'] as const).map(tier => (
              <div key={tier} style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                <span style={{ color: getTierColor(tier), fontWeight: '600' }}>{tier}:</span> {TIER_DESCRIPTIONS[tier]}
              </div>
            ))}
          </div>
        </div>

        {/* Top Performers */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', 
          gap: '1rem',
          marginBottom: '2rem'
        }}>
          {[
            { title: t('metaAnalysis.topByScore'), data: stats.topByScore, getValue: (k: Kingdom) => k.overall_score, format: (v: number) => v.toFixed(2) },
            { title: t('metaAnalysis.topPrepWR'), data: stats.topByPrepWR, getValue: (k: Kingdom) => k.prep_win_rate, format: (v: number) => `${Math.round(v * 100)}%` },
            { title: t('metaAnalysis.topBattleWR'), data: stats.topByBattleWR, getValue: (k: Kingdom) => k.battle_win_rate, format: (v: number) => `${Math.round(v * 100)}%` }
          ].map((section, i) => (
            <div key={i} style={{
              backgroundColor: '#131318',
              borderRadius: '12px',
              border: '1px solid #2a2a2a',
              padding: '1rem'
            }}>
              <h3 style={{ color: '#9ca3af', fontSize: '0.85rem', marginBottom: '0.75rem' }}>{section.title}</h3>
              {section.data.map((k, j) => (
                <Link
                  key={k.kingdom_number}
                  to={`/kingdom/${k.kingdom_number}`}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.5rem',
                    borderRadius: '6px',
                    textDecoration: 'none',
                    marginBottom: '0.25rem'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1a1a20'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ color: j < 3 ? '#fbbf24' : '#6b7280', fontSize: '0.8rem', width: '20px' }}>
                      {j === 0 ? '🥇' : j === 1 ? '🥈' : j === 2 ? '🥉' : `${j + 1}.`}
                    </span>
                    <span style={{ color: '#fff', fontWeight: '500' }}>K{k.kingdom_number}</span>
                  </div>
                  <span style={{ color: '#22d3ee', fontWeight: '600' }}>
                    {section.format(section.getValue(k))}
                  </span>
                </Link>
              ))}
            </div>
          ))}
        </div>

        {/* Undefeated Kingdoms */}
        <div style={{
          backgroundColor: '#131318',
          borderRadius: '12px',
          border: '1px solid #2a2a2a',
          padding: '1.5rem',
          marginBottom: '2rem'
        }}>
          <h2 style={{ color: '#fff', fontSize: '1.1rem', fontWeight: '600', marginBottom: '1rem' }}>
            {t('metaAnalysis.undefeatedKingdoms')}
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '1rem' }}>
            <div>
              <div style={{ color: '#eab308', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                🛡️ {t('metaAnalysis.undefeatedPrep')} ({stats.undefeatedPrep.length})
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                {stats.undefeatedPrep.slice(0, 8).map(k => (
                  <Link key={k.kingdom_number} to={`/kingdom/${k.kingdom_number}`} style={{
                    padding: '0.2rem 0.5rem',
                    backgroundColor: '#eab30815',
                    border: '1px solid #eab30830',
                    borderRadius: '4px',
                    color: '#eab308',
                    fontSize: '0.75rem',
                    textDecoration: 'none'
                  }}>
                    K{k.kingdom_number}
                  </Link>
                ))}
                {stats.undefeatedPrep.length > 8 && (
                  <span style={{ color: '#6b7280', fontSize: '0.75rem', padding: '0.2rem' }}>
                    {t('metaAnalysis.more', { count: stats.undefeatedPrep.length - 8 })}
                  </span>
                )}
              </div>
            </div>
            <div>
              <div style={{ color: '#f97316', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                ⚔️ {t('metaAnalysis.undefeatedBattle')} ({stats.undefeatedBattle.length})
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                {stats.undefeatedBattle.slice(0, 8).map(k => (
                  <Link key={k.kingdom_number} to={`/kingdom/${k.kingdom_number}`} style={{
                    padding: '0.2rem 0.5rem',
                    backgroundColor: '#f9731615',
                    border: '1px solid #f9731630',
                    borderRadius: '4px',
                    color: '#f97316',
                    fontSize: '0.75rem',
                    textDecoration: 'none'
                  }}>
                    K{k.kingdom_number}
                  </Link>
                ))}
                {stats.undefeatedBattle.length > 8 && (
                  <span style={{ color: '#6b7280', fontSize: '0.75rem', padding: '0.2rem' }}>
                    {t('metaAnalysis.more', { count: stats.undefeatedBattle.length - 8 })}
                  </span>
                )}
              </div>
            </div>
            <div>
              <div style={{ color: '#fbbf24', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                👑 {t('metaAnalysis.supremeRulers')} ({stats.undefeatedOverall.length})
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                {stats.undefeatedOverall.slice(0, 8).map(k => (
                  <Link key={k.kingdom_number} to={`/kingdom/${k.kingdom_number}`} style={{
                    padding: '0.2rem 0.5rem',
                    backgroundColor: '#fbbf2415',
                    border: '1px solid #fbbf2430',
                    borderRadius: '4px',
                    color: '#fbbf24',
                    fontSize: '0.75rem',
                    textDecoration: 'none'
                  }}>
                    K{k.kingdom_number}
                  </Link>
                ))}
                {stats.undefeatedOverall.length > 8 && (
                  <span style={{ color: '#6b7280', fontSize: '0.75rem', padding: '0.2rem' }}>
                    {t('metaAnalysis.more', { count: stats.undefeatedOverall.length - 8 })}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Back to Home */}
        <div style={{ textAlign: 'center' }}>
          <Link to="/" style={{ color: '#22d3ee', textDecoration: 'none', fontSize: '0.9rem' }}>
            {t('metaAnalysis.backToHome')}
          </Link>
        </div>
      </div>
    </div>
  );
};

export default MetaAnalysis;
