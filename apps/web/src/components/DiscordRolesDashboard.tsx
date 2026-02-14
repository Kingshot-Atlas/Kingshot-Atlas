/**
 * Discord Roles Dashboard Component
 * Admin interface for managing Discord role assignments
 */
import React, { useState, useEffect } from 'react';
import { logger } from '../utils/logger';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

async function botHeaders(extra: Record<string, string> = {}): Promise<Record<string, string>> {
  try {
    const { getAuthHeaders } = await import('../services/authHeaders');
    const auth = await getAuthHeaders({ requireAuth: false });
    return { ...auth, ...extra };
  } catch {
    return { ...extra };
  }
}

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

interface SupporterUser {
  id: string;
  username: string;
  discord_id: string;
  linked_username?: string;
  subscription_tier: string;
}

export const DiscordRolesDashboard: React.FC = () => {
  const [linkedUsers, setLinkedUsers] = useState<LinkedUser[]>([]);
  const [supporterUsers, setSupporterUsers] = useState<SupporterUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [backfillResult, setBackfillResult] = useState<BackfillResult | null>(null);
  const [supporterBackfillResult, setSupporterBackfillResult] = useState<BackfillResult | null>(null);
  const [backfilling, setBackfilling] = useState(false);
  const [supporterBackfilling, setSupporterBackfilling] = useState(false);
  const [syncingUser, setSyncingUser] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<'settler' | 'supporter'>('settler');

  useEffect(() => {
    loadLinkedUsers();
    loadSupporterUsers();
  }, []);

  const loadLinkedUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/bot/linked-users`, { headers: await botHeaders() });
      if (res.ok) {
        const data = await res.json();
        setLinkedUsers(data.users || []);
      }
    } catch (error) {
      logger.error('Failed to load linked users:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSupporterUsers = async () => {
    try {
      const res = await fetch(`${API_URL}/api/v1/bot/supporter-users`, { headers: await botHeaders() });
      if (res.ok) {
        const data = await res.json();
        setSupporterUsers(data.users || []);
      }
    } catch (error) {
      logger.error('Failed to load supporter users:', error);
    }
  };

  const syncSupporterUser = async (userId: string) => {
    setSyncingUser(userId);
    try {
      const res = await fetch(`${API_URL}/api/v1/bot/sync-supporter-role`, {
        method: 'POST',
        headers: await botHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ user_id: userId, is_linking: true })
      });
      const result = await res.json();
      if (!result.success) logger.warn('Supporter sync failed for user:', result.error);
    } catch (error) {
      logger.error('Supporter user sync failed:', error);
    } finally {
      setSyncingUser(null);
    }
  };

  const runSupporterBackfill = async () => {
    setSupporterBackfilling(true);
    setSupporterBackfillResult(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/bot/backfill-supporter-roles`, {
        method: 'POST',
        headers: await botHeaders({ 'Content-Type': 'application/json' })
      });
      const result = await res.json();
      setSupporterBackfillResult(result);
      await loadSupporterUsers();
    } catch (error) {
      logger.error('Supporter backfill failed:', error);
      setSupporterBackfillResult({
        success: false,
        message: 'Failed to run supporter backfill',
        total: 0, assigned: 0, skipped: 0, failed: 1
      });
    } finally {
      setSupporterBackfilling(false);
    }
  };

  const runBackfill = async () => {
    setBackfilling(true);
    setBackfillResult(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/bot/backfill-settler-roles`, {
        method: 'POST',
        headers: await botHeaders({ 'Content-Type': 'application/json' })
      });
      const result = await res.json();
      setBackfillResult(result);
      // Reload users to see updated status
      await loadLinkedUsers();
    } catch (error) {
      logger.error('Backfill failed:', error);
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
        headers: await botHeaders({ 'Content-Type': 'application/json' }),
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
      logger.error('Sync failed:', error);
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
        marginBottom: '1rem'
      }}>
        <div>
          <h2 style={{ margin: 0, color: '#fff', fontSize: '1.25rem' }}>
            Discord Role Management
          </h2>
          <p style={{ margin: '0.25rem 0 0', color: COLORS.muted, fontSize: '0.85rem' }}>
            Manage role assignments for linked users
          </p>
        </div>
      </div>

      {/* Section Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <button
          onClick={() => setActiveSection('settler')}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: activeSection === 'settler' ? COLORS.primary + '20' : 'transparent',
            color: activeSection === 'settler' ? COLORS.primary : COLORS.muted,
            border: `1px solid ${activeSection === 'settler' ? COLORS.primary + '60' : COLORS.border}`,
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '0.85rem',
            fontWeight: activeSection === 'settler' ? 600 : 400
          }}
        >
          Settler Roles ({linkedUsers.length})
        </button>
        <button
          onClick={() => setActiveSection('supporter')}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: activeSection === 'supporter' ? '#FF6B8A20' : 'transparent',
            color: activeSection === 'supporter' ? '#FF6B8A' : COLORS.muted,
            border: `1px solid ${activeSection === 'supporter' ? '#FF6B8A60' : COLORS.border}`,
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '0.85rem',
            fontWeight: activeSection === 'supporter' ? 600 : 400
          }}
        >
          Supporter Roles ({supporterUsers.length})
        </button>
      </div>

      {activeSection === 'settler' && (<>
      {/* Settler Section Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div style={{ color: COLORS.muted, fontSize: '0.85rem' }}>Users with both Kingshot & Discord linked</div>
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
          {backfilling ? '⏳ Running...' : '🔄 Backfill Settler Roles'}
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
          <li>Bot syncs every 30 minutes automatically</li>
          <li>Users must be in the Kingshot Atlas Discord server to receive the role</li>
        </ul>
      </div>
      </>)}

      {activeSection === 'supporter' && (<>
      {/* Supporter Section Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div style={{ color: COLORS.muted, fontSize: '0.85rem' }}>Atlas Supporter subscribers with Discord linked</div>
        <button
          onClick={runSupporterBackfill}
          disabled={supporterBackfilling}
          style={{
            padding: '0.6rem 1.2rem',
            backgroundColor: supporterBackfilling ? COLORS.muted : '#FF6B8A',
            color: '#0a0a0a',
            border: 'none',
            borderRadius: '6px',
            fontWeight: 600,
            cursor: supporterBackfilling ? 'not-allowed' : 'pointer',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem'
          }}
        >
          {supporterBackfilling ? '⏳ Running...' : '💎 Force Supporter Sync'}
        </button>
      </div>

      {/* Supporter Backfill Result */}
      {supporterBackfillResult && (
        <div style={{
          padding: '1rem',
          backgroundColor: supporterBackfillResult.success ? '#22c55e15' : '#ef444415',
          border: `1px solid ${supporterBackfillResult.success ? '#22c55e40' : '#ef444440'}`,
          borderRadius: '8px',
          marginBottom: '1rem'
        }}>
          <div style={{ fontWeight: 600, color: supporterBackfillResult.success ? COLORS.success : COLORS.danger, marginBottom: '0.5rem' }}>
            {supporterBackfillResult.success ? '✅ Supporter Sync Complete' : '⚠️ Sync Issues'}
          </div>
          <div style={{ color: '#fff', fontSize: '0.9rem' }}>{supporterBackfillResult.message}</div>
          <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.75rem', fontSize: '0.85rem' }}>
            <span style={{ color: COLORS.muted }}>Total: <strong style={{ color: '#fff' }}>{supporterBackfillResult.total}</strong></span>
            <span style={{ color: COLORS.muted }}>Assigned: <strong style={{ color: COLORS.success }}>{supporterBackfillResult.assigned}</strong></span>
            <span style={{ color: COLORS.muted }}>Skipped: <strong style={{ color: COLORS.warning }}>{supporterBackfillResult.skipped}</strong></span>
            <span style={{ color: COLORS.muted }}>Failed: <strong style={{ color: COLORS.danger }}>{supporterBackfillResult.failed}</strong></span>
          </div>
        </div>
      )}

      {/* Supporter Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ padding: '1rem', backgroundColor: COLORS.background, border: `1px solid ${COLORS.border}`, borderRadius: '8px' }}>
          <div style={{ color: COLORS.muted, fontSize: '0.75rem', textTransform: 'uppercase' }}>Supporters with Discord</div>
          <div style={{ color: '#FF6B8A', fontSize: '1.75rem', fontWeight: 700 }}>{supporterUsers.length}</div>
          <div style={{ color: COLORS.muted, fontSize: '0.8rem' }}>Eligible for Supporter role</div>
        </div>
      </div>

      {/* Supporter Users Table */}
      <div style={{ backgroundColor: COLORS.background, border: `1px solid ${COLORS.border}`, borderRadius: '8px', overflow: 'hidden' }}>
        <div style={{ padding: '0.75rem 1rem', borderBottom: `1px solid ${COLORS.border}`, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '1rem', fontSize: '0.75rem', textTransform: 'uppercase', color: COLORS.muted, fontWeight: 600 }}>
          <div>Atlas User</div>
          <div>Tier</div>
          <div>Discord ID</div>
          <div>Action</div>
        </div>
        {supporterUsers.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: COLORS.muted }}>No supporter users with Discord accounts</div>
        ) : (
          supporterUsers.map(user => (
            <div key={user.id} style={{ padding: '0.75rem 1rem', borderBottom: `1px solid ${COLORS.border}`, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '1rem', alignItems: 'center', fontSize: '0.85rem' }}>
              <div style={{ color: '#fff' }}>{user.username || 'Unknown'}</div>
              <div><span style={{ padding: '0.15rem 0.5rem', backgroundColor: '#FF6B8A20', color: '#FF6B8A', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>Supporter</span></div>
              <div style={{ color: COLORS.muted, fontFamily: 'monospace', fontSize: '0.8rem' }}>{user.discord_id}</div>
              <div>
                <button
                  onClick={() => syncSupporterUser(user.id)}
                  disabled={syncingUser === user.id}
                  style={{
                    padding: '0.25rem 0.6rem',
                    backgroundColor: syncingUser === user.id ? COLORS.muted : '#FF6B8A20',
                    color: '#FF6B8A',
                    border: '1px solid #FF6B8A40',
                    borderRadius: '4px',
                    cursor: syncingUser === user.id ? 'wait' : 'pointer',
                    fontSize: '0.75rem'
                  }}
                >
                  {syncingUser === user.id ? '...' : 'Sync'}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Supporter Info Box */}
      <div style={{ marginTop: '1.5rem', padding: '1rem', backgroundColor: '#FF6B8A10', border: '1px solid #FF6B8A30', borderRadius: '8px', fontSize: '0.85rem', color: COLORS.muted }}>
        <strong style={{ color: '#FF6B8A' }}>ℹ️ Supporter role sync:</strong>
        <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.25rem' }}>
          <li>Bot syncs Supporter roles every 30 minutes automatically</li>
          <li>Stripe webhook also triggers role sync on subscription changes</li>
          <li>Use &quot;Force Supporter Sync&quot; to immediately assign roles</li>
          <li>Role is removed when subscription ends or is canceled</li>
        </ul>
      </div>
      </>)}
    </div>
  );
};

export default DiscordRolesDashboard;
