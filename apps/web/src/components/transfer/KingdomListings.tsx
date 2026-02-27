import React, { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { colors } from '../../utils/styles';
import type { KingdomData, KingdomFund, KingdomReviewSummary, BoardMode, MatchDetail } from '../KingdomListingCard';

const KingdomListingCard = lazy(() => import('../KingdomListingCard'));

interface KingdomListingsProps {
  loading: boolean;
  kingdomsWithFunds: KingdomData[];
  kingdomsWithoutFunds: KingdomData[];
  filteredKingdoms: KingdomData[];
  fundMap: Map<number, KingdomFund>;
  reviewMap: Map<number, KingdomReviewSummary>;
  matchScoreMap: Map<number, { score: number; details: MatchDetail[] }>;
  mode: BoardMode;
  visibleCount: number;
  highlightedKingdom: number | null;
  compareKingdoms: Set<number>;
  sentinelRef: React.MutableRefObject<HTMLDivElement | null>;
  onApply: (kn: number) => void;
  onFund: (kn: number) => void;
  onToggleCompare: (kn: number) => void;
  onClearFilters: () => void;
}

const KingdomListings: React.FC<KingdomListingsProps> = ({
  loading,
  kingdomsWithFunds,
  kingdomsWithoutFunds,
  filteredKingdoms,
  fundMap,
  reviewMap,
  matchScoreMap,
  mode,
  visibleCount,
  highlightedKingdom,
  compareKingdoms,
  sentinelRef,
  onApply,
  onFund,
  onToggleCompare,
  onClearFilters,
}) => {
  const { t } = useTranslation();

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} style={{
            backgroundColor: '#111111',
            borderRadius: '12px',
            border: '1px solid #2a2a2a',
            padding: '1rem',
            animation: 'pulse 1.5s ease-in-out infinite',
          }}>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '0.75rem' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: '#1a1a1a' }} />
              <div style={{ flex: 1 }}>
                <div style={{ height: '14px', width: '120px', backgroundColor: '#1a1a1a', borderRadius: '4px', marginBottom: '6px' }} />
                <div style={{ height: '10px', width: '80px', backgroundColor: '#1a1a1a', borderRadius: '4px' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {[1, 2, 3, 4].map((j) => (
                <div key={j} style={{ flex: 1, height: '36px', backgroundColor: '#1a1a1a', borderRadius: '6px' }} />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: '0.75rem',
      transition: 'opacity 0.2s ease',
      opacity: 1,
    }}>
      {/* Funded kingdoms first */}
      {kingdomsWithFunds.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          paddingBottom: '0.35rem',
        }}>
          <span style={{ fontSize: '0.8rem' }}>⭐</span>
          <span style={{ color: colors.gold, fontSize: '0.8rem', fontWeight: 600 }}>
            {t('transferHub.featuredKingdoms', 'Featured Kingdoms')}
          </span>
          <span style={{ color: colors.textMuted, fontSize: '0.65rem' }}>
            {kingdomsWithFunds.length}
          </span>
          <div style={{ flex: 1, height: '1px', backgroundColor: colors.border }} />
        </div>
      )}
      <Suspense fallback={<div style={{ textAlign: 'center', padding: '1rem', color: colors.textMuted }}>Loading...</div>}>
        {kingdomsWithFunds.map((kingdom) => {
          const fund = fundMap.get(kingdom.kingdom_number) || null;
          const matchResult = matchScoreMap.get(kingdom.kingdom_number);
          return (
            <KingdomListingCard
              key={kingdom.kingdom_number}
              kingdom={kingdom}
              fund={fund}
              reviewSummary={reviewMap.get(kingdom.kingdom_number) || null}
              mode={mode}
              matchScore={matchResult?.score}
              matchDetails={matchResult?.details}
              onApply={onApply}
              onFund={onFund}
              highlighted={highlightedKingdom === kingdom.kingdom_number}
              isComparing={compareKingdoms.has(kingdom.kingdom_number)}
              onToggleCompare={onToggleCompare}
            />
          );
        })}

        {/* Separator if both groups exist */}
        {kingdomsWithFunds.length > 0 && kingdomsWithoutFunds.length > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            margin: '0.75rem 0 0.35rem',
          }}>
            <span style={{ fontSize: '0.8rem' }}>🏰</span>
            <span style={{ color: colors.textSecondary, fontSize: '0.8rem', fontWeight: 600 }}>
              {t('transferHub.standardListings', 'Standard Listings')}
            </span>
            <span style={{ color: colors.textMuted, fontSize: '0.65rem' }}>
              {kingdomsWithoutFunds.length}
            </span>
            <div style={{ flex: 1, height: '1px', backgroundColor: colors.border }} />
          </div>
        )}

        {/* Standard (unfunded) kingdoms — infinite scroll */}
        {kingdomsWithoutFunds.slice(0, visibleCount).map((kingdom) => {
          const fund = null;
          const matchResult = matchScoreMap.get(kingdom.kingdom_number);
          return (
            <KingdomListingCard
              key={kingdom.kingdom_number}
              kingdom={kingdom}
              fund={fund}
              reviewSummary={reviewMap.get(kingdom.kingdom_number) || null}
              mode={mode}
              matchScore={matchResult?.score}
              matchDetails={matchResult?.details}
              onApply={onApply}
              onFund={onFund}
              highlighted={highlightedKingdom === kingdom.kingdom_number}
              isComparing={compareKingdoms.has(kingdom.kingdom_number)}
              onToggleCompare={onToggleCompare}
            />
          );
        })}
      </Suspense>

      {/* Infinite scroll sentinel */}
      {visibleCount < kingdomsWithoutFunds.length && (
        <div ref={sentinelRef} style={{ padding: '1.5rem 0', textAlign: 'center' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
            color: '#6b7280', fontSize: '0.8rem',
          }}>
            <div style={{
              width: '16px', height: '16px',
              border: '2px solid #2a2a2a', borderTopColor: '#22d3ee',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }} />
            {t('transferHub.loadingMore', 'Loading more kingdoms...')}
          </div>
        </div>
      )}

      {filteredKingdoms.length === 0 && (
        <div style={{
          textAlign: 'center', padding: '3rem 1rem',
          backgroundColor: '#111111', borderRadius: '16px',
          border: '1px solid #2a2a2a',
        }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem', opacity: 0.6 }}>🔍</div>
          <p style={{ fontSize: '1.1rem', marginBottom: '0.4rem', color: '#d1d5db', fontWeight: '600' }}>{t('transferHub.noMatch', 'No kingdoms match your filters')}</p>
          <p style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '1rem' }}>{t('transferHub.tryAdjusting', 'Try adjusting your filters or clearing them to see all kingdoms.')}</p>
          <button
            onClick={onClearFilters}
            style={{
              padding: '0.5rem 1.25rem', backgroundColor: '#22d3ee15',
              border: '1px solid #22d3ee30', borderRadius: '8px',
              color: '#22d3ee', fontSize: '0.8rem', fontWeight: '600',
              cursor: 'pointer', minHeight: '44px',
            }}
          >
            {t('transferHub.clearFilters', 'Clear All Filters')}
          </button>
        </div>
      )}
    </div>
  );
};

export default KingdomListings;
