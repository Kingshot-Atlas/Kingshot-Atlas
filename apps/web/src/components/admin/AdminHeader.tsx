import React from 'react';
import type { ApiHealth } from './types';

interface AdminHeaderProps {
  totalPending: number;
  unreadEmailCount: number;
  viewAsUser: boolean;
  onToggleViewAsUser: () => void;
  onNavigateToEmail: () => void;
  apiHealth: ApiHealth;
  username: string;
  dashboardSearch: string;
  onSearchChange: (value: string) => void;
}

export const AdminHeader: React.FC<AdminHeaderProps> = ({
  totalPending,
  unreadEmailCount,
  viewAsUser,
  onToggleViewAsUser,
  onNavigateToEmail,
  apiHealth,
  username,
  dashboardSearch,
  onSearchChange,
}) => (
  <>
    {/* Compact Header */}
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#ffffff', margin: 0 }}>Admin</h1>
        {totalPending > 0 && (
          <div style={{ 
            padding: '0.2rem 0.6rem', 
            backgroundColor: '#fbbf2420', 
            borderRadius: '12px',
            border: '1px solid #fbbf2450',
            color: '#fbbf24',
            fontSize: '0.75rem',
            fontWeight: 600
          }}>
            {totalPending} pending
          </div>
        )}
        {unreadEmailCount > 0 && (
          <div
            onClick={onNavigateToEmail}
            style={{ 
              padding: '0.2rem 0.6rem', 
              backgroundColor: '#ef444420', 
              borderRadius: '12px',
              border: '1px solid #ef444450',
              color: '#ef4444',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem',
            }}>
            📧 {unreadEmailCount} unread
          </div>
        )}
        {viewAsUser && <span style={{ fontSize: '0.75rem', color: '#fbbf24', fontStyle: 'italic' }}>(User View)</span>}
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <button
          onClick={onToggleViewAsUser}
          style={{
            padding: '0.3rem 0.6rem',
            backgroundColor: viewAsUser ? '#fbbf2420' : 'transparent',
            borderRadius: '6px',
            border: viewAsUser ? '1px solid #fbbf2450' : '1px solid #3a3a3a',
            color: viewAsUser ? '#fbbf24' : '#6b7280',
            fontSize: '0.75rem',
            cursor: 'pointer'
          }}
        >
          👁️ {viewAsUser ? 'Exit' : 'User View'}
        </button>
        {/* Health Status Indicators */}
        <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
          {[
            { label: 'API', status: apiHealth.api },
            { label: 'DB', status: apiHealth.supabase },
            { label: '$', status: apiHealth.stripe },
          ].map(s => (
            <div key={s.label} title={`${s.label}: ${s.status}`} style={{
              width: '8px', height: '8px', borderRadius: '50%',
              backgroundColor: s.status === 'ok' ? '#22c55e' : s.status === 'error' ? '#ef4444' : '#fbbf24',
              boxShadow: s.status === 'ok' ? '0 0 4px #22c55e60' : s.status === 'error' ? '0 0 4px #ef444460' : 'none',
            }} />
          ))}
        </div>
        <div style={{ 
          padding: '0.3rem 0.6rem', 
          backgroundColor: '#22c55e15', 
          borderRadius: '6px',
          color: '#22c55e',
          fontSize: '0.75rem',
          fontWeight: 500
        }}>
          ✓ {username}
        </div>
      </div>
    </div>

    {/* S2.4: Dashboard-wide search bar */}
    <div style={{ marginBottom: '0.5rem' }}>
      <input
        type="text"
        value={dashboardSearch}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Search across submissions, corrections, feedback, emails..."
        style={{
          width: '100%', padding: '0.5rem 0.75rem', backgroundColor: '#111116',
          border: '1px solid #2a2a2a', borderRadius: '8px', color: '#fff', fontSize: '0.85rem',
          outline: 'none', boxSizing: 'border-box',
        }}
      />
    </div>
  </>
);
