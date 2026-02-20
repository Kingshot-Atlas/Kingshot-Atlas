/**
 * Discord Roles Dashboard Component
 * Admin interface for managing Discord role assignments
 * Tabs: Settler, Supporter, Gilded, Consul/Ambassador, Transfer Groups
 */
import React, { useState, useEffect, useCallback } from 'react';
import { logger } from '../utils/logger';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

// Typed interfaces for Discord role user data (eliminates no-explicit-any)
interface RoleUser {
  id: string;
  user_id?: string;
  username?: string;
  discord_id: string;
  linked_username?: string;
  linked_player_id?: string;
  linked_kingdom?: number;
  all_kingdoms?: number[];
  kingdom?: number;
  referral_tier?: string;
  referral_count?: number;
}

interface TransferGroup {
  id: string;
  label: string;
  min_kingdom: number;
  max_kingdom: number;
}

async function botHeaders(extra: Record<string, string> = {}): Promise<Record<string, string>> {
  try {
    const { getAuthHeaders } = await import('../services/authHeaders');
    const auth = await getAuthHeaders({ requireAuth: false });
    return { ...auth, ...extra };
  } catch {
    return { ...extra };
  }
}

interface BackfillResult {
  success: boolean;
  message: string;
  total: number;
  assigned: number;
  skipped: number;
  failed: number;
  groups?: TransferGroup[];
  group_counts?: Record<string, number>;
}

const C = {
  primary: '#22d3ee',
  success: '#22c55e',
  warning: '#fbbf24',
  danger: '#ef4444',
  muted: '#6b7280',
  bg: '#111116',
  border: '#2a2a2a',
  supporter: '#FF6B8A',
  gilded: '#ffd700',
  referral: '#a855f7',
  transfer: '#22c55e',
};

type Section = 'settler' | 'supporter' | 'gilded' | 'referral' | 'transfer';

const TABS: { key: Section; label: string; color: string; icon: string }[] = [
  { key: 'settler', label: 'Settler', color: C.primary, icon: '🎖️' },
  { key: 'supporter', label: 'Supporter', color: C.supporter, icon: '💎' },
  { key: 'gilded', label: 'Gilded', color: C.gilded, icon: '✨' },
  { key: 'referral', label: 'Referral', color: C.referral, icon: '🏛️' },
  { key: 'transfer', label: 'Transfer Groups', color: C.transfer, icon: '🔀' },
];

// Reusable backfill result display
const BackfillResultDisplay: React.FC<{ result: BackfillResult | null }> = ({ result }) => {
  if (!result) return null;
  return (
    <div style={{
      padding: '0.75rem 1rem',
      backgroundColor: result.success ? '#22c55e12' : '#ef444412',
      border: `1px solid ${result.success ? '#22c55e35' : '#ef444435'}`,
      borderRadius: '8px',
      marginBottom: '1rem'
    }}>
      <div style={{ fontWeight: 600, color: result.success ? C.success : C.danger, marginBottom: '0.3rem', fontSize: '0.85rem' }}>
        {result.success ? '✅ Complete' : '⚠️ Issues'}
      </div>
      <div style={{ color: '#fff', fontSize: '0.8rem' }}>{result.message}</div>
      <div style={{ display: 'flex', gap: '1.25rem', marginTop: '0.5rem', fontSize: '0.8rem' }}>
        <span style={{ color: C.muted }}>Total: <strong style={{ color: '#fff' }}>{result.total}</strong></span>
        <span style={{ color: C.muted }}>Assigned: <strong style={{ color: C.success }}>{result.assigned}</strong></span>
        <span style={{ color: C.muted }}>Skipped: <strong style={{ color: C.warning }}>{result.skipped}</strong></span>
        <span style={{ color: C.muted }}>Failed: <strong style={{ color: C.danger }}>{result.failed}</strong></span>
      </div>
    </div>
  );
};

