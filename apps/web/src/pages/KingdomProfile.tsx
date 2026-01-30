import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { KingdomProfile as KingdomProfileType, getPowerTier } from '../types';
import { apiService } from '../services/api';
import { statusService } from '../services/statusService';
import KingdomReviews from '../components/KingdomReviews';
import StatusSubmission from '../components/StatusSubmission';
import ReportDataModal from '../components/ReportDataModal';
import TrendChart from '../components/TrendChart';
import SimilarKingdoms from '../components/SimilarKingdoms';
import ClaimKingdom from '../components/ClaimKingdom';
import AdBanner from '../components/AdBanner';
import AtlasScoreBreakdown from '../components/AtlasScoreBreakdown';
import ShareButton from '../components/ShareButton';
import { ScoreSimulator } from '../components/ScoreSimulator';
import { getOutcome, OUTCOMES } from '../utils/outcomes';
import { useIsMobile } from '../hooks/useMediaQuery';
import { useAuth } from '../contexts/AuthContext';
import { usePremium } from '../contexts/PremiumContext';
import { useToast } from '../components/Toast';
import { neonGlow, getStatusColor, getTierColor } from '../utils/styles';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useMetaTags, getKingdomMetaTags } from '../hooks/useMetaTags';

const KingdomProfile: React.FC = () => {
  const { kingdomNumber } = useParams<{ kingdomNumber: string }>();
  useDocumentTitle(kingdomNumber ? `Kingdom ${kingdomNumber}` : undefined);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { tier, features, isPro } = usePremium();
  const { showToast } = useToast();
  const [kingdom, setKingdom] = useState<KingdomProfileType | null>(null);
  const [allKingdoms, setAllKingdoms] = useState<KingdomProfileType[]>([]);
  const [loading, setLoading] = useState(true);
  const isMobile = useIsMobile();
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [hasPendingSubmission, setHasPendingSubmission] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showClaimModal, setShowClaimModal] = useState(false);

  // Check for pending submissions
  useEffect(() => {
    if (kingdomNumber) {
      const pending = statusService.getKingdomPendingSubmissions(parseInt(kingdomNumber));
      setHasPendingSubmission(pending.length > 0);
    }
  }, [kingdomNumber]);

  const handleStatusSubmit = async (newStatus: string, notes: string) => {
    if (!user || !kingdom) return;
    
    await statusService.submitStatusUpdate(
      kingdom.kingdom_number,
      kingdom.most_recent_status || 'Unannounced',
      newStatus,
      notes,
      user.id
    );
    
    showToast('Status update submitted for review!', 'success');
    setHasPendingSubmission(true);
  };

  useEffect(() => {
    if (kingdomNumber) {
      loadKingdomProfile(parseInt(kingdomNumber));
    }
  }, [kingdomNumber]);

  const loadKingdomProfile = async (id: number) => {
    setLoading(true);
    try {
      const data = await apiService.getKingdomProfile(id);
      setKingdom(data);
      
      // Load all kingdoms for ranking
      const all = await apiService.getLeaderboard(200);
      setAllKingdoms(all as unknown as KingdomProfileType[]);
      
      // Save to recently viewed
      const recentKey = 'kingshot_recently_viewed';
      const saved = localStorage.getItem(recentKey);
      let recent: number[] = saved ? JSON.parse(saved) : [];
      recent = [id, ...recent.filter(k => k !== id)].slice(0, 10);
      localStorage.setItem(recentKey, JSON.stringify(recent));
    } catch (error) {
      console.error('Failed to load kingdom profile:', error);
    } finally {
      setLoading(false);
    }
  };


  const getOutcomeStyle = (prepResult: string, battleResult: string) => {
    const outcome = getOutcome(prepResult, battleResult);
    const info = OUTCOMES[outcome];
    return { bg: info.bgColor, text: info.color, label: info.name, description: info.description };
  };

  const getOutcomeLetter = (prepResult: string, battleResult: string) => {
    const outcome = getOutcome(prepResult, battleResult);
    return OUTCOMES[outcome].abbrev;
  };

  // Calculate derived values (needed for hooks that must be called unconditionally)
  const status = kingdom?.most_recent_status || 'Unannounced';
  const powerTier = kingdom ? (kingdom.power_tier ?? getPowerTier(kingdom.overall_score)) : 'D';
  const tierColor = getTierColor(powerTier);
  
  // Calculate rank for meta tags
  const sortedByScore = [...allKingdoms].sort((a, b) => b.overall_score - a.overall_score);
  const rank = kingdom ? sortedByScore.findIndex(k => k.kingdom_number === kingdom.kingdom_number) + 1 : 0;
  
  // Update meta tags - must be called before any early returns
  useMetaTags(kingdom ? getKingdomMetaTags(kingdom.kingdom_number, kingdom.overall_score, powerTier, rank > 0 ? rank : undefined) : {});

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="loading-spinner" style={{ margin: '0 auto 1rem' }} />
          <div style={{ color: '#9ca3af' }}>Loading kingdom profile...</div>
        </div>
      </div>
    );
  }

  if (!kingdom) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>❌</div>
          <div style={{ color: '#ef4444', fontSize: '1.25rem', marginBottom: '1rem' }}>Kingdom not found. Either it doesn't exist, or we haven't tracked it yet.</div>
          <Link to="/" style={{ color: '#22d3ee', textDecoration: 'none' }}>← Back to Home</Link>
        </div>
      </div>
    );
  }
  
  // Calculate achievements
  const isSupremeRuler = kingdom.prep_losses === 0 && kingdom.battle_losses === 0 && kingdom.total_kvks > 0;
  const isPrepMaster = kingdom.prep_losses === 0 && kingdom.prep_wins > 0;
  const isBattleLegend = kingdom.battle_losses === 0 && kingdom.battle_wins > 0;
  
  const achievements: { icon: string; title: string; desc: string; color: string }[] = [];
  if (isSupremeRuler) {
    achievements.push({ icon: '👑', title: 'Supreme Ruler', desc: 'Undefeated overall', color: '#fbbf24' });
  } else {
    if (isPrepMaster) achievements.push({ icon: '🛡️', title: 'Prep Master', desc: 'Undefeated in Prep', color: '#eab308' });
    if (isBattleLegend) achievements.push({ icon: '⚔️', title: 'Battle Legend', desc: 'Undefeated in Battle', color: '#f97316' });
  }

  // Use full history values from kingdom data
  const highKings = kingdom.dominations ?? 0;
  const invaderKings = kingdom.defeats ?? 0;
  
  // All KvK records sorted by kvk_number descending (most recent first)
  const allKvks = [...(kingdom.recent_kvks || [])].sort((a, b) => b.kvk_number - a.kvk_number);
  
  // Tooltip descriptions
  const getTierDescription = (tier: string) => {
    switch (tier) {
      case 'S': return 'S-Tier: Elite kingdom (Top 10%) with Atlas Score 10+';
      case 'A': return 'A-Tier: Strong kingdom (Top 25%) with Atlas Score 7-9.9';
      case 'B': return 'B-Tier: Average kingdom (Top 50%) with Atlas Score 4.5-6.9';
      case 'C': return 'C-Tier: Below Average kingdom (Top 75%) with Atlas Score 2.5-4.4';
      default: return 'D-Tier: Developing kingdom (Bottom 25%) with Atlas Score below 2.5';
    }
  };
  
  const getStatusDescription = (status: string) => {
    switch (status) {
      case 'Leading': return 'Open for migration with favorable conditions';
      case 'Ordinary': return 'Standard migration status';
      default: return 'Transfer status not yet available';
    }
  };
  
  const handleTooltipToggle = (id: string) => {
    setActiveTooltip(activeTooltip === id ? null : id);
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a' }}>
      {/* Hero Section - matching About/Compare pages */}
      <div style={{ 
        padding: isMobile ? '1.25rem 1rem 1rem' : '1.75rem 2rem 1.25rem',
        textAlign: 'center',
        background: 'linear-gradient(180deg, #111111 0%, #0a0a0a 100%)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ position: 'relative', zIndex: 1, maxWidth: '800px', margin: '0 auto' }}>
          
          {/* Main hero content - centered */}
          <div style={{ textAlign: 'center' }}>
            {/* Row 1: Kingdom name + tier */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <h1 style={{ 
                fontSize: isMobile ? '1.5rem' : '2.25rem', 
                fontWeight: 'bold', 
                color: '#ffffff',
                fontFamily: "'Cinzel', serif", 
                letterSpacing: '0.02em',
                margin: 0
              }}>
                Kingdom {kingdom.kingdom_number}
              </h1>
              
              {/* Power Tier Badge */}
              <div 
                onClick={() => isMobile && handleTooltipToggle('tier')}
                style={{
                  padding: '0.2rem 0.5rem',
                  borderRadius: '4px',
                  fontSize: '0.7rem',
                  fontWeight: 'bold',
                  backgroundColor: `${tierColor}20`,
                  color: tierColor,
                  border: `1px solid ${tierColor}40`,
                  boxShadow: powerTier === 'S' ? `0 0 8px ${tierColor}40` : 'none',
                  cursor: 'pointer',
                  position: 'relative'
                }}
                aria-label={getTierDescription(powerTier)}
              >
                {powerTier}-Tier
                {isMobile && activeTooltip === 'tier' && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    marginTop: '0.5rem',
                    padding: '0.5rem 0.75rem',
                    backgroundColor: '#1f1f1f',
                    border: '1px solid #333',
                    borderRadius: '6px',
                    fontSize: '0.7rem',
                    color: '#fff',
                    whiteSpace: 'nowrap',
                    zIndex: 100
                  }}>
                    {getTierDescription(powerTier)}
                  </div>
                )}
              </div>
            </div>
            
            {/* Row 2: Atlas Score + Rank + Achievements */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
              <span style={{ color: '#6b7280', fontSize: '0.85rem' }}>Atlas Score:</span>
              <span
                onClick={() => isMobile && handleTooltipToggle('score')}
                onMouseEnter={() => !isMobile && setActiveTooltip('score')}
                onMouseLeave={() => !isMobile && setActiveTooltip(null)}
                style={{ 
                  fontSize: '2rem', 
                  fontWeight: '700', 
                  ...neonGlow('#22d3ee'), 
                  fontFamily: 'system-ui',
                  cursor: 'pointer',
                  position: 'relative',
                  lineHeight: 1
                }}
              >
                {kingdom.overall_score.toFixed(1)}
                {activeTooltip === 'score' && (
                  <div style={{
                    position: 'absolute',
                    bottom: '100%',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    marginBottom: '0.5rem',
                    padding: '0.5rem 0.75rem',
                    backgroundColor: '#0a0a0a',
                    border: '1px solid #22d3ee',
                    borderRadius: '6px',
                    fontSize: '0.7rem',
                    color: '#fff',
                    whiteSpace: 'nowrap',
                    zIndex: 100,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.4)'
                  }}>
                    <div style={{ color: '#22d3ee', fontWeight: 'bold', marginBottom: '2px' }}>Atlas Score</div>
                    <div style={{ color: '#9ca3af' }}>Rewards experience and consistency over lucky streaks</div>
                  </div>
                )}
              </span>
              {rank > 0 && (
                <span style={{ color: '#22d3ee', fontSize: '0.85rem', fontWeight: 'normal' }}>(#{rank})</span>
              )}
              {/* Achievement badges */}
              {achievements.map((a, i) => (
                <span 
                  key={i} 
                  onClick={() => isMobile && handleTooltipToggle(`achievement-${i}`)}
                  onMouseEnter={() => !isMobile && setActiveTooltip(`achievement-${i}`)}
                  onMouseLeave={() => !isMobile && setActiveTooltip(null)}
                  style={{ 
                    fontSize: '1rem', 
                    filter: `drop-shadow(0 0 4px ${a.color}60)`,
                    cursor: 'pointer',
                    position: 'relative'
                  }}
                >
                  {a.icon}
                  {activeTooltip === `achievement-${i}` && (
                    <div style={{
                      position: 'absolute',
                      bottom: '100%',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      marginBottom: '0.5rem',
                      padding: '0.5rem 0.75rem',
                      backgroundColor: '#0a0a0a',
                      border: `1px solid ${a.color}`,
                      borderRadius: '6px',
                      fontSize: '0.7rem',
                      color: '#fff',
                      whiteSpace: 'nowrap',
                      zIndex: 100,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.4)'
                    }}>
                      <div style={{ color: a.color, fontWeight: 'bold', marginBottom: '2px' }}>{a.title}</div>
                      <div style={{ color: '#9ca3af' }}>{a.desc}</div>
                    </div>
                  )}
                </span>
              ))}
            </div>
            
            {/* Row 3: Last Transfer Status */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
              <span style={{ color: '#6b7280', fontSize: '0.8rem' }}>Transfer Status:</span>
              <span 
                onClick={() => isMobile && handleTooltipToggle('status')}
                style={{ 
                  padding: '0.25rem 0.5rem',
                  borderRadius: '4px',
                  fontSize: '0.7rem',
                  fontWeight: '500',
                  backgroundColor: status === 'Unannounced' ? '#6b728015' : `${getStatusColor(status)}15`,
                  color: status === 'Unannounced' ? '#6b7280' : getStatusColor(status),
                  border: `1px solid ${status === 'Unannounced' ? '#6b728030' : `${getStatusColor(status)}30`}`,
                  cursor: 'pointer',
                  position: 'relative',
                  height: '24px',
                  display: 'inline-flex',
                  alignItems: 'center'
                }}
                onMouseEnter={() => !isMobile && setActiveTooltip('status')}
                onMouseLeave={() => !isMobile && setActiveTooltip(null)}
              >
                {status}
                {activeTooltip === 'status' && (
                  <div style={{
                    position: 'absolute',
                    bottom: '100%',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    marginBottom: '0.5rem',
                    padding: '0.5rem 0.75rem',
                    backgroundColor: '#0a0a0a',
                    border: `1px solid ${status === 'Unannounced' ? '#4a4a4a' : getStatusColor(status)}`,
                    borderRadius: '6px',
                    fontSize: '0.7rem',
                    color: '#fff',
                    whiteSpace: 'nowrap',
                    zIndex: 100,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.4)'
                  }}>
                    <div style={{ color: status === 'Unannounced' ? '#9ca3af' : getStatusColor(status), fontWeight: 'bold', marginBottom: '2px' }}>
                      {status === 'Unannounced' ? 'No Data Available' : status}
                    </div>
                    <div style={{ color: '#9ca3af' }}>
                      {status === 'Unannounced' ? 'Transfer status has not been reported yet' : getStatusDescription(status)}
                    </div>
                    {status !== 'Unannounced' && kingdom.last_updated && (
                      <div style={{ color: '#6b7280', fontSize: '0.65rem', marginTop: '0.25rem', borderTop: '1px solid #2a2a2a', paddingTop: '0.25rem' }}>
                        Last updated: {new Date(kingdom.last_updated).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                )}
              </span>
              {/* Update Status Button */}
              <button
                onClick={() => setShowStatusModal(true)}
                disabled={hasPendingSubmission}
                style={{
                  padding: '0.25rem 0.5rem',
                  backgroundColor: hasPendingSubmission ? '#2a2a2a' : '#22d3ee15',
                  border: `1px solid ${hasPendingSubmission ? '#3a3a3a' : '#22d3ee40'}`,
                  borderRadius: '4px',
                  color: hasPendingSubmission ? '#6b7280' : '#22d3ee',
                  fontSize: '0.7rem',
                  cursor: hasPendingSubmission ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  height: '24px'
                }}
              >
                {hasPendingSubmission ? '⏳ Pending' : '✏️ Update'}
              </button>
            </div>
            
            {/* Row 4: Total KvKs + Actions */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
              <span style={{ color: '#6b7280', fontSize: '0.8rem' }}>Total KvKs:</span>
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
                onClick={() => setShowReportModal(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.5rem 0.75rem',
                  backgroundColor: '#1a1a1a',
                  border: '1px solid #333',
                  borderRadius: '6px',
                  color: '#ef4444',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
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
                Report
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

      {/* Main Content */}
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: isMobile ? '1rem' : '1.5rem 2rem' }}>
        {/* Ad Banner - shows upgrade prompt for non-Pro users */}
        <AdBanner placement="profile" />
        
        {/* Atlas Score Breakdown - Toggleable Radar Chart */}
        <AtlasScoreBreakdown 
          kingdom={kingdom} 
          rank={allKingdoms.findIndex(k => k.kingdom_number === kingdom.kingdom_number) + 1 || undefined}
          totalKingdoms={allKingdoms.length || undefined}
        />

        {/* Score Simulator - Pro Feature */}
        <ScoreSimulator kingdom={kingdom} />

        {/* Quick Stats Grid - 4 columns on desktop, 2x2 on mobile */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', 
          gap: isMobile ? '0.5rem' : '0.75rem', 
          marginBottom: isMobile ? '1rem' : '1.25rem' 
        }}>
          {(() => {
            const totalKvks = kingdom.total_kvks || 1;
            const reversals = kingdom.prep_wins - highKings;
            const comebacks = kingdom.battle_wins - highKings;
            const stats = [
              { label: 'Dominations', value: highKings, color: '#22c55e', icon: '👑', tooltip: 'Won both Prep and Battle', percent: Math.round((highKings / totalKvks) * 100) },
              { label: 'Reversals', value: reversals, color: '#a855f7', icon: '🔄', tooltip: 'Won Prep but lost Battle', percent: Math.round((reversals / totalKvks) * 100) },
              { label: 'Comebacks', value: comebacks, color: '#3b82f6', icon: '💪', tooltip: 'Lost Prep but won Battle', percent: Math.round((comebacks / totalKvks) * 100) },
              { label: 'Invasions', value: invaderKings, color: '#ef4444', icon: '💀', tooltip: 'Lost both Prep and Battle', percent: Math.round((invaderKings / totalKvks) * 100) },
            ];
            return stats.map((stat, i) => (
              <div 
                key={i}
                className="stat-card"
                onClick={() => isMobile && handleTooltipToggle(`stat-${i}`)}
                onMouseEnter={() => !isMobile && setActiveTooltip(`stat-${i}`)}
                onMouseLeave={() => !isMobile && setActiveTooltip(null)}
                style={{ 
                  padding: isMobile ? '0.75rem 0.5rem' : '1rem', 
                  textAlign: 'center',
                  position: 'relative',
                  cursor: 'pointer'
                }}
              >
                <div style={{ fontSize: isMobile ? '0.9rem' : '1rem', marginBottom: '0.25rem' }}>{stat.icon}</div>
                <div style={{ 
                  fontSize: isMobile ? '1.25rem' : '1.5rem', 
                  fontWeight: 'bold', 
                  ...neonGlow(stat.color), 
                  fontFamily: 'system-ui',
                  lineHeight: 1
                }}>
                  {stat.value}<span style={{ fontSize: '0.65rem', color: stat.color, fontWeight: 'normal', marginLeft: '0.25rem' }}>({stat.percent}%)</span>
                </div>
                <div style={{ color: '#6b7280', fontSize: isMobile ? '0.65rem' : '0.7rem', marginTop: '0.25rem' }}>{stat.label}</div>
                {activeTooltip === `stat-${i}` && (
                  <div style={{
                    position: 'absolute',
                    bottom: '100%',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    marginBottom: '0.5rem',
                    padding: '0.5rem 0.75rem',
                    backgroundColor: '#0a0a0a',
                    border: `1px solid ${stat.color}`,
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    color: '#fff',
                    whiteSpace: 'nowrap',
                    zIndex: 100,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.4)'
                  }}>
                    <div style={{ color: stat.color, fontWeight: 'bold', marginBottom: '0.15rem' }}>{stat.icon} {stat.label}</div>
                    <div style={{ color: '#9ca3af', fontSize: '0.65rem' }}>{stat.tooltip}</div>
                  </div>
                )}
              </div>
            ));
          })()}
        </div>

        {/* Phase Performance Cards */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', 
          gap: isMobile ? '0.75rem' : '1rem', 
          marginBottom: isMobile ? '1.25rem' : '1.5rem' 
        }}>
          {/* Prep Phase Card */}
          {(() => {
            const sortedKvks = [...(kingdom.recent_kvks || [])].sort((a, b) => b.kvk_number - a.kvk_number);
            let prepStreak = 0;
            let prepStreakType = '';
            for (const kvk of sortedKvks) {
              const isWin = kvk.prep_result === 'Win' || kvk.prep_result === 'W';
              if (prepStreak === 0) { prepStreakType = isWin ? 'W' : 'L'; prepStreak = 1; }
              else if ((isWin && prepStreakType === 'W') || (!isWin && prepStreakType === 'L')) { prepStreak++; }
              else break;
            }
            const showPrepStreak = prepStreak >= 2;
            const prepBestStreak = kingdom.prep_best_streak ?? 0;
            
            return (
              <div className="phase-card" style={{ 
                padding: isMobile ? '1rem' : '1.25rem'
              }}>
                <h3 style={{ 
                  color: '#eab308', 
                  fontSize: isMobile ? '0.85rem' : '0.95rem', 
                  fontWeight: '600', 
                  margin: '0 0 0.75rem 0', 
                  textAlign: 'center'
                }}>
                  Preparation Phase
                </h3>
                
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'flex-start', 
                  padding: '0 0.5rem'
                }}>
                  {/* Wins column */}
                  <div style={{ textAlign: 'center', flex: 1 }}>
                    <div style={{ color: '#22c55e', fontSize: isMobile ? '1.75rem' : '2rem', fontWeight: 'bold', lineHeight: 1 }}>{kingdom.prep_wins}</div>
                    <div style={{ color: '#6b7280', fontSize: '0.7rem', marginTop: '0.25rem' }}>Wins</div>
                    {showPrepStreak && prepStreakType === 'W' && (
                      <div style={{ marginTop: '0.5rem' }}>
                        <span style={{ 
                          padding: '0.2rem 0.5rem', 
                          backgroundColor: '#22c55e15', 
                          borderRadius: '6px', 
                          fontSize: '0.7rem', 
                          color: '#22c55e', 
                          fontWeight: 'bold',
                          border: '1px solid #22c55e30'
                        }}>
                          {prepStreak}W Streak
                        </span>
                      </div>
                    )}
                  </div>
                  
                  {/* Win Rate column */}
                  <div style={{ textAlign: 'center', flex: 1 }}>
                    <div style={{ 
                      fontSize: isMobile ? '1.5rem' : '1.75rem', 
                      fontWeight: 'bold', 
                      color: '#fff'
                    }}>
                      {Math.round(kingdom.prep_win_rate * 100)}%
                    </div>
                    <div style={{ color: '#6b7280', fontSize: '0.7rem', marginTop: '0.25rem' }}>Win Rate</div>
                    {prepBestStreak >= 3 && (
                      <div style={{ color: '#6b7280', fontSize: '0.65rem', marginTop: '0.25rem' }}>
                        Best: {prepBestStreak}W
                      </div>
                    )}
                  </div>
                  
                  {/* Losses column */}
                  <div style={{ textAlign: 'center', flex: 1 }}>
                    <div style={{ color: '#ef4444', fontSize: isMobile ? '1.75rem' : '2rem', fontWeight: 'bold', lineHeight: 1 }}>{kingdom.prep_losses}</div>
                    <div style={{ color: '#6b7280', fontSize: '0.7rem', marginTop: '0.25rem' }}>Losses</div>
                    {showPrepStreak && prepStreakType === 'L' && (
                      <div style={{ marginTop: '0.5rem' }}>
                        <span style={{ 
                          padding: '0.2rem 0.5rem', 
                          backgroundColor: '#ef444415', 
                          borderRadius: '6px', 
                          fontSize: '0.7rem', 
                          color: '#ef4444', 
                          fontWeight: 'bold',
                          border: '1px solid #ef444430'
                        }}>
                          {prepStreak}L Streak
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Battle Phase Card */}
          {(() => {
            const sortedKvks = [...(kingdom.recent_kvks || [])].sort((a, b) => b.kvk_number - a.kvk_number);
            let battleStreak = 0;
            let battleStreakType = '';
            for (const kvk of sortedKvks) {
              const isWin = kvk.battle_result === 'Win' || kvk.battle_result === 'W';
              if (battleStreak === 0) { battleStreakType = isWin ? 'W' : 'L'; battleStreak = 1; }
              else if ((isWin && battleStreakType === 'W') || (!isWin && battleStreakType === 'L')) { battleStreak++; }
              else break;
            }
            const showBattleStreak = battleStreak >= 2;
            const battleBestStreak = kingdom.battle_best_streak ?? 0;
            
            return (
              <div className="phase-card" style={{ 
                padding: isMobile ? '1rem' : '1.25rem'
              }}>
                <h3 style={{ 
                  color: '#f97316', 
                  fontSize: isMobile ? '0.85rem' : '0.95rem', 
                  fontWeight: '600', 
                  margin: '0 0 0.75rem 0', 
                  textAlign: 'center'
                }}>
                  Battle Phase
                </h3>
                
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'flex-start', 
                  padding: '0 0.5rem'
                }}>
                  {/* Wins column */}
                  <div style={{ textAlign: 'center', flex: 1 }}>
                    <div style={{ color: '#22c55e', fontSize: isMobile ? '1.75rem' : '2rem', fontWeight: 'bold', lineHeight: 1 }}>{kingdom.battle_wins}</div>
                    <div style={{ color: '#6b7280', fontSize: '0.7rem', marginTop: '0.25rem' }}>Wins</div>
                    {showBattleStreak && battleStreakType === 'W' && (
                      <div style={{ marginTop: '0.5rem' }}>
                        <span style={{ 
                          padding: '0.2rem 0.5rem', 
                          backgroundColor: '#22c55e15', 
                          borderRadius: '6px', 
                          fontSize: '0.7rem', 
                          color: '#22c55e', 
                          fontWeight: 'bold',
                          border: '1px solid #22c55e30'
                        }}>
                          {battleStreak}W Streak
                        </span>
                      </div>
                    )}
                  </div>
                  
                  {/* Win Rate column */}
                  <div style={{ textAlign: 'center', flex: 1 }}>
                    <div style={{ 
                      fontSize: isMobile ? '1.5rem' : '1.75rem', 
                      fontWeight: 'bold', 
                      color: '#fff'
                    }}>
                      {Math.round(kingdom.battle_win_rate * 100)}%
                    </div>
                    <div style={{ color: '#6b7280', fontSize: '0.7rem', marginTop: '0.25rem' }}>Win Rate</div>
                    {battleBestStreak >= 3 && (
                      <div style={{ color: '#6b7280', fontSize: '0.65rem', marginTop: '0.25rem' }}>
                        Best: {battleBestStreak}W
                      </div>
                    )}
                  </div>
                  
                  {/* Losses column */}
                  <div style={{ textAlign: 'center', flex: 1 }}>
                    <div style={{ color: '#ef4444', fontSize: isMobile ? '1.75rem' : '2rem', fontWeight: 'bold', lineHeight: 1 }}>{kingdom.battle_losses}</div>
                    <div style={{ color: '#6b7280', fontSize: '0.7rem', marginTop: '0.25rem' }}>Losses</div>
                    {showBattleStreak && battleStreakType === 'L' && (
                      <div style={{ marginTop: '0.5rem' }}>
                        <span style={{ 
                          padding: '0.2rem 0.5rem', 
                          backgroundColor: '#ef444415', 
                          borderRadius: '6px', 
                          fontSize: '0.7rem', 
                          color: '#ef4444', 
                          fontWeight: 'bold',
                          border: '1px solid #ef444430'
                        }}>
                          {battleStreak}L Streak
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Trend Chart */}
        {kingdom.recent_kvks && kingdom.recent_kvks.length >= 2 && (
          <div style={{ marginBottom: isMobile ? '1.25rem' : '1.5rem' }}>
            <TrendChart kvkRecords={kingdom.recent_kvks} />
          </div>
        )}

        {/* KvK History Section */}
        {allKvks.length > 0 && (
          <div style={{ 
            backgroundColor: '#131318', 
            borderRadius: '12px', 
            padding: isMobile ? '1rem' : '1.25rem', 
            border: '1px solid #2a2a2a',
            marginBottom: isMobile ? '1.25rem' : '1.5rem',
            overflow: 'visible'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ color: '#fff', fontSize: isMobile ? '0.95rem' : '1.1rem', fontWeight: '600', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                📜 KvK History
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>
                  Showing {Math.min(features.kvkHistoryLimit, allKvks.length)} of {kingdom.total_kvks}
                </span>
                {allKvks.length > features.kvkHistoryLimit && !isPro && (
                  tier === 'anonymous' ? (
                    <Link
                      to="/profile"
                      style={{
                        padding: '0.35rem 0.75rem',
                        backgroundColor: '#22d3ee15',
                        border: '1px solid #22d3ee40',
                        borderRadius: '6px',
                        color: '#22d3ee',
                        fontSize: '0.75rem',
                        fontWeight: '500',
                        textDecoration: 'none',
                        transition: 'all 0.15s',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem'
                      }}
                      onMouseEnter={(e: React.MouseEvent<HTMLAnchorElement>) => {
                        e.currentTarget.style.backgroundColor = '#22d3ee25';
                        e.currentTarget.style.borderColor = '#22d3ee60';
                      }}
                      onMouseLeave={(e: React.MouseEvent<HTMLAnchorElement>) => {
                        e.currentTarget.style.backgroundColor = '#22d3ee15';
                        e.currentTarget.style.borderColor = '#22d3ee40';
                      }}
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
                        <polyline points="10 17 15 12 10 7"/>
                        <line x1="15" y1="12" x2="3" y2="12"/>
                      </svg>
                      Sign In
                    </Link>
                  ) : (
                    <Link
                      to="/upgrade"
                      style={{
                        padding: '0.35rem 0.75rem',
                        backgroundColor: '#22d3ee15',
                        border: '1px solid #22d3ee40',
                        borderRadius: '6px',
                        color: '#22d3ee',
                        fontSize: '0.75rem',
                        textDecoration: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        transition: 'all 0.15s'
                      }}
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
                      </svg>
                      Full History
                    </Link>
                  )
                )}
              </div>
            </div>
            
            {/* KvK Table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 'auto' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #2a2a2a' }}>
                    <th style={{ padding: isMobile ? '0.4rem 0.3rem' : '0.5rem', textAlign: 'left', color: '#6b7280', fontSize: isMobile ? '0.7rem' : '0.75rem', fontWeight: '500' }}>KvK #</th>
                    <th style={{ padding: isMobile ? '0.4rem 0.3rem' : '0.5rem', textAlign: 'left', color: '#6b7280', fontSize: isMobile ? '0.7rem' : '0.75rem', fontWeight: '500' }}>Opponent</th>
                    <th style={{ padding: isMobile ? '0.4rem 0.3rem' : '0.5rem', textAlign: 'center', color: '#6b7280', fontSize: isMobile ? '0.7rem' : '0.75rem', fontWeight: '500' }}>Prep</th>
                    <th style={{ padding: isMobile ? '0.4rem 0.3rem' : '0.5rem', textAlign: 'center', color: '#6b7280', fontSize: isMobile ? '0.7rem' : '0.75rem', fontWeight: '500' }}>Battle</th>
                    <th style={{ padding: isMobile ? '0.4rem 0.3rem' : '0.5rem', textAlign: 'center', color: '#6b7280', fontSize: isMobile ? '0.7rem' : '0.75rem', fontWeight: '500' }}>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {allKvks.slice(0, features.kvkHistoryLimit).map((kvk, index) => {
                    const outcomeStyle = getOutcomeStyle(kvk.prep_result, kvk.battle_result);
                    const isWin = (r: string) => r === 'Win' || r === 'W';
                    const outcomeLetter = getOutcomeLetter(kvk.prep_result, kvk.battle_result);
                    
                    return (
                      <tr 
                        key={index} 
                        style={{ 
                          backgroundColor: index % 2 === 0 ? '#0a0a0a' : 'transparent',
                          transition: 'background-color 0.15s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#151520'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = index % 2 === 0 ? '#0a0a0a' : 'transparent'}
                      >
                        <td style={{ padding: isMobile ? '0.5rem 0.35rem' : '0.65rem 0.5rem', color: '#9ca3af', fontSize: isMobile ? '0.75rem' : '0.85rem' }}>
                          {kvk.kvk_number}
                        </td>
                        <td style={{ padding: isMobile ? '0.5rem 0.35rem' : '0.65rem 0.5rem' }}>
                          <span 
                            onClick={() => navigate(`/kingdom/${kvk.opponent_kingdom}`)}
                            style={{ 
                              color: '#22d3ee', 
                              cursor: 'pointer',
                              fontSize: isMobile ? '0.75rem' : '0.85rem',
                              textDecoration: 'none'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                            onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
                          >
                            {`Kingdom ${kvk.opponent_kingdom}`}
                          </span>
                        </td>
                        <td style={{ padding: isMobile ? '0.5rem 0.35rem' : '0.65rem 0.5rem', textAlign: 'center' }}>
                          <span style={{ 
                            color: isWin(kvk.prep_result) ? '#22c55e' : '#ef4444', 
                            fontWeight: '600',
                            fontSize: isMobile ? '0.75rem' : '0.85rem'
                          }}>
                            {isWin(kvk.prep_result) ? 'W' : 'L'}
                          </span>
                        </td>
                        <td style={{ padding: isMobile ? '0.5rem 0.35rem' : '0.65rem 0.5rem', textAlign: 'center' }}>
                          <span style={{ 
                            color: isWin(kvk.battle_result) ? '#22c55e' : '#ef4444', 
                            fontWeight: '600',
                            fontSize: isMobile ? '0.75rem' : '0.85rem'
                          }}>
                            {isWin(kvk.battle_result) ? 'W' : 'L'}
                          </span>
                        </td>
                        <td style={{ padding: isMobile ? '0.5rem 0.35rem' : '0.65rem 0.5rem', textAlign: 'center' }}>
                          <span 
                            onClick={isMobile ? () => handleTooltipToggle(`outcome-${index}`) : undefined}
                            onMouseEnter={() => !isMobile && setActiveTooltip(`outcome-${index}`)}
                            onMouseLeave={() => !isMobile && setActiveTooltip(null)}
                            style={{
                              display: 'inline-block',
                              padding: isMobile ? '0.2rem 0.4rem' : '0.25rem 0.6rem',
                              borderRadius: '6px',
                              backgroundColor: outcomeStyle.bg,
                              border: `1px solid ${outcomeStyle.text}40`,
                              color: outcomeStyle.text,
                              fontSize: isMobile ? '0.7rem' : '0.8rem',
                              fontWeight: 'bold',
                              cursor: 'pointer',
                              position: 'relative',
                              boxShadow: `0 0 6px ${outcomeStyle.text}20`
                            }}
                          >
                            {outcomeLetter}
                            {activeTooltip === `outcome-${index}` && (
                              <div style={{
                                position: 'absolute',
                                bottom: '100%',
                                left: '50%',
                                transform: 'translateX(-50%)',
                                marginBottom: '0.5rem',
                                padding: '0.5rem 0.75rem',
                                backgroundColor: '#0a0a0a',
                                border: `1px solid ${outcomeStyle.text}`,
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                color: '#fff',
                                whiteSpace: 'nowrap',
                                zIndex: 1000,
                                boxShadow: '0 4px 12px rgba(0,0,0,0.4)'
                              }}>
                                <div style={{ fontWeight: 'bold', color: outcomeStyle.text, marginBottom: '0.15rem' }}>{outcomeStyle.label}</div>
                                <div style={{ color: '#9ca3af', fontSize: '0.65rem' }}>{outcomeStyle.description}</div>
                              </div>
                            )}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Reviews Section */}
        <div style={{ marginBottom: isMobile ? '1.25rem' : '1.5rem' }}>
          <KingdomReviews kingdomNumber={kingdom.kingdom_number} />
        </div>

        {/* Action Buttons */}
        <div style={{ 
          display: 'flex', 
          flexDirection: isMobile ? 'column' : 'row',
          justifyContent: 'center', 
          alignItems: 'center',
          gap: '1rem',
          paddingBottom: '2rem' 
        }}>
          {/* Similar Kingdoms */}
          {allKingdoms.length > 0 && (
            <div style={{ width: '100%', maxWidth: '400px' }}>
              <SimilarKingdoms currentKingdom={kingdom} allKingdoms={allKingdoms} limit={4} />
            </div>
          )}

          {/* Claim Kingdom Button */}
          <button
            onClick={() => setShowClaimModal(true)}
            style={{
              padding: '0.6rem 1.25rem',
              backgroundColor: '#fbbf2415',
              border: '1px solid #fbbf2440',
              borderRadius: '8px',
              color: '#fbbf24',
              fontWeight: '500',
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            👑 Claim This Kingdom
          </button>

          <button
            onClick={() => navigate(`/compare?kingdoms=${kingdom.kingdom_number},`)}
            style={{
              padding: isMobile ? '1rem 2rem' : '1rem 2.5rem',
              background: 'linear-gradient(135deg, #22d3ee 0%, #7c3aed 100%)',
              border: 'none',
              borderRadius: '10px',
              color: '#fff',
              fontWeight: 'bold',
              fontSize: '0.95rem',
              cursor: 'pointer',
              boxShadow: '0 0 20px rgba(168, 85, 247, 0.25)',
              transition: 'transform 0.2s, box-shadow 0.2s',
              width: isMobile ? '100%' : 'auto'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 4px 25px rgba(168, 85, 247, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 0 20px rgba(168, 85, 247, 0.25)';
            }}
          >
            Compare with another Kingdom
          </button>
          
          <Link 
            to="/" 
            style={{ 
              color: '#6b7280', 
              textDecoration: 'none', 
              fontSize: '0.85rem',
              padding: '0.75rem 1.5rem',
              border: '1px solid #333',
              borderRadius: '8px',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#22d3ee40';
              e.currentTarget.style.color = '#22d3ee';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#333';
              e.currentTarget.style.color = '#6b7280';
            }}
          >
            ← Back to Home
          </Link>
        </div>
      </div>

      {/* Status Submission Modal */}
      {showStatusModal && kingdom && (
        <StatusSubmission
          kingdomNumber={kingdom.kingdom_number}
          currentStatus={status}
          onSubmit={handleStatusSubmit}
          onClose={() => setShowStatusModal(false)}
        />
      )}

      {/* Report Data Modal */}
      {kingdom && (
        <ReportDataModal
          kingdom={kingdom}
          isOpen={showReportModal}
          onClose={() => setShowReportModal(false)}
        />
      )}

      {/* Claim Kingdom Modal */}
      {kingdom && (
        <ClaimKingdom
          kingdomNumber={kingdom.kingdom_number}
          isOpen={showClaimModal}
          onClose={() => setShowClaimModal(false)}
        />
      )}
    </div>
  );
};

export default KingdomProfile;
