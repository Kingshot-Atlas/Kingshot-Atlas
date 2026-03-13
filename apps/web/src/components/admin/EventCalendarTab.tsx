import React, { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { colors } from '../../utils/styles';
import { supabase } from '../../lib/supabase';
import { useAllGameEvents, useAllEventMaterials } from '../../hooks/useGameEvents';
import { useToast } from '../Toast';
import { logAdminAction } from '../../utils/adminAuditLog';
import type { GameEvent, GameEventWindow, EventMaterial } from '../../data/eventCalendarTypes';

/**
 * Validates the current Supabase session before admin writes.
 * Stale JWTs cause auth.uid() to return NULL in RLS policies,
 * which silently blocks all INSERT/UPDATE/DELETE (0 rows, no error).
 * This forces a session check so we can surface a clear error.
 */
async function ensureAdminSession(): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!supabase) return { ok: false, message: 'Supabase is not configured.' };
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session) {
    return { ok: false, message: 'Session expired. Please refresh the page or re-login.' };
  }
  // Verify token isn't about to expire (within 30 seconds)
  const expiresAt = session.expires_at ?? 0;
  if (expiresAt * 1000 < Date.now() + 30_000) {
    // Attempt a manual refresh
    const { error: refreshErr } = await supabase.auth.refreshSession();
    if (refreshErr) {
      return { ok: false, message: 'Session refresh failed. Please re-login and try again.' };
    }
  }
  return { ok: true };
}

type SubView = 'events' | 'materials';

