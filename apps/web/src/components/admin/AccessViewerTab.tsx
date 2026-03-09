import React, { useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { colors } from '../../utils/styles';
import { logger } from '../../utils/logger';

// ─── Role category definitions ─────────────────────────────────────────
const ROLE_CATEGORIES = [
  { id: 'kingdom_editors', label: 'Kingdom Editors', icon: '✏️', color: '#22d3ee', description: 'Can edit kingdom profile data' },
  { id: 'battle_registry_managers', label: 'Battle Registry Managers', icon: '📋', color: '#f97316', description: 'Can manage KvK battle registry entries' },
  { id: 'prep_schedule_managers', label: 'Prep Schedule Managers', icon: '📅', color: '#3b82f6', description: 'Can manage prep day schedules' },
  { id: 'battle_managers', label: 'Battle Managers', icon: '⚔️', color: '#ef4444', description: 'Assigned for battle coordination' },
  { id: 'tool_access', label: 'Tool Access (Gated)', icon: '🔑', color: '#a855f7', description: 'Admin-granted access to gated tools' },
  { id: 'tool_delegates', label: 'Tool Delegates', icon: '🤝', color: '#22c55e', description: 'User-to-user delegation of tool access' },
  { id: 'alliance_managers', label: 'Alliance Managers', icon: '🏰', color: '#eab308', description: 'Can manage alliance settings' },
] as const;

interface RoleEntry {
  category: string;
  user_id: string;
  username: string;
  linked_kingdom: number | null;
  linked_tc_level: number | null;
  avatar_url: string | null;
  role_detail: string;
  created_at: string | null;
}

export const AccessViewerTab: React.FC = () => {
  const [kingdomSearch, setKingdomSearch] = useState('');
  const [usernameSearch, setUsernameSearch] = useState('');
  const [results, setResults] = useState<RoleEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchedValue, setSearchedValue] = useState('');
  const [searchMode, setSearchMode] = useState<'kingdom' | 'username'>('kingdom');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(ROLE_CATEGORIES.map(c => c.id)));

  const toggleCategory = (id: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const enrichWithProfiles = useCallback(async (userIds: string[]): Promise<Map<string, { username: string; linked_kingdom: number | null; linked_tc_level: number | null; avatar_url: string | null }>> => {
    if (!supabase || userIds.length === 0) return new Map();
    const unique = [...new Set(userIds)];
    const { data } = await supabase
      .from('profiles')
      .select('id, username, linked_username, linked_kingdom, linked_tc_level, linked_avatar_url')
      .in('id', unique);
    const map = new Map<string, { username: string; linked_kingdom: number | null; linked_tc_level: number | null; avatar_url: string | null }>();
    (data || []).forEach(p => {
      map.set(p.id, {
        username: p.linked_username || p.username || 'Unknown',
        linked_kingdom: p.linked_kingdom,
        linked_tc_level: p.linked_tc_level,
        avatar_url: p.linked_avatar_url,
      });
    });
    return map;
  }, []);

  const searchByKingdom = useCallback(async (kd: number) => {
    if (!supabase) return;
    setLoading(true);
    setResults([]);
    setSearchedValue(`Kingdom ${kd}`);
    try {
      // Run all queries in parallel
      const [editorsRes, brmRes, psmRes, bmRes, taRes, tdRes, amRes] = await Promise.all([
        // 1. Kingdom editors
        supabase.from('kingdom_editors').select('user_id, role, status, created_at').eq('kingdom_number', kd),
        // 2. Battle registry managers (via registry)
        supabase.from('battle_registries').select('id').eq('kingdom_number', kd).limit(1),
        // 3. Prep schedule managers (via schedule)
        supabase.from('prep_schedules').select('id').eq('kingdom_number', kd),
        // 4. Battle managers
        supabase.from('battle_managers').select('user_id, created_at').eq('kingdom_number', kd),
        // 5. Tool access (users from this kingdom)
        supabase.from('profiles').select('id').eq('linked_kingdom', kd).not('linked_player_id', 'is', null),
        // 6. Tool delegates (users from this kingdom)
        supabase.from('profiles').select('id').eq('linked_kingdom', kd).not('linked_player_id', 'is', null),
        // 7. Alliance managers (via alliances with this kingdom)
        supabase.from('alliances').select('id').eq('kingdom_number', kd),
      ]);

      const allEntries: RoleEntry[] = [];
      const allUserIds: string[] = [];

      // Collect user IDs from editors
      const editors = editorsRes.data || [];
      editors.forEach(e => allUserIds.push(e.user_id));

      // Battle registry managers
      let brmData: { user_id: string; assigned_by: string | null; created_at: string }[] = [];
      const firstReg = brmRes.data?.[0];
      if (firstReg) {
        const regId = firstReg.id;
        const { data: mgrs } = await supabase.from('battle_registry_managers').select('user_id, assigned_by, created_at').eq('registry_id', regId);
        brmData = mgrs || [];
        brmData.forEach(m => allUserIds.push(m.user_id));
      }

      // Prep schedule managers
      let psmData: { user_id: string; schedule_id: string; assigned_at: string }[] = [];
      const schedules = psmRes.data || [];
      if (schedules.length > 0) {
        const scheduleIds = schedules.map(s => s.id);
        const { data: mgrs } = await supabase.from('prep_schedule_managers').select('user_id, schedule_id, assigned_at').in('schedule_id', scheduleIds);
        psmData = mgrs || [];
        psmData.forEach(m => allUserIds.push(m.user_id));
      }

      // Battle managers
      const bms = bmRes.data || [];
      bms.forEach(b => allUserIds.push(b.user_id));

      // Tool access — filter tool_access by users in this kingdom
      const kdProfileIds = (taRes.data || []).map(p => p.id);
      let taData: { user_id: string; tool: string; created_at: string }[] = [];
      if (kdProfileIds.length > 0) {
        const { data: tas } = await supabase.from('tool_access').select('user_id, tool, created_at').in('user_id', kdProfileIds);
        taData = tas || [];
        taData.forEach(t => allUserIds.push(t.user_id));
      }

      // Tool delegates — filter by users in this kingdom
      const kdProfileIds2 = (tdRes.data || []).map(p => p.id);
      let tdDataOwner: { owner_id: string; delegate_id: string; created_at: string }[] = [];
      let tdDataDelegate: { owner_id: string; delegate_id: string; created_at: string }[] = [];
      if (kdProfileIds2.length > 0) {
        const [ownerRes, delegateRes] = await Promise.all([
          supabase.from('tool_delegates').select('owner_id, delegate_id, created_at').in('owner_id', kdProfileIds2),
          supabase.from('tool_delegates').select('owner_id, delegate_id, created_at').in('delegate_id', kdProfileIds2),
        ]);
        tdDataOwner = ownerRes.data || [];
        tdDataDelegate = delegateRes.data || [];
        [...tdDataOwner, ...tdDataDelegate].forEach(t => { allUserIds.push(t.owner_id); allUserIds.push(t.delegate_id); });
      }

      // Alliance managers
      let amData: { user_id: string; alliance_id: string; created_at: string }[] = [];
      const alliances = amRes.data || [];
      if (alliances.length > 0) {
        const allianceIds = alliances.map(a => a.id);
        const { data: mgrs } = await supabase.from('alliance_managers').select('user_id, alliance_id, created_at').in('alliance_id', allianceIds);
        amData = mgrs || [];
        amData.forEach(m => allUserIds.push(m.user_id));
      }

      // Enrich all user IDs with profile data
      const profileMap = await enrichWithProfiles(allUserIds);
      const getProfile = (uid: string) => profileMap.get(uid) || { username: 'Unknown', linked_kingdom: null, linked_tc_level: null, avatar_url: null };

      // Build entries
      editors.forEach(e => {
        const p = getProfile(e.user_id);
        allEntries.push({ category: 'kingdom_editors', user_id: e.user_id, ...p, role_detail: `${e.role || 'editor'} (${e.status || 'active'})`, created_at: e.created_at });
      });

      brmData.forEach(m => {
        const p = getProfile(m.user_id);
        allEntries.push({ category: 'battle_registry_managers', user_id: m.user_id, ...p, role_detail: 'Registry Manager', created_at: m.created_at });
      });

      psmData.forEach(m => {
        const p = getProfile(m.user_id);
        allEntries.push({ category: 'prep_schedule_managers', user_id: m.user_id, ...p, role_detail: 'Schedule Manager', created_at: m.assigned_at });
      });

      bms.forEach(b => {
        const p = getProfile(b.user_id);
        allEntries.push({ category: 'battle_managers', user_id: b.user_id, ...p, role_detail: 'Battle Manager', created_at: b.created_at });
      });

      taData.forEach(t => {
        const p = getProfile(t.user_id);
        const toolLabel = t.tool.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
        allEntries.push({ category: 'tool_access', user_id: t.user_id, ...p, role_detail: toolLabel, created_at: t.created_at });
      });

      // Deduplicate delegates
      const seenDelegates = new Set<string>();
      [...tdDataOwner, ...tdDataDelegate].forEach(t => {
        const key = `${t.owner_id}-${t.delegate_id}`;
        if (seenDelegates.has(key)) return;
        seenDelegates.add(key);
        const owner = getProfile(t.owner_id);
        const delegate = getProfile(t.delegate_id);
        allEntries.push({ category: 'tool_delegates', user_id: t.delegate_id, ...delegate, role_detail: `Delegate of ${owner.username}`, created_at: t.created_at });
      });

      amData.forEach(m => {
        const p = getProfile(m.user_id);
        allEntries.push({ category: 'alliance_managers', user_id: m.user_id, ...p, role_detail: 'Alliance Manager', created_at: m.created_at });
      });

      setResults(allEntries);
    } catch (err) {
      logger.error('Access viewer search failed:', err);
    } finally {
      setLoading(false);
    }
  }, [enrichWithProfiles]);

  const searchByUsername = useCallback(async (query: string) => {
    if (!supabase || query.trim().length < 2) return;
    setLoading(true);
    setResults([]);
    setSearchedValue(`"${query}"`);
    try {
      // Find matching profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, linked_username, linked_kingdom, linked_tc_level, linked_avatar_url')
        .or(`linked_username.ilike.%${query.trim()}%,username.ilike.%${query.trim()}%`)
        .limit(20);

      if (!profiles || profiles.length === 0) {
        setResults([]);
        setLoading(false);
        return;
      }

      const userIds = profiles.map(p => p.id);
      const profileMap = new Map(profiles.map(p => [p.id, {
        username: p.linked_username || p.username || 'Unknown',
        linked_kingdom: p.linked_kingdom,
        linked_tc_level: p.linked_tc_level,
        avatar_url: p.linked_avatar_url,
      }]));
      const getProfile = (uid: string) => profileMap.get(uid) || { username: 'Unknown', linked_kingdom: null, linked_tc_level: null, avatar_url: null };

      // Query all role tables in parallel for these user IDs
      const [editorsRes, brmRes, psmRes, bmRes, taRes, tdOwnerRes, tdDelegateRes, amRes] = await Promise.all([
        supabase.from('kingdom_editors').select('user_id, kingdom_number, role, status, created_at').in('user_id', userIds),
        supabase.from('battle_registry_managers').select('user_id, registry_id, created_at').in('user_id', userIds),
        supabase.from('prep_schedule_managers').select('user_id, schedule_id, assigned_at').in('user_id', userIds),
        supabase.from('battle_managers').select('user_id, kingdom_number, created_at').in('user_id', userIds),
        supabase.from('tool_access').select('user_id, tool, created_at').in('user_id', userIds),
        supabase.from('tool_delegates').select('owner_id, delegate_id, created_at').in('owner_id', userIds),
        supabase.from('tool_delegates').select('owner_id, delegate_id, created_at').in('delegate_id', userIds),
        supabase.from('alliance_managers').select('user_id, alliance_id, created_at').in('user_id', userIds),
      ]);

      // Also enrich delegate targets
      const extraIds: string[] = [];
      (tdOwnerRes.data || []).forEach(t => extraIds.push(t.delegate_id));
      (tdDelegateRes.data || []).forEach(t => extraIds.push(t.owner_id));
      const extraMap = await enrichWithProfiles(extraIds);
      const getAny = (uid: string) => profileMap.get(uid) || extraMap.get(uid) || { username: 'Unknown', linked_kingdom: null, linked_tc_level: null, avatar_url: null };

      const allEntries: RoleEntry[] = [];

      (editorsRes.data || []).forEach(e => {
        const p = getProfile(e.user_id);
        allEntries.push({ category: 'kingdom_editors', user_id: e.user_id, ...p, role_detail: `K${e.kingdom_number} · ${e.role || 'editor'} (${e.status || 'active'})`, created_at: e.created_at });
      });

      (brmRes.data || []).forEach(m => {
        const p = getProfile(m.user_id);
        allEntries.push({ category: 'battle_registry_managers', user_id: m.user_id, ...p, role_detail: 'Registry Manager', created_at: m.created_at });
      });

      (psmRes.data || []).forEach(m => {
        const p = getProfile(m.user_id);
        allEntries.push({ category: 'prep_schedule_managers', user_id: m.user_id, ...p, role_detail: 'Schedule Manager', created_at: m.assigned_at });
      });

      (bmRes.data || []).forEach(b => {
        const p = getProfile(b.user_id);
        allEntries.push({ category: 'battle_managers', user_id: b.user_id, ...p, role_detail: `K${b.kingdom_number} Battle Manager`, created_at: b.created_at });
      });

      (taRes.data || []).forEach(t => {
        const p = getProfile(t.user_id);
        const toolLabel = t.tool.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
        allEntries.push({ category: 'tool_access', user_id: t.user_id, ...p, role_detail: toolLabel, created_at: t.created_at });
      });

      const seenDelegates = new Set<string>();
      [...(tdOwnerRes.data || []), ...(tdDelegateRes.data || [])].forEach(t => {
        const key = `${t.owner_id}-${t.delegate_id}`;
        if (seenDelegates.has(key)) return;
        seenDelegates.add(key);
        const owner = getAny(t.owner_id);
        const delegate = getAny(t.delegate_id);
        // Show the entry for the user that matched the search
        if (profileMap.has(t.owner_id)) {
          allEntries.push({ category: 'tool_delegates', user_id: t.owner_id, ...owner, role_detail: `Delegated to ${delegate.username}`, created_at: t.created_at });
        }
        if (profileMap.has(t.delegate_id)) {
          allEntries.push({ category: 'tool_delegates', user_id: t.delegate_id, ...delegate, role_detail: `Delegate of ${owner.username}`, created_at: t.created_at });
        }
      });

      (amRes.data || []).forEach(m => {
        const p = getProfile(m.user_id);
        allEntries.push({ category: 'alliance_managers', user_id: m.user_id, ...p, role_detail: 'Alliance Manager', created_at: m.created_at });
      });

      setResults(allEntries);
    } catch (err) {
      logger.error('Access viewer username search failed:', err);
    } finally {
      setLoading(false);
    }
  }, [enrichWithProfiles]);

  const handleSearch = () => {
    if (searchMode === 'kingdom') {
      const kd = parseInt(kingdomSearch, 10);
      if (!isNaN(kd) && kd > 0) searchByKingdom(kd);
    } else {
      if (usernameSearch.trim().length >= 2) searchByUsername(usernameSearch.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return iso;
    }
  };

  const grouped = ROLE_CATEGORIES.map(cat => ({
    ...cat,
    entries: results.filter(r => r.category === cat.id),
  })).filter(g => g.entries.length > 0);

  const totalRoles = results.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header + Search */}
      <div style={{
        backgroundColor: colors.cardAlt, borderRadius: '12px', padding: '1.25rem',
        border: `1px solid ${colors.border}`,
      }}>
        <div style={{ marginBottom: '0.75rem' }}>
          <h3 style={{ color: colors.text, margin: 0, fontSize: '1rem' }}>🔍 Access Viewer</h3>
          <p style={{ color: colors.textMuted, fontSize: '0.8rem', margin: '0.25rem 0 0' }}>
            Look up all assigned roles, managers, delegates, and tool access — by kingdom or username.
          </p>
        </div>

        {/* Search Mode Toggle */}
        <div style={{ display: 'flex', gap: '0.35rem', marginBottom: '0.75rem' }}>
          {[
            { mode: 'kingdom' as const, label: '🏰 By Kingdom', placeholder: 'Enter kingdom number...' },
            { mode: 'username' as const, label: '👤 By Username', placeholder: 'Search by Kingshot username...' },
          ].map(m => (
            <button
              key={m.mode}
              onClick={() => setSearchMode(m.mode)}
              style={{
                padding: '0.35rem 0.75rem', borderRadius: '6px',
                border: `1px solid ${searchMode === m.mode ? '#22d3ee40' : colors.border}`,
                backgroundColor: searchMode === m.mode ? '#22d3ee15' : 'transparent',
                color: searchMode === m.mode ? '#22d3ee' : colors.textSecondary,
                fontSize: '0.8rem', fontWeight: 500, cursor: 'pointer',
              }}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            type={searchMode === 'kingdom' ? 'number' : 'text'}
            value={searchMode === 'kingdom' ? kingdomSearch : usernameSearch}
            onChange={e => searchMode === 'kingdom' ? setKingdomSearch(e.target.value) : setUsernameSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={searchMode === 'kingdom' ? 'Enter kingdom number (e.g. 172)...' : 'Search by Kingshot username...'}
            min={1}
            style={{
              flex: 1, padding: '0.6rem 0.75rem', backgroundColor: colors.bg,
              border: `1px solid ${colors.border}`, borderRadius: '8px', color: colors.text,
              fontSize: '0.85rem', outline: 'none',
            }}
          />
          <button
            onClick={handleSearch}
            disabled={loading || (searchMode === 'kingdom' ? !kingdomSearch : usernameSearch.trim().length < 2)}
            style={{
              padding: '0.6rem 1.25rem', backgroundColor: '#22d3ee', color: '#0a0a0a',
              border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '0.85rem',
              cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>
      </div>

      {/* Results */}
      {searchedValue && !loading && (
        <div style={{
          backgroundColor: colors.cardAlt, borderRadius: '12px', padding: '1.25rem',
          border: `1px solid ${colors.border}`,
        }}>
          {/* Summary */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h4 style={{ color: colors.text, margin: 0, fontSize: '0.95rem' }}>
              Results for {searchedValue}
            </h4>
            <div style={{
              padding: '0.2rem 0.6rem', backgroundColor: totalRoles > 0 ? '#22d3ee20' : '#ef444420',
              border: `1px solid ${totalRoles > 0 ? '#22d3ee40' : '#ef444440'}`, borderRadius: '20px',
              color: totalRoles > 0 ? '#22d3ee' : '#ef4444', fontSize: '0.75rem', fontWeight: 600,
            }}>
              {totalRoles} role{totalRoles !== 1 ? 's' : ''} found
            </div>
          </div>

          {totalRoles === 0 ? (
            <div style={{
              padding: '2rem', textAlign: 'center', color: colors.textMuted,
              fontSize: '0.85rem', border: `1px dashed ${colors.border}`, borderRadius: '8px',
            }}>
              No roles, managers, or delegates found for {searchedValue}.
              {searchMode === 'kingdom' && (
                <span style={{ display: 'block', marginTop: '0.5rem', fontSize: '0.75rem' }}>
                  This kingdom may not have any tool access, registries, or editors set up yet.
                </span>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {/* Category summary pills */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.25rem' }}>
                {grouped.map(g => (
                  <button
                    key={g.id}
                    onClick={() => toggleCategory(g.id)}
                    style={{
                      padding: '0.25rem 0.6rem', borderRadius: '6px',
                      backgroundColor: expandedCategories.has(g.id) ? `${g.color}15` : 'transparent',
                      border: `1px solid ${expandedCategories.has(g.id) ? g.color + '40' : colors.border}`,
                      color: expandedCategories.has(g.id) ? g.color : colors.textMuted,
                      fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: '0.3rem',
                    }}
                  >
                    <span>{g.icon}</span> {g.label}
                    <span style={{
                      backgroundColor: `${g.color}30`, padding: '0 0.25rem',
                      borderRadius: '4px', fontSize: '0.6rem', fontWeight: 700,
                    }}>
                      {g.entries.length}
                    </span>
                  </button>
                ))}
              </div>

              {/* Grouped results */}
              {grouped.map(group => expandedCategories.has(group.id) && (
                <div key={group.id} style={{
                  backgroundColor: colors.bg, borderRadius: '8px',
                  border: `1px solid ${group.color}25`, overflow: 'hidden',
                }}>
                  <div style={{
                    padding: '0.5rem 0.75rem',
                    backgroundColor: `${group.color}08`,
                    borderBottom: `1px solid ${group.color}20`,
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <span style={{ color: group.color, fontSize: '0.8rem', fontWeight: 700 }}>
                      {group.icon} {group.label}
                    </span>
                    <span style={{ color: colors.textMuted, fontSize: '0.65rem' }}>
                      {group.description}
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {group.entries.map((entry, i) => (
                      <div
                        key={`${entry.user_id}-${entry.role_detail}-${i}`}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '0.6rem',
                          padding: '0.5rem 0.75rem',
                          borderBottom: i < group.entries.length - 1 ? `1px solid ${colors.surfaceHover}` : 'none',
                        }}
                      >
                        {entry.avatar_url ? (
                          <img
                            src={entry.avatar_url} alt=""
                            referrerPolicy="no-referrer"
                            style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                          />
                        ) : (
                          <div style={{
                            width: '28px', height: '28px', borderRadius: '50%',
                            backgroundColor: colors.border, display: 'flex', alignItems: 'center',
                            justifyContent: 'center', flexShrink: 0, fontSize: '0.7rem',
                          }}>
                            👤
                          </div>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: '0.8rem', color: colors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {entry.username}
                          </div>
                          <div style={{ color: colors.textMuted, fontSize: '0.65rem' }}>
                            K{entry.linked_kingdom || '?'} · TC{entry.linked_tc_level || '?'} · {entry.role_detail}
                          </div>
                        </div>
                        <span style={{ color: colors.textMuted, fontSize: '0.6rem', flexShrink: 0 }}>
                          {formatDate(entry.created_at)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
