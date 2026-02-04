/**
 * Discord Roles Dashboard Component
 * Admin interface for managing Discord role assignments
 */
import React, { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

interface LinkedUser {
  id: string;
  username: string;
  discord_id: string;
  linked_player_id: string;
  linked_username: string;
  role_status?: 'assigned' | 'pending' | 'failed' | 'unknown';
}

interface BackfillResult {
  success: boolean;
  message: string;
  total: number;
  assigned: number;
  skipped: number;
  failed: number;
  details?: Array<{
    user_id: string;
    username: string;
    status: string;
    reason?: string;
    error?: string;
  }>;
}

const COLORS = {
  primary: '#22d3ee',
  success: '#22c55e',
  warning: '#fbbf24',
  danger: '#ef4444',
  muted: '#6b7280',
  background: '#111116',
  border: '#2a2a2a'
};

export const DiscordRolesDashboard: React.FC = () => {
  const [linkedUsers, setLinkedUsers] = useState<LinkedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [backfillResult, setBackfillResult] = useState<BackfillResult | null>(null);
  const [backfilling, setBackfilling] = useState(false);
  const [syncingUser, setSyncingUser] = useState<string | null>(null);

  useEffect(() => {
    loadLinkedUsers();
  }, []);

  const loadLinkedUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/bot/linked-users`);
      if (res.ok) {
        const data = await res.json();
        setLinkedUsers(data.users || []);
      }
    } catch (error) {
      console.error('Failed to load linked users:', error);
    } finally {
      setLoading(false);
    }
  };

  const runBackfill = async () => {
    setBackfilling(true);
    setBackfillResult(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/bot/backfill-settler-roles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const result = await res.json();
      setBackfillResult(result);
      // Reload users to see updated status
      await loadLinkedUsers();
    } catch (error) {
      console.error('Backfill failed:', error);
      setBackfillResult({
        success: false,
        message: 'Failed to run backfill',
        total: 0,
        assigned: 0,
        skipped: 0,
        failed: 1
      });
    } finally {
      setBackfilling(false);
    }
  };

  const syncUserRole = async (userId: string) => {
    setSyncingUser(userId);
    try {
      const res = await fetch(`${API_URL}/api/v1/bot/sync-settler-role`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, is_linking: true })
      });
      const result = await res.json();
      
      // Update the user's status in the list
      setLinkedUsers(prev => prev.map(u => 
        u.id === userId 
          ? { ...u, role_status: result.success ? 'assigned' : 'failed' }
          : u
      ));
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setSyncingUser(null);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: COLORS.muted }}>
        Loading Discord roles data...
      </div>
    );
  }

  return (
    <div style={{ padding: '1rem' }}>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '1.5rem'
      }}>
        <div>
          <h2 style={{ margin: 0, color: '#fff', fontSize: '1.25rem' }}>
            Discord Role Management
          </h2>
          <p style={{ margin: '0.25rem 0 0', color: COLORS.muted, fontSize: '0.85rem' }}>
            Manage Settler role assignments for linked users
          </p>
        </div>
        <button
          onClick={runBackfill}
          disabled={backfilling}
          style={{
            padding: '0.6rem 1.2rem',
            backgroundColor: backfilling ? COLORS.muted : COLORS.primary,
            color: '#0a0a0a',
            border: 'none',
            borderRadius: '6px',
            fontWeight: 600,
            cursor: backfilling ? 'not-allowed' : 'pointer',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem'
          }}
        >
          {backfilling ? '⏳ Running...' : '🔄 Backfill All Roles'}
        </button>
      </div>

      {/* Backfill Result */}
      {backfillResult && (
        <div style={{
          padding: '1rem',
          backgroundColor: backfillResult.success ? '#22c55e15' : '#ef444415',
          border: `1px solid ${backfillResult.success ? '#22c55e40' : '#ef444440'}`,
          borderRadius: '8px',
          marginBottom: '1rem'
        }}>
          <div style={{ 
            fontWeight: 600, 
            color: backfillResult.success ? COLORS.success : COLORS.danger,
            marginBottom: '0.5rem'
          }}>
            {backfillResult.success ? '✅ Backfill Complete' : '⚠️ Backfill Issues'}
          </div>
          <div style={{ color: '#fff', fontSize: '0.9rem' }}>
            {backfillResult.message}
          </div>
          <div style={{ 
            display: 'flex', 
            gap: '1.5rem', 
            marginTop: '0.75rem',
            fontSize: '0.85rem'
          }}>
            <span style={{ color: COLORS.muted }}>
              Total: <strong style={{ color: '#fff' }}>{backfillResult.total}</strong>
            </span>
            <span style={{ color: COLORS.muted }}>
              Assigned: <strong style={{ color: COLORS.success }}>{backfillResult.assigned}</strong>
            </span>
            <span style={{ color: COLORS.muted }}>
              Skipped: <strong style={{ color: COLORS.warning }}>{backfillResult.skipped}</strong>
            </span>
            <span style={{ color: COLORS.muted }}>
              Failed: <strong style={{ color: COLORS.danger }}>{backfillResult.failed}</strong>
            </span>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
        gap: '1rem',
        marginBottom: '1.5rem'
      }}>
        <div style={{
          padding: '1rem',
          backgroundColor: COLORS.background,
          border: `1px solid ${COLORS.border}`,
          borderRadius: '8px'
        }}>
          <div style={{ color: COLORS.muted, fontSize: '0.75rem', textTransform: 'uppercase' }}>
            Linked Users
          </div>
          <div style={{ color: '#fff', fontSize: '1.75rem', fontWeight: 700 }}>
            {linkedUsers.length}
          </div>
          <div style={{ color: COLORS.muted, fontSize: '0.8rem' }}>
            With both Kingshot & Discord
          </div>
        </div>
        <div style={{
          padding: '1rem',
          backgroundColor: COLORS.background,
          border: `1px solid ${COLORS.border}`,
          borderRadius: '8px'
        }}>
          <div style={{ color: COLORS.muted, fontSize: '0.75rem', textTransform: 'uppercase' }}>
            Settler Role ID
          </div>
          <div style={{ color: COLORS.primary, fontSize: '0.9rem', fontFamily: 'monospace', marginTop: '0.5rem' }}>
            1466442878585934102
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div style={{
        backgroundColor: COLORS.background,
        border: `1px solid ${COLORS.border}`,
        borderRadius: '8px',
        overflow: 'hidden'
      }}>
        <div style={{
          padding: '0.75rem 1rem',
          borderBottom: `1px solid ${COLORS.border}`,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr auto',
          gap: '1rem',
          fontSize: '0.75rem',
          textTransform: 'uppercase',
          color: COLORS.muted,
          fontWeight: 600
        }}>
          <div>Atlas User</div>
          <div>Kingshot Account</div>
          <div>Discord ID</div>
          <div>Actions</div>
        </div>

        {linkedUsers.length === 0 ? (
          <div style={{ 
            padding: '2rem', 
            textAlign: 'center', 
            color: COLORS.muted 
          }}>
            No users with both Kingshot and Discord accounts linked
          </div>
        ) : (
          linkedUsers.map(user => (
            <div
              key={user.id}
              style={{
                padding: '0.75rem 1rem',
                borderBottom: `1px solid ${COLORS.border}`,
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr auto',
                gap: '1rem',
                alignItems: 'center',
                fontSize: '0.85rem'
              }}
            >
              <div style={{ color: '#fff' }}>
                {user.username || 'Unknown'}
              </div>
              <div style={{ color: COLORS.primary }}>
                {user.linked_username}
                <span style={{ color: COLORS.muted, fontSize: '0.75rem', marginLeft: '0.5rem' }}>
                  #{user.linked_player_id}
                </span>
              </div>
              <div style={{ color: COLORS.muted, fontFamily: 'monospace', fontSize: '0.8rem' }}>
                {user.discord_id}
              </div>
              <div>
                <button
                  onClick={() => syncUserRole(user.id)}
                  disabled={syncingUser === user.id}
                  style={{
                    padding: '0.35rem 0.7rem',
                    backgroundColor: syncingUser === user.id ? COLORS.muted : '#22d3ee20',
                    color: COLORS.primary,
                    border: `1px solid ${COLORS.primary}40`,
                    borderRadius: '4px',
                    cursor: syncingUser === user.id ? 'not-allowed' : 'pointer',
                    fontSize: '0.75rem',
                    fontWeight: 500
                  }}
                >
                  {syncingUser === user.id ? '⏳' : '🔄'} Sync Role
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Info Box */}
      <div style={{
        marginTop: '1.5rem',
        padding: '1rem',
        backgroundColor: '#22d3ee10',
        border: '1px solid #22d3ee30',
        borderRadius: '8px',
        fontSize: '0.85rem',
        color: COLORS.muted
      }}>
        <strong style={{ color: COLORS.primary }}>ℹ️ How it works:</strong>
        <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.25rem' }}>
          <li>Users who link their Kingshot account automatically get the Settler role</li>
          <li>Role is removed when they unlink their account</li>
          <li>Use &quot;Backfill All Roles&quot; to assign roles to existing users who linked before this feature</li>
          <li>Users must be in the Kingshot Atlas Discord server to receive the role</li>
        </ul>
      </div>
    </div>
  );
};

export default DiscordRolesDashboard;
