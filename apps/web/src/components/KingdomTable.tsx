import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Kingdom, getPowerTier } from '../types';
import { neonGlow } from '../utils/styles';
import { getOutcomeStats } from '../utils/kingdomStats';

interface TableColumn {
  id: string;
  label: string;
  color?: string;
  getValue: (k: Kingdom, rank?: number) => string | number;
  align?: 'left' | 'center' | 'right';
}

const getTranslatedColumns = (t: (key: string, fallback: string) => string): TableColumn[] => [
  { id: 'favorite', label: '★', getValue: () => '', align: 'center' },
  { id: 'kingdom', label: t('table.kingdom', 'Kingdom'), getValue: (k) => `${t('common.kingdom', 'Kingdom')} ${k.kingdom_number}`, align: 'left' },
  { id: 'tier', label: t('table.tier', 'Tier'), color: '#fbbf24', getValue: (k) => k.power_tier || getPowerTier(k.overall_score), align: 'center' },
  { id: 'atlas_score', label: t('table.atlasScore', 'Atlas Score'), color: '#22d3ee', getValue: (k) => k.overall_score.toFixed(2), align: 'center' },
  { id: 'rank', label: t('table.rank', 'Rank'), color: '#22d3ee', getValue: (_k, rank) => rank ? `#${rank}` : '-', align: 'center' },
  { id: 'total_kvks', label: t('table.kvks', 'KvKs'), getValue: (k) => k.total_kvks, align: 'center' },
  { id: 'prep_wins', label: t('table.prepW', 'Prep W'), color: '#eab308', getValue: (k) => k.prep_wins, align: 'center' },
  { id: 'prep_wr', label: t('table.prepWR', 'Prep WR'), color: '#eab308', getValue: (k) => `${Math.round(k.prep_win_rate * 100)}%`, align: 'center' },
  { id: 'prep_streak', label: t('table.prepStreak', 'Prep Streak'), color: '#eab308', getValue: (k) => k.prep_streak > 0 ? `${k.prep_streak}W` : `${Math.abs(k.prep_streak)}L`, align: 'center' },
  { id: 'battle_wins', label: t('table.battleW', 'Battle W'), color: '#f97316', getValue: (k) => k.battle_wins, align: 'center' },
  { id: 'battle_wr', label: t('table.battleWR', 'Battle WR'), color: '#f97316', getValue: (k) => `${Math.round(k.battle_win_rate * 100)}%`, align: 'center' },
  { id: 'battle_streak', label: t('table.battleStreak', 'Battle Streak'), color: '#f97316', getValue: (k) => k.battle_streak > 0 ? `${k.battle_streak}W` : `${Math.abs(k.battle_streak)}L`, align: 'center' },
  { id: 'dominations', label: '👑 ' + t('table.dominations', 'Dominations'), color: '#22c55e', getValue: (k) => getOutcomeStats(k).dominations, align: 'center' },
  { id: 'comebacks', label: '💪 ' + t('table.comebacks', 'Comebacks'), color: '#3b82f6', getValue: (k) => getOutcomeStats(k).comebacks, align: 'center' },
  { id: 'reversals', label: '🔄 ' + t('table.reversals', 'Reversals'), color: '#a855f7', getValue: (k) => getOutcomeStats(k).reversals, align: 'center' },
  { id: 'invasions', label: '💀 ' + t('table.invasions', 'Invasions'), color: '#ef4444', getValue: (k) => getOutcomeStats(k).invasions, align: 'center' },
  { id: 'status', label: t('table.transferStatus', 'Transfer Status'), getValue: (k) => k.most_recent_status || t('table.unannounced', 'Unannounced'), align: 'center' }
];

const DEFAULT_COLUMNS = ['kingdom', 'favorite', 'tier', 'atlas_score', 'rank', 'total_kvks', 'dominations', 'comebacks', 'reversals', 'invasions', 'status'];

// Map column IDs to sortBy keys
const SORTABLE_COLUMNS: Record<string, string> = {
  'kingdom': 'kingdom_number',
  'atlas_score': 'overall_score',
  'rank': 'overall_score',
  'total_kvks': 'total_kvks',
  'prep_wins': 'prep_wins',
  'prep_wr': 'prep_win_rate',
  'battle_wins': 'battle_wins',
  'battle_wr': 'battle_win_rate',
  'dominations': 'dominations',
  'comebacks': 'comebacks',
  'reversals': 'reversals',
  'invasions': 'invasions',
};
const TABLE_COLUMNS_KEY = 'kingshot_table_columns';

