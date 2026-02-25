import React from 'react';
import { Link } from 'react-router-dom';
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
      width: 'fit-content',
      flexWrap: 'wrap',
    }}>
      {[
        { id: 'overview' as AdminCategory, label: 'Overview', color: '#22d3ee', defaultTab: 'analytics' as AdminTab },
        { id: 'review' as AdminCategory, label: 'Review', color: '#f97316', defaultTab: 'submissions' as AdminTab, count: pendingCounts.submissions + pendingCounts.corrections + pendingCounts.kvkErrors },
        { id: 'transfer' as AdminCategory, label: 'Transfers', color: '#a855f7', defaultTab: 'transfer-hub' as AdminTab, count: pendingCounts.transfers },
        { id: 'finance' as AdminCategory, label: 'Finance', color: '#22c55e', defaultTab: 'finance' as AdminTab },
        { id: 'operations' as AdminCategory, label: 'Operations', color: '#eab308', defaultTab: 'email' as AdminTab, count: pendingCounts.feedback + unreadEmailCount },
      ].map(cat => (
        <button
          key={cat.id}
          onClick={() => onTabChange(cat.defaultTab)}
          style={{
            padding: '0.5rem 0.85rem',
            backgroundColor: activeCategory === cat.id ? cat.color : 'transparent',
            color: activeCategory === cat.id ? '#0a0a0a' : '#9ca3af',
            border: 'none',
            borderRadius: '6px',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: '0.8rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            transition: 'all 0.15s',
          }}
        >
          {cat.label}
          {(cat.count ?? 0) > 0 && (
            <span style={{
              backgroundColor: activeCategory === cat.id ? '#0a0a0a' : '#fbbf24',
              color: activeCategory === cat.id ? cat.color : '#0a0a0a',
              fontSize: '0.6rem',
              fontWeight: 700,
              padding: '0.1rem 0.35rem',
              borderRadius: '9999px',
              minWidth: '16px',
              textAlign: 'center',
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
      {activeCategory === 'overview' && <>
        {[
          { id: 'analytics', label: 'Dashboard' },
          { id: 'engagement', label: 'Engagement' },
          { id: 'user-heatmap', label: 'User Heatmap' },
        ].map(tab => (
          <SubTabButton
            key={tab.id}
            id={tab.id}
            label={tab.label}
            isActive={activeTab === tab.id}
            onClick={() => onTabChange(tab.id as AdminTab)}
          />
        ))}
        <Link
          to="/admin/campaign-draw"
          style={{
            padding: '0.35rem 0.7rem',
            backgroundColor: '#fbbf2418',
            color: '#fbbf24',
            border: '1px solid #fbbf2440',
            borderRadius: '6px',
            fontWeight: 500,
            fontSize: '0.8rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.3rem',
            textDecoration: 'none',
          }}
        >
          🎰 Campaign Draw
        </Link>
      </>}
      {activeCategory === 'review' && [
        { id: 'submissions', label: 'KvK Results', count: pendingCounts.submissions },
        { id: 'corrections', label: 'Corrections', count: pendingCounts.corrections },
        { id: 'kvk-errors', label: 'KvK Errors', count: pendingCounts.kvkErrors },
        { id: 'matchup-conflicts', label: 'Matchup Conflicts', count: 0 },
        { id: 'review-reports', label: 'Review Reports', count: pendingCounts.reviewReports },
        { id: 'kvk-bulk', label: 'KvK Bulk / Reports', count: 0 },
      ].map(tab => (
        <SubTabButton
          key={tab.id}
          id={tab.id}
          label={tab.label}
          count={tab.count}
          isActive={activeTab === tab.id}
          accentColor="#f97316"
          onClick={() => onTabChange(tab.id as AdminTab)}
        />
      ))}
      {activeCategory === 'transfer' && [
        { id: 'transfer-hub', label: 'Overview', count: 0 },
        { id: 'transfer-status', label: 'Status Submissions', count: pendingCounts.transfers },
        { id: 'transfer-apps', label: 'Applications', count: 0 },
        { id: 'transfer-outcomes', label: 'Outcomes', count: 0 },
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
      {activeCategory === 'finance' && (
        <SubTabButton
          id="finance"
          label="Revenue · Expenses · P&L · Subscribers"
          isActive={activeTab === 'finance'}
          accentColor="#22c55e"
          onClick={() => onTabChange('finance')}
        />
      )}
      {activeCategory === 'operations' && [
        { id: 'email', label: 'Email', count: unreadEmailCount },
        { id: 'feedback', label: 'Feedback', count: pendingCounts.feedback },
        { id: 'discord-bot', label: 'Discord', count: 0 },
        { id: 'bot-telemetry', label: 'Bot Health', count: 0 },
        { id: 'discord-roles', label: 'Roles', count: 0 },
        { id: 'transfer-groups', label: 'Transfer Groups', count: 0 },
        { id: 'referrals', label: 'Referrals', count: 0 },
        { id: 'spotlight', label: 'Spotlight', count: 0 },
        { id: 'battle-planner', label: 'Battle Planner', count: 0 },
        { id: 'import', label: 'Import', count: 0 },
        { id: 'webhooks', label: 'Webhooks', count: 0 },
        { id: 'data-sources', label: 'Data Sources', count: 0 },
      ].map(tab => (
        <SubTabButton
          key={tab.id}
          id={tab.id}
          label={tab.label}
          count={tab.count}
          isActive={activeTab === tab.id}
          accentColor="#eab308"
          onClick={() => onTabChange(tab.id as AdminTab)}
        />
      ))}
    </div>
  </>
);
