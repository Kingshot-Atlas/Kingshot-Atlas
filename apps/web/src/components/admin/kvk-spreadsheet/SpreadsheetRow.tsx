import React from 'react';
import { cellStyle, inputStyle, resultInputStyle, btnSmall } from './styles';

type ResultLetter = 'W' | 'L' | '';
type OverallResult = 'Domination' | 'Comeback' | 'Reversal' | 'Invasion' | 'Bye' | 'Pending' | '';

interface SpreadsheetRowData {
  id: string;
  kingdomNumber: number | '';
  opponentKingdom: number | '';
  prepResult: ResultLetter;
  battleResult: ResultLetter;
  overallResult: OverallResult;
  isBye: boolean;
  autoCreated: boolean;
  dirty: boolean;
  saved: boolean;
  saving: boolean;
  error: string | null;
  dbExists: boolean;
}

interface SpreadsheetRowProps {
  row: SpreadsheetRowData;
  idx: number;
  isFlashing: boolean;
  isRemoteEditing: boolean;
  updateRow: (id: string, field: keyof SpreadsheetRowData, value: unknown, isRemote?: boolean) => void;
  handleResultKeyDown: (e: React.KeyboardEvent<HTMLInputElement>, id: string, field: 'prepResult' | 'battleResult') => void;
  saveRow: (row: SpreadsheetRowData) => Promise<void> | void;
  deleteRow: (id: string) => void;
  rowRef: (el: HTMLTableRowElement | null) => void;
  resultColor: (r: ResultLetter) => string;
  outcomeColor: (o: OverallResult) => string;
}

const SpreadsheetRow: React.FC<SpreadsheetRowProps> = ({
  row,
  idx,
  isFlashing,
  isRemoteEditing,
  updateRow,
  handleResultKeyDown,
  saveRow,
  deleteRow,
  rowRef,
  resultColor,
  outcomeColor,
}) => {
  const incomplete = typeof row.kingdomNumber === 'number' && !row.isBye && (!row.prepResult || !row.battleResult || !row.opponentKingdom);
  const bgColor = isRemoteEditing ? '#3b82f612' : isFlashing ? '#22d3ee15' : incomplete ? '#22d3ee08' : 'transparent';

  return (
    <tr
      ref={rowRef}
      style={{
        backgroundColor: bgColor,
        borderLeft: isRemoteEditing ? '3px solid #3b82f6' : row.dirty ? '3px solid #fbbf2440' : incomplete ? '3px solid #22d3ee25' : '3px solid transparent',
        transition: 'background-color 0.4s ease, border-left 0.3s ease',
      }}
    >
      {/* Row number */}
      <td style={{ ...cellStyle, textAlign: 'center', color: '#4b5563', fontSize: '0.7rem' }}>
        {idx + 1}
      </td>

      {/* Kingdom */}
      <td style={cellStyle}>
        <input
          type="number"
          value={row.kingdomNumber}
          onChange={e => updateRow(row.id, 'kingdomNumber', e.target.value ? parseInt(e.target.value) : '')}
          placeholder="K#"
          style={inputStyle}
          min={1}
          max={9999}
        />
      </td>

      {/* Opponent */}
      <td style={cellStyle}>
        {row.isBye ? (
          <span style={{ color: '#6b7280', fontStyle: 'italic', fontSize: '0.78rem' }}>No match</span>
        ) : (
          <input
            type="number"
            value={row.opponentKingdom}
            onChange={e => updateRow(row.id, 'opponentKingdom', e.target.value ? parseInt(e.target.value) : '')}
            placeholder="Opp#"
            style={inputStyle}
            min={1}
            max={9999}
            disabled={row.isBye}
          />
        )}
      </td>

      {/* Prep Result */}
      <td style={{ ...cellStyle, textAlign: 'center' }}>
        {row.isBye ? (
          <span style={{ color: '#6b7280' }}>—</span>
        ) : (
          <input
            className="kvk-result-input"
            type="text"
            value={row.prepResult}
            readOnly
            onKeyDown={e => handleResultKeyDown(e, row.id, 'prepResult')}
            onFocus={e => e.target.select()}
            placeholder="—"
            maxLength={1}
            style={{ ...resultInputStyle, color: resultColor(row.prepResult) }}
            disabled={row.isBye}
          />
        )}
      </td>

      {/* Battle Result */}
      <td style={{ ...cellStyle, textAlign: 'center' }}>
        {row.isBye ? (
          <span style={{ color: '#6b7280' }}>—</span>
        ) : (
          <input
            className="kvk-result-input"
            type="text"
            value={row.battleResult}
            readOnly
            onKeyDown={e => handleResultKeyDown(e, row.id, 'battleResult')}
            onFocus={e => e.target.select()}
            placeholder="—"
            maxLength={1}
            style={{ ...resultInputStyle, color: resultColor(row.battleResult) }}
            disabled={row.isBye}
          />
        )}
      </td>

      {/* Overall Outcome */}
      <td style={cellStyle}>
        <span style={{
          color: outcomeColor(row.overallResult),
          fontWeight: 600,
          fontSize: '0.8rem',
        }}>
          {row.overallResult || '—'}
        </span>
      </td>

      {/* Bye checkbox */}
      <td style={{ ...cellStyle, textAlign: 'center' }}>
        <input
          type="checkbox"
          checked={row.isBye}
          onChange={e => updateRow(row.id, 'isBye', e.target.checked)}
          style={{ cursor: 'pointer', accentColor: '#6b7280' }}
        />
      </td>

      {/* Status */}
      <td style={{ ...cellStyle, textAlign: 'center' }}>
        {isRemoteEditing ? (
          <span style={{ color: '#3b82f6', fontSize: '0.7rem', fontWeight: 600 }} title="Another user is editing this row">
            <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#3b82f6', marginRight: '4px', verticalAlign: 'middle', animation: 'pulse 1.5s infinite' }} />
            Editing...
          </span>
        ) : row.saving ? (
          <span style={{ color: '#fbbf24', fontSize: '0.7rem' }}>Saving...</span>
        ) : row.error ? (
          <span style={{ color: '#ef4444', fontSize: '0.68rem' }} title={row.error}>Error</span>
        ) : row.saved && !row.dirty ? (
          <span style={{ color: '#22c55e', fontSize: '0.7rem' }}>Saved</span>
        ) : row.dirty ? (
          <span style={{ color: '#fbbf24', fontSize: '0.7rem' }}>Unsaved</span>
        ) : (
          <span style={{ color: '#4b5563', fontSize: '0.7rem' }}>—</span>
        )}
      </td>

      {/* Actions */}
      <td style={{ ...cellStyle, textAlign: 'center' }}>
        <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'center' }}>
          {row.dirty && row.kingdomNumber && (
            <button
              onClick={() => saveRow(row)}
              disabled={row.saving}
              title="Save this row"
              style={{
                ...btnSmall,
                backgroundColor: '#22c55e20',
                color: '#22c55e',
                fontSize: '0.68rem',
              }}
            >
              Save
            </button>
          )}
          {!row.dbExists && (
            <button
              onClick={() => deleteRow(row.id)}
              title="Remove row"
              style={{
                ...btnSmall,
                backgroundColor: '#ef444420',
                color: '#ef4444',
                fontSize: '0.68rem',
              }}
            >
              Del
            </button>
          )}
        </div>
      </td>
    </tr>
  );
};

export default SpreadsheetRow;
