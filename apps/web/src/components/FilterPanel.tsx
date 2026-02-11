import React from 'react';
import { FilterOptions } from '../types';
import { countActiveFilters, DEFAULT_FILTERS } from '../utils/kingdomStats';
import { useTranslation } from 'react-i18next';

interface FilterPanelProps {
  filters: FilterOptions;
  setFilters: React.Dispatch<React.SetStateAction<FilterOptions>>;
  isMobile: boolean;
  onClearAll?: () => void;
}

const FilterPanel: React.FC<FilterPanelProps> = ({ filters, setFilters, isMobile, onClearAll }) => {
  const { t } = useTranslation();
  const activeCount = countActiveFilters(filters);
  const handleClearAll = () => {
    setFilters(DEFAULT_FILTERS);
    onClearAll?.();
  };
  return (
    <div 
      className="filter-panel" 
      style={{ 
        padding: isMobile ? '1rem' : '1.5rem', 
        backgroundColor: 'rgba(17, 17, 17, 0.9)', 
        borderRadius: '12px', 
        marginBottom: '1.5rem', 
        display: 'grid', 
        gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', 
        gap: isMobile ? '1rem' : '1.25rem', 
        border: '1px solid #2a2a2a', 
        animation: 'fadeIn 0.2s ease', 
        backdropFilter: 'blur(12px)' 
      }}
    >
      {/* Kingdom Tier */}
      <div>
        <label style={{ fontSize: '0.85rem', color: '#9ca3af', display: 'block', marginBottom: '0.5rem' }}>{t('filters.kingdomTier', 'Kingdom Tier')}</label>
        <select 
          value={filters.tier || 'all'} 
          onChange={(e) => setFilters({ ...filters, tier: e.target.value })} 
          style={{ width: '100%', padding: isMobile ? '0.75rem' : '0.6rem', minHeight: '44px', backgroundColor: '#0a0a0a', border: '1px solid #2a2a2a', borderRadius: '6px', color: '#fff', fontSize: '1rem' }}
        >
          <option value="all">{t('filters.allTiers', 'All Tiers')}</option>
          <option value="S">S Tier - Elite (Top 10%)</option>
          <option value="A">A Tier - Strong (Top 25%)</option>
          <option value="B">B Tier - Average (Top 50%)</option>
          <option value="C">C Tier - Below Average (Top 75%)</option>
          <option value="D">D Tier - Developing (Bottom 25%)</option>
        </select>
      </div>

      {/* Transfer Status */}
      <div>
        <label style={{ fontSize: '0.85rem', color: '#9ca3af', display: 'block', marginBottom: '0.5rem' }}>{t('filters.transferStatus', 'Transfer Status')}</label>
        <select 
          value={filters.status || 'all'} 
          onChange={(e) => setFilters({ ...filters, status: e.target.value })} 
          style={{ width: '100%', padding: isMobile ? '0.75rem' : '0.6rem', minHeight: '44px', backgroundColor: '#0a0a0a', border: '1px solid #2a2a2a', borderRadius: '6px', color: '#fff', fontSize: '1rem' }}
        >
          <option value="all">{t('filters.allStatuses', 'All Statuses')}</option>
          <option value="Leading">Leading</option>
          <option value="Ordinary">Ordinary</option>
          <option value="Unannounced">Unannounced</option>
        </select>
      </div>

      {/* Experience (KvKs Range) */}
      <div>
        <label style={{ fontSize: '0.85rem', color: '#9ca3af', display: 'block', marginBottom: '0.5rem' }}>{t('filters.experience', 'Experience (KvKs)')}</label>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <input 
            type="number" 
            min="0" 
            max="20" 
            value={filters.minKvKs || 0} 
            onChange={(e) => setFilters({ ...filters, minKvKs: parseInt(e.target.value) || 0 })} 
            placeholder="Min"
            style={{ width: '100%', padding: isMobile ? '0.75rem' : '0.6rem', minHeight: '44px', backgroundColor: '#0a0a0a', border: '1px solid #2a2a2a', borderRadius: '6px', color: '#fff', fontSize: '1rem', textAlign: 'center' }} 
          />
          <span style={{ color: '#6b7280', fontSize: '0.85rem' }}>to</span>
          <input 
            type="number" 
            min="0" 
            max="99" 
            value={filters.maxKvKs === 99 ? '' : filters.maxKvKs} 
            onChange={(e) => setFilters({ ...filters, maxKvKs: parseInt(e.target.value) || 99 })} 
            placeholder="Max"
            style={{ width: '100%', padding: isMobile ? '0.75rem' : '0.6rem', minHeight: '44px', backgroundColor: '#0a0a0a', border: '1px solid #2a2a2a', borderRadius: '6px', color: '#fff', fontSize: '1rem', textAlign: 'center' }} 
          />
        </div>
      </div>

      {/* Min Prep WR */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <label style={{ fontSize: '0.85rem', color: '#9ca3af' }}>{t('filters.minPrepWR', 'Min Prep WR')}</label>
          <span style={{ fontSize: '0.85rem', color: '#eab308', fontWeight: 'bold' }}>{Math.round((filters.minPrepWinRate || 0) * 100)}%</span>
        </div>
        <input 
          type="range" 
          min="0" 
          max="100" 
          value={(filters.minPrepWinRate || 0) * 100} 
          onChange={(e) => setFilters({ ...filters, minPrepWinRate: parseInt(e.target.value) / 100 })} 
          style={{ width: '100%', height: '6px', appearance: 'none', backgroundColor: '#1f1f1f', borderRadius: '3px', cursor: 'pointer' }} 
        />
      </div>

      {/* Min Battle WR */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <label style={{ fontSize: '0.85rem', color: '#9ca3af' }}>{t('filters.minBattleWR', 'Min Battle WR')}</label>
          <span style={{ fontSize: '0.85rem', color: '#f97316', fontWeight: 'bold' }}>{Math.round((filters.minBattleWinRate || 0) * 100)}%</span>
        </div>
        <input 
          type="range" 
          min="0" 
          max="100" 
          value={(filters.minBattleWinRate || 0) * 100} 
          onChange={(e) => setFilters({ ...filters, minBattleWinRate: parseInt(e.target.value) / 100 })} 
          style={{ width: '100%', height: '6px', appearance: 'none', backgroundColor: '#1f1f1f', borderRadius: '3px', cursor: 'pointer' }} 
        />
      </div>

      {/* Clear All Filters */}
      <div style={{ display: 'flex', alignItems: 'flex-end' }}>
        <button 
          onClick={handleClearAll} 
          style={{ 
            padding: isMobile ? '0.75rem 1.25rem' : '0.6rem 1.25rem', 
            minHeight: '44px',
            backgroundColor: activeCount > 0 ? '#ef444420' : 'transparent', 
            border: `1px solid ${activeCount > 0 ? '#ef4444' : '#3a3a3a'}`, 
            borderRadius: '6px', 
            color: activeCount > 0 ? '#ef4444' : '#9ca3af', 
            cursor: 'pointer', 
            fontSize: '0.9rem',
            fontWeight: activeCount > 0 ? '500' : 'normal',
            transition: 'all 0.2s'
          }}
        >
          {t('filters.clearAll', 'Clear All Filters')}{activeCount > 0 && ` (${activeCount})`}
        </button>
      </div>
    </div>
  );
};

export default FilterPanel;