// Reusable backfill button
const BackfillButton: React.FC<{ loading: boolean; onClick: () => void; color: string; label: string; icon: string }> = ({ loading, onClick, color, label, icon }) => (
  <button
    onClick={onClick}
    disabled={loading}
    style={{
      padding: '0.5rem 1rem',
      backgroundColor: loading ? C.muted : color,
      color: '#0a0a0a',
      border: 'none',
      borderRadius: '6px',
      fontWeight: 600,
      cursor: loading ? 'not-allowed' : 'pointer',
      fontSize: '0.8rem',
      display: 'flex',
      alignItems: 'center',
      gap: '0.4rem'
    }}
  >
    {loading ? '⏳ Running...' : `${icon} ${label}`}
  </button>
);

// Stat card
const StatCard: React.FC<{ label: string; value: string | number; color: string; sub?: string }> = ({ label, value, color, sub }) => (
  <div style={{ padding: '1rem', backgroundColor: C.bg, border: `1px solid ${C.border}`, borderRadius: '8px' }}>
    <div style={{ color: C.muted, fontSize: '0.7rem', textTransform: 'uppercase' }}>{label}</div>
    <div style={{ color, fontSize: '1.5rem', fontWeight: 700, marginTop: '0.2rem' }}>{value}</div>
    {sub && <div style={{ color: C.muted, fontSize: '0.75rem' }}>{sub}</div>}
  </div>
);