interface KingdomTableProps {
  kingdoms: (Kingdom & { rank?: number })[];
  favorites: number[];
  toggleFavorite: (kingdomNumber: number) => void;
  onAddToCompare?: (kingdomNumber: number) => void;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  onSort?: (sortBy: string) => void;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'Leading': return '#fbbf24'; // Gold
    case 'Ordinary': return '#c0c0c0'; // Silver
    case 'Unannounced': return '#6b7280'; // Grey (missing data)
    default: return '#6b7280';
  }
};

const KingdomTable: React.FC<KingdomTableProps> = ({ 
  kingdoms, 
  favorites, 
  toggleFavorite,
  sortBy,
  sortOrder,
  onSort
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const ALL_COLUMNS = useMemo(() => getTranslatedColumns(t), [t]);
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    const saved = localStorage.getItem(TABLE_COLUMNS_KEY);
    return saved ? JSON.parse(saved) : DEFAULT_COLUMNS;
  });

  const toggleColumn = (columnId: string) => {
    setVisibleColumns(prev => {
      const newCols = prev.includes(columnId) 
        ? prev.filter(id => id !== columnId)
        : [...prev, columnId];
      localStorage.setItem(TABLE_COLUMNS_KEY, JSON.stringify(newCols));
      return newCols;
    });
  };

  const resetColumns = () => {
    setVisibleColumns(DEFAULT_COLUMNS);
    localStorage.setItem(TABLE_COLUMNS_KEY, JSON.stringify(DEFAULT_COLUMNS));
  };

  return (
    <div style={{ marginBottom: '3rem' }}>
      {/* Column Selector */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.75rem', position: 'relative' }}>
        <button
          onClick={() => setShowColumnSelector(!showColumnSelector)}
          style={{
            padding: '0.5rem 0.75rem',
            backgroundColor: '#111111',
            border: '1px solid #2a2a2a',
            borderRadius: '6px',
            color: '#9ca3af',
            fontSize: '0.8rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          <svg style={{ width: '14px', height: '14px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
          </svg>
          {t('table.columns', 'Columns')} ({visibleColumns.length})
        </button>
        
        {showColumnSelector && (
          <div style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: '0.5rem',
            backgroundColor: '#111111',
            border: '1px solid #2a2a2a',
            borderRadius: '10px',
            padding: '0.75rem',
            zIndex: 100,
            minWidth: '220px',
            maxHeight: '400px',
            overflowY: 'auto',
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', paddingBottom: '0.5rem', borderBottom: '1px solid #2a2a2a' }}>
              <span style={{ color: '#fff', fontSize: '0.85rem', fontWeight: '600' }}>{t('table.showColumns', 'Show Columns')}</span>
              <button onClick={resetColumns} style={{ background: 'none', border: 'none', color: '#22d3ee', fontSize: '0.75rem', cursor: 'pointer' }}>{t('common.reset', 'Reset')}</button>
            </div>
            {ALL_COLUMNS.map(col => (
              <label key={col.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={visibleColumns.includes(col.id)}
                  onChange={() => toggleColumn(col.id)}
                  style={{ accentColor: col.color || '#22d3ee' }}
                />
                <span style={{ color: col.color || '#9ca3af', fontSize: '0.8rem' }}>{col.label}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      <div style={{ backgroundColor: '#111111', borderRadius: '12px', overflow: 'auto', border: '1px solid #2a2a2a', position: 'relative' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: `${visibleColumns.length * 80 + 120}px` }}>
          <thead>
            <tr style={{ backgroundColor: '#0a0a0a' }}>
              {visibleColumns.map((colId, idx) => {
                const col = ALL_COLUMNS.find(c => c.id === colId);
                if (!col) return null;
                const isKingdom = colId === 'kingdom';
                const isFirst = idx === 0;
                const isSortable = !!SORTABLE_COLUMNS[colId];
                const isCurrentSort = sortBy === SORTABLE_COLUMNS[colId];
                
                return (
                  <th 
                    key={col.id} 
                    onClick={() => isSortable && onSort && SORTABLE_COLUMNS[colId] && onSort(SORTABLE_COLUMNS[colId]!)}
                    style={{ 
                      padding: '0.75rem 0.5rem', 
                      textAlign: col.align || 'center', 
                      color: isCurrentSort ? '#22d3ee' : (col.color || '#6b7280'), 
                      fontSize: '0.75rem', 
                      fontWeight: '600', 
                      whiteSpace: 'nowrap',
                      borderLeft: isFirst ? 'none' : '1px solid #2a2a2a',
                      cursor: isSortable ? 'pointer' : 'default',
                      userSelect: 'none',
                      position: isKingdom ? 'sticky' : 'static',
                      left: isKingdom ? 0 : 'auto',
                      backgroundColor: '#0a0a0a',
                      zIndex: isKingdom ? 2 : 1,
                      transition: 'color 0.2s'
                    }}
                    onMouseEnter={(e) => isSortable && (e.currentTarget.style.color = '#22d3ee')}
                    onMouseLeave={(e) => isSortable && !isCurrentSort && (e.currentTarget.style.color = col.color || '#6b7280')}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                      {col.label}
                      {isCurrentSort && (
                        <svg style={{ width: '12px', height: '12px', transform: sortOrder === 'asc' ? 'rotate(180deg)' : 'none' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      )}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {kingdoms.map((kingdom, index) => {
              const isFav = favorites.includes(kingdom.kingdom_number);
              return (
                <tr 
                  key={kingdom.kingdom_number} 
                  style={{ 
                    borderBottom: '1px solid #2a2a2a', 
                    cursor: 'pointer', 
                    transition: 'background-color 0.2s', 
                    animation: `fadeIn 0.2s ease ${index * 0.02}s both` 
                  }} 
                  onClick={() => navigate(`/kingdom/${kingdom.kingdom_number}`)} 
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1a1a1a'} 
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  {visibleColumns.map((colId, idx) => {
                    const col = ALL_COLUMNS.find(c => c.id === colId);
                    if (!col) return null;
                    const value = col.getValue(kingdom, kingdom.rank);
                    const isStatus = colId === 'status';
                    const isTier = colId === 'tier';
                    const isFavorite = colId === 'favorite';
                    const isKingdom = colId === 'kingdom';
                    const isFirst = idx === 0;
                    
                    return (
                      <td key={col.id} style={{ 
                        padding: '0.6rem 0.5rem', 
                        textAlign: col.align || 'center', 
                        whiteSpace: 'nowrap',
                        borderLeft: isFirst ? 'none' : '1px solid #2a2a2a',
                        position: isKingdom ? 'sticky' : 'static',
                        left: isKingdom ? 0 : 'auto',
                        backgroundColor: isKingdom ? '#111111' : 'transparent',
                        zIndex: isKingdom ? 1 : 0
                      }}>
                        {isFavorite ? (
                          <button 
                            onClick={(e) => { e.stopPropagation(); toggleFavorite(kingdom.kingdom_number); }} 
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', color: isFav ? '#fbbf24' : '#4a4a4a' }}
                          >
                            {isFav ? '★' : '☆'}
                          </button>
                        ) : isStatus ? (
                          <span style={{ ...neonGlow(getStatusColor(value.toString())), fontSize: '0.75rem', fontWeight: 'bold' }}>{value.toString().toUpperCase()}</span>
                        ) : isTier ? (
                          <span style={{ 
                            padding: '0.2rem 0.5rem', 
                            borderRadius: '4px', 
                            fontSize: '0.75rem', 
                            fontWeight: 'bold',
                            backgroundColor: value === 'S' ? '#fbbf2420' : value === 'A' ? '#22c55e20' : value === 'B' ? '#3b82f620' : '#9ca3af20',
                            color: value === 'S' ? '#fbbf24' : value === 'A' ? '#22c55e' : value === 'B' ? '#3b82f6' : '#9ca3af'
                          }}>{value}</span>
                        ) : (
                          <span style={{ color: col.color || '#9ca3af', fontWeight: col.color ? '600' : '400', fontSize: '0.85rem' }}>{value}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default KingdomTable;
