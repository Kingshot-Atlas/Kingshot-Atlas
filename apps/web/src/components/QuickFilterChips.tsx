import React from 'react';
import { FilterOptions } from '../types';

interface QuickFilterChipsProps {
  filters: FilterOptions;
  setFilters: React.Dispatch<React.SetStateAction<FilterOptions>>;
  isMobile: boolean;
}

const QuickFilterChips: React.FC<QuickFilterChipsProps> = ({ filters, setFilters, isMobile }) => {
  return (
    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
      {/* S-Tier - Always shown */}
      <button
        onClick={() => setFilters(f => ({ ...f, tier: f.tier === 'S' ? 'all' : 'S' }))}
        style={{
          padding: '0.3rem 0.6rem',
          backgroundColor: filters.tier === 'S' ? '#fbbf2420' : 'transparent',
          border: `1px solid ${filters.tier === 'S' ? '#fbbf24' : '#3a3a3a'}`,
          borderRadius: '16px',
          color: filters.tier === 'S' ? '#fbbf24' : '#6b7280',
          cursor: 'pointer',
          fontSize: '0.75rem',
          fontWeight: '500',
          transition: 'all 0.2s'
        }}
      >
        S-Tier
      </button>

      {/* A-Tier - Desktop only */}
      {!isMobile && (
        <button
          onClick={() => setFilters(f => ({ ...f, tier: f.tier === 'A' ? 'all' : 'A' }))}
          style={{
            padding: '0.3rem 0.6rem',
            backgroundColor: filters.tier === 'A' ? '#22c55e20' : 'transparent',
            border: `1px solid ${filters.tier === 'A' ? '#22c55e' : '#3a3a3a'}`,
            borderRadius: '16px',
            color: filters.tier === 'A' ? '#22c55e' : '#6b7280',
            cursor: 'pointer',
            fontSize: '0.75rem',
            fontWeight: '500',
            transition: 'all 0.2s'
          }}
        >
          A-Tier
        </button>
      )}
      
      {!isMobile && <span style={{ color: '#2a2a2a', margin: '0 0.25rem' }}>|</span>}
      
      {/* 100% Prep - Always shown */}
      <button
        onClick={() => setFilters(f => ({ ...f, minPrepWinRate: f.minPrepWinRate === 1 ? 0 : 1 }))}
        style={{
          padding: '0.3rem 0.6rem',
          backgroundColor: filters.minPrepWinRate === 1 ? '#eab30820' : 'transparent',
          border: `1px solid ${filters.minPrepWinRate === 1 ? '#eab308' : '#3a3a3a'}`,
          borderRadius: '16px',
          color: filters.minPrepWinRate === 1 ? '#eab308' : '#6b7280',
          cursor: 'pointer',
          fontSize: '0.75rem',
          fontWeight: '500',
          transition: 'all 0.2s'
        }}
      >
        100% Prep
      </button>

      {/* 80%+ Prep - Desktop only */}
      {!isMobile && (
        <button
          onClick={() => setFilters(f => ({ ...f, minPrepWinRate: f.minPrepWinRate === 0.8 ? 0 : 0.8 }))}
          style={{
            padding: '0.3rem 0.6rem',
            backgroundColor: filters.minPrepWinRate === 0.8 ? '#eab30815' : 'transparent',
            border: `1px solid ${filters.minPrepWinRate === 0.8 ? '#eab30880' : '#3a3a3a'}`,
            borderRadius: '16px',
            color: filters.minPrepWinRate === 0.8 ? '#eab308' : '#6b7280',
            cursor: 'pointer',
            fontSize: '0.75rem',
            fontWeight: '500',
            transition: 'all 0.2s'
          }}
        >
          80%+ Prep
        </button>
      )}

      {/* 100% Battle - Always shown */}
      <button
        onClick={() => setFilters(f => ({ ...f, minBattleWinRate: f.minBattleWinRate === 1 ? 0 : 1 }))}
        style={{
          padding: '0.3rem 0.6rem',
          backgroundColor: filters.minBattleWinRate === 1 ? '#f9731620' : 'transparent',
          border: `1px solid ${filters.minBattleWinRate === 1 ? '#f97316' : '#3a3a3a'}`,
          borderRadius: '16px',
          color: filters.minBattleWinRate === 1 ? '#f97316' : '#6b7280',
          cursor: 'pointer',
          fontSize: '0.75rem',
          fontWeight: '500',
          transition: 'all 0.2s'
        }}
      >
        100% Battle
      </button>

      {/* 80%+ Battle - Desktop only */}
      {!isMobile && (
        <button
          onClick={() => setFilters(f => ({ ...f, minBattleWinRate: f.minBattleWinRate === 0.8 ? 0 : 0.8 }))}
          style={{
            padding: '0.3rem 0.6rem',
            backgroundColor: filters.minBattleWinRate === 0.8 ? '#f9731615' : 'transparent',
            border: `1px solid ${filters.minBattleWinRate === 0.8 ? '#f9731680' : '#3a3a3a'}`,
            borderRadius: '16px',
            color: filters.minBattleWinRate === 0.8 ? '#f97316' : '#6b7280',
            cursor: 'pointer',
            fontSize: '0.75rem',
            fontWeight: '500',
            transition: 'all 0.2s'
          }}
        >
          80%+ Battle
        </button>
      )}
      
      {!isMobile && <span style={{ color: '#2a2a2a', margin: '0 0.25rem' }}>|</span>}
      
      {/* Experience Chips - Desktop only */}
      {!isMobile && (
        <>
          <button
            onClick={() => setFilters(f => (f.minKvKs === 1 && f.maxKvKs === 3) ? { ...f, minKvKs: 0, maxKvKs: 99 } : { ...f, minKvKs: 1, maxKvKs: 3 })}
            style={{
              padding: '0.3rem 0.6rem',
              backgroundColor: (filters.minKvKs === 1 && filters.maxKvKs === 3) ? '#a855f720' : 'transparent',
              border: `1px solid ${(filters.minKvKs === 1 && filters.maxKvKs === 3) ? '#a855f7' : '#3a3a3a'}`,
              borderRadius: '16px',
              color: (filters.minKvKs === 1 && filters.maxKvKs === 3) ? '#a855f7' : '#6b7280',
              cursor: 'pointer',
              fontSize: '0.75rem',
              fontWeight: '500',
              transition: 'all 0.2s'
            }}
          >
            1-3 KvKs
          </button>
          <button
            onClick={() => setFilters(f => (f.minKvKs === 4 && f.maxKvKs === 6) ? { ...f, minKvKs: 0, maxKvKs: 99 } : { ...f, minKvKs: 4, maxKvKs: 6 })}
            style={{
              padding: '0.3rem 0.6rem',
              backgroundColor: (filters.minKvKs === 4 && filters.maxKvKs === 6) ? '#22d3ee20' : 'transparent',
              border: `1px solid ${(filters.minKvKs === 4 && filters.maxKvKs === 6) ? '#22d3ee' : '#3a3a3a'}`,
              borderRadius: '16px',
              color: (filters.minKvKs === 4 && filters.maxKvKs === 6) ? '#22d3ee' : '#6b7280',
              cursor: 'pointer',
              fontSize: '0.75rem',
              fontWeight: '500',
              transition: 'all 0.2s'
            }}
          >
            4-6 KvKs
          </button>
          <button
            onClick={() => setFilters(f => (f.minKvKs === 7 && f.maxKvKs === 9) ? { ...f, minKvKs: 0, maxKvKs: 99 } : { ...f, minKvKs: 7, maxKvKs: 9 })}
            style={{
              padding: '0.3rem 0.6rem',
              backgroundColor: (filters.minKvKs === 7 && filters.maxKvKs === 9) ? '#22c55e20' : 'transparent',
              border: `1px solid ${(filters.minKvKs === 7 && filters.maxKvKs === 9) ? '#22c55e' : '#3a3a3a'}`,
              borderRadius: '16px',
              color: (filters.minKvKs === 7 && filters.maxKvKs === 9) ? '#22c55e' : '#6b7280',
              cursor: 'pointer',
              fontSize: '0.75rem',
              fontWeight: '500',
              transition: 'all 0.2s'
            }}
          >
            7-9 KvKs
          </button>
        </>
      )}
    </div>
  );
};

export default QuickFilterChips;
