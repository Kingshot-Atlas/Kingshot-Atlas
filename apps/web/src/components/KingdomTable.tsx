import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Kingdom, getPowerTier } from '../types';

interface TableColumn {
  id: string;
  label: string;
  color?: string;
  getValue: (k: Kingdom, rank?: number) => string | number;
  align?: 'left' | 'center' | 'right';
}

const ALL_COLUMNS: TableColumn[] = [
  { id: 'kingdom', label: 'Kingdom', getValue: (k) => `Kingdom ${k.kingdom_number}`, align: 'left' },
  { id: 'tier', label: 'Tier', color: '#fbbf24', getValue: (k) => k.power_tier || getPowerTier(k.overall_score), align: 'center' },
  { id: 'atlas_score', label: 'Atlas Score', color: '#22d3ee', getValue: (k) => k.overall_score.toFixed(1), align: 'center' },
  { id: 'rank', label: 'Rank', color: '#a855f7', getValue: (_k, rank) => rank ? `#${rank}` : '-', align: 'center' },
  { id: 'total_kvks', label: 'KvKs', getValue: (k) => k.total_kvks, align: 'center' },
  { id: 'prep_wins', label: 'Prep W', color: '#eab308', getValue: (k) => k.prep_wins, align: 'center' },
  { id: 'prep_wr', label: 'Prep WR', color: '#eab308', getValue: (k) => `${Math.round(k.prep_win_rate * 100)}%`, align: 'center' },
  { id: 'prep_streak', label: 'Prep Streak', color: '#eab308', getValue: (k) => k.prep_streak > 0 ? `${k.prep_streak}W` : `${Math.abs(k.prep_streak)}L`, align: 'center' },
  { id: 'battle_wins', label: 'Battle W', color: '#f97316', getValue: (k) => k.battle_wins, align: 'center' },
  { id: 'battle_wr', label: 'Battle WR', color: '#f97316', getValue: (k) => `${Math.round(k.battle_win_rate * 100)}%`, align: 'center' },
  { id: 'battle_streak', label: 'Battle Streak', color: '#f97316', getValue: (k) => k.battle_streak > 0 ? `${k.battle_streak}W` : `${Math.abs(k.battle_streak)}L`, align: 'center' },
  { id: 'dominations', label: '👑 Dominations', color: '#22c55e', getValue: (k) => k.high_kings || 0, align: 'center' },
  { id: 'comebacks', label: '💪 Comebacks', color: '#3b82f6', getValue: (k) => {
    const prepLosses = k.prep_losses || (k.total_kvks - k.prep_wins);
    const battleWins = k.battle_wins;
    return Math.min(prepLosses, battleWins);
  }, align: 'center' },
  { id: 'reversals', label: '🔄 Reversals', color: '#a855f7', getValue: (k) => {
    const prepWins = k.prep_wins;
    const battleLosses = k.battle_losses || (k.total_kvks - k.battle_wins);
    return Math.min(prepWins, battleLosses);
  }, align: 'center' },
  { id: 'defeats', label: '🏳️ Invasions', color: '#ef4444', getValue: (k) => k.invader_kings || 0, align: 'center' },
  { id: 'status', label: 'Transfer Status', getValue: (k) => k.most_recent_status || 'Unannounced', align: 'center' }
];

const DEFAULT_COLUMNS = ['kingdom', 'tier', 'atlas_score', 'rank', 'total_kvks', 'prep_wins', 'prep_wr', 'prep_streak', 'battle_wins', 'battle_wr', 'battle_streak', 'dominations', 'comebacks', 'reversals', 'defeats', 'status'];
const TABLE_COLUMNS_KEY = 'kingshot_table_columns';

interface KingdomTableProps {
  kingdoms: (Kingdom & { rank?: number })[];
  favorites: number[];
  toggleFavorite: (kingdomNumber: number) => void;
  onAddToCompare: (kingdomNumber: number) => void;
}

const neonGlow = (color: string) => ({
  color: color,
  textShadow: `0 0 8px ${color}40, 0 0 12px ${color}20`
});

const getStatusColor = (status: string) => {
  switch (status) {
    case 'Leading': return '#fbbf24';
    case 'Ordinary': return '#9ca3af';
    case 'Unannounced': return '#ef4444';
    default: return '#ef4444';
  }
};

const KingdomTable: React.FC<KingdomTableProps> = ({ 
  kingdoms, 
  favorites, 
  toggleFavorite, 
  onAddToCompare 
}) => {
  const navigate = useNavigate();
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
          Columns ({visibleColumns.length})
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
              <span style={{ color: '#fff', fontSize: '0.85rem', fontWeight: '600' }}>Show Columns</span>
              <button onClick={resetColumns} style={{ background: 'none', border: 'none', color: '#22d3ee', fontSize: '0.75rem', cursor: 'pointer' }}>Reset</button>
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

      <div style={{ backgroundColor: '#111111', borderRadius: '12px', overflow: 'auto', border: '1px solid #2a2a2a' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: `${visibleColumns.length * 80 + 120}px` }}>
          <thead>
            <tr style={{ backgroundColor: '#0a0a0a' }}>
              <th style={{ padding: '0.75rem 0.5rem', textAlign: 'center', color: '#6b7280', fontSize: '0.75rem', fontWeight: '600', width: '40px', position: 'sticky', left: 0, backgroundColor: '#0a0a0a', zIndex: 1 }}>★</th>
              {visibleColumns.map(colId => {
                const col = ALL_COLUMNS.find(c => c.id === colId);
                if (!col) return null;
                return (
                  <th key={col.id} style={{ padding: '0.75rem 0.5rem', textAlign: col.align || 'center', color: col.color || '#6b7280', fontSize: '0.75rem', fontWeight: '600', whiteSpace: 'nowrap' }}>
                    {col.label}
                  </th>
                );
              })}
              <th style={{ padding: '0.75rem 0.5rem', textAlign: 'center', color: '#6b7280', fontSize: '0.75rem', fontWeight: '600' }}>Actions</th>
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
                  <td style={{ padding: '0.6rem 0.5rem', textAlign: 'center', position: 'sticky', left: 0, backgroundColor: 'inherit', zIndex: 1 }}>
                    <button 
                      onClick={(e) => { e.stopPropagation(); toggleFavorite(kingdom.kingdom_number); }} 
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', color: isFav ? '#fbbf24' : '#4a4a4a' }}
                    >
                      {isFav ? '★' : '☆'}
                    </button>
                  </td>
                  {visibleColumns.map(colId => {
                    const col = ALL_COLUMNS.find(c => c.id === colId);
                    if (!col) return null;
                    const value = col.getValue(kingdom, kingdom.rank);
                    const isStatus = colId === 'status';
                    const isTier = colId === 'tier';
                    return (
                      <td key={col.id} style={{ padding: '0.6rem 0.5rem', textAlign: col.align || 'center', whiteSpace: 'nowrap' }}>
                        {isStatus ? (
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
                  <td style={{ padding: '0.6rem 0.5rem', textAlign: 'center' }}>
                    <button 
                      onClick={(e) => { e.stopPropagation(); onAddToCompare(kingdom.kingdom_number); }} 
                      style={{ padding: '0.3rem 0.6rem', backgroundColor: 'transparent', border: '1px solid #3a3a3a', borderRadius: '4px', color: '#9ca3af', fontSize: '0.7rem', cursor: 'pointer' }}
                    >
                      + Compare
                    </button>
                  </td>
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
