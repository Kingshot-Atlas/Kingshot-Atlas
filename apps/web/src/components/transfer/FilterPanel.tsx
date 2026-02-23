import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { colors } from '../../utils/styles';
import { BoardMode } from '../KingdomListingCard';

export interface FilterState {
  tier: string;
  language: string;
  minScore: string;
  maxScore: string;
  isRecruiting: boolean;
  tag: string;
  minMatchScore: string;
  sortBy: string;
  eventTime: string;
}

export const defaultFilters: FilterState = {
  tier: 'all',
  language: 'all',
  minScore: '',
  maxScore: '',
  isRecruiting: false,
  tag: 'all',
  minMatchScore: '',
  sortBy: 'tier',
  eventTime: 'all',
};

const HOUR_OPTIONS = Array.from({ length: 25 }, (_, i) => ({
  value: String(i),
  label: `${String(i).padStart(2, '0')}:00`,
}));

const LANGUAGE_OPTIONS = [
  'English', 'Mandarin Chinese', 'Hindi', 'Spanish', 'French', 'Arabic', 'Bengali',
  'Portuguese', 'Russian', 'Japanese', 'German', 'Korean', 'Turkish', 'Vietnamese',
  'Italian', 'Thai', 'Polish', 'Indonesian', 'Dutch', 'Tagalog', 'Other',
];

const RECRUITMENT_TAG_OPTIONS = [
  'Active KvK', 'Casual Friendly', 'Competitive',
  'Growing Kingdom', 'Established Kingdom',
  'Active Alliances', 'Social Community', 'War Focused', 'Farm Friendly',
  'KvK Focused', 'Event Active', 'Beginner Friendly',
];