export const DiscordRolesDashboard: React.FC = () => {
  const [activeSection, setActiveSection] = useState<Section>('settler');

  // Settler state
  const [linkedUsers, setLinkedUsers] = useState<RoleUser[]>([]);
  const [settlerResult, setSettlerResult] = useState<BackfillResult | null>(null);
  const [settlerLoading, setSettlerLoading] = useState(false);

  // Supporter state
  const [supporterUsers, setSupporterUsers] = useState<RoleUser[]>([]);
  const [supporterResult, setSupporterResult] = useState<BackfillResult | null>(null);
  const [supporterLoading, setSupporterLoading] = useState(false);

  // Gilded state
  const [gildedUsers, setGildedUsers] = useState<RoleUser[]>([]);
  const [gildedResult, setGildedResult] = useState<BackfillResult | null>(null);
  const [gildedLoading, setGildedLoading] = useState(false);

  // Referral state
  const [referralUsers, setReferralUsers] = useState<RoleUser[]>([]);
  const [referralResult, setReferralResult] = useState<BackfillResult | null>(null);
  const [referralLoading, setReferralLoading] = useState(false);

  // Transfer group state
  const [transferResult, setTransferResult] = useState<BackfillResult | null>(null);
  const [transferLoading, setTransferLoading] = useState(false);

  const [loading, setLoading] = useState(true);
  const [syncingUser, setSyncingUser] = useState<string | null>(null);

  // Load data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [linkedRes, supporterRes, gildedRes, referralRes] = await Promise.all([
        fetch(`${API_URL}/api/v1/bot/linked-users`, { headers: await botHeaders() }).then(r => r.ok ? r.json() : { users: [] }),
        fetch(`${API_URL}/api/v1/bot/supporter-users`, { headers: await botHeaders() }).then(r => r.ok ? r.json() : { users: [] }),
        fetch(`${API_URL}/api/v1/bot/gilded-users`, { headers: await botHeaders() }).then(r => r.ok ? r.json() : { users: [] }),
        fetch(`${API_URL}/api/v1/bot/referral-users`, { headers: await botHeaders() }).then(r => r.ok ? r.json() : { users: [] }),
      ]);
      setLinkedUsers(linkedRes.users || []);
      setSupporterUsers(supporterRes.users || []);
      setGildedUsers(gildedRes.users || []);
      setReferralUsers(referralRes.users || []);
    } catch (error) {
      logger.error('Failed to load role data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Generic backfill runner
  const runBackfill = async (
    endpoint: string,
    setResult: (r: BackfillResult) => void,
    setRunning: (b: boolean) => void,
  ) => {
    setRunning(true);
    setResult(null as unknown as BackfillResult);
    try {
      const res = await fetch(`${API_URL}/api/v1/bot/${endpoint}`, {
        method: 'POST',
        headers: await botHeaders({ 'Content-Type': 'application/json' })
      });
      const result = await res.json();
      setResult(result);
    } catch (error) {
      logger.error(`Backfill ${endpoint} failed:`, error);
      setResult({ success: false, message: `Failed: ${error}`, total: 0, assigned: 0, skipped: 0, failed: 1 });
    } finally {
      setRunning(false);
    }
  };

  const syncUserRole = async (userId: string, endpoint: string) => {
    setSyncingUser(userId);
    try {
      await fetch(`${API_URL}/api/v1/bot/${endpoint}`, {
        method: 'POST',
        headers: await botHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ user_id: userId, is_linking: true })
      });
    } catch (error) {
      logger.error('Sync failed:', error);
    } finally {
      setSyncingUser(null);
    }
  };

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center', color: C.muted }}>Loading Discord roles data...</div>;
  }

  // Count linked users with kingdoms for transfer group info
  const usersWithKingdoms = linkedUsers.filter(u => u.linked_kingdom || (u.all_kingdoms && u.all_kingdoms.length > 0)).length;

  return (
    <div style={{ padding: '1rem' }}>
      {/* Header */}
      <div style={{ marginBottom: '1rem' }}>
        <h2 style={{ margin: 0, color: '#fff', fontSize: '1.25rem' }}>Discord Role Management</h2>
        <p style={{ margin: '0.25rem 0 0', color: C.muted, fontSize: '0.85rem' }}>Manage role assignments for linked users</p>
      </div>

      {/* Section Tabs */}
      <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {TABS.map(tab => {
          const active = activeSection === tab.key;
          const count = tab.key === 'settler' ? linkedUsers.length
            : tab.key === 'supporter' ? supporterUsers.length
            : tab.key === 'gilded' ? gildedUsers.length
            : tab.key === 'referral' ? referralUsers.length
            : usersWithKingdoms;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveSection(tab.key)}
              style={{
                padding: '0.45rem 0.85rem',
                backgroundColor: active ? `${tab.color}20` : 'transparent',
                color: active ? tab.color : C.muted,
                border: `1px solid ${active ? `${tab.color}60` : C.border}`,
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: active ? 600 : 400,
                whiteSpace: 'nowrap',
              }}
            >
              {tab.icon} {tab.label} ({count})
            </button>
          );
        })}
      </div>

      {/* ========== SETTLER TAB ========== */}
      {activeSection === 'settler' && (<>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div style={{ color: C.muted, fontSize: '0.85rem' }}>Users with both Kingshot & Discord linked</div>
          <BackfillButton loading={settlerLoading} onClick={() => runBackfill('backfill-settler-roles', setSettlerResult, setSettlerLoading)} color={C.primary} label="Backfill Settler Roles" icon="🔄" />
        </div>
        <BackfillResultDisplay result={settlerResult} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          <StatCard label="Linked Users" value={linkedUsers.length} color="#fff" sub="With both Kingshot & Discord" />
          <StatCard label="Settler Role ID" value="1466442878585934102" color={C.primary} />
        </div>
        <UserTable
          users={linkedUsers.slice(0, 50)}
          columns={[
            { key: 'username', label: 'Atlas User', render: u => u.username || 'Unknown' },
            { key: 'linked_username', label: 'Kingshot Account', render: u => <><span style={{ color: C.primary }}>{u.linked_username}</span> <span style={{ color: C.muted, fontSize: '0.7rem' }}>#{u.linked_player_id}</span></> },
            { key: 'discord_id', label: 'Discord ID', render: u => <span style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{u.discord_id}</span> },
          ]}
          syncAction={(userId) => syncUserRole(userId, 'sync-settler-role')}
          syncingUser={syncingUser}
          syncColor={C.primary}
        />
        {linkedUsers.length > 50 && <div style={{ color: C.muted, fontSize: '0.75rem', marginTop: '0.5rem', textAlign: 'center' }}>Showing first 50 of {linkedUsers.length} users</div>}
        <InfoBox color={C.primary} items={[
          'Users who link their Kingshot account automatically get the Settler role',
          'Role is removed when they unlink their account',
          'Bot syncs every 30 minutes automatically',
          'Users must be in the Kingshot Atlas Discord server to receive the role',
        ]} />
      </>)}

      {/* ========== SUPPORTER TAB ========== */}
      {activeSection === 'supporter' && (<>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div style={{ color: C.muted, fontSize: '0.85rem' }}>Atlas Supporter subscribers with Discord linked</div>
          <BackfillButton loading={supporterLoading} onClick={() => runBackfill('backfill-supporter-roles', setSupporterResult, setSupporterLoading)} color={C.supporter} label="Force Supporter Sync" icon="💎" />
        </div>
        <BackfillResultDisplay result={supporterResult} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          <StatCard label="Supporters with Discord" value={supporterUsers.length} color={C.supporter} sub="Eligible for Supporter role" />
        </div>
        <UserTable
          users={supporterUsers}
          columns={[
            { key: 'username', label: 'Atlas User', render: u => u.username || u.linked_username || 'Unknown' },
            { key: 'tier', label: 'Tier', render: () => <span style={{ padding: '0.15rem 0.5rem', backgroundColor: '#FF6B8A20', color: '#FF6B8A', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600 }}>Supporter</span> },
            { key: 'discord_id', label: 'Discord ID', render: u => <span style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{u.discord_id}</span> },
          ]}
          syncAction={(userId) => syncUserRole(userId, 'sync-supporter-role')}
          syncingUser={syncingUser}
          syncColor={C.supporter}
        />
        <InfoBox color={C.supporter} items={[
          'Bot syncs Supporter roles every 30 minutes automatically',
          'Stripe webhook also triggers role sync on subscription changes',
          'Use "Force Supporter Sync" to immediately assign roles',
          'Role is removed when subscription ends or is canceled',
        ]} />
      </>)}

      {/* ========== GILDED TAB ========== */}
      {activeSection === 'gilded' && (<>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div style={{ color: C.muted, fontSize: '0.85rem' }}>Users from Gold-tier Kingdom Fund kingdoms with Discord linked</div>
          <BackfillButton loading={gildedLoading} onClick={() => runBackfill('backfill-gilded-roles', setGildedResult, setGildedLoading)} color={C.gilded} label="Sync Gilded Roles" icon="✨" />
        </div>
        <BackfillResultDisplay result={gildedResult} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          <StatCard label="Gilded Users" value={gildedUsers.length} color={C.gilded} sub="From Gold-tier kingdoms" />
          <StatCard label="Gilded Role ID" value="1472230516823556260" color={C.gilded} />
        </div>
        <UserTable
          users={gildedUsers}
          columns={[
            { key: 'username', label: 'Username', render: u => u.username || 'Unknown' },
            { key: 'kingdom', label: 'Kingdom', render: u => <span style={{ color: C.gilded }}>K{u.kingdom}</span> },
            { key: 'discord_id', label: 'Discord ID', render: u => <span style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{u.discord_id}</span> },
          ]}
          syncColor={C.gilded}
        />
        <InfoBox color={C.gilded} items={[
          'Gilded role is for users from Gold-tier Kingdom Fund kingdoms',
          'Bot syncs every 30 minutes automatically',
          'Role is removed if the kingdom drops below Gold tier',
          'Users get the gold GILDED badge + colored username on the website',
        ]} />
      </>)}

      {/* ========== REFERRAL (CONSUL/AMBASSADOR) TAB ========== */}
      {activeSection === 'referral' && (<>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div style={{ color: C.muted, fontSize: '0.85rem' }}>Consul (10+ referrals) & Ambassador (20+ referrals) with Discord linked</div>
          <BackfillButton loading={referralLoading} onClick={() => runBackfill('backfill-referral-roles', setReferralResult, setReferralLoading)} color={C.referral} label="Sync Referral Roles" icon="🏛️" />
        </div>
        <BackfillResultDisplay result={referralResult} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          <StatCard label="Total Referral Users" value={referralUsers.length} color={C.referral} sub="Consul + Ambassador" />
          <StatCard label="Consul" value={referralUsers.filter(u => u.referral_tier === 'consul').length} color="#818cf8" sub="10+ verified referrals" />
          <StatCard label="Ambassador" value={referralUsers.filter(u => u.referral_tier === 'ambassador').length} color="#a855f7" sub="20+ verified referrals" />
        </div>
        <UserTable
          users={referralUsers}
          columns={[
            { key: 'username', label: 'Username', render: u => u.username || 'Unknown' },
            { key: 'tier', label: 'Tier', render: u => {
              const isAmb = u.referral_tier === 'ambassador';
              return <span style={{ padding: '0.15rem 0.5rem', backgroundColor: isAmb ? '#a855f720' : '#818cf820', color: isAmb ? '#a855f7' : '#818cf8', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600 }}>{isAmb ? 'Ambassador' : 'Consul'}</span>;
            }},
            { key: 'referral_count', label: 'Referrals', render: u => <span style={{ color: C.referral, fontWeight: 600 }}>{u.referral_count || 0}</span> },
            { key: 'discord_id', label: 'Discord ID', render: u => <span style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{u.discord_id}</span> },
          ]}
          syncColor={C.referral}
        />
        <InfoBox color={C.referral} items={[
          'Consul role: 10+ verified referrals. Ambassador role: 20+ verified referrals',
          'Ambassadors get both Consul AND Ambassador roles',
          'Bot syncs every 30 minutes via the linked-users endpoint',
          'Referral tier is tracked in profiles.referral_tier (auto-updated by DB trigger)',
        ]} />
      </>)}

      {/* ========== TRANSFER GROUPS TAB ========== */}
      {activeSection === 'transfer' && (<>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div style={{ color: C.muted, fontSize: '0.85rem' }}>Transfer group roles based on linked kingdom number</div>
          <BackfillButton loading={transferLoading} onClick={() => runBackfill('backfill-transfer-group-roles', setTransferResult, setTransferLoading)} color={C.transfer} label="Check Transfer Groups" icon="🔀" />
        </div>
        <BackfillResultDisplay result={transferResult} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          <StatCard label="Users with Kingdoms" value={usersWithKingdoms} color={C.transfer} sub="Eligible for transfer group roles" />
          <StatCard label="Total Linked Users" value={linkedUsers.length} color={C.primary} sub="With Discord linked" />
        </div>
        {/* Transfer group distribution */}
        {transferResult?.groups && (
          <div style={{ backgroundColor: C.bg, border: `1px solid ${C.border}`, borderRadius: '8px', overflow: 'hidden', marginBottom: '1rem' }}>
            <div style={{ padding: '0.75rem 1rem', borderBottom: `1px solid ${C.border}`, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', fontSize: '0.7rem', textTransform: 'uppercase', color: C.muted, fontWeight: 600 }}>
              <div>Group</div>
              <div>Range</div>
              <div>Users</div>
            </div>
            {transferResult.groups?.map((g) => (
              <div key={g.id} style={{ padding: '0.6rem 1rem', borderBottom: `1px solid ${C.border}`, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', alignItems: 'center', fontSize: '0.8rem' }}>
                <div style={{ color: C.transfer, fontWeight: 600 }}>{g.label}</div>
                <div style={{ color: C.muted }}>K{g.min_kingdom}–K{g.max_kingdom}</div>
                <div style={{ color: '#fff', fontWeight: 600 }}>{transferResult.group_counts?.[g.label] || 0}</div>
              </div>
            ))}
          </div>
        )}
        <InfoBox color={C.transfer} items={[
          'Transfer group roles are created and managed by the Discord bot (not the API)',
          'Bot syncs every 30 minutes — roles are named "Transfer K1-K6" etc.',
          'Users with multiple kingdoms (alt accounts) get all applicable group roles',
          'The "Check Transfer Groups" button shows current distribution',
          'To force a full sync, restart the Discord bot on Render',
        ]} />
      </>)}
    </div>
  );
};

// Reusable user table component
interface Column {
  key: string;
  label: string;
  render: (user: RoleUser) => React.ReactNode;
}

const UserTable: React.FC<{
  users: RoleUser[];
  columns: Column[];
  syncAction?: (userId: string) => void;
  syncingUser?: string | null;
  syncColor?: string;
}> = ({ users, columns, syncAction, syncingUser, syncColor = C.primary }) => {
  const cols = syncAction ? [...columns, { key: '_action', label: 'Action', render: () => null as unknown as React.ReactNode }] : columns;
  const gridCols = cols.map(c => c.key === '_action' ? 'auto' : '1fr').join(' ');

  return (
    <div style={{ backgroundColor: C.bg, border: `1px solid ${C.border}`, borderRadius: '8px', overflow: 'hidden' }}>
      <div style={{ padding: '0.6rem 1rem', borderBottom: `1px solid ${C.border}`, display: 'grid', gridTemplateColumns: gridCols, gap: '0.75rem', fontSize: '0.7rem', textTransform: 'uppercase', color: C.muted, fontWeight: 600 }}>
        {cols.map(c => <div key={c.key}>{c.label}</div>)}
      </div>
      {users.length === 0 ? (
        <div style={{ padding: '1.5rem', textAlign: 'center', color: C.muted, fontSize: '0.85rem' }}>No users found</div>
      ) : (
        users.map((user, i) => (
          <div key={user.id || user.user_id || i} style={{ padding: '0.55rem 1rem', borderBottom: `1px solid ${C.border}`, display: 'grid', gridTemplateColumns: gridCols, gap: '0.75rem', alignItems: 'center', fontSize: '0.8rem' }}>
            {columns.map(c => <div key={c.key} style={{ color: '#fff' }}>{c.render(user)}</div>)}
            {syncAction && (
              <div>
                <button
                  onClick={() => syncAction(user.id)}
                  disabled={syncingUser === user.id}
                  style={{
                    padding: '0.2rem 0.5rem',
                    backgroundColor: syncingUser === user.id ? C.muted : `${syncColor}20`,
                    color: syncColor,
                    border: `1px solid ${syncColor}40`,
                    borderRadius: '4px',
                    cursor: syncingUser === user.id ? 'wait' : 'pointer',
                    fontSize: '0.7rem',
                  }}
                >
                  {syncingUser === user.id ? '...' : 'Sync'}
                </button>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
};

// Info box
const InfoBox: React.FC<{ color: string; items: string[] }> = ({ color, items }) => (
  <div style={{ marginTop: '1.25rem', padding: '0.75rem 1rem', backgroundColor: `${color}08`, border: `1px solid ${color}25`, borderRadius: '8px', fontSize: '0.8rem', color: C.muted }}>
    <strong style={{ color }}>ℹ️ How it works:</strong>
    <ul style={{ margin: '0.4rem 0 0', paddingLeft: '1.25rem', lineHeight: 1.7 }}>
      {items.map((item, i) => <li key={i}>{item}</li>)}
    </ul>
  </div>
);

export default DiscordRolesDashboard;
