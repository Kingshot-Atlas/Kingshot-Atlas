import React, { useState, useEffect, useCallback } from 'react';
import { colors, neonGlow, FONT_DISPLAY } from '../utils/styles';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

interface TransferGroup {
  id: number;
  min_kingdom: number;
  max_kingdom: number;
  label: string;
  event_number: number;
  is_active: boolean;
  user_count?: number;
  created_at: string;
  updated_at: string;
}

interface Props {
  mob?: boolean;
}

const lS: React.CSSProperties = { display: 'block', color: '#888', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem' };
const iS: React.CSSProperties = { width: '100%', padding: '0.5rem 0.75rem', backgroundColor: '#0a0a0a', border: '1px solid #222', borderRadius: 8, color: '#e5e5e5', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' };
const btnBase: React.CSSProperties = { padding: '0.25rem 0.5rem', backgroundColor: 'transparent', border: `1px solid ${colors.border}`, borderRadius: 6, fontSize: '0.65rem', cursor: 'pointer' };

const BotDashboardTransferGroups: React.FC<Props> = ({ mob }) => {
  const [groups, setGroups] = useState<TransferGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editMin, setEditMin] = useState('');
  const [editMax, setEditMax] = useState('');
  const [showNewEvent, setShowNewEvent] = useState(false);
  const [newEventNumber, setNewEventNumber] = useState('');
  const [newRows, setNewRows] = useState<{ min: string; max: string }[]>([{ min: '', max: '' }]);
  const [saving, setSaving] = useState(false);
  const [creatingChannels, setCreatingChannels] = useState(false);
  const [channelResult, setChannelResult] = useState<{ created_categories: number; created_channels: number; skipped_categories: number; total_groups: number; errors: string[] } | null>(null);
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [addMin, setAddMin] = useState('');
  const [addMax, setAddMax] = useState('');
  const [addingGroup, setAddingGroup] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [showPastEvents, setShowPastEvents] = useState(false);

  const flash = (msg: string, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3500); };

  const getAuth = async (): Promise<Record<string, string>> => {
    const { getAuthHeaders } = await import('../services/authHeaders');
    return getAuthHeaders() ?? {};
  };

  const fetchGroups = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const auth = await getAuth();
      const res = await fetch(`${API_URL}/api/v1/bot/transfer-groups/with-counts`, { headers: auth });
      if (!res.ok) throw new Error(`API ${res.status}`);
      const data = await res.json();
      setGroups(data.groups || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchGroups(); }, [fetchGroups]);

  const activeGroups = groups.filter(g => g.is_active);
  const inactiveGroups = groups.filter(g => !g.is_active);
  const currentEvent = activeGroups.length > 0 ? (activeGroups[0]?.event_number ?? null) : null;
  const totalUsers = activeGroups.reduce((sum, g) => sum + (g.user_count || 0), 0);
  // Group inactive by event_number
  const pastEvents = inactiveGroups.reduce<Record<number, TransferGroup[]>>((acc, g) => {
    (acc[g.event_number] ||= []).push(g);
    return acc;
  }, {});
  const pastEventNumbers = Object.keys(pastEvents).map(Number).sort((a, b) => b - a);

  const toggleActive = async (group: TransferGroup) => {
    try {
      const auth = await getAuth();
      const res = await fetch(`${API_URL}/api/v1/bot/transfer-groups/${group.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...auth },
        body: JSON.stringify({ is_active: !group.is_active }),
      });
      if (!res.ok) throw new Error('Failed');
      setGroups(prev => prev.map(g => g.id === group.id ? { ...g, is_active: !g.is_active } : g));
      flash(group.is_active ? 'Group deactivated' : 'Group activated');
    } catch {
      flash('Failed to update', false);
    }
  };

  const saveEdit = async (group: TransferGroup) => {
    const min = parseInt(editMin);
    const max = parseInt(editMax);
    if (isNaN(min) || isNaN(max) || min > max || min < 1) {
      flash('Invalid range', false);
      return;
    }
    try {
      const auth = await getAuth();
      const res = await fetch(`${API_URL}/api/v1/bot/transfer-groups/${group.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...auth },
        body: JSON.stringify({ min_kingdom: min, max_kingdom: max }),
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setGroups(prev => prev.map(g => g.id === group.id ? { ...g, ...data.group } : g));
      setEditingId(null);
      flash('Range updated');
    } catch {
      flash('Failed to update', false);
    }
  };

  const addGroup = async () => {
    const min = parseInt(addMin);
    const max = parseInt(addMax);
    if (isNaN(min) || isNaN(max) || min > max || min < 1) {
      flash('Invalid range (min must be ≤ max, both > 0)', false);
      return;
    }
    setAddingGroup(true);
    try {
      const auth = await getAuth();
      const res = await fetch(`${API_URL}/api/v1/bot/transfer-groups/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...auth },
        body: JSON.stringify({ min_kingdom: min, max_kingdom: max }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(typeof err.detail === 'string' ? err.detail : 'Failed');
      }
      flash(`Added group K${min}–K${max}`);
      setShowAddGroup(false);
      setAddMin('');
      setAddMax('');
      await fetchGroups();
    } catch (e: unknown) {
      flash(e instanceof Error ? e.message : 'Failed to add group', false);
    } finally {
      setAddingGroup(false);
    }
  };

  const deleteGroup = async (group: TransferGroup) => {
    if (!confirm(`Delete "Transfer ${group.label}" (K${group.min_kingdom}–K${group.max_kingdom})?\n\nThis is permanent. The Discord bot will stop assigning this role on the next sync.`)) return;
    setDeletingId(group.id);
    try {
      const auth = await getAuth();
      const res = await fetch(`${API_URL}/api/v1/bot/transfer-groups/${group.id}`, {
        method: 'DELETE',
        headers: auth,
      });
      if (!res.ok) throw new Error('Failed');
      setGroups(prev => prev.filter(g => g.id !== group.id));
      flash(`Deleted Transfer ${group.label}`);
    } catch {
      flash('Failed to delete', false);
    } finally {
      setDeletingId(null);
    }
  };

  const createNewEvent = async () => {
    const evNum = parseInt(newEventNumber);
    if (isNaN(evNum) || evNum < 1) { flash('Enter a valid event number', false); return; }
    const parsedGroups = newRows.filter(r => r.min && r.max).map(r => ({ min_kingdom: parseInt(r.min), max_kingdom: parseInt(r.max) }));
    if (parsedGroups.length === 0) { flash('Add at least one kingdom range', false); return; }
    for (const g of parsedGroups) {
      if (isNaN(g.min_kingdom) || isNaN(g.max_kingdom) || g.min_kingdom > g.max_kingdom || g.min_kingdom < 1) {
        flash('Fix invalid ranges (min must be ≤ max, both > 0)', false);
        return;
      }
    }
    if (!confirm(`Create Transfer Event #${evNum} with ${parsedGroups.length} groups?\n\nThis will deactivate all ${activeGroups.length} current groups.`)) return;
    setSaving(true);
    try {
      const auth = await getAuth();
      const res = await fetch(`${API_URL}/api/v1/bot/transfer-groups/new-event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...auth },
        body: JSON.stringify({ event_number: evNum, groups: parsedGroups }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(typeof err.detail === 'string' ? err.detail : 'Failed');
      }
      flash(`Transfer Event #${evNum} created with ${parsedGroups.length} groups`);
      setShowNewEvent(false);
      setNewEventNumber('');
      setNewRows([{ min: '', max: '' }]);
      await fetchGroups();
    } catch (e: unknown) {
      flash(e instanceof Error ? e.message : 'Failed', false);
    } finally {
      setSaving(false);
    }
  };

  const cloneFromCurrent = () => {
    if (activeGroups.length === 0) return;
    setNewRows(activeGroups.map(g => ({ min: String(g.min_kingdom), max: String(g.max_kingdom) })));
    if (!newEventNumber && currentEvent != null) {
      setNewEventNumber(String(currentEvent + 1));
    }
    flash('Cloned ranges from current event — adjust as needed');
  };

  const createChannels = async () => {
    if (!confirm('Create Discord categories & channels for all active transfer groups?\n\nEach category gets:\n  - #🗣️-transfer-chat (text)\n  - #🚀-transferring-out (forum)\n  - #🏰-kingdom-ads (forum)\n\nExisting categories will be skipped.')) return;
    setCreatingChannels(true);
    setChannelResult(null);
    try {
      const auth = await getAuth();
      const res = await fetch(`${API_URL}/api/v1/bot/transfer-groups/create-channels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...auth },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(typeof err.detail === 'string' ? err.detail : `API ${res.status}`);
      }
      const data = await res.json();
      setChannelResult(data);
      if (data.created_categories > 0) {
        flash(`Created ${data.created_categories} categories with ${data.created_channels} channels`);
      } else if (data.skipped_categories > 0) {
        flash('All categories already exist — nothing to create', false);
      }
    } catch (e: unknown) {
      flash(e instanceof Error ? e.message : 'Failed to create channels', false);
    } finally {
      setCreatingChannels(false);
    }
  };

  const triggerSync = async () => {
    setSyncing(true);
    try {
      const auth = await getAuth();
      const res = await fetch(`${API_URL}/api/v1/bot/transfer-groups`, { headers: auth });
      if (!res.ok) throw new Error(`API ${res.status}`);
      flash('Sync triggered — bot will update Discord roles on next 30-min cycle');
    } catch {
      flash('Sync trigger failed', false);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div>
      {toast && <div style={{ position: 'fixed', top: '1rem', right: '1rem', zIndex: 9999, padding: '0.6rem 1.2rem', borderRadius: 8, backgroundColor: toast.ok ? colors.success : colors.error, color: '#fff', fontSize: '0.85rem', fontWeight: 600, boxShadow: '0 4px 20px rgba(0,0,0,0.4)' }}>{toast.msg}</div>}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h2 style={{ color: colors.text, fontSize: mob ? '1rem' : '1.1rem', fontWeight: 700, margin: 0, fontFamily: FONT_DISPLAY }}>
          <span style={{ color: '#fff' }}>TRANSFER</span><span style={{ ...neonGlow('#a855f7'), marginLeft: '0.3rem' }}>GROUPS</span>
        </h2>
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          <button onClick={triggerSync} disabled={syncing}
            style={{ padding: '0.4rem 0.8rem', backgroundColor: syncing ? colors.border : `${colors.primary}15`, border: `1px solid ${colors.primary}40`, borderRadius: 8, color: syncing ? colors.textMuted : colors.primary, fontSize: '0.75rem', fontWeight: 600, cursor: syncing ? 'default' : 'pointer' }}>
            {syncing ? '⏳ Syncing...' : '🔄 Sync Roles'}
          </button>
          <button onClick={createChannels} disabled={creatingChannels || activeGroups.length === 0}
            style={{ padding: '0.4rem 0.8rem', backgroundColor: creatingChannels ? colors.border : '#a855f715', border: '1px solid #a855f740', borderRadius: 8, color: creatingChannels ? colors.textMuted : '#a855f7', fontSize: '0.75rem', fontWeight: 600, cursor: creatingChannels || activeGroups.length === 0 ? 'default' : 'pointer' }}>
            {creatingChannels ? '⏳ Creating...' : '📁 Create Channels'}
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.5rem', marginBottom: '1rem' }}>
        {[
          { l: 'Active Groups', v: String(activeGroups.length), c: colors.success },
          { l: 'Current Event', v: currentEvent ? `#${currentEvent}` : '—', c: '#a855f7' },
          { l: 'Linked Users', v: String(totalUsers), c: colors.primary },
        ].map(s => (
          <div key={s.l} style={{ backgroundColor: colors.surface, borderRadius: 10, border: `1px solid ${colors.border}`, padding: '0.6rem', textAlign: 'center' }}>
            <div style={{ color: s.c, fontSize: '1rem', fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>{s.v}</div>
            <div style={{ color: colors.textMuted, fontSize: '0.6rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', marginTop: '0.15rem' }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* Channel Creation Result */}
      {channelResult && (
        <div style={{ backgroundColor: channelResult.errors.length > 0 ? `${colors.warning}08` : `${colors.success}08`, borderRadius: 12, border: `1px solid ${channelResult.errors.length > 0 ? colors.warning : colors.success}30`, padding: '1.25rem', marginBottom: '1rem' }}>
          <div style={{ color: channelResult.errors.length > 0 ? colors.warning : colors.success, fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem' }}>
            {channelResult.errors.length > 0 ? '⚠️ Completed with errors' : '✅ Discord Channels Created'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.5rem', marginBottom: channelResult.errors.length > 0 ? '0.75rem' : 0 }}>
            {[
              { l: 'Categories Created', v: String(channelResult.created_categories), c: colors.success },
              { l: 'Channels Created', v: String(channelResult.created_channels), c: colors.primary },
              { l: 'Skipped (Existing)', v: String(channelResult.skipped_categories), c: colors.textMuted },
            ].map(s => (
              <div key={s.l} style={{ backgroundColor: colors.surface, borderRadius: 8, border: `1px solid ${colors.border}`, padding: '0.5rem', textAlign: 'center' }}>
                <div style={{ color: s.c, fontSize: '0.9rem', fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>{s.v}</div>
                <div style={{ color: colors.textMuted, fontSize: '0.55rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', marginTop: '0.1rem' }}>{s.l}</div>
              </div>
            ))}
          </div>
          {channelResult.errors.length > 0 && (
            <div>
              <div style={{ color: colors.error, fontSize: '0.7rem', fontWeight: 600, marginBottom: '0.3rem' }}>Errors:</div>
              {channelResult.errors.map((e, i) => (
                <div key={i} style={{ color: colors.textMuted, fontSize: '0.65rem', paddingLeft: '0.5rem', marginBottom: '0.15rem' }}>• {e}</div>
              ))}
            </div>
          )}
          <button onClick={() => setChannelResult(null)}
            style={{ marginTop: '0.5rem', padding: '0.25rem 0.6rem', backgroundColor: 'transparent', border: `1px solid ${colors.border}`, borderRadius: 6, color: colors.textMuted, fontSize: '0.65rem', cursor: 'pointer' }}>Dismiss</button>
        </div>
      )}

      {/* Loading / Error */}
      {loading && <div style={{ padding: '2rem', textAlign: 'center', color: colors.textMuted, fontSize: '0.85rem' }}>Loading transfer groups...</div>}
      {error && <div style={{ padding: '0.75rem', borderRadius: 8, backgroundColor: `${colors.error}10`, border: `1px solid ${colors.error}30`, color: colors.error, fontSize: '0.8rem', marginBottom: '1rem' }}>{error}</div>}

      {/* Active Groups */}
      {!loading && (
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <label style={{ ...lS, marginBottom: 0 }}>ACTIVE GROUPS{currentEvent ? ` (EVENT #${currentEvent})` : ''}</label>
            <div style={{ display: 'flex', gap: '0.3rem' }}>
              <button onClick={() => { setShowAddGroup(!showAddGroup); setShowNewEvent(false); }}
                style={{ ...btnBase, color: showAddGroup ? colors.warning : colors.success, borderColor: showAddGroup ? `${colors.warning}40` : `${colors.success}40` }}>
                {showAddGroup ? '✕ Cancel' : '+ Add Group'}
              </button>
              <button onClick={() => { setShowNewEvent(!showNewEvent); setShowAddGroup(false); }}
                style={{ ...btnBase, color: showNewEvent ? colors.warning : '#a855f7', borderColor: showNewEvent ? `${colors.warning}40` : '#a855f740' }}>
                {showNewEvent ? '✕ Cancel' : '🔄 New Event'}
              </button>
            </div>
          </div>

          {/* Inline Add Group Form */}
          {showAddGroup && (
            <div style={{ backgroundColor: `${colors.success}08`, borderRadius: 10, border: `1px solid ${colors.success}30`, padding: '0.75rem 1rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span style={{ color: colors.success, fontSize: '0.75rem', fontWeight: 600 }}>Add to Event #{currentEvent || '?'}:</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <span style={{ color: colors.textMuted, fontSize: '0.7rem' }}>K</span>
                <input type="number" value={addMin} onChange={e => setAddMin(e.target.value)} placeholder="Min"
                  style={{ ...iS, maxWidth: 80, padding: '0.3rem 0.5rem', fontSize: '0.8rem' }} />
                <span style={{ color: colors.textMuted, fontSize: '0.8rem' }}>–</span>
                <span style={{ color: colors.textMuted, fontSize: '0.7rem' }}>K</span>
                <input type="number" value={addMax} onChange={e => setAddMax(e.target.value)} placeholder="Max"
                  style={{ ...iS, maxWidth: 80, padding: '0.3rem 0.5rem', fontSize: '0.8rem' }} />
              </div>
              <button onClick={addGroup} disabled={addingGroup || !addMin || !addMax}
                style={{ padding: '0.3rem 0.7rem', backgroundColor: addingGroup ? colors.border : colors.success, border: 'none', borderRadius: 6, color: '#fff', fontSize: '0.7rem', fontWeight: 600, cursor: addingGroup ? 'default' : 'pointer' }}>
                {addingGroup ? '⏳' : '+ Add'}
              </button>
            </div>
          )}

          {/* Group List */}
          {activeGroups.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              {activeGroups.map(g => (
                <div key={g.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface, borderRadius: 10, border: `1px solid #a855f720`, padding: '0.65rem 1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flex: 1, minWidth: 0 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#a855f7', flexShrink: 0 }} />
                    {editingId === g.id ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <span style={{ color: colors.textMuted, fontSize: '0.7rem' }}>K</span>
                        <input type="number" value={editMin} onChange={e => setEditMin(e.target.value)} style={{ ...iS, maxWidth: 70, padding: '0.3rem 0.5rem', fontSize: '0.8rem' }} />
                        <span style={{ color: colors.textMuted }}>–</span>
                        <span style={{ color: colors.textMuted, fontSize: '0.7rem' }}>K</span>
                        <input type="number" value={editMax} onChange={e => setEditMax(e.target.value)} style={{ ...iS, maxWidth: 70, padding: '0.3rem 0.5rem', fontSize: '0.8rem' }} />
                        <button onClick={() => saveEdit(g)} style={{ ...btnBase, backgroundColor: colors.success, borderColor: colors.success, color: '#fff', fontWeight: 600 }}>✓</button>
                        <button onClick={() => setEditingId(null)} style={{ ...btnBase, color: colors.textMuted }}>✕</button>
                      </div>
                    ) : (
                      <div style={{ minWidth: 0 }}>
                        <div style={{ color: colors.text, fontSize: '0.85rem', fontWeight: 600 }}>Transfer {g.label}</div>
                        <div style={{ color: colors.textMuted, fontSize: '0.65rem' }}>K{g.min_kingdom}–K{g.max_kingdom} · {g.user_count ?? 0} users</div>
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0 }}>
                    {editingId !== g.id && (
                      <>
                        <button onClick={() => { setEditingId(g.id); setEditMin(String(g.min_kingdom)); setEditMax(String(g.max_kingdom)); }}
                          title="Edit range" style={{ ...btnBase, color: colors.textMuted }}>✏️</button>
                        <button onClick={() => toggleActive(g)} title="Deactivate"
                          style={{ ...btnBase, color: colors.warning, borderColor: `${colors.warning}40` }}>⏸</button>
                        <button onClick={() => deleteGroup(g)} disabled={deletingId === g.id} title="Delete permanently"
                          style={{ ...btnBase, color: colors.error, borderColor: `${colors.error}40`, opacity: deletingId === g.id ? 0.5 : 1 }}>🗑</button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : !loading && (
            <div style={{ padding: '1.5rem', textAlign: 'center', backgroundColor: colors.surface, borderRadius: 10, border: `1px solid ${colors.border}` }}>
              <div style={{ color: colors.textMuted, fontSize: '0.8rem', marginBottom: '0.5rem' }}>No active transfer groups</div>
              <div style={{ color: colors.textMuted, fontSize: '0.7rem' }}>Create a new event or add individual groups above.</div>
            </div>
          )}
        </div>
      )}

      {/* New Event Form */}
      {showNewEvent && (
        <div style={{ backgroundColor: `#a855f708`, borderRadius: 12, border: `1px solid #a855f730`, padding: '1.25rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <div style={{ color: '#a855f7', fontSize: '0.85rem', fontWeight: 700 }}>🔄 Create New Transfer Event</div>
            {activeGroups.length > 0 && (
              <button onClick={cloneFromCurrent}
                style={{ padding: '0.3rem 0.6rem', backgroundColor: `${colors.primary}15`, border: `1px solid ${colors.primary}40`, borderRadius: 6, color: colors.primary, fontSize: '0.65rem', fontWeight: 600, cursor: 'pointer' }}>
                📋 Clone from Event #{currentEvent}
              </button>
            )}
          </div>
          <p style={{ color: colors.textMuted, fontSize: '0.72rem', marginBottom: '0.75rem', lineHeight: 1.5, margin: '0 0 0.75rem 0' }}>
            This will <strong style={{ color: colors.warning }}>deactivate all {activeGroups.length} current groups</strong> and create new ones. The Discord bot will reassign roles on the next 30-min sync.
          </p>

          <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
            <div>
              <label style={lS}>EVENT NUMBER</label>
              <input type="number" value={newEventNumber} onChange={e => setNewEventNumber(e.target.value)}
                placeholder={currentEvent != null ? String(currentEvent + 1) : '1'} style={{ ...iS, maxWidth: 100 }} />
            </div>
            <div style={{ color: colors.textMuted, fontSize: '0.7rem', alignSelf: 'flex-end', paddingBottom: '0.5rem' }}>
              {newRows.filter(r => r.min && r.max).length} group{newRows.filter(r => r.min && r.max).length !== 1 ? 's' : ''} configured
            </div>
          </div>

          <label style={lS}>KINGDOM RANGES</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginBottom: '0.75rem' }}>
            {newRows.map((row, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ color: colors.textMuted, fontSize: '0.7rem', width: 20, textAlign: 'right', flexShrink: 0 }}>{i + 1}.</span>
                <span style={{ color: colors.textMuted, fontSize: '0.7rem' }}>K</span>
                <input type="number" value={row.min} onChange={e => { const r = [...newRows]; if (r[i]) r[i].min = e.target.value; setNewRows(r); }}
                  placeholder="Min" style={{ ...iS, maxWidth: 90 }} />
                <span style={{ color: colors.textMuted, fontSize: '0.8rem' }}>–</span>
                <span style={{ color: colors.textMuted, fontSize: '0.7rem' }}>K</span>
                <input type="number" value={row.max} onChange={e => { const r = [...newRows]; if (r[i]) r[i].max = e.target.value; setNewRows(r); }}
                  placeholder="Max" style={{ ...iS, maxWidth: 90 }} />
                {newRows.length > 1 && (
                  <button onClick={() => setNewRows(newRows.filter((_, j) => j !== i))}
                    style={{ ...btnBase, color: colors.error, borderColor: `${colors.error}40` }}>✕</button>
                )}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button onClick={() => setNewRows([...newRows, { min: '', max: '' }])}
              style={{ ...btnBase, padding: '0.4rem 0.8rem', color: colors.textMuted }}>
              + Add Range
            </button>
            <button onClick={createNewEvent} disabled={saving || !newEventNumber || newRows.every(r => !r.min || !r.max)}
              style={{ padding: '0.4rem 1rem', backgroundColor: saving ? colors.border : '#a855f7', border: 'none', borderRadius: 8, color: '#fff', fontSize: '0.75rem', fontWeight: 700, cursor: saving ? 'default' : 'pointer' }}>
              {saving ? '⏳ Creating...' : `Create Event #${newEventNumber || '?'} (${newRows.filter(r => r.min && r.max).length} groups)`}
            </button>
          </div>
        </div>
      )}

      {/* Inactive / Past Events */}
      {!loading && inactiveGroups.length > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          <button onClick={() => setShowPastEvents(!showPastEvents)}
            style={{ ...lS, marginBottom: '0.5rem', cursor: 'pointer', background: 'none', border: 'none', padding: 0, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <span style={{ fontSize: '0.5rem', color: colors.textMuted, transition: 'transform 0.15s', transform: showPastEvents ? 'rotate(90deg)' : 'rotate(0deg)', display: 'inline-block' }}>▶</span>
            PAST EVENTS ({inactiveGroups.length} groups across {pastEventNumbers.length} events)
          </button>
          {showPastEvents && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {pastEventNumbers.map(evNum => (
                <div key={evNum}>
                  <div style={{ color: colors.textMuted, fontSize: '0.7rem', fontWeight: 600, marginBottom: '0.25rem', paddingLeft: '0.25rem' }}>Event #{evNum}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    {(pastEvents[evNum] || []).map(g => (
                      <div key={g.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#0f0f0f', borderRadius: 8, border: `1px solid ${colors.border}`, padding: '0.4rem 0.85rem', opacity: 0.6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: colors.textMuted, flexShrink: 0 }} />
                          <span style={{ color: colors.textMuted, fontSize: '0.75rem' }}>{g.label}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                          <button onClick={() => toggleActive(g)}
                            style={{ ...btnBase, color: colors.success, borderColor: `${colors.success}40`, fontSize: '0.6rem' }}>Reactivate</button>
                          <button onClick={() => deleteGroup(g)} disabled={deletingId === g.id}
                            style={{ ...btnBase, color: colors.error, borderColor: `${colors.error}40`, fontSize: '0.6rem', opacity: deletingId === g.id ? 0.5 : 1 }}>Delete</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Info */}
      <div style={{ backgroundColor: `#a855f708`, borderRadius: 10, border: '1px solid #a855f720', padding: '0.75rem 1rem', marginTop: '0.5rem' }}>
        <div style={{ color: '#a855f7', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem' }}>How it works</div>
        <div style={{ color: colors.textMuted, fontSize: '0.7rem', lineHeight: 1.6 }}>
          Groups are stored in Supabase. The Discord bot creates roles like <strong style={{ color: colors.text }}>Transfer K7-K115</strong> and assigns them based on each user&apos;s linked kingdom. Roles sync every 30 minutes automatically. Use <strong style={{ color: colors.primary }}>Sync Roles</strong> to trigger an immediate refresh. Use <strong style={{ color: '#a855f7' }}>Create Channels</strong> to set up Discord categories with text + forum channels for each group.
        </div>
      </div>
    </div>
  );
};

export default BotDashboardTransferGroups;
