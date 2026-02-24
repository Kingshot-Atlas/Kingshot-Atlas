import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDelegateManagement } from '../hooks/useToolAccess';
import { useToast } from './Toast';

const ToolDelegates: React.FC = () => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { delegates, delegatesLoading, canAddDelegate, maxDelegates, addDelegate, removeDelegate } = useDelegateManagement();
  const [username, setUsername] = useState('');
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const handleAdd = async () => {
    const trimmed = username.trim();
    if (!trimmed) return;
    setAdding(true);
    const result = await addDelegate(trimmed);
    setAdding(false);
    if (result.success) {
      setUsername('');
      showToast(t('toolDelegates.added', 'Delegate added successfully'), 'success');
    } else {
      showToast(result.error || t('toolDelegates.addFailed', 'Failed to add delegate'), 'error');
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
        {t('toolDelegates.desc', 'Grant up to 2 alliance members access to your alliance management tools (Base Designer, Battle Planner, etc.).')}
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

      {/* Add delegate */}
      {canAddDelegate && (
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
            placeholder={t('toolDelegates.usernamePlaceholder', 'Enter username...')}
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
      )}
    </div>
  );
};

export default ToolDelegates;
