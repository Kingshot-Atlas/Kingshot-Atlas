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
  mob: boolean;
}

const lS: React.CSSProperties = { display: 'block', color: '#888', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem' };
const iS: React.CSSProperties = { width: '100%', padding: '0.5rem 0.75rem', backgroundColor: '#0a0a0a', border: '1px solid #222', borderRadius: 8, color: '#e5e5e5', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' };

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

  const createNewEvent = async () => {
    const evNum = parseInt(newEventNumber);
    if (isNaN(evNum) || evNum < 1) { flash('Enter a valid event number', false); return; }
    const parsedGroups = newRows.map(r => ({ min_kingdom: parseInt(r.min), max_kingdom: parseInt(r.max) }));
    for (const g of parsedGroups) {
      if (isNaN(g.min_kingdom) || isNaN(g.max_kingdom) || g.min_kingdom > g.max_kingdom || g.min_kingdom < 1) {
        flash('Fix invalid ranges (min must be ≤ max, both > 0)', false);
        return;
      }
    }
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

  const triggerSync = async () => {
    setSyncing(true);
    try {
      const auth = await getAuth();
      const res = await fetch(`${API_URL}/api/v1/bot/transfer-groups`, { headers: auth });
      if (!res.ok) throw new Error(`API ${res.status}`);
      flash('Transfer groups refreshed. Bot will pick up changes on next 30-min sync cycle.');
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
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          <button onClick={triggerSync} disabled={syncing}
            style={{ padding: '0.4rem 0.8rem', backgroundColor: syncing ? colors.border : `${colors.primary}15`, border: `1px solid ${colors.primary}40`, borderRadius: 8, color: syncing ? colors.textMuted : colors.primary, fontSize: '0.75rem', fontWeight: 600, cursor: syncing ? 'default' : 'pointer' }}>
            {syncing ? '⏳ Syncing...' : '🔄 Sync Now'}
          </button>
          <button onClick={() => setShowNewEvent(!showNewEvent)}
            style={{ padding: '0.4rem 0.8rem', backgroundColor: showNewEvent ? `${colors.warning}15` : `${colors.success}15`, border: `1px solid ${showNewEvent ? colors.warning : colors.success}40`, borderRadius: 8, color: showNewEvent ? colors.warning : colors.success, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>
            {showNewEvent ? '✕ Cancel' : '+ New Event'}
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

      {/* New Event Form */}
      {showNewEvent && (
        <div style={{ backgroundColor: `${colors.success}08`, borderRadius: 12, border: `1px solid ${colors.success}30`, padding: mob ? '1rem' : '1.25rem', marginBottom: '1rem' }}>
          <div style={{ color: colors.success, fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.75rem' }}>🆕 Create New Transfer Event</div>
          <p style={{ color: colors.textMuted, fontSize: '0.72rem', marginBottom: '0.75rem', lineHeight: 1.5 }}>
            This will <strong style={{ color: colors.warning }}>deactivate all current groups</strong> and create new ones. Existing roles will be reassigned on the next bot sync.
          </p>

          <div style={{ marginBottom: '0.75rem' }}>
            <label style={lS}>EVENT NUMBER</label>
            <input type="number" value={newEventNumber} onChange={e => setNewEventNumber(e.target.value)}
              placeholder={currentEvent != null ? String(currentEvent + 1) : '4'} style={{ ...iS, maxWidth: 120 }} />
          </div>

          <label style={lS}>KINGDOM RANGES</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '0.75rem' }}>
            {newRows.map((row, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ color: colors.textMuted, fontSize: '0.7rem', width: 20, textAlign: 'right' }}>{i + 1}.</span>
                <input type="number" value={row.min} onChange={e => { const r = [...newRows]; if (r[i]) r[i].min = e.target.value; setNewRows(r); }}
                  placeholder="Min K" style={{ ...iS, maxWidth: 100 }} />
                <span style={{ color: colors.textMuted, fontSize: '0.8rem' }}>–</span>
                <input type="number" value={row.max} onChange={e => { const r = [...newRows]; if (r[i]) r[i].max = e.target.value; setNewRows(r); }}
                  placeholder="Max K" style={{ ...iS, maxWidth: 100 }} />
                {newRows.length > 1 && (
                  <button onClick={() => setNewRows(newRows.filter((_, j) => j !== i))}
                    style={{ padding: '0.3rem 0.5rem', backgroundColor: 'transparent', border: `1px solid ${colors.error}40`, borderRadius: 6, color: colors.error, fontSize: '0.7rem', cursor: 'pointer' }}>✕</button>
                )}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={() => setNewRows([...newRows, { min: '', max: '' }])}
              style={{ padding: '0.4rem 0.8rem', backgroundColor: 'transparent', border: `1px solid ${colors.border}`, borderRadius: 8, color: colors.textMuted, fontSize: '0.75rem', cursor: 'pointer' }}>
              + Add Range
            </button>
            <button onClick={createNewEvent} disabled={saving || !newEventNumber || newRows.some(r => !r.min || !r.max)}
              style={{ padding: '0.4rem 1rem', backgroundColor: saving ? colors.border : colors.success, border: 'none', borderRadius: 8, color: '#fff', fontSize: '0.75rem', fontWeight: 700, cursor: saving ? 'default' : 'pointer' }}>
              {saving ? '⏳ Creating...' : `Create Event #${newEventNumber || '?'}`}
            </button>
          </div>
        </div>
      )}

      {/* Loading / Error */}
      {loading && <div style={{ padding: '2rem', textAlign: 'center', color: colors.textMuted, fontSize: '0.85rem' }}>Loading transfer groups...</div>}
      {error && <div style={{ padding: '0.75rem', borderRadius: 8, backgroundColor: `${colors.error}10`, border: `1px solid ${colors.error}30`, color: colors.error, fontSize: '0.8rem', marginBottom: '1rem' }}>{error}</div>}

      {/* Active Groups */}
      {!loading && activeGroups.length > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ ...lS, marginBottom: '0.5rem' }}>ACTIVE GROUPS (EVENT #{currentEvent})</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {activeGroups.map(g => (
              <div key={g.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface, borderRadius: 10, border: `1px solid #a855f720`, padding: mob ? '0.65rem 0.85rem' : '0.7rem 1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flex: 1, minWidth: 0 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#a855f7', flexShrink: 0 }} />
                  {editingId === g.id ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <input type="number" value={editMin} onChange={e => setEditMin(e.target.value)} style={{ ...iS, maxWidth: 70, padding: '0.3rem 0.5rem', fontSize: '0.8rem' }} />
                      <span style={{ color: colors.textMuted }}>–</span>
                      <input type="number" value={editMax} onChange={e => setEditMax(e.target.value)} style={{ ...iS, maxWidth: 70, padding: '0.3rem 0.5rem', fontSize: '0.8rem' }} />
                      <button onClick={() => saveEdit(g)} style={{ padding: '0.25rem 0.5rem', backgroundColor: colors.success, border: 'none', borderRadius: 6, color: '#fff', fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer' }}>✓</button>
                      <button onClick={() => setEditingId(null)} style={{ padding: '0.25rem 0.5rem', backgroundColor: 'transparent', border: `1px solid ${colors.border}`, borderRadius: 6, color: colors.textMuted, fontSize: '0.7rem', cursor: 'pointer' }}>✕</button>
                    </div>
                  ) : (
                    <div style={{ minWidth: 0 }}>
                      <div style={{ color: colors.text, fontSize: '0.85rem', fontWeight: 600 }}>Transfer {g.label}</div>
                      <div style={{ color: colors.textMuted, fontSize: '0.65rem' }}>K{g.min_kingdom}–K{g.max_kingdom} · {g.user_count ?? 0} linked users</div>
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flexShrink: 0 }}>
                  {editingId !== g.id && (
                    <button onClick={() => { setEditingId(g.id); setEditMin(String(g.min_kingdom)); setEditMax(String(g.max_kingdom)); }}
                      style={{ padding: '0.25rem 0.5rem', backgroundColor: 'transparent', border: `1px solid ${colors.border}`, borderRadius: 6, color: colors.textMuted, fontSize: '0.65rem', cursor: 'pointer' }}>✏️</button>
                  )}
                  <button onClick={() => toggleActive(g)}
                    style={{ padding: '0.25rem 0.5rem', backgroundColor: 'transparent', border: `1px solid ${colors.error}40`, borderRadius: 6, color: colors.error, fontSize: '0.65rem', cursor: 'pointer' }}>Deactivate</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Inactive Groups */}
      {!loading && inactiveGroups.length > 0 && (
        <div>
          <label style={{ ...lS, marginBottom: '0.5rem' }}>INACTIVE / PAST EVENTS</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            {inactiveGroups.slice(0, 10).map(g => (
              <div key={g.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#0f0f0f', borderRadius: 8, border: `1px solid ${colors.border}`, padding: '0.5rem 0.85rem', opacity: 0.6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: colors.textMuted, flexShrink: 0 }} />
                  <span style={{ color: colors.textMuted, fontSize: '0.8rem' }}>Event #{g.event_number}: {g.label}</span>
                </div>
                <button onClick={() => toggleActive(g)}
                  style={{ padding: '0.2rem 0.5rem', backgroundColor: 'transparent', border: `1px solid ${colors.success}40`, borderRadius: 6, color: colors.success, fontSize: '0.6rem', cursor: 'pointer' }}>Reactivate</button>
              </div>
            ))}
            {inactiveGroups.length > 10 && (
              <div style={{ color: colors.textMuted, fontSize: '0.7rem', textAlign: 'center', padding: '0.3rem' }}>
                +{inactiveGroups.length - 10} more past groups
              </div>
            )}
          </div>
        </div>
      )}

      {/* Info */}
      <div style={{ backgroundColor: `#a855f708`, borderRadius: 10, border: '1px solid #a855f720', padding: '0.75rem 1rem', marginTop: '1rem' }}>
        <div style={{ color: '#a855f7', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem' }}>How it works</div>
        <div style={{ color: colors.textMuted, fontSize: '0.7rem', lineHeight: 1.6 }}>
          The bot creates Discord roles like <strong style={{ color: colors.text }}>Transfer K7-K115</strong> and assigns them based on each user&apos;s linked kingdom. Roles sync every 30 minutes automatically. Changes here take effect on the next sync cycle.
        </div>
      </div>
    </div>
  );
};

export default BotDashboardTransferGroups;
