import React from 'react';
import { useTranslation } from 'react-i18next';
import { type BrowseFilters } from './browseTransfereesQueries';
import { formatTCLevel, LANGUAGE_OPTIONS, inputStyle } from './types';

interface BrowseTransfereesFiltersProps {
  filters: BrowseFilters;
  onChange: React.Dispatch<React.SetStateAction<BrowseFilters>>;
}

const BrowseTransfereesFilters: React.FC<BrowseTransfereesFiltersProps> = ({ filters, onChange }) => {
  const { t } = useTranslation();

  return (
    <div style={{
      display: 'flex', gap: '0.4rem', marginBottom: '0.75rem',
      flexWrap: 'wrap', alignItems: 'flex-end',
    }}>
      <div style={{ flex: '1 1 100px', minWidth: '80px' }}>
        <span style={{ color: '#6b7280', fontSize: '0.6rem', display: 'block', marginBottom: '0.15rem' }}>{t('recruiter.minTC', 'Min TC')}</span>
        <select
          value={filters.minTc}
          onChange={(e) => onChange(f => ({ ...f, minTc: e.target.value }))}
          style={{ ...inputStyle, fontSize: '0.7rem', padding: '0.35rem 0.5rem', minHeight: '36px' }}
        >
          <option value="">Any</option>
          {[15, 20, 25, 30, 35, 40, 45, 50, 55, 60].map(lvl => (
            <option key={lvl} value={lvl}>{formatTCLevel(lvl)}</option>
          ))}
        </select>
      </div>
      <div style={{ flex: '1 1 100px', minWidth: '80px' }}>
        <span style={{ color: '#6b7280', fontSize: '0.6rem', display: 'block', marginBottom: '0.15rem' }}>{t('recruiter.minPower', 'Min Power')}</span>
        <input
          type="number"
          placeholder="e.g. 100"
          value={filters.minPower}
          onChange={(e) => onChange(f => ({ ...f, minPower: e.target.value }))}
          style={{ ...inputStyle, fontSize: '0.7rem', padding: '0.35rem 0.5rem', minHeight: '36px' }}
        />
      </div>
      <div style={{ flex: '1 1 120px', minWidth: '90px' }}>
        <span style={{ color: '#6b7280', fontSize: '0.6rem', display: 'block', marginBottom: '0.15rem' }}>{t('recruiter.language', 'Language')}</span>
        <select
          value={filters.language}
          onChange={(e) => onChange(f => ({ ...f, language: e.target.value }))}
          style={{ ...inputStyle, fontSize: '0.7rem', padding: '0.35rem 0.5rem', minHeight: '36px' }}
        >
          <option value="">Any</option>
          {LANGUAGE_OPTIONS.map(lang => (
            <option key={lang} value={lang}>{lang}</option>
          ))}
        </select>
      </div>
      <div style={{ flex: '1 1 100px', minWidth: '80px' }}>
        <span style={{ color: '#6b7280', fontSize: '0.6rem', display: 'block', marginBottom: '0.15rem' }}>{t('recruiter.sortBy', 'Sort By')}</span>
        <select
          value={filters.sortBy}
          onChange={(e) => onChange(f => ({ ...f, sortBy: e.target.value }))}
          style={{ ...inputStyle, fontSize: '0.7rem', padding: '0.35rem 0.5rem', minHeight: '36px' }}
        >
          <option value="newest">{t('recruiter.newestFirst', 'Newest First')}</option>
          <option value="power_desc">{t('recruiter.powerHighLow', 'Power (High → Low)')}</option>
          <option value="tc_desc">{t('recruiter.tcHighLow', 'TC Level (High → Low)')}</option>
        </select>
      </div>
      {(filters.minTc || filters.minPower || filters.language) && (
        <button
          onClick={() => onChange({ minTc: '', minPower: '', language: '', sortBy: filters.sortBy })}
          style={{
            padding: '0.35rem 0.5rem', backgroundColor: '#ef444410', border: '1px solid #ef444425',
            borderRadius: '6px', color: '#ef4444', fontSize: '0.6rem', cursor: 'pointer', minHeight: '36px',
            whiteSpace: 'nowrap',
          }}
        >
          {t('recruiter.clear', 'Clear Filters')}
        </button>
      )}
    </div>
  );
};

export default BrowseTransfereesFilters;