const FilterPanel: React.FC<{
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  mode: BoardMode;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}> = ({ filters, onChange, mode, searchQuery = '', onSearchChange }) => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [isExpanded, setIsExpanded] = useState(false);

  const update = (key: keyof FilterState, value: string | boolean) => {
    onChange({ ...filters, [key]: value });
  };

  const selectStyle: React.CSSProperties = {
    padding: '0.5rem 0.75rem',
    backgroundColor: colors.bg,
    border: `1px solid ${colors.border}`,
    borderRadius: '8px',
    color: colors.text,
    fontSize: isMobile ? '1rem' : '0.8rem',
    minHeight: '44px',
    cursor: 'pointer',
    width: '100%',
  };

  const activeFilterCount = Object.entries(filters).filter(([key, val]) => {
    if (key === 'sortBy') return false;
    if (typeof val === 'boolean') return val;
    return val !== '' && val !== 'all';
  }).length;

  const filterFields = (
    <>
      <div>
        <label style={{ color: colors.textSecondary, fontSize: '0.7rem', marginBottom: '0.25rem', display: 'block' }}>{t('transferHub.filters.fundTier', 'Fund Tier')}</label>
        <select value={filters.tier} onChange={(e) => update('tier', e.target.value)} style={selectStyle}>
          <option value="all">{t('transferHub.filters.allTiers', 'All Tiers')}</option>
          <option value="gold">{t('transferHub.filters.gold', 'Gold')}</option>
          <option value="silver">{t('transferHub.filters.silver', 'Silver')}</option>
          <option value="bronze">{t('transferHub.filters.bronze', 'Bronze')}</option>
          <option value="standard">{t('transferHub.filters.standard', 'Standard')}</option>
        </select>
      </div>
      <div>
        <label style={{ color: colors.textSecondary, fontSize: '0.7rem', marginBottom: '0.25rem', display: 'block' }}>{t('transferHub.filters.language', 'Language')}</label>
        <select value={filters.language} onChange={(e) => update('language', e.target.value)} style={selectStyle}>
          <option value="all">{t('transferHub.filters.allLanguages', 'All Languages')}</option>
          {LANGUAGE_OPTIONS.map((lang) => (
            <option key={lang} value={lang}>{lang}</option>
          ))}
        </select>
      </div>
      <div>
        <label style={{ color: colors.textSecondary, fontSize: '0.7rem', marginBottom: '0.25rem', display: 'block' }}>{t('transferHub.filters.sortBy', 'Sort By')}</label>
        <select value={filters.sortBy} onChange={(e) => update('sortBy', e.target.value)} style={selectStyle}>
          <option value="tier">{t('transferHub.filters.sortTier', 'Fund Tier (High → Low)')}</option>
          <option value="score">{t('transferHub.filters.sortScore', 'Atlas Score (High → Low)')}</option>
          <option value="rank">{t('transferHub.filters.sortRank', 'Rank (Best → Worst)')}</option>
          <option value="match">{t('transferHub.filters.sortMatch', 'Match Score (Best → Worst)')}</option>
        </select>
      </div>
      <div>
        <label style={{ color: colors.textSecondary, fontSize: '0.7rem', marginBottom: '0.25rem', display: 'block' }}>{t('transferHub.filters.eventTime', 'Event Times (UTC)')}</label>
        <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
          <select
            value={filters.eventTime === 'all' ? '' : filters.eventTime.split('-')[0] || ''}
            onChange={(e) => {
              const startH = e.target.value;
              if (!startH) { update('eventTime', 'all'); return; }
              const curEnd = filters.eventTime !== 'all' ? filters.eventTime.split('-')[1] : '';
              const endH = curEnd && Number(curEnd) > Number(startH) ? curEnd : String(Math.min(Number(startH) + 6, 24));
              update('eventTime', `${startH}-${endH}`);
            }}
            style={{ ...selectStyle, flex: 1, padding: '0.5rem 0.4rem' }}
          >
            <option value="">{t('transferHub.filters.anyTime', 'Any')}</option>
            {HOUR_OPTIONS.slice(0, 24).map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <span style={{ color: colors.textMuted, fontSize: '0.75rem', flexShrink: 0 }}>–</span>
          <select
            value={filters.eventTime === 'all' ? '' : filters.eventTime.split('-')[1] || ''}
            onChange={(e) => {
              const endH = e.target.value;
              if (!endH) { update('eventTime', 'all'); return; }
              const curStart = filters.eventTime !== 'all' ? filters.eventTime.split('-')[0] : '';
              const startH = curStart || '0';
              update('eventTime', `${startH}-${endH}`);
            }}
            disabled={filters.eventTime === 'all'}
            style={{ ...selectStyle, flex: 1, padding: '0.5rem 0.4rem', opacity: filters.eventTime === 'all' ? 0.5 : 1 }}
          >
            <option value="">{t('transferHub.filters.anyTime', 'Any')}</option>
            {HOUR_OPTIONS.slice(1).map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label style={{ color: colors.textSecondary, fontSize: '0.7rem', marginBottom: '0.25rem', display: 'block' }}>{t('transferHub.filters.recruitmentTag', 'Recruitment Tag')}</label>
        <select value={filters.tag} onChange={(e) => update('tag', e.target.value)} style={selectStyle}>
          <option value="all">{t('transferHub.filters.allTags', 'All Tags')}</option>
          {RECRUITMENT_TAG_OPTIONS.map((tag) => (
            <option key={tag} value={tag}>{tag}</option>
          ))}
        </select>
      </div>
      <div>
        <label style={{ color: colors.textSecondary, fontSize: '0.7rem', marginBottom: '0.25rem', display: 'block' }}>{t('transferHub.filters.minAtlasScore', 'Min Atlas Score')}</label>
        <input
          type="number"
          step="0.1"
          min="0"
          max="100"
          value={filters.minScore}
          onChange={(e) => update('minScore', e.target.value)}
          placeholder="0.0"
          style={{ ...selectStyle, width: '100%' }}
        />
      </div>
      {mode === 'transferring' && (
        <div>
          <label style={{ color: colors.textSecondary, fontSize: '0.7rem', marginBottom: '0.25rem', display: 'block' }}>{t('transferHub.filters.minMatchScore', 'Min Match Score')}</label>
          <input
            type="number"
            step="5"
            min="0"
            max="100"
            value={filters.minMatchScore}
            onChange={(e) => update('minMatchScore', e.target.value)}
            placeholder="0%"
            style={{ ...selectStyle, width: '100%' }}
          />
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'flex-end' }}>
        <label style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          color: colors.textSecondary, fontSize: '0.8rem', cursor: 'pointer', minHeight: '44px',
        }}>
          <input
            type="checkbox"
            checked={filters.isRecruiting}
            onChange={(e) => update('isRecruiting', e.target.checked)}
            style={{ width: '18px', height: '18px', accentColor: colors.primary }}
          />
          {t('transferHub.filters.activelyRecruiting', 'Actively Recruiting Only')}
        </label>
      </div>
      {!isMobile && activeFilterCount > 0 && (
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <button
            onClick={() => onChange(defaultFilters)}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: 'transparent',
              border: `1px solid ${colors.error}40`,
              borderRadius: '8px',
              color: colors.error,
              fontSize: '0.8rem',
              cursor: 'pointer',
              minHeight: '44px',
            }}
          >
            {t('transferHub.filters.clearFilters', 'Clear Filters')}
          </button>
        </div>
      )}
    </>
  );

  return (
    <div style={{
      backgroundColor: colors.surface,
      border: `1px solid ${colors.border}`,
      borderRadius: '12px',
      padding: '1rem',
    }}>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        {/* Search Input */}
        {onSearchChange && (
          <div style={{ flex: 1, position: 'relative' }}>
            <svg
              width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2"
              style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
            >
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="text"
              inputMode="numeric"
              placeholder={t('transferHub.filters.searchKingdom', 'Search kingdom #...')}
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value.replace(/[^0-9]/g, ''))}
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem 0.5rem 2.25rem',
                backgroundColor: colors.bg,
                border: `1px solid ${colors.border}`,
                borderRadius: '8px',
                color: colors.text,
                fontSize: isMobile ? '1rem' : '0.8rem',
                minHeight: '44px',
                outline: 'none',
              }}
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                style={{
                  position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer',
                  padding: '0.25rem', fontSize: '1rem', lineHeight: 1,
                }}
              >
                ✕
              </button>
            )}
          </div>
        )}
        {/* Filters Toggle */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            background: 'none',
            border: `1px solid ${colors.border}`,
            borderRadius: '8px',
            color: colors.text,
            cursor: 'pointer',
            padding: '0 0.75rem',
            fontSize: '0.85rem',
            fontWeight: '500',
            minHeight: '44px',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
          </svg>
          {t('transferHub.filters.filters', 'Filters')}
          {activeFilterCount > 0 && (
            <span style={{
              backgroundColor: colors.primary,
              color: '#000',
              borderRadius: '10px',
              padding: '0.1rem 0.5rem',
              fontSize: '0.7rem',
              fontWeight: 'bold',
            }}>
              {activeFilterCount}
            </span>
          )}
          <svg
            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
          >
            <path d="M6 9l6 6 6-6"/>
          </svg>
        </button>
      </div>

      {/* Desktop: inline expanded filters */}
      {isExpanded && !isMobile && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '0.75rem',
          marginTop: '1rem',
          paddingTop: '1rem',
          borderTop: `1px solid ${colors.border}`,
        }}>
          {filterFields}
        </div>
      )}

      {/* Mobile: bottom sheet overlay */}
      {isExpanded && isMobile && (
        <div
          onClick={() => setIsExpanded(false)}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1000,
            display: 'flex', alignItems: 'flex-end',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxHeight: '85vh',
              overflowY: 'auto',
              backgroundColor: colors.surface,
              borderTopLeftRadius: '16px',
              borderTopRightRadius: '16px',
              padding: '1.25rem 1rem',
              animation: 'slideUp 0.25s ease-out',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, color: colors.text, fontSize: '1rem', fontWeight: 600 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ verticalAlign: 'middle', marginRight: '0.4rem' }}>
                  <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
                </svg>
                {t('transferHub.filters.filters', 'Filters')}
              </h3>
              <button onClick={() => setIsExpanded(false)} style={{ background: 'none', border: 'none', color: colors.textMuted, fontSize: '1.5rem', cursor: 'pointer', padding: '0.25rem', lineHeight: 1 }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {filterFields}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.25rem', paddingTop: '1rem', borderTop: `1px solid ${colors.border}` }}>
              {activeFilterCount > 0 && (
                <button
                  onClick={() => onChange(defaultFilters)}
                  style={{
                    flex: 1, padding: '0.75rem',
                    backgroundColor: 'transparent',
                    border: `1px solid ${colors.error}40`,
                    borderRadius: '8px',
                    color: colors.error,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    minHeight: '48px',
                  }}
                >
                  {t('transferHub.filters.clearFilters', 'Clear Filters')}
                </button>
              )}
              <button
                onClick={() => setIsExpanded(false)}
                style={{
                  flex: 1, padding: '0.75rem',
                  backgroundColor: `${colors.primary}15`,
                  border: `1px solid ${colors.primary}40`,
                  borderRadius: '8px',
                  color: colors.primary,
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  minHeight: '48px',
                }}
              >
                {t('transferHub.filters.applyFilters', 'Apply Filters')}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
    </div>
  );
};

export default FilterPanel;
