import React, { useState, useEffect } from 'react';
import { colors } from '../../utils/styles';
import {
  KingdomFund,
  TransferProfile,
  AuditLogEntry,
  TIER_COLORS,
} from './transferHubTypes';
import { actionBtn } from './TransferHubSubTabs';

// =============================================
// FUNDS TAB
// =============================================

export interface FundsTabProps {
  funds: KingdomFund[];
  timeAgo: (d: string | null) => string;
  onGrantTier: (fundId: string, kingdomNumber: number, tier: string) => void;
  onRevokeTier: (fundId: string) => void;
  onGrantNewKingdom: (kingdomNumber: number, tier: string) => void;
  onAddFunds: (kingdomNumber: number, amount: number) => Promise<void>;
  actionLoading: string | null;
}

export const FundsTab: React.FC<FundsTabProps> = ({ funds, timeAgo, onGrantTier, onRevokeTier, onGrantNewKingdom, onAddFunds, actionLoading }) => {
  const [grantKingdom, setGrantKingdom] = useState('');
  const [grantTier, setGrantTier] = useState('gold');
  const [showGrantForm, setShowGrantForm] = useState(false);
  const [showAddFundsForm, setShowAddFundsForm] = useState(false);
  const [addFundsKingdom, setAddFundsKingdom] = useState('');
  const [addFundsAmount, setAddFundsAmount] = useState('');
  const [addingFunds, setAddingFunds] = useState(false);

  const totalBalance = funds.reduce((sum, f) => sum + parseFloat(f.balance || '0'), 0);
  const totalContributed = funds.reduce((sum, f) => sum + parseFloat(f.total_contributed || '0'), 0);
  const overrideCount = funds.filter(f => f.admin_tier_override).length;

  const handleGrantNew = () => {
    const kn = parseInt(grantKingdom, 10);
    if (isNaN(kn) || kn <= 0) return;
    onGrantNewKingdom(kn, grantTier);
    setGrantKingdom('');
    setShowGrantForm(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem' }}>
        <div style={{ backgroundColor: colors.cardAlt, padding: '0.75rem', borderRadius: '10px', border: `1px solid ${colors.border}`, textAlign: 'center' }}>
          <div style={{ color: colors.success, fontWeight: 700, fontSize: '1.25rem' }}>${totalBalance.toFixed(2)}</div>
          <div style={{ color: colors.textMuted, fontSize: '0.7rem' }}>Current Balance</div>
        </div>
        <div style={{ backgroundColor: colors.cardAlt, padding: '0.75rem', borderRadius: '10px', border: `1px solid ${colors.border}`, textAlign: 'center' }}>
          <div style={{ color: colors.purple, fontWeight: 700, fontSize: '1.25rem' }}>${totalContributed.toFixed(2)}</div>
          <div style={{ color: colors.textMuted, fontSize: '0.7rem' }}>All-Time Contributed</div>
        </div>
        <div style={{ backgroundColor: colors.cardAlt, padding: '0.75rem', borderRadius: '10px', border: `1px solid ${colors.border}`, textAlign: 'center' }}>
          <div style={{ color: colors.gold, fontWeight: 700, fontSize: '1.25rem' }}>{funds.length}</div>
          <div style={{ color: colors.textMuted, fontSize: '0.7rem' }}>Kingdoms with Funds</div>
        </div>
        <div style={{ backgroundColor: colors.cardAlt, padding: '0.75rem', borderRadius: '10px', border: `1px solid ${colors.border}`, textAlign: 'center' }}>
          <div style={{ color: colors.primary, fontWeight: 700, fontSize: '1.25rem' }}>{overrideCount}</div>
          <div style={{ color: colors.textMuted, fontSize: '0.7rem' }}>Admin Tier Overrides</div>
        </div>
      </div>

      {/* Grant Tier to Kingdom */}
      <div style={{
        backgroundColor: colors.cardAlt,
        borderRadius: '10px',
        border: `1px solid ${colors.gold}30`,
        padding: '0.75rem 1rem',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem' }}>👑</span>
            <span style={{ color: colors.gold, fontWeight: 600, fontSize: '0.8rem' }}>Grant Tier to Kingdom</span>
          </div>
          <button
            onClick={() => setShowGrantForm(!showGrantForm)}
            style={{
              padding: '0.3rem 0.7rem',
              backgroundColor: showGrantForm ? `${colors.error}15` : `${colors.gold}15`,
              border: `1px solid ${showGrantForm ? `${colors.error}40` : `${colors.gold}40`}`,
              borderRadius: '6px',
              color: showGrantForm ? colors.error : colors.gold,
              fontSize: '0.7rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {showGrantForm ? 'Cancel' : '+ Grant Tier'}
          </button>
        </div>

        {showGrantForm && (
          <div style={{
            display: 'flex',
            gap: '0.5rem',
            marginTop: '0.75rem',
            alignItems: 'center',
            flexWrap: 'wrap',
          }}>
            <input
              type="number"
              placeholder="Kingdom #"
              value={grantKingdom}
              onChange={e => setGrantKingdom(e.target.value)}
              style={{
                padding: '0.4rem 0.6rem',
                backgroundColor: colors.bg,
                border: `1px solid ${colors.border}`,
                borderRadius: '6px',
                color: colors.text,
                fontSize: '0.8rem',
                width: '100px',
              }}
            />
            <select
              value={grantTier}
              onChange={e => setGrantTier(e.target.value)}
              style={{
                padding: '0.4rem 0.6rem',
                backgroundColor: colors.bg,
                border: `1px solid ${colors.border}`,
                borderRadius: '6px',
                color: colors.text,
                fontSize: '0.8rem',
              }}
            >
              <option value="gold">Gold</option>
              <option value="silver">Silver</option>
              <option value="bronze">Bronze</option>
            </select>
            <button
              onClick={handleGrantNew}
              disabled={!grantKingdom || actionLoading === 'new-kingdom'}
              style={{
                padding: '0.4rem 0.8rem',
                backgroundColor: `${colors.gold}20`,
                border: `1px solid ${colors.gold}50`,
                borderRadius: '6px',
                color: colors.gold,
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: !grantKingdom ? 'not-allowed' : 'pointer',
                opacity: !grantKingdom ? 0.5 : 1,
              }}
            >
              {actionLoading === 'new-kingdom' ? 'Granting...' : 'Grant'}
            </button>
            <span style={{ color: colors.textMuted, fontSize: '0.65rem' }}>
              Creates fund entry if needed. Override persists through depletion cycles.
            </span>
          </div>
        )}
      </div>

      {/* Add Funds to Kingdom */}
      <div style={{
        backgroundColor: colors.cardAlt,
        borderRadius: '10px',
        border: `1px solid ${colors.success}30`,
        padding: '0.75rem 1rem',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem' }}>💰</span>
            <span style={{ color: colors.success, fontWeight: 600, fontSize: '0.8rem' }}>Add Funds to Kingdom</span>
          </div>
          <button
            onClick={() => setShowAddFundsForm(!showAddFundsForm)}
            style={{
              padding: '0.3rem 0.7rem',
              backgroundColor: showAddFundsForm ? `${colors.error}15` : `${colors.success}15`,
              border: `1px solid ${showAddFundsForm ? `${colors.error}40` : `${colors.success}40`}`,
              borderRadius: '6px',
              color: showAddFundsForm ? colors.error : colors.success,
              fontSize: '0.7rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {showAddFundsForm ? 'Cancel' : '+ Add Funds'}
          </button>
        </div>

        {showAddFundsForm && (
          <div style={{
            display: 'flex',
            gap: '0.5rem',
            marginTop: '0.75rem',
            alignItems: 'center',
            flexWrap: 'wrap',
          }}>
            <input
              type="number"
              placeholder="Kingdom #"
              value={addFundsKingdom}
              onChange={e => setAddFundsKingdom(e.target.value)}
              style={{
                padding: '0.4rem 0.6rem',
                backgroundColor: colors.bg,
                border: `1px solid ${colors.border}`,
                borderRadius: '6px',
                color: colors.text,
                fontSize: '0.8rem',
                width: '100px',
              }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <span style={{ color: colors.success, fontWeight: 600, fontSize: '0.9rem' }}>$</span>
              <input
                type="number"
                placeholder="Amount"
                value={addFundsAmount}
                onChange={e => setAddFundsAmount(e.target.value)}
                min="0"
                step="5"
                style={{
                  padding: '0.4rem 0.6rem',
                  backgroundColor: colors.bg,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '6px',
                  color: colors.text,
                  fontSize: '0.8rem',
                  width: '100px',
                }}
              />
            </div>
            <button
              onClick={async () => {
                const kn = parseInt(addFundsKingdom, 10);
                const amt = parseFloat(addFundsAmount);
                if (isNaN(kn) || kn <= 0 || isNaN(amt) || amt <= 0) return;
                setAddingFunds(true);
                await onAddFunds(kn, amt);
                setAddingFunds(false);
                setAddFundsKingdom('');
                setAddFundsAmount('');
                setShowAddFundsForm(false);
              }}
              disabled={!addFundsKingdom || !addFundsAmount || addingFunds || actionLoading === 'add-funds'}
              style={{
                padding: '0.4rem 0.8rem',
                backgroundColor: `${colors.success}20`,
                border: `1px solid ${colors.success}50`,
                borderRadius: '6px',
                color: colors.success,
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: (!addFundsKingdom || !addFundsAmount) ? 'not-allowed' : 'pointer',
                opacity: (!addFundsKingdom || !addFundsAmount) ? 0.5 : 1,
              }}
            >
              {addingFunds ? 'Adding...' : 'Add Funds'}
            </button>
            <span style={{ color: colors.textMuted, fontSize: '0.65rem' }}>
              Increases balance & total contributed. Tier auto-updates based on new balance.
            </span>
          </div>
        )}
      </div>

      {/* Fund List */}
      {funds.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: colors.textMuted }}>No kingdom funds yet. Use &quot;Grant Tier&quot; above to add one.</div>
      ) : funds.map(fund => {
        const displayTier = fund.admin_tier_override || fund.tier;
        const tc = TIER_COLORS[displayTier] ?? { bg: `${colors.textMuted}15`, border: `${colors.textMuted}40`, text: colors.textMuted };
        const balance = parseFloat(fund.balance || '0');
        const contributed = parseFloat(fund.total_contributed || '0');
        const isOverridden = !!fund.admin_tier_override;
        const isLoading = actionLoading === fund.id;

        return (
          <div key={fund.id} style={{
            backgroundColor: colors.cardAlt,
            borderRadius: '10px',
            border: `1px solid ${isOverridden ? `${colors.gold}40` : tc.border}`,
            padding: '1rem',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span style={{ color: colors.text, fontWeight: 700, fontSize: '1rem' }}>K{fund.kingdom_number}</span>
                <span style={{
                  padding: '0.1rem 0.5rem',
                  backgroundColor: tc.bg,
                  border: `1px solid ${tc.border}`,
                  borderRadius: '4px',
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  color: tc.text,
                  textTransform: 'uppercase',
                }}>
                  {displayTier}
                </span>
                {isOverridden && (
                  <span style={{
                    padding: '0.1rem 0.4rem',
                    backgroundColor: `${colors.gold}10`,
                    border: `1px solid ${colors.gold}30`,
                    borderRadius: '4px',
                    fontSize: '0.6rem',
                    fontWeight: 600,
                    color: colors.gold,
                  }}>
                    ADMIN OVERRIDE
                  </span>
                )}
                {fund.is_recruiting && (
                  <span style={{
                    padding: '0.1rem 0.4rem',
                    backgroundColor: `${colors.success}15`,
                    border: `1px solid ${colors.success}40`,
                    borderRadius: '4px',
                    fontSize: '0.65rem',
                    fontWeight: 600,
                    color: colors.success,
                  }}>
                    Recruiting
                  </span>
                )}
                {fund.atlas_score && (
                  <span style={{ color: colors.primary, fontSize: '0.75rem', fontWeight: 600 }}>
                    💎 {parseFloat(fund.atlas_score).toFixed(1)}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {/* Tier Action Buttons */}
                {isOverridden ? (
                  <button
                    onClick={() => onRevokeTier(fund.id)}
                    disabled={isLoading}
                    style={actionBtn(`${colors.error}15`, `${colors.error}40`, colors.error, isLoading)}
                  >
                    {isLoading ? '...' : 'Revoke Override'}
                  </button>
                ) : (
                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                    {['gold', 'silver', 'bronze'].map(t => {
                      const tColors = TIER_COLORS[t] ?? { bg: '#6b728015', border: '#6b728040', text: '#6b7280' };
                      return (
                        <button
                          key={t}
                          onClick={() => onGrantTier(fund.id, fund.kingdom_number, t)}
                          disabled={isLoading || fund.tier === t}
                          style={{
                            ...actionBtn(tColors.bg, tColors.border, tColors.text, isLoading || fund.tier === t),
                            textTransform: 'capitalize',
                          }}
                        >
                          {t}
                        </button>
                      );
                    })}
                  </div>
                )}
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: colors.success, fontWeight: 700, fontSize: '1.1rem' }}>
                    ${balance.toFixed(2)}
                  </div>
                  <div style={{ color: colors.textMuted, fontSize: '0.65rem' }}>current balance</div>
                </div>
              </div>
            </div>

            {/* Details Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.5rem', marginTop: '0.5rem', fontSize: '0.75rem' }}>
              <div>
                <span style={{ color: colors.textMuted }}>All-time: </span>
                <span style={{ color: colors.purple, fontWeight: 600 }}>${contributed.toFixed(2)}</span>
              </div>
              <div>
                <span style={{ color: colors.textMuted }}>Contributors: </span>
                <span style={{ color: colors.text }}>{fund.contributor_count}</span>
              </div>
              {fund.main_language && (
                <div>
                  <span style={{ color: colors.textMuted }}>Language: </span>
                  <span style={{ color: colors.text }}>{fund.main_language}</span>
                </div>
              )}
              {fund.min_tc_level && (
                <div>
                  <span style={{ color: colors.textMuted }}>Min TC: </span>
                  <span style={{ color: colors.text }}>{fund.min_tc_level}</span>
                </div>
              )}
              {fund.min_power_million && (
                <div>
                  <span style={{ color: colors.textMuted }}>Min Power: </span>
                  <span style={{ color: colors.text }}>{fund.min_power_million}M</span>
                </div>
              )}
            </div>

            {fund.recruitment_pitch && (
              <div style={{
                marginTop: '0.5rem',
                padding: '0.5rem 0.75rem',
                backgroundColor: colors.bg,
                borderRadius: '6px',
                fontSize: '0.75rem',
                color: colors.textSecondary,
                fontStyle: 'italic',
                borderLeft: `2px solid ${tc.text}`,
              }}>
                {fund.recruitment_pitch}
              </div>
            )}

            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', fontSize: '0.65rem', color: colors.textMuted }}>
              <span>Created {timeAgo(fund.created_at)}</span>
              <span>Updated {timeAgo(fund.updated_at)}</span>
              {fund.last_depletion_at && <span>Last depletion {timeAgo(fund.last_depletion_at)}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// =============================================
// PROFILES TAB
// =============================================

export const ProfilesTab: React.FC<{ profiles: TransferProfile[]; timeAgo: (d: string | null) => string }> = ({ profiles, timeAgo }) => {
  const [search, setSearch] = useState('');

  const filtered = search
    ? profiles.filter(p =>
        p.username.toLowerCase().includes(search.toLowerCase()) ||
        (p.profile_username || '').toLowerCase().includes(search.toLowerCase()) ||
        String(p.current_kingdom).includes(search)
      )
    : profiles;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {/* Search + Summary */}
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Search by username or kingdom..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            padding: '0.5rem 0.75rem',
            backgroundColor: colors.cardAlt,
            border: `1px solid ${colors.border}`,
            borderRadius: '8px',
            color: colors.text,
            fontSize: '0.8rem',
            flex: 1,
            minWidth: '200px',
          }}
        />
        <span style={{ color: colors.textMuted, fontSize: '0.75rem' }}>
          {filtered.length} profile{filtered.length !== 1 ? 's' : ''} · {profiles.filter(p => p.is_active).length} active
        </span>
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: colors.textMuted }}>
          {search ? 'No profiles match your search' : 'No transfer profiles yet'}
        </div>
      ) : (
        filtered.map(profile => (
          <div key={profile.id} style={{
            backgroundColor: colors.cardAlt,
            borderRadius: '10px',
            border: `1px solid ${colors.border}`,
            padding: '1rem',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <span style={{ color: colors.text, fontWeight: 600, fontSize: '0.9rem' }}>
                    {profile.is_anonymous ? '(Anonymous)' : (profile.profile_username || profile.username)}
                  </span>
                  <span style={{
                    padding: '0.1rem 0.4rem',
                    backgroundColor: profile.is_active ? `${colors.success}15` : `${colors.error}15`,
                    border: `1px solid ${profile.is_active ? `${colors.success}40` : `${colors.error}40`}`,
                    borderRadius: '4px',
                    fontSize: '0.65rem',
                    fontWeight: 600,
                    color: profile.is_active ? colors.success : colors.error,
                  }}>
                    {profile.is_active ? 'Active' : 'Inactive'}
                  </span>
                  {profile.is_anonymous && (
                    <span style={{
                      padding: '0.1rem 0.4rem',
                      backgroundColor: `${colors.textMuted}15`,
                      border: `1px solid ${colors.textMuted}40`,
                      borderRadius: '4px',
                      fontSize: '0.65rem',
                      color: colors.textMuted,
                    }}>
                      Anonymous
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.7rem', color: colors.textMuted, flexWrap: 'wrap' }}>
                  <span>From <strong style={{ color: colors.primary }}>K{profile.current_kingdom}</strong></span>
                  <span>TC{profile.tc_level > 30 ? '30+' : profile.tc_level}</span>
                  {profile.power_million && <span>{profile.power_million}M power</span>}
                  <span>{profile.main_language}</span>
                  <span>Group: {profile.group_size}</span>
                </div>
              </div>
              <div style={{ textAlign: 'right', fontSize: '0.65rem', color: colors.textMuted }}>
                <div>Last active {timeAgo(profile.last_active_at)}</div>
                <div>Created {timeAgo(profile.created_at)}</div>
              </div>
            </div>

            {/* Looking For Tags */}
            {profile.looking_for && profile.looking_for.length > 0 && (
              <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                {profile.looking_for.map(tag => (
                  <span key={tag} style={{
                    padding: '0.1rem 0.4rem',
                    backgroundColor: `${colors.blue}15`,
                    border: `1px solid ${colors.blue}30`,
                    borderRadius: '4px',
                    fontSize: '0.6rem',
                    color: colors.blue,
                  }}>
                    {tag.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            )}

            {profile.player_bio && (
              <div style={{
                marginTop: '0.5rem',
                padding: '0.5rem 0.75rem',
                backgroundColor: colors.bg,
                borderRadius: '6px',
                fontSize: '0.75rem',
                color: colors.textSecondary,
                fontStyle: 'italic',
              }}>
                {profile.player_bio}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
};

// =============================================
// AUDIT LOG TAB
// =============================================

const ACTION_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  activate: { label: 'Activated', color: colors.success, icon: '✅' },
  suspend: { label: 'Suspended', color: colors.error, icon: '⏸️' },
  remove: { label: 'Removed', color: colors.error, icon: '🗑️' },
  promote: { label: 'Promoted', color: colors.purple, icon: '⬆️' },
  bulk_deactivate: { label: 'Bulk Deactivated', color: '#f97316', icon: '📦' },
  approve: { label: 'Approved', color: colors.success, icon: '✓' },
  reject: { label: 'Rejected', color: colors.error, icon: '✕' },
  self_nominate: { label: 'Self-Nominated', color: '#eab308', icon: '🙋' },
  invite: { label: 'Invited', color: colors.blue, icon: '✉️' },
  expire: { label: 'Expired', color: colors.textMuted, icon: '⏰' },
  cascade_delete: { label: 'Cascade Deleted', color: colors.textMuted, icon: '🔗' },
};

export const AuditLogTab: React.FC<{
  entries: AuditLogEntry[];
  timeAgo: (d: string | null) => string;
  loading: boolean;
  onRefresh: () => void;
}> = ({ entries, timeAgo, loading, onRefresh }) => {
  const [filter, setFilter] = useState<string>('all');

  // Lazy-load audit log on first render
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (!loaded) {
      onRefresh();
      setLoaded(true);
    }
  }, [loaded, onRefresh]);

  const filtered = filter === 'all' ? entries : entries.filter(e => e.action === filter);
  const actionTypes = [...new Set(entries.map(e => e.action))];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {/* Header + Filters */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ color: colors.text, fontSize: '0.9rem', fontWeight: '600' }}>📋 Audit Log</span>
          <span style={{ color: colors.textMuted, fontSize: '0.7rem' }}>({filtered.length} entries)</span>
        </div>
        <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => setFilter('all')}
            style={{
              padding: '0.2rem 0.5rem',
              backgroundColor: filter === 'all' ? `${colors.purple}20` : 'transparent',
              color: filter === 'all' ? colors.purple : colors.textMuted,
              border: filter === 'all' ? `1px solid ${colors.purple}40` : `1px solid ${colors.border}`,
              borderRadius: '4px',
              fontSize: '0.65rem',
              cursor: 'pointer',
            }}
          >
            All
          </button>
          {actionTypes.map(action => {
            const meta = ACTION_LABELS[action] || { label: action, color: colors.textMuted, icon: '•' };
            return (
              <button
                key={action}
                onClick={() => setFilter(action)}
                style={{
                  padding: '0.2rem 0.5rem',
                  backgroundColor: filter === action ? `${meta.color}20` : 'transparent',
                  color: filter === action ? meta.color : colors.textMuted,
                  border: filter === action ? `1px solid ${meta.color}40` : `1px solid ${colors.border}`,
                  borderRadius: '4px',
                  fontSize: '0.65rem',
                  cursor: 'pointer',
                }}
              >
                {meta.icon} {meta.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Entries */}
      {loading && entries.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: colors.textMuted }}>Loading audit log...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: colors.textMuted, fontSize: '0.8rem' }}>
          No audit log entries{filter !== 'all' ? ` for "${filter}"` : ''}.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          {filtered.map(entry => {
            const meta = ACTION_LABELS[entry.action] || { label: entry.action, color: colors.textMuted, icon: '•' };
            return (
              <div key={entry.id} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.6rem 0.75rem',
                backgroundColor: colors.cardAlt,
                borderRadius: '8px',
                border: `1px solid ${colors.surfaceHover}`,
                fontSize: '0.75rem',
              }}>
                {/* Action badge */}
                <span style={{
                  padding: '0.15rem 0.4rem',
                  backgroundColor: `${meta.color}15`,
                  border: `1px solid ${meta.color}30`,
                  borderRadius: '4px',
                  color: meta.color,
                  fontSize: '0.6rem',
                  fontWeight: '600',
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                  minWidth: '80px',
                  textAlign: 'center',
                }}>
                  {meta.icon} {meta.label}
                </span>

                {/* Details */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: colors.textSecondary, fontSize: '0.75rem' }}>
                    <span style={{ color: colors.primary, fontWeight: '500' }}>{entry.performer_name}</span>
                    {' → '}
                    <span style={{ color: colors.text, fontWeight: '500' }}>{entry.target_name}</span>
                  </div>
                  <div style={{ color: colors.textMuted, fontSize: '0.65rem', marginTop: '0.1rem' }}>
                    K{entry.kingdom_number}
                    {entry.details?.source ? <> · {String(entry.details.source).replace(/_/g, ' ')}</> : null}
                    {entry.details?.reason ? <> · {String(entry.details.reason).replace(/_/g, ' ')}</> : null}
                  </div>
                </div>

                {/* Time */}
                <span style={{ color: colors.textMuted, fontSize: '0.6rem', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {timeAgo(entry.created_at)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
