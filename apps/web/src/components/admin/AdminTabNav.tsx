import React from 'react';
import type { AdminTab, AdminCategory, PendingCounts } from './types';

interface AdminTabNavProps {
  activeTab: AdminTab;
  activeCategory: AdminCategory;
  pendingCounts: PendingCounts;
  unreadEmailCount: number;
  onTabChange: (tab: AdminTab) => void;
}

const SubTabButton: React.FC<{
  id: string;
  label: string;
  count?: number;
  isActive: boolean;
  accentColor?: string;
  onClick: () => void;
}> = ({ label, count, isActive, accentColor = '#22d3ee', onClick }) => (
  <button
    onClick={onClick}
    style={{
      padding: '0.35rem 0.7rem',
      backgroundColor: isActive ? `${accentColor}20` : 'transparent',
      color: isActive ? accentColor : '#6b7280',
      border: isActive ? `1px solid ${accentColor}40` : '1px solid transparent',
      borderRadius: '6px',
      fontWeight: 500,
      cursor: 'pointer',
      fontSize: '0.8rem',
      display: 'flex',
      alignItems: 'center',
      gap: '0.3rem'
    }}
  >
    {label}
    {(count ?? 0) > 0 && (
      <span style={{
        backgroundColor: isActive ? accentColor : '#fbbf24',
        color: '#0a0a0a',
        fontSize: '0.6rem',
        fontWeight: 700,
        padding: '0.1rem 0.3rem',
        borderRadius: '9999px'
      }}>
        {count}
      </span>
    )}
  </button>
);

export const AdminTabNav: React.FC<AdminTabNavProps> = ({
  activeTab,
  activeCategory,
  pendingCounts,
  unreadEmailCount,
  onTabChange,
}) => (
  <>
    {/* Primary Category Tabs */}
    <div style={{ 
      display: 'flex', 
      gap: '0.25rem', 
      marginBottom: '0.75rem',
      backgroundColor: '#111116',
      padding: '0.25rem',
      borderRadius: '8px',
      width: 'fit-content'
    }}>
      {[
        { id: 'analytics', label: 'Analytics', icon: '📊' },
        { id: 'review', label: 'Review', icon: '📋', count: pendingCounts.submissions + pendingCounts.claims + pendingCounts.corrections + pendingCounts.kvkErrors },
        { id: 'transfer', label: 'Transfer Hub', icon: '🔄', count: pendingCounts.transfers },
        { id: 'system', label: 'System', icon: '⚙️', count: pendingCounts.feedback }
      ].map(cat => (
        <button
          key={cat.id}
          onClick={() => {
            if (cat.id === 'analytics') onTabChange('analytics');
            else if (cat.id === 'review') onTabChange('submissions');
            else if (cat.id === 'transfer') onTabChange('transfer-hub');
            else onTabChange('email');
          }}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: activeCategory === cat.id ? '#22d3ee' : 'transparent',
            color: activeCategory === cat.id ? '#0a0a0a' : '#9ca3af',
            border: 'none',
            borderRadius: '6px',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem'
          }}
        >
          {cat.label}
          {(cat.count ?? 0) > 0 && (
            <span style={{
              backgroundColor: activeCategory === cat.id ? '#0a0a0a' : '#fbbf24',
              color: activeCategory === cat.id ? '#22d3ee' : '#0a0a0a',
              fontSize: '0.65rem',
              fontWeight: 700,
              padding: '0.15rem 0.4rem',
              borderRadius: '9999px'
            }}>
              {cat.count}
            </span>
          )}
        </button>
      ))}
    </div>

    {/* Secondary Sub-tabs based on category */}
    <div style={{ 
      display: 'flex', 
      gap: '0.35rem', 
      marginBottom: '1rem',
      flexWrap: 'wrap',
      paddingBottom: '0.75rem',
      borderBottom: '1px solid #1a1a1a'
    }}>
      {activeCategory === 'analytics' && [
        { id: 'analytics', label: 'Overview' },
        { id: 'saas-metrics', label: 'Revenue' },
        { id: 'engagement', label: 'Engagement' },
        { id: 'plausible', label: 'Live Traffic' }
      ].map(tab => (
        <SubTabButton
          key={tab.id}
          id={tab.id}
          label={tab.label}
          isActive={activeTab === tab.id}
          onClick={() => onTabChange(tab.id as AdminTab)}
        />
      ))}
      {activeCategory === 'review' && [
        { id: 'submissions', label: 'KvK Results', count: pendingCounts.submissions },
        { id: 'new-kingdoms', label: 'New Kingdoms', count: 0 },
        { id: 'claims', label: 'Claims', count: pendingCounts.claims },
        { id: 'corrections', label: 'Corrections', count: pendingCounts.corrections },
        { id: 'kvk-errors', label: 'KvK Errors', count: pendingCounts.kvkErrors }
      ].map(tab => (
        <SubTabButton
          key={tab.id}
          id={tab.id}
          label={tab.label}
          count={tab.count}
          isActive={activeTab === tab.id}
          onClick={() => onTabChange(tab.id as AdminTab)}
        />
      ))}
      {activeCategory === 'transfer' && [
        { id: 'transfer-hub', label: 'Overview', count: 0 },
        { id: 'transfer-status', label: 'Status Submissions', count: pendingCounts.transfers },
        { id: 'transfer-apps', label: 'Applications', count: 0 }
      ].map(tab => (
        <SubTabButton
          key={tab.id}
          id={tab.id}
          label={tab.label}
          count={tab.count}
          isActive={activeTab === tab.id}
          accentColor="#a855f7"
          onClick={() => onTabChange(tab.id as AdminTab)}
        />
      ))}
      {activeCategory === 'system' && [
        { id: 'email', label: 'Email', count: unreadEmailCount },
        { id: 'feedback', label: 'Feedback', count: pendingCounts.feedback },
        { id: 'discord-bot', label: 'Discord Bot', count: 0 },
        { id: 'bot-telemetry', label: 'Bot Telemetry', count: 0 },
        { id: 'discord-roles', label: 'Discord Roles', count: 0 },
        { id: 'referrals', label: 'Referrals', count: 0 },
        { id: 'webhooks', label: 'Webhooks', count: 0 },
        { id: 'data-sources', label: 'Data Sources', count: 0 },
        { id: 'gift-codes', label: 'Gift Codes', count: 0 },
        { id: 'battle-planner', label: 'Battle Planner', count: 0 },
        { id: 'import', label: 'Import', count: 0 }
      ].map(tab => (
        <SubTabButton
          key={tab.id}
          id={tab.id}
          label={tab.label}
          count={tab.count}
          isActive={activeTab === tab.id}
          onClick={() => onTabChange(tab.id as AdminTab)}
        />
      ))}
    </div>
  </>
);
