import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { KingdomProfile as KingdomProfileType, getPowerTier } from '../types';
import { incrementStat } from '../components/UserAchievements';
// Note: Atlas Score comes from Supabase (kingdom.overall_score) - DO NOT recalculate client-side
import { apiService, dataLoadError } from '../services/api';
import { DataLoadError } from '../components/DataLoadError';
import { KingdomProfileSkeleton } from '../components/Skeleton';
import { statusService } from '../services/statusService';
import { useKingdomsRealtime } from '../hooks/useKingdomsRealtime';
import KingdomReviews from '../components/KingdomReviews';
import StatusSubmission from '../components/StatusSubmission';
import ReportDataModal from '../components/ReportDataModal';
import ReportKvKErrorModal from '../components/ReportKvKErrorModal';
import TrendChart from '../components/TrendChart';
import ScoreHistoryChart from '../components/ScoreHistoryChart';
import RankingHistoryChart from '../components/RankingHistoryChart';
import SimilarKingdoms from '../components/SimilarKingdoms';
import KingdomPlayers from '../components/KingdomPlayers';
import ClaimKingdom from '../components/ClaimKingdom';
import AtlasScoreBreakdown from '../components/AtlasScoreBreakdown';
import PathToNextTier from '../components/PathToNextTier';
import { ScoreSimulator } from '../components/ScoreSimulator';
import { KingdomHeader, QuickStats, PhaseCards, KvKHistoryTable } from '../components/kingdom-profile';
import { useIsMobile } from '../hooks/useMediaQuery';
import { useAuth } from '../contexts/AuthContext';
// FavoritesContext is used by child components directly
import { useToast } from '../components/Toast';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useMetaTags, getKingdomMetaTags } from '../hooks/useMetaTags';
import { useStructuredData } from '../hooks/useStructuredData';
import { reviewService } from '../services/reviewService';
import { scoreHistoryService } from '../services/scoreHistoryService';

