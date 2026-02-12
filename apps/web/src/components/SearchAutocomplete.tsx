import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Kingdom } from '../types';
import { useIsMobile } from '../hooks/useMediaQuery';
import { useTranslation } from 'react-i18next';
import { useAnalytics } from '../hooks/useAnalytics';

interface SearchAutocompleteProps {
  kingdoms: Kingdom[];
  value: string;
  onChange: (value: string) => void;
  onSelect?: (kingdom: Kingdom) => void;
  placeholder?: string;
}

const SearchAutocomplete: React.FC<SearchAutocompleteProps> = ({
  kingdoms,
  value,
  onChange,
  onSelect,
  placeholder
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { t } = useTranslation();
  const { trackSearch, trackFeature } = useAnalytics();

  const suggestions = useMemo(() => value.trim()
    ? kingdoms
        .filter(k => k.kingdom_number.toString().includes(value.trim()))
        .sort((a, b) => a.kingdom_number - b.kingdom_number)
        .slice(0, 8)
    : [], [value, kingdoms]);

  const showDropdown = isFocused && suggestions.length > 0 && value.trim().length > 0;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    setHighlightedIndex(-1);
  }, [value]);

  const handleSelect = useCallback((kingdom: Kingdom) => {
    trackSearch(`K${kingdom.kingdom_number}`);
    trackFeature('Kingdom Search', { kingdom: kingdom.kingdom_number });
    if (onSelect) {
      onSelect(kingdom);
    } else {
      navigate(`/kingdom/${kingdom.kingdom_number}`);
    }
    setIsFocused(false);
    onChange('');
  }, [onSelect, navigate, onChange, trackSearch, trackFeature]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!showDropdown) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter': {
        e.preventDefault();
        const selected = suggestions[highlightedIndex];
        if (highlightedIndex >= 0 && selected) {
          handleSelect(selected);
        }
        break;
      }
      case 'Escape':
        setIsFocused(false);
        inputRef.current?.blur();
        break;
    }
  }, [showDropdown, highlightedIndex, suggestions, handleSelect]);

  const handleBlur = (e: React.FocusEvent) => {
    if (dropdownRef.current?.contains(e.relatedTarget as Node)) {
      return;
    }
    setTimeout(() => setIsFocused(false), 150);
  };

  return (
    <div style={{ flex: 1, minWidth: isMobile ? '100%' : '250px', position: 'relative' }}>
      <svg 
        style={{ 
          position: 'absolute', 
          insetInlineStart: '1rem', 
          top: '50%', 
          transform: 'translateY(-50%)', 
          width: '18px', 
          height: '18px', 
          color: '#6b7280',
          zIndex: 1
        }} 
        fill="none" 
        stroke="currentColor" 
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={isMobile ? t('search.mobilePlaceholder', 'Search by kingdom #...') : (placeholder || t('search.placeholder', 'Search by kingdom number (e.g., 1001)...'))}
        style={{
          width: '100%',
          padding: '0.875rem 3rem 0.875rem 3rem',
          backgroundColor: '#0a0a0a',
          border: `1px solid ${isFocused ? '#22d3ee' : '#2a2a2a'}`,
          borderRadius: showDropdown ? '8px 8px 0 0' : '8px',
          color: '#fff',
          fontSize: '1rem',
          outline: 'none',
          transition: 'border-color 0.2s ease'
        }}
      />
      
      {!isMobile && (
        <span style={{ 
          position: 'absolute', 
          insetInlineEnd: '1rem', 
          top: '50%', 
          transform: 'translateY(-50%)', 
          color: '#4a4a4a', 
          fontSize: '0.7rem',
          backgroundColor: '#1a1a1a',
          padding: '0.2rem 0.4rem',
          borderRadius: '4px',
          border: '1px solid #2a2a2a',
          pointerEvents: 'none',
          zIndex: 1
        }}>/</span>
      )}

      {showDropdown && (
        <div 
          ref={dropdownRef}
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            backgroundColor: '#0a0a0a',
            border: '1px solid #22d3ee',
            borderTop: 'none',
            borderRadius: '0 0 8px 8px',
            maxHeight: '300px',
            overflowY: 'auto',
            zIndex: 100,
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)'
          }}
        >
          {suggestions.map((kingdom, index) => (
            <button
              key={kingdom.kingdom_number}
              onClick={() => handleSelect(kingdom)}
              onMouseEnter={() => setHighlightedIndex(index)}
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: highlightedIndex === index ? '#1a1a1a' : 'transparent',
                border: 'none',
                borderBottom: index < suggestions.length - 1 ? '1px solid #1a1a1a' : 'none',
                color: '#fff',
                cursor: 'pointer',
                textAlign: 'start',
                transition: 'background-color 0.1s'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ 
                  color: '#fff',
                  fontWeight: '700',
                  fontSize: '0.95rem',
                  fontFamily: "'Cinzel', serif"
                }}>
                  {t('common.kingdom', 'Kingdom')} {kingdom.kingdom_number}
                </span>
                <span style={{
                  backgroundColor: kingdom.power_tier === 'S' ? '#fbbf2420' : 
                                   kingdom.power_tier === 'A' ? '#22c55e20' :
                                   kingdom.power_tier === 'B' ? '#3b82f620' : '#6b728020',
                  color: kingdom.power_tier === 'S' ? '#fbbf24' : 
                         kingdom.power_tier === 'A' ? '#22c55e' :
                         kingdom.power_tier === 'B' ? '#3b82f6' : '#6b7280',
                  padding: '0.15rem 0.4rem',
                  borderRadius: '4px',
                  fontSize: '0.7rem',
                  fontWeight: '600'
                }}>
                  {kingdom.power_tier}-Tier
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: '#6b7280', marginInlineStart: 'auto' }}>
                <span style={{ textAlign: 'left' }}>Atlas Score: <span style={{ color: '#22d3ee', fontWeight: 'bold' }}>{kingdom.overall_score.toFixed(2)}</span></span>
                <span style={{ color: '#4a4a4a' }}>|</span>
                <span>{kingdom.total_kvks} KvKs</span>
              </div>
            </button>
          ))}
          
          {value.trim() && suggestions.length === 0 && (
            <div style={{ padding: '1rem', textAlign: 'center', color: '#6b7280', fontSize: '0.85rem' }}>
              {t('search.noResults', 'No kingdoms match "{{query}}"', { query: value })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchAutocomplete;
