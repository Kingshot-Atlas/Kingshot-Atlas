import React from 'react';
import { colors } from '../../../utils/styles';
import { inputStyle, btnSmall } from './styles';

interface SpreadsheetToolbarProps {
  kvkNumber: number;
  setKvkNumber: (n: number) => void;
  defaultKvk: number;
  loading: boolean;
  saving: boolean;
  uniqueDirtyCount: number;
  dirtyCount: number;
  search: string;
  setSearch: (s: string) => void;
  jumpTo: string;
  setJumpTo: (s: string) => void;
  scrollToKingdom: () => void;
  hideComplete: boolean;
  setHideComplete: (v: boolean) => void;
  maxKingdom: string;
  setMaxKingdom: (s: string) => void;
  populateLoading: boolean;
  realtimeConnected: boolean;
  stats: { total: number; withResults: number; pending: number; byes: number };
  completionPct: number;
  filteredRowsCount: number;
  totalRowsCount: number;
  completeRowsCount: number;
  loadData: () => void;
  saveAllDirty: () => void;
  autoPopulate: () => void;
}

const SpreadsheetToolbar: React.FC<SpreadsheetToolbarProps> = ({
  kvkNumber,
  setKvkNumber,
  defaultKvk,
  loading,
  saving,
  uniqueDirtyCount,
  dirtyCount,
  search,
  setSearch,
  jumpTo,
  setJumpTo,
  scrollToKingdom,
  hideComplete,
  setHideComplete,
  maxKingdom,
  setMaxKingdom,
  populateLoading,
  realtimeConnected,
  stats,
  completionPct,
  filteredRowsCount,
  totalRowsCount,
  completeRowsCount,
  loadData,
  saveAllDirty,
  autoPopulate,
}) => {
  return (
    <div style={{
      backgroundColor: colors.cardAlt,
      borderRadius: '12px',
      padding: '1.25rem',
      border: '1px solid #2a2a2a',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h3 style={{ color: '#f97316', fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>
            KvK Results Spreadsheet
          </h3>
          <p style={{ color: '#6b7280', fontSize: '0.75rem', margin: '0.25rem 0 0' }}>
            Enter results on either side — counterpart syncs instantly.{' '}
            {dirtyCount > 0 && <span style={{ color: '#fbbf24' }}>({uniqueDirtyCount} unsaved matchup{uniqueDirtyCount !== 1 ? 's' : ''})</span>}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <label style={{ color: '#9ca3af', fontSize: '0.7rem' }}>KvK #</label>
            <input
              type="number"
              value={kvkNumber}
              onChange={e => setKvkNumber(parseInt(e.target.value) || defaultKvk)}
              style={{ ...inputStyle, width: '55px', textAlign: 'center' }}
            />
          </div>

          <button
            onClick={loadData}
            disabled={loading}
            style={{ ...btnSmall, backgroundColor: '#1a1a1a', color: '#9ca3af', border: '1px solid #2a2a2a' }}
          >
            {loading ? 'Loading...' : 'Reload'}
          </button>

          <button
            onClick={saveAllDirty}
            disabled={saving || uniqueDirtyCount === 0}
            style={{
              ...btnSmall,
              backgroundColor: uniqueDirtyCount > 0 ? '#22c55e' : '#1a1a1a',
              color: uniqueDirtyCount > 0 ? '#fff' : '#6b7280',
              opacity: saving ? 0.6 : 1,
              cursor: uniqueDirtyCount > 0 && !saving ? 'pointer' : 'not-allowed',
            }}
          >
            {saving ? 'Saving...' : `Save All (${uniqueDirtyCount})`}
          </button>
        </div>
      </div>

      {/* Row 2: Jump-to + Search filter + Hide complete toggle */}
      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Jump to kingdom */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <input
            type="number"
            value={jumpTo}
            onChange={e => setJumpTo(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); scrollToKingdom(); } }}
            placeholder="K#"
            style={{ ...inputStyle, width: '70px', textAlign: 'center' }}
            min={1}
            max={9999}
          />
          <button
            onClick={() => scrollToKingdom()}
            disabled={!jumpTo.trim()}
            style={{ ...btnSmall, backgroundColor: '#22d3ee20', color: '#22d3ee', border: '1px solid #22d3ee40', fontSize: '0.68rem', whiteSpace: 'nowrap' }}
            title="Scroll to this kingdom without filtering"
          >
            Jump to
          </button>
        </div>

        {/* Divider */}
        <div style={{ width: '1px', height: '24px', backgroundColor: '#2a2a2a' }} />

        {/* Filter search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flex: '1 1 140px', minWidth: '140px' }}>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Filter rows..."
            style={{ ...inputStyle, flex: 1 }}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              style={{ ...btnSmall, backgroundColor: 'transparent', color: '#6b7280', padding: '0.2rem 0.4rem', fontSize: '0.75rem' }}
            >
              ✕
            </button>
          )}
        </div>

        {/* Divider */}
        <div style={{ width: '1px', height: '24px', backgroundColor: '#2a2a2a' }} />

        {/* Hide complete toggle */}
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
          <input
            type="checkbox"
            checked={hideComplete}
            onChange={e => setHideComplete(e.target.checked)}
            style={{ accentColor: '#22d3ee', cursor: 'pointer' }}
          />
          <span style={{ fontSize: '0.72rem', color: hideComplete ? '#22d3ee' : '#9ca3af' }}>
            Hide complete ({completeRowsCount})
          </span>
        </label>

        {/* Divider */}
        <div style={{ width: '1px', height: '24px', backgroundColor: '#2a2a2a' }} />

        {/* Auto-populate */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <label style={{ color: '#9ca3af', fontSize: '0.7rem', whiteSpace: 'nowrap' }}>Fill up to K</label>
          <input
            type="number"
            value={maxKingdom}
            onChange={e => setMaxKingdom(e.target.value)}
            style={{ ...inputStyle, width: '70px', textAlign: 'center' }}
            min={1}
            max={9999}
          />
          <button
            onClick={autoPopulate}
            disabled={populateLoading}
            style={{ ...btnSmall, backgroundColor: '#a855f720', color: '#a855f7', border: '1px solid #a855f740', fontSize: '0.68rem', whiteSpace: 'nowrap' }}
          >
            {populateLoading ? 'Adding...' : 'Populate'}
          </button>
        </div>
      </div>

      {/* Stats bar + progress + realtime indicator */}
      <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Realtime indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }} title={realtimeConnected ? 'Live collaborative editing — edits from other users appear instantly' : 'Not connected to realtime'}>
          <span style={{
            width: '7px',
            height: '7px',
            borderRadius: '50%',
            backgroundColor: realtimeConnected ? '#22c55e' : '#ef4444',
            display: 'inline-block',
            boxShadow: realtimeConnected ? '0 0 4px #22c55e80' : 'none',
            animation: realtimeConnected ? 'none' : undefined,
          }} />
          <span style={{ fontSize: '0.68rem', color: realtimeConnected ? '#22c55e' : '#ef4444', fontWeight: 600 }}>
            {realtimeConnected ? 'LIVE' : 'OFFLINE'}
          </span>
        </div>

        {/* Divider */}
        <div style={{ width: '1px', height: '16px', backgroundColor: '#2a2a2a' }} />

        {[
          { label: 'Total', value: stats.total, color: '#22d3ee' },
          { label: 'Complete', value: stats.withResults, color: '#22c55e' },
          { label: 'Pending', value: stats.pending, color: '#fbbf24' },
          { label: 'Byes', value: stats.byes, color: '#6b7280' },
        ].map(s => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: s.color, display: 'inline-block' }} />
            <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{s.label}:</span>
            <span style={{ fontSize: '0.85rem', color: '#fff', fontWeight: 600 }}>{s.value}</span>
          </div>
        ))}

        {/* Progress bar */}
        {stats.total > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginLeft: 'auto' }}>
            <div style={{
              width: '100px',
              height: '6px',
              backgroundColor: '#1a1a1a',
              borderRadius: '3px',
              overflow: 'hidden',
            }}>
              <div style={{
                width: `${completionPct}%`,
                height: '100%',
                backgroundColor: completionPct === 100 ? '#22c55e' : completionPct > 50 ? '#fbbf24' : '#ef4444',
                borderRadius: '3px',
                transition: 'width 0.3s ease',
              }} />
            </div>
            <span style={{ fontSize: '0.72rem', color: completionPct === 100 ? '#22c55e' : '#9ca3af', fontWeight: 600 }}>
              {completionPct}%
            </span>
          </div>
        )}
      </div>

      {/* Filter results count */}
      {(search.trim() || hideComplete) && (
        <div style={{ marginTop: '0.4rem', fontSize: '0.7rem', color: '#6b7280' }}>
          Showing {filteredRowsCount} of {totalRowsCount} rows
          {search.trim() && <> matching &ldquo;{search}&rdquo;</>}
          {hideComplete && <> (hiding {completeRowsCount} complete)</>}
        </div>
      )}
    </div>
  );
};

export default SpreadsheetToolbar;