const KingdomProfile: React.FC = () => {
  const { kingdomNumber } = useParams<{ kingdomNumber: string }>();
  useDocumentTitle(kingdomNumber ? `Kingdom ${kingdomNumber}` : undefined);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [kingdom, setKingdom] = useState<KingdomProfileType | null>(null);
  const [allKingdoms, setAllKingdoms] = useState<KingdomProfileType[]>([]);
  const [loading, setLoading] = useState(true);
  const isMobile = useIsMobile();
  const [refreshKey, setRefreshKey] = useState(0);
  const [aggregateRating, setAggregateRating] = useState<{
    ratingValue: number;
    reviewCount: number;
    bestRating: number;
    worstRating: number;
  } | null>(null);
  const [scoreHistoryRank, setScoreHistoryRank] = useState<number>(0);
  const [totalKingdomsAtKvk, setTotalKingdomsAtKvk] = useState<number>(0);
  const [percentileRank, setPercentileRank] = useState<number>(0);

  // Auto-refresh when KvK history changes for this kingdom via realtime
  const handleKvkHistoryUpdate = useCallback((updatedKingdom: number, kvkNumber: number) => {
    if (kingdomNumber && updatedKingdom === parseInt(kingdomNumber)) {
      console.log(`Realtime: KvK history updated for K${updatedKingdom} #${kvkNumber}, refreshing...`);
      setRefreshKey(prev => prev + 1);
    }
  }, [kingdomNumber]);

  useKingdomsRealtime({
    onKvkHistoryUpdate: handleKvkHistoryUpdate,
  });

  // Modal states
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [hasPendingSubmission, setHasPendingSubmission] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [showKvKErrorModal, setShowKvKErrorModal] = useState(false);
  
  // Expand/collapse all state for collapsible sections
  const [breakdownExpanded, setBreakdownExpanded] = useState(false);
  const [scoreHistoryExpanded, setScoreHistoryExpanded] = useState(false);
  const [rankingHistoryExpanded, setRankingHistoryExpanded] = useState(false);
  const [simulatorExpanded, setSimulatorExpanded] = useState(false);
  const [pathExpanded, setPathExpanded] = useState(false);
  const [trendExpanded, setTrendExpanded] = useState(false);
  
  const allExpanded = breakdownExpanded && scoreHistoryExpanded && rankingHistoryExpanded && simulatorExpanded && pathExpanded && trendExpanded;
  const toggleAllSections = () => {
    const newState = !allExpanded;
    setBreakdownExpanded(newState);
    setScoreHistoryExpanded(newState);
    setRankingHistoryExpanded(newState);
    setSimulatorExpanded(newState);
    setPathExpanded(newState);
    setTrendExpanded(newState);
  };

  // Check for pending submissions
  useEffect(() => {
    const checkPending = async () => {
      if (kingdomNumber) {
        try {
          const pending = await statusService.getKingdomPendingSubmissions(parseInt(kingdomNumber));
          setHasPendingSubmission(pending.length > 0);
        } catch {
          setHasPendingSubmission(false);
        }
      }
    };
    checkPending();
  }, [kingdomNumber]);

  // Fetch aggregate rating for structured data (SEO) - only available if 5+ reviews exist
  useEffect(() => {
    const fetchAggregateRating = async () => {
      if (kingdomNumber) {
        try {
          const rating = await reviewService.getAggregateRatingForStructuredData(parseInt(kingdomNumber));
          setAggregateRating(rating);
        } catch {
          setAggregateRating(null);
        }
      }
    };
    fetchAggregateRating();
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
  }, [kingdomNumber, refreshKey]);

  const loadKingdomProfile = async (id: number) => {
    setLoading(true);
    try {
      const data = await apiService.getKingdomProfile(id);
      setKingdom(data);
      
      const all = await apiService.getKingdoms();
      setAllKingdoms(all as unknown as KingdomProfileType[]);
      
      // Fetch rank from score_history (single source of truth)
      const rankData = await scoreHistoryService.getLatestRank(id);
      if (rankData) {
        setScoreHistoryRank(rankData.rank);
        setTotalKingdomsAtKvk(rankData.totalAtKvk);
        setPercentileRank(rankData.percentileRank);
      }
      
      // Save to recently viewed and track achievement
      const recentKey = 'kingshot_recently_viewed';
      const saved = localStorage.getItem(recentKey);
      let recent: number[] = saved ? JSON.parse(saved) : [];
      if (!recent.includes(id)) {
        incrementStat('kingdomsViewed');
      }
      recent = [id, ...recent.filter(k => k !== id)].slice(0, 10);
      localStorage.setItem(recentKey, JSON.stringify(recent));
    } catch (error) {
      console.error('Failed to load kingdom profile:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate derived values (needed for hooks that must be called unconditionally)
  const status = kingdom?.most_recent_status || 'Unannounced';
  
  // Use Atlas Score from Supabase (single source of truth) - DO NOT recalculate client-side
  const atlasScore = kingdom?.overall_score ?? 0;
  const powerTier = kingdom ? getPowerTier(atlasScore) : 'D';
  
  // Rank comes from score_history table (single source of truth)
  // This matches the rank shown in the Kingdom Ranking History chart
  const rank = scoreHistoryRank;
  const rankingList = allKingdoms;
  
  // Update meta tags - must be called before any early returns
  useMetaTags(kingdom ? getKingdomMetaTags(kingdom.kingdom_number, undefined, powerTier, undefined) : {});
  
  // Inject structured data for SEO (with aggregateRating only if 5+ reviews exist)
  useStructuredData({
    type: 'KingdomProfile',
    data: {
      kingdomNumber: kingdom?.kingdom_number || parseInt(kingdomNumber || '0'),
      tier: powerTier,
      atlasScore: atlasScore,
      rank: rank > 0 ? rank : undefined,
      aggregateRating: aggregateRating
    }
  });

  if (loading) {
    return <KingdomProfileSkeleton />;
  }

  if (!kingdom) {
    if (dataLoadError) {
      return (
        <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <DataLoadError onRetry={() => window.location.reload()} />
        </div>
      );
    }
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>❌</div>
          <div style={{ color: '#ef4444', fontSize: '1.25rem', marginBottom: '1rem' }}>Kingdom not found. Either it doesn&apos;t exist, or we haven&apos;t tracked it yet.</div>
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
  const invaderKings = kingdom.invasions ?? kingdom.defeats ?? 0;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a' }}>
      {/* Hero Section */}
      <KingdomHeader
        kingdom={kingdom}
        rank={rank}
        totalKingdomsAtKvk={totalKingdomsAtKvk}
        percentileRank={percentileRank}
        atlasScore={atlasScore}
        powerTier={powerTier}
        achievements={achievements}
        status={status}
        hasPendingSubmission={hasPendingSubmission}
        isMobile={isMobile}
        onStatusModalOpen={() => setShowStatusModal(true)}
        onReportModalOpen={() => setShowReportModal(true)}
      />

      {/* Main Content */}
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: isMobile ? '1rem' : '1.5rem 2rem' }}>
        {/* Quick Stats Grid */}
        <QuickStats
          totalKvks={kingdom.total_kvks}
          dominations={highKings}
          invasions={invaderKings}
          prepWins={kingdom.prep_wins}
          battleWins={kingdom.battle_wins}
          isMobile={isMobile}
        />

        {/* Phase Performance Cards */}
        <PhaseCards
          prepWins={kingdom.prep_wins}
          prepLosses={kingdom.prep_losses}
          prepWinRate={kingdom.prep_win_rate}
          prepBestStreak={kingdom.prep_best_streak ?? 0}
          battleWins={kingdom.battle_wins}
          battleLosses={kingdom.battle_losses}
          battleWinRate={kingdom.battle_win_rate}
          battleBestStreak={kingdom.battle_best_streak ?? 0}
          recentKvks={kingdom.recent_kvks || []}
          isMobile={isMobile}
        />

        {/* KvK History Section */}
        <KvKHistoryTable
          kingdomNumber={kingdom.kingdom_number}
          kvkRecords={kingdom.recent_kvks || []}
          isMobile={isMobile}
          onReportErrorClick={() => setShowKvKErrorModal(true)}
        />

        {/* Expand/Collapse All Button */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'flex-end', 
          marginBottom: '0.75rem'
        }}>
          <button
            onClick={toggleAllSections}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleAllSections(); } }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.35rem',
              padding: isMobile ? '0.6rem 1rem' : '0.4rem 0.75rem',
              minHeight: isMobile ? '44px' : 'auto',
              backgroundColor: '#131318',
              border: '1px solid #2a2a2a',
              borderRadius: '6px',
              color: '#6b7280',
              fontSize: isMobile ? '0.8rem' : '0.75rem',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#22d3ee40';
              e.currentTarget.style.color = '#22d3ee';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#2a2a2a';
              e.currentTarget.style.color = '#6b7280';
            }}
          >
            <svg 
              width="12" 
              height="12" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2"
              style={{ 
                transform: allExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s ease'
              }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
            {allExpanded ? 'Collapse All' : 'Expand All'}
          </button>
        </div>

        {/* Atlas Score Breakdown - Toggleable Radar Chart */}
        <AtlasScoreBreakdown 
          kingdom={kingdom} 
          rank={rank > 0 ? rank : undefined}
          totalKingdoms={totalKingdomsAtKvk > 0 ? totalKingdomsAtKvk : (rankingList.length || undefined)}
          isExpanded={breakdownExpanded}
          onToggle={setBreakdownExpanded}
        />

        {/* Atlas Score Simulator - Pro Feature */}
        <ScoreSimulator 
          kingdom={kingdom} 
          isExpanded={simulatorExpanded}
          onToggle={setSimulatorExpanded}
        />

        {/* Atlas Score History Chart */}
        <div style={{ marginBottom: isMobile ? '1.25rem' : '1.5rem' }}>
          <ScoreHistoryChart 
            kingdomNumber={kingdom.kingdom_number} 
            isExpanded={scoreHistoryExpanded}
            onToggle={setScoreHistoryExpanded}
          />
        </div>

        {/* Kingdom Ranking History Chart */}
        <div style={{ marginBottom: isMobile ? '1.25rem' : '1.5rem' }}>
          <RankingHistoryChart 
            kingdomNumber={kingdom.kingdom_number} 
            isExpanded={rankingHistoryExpanded}
            onToggle={setRankingHistoryExpanded}
          />
        </div>

        {/* Path to Next Tier - What-If Scenarios */}
        <PathToNextTier 
          kingdom={kingdom} 
          isExpanded={pathExpanded}
          onToggle={setPathExpanded}
        />

        {/* Performance Trend Chart */}
        {kingdom.recent_kvks && kingdom.recent_kvks.length >= 2 && (
          <div style={{ marginBottom: isMobile ? '1.25rem' : '1.5rem' }}>
            <TrendChart 
              kvkRecords={kingdom.recent_kvks} 
              isExpanded={trendExpanded}
              onToggle={setTrendExpanded}
            />
          </div>
        )}

        {/* Atlas Users from this Kingdom */}
        <KingdomPlayers kingdomNumber={kingdom.kingdom_number} themeColor="#22d3ee" />

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

      {/* KvK Error Report Modal */}
      {kingdom && (
        <ReportKvKErrorModal
          kingdomNumber={kingdom.kingdom_number}
          kvkRecords={kingdom.recent_kvks || []}
          isOpen={showKvKErrorModal}
          onClose={() => setShowKvKErrorModal(false)}
        />
      )}
    </div>
  );
};

export default KingdomProfile;
