import React from 'react';
import { Link } from 'react-router-dom';
import { KingdomProfile as KingdomProfileType, getTierDescription as getCentralizedTierDescription, type PowerTier } from '../../types';
import ShareButton from '../ShareButton';
import ScoreFreshness from '../ScoreFreshness';
import SmartTooltip from '../shared/SmartTooltip';
import { neonGlow, getStatusColor, getTierColor, FONT_DISPLAY } from '../../utils/styles';
import { useTranslation } from 'react-i18next';

interface Achievement {
  icon: string;
  title: string;
  desc: string;
  color: string;
}

interface KingdomHeaderProps {
  kingdom: KingdomProfileType;
  rank: number;
  totalKingdomsAtKvk: number;
  percentileRank: number;
  atlasScore: number;
  powerTier: PowerTier;
  achievements: Achievement[];
  status: string;
  hasPendingSubmission: boolean;
  isMobile: boolean;
  recentScoreChange?: number | null;
  recentRankChange?: number | null;
  isLinked?: boolean;
  managedBy?: { username: string; userId: string } | null;
  isKingdomEditor?: boolean;
  onStatusModalOpen: () => void;
  onReportModalOpen: () => void;
}

const KingdomHeader: React.FC<KingdomHeaderProps> = ({
  kingdom,
  rank,
  totalKingdomsAtKvk,
  percentileRank,
  atlasScore,
  powerTier,
  achievements,
  status,
  hasPendingSubmission,
  isMobile,
  recentScoreChange,
  recentRankChange,
  isLinked = false,
  managedBy,
  isKingdomEditor = false,
  onStatusModalOpen,
  onReportModalOpen,
}) => {
  const { t } = useTranslation();
  const tierColor = getTierColor(powerTier);

  const getTierDescription = (tier: string) => {
    return getCentralizedTierDescription(tier as PowerTier);
  };

  const getStatusDescription = (s: string) => {
    switch (s) {
      case 'Leading': return t('transferStatuses.leadingDesc', '20 regular invites, 10 open slots, lower power cap');
      case 'Ordinary': return t('transferStatuses.ordinaryDesc', '35 regular invites, up to 3 special invites, 20 open slots, higher power cap');
      default: return t('transferStatuses.unknownDesc', 'Not yet reported');
    }
  };

  const statusColor = status === 'Unannounced' ? '#6b7280' : getStatusColor(status);
  const topPercent = 100 - percentileRank;

  return (
    <div style={{ 
      padding: isMobile ? '1.25rem 1rem 1rem' : '1.75rem 2rem 1.25rem',
      textAlign: 'center',
      background: 'linear-gradient(180deg, #111111 0%, #0a0a0a 100%)',
      position: 'relative',
      overflow: 'visible'
    }}>
      <div style={{ position: 'relative', zIndex: 1, maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center' }}>
          {/* Row 1: Kingdom name + Tier + Top% + Achievements */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
            <h1 style={{ 
              fontSize: isMobile ? '1.5rem' : '2.25rem', 
              fontWeight: 'bold', 
              color: '#ffffff',
              fontFamily: FONT_DISPLAY, 
              letterSpacing: '0.02em',
              margin: 0
            }}>
              {t('common.kingdom', 'Kingdom')} {kingdom.kingdom_number}
            </h1>
            
            {/* Power Tier Badge */}
            <SmartTooltip
              accentColor={tierColor}
              preferPosition="bottom"
              content={
                <div style={{ fontSize: '0.7rem', color: '#9ca3af' }}>
                  <span style={{ color: tierColor, fontWeight: 'bold' }}>{powerTier}-Tier</span> — {getTierDescription(powerTier)}
                </div>
              }
            >
              <div style={{
                padding: '0.2rem 0.5rem',
                borderRadius: '4px',
                fontSize: '0.7rem',
                fontWeight: 'bold',
                backgroundColor: `${tierColor}20`,
                color: tierColor,
                border: `1px solid ${tierColor}40`,
                boxShadow: powerTier === 'S' ? `0 0 8px ${tierColor}40` : 'none',
                cursor: 'default'
              }}>
                {powerTier}-Tier
              </div>
            </SmartTooltip>

            {/* Top x% Badge — next to tier (plain, no tooltip) */}
            {percentileRank > 0 && (() => {
              const pColor = percentileRank >= 90 ? '#22c55e' : percentileRank >= 70 ? '#eab308' : percentileRank >= 50 ? '#3b82f6' : '#6b7280';
              return (
                <span style={{
                  padding: '0.15rem 0.4rem',
                  borderRadius: '4px',
                  fontSize: '0.65rem',
                  fontWeight: '600',
                  backgroundColor: `${pColor}20`,
                  color: pColor,
                  border: `1px solid ${pColor}40`,
                }}>
                  Top {topPercent.toFixed(1)}%
                </span>
              );
            })()}

            {/* Achievement badges — next to tier/top% */}
            {achievements.map((a, i) => (
              <SmartTooltip
                key={i}
                accentColor={a.color}
                content={
                  <div style={{ fontSize: '0.7rem' }}>
                    <div style={{ color: a.color, fontWeight: 'bold', marginBottom: '2px' }}>{a.title}</div>
                    <div style={{ color: '#9ca3af' }}>{a.desc}</div>
                  </div>
                }
              >
                <span style={{ 
                  fontSize: '1rem', 
                  filter: `drop-shadow(0 0 4px ${a.color}60)`,
                  cursor: 'default'
                }}>
                  {a.icon}
                </span>
              </SmartTooltip>
            ))}
          </div>
          
          {/* Row 2: Atlas Score + Score Change */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
            <span style={{ color: '#6b7280', fontSize: '0.85rem' }}>{t('kingdomProfile.atlasScore', 'Atlas Score')}:</span>
            <SmartTooltip
              accentColor="#22d3ee"
              content={
                <div style={{ fontSize: '0.7rem' }}>
                  <div style={{ color: '#22d3ee', fontWeight: 'bold', marginBottom: '2px' }}>{t('kingdomProfile.atlasScore', 'Atlas Score')}</div>
                  <div style={{ color: '#9ca3af' }}>{t('kingdomProfile.atlasScoreDesc', 'Rewards experience and consistency')}</div>
                </div>
              }
            >
              <span style={{ 
                fontSize: '2rem', 
                fontWeight: '700', 
                ...neonGlow('#22d3ee'), 
                fontFamily: 'system-ui',
                cursor: 'default',
                lineHeight: 1
              }}>
                {atlasScore.toFixed(2)}
              </span>
            </SmartTooltip>
            {/* Score Change */}
            {recentScoreChange !== null && recentScoreChange !== undefined && recentScoreChange !== 0 && (
              isLinked ? (
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.2rem',
                  padding: '0.15rem 0.5rem',
                  borderRadius: '20px',
                  fontSize: '0.7rem',
                  fontWeight: '600',
                  backgroundColor: recentScoreChange > 0 ? '#22c55e12' : '#ef444412',
                  color: recentScoreChange > 0 ? '#22c55e' : '#ef4444',
                  border: `1px solid ${recentScoreChange > 0 ? '#22c55e25' : '#ef444425'}`,
                }}>
                  <span>{recentScoreChange > 0 ? '▲' : '▼'}</span>
                  <span>{recentScoreChange > 0 ? '+' : ''}{recentScoreChange.toFixed(2)} {t('kingdomProfile.lastKvk', 'last KvK')}</span>
                </span>
              ) : (
                <Link to="/profile" style={{ textDecoration: 'none' }}>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.2rem',
                    padding: '0.15rem 0.5rem',
                    borderRadius: '20px',
                    fontSize: '0.7rem',
                    fontWeight: '600',
                    backgroundColor: '#9ca3af08',
                    border: '1px solid #9ca3af15',
                    cursor: 'pointer',
                  }}>
                    <span style={{ color: '#6b7280' }}>📊</span>
                    <span style={{ filter: 'blur(4px)', userSelect: 'none', color: '#22c55e' }}>+0.00</span>
                    <span style={{ color: '#4b5563', fontSize: '0.65rem' }}>{t('kingdomProfile.linkToSee', 'Link to see')}</span>
                  </span>
                </Link>
              )
            )}
          </div>

          {/* Row 3: Atlas Rank + Rank Change */}
          {rank > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
              <span style={{ color: '#6b7280', fontSize: '0.85rem' }}>{t('kingdomProfile.atlasRank', 'Atlas Rank')}:</span>
              <span style={{ color: '#22d3ee', fontSize: '0.95rem', fontWeight: '600' }}>
                #{rank}{totalKingdomsAtKvk > 0 ? ` of ${totalKingdomsAtKvk}` : ''}
              </span>
              {/* Rank Change */}
              {recentRankChange !== null && recentRankChange !== undefined && recentRankChange !== 0 && (
                isLinked ? (
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.2rem',
                    padding: '0.15rem 0.5rem',
                    borderRadius: '20px',
                    fontSize: '0.7rem',
                    fontWeight: '600',
                    backgroundColor: recentRankChange > 0 ? '#22c55e12' : '#ef444412',
                    color: recentRankChange > 0 ? '#22c55e' : '#ef4444',
                    border: `1px solid ${recentRankChange > 0 ? '#22c55e25' : '#ef444425'}`,
                  }}>
                    <span>{recentRankChange > 0 ? '▲' : '▼'}</span>
                    <span>{recentRankChange > 0 ? '+' : ''}{recentRankChange} {t('kingdomProfile.lastKvk', 'last KvK')}</span>
                  </span>
                ) : (
                  <Link to="/profile" style={{ textDecoration: 'none' }}>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.2rem',
                      padding: '0.15rem 0.5rem',
                      borderRadius: '20px',
                      fontSize: '0.7rem',
                      fontWeight: '600',
                      backgroundColor: '#9ca3af08',
                      border: '1px solid #9ca3af15',
                      cursor: 'pointer',
                    }}>
                      <span style={{ color: '#6b7280' }}>📊</span>
                      <span style={{ filter: 'blur(4px)', userSelect: 'none', color: '#22c55e' }}>+0</span>
                      <span style={{ color: '#4b5563', fontSize: '0.65rem' }}>Link to see</span>
                    </span>
                  </Link>
                )
              )}
            </div>
          )}

          {/* Row 4: Transfer Status + View Transfer Listing */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ color: '#6b7280', fontSize: '0.8rem' }}>{t('kingdomProfile.transferStatus', 'Transfer Status')}:</span>
            <SmartTooltip
              accentColor={statusColor}
              content={
                <div style={{ fontSize: '0.7rem' }}>
                  <div style={{ color: statusColor, fontWeight: 'bold', marginBottom: '2px' }}>
                    {status === 'Unannounced' ? t('kingdomProfile.noData', 'No Data') : t(`transferStatuses.${status}`, status)}
                  </div>
                  <div style={{ color: '#9ca3af' }}>{getStatusDescription(status)}</div>
                  {!hasPendingSubmission && (
                    <div style={{ color: '#22d3ee', fontSize: '0.6rem', marginTop: '3px' }}>{t('kingdomProfile.tapToUpdate', 'Tap to update')}</div>
                  )}
                </div>
              }
            >
              <span 
                onClick={(e) => {
                  e.stopPropagation();
                  if (!hasPendingSubmission) onStatusModalOpen();
                }}
                style={{ 
                  padding: '0.25rem 0.5rem',
                  borderRadius: '4px',
                  fontSize: '0.7rem',
                  fontWeight: '500',
                  backgroundColor: hasPendingSubmission ? '#6b728015' : (status === 'Unannounced' ? '#6b728015' : `${statusColor}15`),
                  color: hasPendingSubmission ? '#6b7280' : statusColor,
                  border: `1px solid ${hasPendingSubmission ? '#6b728030' : (status === 'Unannounced' ? '#6b728030' : `${statusColor}30`)}`,
                  cursor: hasPendingSubmission ? 'default' : 'pointer',
                  height: '24px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem'
                }}
              >
                {hasPendingSubmission ? `⏳ ${t('common.pending', 'Pending')}` : t(`transferStatuses.${status}`, status)}
              </span>
            </SmartTooltip>
            {isKingdomEditor && !hasPendingSubmission && (
              <span
                onClick={(e) => { e.stopPropagation(); onStatusModalOpen(); }}
                style={{
                  fontSize: '0.6rem',
                  color: '#22d3ee',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.2rem',
                  opacity: 0.85,
                }}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                {t('kingdomProfile.youCanUpdate', 'You can update this')}
              </span>
            )}
            <Link
              to={`/transfer-hub?kingdom=${kingdom.kingdom_number}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                padding: isMobile ? '0.2rem 0.5rem' : '0.25rem 0.6rem',
                backgroundColor: '#22d3ee10',
                border: '1px solid #22d3ee25',
                borderRadius: '4px',
                color: '#22d3ee',
                textDecoration: 'none',
                fontSize: '0.7rem',
                fontWeight: '500',
                height: '24px',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#22d3ee20';
                e.currentTarget.style.borderColor = '#22d3ee40';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#22d3ee10';
                e.currentTarget.style.borderColor = '#22d3ee25';
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
              </svg>
              {t('kingdomProfile.viewTransferListing', 'View Transfer Listing')}
            </Link>
            {managedBy && (
              <Link
                to={`/profile/${managedBy.userId}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  padding: isMobile ? '0.2rem 0.5rem' : '0.25rem 0.6rem',
                  backgroundColor: '#a855f708',
                  border: '1px solid #a855f720',
                  borderRadius: '4px',
                  color: '#9ca3af',
                  textDecoration: 'none',
                  fontSize: '0.65rem',
                  fontWeight: '500',
                  height: '24px',
                  transition: 'all 0.2s',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#a855f715';
                  e.currentTarget.style.borderColor = '#a855f730';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#a855f708';
                  e.currentTarget.style.borderColor = '#a855f720';
                }}
              >
                <span style={{ color: '#a855f7' }}>👑</span>
                Managed by <span style={{ color: '#a855f7', fontWeight: '600' }}>{managedBy.username}</span>
              </Link>
            )}
            {kingdom.score_updated_at && (
              <ScoreFreshness updatedAt={kingdom.score_updated_at} />
            )}
          </div>
          
          {/* Row 5: Total KvKs + Actions */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', marginTop: '0.5rem', flexWrap: 'wrap', position: 'relative', zIndex: 10 }}>
            <span style={{ color: '#6b7280', fontSize: '0.8rem' }}>{t('kingdomProfile.totalKvks', 'Total KvKs')}:</span>
            <span style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 'bold' }}>{kingdom.total_kvks}</span>
            <span style={{ color: '#3a3a3a' }}>|</span>

            {/* Share Button */}
            <ShareButton
              type="kingdom"
              kingdomData={{
                number: kingdom.kingdom_number,
                score: kingdom.overall_score,
                tier: powerTier,
                rank: rank,
                prepWinRate: Math.round(kingdom.prep_win_rate * 100),
                battleWinRate: Math.round(kingdom.battle_win_rate * 100),
                totalKvks: kingdom.total_kvks
              }}
            />

            <button
              onClick={onReportModalOpen}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: isMobile ? '0.35rem 0.6rem' : '0.5rem 0.75rem',
                backgroundColor: '#1a1a1a',
                border: '1px solid #333',
                borderRadius: '6px',
                color: '#ef4444',
                cursor: 'pointer',
                fontSize: isMobile ? '0.75rem' : '0.85rem',
                fontWeight: '500',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#ef444420';
                e.currentTarget.style.borderColor = '#ef444440';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#1a1a1a';
                e.currentTarget.style.borderColor = '#333';
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
                <line x1="4" y1="22" x2="4" y2="15"/>
              </svg>
              {t('kingdomProfile.report', 'Report')}
            </button>
          </div>
          
          {/* Decorative divider */}
          {!isMobile && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', marginTop: '0.75rem' }}>
            <div style={{ width: '50px', height: '2px', background: 'linear-gradient(90deg, transparent, #22d3ee)' }} />
            <div style={{ width: '6px', height: '6px', backgroundColor: '#22d3ee', transform: 'rotate(45deg)', boxShadow: '0 0 8px #22d3ee' }} />
            <div style={{ width: '50px', height: '2px', background: 'linear-gradient(90deg, #22d3ee, transparent)' }} />
          </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default KingdomHeader;