export const EventCalendarTab: React.FC = () => {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { data: events = [], isLoading: eventsLoading } = useAllGameEvents();
  const { data: materials = [], isLoading: materialsLoading } = useAllEventMaterials();
  const [subView, setSubView] = useState<SubView>('events');
  const [editingEvent, setEditingEvent] = useState<GameEvent | null>(null);
  const [editingMaterial, setEditingMaterial] = useState<EventMaterial | null>(null);
  const [saving, setSaving] = useState(false);

  const invalidate = useCallback(() => {
    // Nuke public caches entirely so Event Calendar always fetches fresh data
    queryClient.removeQueries({ queryKey: ['game-events'] });
    queryClient.removeQueries({ queryKey: ['event-materials'] });
    // Invalidate admin queries (active observers will refetch immediately)
    queryClient.invalidateQueries({ queryKey: ['game-events-all'] });
    queryClient.invalidateQueries({ queryKey: ['event-materials-all'] });
  }, [queryClient]);

  const toggleEventActive = async (event: GameEvent) => {
    if (!supabase) return;
    const session = await ensureAdminSession();
    if (!session.ok) { showToast(session.message, 'error', 5000); return; }

    // Optimistic update — flip is_active in cache immediately
    const prevEvents = queryClient.getQueryData<GameEvent[]>(['game-events-all']);
    queryClient.setQueryData<GameEvent[]>(['game-events-all'], old =>
      old?.map(e => e.id === event.id ? { ...e, is_active: !e.is_active } : e)
    );

    const { data, error } = await supabase
      .from('game_events')
      .update({ is_active: !event.is_active })
      .eq('id', event.id)
      .select('id');
    if (error || !data || data.length === 0) {
      // Rollback on failure
      queryClient.setQueryData(['game-events-all'], prevEvents);
      showToast(error ? `Failed: ${error.message}` : 'Update blocked by RLS. Try refreshing or re-logging in.', 'error', 5000);
      return;
    }
    showToast(`${event.name} ${event.is_active ? 'deactivated' : 'activated'}`, 'success');
    logAdminAction({ action: 'event.toggle_active', targetTable: 'game_events', targetId: event.id, details: { name: event.name, is_active: !event.is_active } });
    invalidate();
  };

  const toggleMaterialActive = async (mat: EventMaterial) => {
    if (!supabase) return;
    const session = await ensureAdminSession();
    if (!session.ok) { showToast(session.message, 'error', 5000); return; }

    // Optimistic update — flip is_active in cache immediately
    const prevMaterials = queryClient.getQueryData<EventMaterial[]>(['event-materials-all']);
    queryClient.setQueryData<EventMaterial[]>(['event-materials-all'], old =>
      old?.map(m => m.id === mat.id ? { ...m, is_active: !m.is_active } : m)
    );

    const { data, error } = await supabase
      .from('event_materials')
      .update({ is_active: !mat.is_active })
      .eq('id', mat.id)
      .select('id');
    if (error || !data || data.length === 0) {
      // Rollback on failure
      queryClient.setQueryData(['event-materials-all'], prevMaterials);
      showToast(error ? `Failed: ${error.message}` : 'Update blocked by RLS. Try refreshing or re-logging in.', 'error', 5000);
      return;
    }
    showToast(`${mat.name} ${mat.is_active ? 'deactivated' : 'activated'}`, 'success');
    logAdminAction({ action: 'material.toggle_active', targetTable: 'event_materials', targetId: mat.id, details: { name: mat.name, is_active: !mat.is_active } });
    invalidate();
  };

  const pendingDeleteRef = React.useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const deleteEvent = async (event: GameEvent) => {
    if (!supabase) return;
    const session = await ensureAdminSession();
    if (!session.ok) { showToast(session.message, 'error', 5000); return; }

    // Optimistically remove from admin cache
    const prevEvents = queryClient.getQueryData<GameEvent[]>(['game-events-all']);
    queryClient.setQueryData<GameEvent[]>(['game-events-all'], old =>
      old?.filter(e => e.id !== event.id)
    );

    // Schedule actual delete after 5s
    const timer = setTimeout(async () => {
      pendingDeleteRef.current.delete(event.id);
      const { error } = await supabase!.from('game_events').delete().eq('id', event.id);
      if (error) {
        showToast(`Failed to delete: ${error.message}`, 'error', 5000);
        queryClient.setQueryData(['game-events-all'], prevEvents);
        return;
      }
      logAdminAction({ action: 'event.delete', targetTable: 'game_events', targetId: event.id, details: { name: event.name } });
      invalidate();
    }, 5000);
    pendingDeleteRef.current.set(event.id, timer);

    showToast(`${event.name} deleted`, 'info', 5000, () => {
      // Undo: cancel the pending delete and restore cache
      const pending = pendingDeleteRef.current.get(event.id);
      if (pending) { clearTimeout(pending); pendingDeleteRef.current.delete(event.id); }
      queryClient.setQueryData(['game-events-all'], prevEvents);
      showToast(`${event.name} restored`, 'success');
    }, 'Undo');
  };

  const duplicateEvent = async (event: GameEvent) => {
    if (!supabase) return;
    const session = await ensureAdminSession();
    if (!session.ok) { showToast(session.message, 'error', 5000); return; }
    setSaving(true);
    let created = false;
    try {
      const { data: newEvent, error: createErr } = await supabase.from('game_events').insert({
        name: `${event.name} (copy)`,
        event_kind: event.event_kind,
        cadence_weeks: event.cadence_weeks,
        anchor_start_at: event.anchor_start_at,
        anchor_end_at: event.anchor_end_at,
        color: event.color,
        emoji: event.emoji,
        notes: event.notes,
        is_active: false,
      }).select('id').single();
      if (createErr || !newEvent) { showToast(createErr ? `Failed: ${createErr.message}` : 'Blocked by RLS', 'error', 5000); return; }
      created = true;
      for (const w of event.windows) {
        const { data: newWin, error: winErr } = await supabase.from('game_event_windows').insert({
          event_id: newEvent.id,
          label: w.label,
          start_offset_minutes: w.start_offset_minutes,
          end_offset_minutes: w.end_offset_minutes,
          display_order: w.display_order,
        }).select('id').single();
        if (winErr || !newWin) { showToast(`Failed to copy window "${w.label}"`, 'error', 5000); return; }
        if (w.material_ids.length > 0) {
          await supabase.from('game_event_window_materials').insert(
            w.material_ids.map(mid => ({ window_id: newWin.id, material_id: mid }))
          );
        }
      }
      showToast(`Duplicated as "${event.name} (copy)" (inactive)`, 'success');
      logAdminAction({ action: 'event.duplicate', targetTable: 'game_events', targetId: newEvent.id, details: { source: event.name } });
    } catch (err) {
      showToast(`Unexpected error: ${err instanceof Error ? err.message : String(err)}`, 'error', 5000);
    } finally {
      if (created) invalidate();
      setSaving(false);
    }
  };

  const deleteMaterial = async (mat: EventMaterial) => {
    if (!supabase) return;
    const session = await ensureAdminSession();
    if (!session.ok) { showToast(session.message, 'error', 5000); return; }

    // Optimistically remove from admin cache
    const prevMats = queryClient.getQueryData<EventMaterial[]>(['event-materials-all']);
    queryClient.setQueryData<EventMaterial[]>(['event-materials-all'], old =>
      old?.filter(m => m.id !== mat.id)
    );

    // Schedule actual delete after 5s
    const timer = setTimeout(async () => {
      pendingDeleteRef.current.delete(mat.id);
      const { error } = await supabase!.from('event_materials').delete().eq('id', mat.id);
      if (error) {
        showToast(`Failed to delete: ${error.message}`, 'error', 5000);
        queryClient.setQueryData(['event-materials-all'], prevMats);
        return;
      }
      logAdminAction({ action: 'material.delete', targetTable: 'event_materials', targetId: mat.id, details: { name: mat.name } });
      invalidate();
    }, 5000);
    pendingDeleteRef.current.set(mat.id, timer);

    showToast(`${mat.name} deleted`, 'info', 5000, () => {
      // Undo: cancel the pending delete and restore cache
      const pending = pendingDeleteRef.current.get(mat.id);
      if (pending) { clearTimeout(pending); pendingDeleteRef.current.delete(mat.id); }
      queryClient.setQueryData(['event-materials-all'], prevMats);
      showToast(`${mat.name} restored`, 'success');
    }, 'Undo');
  };

  const moveMaterial = async (mat: EventMaterial, direction: 'up' | 'down') => {
    if (!supabase) return;
    const sorted = [...materials].sort((a, b) => a.sort_order - b.sort_order);
    const idx = sorted.findIndex(m => m.id === mat.id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const other = sorted[swapIdx]!;
    // Swap sort_order values
    const session = await ensureAdminSession();
    if (!session.ok) { showToast(session.message, 'error', 5000); return; }
    const { error: e1 } = await supabase.from('event_materials').update({ sort_order: other.sort_order }).eq('id', mat.id).select('id');
    const { error: e2 } = await supabase.from('event_materials').update({ sort_order: mat.sort_order }).eq('id', other.id).select('id');
    if (e1 || e2) { showToast('Failed to reorder', 'error', 5000); return; }
    invalidate();
  };

  const getNextOccurrence = (event: GameEvent): string => {
    if (event.event_kind === 'special') {
      const start = new Date(event.anchor_start_at);
      return start > new Date() ? start.toLocaleDateString() : 'Past';
    }
    if (!event.cadence_weeks) return '—';
    const anchor = new Date(event.anchor_start_at).getTime();
    const cadenceMs = event.cadence_weeks * 7 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const cycles = Math.ceil((now - anchor) / cadenceMs);
    const next = new Date(anchor + cycles * cadenceMs);
    return next.toLocaleDateString();
  };

  const getCadenceLabel = (event: GameEvent): string => {
    if (event.event_kind === 'special') return 'Special';
    if (!event.cadence_weeks) return '—';
    if (event.cadence_weeks === 1) return 'Weekly';
    if (event.cadence_weeks === 2) return 'Biweekly';
    return `${event.cadence_weeks}w cycle`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Header */}
      <div style={{
        backgroundColor: colors.cardAlt,
        borderRadius: '10px',
        border: `1px solid ${colors.border}`,
        padding: '1rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '1.1rem' }}>📅</span>
          <span style={{ color: colors.text, fontWeight: 700, fontSize: '1rem' }}>Event Calendar Manager</span>
        </div>
        <p style={{ color: colors.textMuted, fontSize: '0.75rem', margin: 0, lineHeight: 1.6 }}>
          Manage game events, scoring windows, and materials. Changes are reflected immediately for all users.
        </p>
      </div>

      {/* Sub-tab navigation */}
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        {([
          { key: 'events' as SubView, label: '📅 Events', count: events.length },
          { key: 'materials' as SubView, label: '📦 Materials', count: materials.length },
        ]).map(tab => (
          <button
            key={tab.key}
            onClick={() => { setSubView(tab.key); setEditingEvent(null); setEditingMaterial(null); }}
            style={{
              padding: '0.4rem 0.85rem',
              backgroundColor: subView === tab.key ? `${colors.primary}20` : 'transparent',
              border: `1px solid ${subView === tab.key ? `${colors.primary}40` : colors.border}`,
              borderRadius: '6px',
              color: subView === tab.key ? colors.primary : colors.textMuted,
              fontSize: '0.8rem',
              minHeight: '44px',
              fontWeight: subView === tab.key ? 600 : 400,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem',
            }}
          >
            {tab.label}
            <span style={{
              backgroundColor: `${colors.primary}30`,
              color: colors.primary,
              fontSize: '0.6rem',
              fontWeight: 700,
              padding: '0.1rem 0.35rem',
              borderRadius: '8px',
            }}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* ─── EVENTS LIST ─── */}
      {subView === 'events' && !editingEvent && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {eventsLoading ? (
            <p style={{ color: colors.textMuted, fontSize: '0.8rem', textAlign: 'center', padding: '2rem 0' }}>Loading events...</p>
          ) : events.length === 0 ? (
            <p style={{ color: colors.textMuted, fontSize: '0.8rem', textAlign: 'center', padding: '2rem 0' }}>No events configured yet.</p>
          ) : events.map(event => (
            <div key={event.id} style={{
              backgroundColor: colors.cardAlt,
              borderRadius: '8px',
              border: `1px solid ${event.is_active ? `${event.color}30` : colors.border}`,
              padding: '0.75rem 1rem',
              opacity: event.is_active ? 1 : 0.6,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '1rem' }}>{event.emoji}</span>
                  <span style={{ color: event.color, fontWeight: 600, fontSize: '0.9rem' }}>{event.name}</span>
                  <span style={{
                    backgroundColor: `${event.color}15`,
                    color: event.color,
                    fontSize: '0.6rem',
                    fontWeight: 700,
                    padding: '0.1rem 0.4rem',
                    borderRadius: '6px',
                    border: `1px solid ${event.color}30`,
                  }}>
                    {getCadenceLabel(event)}
                  </span>
                  {!event.is_active && (
                    <span style={{
                      backgroundColor: `${colors.error}15`,
                      color: colors.error,
                      fontSize: '0.6rem',
                      fontWeight: 700,
                      padding: '0.1rem 0.4rem',
                      borderRadius: '6px',
                    }}>
                      INACTIVE
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ color: colors.textMuted, fontSize: '0.7rem' }}>
                    Next: {getNextOccurrence(event)}
                  </span>
                  <span style={{ color: colors.textMuted, fontSize: '0.65rem' }}>
                    ({event.windows.length} windows)
                  </span>
                </div>
              </div>

              {/* Window summary */}
              {event.windows.length > 0 && (
                <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                  {event.windows.map(w => (
                    <span key={w.id} style={{
                      backgroundColor: colors.bg,
                      color: colors.textSecondary,
                      fontSize: '0.65rem',
                      padding: '0.15rem 0.4rem',
                      borderRadius: '4px',
                      border: `1px solid ${colors.border}`,
                    }}>
                      {w.label}
                      <span style={{ color: colors.textMuted, marginLeft: '0.3rem' }}>
                        ({w.material_ids.length} mat)
                      </span>
                    </span>
                  ))}
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                <button
                  onClick={() => setEditingEvent(event)}
                  style={{
                    padding: '0.3rem 0.6rem',
                    backgroundColor: `${colors.primary}15`,
                    border: `1px solid ${colors.primary}30`,
                    borderRadius: '4px',
                    color: colors.primary,
                    fontSize: '0.7rem',
                    cursor: 'pointer',
                  }}
                >
                  Edit
                </button>
                <button
                  onClick={() => duplicateEvent(event)}
                  disabled={saving}
                  style={{
                    padding: '0.3rem 0.6rem',
                    backgroundColor: `${colors.primary}08`,
                    border: `1px solid ${colors.border}`,
                    borderRadius: '4px',
                    color: colors.textSecondary,
                    fontSize: '0.7rem',
                    cursor: saving ? 'not-allowed' : 'pointer',
                  }}
                >
                  Duplicate
                </button>
                <button
                  onClick={() => toggleEventActive(event)}
                  style={{
                    padding: '0.3rem 0.6rem',
                    backgroundColor: 'transparent',
                    border: `1px solid ${colors.border}`,
                    borderRadius: '4px',
                    color: event.is_active ? colors.warning : colors.success,
                    fontSize: '0.7rem',
                    cursor: 'pointer',
                  }}
                >
                  {event.is_active ? 'Deactivate' : 'Activate'}
                </button>
                <button
                  onClick={() => deleteEvent(event)}
                  style={{
                    padding: '0.3rem 0.6rem',
                    backgroundColor: `${colors.error}10`,
                    border: `1px solid ${colors.error}30`,
                    borderRadius: '4px',
                    color: colors.error,
                    fontSize: '0.7rem',
                    cursor: 'pointer',
                    marginLeft: 'auto',
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}

          <button
            onClick={() => setEditingEvent({
              id: '',
              name: '',
              event_kind: 'cyclical',
              cadence_weeks: 4,
              anchor_start_at: new Date().toISOString(),
              anchor_end_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
              color: '#22d3ee',
              emoji: '📅',
              is_active: true,
              notes: null,
              windows: [],
            })}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: `${colors.success}15`,
              border: `1px solid ${colors.success}40`,
              borderRadius: '8px',
              color: colors.success,
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
              width: 'fit-content',
            }}
          >
            + New Event
          </button>
        </div>
      )}

      {/* ─── EVENT EDITOR ─── */}
      {subView === 'events' && editingEvent && (
        <EventEditor
          event={editingEvent}
          materials={materials}
          saving={saving}
          onSave={async (updated) => {
            if (!supabase) return;
            const session = await ensureAdminSession();
            if (!session.ok) { showToast(session.message, 'error', 5000); return; }
            setSaving(true);
            try {
              if (updated.id) {
                // Update existing event
                const { data: updatedRow, error: eventErr } = await supabase.from('game_events').update({
                  name: updated.name,
                  event_kind: updated.event_kind,
                  cadence_weeks: updated.cadence_weeks,
                  anchor_start_at: updated.anchor_start_at,
                  anchor_end_at: updated.anchor_end_at,
                  color: updated.color,
                  emoji: updated.emoji,
                  notes: updated.notes,
                }).eq('id', updated.id).select('id');
                if (eventErr) { showToast(`Failed to update event: ${eventErr.message}`, 'error', 5000); return; }
                if (!updatedRow || updatedRow.length === 0) { showToast('Event update blocked by RLS. Try refreshing or re-logging in.', 'error', 5000); return; }

                // Delete old windows (cascade deletes window_materials via FK)
                const { error: delErr } = await supabase.from('game_event_windows').delete().eq('event_id', updated.id);
                if (delErr) { showToast(`Failed to delete old windows: ${delErr.message}`, 'error', 5000); return; }

                // Insert new windows + material assignments
                for (const w of updated.windows) {
                  const { data: newWin, error: winErr } = await supabase.from('game_event_windows').insert({
                    event_id: updated.id,
                    label: w.label,
                    start_offset_minutes: w.start_offset_minutes,
                    end_offset_minutes: w.end_offset_minutes,
                    display_order: w.display_order,
                  }).select('id').single();
                  if (winErr) { showToast(`Failed to create window "${w.label}": ${winErr.message}`, 'error', 5000); return; }
                  if (!newWin) { showToast(`Window "${w.label}" insert blocked by RLS.`, 'error', 5000); return; }
                  if (w.material_ids.length > 0) {
                    const { error: matErr } = await supabase.from('game_event_window_materials').insert(
                      w.material_ids.map(mid => ({ window_id: newWin.id, material_id: mid }))
                    );
                    if (matErr) { showToast(`Failed to assign materials to "${w.label}": ${matErr.message}`, 'error', 5000); return; }
                  }
                }
                showToast(`${updated.name} updated successfully`, 'success');
                logAdminAction({ action: 'event.update', targetTable: 'game_events', targetId: updated.id, details: { name: updated.name, windows: updated.windows.length } });
              } else {
                // Create new event
                const { data: newEvent, error: createErr } = await supabase.from('game_events').insert({
                  name: updated.name,
                  event_kind: updated.event_kind,
                  cadence_weeks: updated.cadence_weeks,
                  anchor_start_at: updated.anchor_start_at,
                  anchor_end_at: updated.anchor_end_at,
                  color: updated.color,
                  emoji: updated.emoji,
                  notes: updated.notes,
                }).select('id').single();
                if (createErr) { showToast(`Failed to create event: ${createErr.message}`, 'error', 5000); return; }
                if (!newEvent) { showToast('Event creation blocked by RLS. Verify you are logged in as admin.', 'error', 5000); return; }

                for (const w of updated.windows) {
                  const { data: newWin, error: winErr } = await supabase.from('game_event_windows').insert({
                    event_id: newEvent.id,
                    label: w.label,
                    start_offset_minutes: w.start_offset_minutes,
                    end_offset_minutes: w.end_offset_minutes,
                    display_order: w.display_order,
                  }).select('id').single();
                  if (winErr) { showToast(`Failed to create window "${w.label}": ${winErr.message}`, 'error', 5000); return; }
                  if (!newWin) { showToast(`Window "${w.label}" insert blocked by RLS.`, 'error', 5000); return; }
                  if (w.material_ids.length > 0) {
                    const { error: matErr } = await supabase.from('game_event_window_materials').insert(
                      w.material_ids.map(mid => ({ window_id: newWin.id, material_id: mid }))
                    );
                    if (matErr) { showToast(`Failed to assign materials to "${w.label}": ${matErr.message}`, 'error', 5000); return; }
                  }
                }
                showToast(`${updated.name} created successfully`, 'success');
                logAdminAction({ action: 'event.create', targetTable: 'game_events', targetId: newEvent.id, details: { name: updated.name, windows: updated.windows.length } });
              }
              invalidate();
              setEditingEvent(null);
            } catch (err) {
              showToast(`Unexpected error: ${err instanceof Error ? err.message : String(err)}`, 'error', 5000);
            } finally {
              setSaving(false);
            }
          }}
          onCancel={() => setEditingEvent(null)}
        />
      )}

      {/* ─── MATERIALS LIST ─── */}
      {subView === 'materials' && !editingMaterial && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {materialsLoading ? (
            <p style={{ color: colors.textMuted, fontSize: '0.8rem', textAlign: 'center', padding: '2rem 0' }}>Loading materials...</p>
          ) : materials.map(mat => (
            <div key={mat.id} style={{
              backgroundColor: colors.cardAlt,
              borderRadius: '6px',
              border: `1px solid ${colors.border}`,
              padding: '0.5rem 0.75rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              opacity: mat.is_active ? 1 : 0.5,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1rem' }}>{mat.emoji}</span>
                <span style={{ color: colors.text, fontWeight: 500, fontSize: '0.85rem' }}>{mat.name}</span>
                <span style={{
                  backgroundColor: colors.bg,
                  color: colors.textMuted,
                  fontSize: '0.6rem',
                  padding: '0.1rem 0.35rem',
                  borderRadius: '4px',
                }}>
                  {mat.category}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                <button
                  onClick={() => moveMaterial(mat, 'up')}
                  style={{
                    padding: '0.2rem 0.35rem',
                    backgroundColor: 'transparent',
                    border: `1px solid ${colors.border}`,
                    borderRadius: '4px',
                    color: colors.textMuted,
                    fontSize: '0.7rem',
                    cursor: 'pointer',
                    lineHeight: 1,
                  }}
                  title="Move up"
                >
                  ▲
                </button>
                <button
                  onClick={() => moveMaterial(mat, 'down')}
                  style={{
                    padding: '0.2rem 0.35rem',
                    backgroundColor: 'transparent',
                    border: `1px solid ${colors.border}`,
                    borderRadius: '4px',
                    color: colors.textMuted,
                    fontSize: '0.7rem',
                    cursor: 'pointer',
                    lineHeight: 1,
                  }}
                  title="Move down"
                >
                  ▼
                </button>
                <button
                  onClick={() => setEditingMaterial(mat)}
                  style={{
                    padding: '0.25rem 0.5rem',
                    backgroundColor: `${colors.primary}15`,
                    border: `1px solid ${colors.primary}30`,
                    borderRadius: '4px',
                    color: colors.primary,
                    fontSize: '0.65rem',
                    cursor: 'pointer',
                  }}
                >
                  Edit
                </button>
                <button
                  onClick={() => toggleMaterialActive(mat)}
                  style={{
                    padding: '0.25rem 0.5rem',
                    backgroundColor: 'transparent',
                    border: `1px solid ${colors.border}`,
                    borderRadius: '4px',
                    color: mat.is_active ? colors.warning : colors.success,
                    fontSize: '0.65rem',
                    cursor: 'pointer',
                  }}
                >
                  {mat.is_active ? 'Deactivate' : 'Activate'}
                </button>
                <button
                  onClick={() => deleteMaterial(mat)}
                  style={{
                    padding: '0.25rem 0.5rem',
                    backgroundColor: `${colors.error}10`,
                    border: `1px solid ${colors.error}30`,
                    borderRadius: '4px',
                    color: colors.error,
                    fontSize: '0.65rem',
                    cursor: 'pointer',
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}

          <button
            onClick={() => setEditingMaterial({ id: '', name: '', emoji: '📦', category: 'general', sort_order: 99, is_active: true })}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: `${colors.success}15`,
              border: `1px solid ${colors.success}40`,
              borderRadius: '8px',
              color: colors.success,
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
              width: 'fit-content',
            }}
          >
            + New Material
          </button>
        </div>
      )}

      {/* ─── MATERIAL EDITOR ─── */}
      {subView === 'materials' && editingMaterial && (
        <MaterialEditor
          material={editingMaterial}
          saving={saving}
          onSave={async (mat) => {
            if (!supabase) return;
            const session = await ensureAdminSession();
            if (!session.ok) { showToast(session.message, 'error', 5000); return; }
            setSaving(true);
            try {
              if (mat.id) {
                const { data, error } = await supabase.from('event_materials').update({
                  name: mat.name,
                  emoji: mat.emoji,
                  category: mat.category,
                  sort_order: mat.sort_order,
                }).eq('id', mat.id).select('id');
                if (error) { showToast(`Failed to update material: ${error.message}`, 'error', 5000); return; }
                if (!data || data.length === 0) { showToast('Material update blocked by RLS. Try refreshing or re-logging in.', 'error', 5000); return; }
                showToast(`${mat.name} updated`, 'success');
                logAdminAction({ action: 'material.update', targetTable: 'event_materials', targetId: mat.id, details: { name: mat.name } });
              } else {
                const { data, error } = await supabase.from('event_materials').insert({
                  name: mat.name,
                  emoji: mat.emoji,
                  category: mat.category,
                  sort_order: mat.sort_order,
                }).select('id');
                if (error) { showToast(`Failed to create material: ${error.message}`, 'error', 5000); return; }
                if (!data || data.length === 0) { showToast('Material creation blocked by RLS. Verify you are logged in as admin.', 'error', 5000); return; }
                showToast(`${mat.name} created`, 'success');
                logAdminAction({ action: 'material.create', targetTable: 'event_materials', targetId: data[0]?.id, details: { name: mat.name } });
              }
              invalidate();
              setEditingMaterial(null);
            } catch (err) {
              showToast(`Unexpected error: ${err instanceof Error ? err.message : String(err)}`, 'error', 5000);
            } finally {
              setSaving(false);
            }
          }}
          onCancel={() => setEditingMaterial(null)}
        />
      )}
    </div>
  );
};

/* ─── EVENT EDITOR ─── */
const EventEditor: React.FC<{
  event: GameEvent;
  materials: EventMaterial[];
  saving: boolean;
  onSave: (event: GameEvent) => void;
  onCancel: () => void;
}> = ({ event, materials, saving, onSave, onCancel }) => {
  const [form, setForm] = useState<GameEvent>({ ...event });
  const { showToast } = useToast();

  /** Validate window offset continuity — no gaps or overlaps */
  const validateWindows = (): string | null => {
    if (form.windows.length === 0) return null; // no windows is valid
    const sorted = [...form.windows].sort((a, b) => a.start_offset_minutes - b.start_offset_minutes);
    for (const w of sorted) {
      if (w.start_offset_minutes >= w.end_offset_minutes) {
        return `Window "${w.label}" has start >= end (${w.start_offset_minutes} >= ${w.end_offset_minutes}).`;
      }
    }
    if (sorted[0]!.start_offset_minutes !== 0) {
      return `First window "${sorted[0]!.label}" should start at 0 (currently ${sorted[0]!.start_offset_minutes}).`;
    }
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1]!;
      const curr = sorted[i]!;
      if (curr.start_offset_minutes < prev.end_offset_minutes) {
        return `Windows "${prev.label}" and "${curr.label}" overlap (${prev.end_offset_minutes} > ${curr.start_offset_minutes}).`;
      }
      if (curr.start_offset_minutes > prev.end_offset_minutes) {
        return `Gap between "${prev.label}" and "${curr.label}" (${prev.end_offset_minutes} → ${curr.start_offset_minutes}).`;
      }
    }
    return null;
  };

  const handleSave = () => {
    const err = validateWindows();
    if (err) {
      showToast(err, 'error', 5000);
      return;
    }
    onSave(form);
  };

  const updateField = <K extends keyof GameEvent>(key: K, value: GameEvent[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const addWindow = () => {
    const nextOrder = form.windows.length + 1;
    setForm(prev => ({
      ...prev,
      windows: [...prev.windows, {
        id: `new_${Date.now()}`,
        event_id: form.id,
        label: `Phase ${nextOrder}`,
        start_offset_minutes: prev.windows.length > 0
          ? prev.windows[prev.windows.length - 1]!.end_offset_minutes
          : 0,
        end_offset_minutes: prev.windows.length > 0
          ? prev.windows[prev.windows.length - 1]!.end_offset_minutes + 1440
          : 1440,
        display_order: nextOrder,
        material_ids: [],
      }],
    }));
  };

  const duplicateWindow = (idx: number) => {
    setForm(prev => {
      const source = prev.windows[idx]!;
      const duration = source.end_offset_minutes - source.start_offset_minutes;
      const lastEnd = prev.windows.length > 0
        ? Math.max(...prev.windows.map(w => w.end_offset_minutes))
        : 0;
      return {
        ...prev,
        windows: [...prev.windows, {
          id: `new_${Date.now()}`,
          event_id: form.id,
          label: `${source.label} (copy)`,
          start_offset_minutes: lastEnd,
          end_offset_minutes: lastEnd + duration,
          display_order: prev.windows.length + 1,
          material_ids: [...source.material_ids],
        }],
      };
    });
  };

  const removeWindow = (idx: number) => {
    setForm(prev => ({
      ...prev,
      windows: prev.windows.filter((_, i) => i !== idx),
    }));
  };

  const updateWindow = (idx: number, patch: Partial<GameEventWindow>) => {
    setForm(prev => ({
      ...prev,
      windows: prev.windows.map((w, i) => i === idx ? { ...w, ...patch } : w),
    }));
  };

  const toggleWindowMaterial = (idx: number, materialId: string) => {
    setForm(prev => ({
      ...prev,
      windows: prev.windows.map((w, i) => {
        if (i !== idx) return w;
        const has = w.material_ids.includes(materialId);
        return { ...w, material_ids: has ? w.material_ids.filter(id => id !== materialId) : [...w.material_ids, materialId] };
      }),
    }));
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.5rem 0.75rem',
    backgroundColor: colors.bg,
    border: `1px solid ${colors.border}`,
    borderRadius: '6px',
    color: colors.text,
    fontSize: '0.85rem',
    outline: 'none',
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    color: colors.textSecondary,
    fontSize: '0.75rem',
    fontWeight: 600,
    display: 'block',
    marginBottom: '0.3rem',
  };

  return (
    <div style={{
      backgroundColor: colors.cardAlt,
      borderRadius: '10px',
      border: `1px solid ${colors.border}`,
      padding: '1rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <span style={{ color: colors.text, fontWeight: 700, fontSize: '0.95rem' }}>
          {form.id ? 'Edit Event' : 'New Event'}
        </span>
        <button onClick={onCancel} style={{ background: 'none', border: 'none', color: colors.textMuted, cursor: 'pointer', fontSize: '0.8rem' }}>
          ✕ Cancel
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {/* Name + Emoji */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.5rem' }}>
          <div>
            <label style={labelStyle}>Event Name</label>
            <input value={form.name} onChange={e => updateField('name', e.target.value)} style={inputStyle} placeholder="e.g. Strongest Governor" />
          </div>
          <div>
            <label style={labelStyle}>Emoji</label>
            <input value={form.emoji} onChange={e => updateField('emoji', e.target.value)} style={{ ...inputStyle, width: '60px', textAlign: 'center' }} />
          </div>
        </div>

        {/* Kind + Cadence + Color */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
          <div>
            <label style={labelStyle}>Type</label>
            <select
              value={form.event_kind}
              onChange={e => updateField('event_kind', e.target.value as 'cyclical' | 'special')}
              style={inputStyle}
            >
              <option value="cyclical">Cyclical</option>
              <option value="special">Special</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Cadence (weeks)</label>
            <input
              type="number"
              min={1}
              value={form.cadence_weeks || ''}
              onChange={e => updateField('cadence_weeks', e.target.value ? parseInt(e.target.value) : null)}
              style={inputStyle}
              disabled={form.event_kind === 'special'}
            />
          </div>
          <div>
            <label style={labelStyle}>Color</label>
            <input type="color" value={form.color} onChange={e => updateField('color', e.target.value)} style={{ ...inputStyle, padding: '0.25rem', height: '36px' }} />
          </div>
        </div>

        {/* Anchor dates */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
          <div>
            <label style={labelStyle}>Anchor Start (UTC)</label>
            <input
              type="datetime-local"
              value={form.anchor_start_at.slice(0, 16)}
              onChange={e => updateField('anchor_start_at', e.target.value + ':00Z')}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Anchor End (UTC)</label>
            <input
              type="datetime-local"
              value={form.anchor_end_at.slice(0, 16)}
              onChange={e => updateField('anchor_end_at', e.target.value + ':00Z')}
              style={inputStyle}
            />
          </div>
        </div>

        {/* Notes */}
        <div>
          <label style={labelStyle}>Notes</label>
          <textarea
            value={form.notes || ''}
            onChange={e => updateField('notes', e.target.value || null)}
            style={{ ...inputStyle, minHeight: '60px', resize: 'vertical', fontFamily: 'inherit' }}
            placeholder="Optional admin notes"
          />
        </div>

        {/* ─── WINDOWS BUILDER ─── */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <label style={{ ...labelStyle, marginBottom: 0 }}>Scoring Windows ({form.windows.length})</label>
            <button onClick={addWindow} style={{
              padding: '0.25rem 0.6rem',
              backgroundColor: `${colors.success}15`,
              border: `1px solid ${colors.success}40`,
              borderRadius: '4px',
              color: colors.success,
              fontSize: '0.7rem',
              cursor: 'pointer',
            }}>
              + Add Window
            </button>
          </div>

          {form.windows.map((w, idx) => (
            <div key={w.id} style={{
              backgroundColor: colors.bg,
              borderRadius: '6px',
              border: `1px solid ${colors.border}`,
              padding: '0.6rem',
              marginBottom: '0.5rem',
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px auto auto', gap: '0.4rem', alignItems: 'end' }}>
                <div>
                  <label style={{ ...labelStyle, fontSize: '0.65rem' }}>Label</label>
                  <input
                    value={w.label}
                    onChange={e => updateWindow(idx, { label: e.target.value })}
                    style={{ ...inputStyle, fontSize: '0.8rem', padding: '0.35rem 0.5rem' }}
                  />
                </div>
                <div>
                  <label style={{ ...labelStyle, fontSize: '0.65rem' }}>Start (min)</label>
                  <input
                    type="number"
                    value={w.start_offset_minutes}
                    onChange={e => updateWindow(idx, { start_offset_minutes: parseInt(e.target.value) || 0 })}
                    style={{ ...inputStyle, fontSize: '0.8rem', padding: '0.35rem 0.5rem' }}
                  />
                </div>
                <div>
                  <label style={{ ...labelStyle, fontSize: '0.65rem' }}>End (min)</label>
                  <input
                    type="number"
                    value={w.end_offset_minutes}
                    onChange={e => updateWindow(idx, { end_offset_minutes: parseInt(e.target.value) || 0 })}
                    style={{ ...inputStyle, fontSize: '0.8rem', padding: '0.35rem 0.5rem' }}
                  />
                </div>
                <button onClick={() => duplicateWindow(idx)} title="Duplicate window" style={{
                  padding: '0.35rem',
                  backgroundColor: `${colors.primary}10`,
                  border: `1px solid ${colors.primary}30`,
                  borderRadius: '4px',
                  color: colors.primary,
                  fontSize: '0.7rem',
                  cursor: 'pointer',
                  alignSelf: 'end',
                }}>
                  ⧉
                </button>
                <button onClick={() => removeWindow(idx)} style={{
                  padding: '0.35rem',
                  backgroundColor: `${colors.error}15`,
                  border: `1px solid ${colors.error}30`,
                  borderRadius: '4px',
                  color: colors.error,
                  fontSize: '0.7rem',
                  cursor: 'pointer',
                  alignSelf: 'end',
                }}>
                  ✕
                </button>
              </div>

              {/* Material chips */}
              <div style={{ marginTop: '0.4rem' }}>
                <label style={{ ...labelStyle, fontSize: '0.6rem' }}>Materials</label>
                <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                  {materials.filter(m => m.is_active).map(m => {
                    const selected = w.material_ids.includes(m.id);
                    return (
                      <button
                        key={m.id}
                        onClick={() => toggleWindowMaterial(idx, m.id)}
                        style={{
                          padding: '0.15rem 0.4rem',
                          backgroundColor: selected ? `${colors.primary}20` : 'transparent',
                          border: `1px solid ${selected ? `${colors.primary}50` : colors.border}`,
                          borderRadius: '4px',
                          color: selected ? colors.primary : colors.textMuted,
                          fontSize: '0.65rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.2rem',
                        }}
                      >
                        {m.emoji} {m.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ─── Live Calendar Preview ─── */}
        {form.anchor_start_at && form.windows.length > 0 && (() => {
          const anchor = new Date(form.anchor_start_at);
          if (isNaN(anchor.getTime())) return null;
          // Show 14-day preview starting from anchor - 2 days
          const previewStart = new Date(anchor.getTime() - 2 * 86400000);
          const previewDays: string[] = [];
          for (let i = 0; i < 14; i++) {
            const d = new Date(previewStart.getTime() + i * 86400000);
            previewDays.push(d.toISOString().slice(0, 10));
          }
          // Build window spans
          const windowSpans = form.windows.map(w => {
            const start = new Date(anchor.getTime() + w.start_offset_minutes * 60000);
            const end = new Date(anchor.getTime() + w.end_offset_minutes * 60000 - 60000); // -1 min for last active moment
            return {
              label: w.label,
              startStr: start.toISOString().slice(0, 10),
              endStr: end.toISOString().slice(0, 10),
            };
          });
          const todayStr = new Date().toISOString().slice(0, 10);
          return (
            <div style={{
              backgroundColor: colors.bg,
              borderRadius: '8px',
              border: `1px solid ${colors.border}`,
              padding: '0.75rem',
            }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: colors.textSecondary, marginBottom: '0.5rem' }}>
                📅 Calendar Preview
              </div>
              {/* Day headers */}
              <div style={{ display: 'grid', gridTemplateColumns: `60px repeat(14, 1fr)`, gap: 0, fontSize: '0.5rem' }}>
                <div />
                {previewDays.map(d => {
                  const dt = new Date(d + 'T12:00:00Z');
                  const isToday = d === todayStr;
                  return (
                    <div key={d} style={{
                      textAlign: 'center',
                      color: isToday ? '#22d3ee' : colors.textMuted,
                      fontWeight: isToday ? 700 : 400,
                      padding: '0.15rem 0',
                      borderBottom: `1px solid ${colors.borderSubtle}`,
                    }}>
                      <div>{dt.toLocaleDateString('en-US', { weekday: 'narrow', timeZone: 'UTC' })}</div>
                      <div>{String(dt.getUTCMonth() + 1)}/{String(dt.getUTCDate())}</div>
                    </div>
                  );
                })}
                {/* Window rows */}
                {windowSpans.map((ws, wi) => (
                  <React.Fragment key={wi}>
                    <div style={{
                      fontSize: '0.55rem',
                      color: colors.textSecondary,
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      paddingRight: '0.3rem',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                      {ws.label}
                    </div>
                    {previewDays.map(d => {
                      const active = d >= ws.startStr && d <= ws.endStr;
                      const prevActive = previewDays.indexOf(d) > 0 && (() => {
                        const prev = previewDays[previewDays.indexOf(d) - 1]!;
                        return prev >= ws.startStr && prev <= ws.endStr;
                      })();
                      const nextActive = previewDays.indexOf(d) < 13 && (() => {
                        const next = previewDays[previewDays.indexOf(d) + 1]!;
                        return next >= ws.startStr && next <= ws.endStr;
                      })();
                      return (
                        <div key={d} style={{
                          padding: '2px 0',
                          display: 'flex',
                          alignItems: 'center',
                        }}>
                          {active && (
                            <div style={{
                              width: '100%',
                              height: '14px',
                              backgroundColor: `${form.color || '#22d3ee'}40`,
                              borderTop: `2px solid ${form.color || '#22d3ee'}`,
                              borderRadius: prevActive && nextActive ? '0'
                                : !prevActive && !nextActive ? '3px'
                                : !prevActive ? '3px 0 0 3px'
                                : '0 3px 3px 0',
                            }} />
                          )}
                        </div>
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Save / Cancel */}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={handleSave}
            disabled={saving || !form.name.trim()}
            style={{
              padding: '0.5rem 1.25rem',
              backgroundColor: `${colors.success}20`,
              border: `1px solid ${colors.success}50`,
              borderRadius: '8px',
              color: colors.success,
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? 'Saving...' : form.id ? 'Save Changes' : 'Create Event'}
          </button>
          <button onClick={onCancel} style={{
            padding: '0.5rem 1rem',
            backgroundColor: 'transparent',
            border: `1px solid ${colors.border}`,
            borderRadius: '8px',
            color: colors.textMuted,
            fontSize: '0.8rem',
            cursor: 'pointer',
          }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

/* ─── MATERIAL EDITOR ─── */
const MaterialEditor: React.FC<{
  material: EventMaterial;
  saving: boolean;
  onSave: (material: EventMaterial) => void;
  onCancel: () => void;
}> = ({ material, saving, onSave, onCancel }) => {
  const [form, setForm] = useState<EventMaterial>({ ...material });

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.5rem 0.75rem',
    backgroundColor: colors.bg,
    border: `1px solid ${colors.border}`,
    borderRadius: '6px',
    color: colors.text,
    fontSize: '0.85rem',
    outline: 'none',
    boxSizing: 'border-box',
  };

  return (
    <div style={{
      backgroundColor: colors.cardAlt,
      borderRadius: '10px',
      border: `1px solid ${colors.border}`,
      padding: '1rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <span style={{ color: colors.text, fontWeight: 700, fontSize: '0.95rem' }}>
          {form.id ? 'Edit Material' : 'New Material'}
        </span>
        <button onClick={onCancel} style={{ background: 'none', border: 'none', color: colors.textMuted, cursor: 'pointer', fontSize: '0.8rem' }}>
          ✕ Cancel
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: '0.5rem', alignItems: 'end' }}>
        <div>
          <label style={{ color: colors.textSecondary, fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.3rem' }}>Name</label>
          <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} style={inputStyle} placeholder="e.g. Speedups" />
        </div>
        <div>
          <label style={{ color: colors.textSecondary, fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.3rem' }}>Emoji</label>
          <input value={form.emoji} onChange={e => setForm(p => ({ ...p, emoji: e.target.value }))} style={{ ...inputStyle, width: '60px', textAlign: 'center' }} />
        </div>
        <div>
          <label style={{ color: colors.textSecondary, fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.3rem' }}>Category</label>
          <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} style={{ ...inputStyle, width: '110px' }}>
            <option value="resource">Resource</option>
            <option value="action">Action</option>
            <option value="score">Score</option>
            <option value="general">General</option>
          </select>
        </div>
        <div>
          <label style={{ color: colors.textSecondary, fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.3rem' }}>Sort</label>
          <input type="number" value={form.sort_order} onChange={e => setForm(p => ({ ...p, sort_order: parseInt(e.target.value) || 0 }))} style={{ ...inputStyle, width: '60px' }} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
        <button
          onClick={() => onSave(form)}
          disabled={saving || !form.name.trim()}
          style={{
            padding: '0.5rem 1.25rem',
            backgroundColor: `${colors.success}20`,
            border: `1px solid ${colors.success}50`,
            borderRadius: '8px',
            color: colors.success,
            fontSize: '0.8rem',
            fontWeight: 600,
            cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? 'Saving...' : form.id ? 'Save' : 'Create'}
        </button>
        <button onClick={onCancel} style={{
          padding: '0.5rem 1rem',
          backgroundColor: 'transparent',
          border: `1px solid ${colors.border}`,
          borderRadius: '8px',
          color: colors.textMuted,
          fontSize: '0.8rem',
          cursor: 'pointer',
        }}>
          Cancel
        </button>
      </div>
    </div>
  );
};

export default EventCalendarTab;
