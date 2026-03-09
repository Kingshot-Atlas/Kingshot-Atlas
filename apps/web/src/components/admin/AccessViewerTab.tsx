import React, { useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { colors } from '../../utils/styles';
import { logger } from '../../utils/logger';

// ─── Tool-centric categories (organized by TOOL, not DB table) ──────────
const TOOL_CATEGORIES = [
  { id: 'kingdom_profile', label: 'Kingdom Profile', icon: '👑', color: '#22d3ee', description: 'Editors & co-editors who can update kingdom data' },
  { id: 'battle_registry', label: 'KvK Battle Registry', icon: '⚔️', color: '#f97316', description: 'Managers who can add/edit battle registry entries' },
  { id: 'prep_scheduler', label: 'Prep Day Scheduler', icon: '📅', color: '#3b82f6', description: 'Managers who can assign prep day schedules' },
  { id: 'battle_planner', label: 'Battle Planner', icon: '🗡️', color: '#a855f7', description: 'Admin-granted access to the Battle Planner tool' },
  { id: 'alliance_center', label: 'Alliance Center', icon: '🏰', color: '#22c55e', description: 'Owners, managers & delegates for Base Designer, Bear Rally, Rally Coordinator' },
] as const;

type RoleBadge = 'editor' | 'co-editor' | 'manager' | 'owner' | 'delegate' | 'admin-granted';

interface RoleEntry {
  category: string;
  user_id: string;
  username: string;
  linked_kingdom: number | null;
  linked_tc_level: number | null;
  avatar_url: string | null;
  role_detail: string;
  role_badge: RoleBadge;
  created_at: string | null;
}

const BADGE_STYLES: Record<RoleBadge, { bg: string; text: string; label: string }> = {
  'editor':        { bg: '#22d3ee20', text: '#22d3ee', label: 'Editor' },
  'co-editor':     { bg: '#22d3ee15', text: '#67e8f9', label: 'Co-Editor' },
  'manager':       { bg: '#f9731620', text: '#f97316', label: 'Manager' },
  'owner':         { bg: '#eab30820', text: '#eab308', label: 'Owner' },
  'delegate':      { bg: '#22c55e20', text: '#22c55e', label: 'Delegate' },
  'admin-granted': { bg: '#a855f720', text: '#a855f7', label: 'Admin Granted' },
};

export const AccessViewerTab: React.FC = () => {
  const [kingdomSearch, setKingdomSearch] = useState('');
  const [usernameSearch, setUsernameSearch] = useState('');
  const [results, setResults] = useState<RoleEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchedValue, setSearchedValue] = useState('');
  const [searchMode, setSearchMode] = useState<'kingdom' | 'username'>('kingdom');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(TOOL_CATEGORIES.map(c => c.id)));

  const toggleCategory = (id: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  type ProfileInfo = { username: string; linked_kingdom: number | null; linked_tc_level: number | null; avatar_url: string | null };

  const enrichWithProfiles = useCallback(async (userIds: string[]): Promise<Map<string, ProfileInfo>> => {
    if (!supabase || userIds.length === 0) return new Map();
    const unique = [...new Set(userIds)];
    const { data } = await supabase
      .from('profiles')
      .select('id, username, linked_username, linked_kingdom, linked_tc_level, linked_avatar_url')
      .in('id', unique);
    const map = new Map<string, ProfileInfo>();
    (data || []).forEach((p: { id: string; username: string | null; linked_username: string | null; linked_kingdom: number | null; linked_tc_level: number | null; linked_avatar_url: string | null }) => {
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
      const [editorsRes, brmRes, psmRes, bmRes, profilesRes, alliancesRes] = await Promise.all([
        supabase.from('kingdom_editors').select('user_id, role, status, created_at').eq('kingdom_number', kd),
        supabase.from('battle_registries').select('id').eq('kingdom_number', kd).limit(1),
        supabase.from('prep_schedules').select('id').eq('kingdom_number', kd),
        supabase.from('battle_managers').select('user_id, created_at').eq('kingdom_number', kd),
        supabase.from('profiles').select('id').eq('linked_kingdom', kd).not('linked_player_id', 'is', null),
        supabase.from('alliances').select('id, owner_id').eq('kingdom_number', kd),
      ]);

      const allEntries: RoleEntry[] = [];
      const allUserIds: string[] = [];

      // ── Kingdom Profile: editors & co-editors ──
      const editors = editorsRes.data || [];
      editors.forEach(e => allUserIds.push(e.user_id));

      // ── Battle Registry: managers ──
      let brmData: { user_id: string; created_at: string }[] = [];
      const firstReg = brmRes.data?.[0];
      if (firstReg) {
        const { data: mgrs } = await supabase.from('battle_registry_managers').select('user_id, created_at').eq('registry_id', firstReg.id);
        brmData = mgrs || [];
        brmData.forEach(m => allUserIds.push(m.user_id));
      }

      // ── Prep Scheduler: managers ──
      let psmData: { user_id: string; assigned_at: string }[] = [];
      const schedules = psmRes.data || [];
      if (schedules.length > 0) {
        const scheduleIds = schedules.map(s => s.id);
        const { data: mgrs } = await supabase.from('prep_schedule_managers').select('user_id, assigned_at').in('schedule_id', scheduleIds);
        psmData = mgrs || [];
        psmData.forEach(m => allUserIds.push(m.user_id));
      }

      // ── Battle Planner: tool_access + battle_managers ──
      const bms = bmRes.data || [];
      bms.forEach(b => allUserIds.push(b.user_id));

      const kdProfileIds = (profilesRes.data || []).map(p => p.id);
      let taData: { user_id: string; tool: string; created_at: string }[] = [];
      if (kdProfileIds.length > 0) {
        const { data: tas } = await supabase.from('tool_access').select('user_id, tool, created_at').in('user_id', kdProfileIds);
        taData = tas || [];
        taData.forEach(t => allUserIds.push(t.user_id));
      }

      // ── Alliance Center: owners + managers + delegates ──
      const alliances = alliancesRes.data || [];
      let amData: { user_id: string; created_at: string }[] = [];
      if (alliances.length > 0) {
        alliances.forEach(a => allUserIds.push(a.owner_id));
        const allianceIds = alliances.map(a => a.id);
        const { data: mgrs } = await supabase.from('alliance_managers').select('user_id, created_at').in('alliance_id', allianceIds);
        amData = mgrs || [];
        amData.forEach(m => allUserIds.push(m.user_id));
      }

      // Alliance delegates (tool_delegates where owner is in this kingdom)
      let tdData: { owner_id: string; delegate_id: string; tool: string; created_at: string }[] = [];
      if (kdProfileIds.length > 0) {
        const [ownerRes, delegateRes] = await Promise.all([
          supabase.from('tool_delegates').select('owner_id, delegate_id, tool, created_at').in('owner_id', kdProfileIds),
          supabase.from('tool_delegates').select('owner_id, delegate_id, tool, created_at').in('delegate_id', kdProfileIds),
        ]);
        const seen = new Set<string>();
        [...(ownerRes.data || []), ...(delegateRes.data || [])].forEach(t => {
          const key = `${t.owner_id}-${t.delegate_id}-${(t as { tool?: string }).tool || 'all'}`;
          if (!seen.has(key)) { seen.add(key); tdData.push({ ...t, tool: (t as { tool?: string }).tool || 'all' }); }
        });
        tdData.forEach(t => { allUserIds.push(t.owner_id); allUserIds.push(t.delegate_id); });
      }

      // Enrich all user IDs
      const profileMap = await enrichWithProfiles(allUserIds);
      const getProfile = (uid: string) => profileMap.get(uid) || { username: 'Unknown', linked_kingdom: null, linked_tc_level: null, avatar_url: null };

      // ── Build entries by TOOL ──

      // Kingdom Profile
      editors.forEach(e => {
        const p = getProfile(e.user_id);
        const isCoEditor = (e.role || '').toLowerCase().includes('co');
        allEntries.push({
          category: 'kingdom_profile', user_id: e.user_id, ...p,
          role_detail: `${e.status || 'active'}`,
          role_badge: isCoEditor ? 'co-editor' : 'editor',
          created_at: e.created_at,
        });
      });

      // Battle Registry
      brmData.forEach(m => {
        const p = getProfile(m.user_id);
        allEntries.push({
          category: 'battle_registry', user_id: m.user_id, ...p,
          role_detail: 'Can manage registry entries',
          role_badge: 'manager',
          created_at: m.created_at,
        });
      });

      // Prep Scheduler
      psmData.forEach(m => {
        const p = getProfile(m.user_id);
        allEntries.push({
          category: 'prep_scheduler', user_id: m.user_id, ...p,
          role_detail: 'Can assign prep days',
          role_badge: 'manager',
          created_at: m.assigned_at,
        });
      });

      // Battle Planner (tool_access entries + battle_managers)
      taData.forEach(t => {
        const p = getProfile(t.user_id);
        allEntries.push({
          category: 'battle_planner', user_id: t.user_id, ...p,
          role_detail: 'Battle Planner access',
          role_badge: 'admin-granted',
          created_at: t.created_at,
        });
      });
      bms.forEach(b => {
        const p = getProfile(b.user_id);
        allEntries.push({
          category: 'battle_planner', user_id: b.user_id, ...p,
          role_detail: 'Battle Manager',
          role_badge: 'manager',
          created_at: b.created_at,
        });
      });

      // Alliance Center: owners, managers, delegates
      alliances.forEach(a => {
        const p = getProfile(a.owner_id);
        allEntries.push({
          category: 'alliance_center', user_id: a.owner_id, ...p,
          role_detail: 'Alliance owner — full control',
          role_badge: 'owner',
          created_at: null,
        });
      });
      amData.forEach(m => {
        const p = getProfile(m.user_id);
        allEntries.push({
          category: 'alliance_center', user_id: m.user_id, ...p,
          role_detail: 'Alliance manager — can manage members',
          role_badge: 'manager',
          created_at: m.created_at,
        });
      });
      // Group delegate rows by owner+delegate pair to show tool list
      const delegatePairs = new Map<string, { owner_id: string; delegate_id: string; tools: string[]; created_at: string }>();
      tdData.forEach(t => {
        const key = `${t.owner_id}-${t.delegate_id}`;
        const existing = delegatePairs.get(key);
        if (existing) { existing.tools.push(t.tool); }
        else { delegatePairs.set(key, { owner_id: t.owner_id, delegate_id: t.delegate_id, tools: [t.tool], created_at: t.created_at }); }
      });
      delegatePairs.forEach(pair => {
        const owner = getProfile(pair.owner_id);
        const delegate = getProfile(pair.delegate_id);
        const toolLabel = pair.tools.includes('all') ? 'All tools' : pair.tools.map(t => {
          if (t === 'base_designer') return 'Base Designer';
          if (t === 'bear_rally') return 'Bear Rally';
          if (t === 'rally_coordinator') return 'Rally Coord.';
          return t;
        }).join(', ');
        allEntries.push({
          category: 'alliance_center', user_id: pair.delegate_id, ...delegate,
          role_detail: `Delegate of ${owner.username} — ${toolLabel}`,
          role_badge: 'delegate',
          created_at: pair.created_at,
        });
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
      const profileMap = new Map<string, ProfileInfo>(profiles.map(p => [p.id, {
        username: p.linked_username || p.username || 'Unknown',
        linked_kingdom: p.linked_kingdom,
        linked_tc_level: p.linked_tc_level,
        avatar_url: p.linked_avatar_url,
      }]));
      const getProfile = (uid: string) => profileMap.get(uid) || { username: 'Unknown', linked_kingdom: null, linked_tc_level: null, avatar_url: null };

      // Query all role tables in parallel
      const [editorsRes, brmRes, psmRes, bmRes, taRes, tdOwnerRes, tdDelegateRes, amRes, allianceOwnerRes] = await Promise.all([
        supabase.from('kingdom_editors').select('user_id, kingdom_number, role, status, created_at').in('user_id', userIds),
        supabase.from('battle_registry_managers').select('user_id, registry_id, created_at').in('user_id', userIds),
        supabase.from('prep_schedule_managers').select('user_id, assigned_at').in('user_id', userIds),
        supabase.from('battle_managers').select('user_id, kingdom_number, created_at').in('user_id', userIds),
        supabase.from('tool_access').select('user_id, tool, created_at').in('user_id', userIds),
        supabase.from('tool_delegates').select('owner_id, delegate_id, tool, created_at').in('owner_id', userIds),
        supabase.from('tool_delegates').select('owner_id, delegate_id, tool, created_at').in('delegate_id', userIds),
        supabase.from('alliance_managers').select('user_id, alliance_id, created_at').in('user_id', userIds),
        supabase.from('alliances').select('id, owner_id').in('owner_id', userIds),
      ]);

      // Enrich delegate counterparts
      const extraIds: string[] = [];
      (tdOwnerRes.data || []).forEach(t => extraIds.push(t.delegate_id));
      (tdDelegateRes.data || []).forEach(t => extraIds.push(t.owner_id));
      const extraMap = await enrichWithProfiles(extraIds);
      const getAny = (uid: string) => profileMap.get(uid) || extraMap.get(uid) || { username: 'Unknown', linked_kingdom: null, linked_tc_level: null, avatar_url: null };

      const allEntries: RoleEntry[] = [];

      // Kingdom Profile
      (editorsRes.data || []).forEach(e => {
        const p = getProfile(e.user_id);
        const isCoEditor = (e.role || '').toLowerCase().includes('co');
        allEntries.push({
          category: 'kingdom_profile', user_id: e.user_id, ...p,
          role_detail: `K${e.kingdom_number} · ${e.status || 'active'}`,
          role_badge: isCoEditor ? 'co-editor' : 'editor',
          created_at: e.created_at,
        });
      });

      // Battle Registry
      (brmRes.data || []).forEach(m => {
        const p = getProfile(m.user_id);
        allEntries.push({
          category: 'battle_registry', user_id: m.user_id, ...p,
          role_detail: 'Can manage registry entries',
          role_badge: 'manager',
          created_at: m.created_at,
        });
      });

      // Prep Scheduler
      (psmRes.data || []).forEach(m => {
        const p = getProfile(m.user_id);
        allEntries.push({
          category: 'prep_scheduler', user_id: m.user_id, ...p,
          role_detail: 'Can assign prep days',
          role_badge: 'manager',
          created_at: m.assigned_at,
        });
      });

      // Battle Planner
      (taRes.data || []).forEach(t => {
        const p = getProfile(t.user_id);
        allEntries.push({
          category: 'battle_planner', user_id: t.user_id, ...p,
          role_detail: 'Battle Planner access',
          role_badge: 'admin-granted',
          created_at: t.created_at,
        });
      });
      (bmRes.data || []).forEach(b => {
        const p = getProfile(b.user_id);
        allEntries.push({
          category: 'battle_planner', user_id: b.user_id, ...p,
          role_detail: `K${b.kingdom_number} Battle Manager`,
          role_badge: 'manager',
          created_at: b.created_at,
        });
      });

      // Alliance Center: owners
      (allianceOwnerRes.data || []).forEach(a => {
        const p = getProfile(a.owner_id);
        allEntries.push({
          category: 'alliance_center', user_id: a.owner_id, ...p,
          role_detail: 'Alliance owner — full control',
          role_badge: 'owner',
          created_at: null,
        });
      });

      // Alliance Center: managers
      (amRes.data || []).forEach(m => {
        const p = getProfile(m.user_id);
        allEntries.push({
          category: 'alliance_center', user_id: m.user_id, ...p,
          role_detail: 'Alliance manager — can manage members',
          role_badge: 'manager',
          created_at: m.created_at,
        });
      });

      // Alliance Center: delegates — group by owner+delegate pair to show tool list
      const delegatePairsUser = new Map<string, { owner_id: string; delegate_id: string; tools: string[]; created_at: string }>();
      [...(tdOwnerRes.data || []), ...(tdDelegateRes.data || [])].forEach(t => {
        const key = `${t.owner_id}-${t.delegate_id}`;
        const existing = delegatePairsUser.get(key);
        const tool = (t as { tool?: string }).tool || 'all';
        if (existing) { if (!existing.tools.includes(tool)) existing.tools.push(tool); }
        else { delegatePairsUser.set(key, { owner_id: t.owner_id, delegate_id: t.delegate_id, tools: [tool], created_at: t.created_at }); }
      });
      const formatToolLabel = (tools: string[]) => tools.includes('all') ? 'All tools' : tools.map(t => {
        if (t === 'base_designer') return 'Base Designer';
        if (t === 'bear_rally') return 'Bear Rally';
        if (t === 'rally_coordinator') return 'Rally Coord.';
        return t;
      }).join(', ');
      delegatePairsUser.forEach(pair => {
        const owner = getAny(pair.owner_id);
        const delegate = getAny(pair.delegate_id);
        const toolLabel = formatToolLabel(pair.tools);
        if (profileMap.has(pair.owner_id)) {
          allEntries.push({
            category: 'alliance_center', user_id: pair.owner_id, ...owner,
            role_detail: `Delegated to ${delegate.username} — ${toolLabel}`,
            role_badge: 'owner',
            created_at: pair.created_at,
          });
        }
        if (profileMap.has(pair.delegate_id)) {
          allEntries.push({
            category: 'alliance_center', user_id: pair.delegate_id, ...delegate,
            role_detail: `Delegate of ${owner.username} — ${toolLabel}`,
            role_badge: 'delegate',
            created_at: pair.created_at,
          });
        }
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

  const grouped = TOOL_CATEGORIES.map(cat => ({
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
            Look up who has access to each tool — by kingdom or username.
          </p>
        </div>

        {/* Search Mode Toggle */}
        <div style={{ display: 'flex', gap: '0.35rem', marginBottom: '0.75rem' }}>
          {[
            { mode: 'kingdom' as const, label: '🏰 By Kingdom' },
            { mode: 'username' as const, label: '👤 By Username' },
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
              No roles found for {searchedValue}.
              {searchMode === 'kingdom' && (
                <span style={{ display: 'block', marginTop: '0.5rem', fontSize: '0.75rem' }}>
                  This kingdom has no editors, managers, or tool access set up yet.
                </span>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {/* Tool filter pills */}
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

              {/* Grouped results by TOOL */}
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
                    {group.entries.map((entry, i) => {
                      const badge = BADGE_STYLES[entry.role_badge];
                      return (
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
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <span style={{ fontWeight: 600, fontSize: '0.8rem', color: colors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {entry.username}
                              </span>
                              <span style={{
                                padding: '0.05rem 0.35rem', borderRadius: '4px', fontSize: '0.55rem',
                                fontWeight: 700, backgroundColor: badge.bg, color: badge.text,
                                textTransform: 'uppercase', letterSpacing: '0.3px', flexShrink: 0,
                              }}>
                                {badge.label}
                              </span>
                            </div>
                            <div style={{ color: colors.textMuted, fontSize: '0.65rem' }}>
                              K{entry.linked_kingdom || '?'} · TC{entry.linked_tc_level || '?'} · {entry.role_detail}
                            </div>
                          </div>
                          <span style={{ color: colors.textMuted, fontSize: '0.6rem', flexShrink: 0 }}>
                            {formatDate(entry.created_at)}
                          </span>
                        </div>
                      );
                    })}
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
