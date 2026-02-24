import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useDelegateManagement, UserSearchResult } from '../hooks/useToolAccess';
import { useToast } from './Toast';

const ToolDelegates: React.FC = () => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { delegates, delegatesLoading, canAddDelegate, maxDelegates, addDelegate, removeDelegate, searchUsers } = useDelegateManagement();
  const [username, setUsername] = useState('');
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searching, setSearching] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Translate known error codes from the hook
  const translateError = (error: string) => {
    if (error === 'notInKingdom') return t('toolDelegates.notInKingdom', 'Delegate must be in the same kingdom as you');
    if (error === 'noKingdom') return t('toolDelegates.noKingdom', 'Set your home kingdom in your profile first');
    return error;
  };

  const handleSearch = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }
    setSearching(true);
    const results = await searchUsers(query);
    // Filter out users already added as delegates
    const delegateIds = new Set(delegates.map(d => d.delegate_id));
    setSearchResults(results.filter(r => !delegateIds.has(r.id)));
    setShowDropdown(true);
    setSearching(false);
    setHighlightIdx(-1);
  }, [searchUsers, delegates]);

  const handleInputChange = (value: string) => {
    setUsername(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => handleSearch(value), 300);
  };

  const selectUser = (user: UserSearchResult) => {
    setUsername(user.username);
    setShowDropdown(false);
    setSearchResults([]);
  };

  const handleAdd = async () => {
    const trimmed = username.trim();
    if (!trimmed) return;
    setAdding(true);
    setShowDropdown(false);
    const result = await addDelegate(trimmed);
    setAdding(false);
    if (result.success) {
      setUsername('');
      setSearchResults([]);
      showToast(t('toolDelegates.added', 'Delegate added successfully'), 'success');
    } else {
      showToast(translateError(result.error || t('toolDelegates.addFailed', 'Failed to add delegate')), 'error');
    }
  };

  const handleRemove = async (id: string) => {
    setRemovingId(id);
    const result = await removeDelegate(id);
    setRemovingId(null);
    if (result.success) {
      showToast(t('toolDelegates.removed', 'Delegate removed'), 'success');
    } else {
      showToast(result.error || t('toolDelegates.removeFailed', 'Failed to remove delegate'), 'error');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || searchResults.length === 0) {
      if (e.key === 'Enter') handleAdd();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIdx(prev => Math.min(prev + 1, searchResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIdx(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightIdx >= 0 && highlightIdx < searchResults.length && searchResults[highlightIdx]) {
        selectUser(searchResults[highlightIdx]!);
      } else {
        handleAdd();
      }
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div style={{
      backgroundColor: '#111116',
      borderRadius: '12px',
      padding: '1.25rem',
      border: '1px solid #2a2a2a',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <span style={{ fontSize: '1.1rem' }}>🤝</span>
        <h3 style={{ color: '#fff', fontSize: '1rem', fontWeight: '600', margin: 0 }}>
          {t('toolDelegates.title', 'Tool Delegates')}
        </h3>
        <span style={{ color: '#6b7280', fontSize: '0.8rem', marginLeft: 'auto' }}>
          {delegates.length}/{maxDelegates}
        </span>
      </div>

      <p style={{ color: '#9ca3af', fontSize: '0.8rem', marginBottom: '1rem', lineHeight: 1.4 }}>
        {t('toolDelegates.desc', 'Grant up to 2 alliance members in your kingdom access to the Alliance Base Designer.')}
      </p>

      {/* Current delegates */}
      {delegatesLoading ? (
        <div style={{ color: '#6b7280', fontSize: '0.85rem', padding: '0.5rem 0' }}>
          {t('common.loading', 'Loading...')}
        </div>
      ) : delegates.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
          {delegates.map(d => (
            <div key={d.id} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.6rem 0.75rem',
              backgroundColor: '#1a1a20',
              borderRadius: '8px',
              border: '1px solid #2a2a2a',
            }}>
              <div style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                backgroundColor: '#22d3ee20',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#22d3ee',
                fontWeight: 'bold',
                fontSize: '0.75rem',
                flexShrink: 0,
              }}>
                {d.delegate_username?.[0]?.toUpperCase() || '?'}
              </div>
              <span style={{ color: '#fff', fontSize: '0.85rem', flex: 1 }}>
                {d.delegate_username || t('toolDelegates.unknownUser', 'Unknown User')}
              </span>
              <button
                onClick={() => handleRemove(d.id)}
                disabled={removingId === d.id}
                style={{
                  padding: '0.25rem 0.5rem',
                  backgroundColor: 'transparent',
                  border: '1px solid #ef444440',
                  borderRadius: '6px',
                  color: '#ef4444',
                  fontSize: '0.75rem',
                  cursor: removingId === d.id ? 'wait' : 'pointer',
                  opacity: removingId === d.id ? 0.5 : 1,
                  flexShrink: 0,
                }}
              >
                {removingId === d.id ? '...' : t('toolDelegates.remove', 'Remove')}
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p style={{ color: '#4b5563', fontSize: '0.8rem', marginBottom: '1rem', fontStyle: 'italic' }}>
          {t('toolDelegates.noDelegates', 'No delegates yet. Add alliance members so they can help manage your tools.')}
        </p>
      )}

      {/* Add delegate with search */}
      {canAddDelegate && (
        <div ref={dropdownRef} style={{ position: 'relative' }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              ref={inputRef}
              type="text"
              value={username}
              onChange={e => handleInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => { if (searchResults.length > 0) setShowDropdown(true); }}
              placeholder={t('toolDelegates.usernamePlaceholder', 'Search by username...')}
              style={{
                flex: 1,
                padding: '0.5rem 0.75rem',
                backgroundColor: '#0a0a0a',
                border: '1px solid #2a2a2a',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '0.85rem',
                outline: 'none',
              }}
            />
            <button
              onClick={handleAdd}
              disabled={adding || !username.trim()}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: adding || !username.trim() ? '#22d3ee30' : '#22d3ee',
                border: 'none',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '0.85rem',
                fontWeight: '500',
                cursor: adding || !username.trim() ? 'default' : 'pointer',
                opacity: adding || !username.trim() ? 0.5 : 1,
                flexShrink: 0,
              }}
            >
              {adding ? '...' : t('toolDelegates.add', 'Add')}
            </button>
          </div>

          {/* Search results dropdown */}
          {showDropdown && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              marginTop: '4px',
              backgroundColor: '#1a1a20',
              border: '1px solid #2a2a2a',
              borderRadius: '8px',
              maxHeight: '200px',
              overflowY: 'auto',
              zIndex: 10,
              boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            }}>
              {searching ? (
                <div style={{ padding: '0.6rem 0.75rem', color: '#6b7280', fontSize: '0.8rem' }}>...</div>
              ) : searchResults.length > 0 ? (
                searchResults.map((user, idx) => (
                  <button
                    key={user.id}
                    onClick={() => selectUser(user)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.6rem',
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      backgroundColor: idx === highlightIdx ? '#22d3ee15' : 'transparent',
                      border: 'none',
                      borderBottom: idx < searchResults.length - 1 ? '1px solid #2a2a2a' : 'none',
                      color: '#fff',
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                    onMouseEnter={() => setHighlightIdx(idx)}
                  >
                    <div style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      backgroundColor: '#22d3ee20',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#22d3ee',
                      fontWeight: 'bold',
                      fontSize: '0.65rem',
                      flexShrink: 0,
                    }}>
                      {user.username[0]?.toUpperCase()}
                    </div>
                    {user.username}
                  </button>
                ))
              ) : username.length >= 2 ? (
                <div style={{ padding: '0.6rem 0.75rem', color: '#6b7280', fontSize: '0.8rem' }}>
                  {t('toolDelegates.noResults', 'No matching users found')}
                </div>
              ) : null}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ToolDelegates;
