import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { colors } from '../../utils/styles';
import { logger } from '../../utils/logger';
import { TransferEvent } from './transferHubTypes';
import { actionBtn } from './TransferHubSubTabs';

// =============================================
// SEASON MANAGEMENT TAB
// =============================================

interface SeasonTabProps {
  onRefreshAll: () => void;
}

export const SeasonTab: React.FC<SeasonTabProps> = ({ onRefreshAll }) => {
  const [events, setEvents] = useState<TransferEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetResult, setResetResult] = useState<string | null>(null);
  const [addEventOpen, setAddEventOpen] = useState(false);
  const [newEventDate, setNewEventDate] = useState('');
  const [newEventGroups, setNewEventGroups] = useState(7);

  const fetchEvents = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      const { data: eventsData, error } = await supabase
        .from('transfer_events')
        .select('*')
        .order('event_number', { ascending: true });
      if (error) { logger.error('Error fetching events:', error); return; }

      const enriched: TransferEvent[] = [];
      for (const ev of (eventsData || [])) {
        const [histCount, appsCount, acceptedCount, transferredCount, invitesCount] = await Promise.all([
          supabase.from('transfer_status_history').select('id', { count: 'exact', head: true }).eq('event_number', ev.event_number),
          supabase.from('transfer_applications').select('id', { count: 'exact', head: true })
            .gte('created_at', ev.event_date)
            .lt('created_at', new Date(new Date(ev.event_date).getTime() + 60 * 24 * 60 * 60 * 1000).toISOString()),
          supabase.from('transfer_applications').select('id', { count: 'exact', head: true })
            .eq('status', 'accepted')
            .gte('created_at', ev.event_date)
            .lt('created_at', new Date(new Date(ev.event_date).getTime() + 60 * 24 * 60 * 60 * 1000).toISOString()),
          supabase.from('transfer_applications').select('id', { count: 'exact', head: true })
            .eq('status', 'transferred')
            .gte('created_at', ev.event_date)
            .lt('created_at', new Date(new Date(ev.event_date).getTime() + 60 * 24 * 60 * 60 * 1000).toISOString()),
          supabase.from('transfer_invites').select('id', { count: 'exact', head: true })
            .gte('created_at', ev.event_date)
            .lt('created_at', new Date(new Date(ev.event_date).getTime() + 60 * 24 * 60 * 60 * 1000).toISOString()),
        ]);
        enriched.push({
          ...ev,
          kingdoms_count: histCount.count || 0,
          apps_count: appsCount.count || 0,
          accepted_count: acceptedCount.count || 0,
          transferred_count: transferredCount.count || 0,
          invites_count: invitesCount.count || 0,
        });
      }
      setEvents(enriched);
    } catch (err) {
      logger.error('Error fetching transfer events:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const toggleCurrent = async (eventNumber: number, newValue: boolean) => {
    if (!supabase) return;
    setActionLoading(`toggle-${eventNumber}`);
    try {
      if (newValue) {
        // First set all events to not current
        await supabase.from('transfer_events').update({ is_current: false }).neq('event_number', 0);
      }
      const { error } = await supabase
        .from('transfer_events')
        .update({ is_current: newValue })
        .eq('event_number', eventNumber);
      if (error) { logger.error('Toggle current failed:', error); return; }

      if (newValue) {
        // Notify all active editors that a new season has opened
        const { data: editors } = await supabase
          .from('kingdom_editors')
          .select('user_id, kingdom_number')
          .eq('status', 'active');
        if (editors && editors.length > 0) {
          const notifications = editors.map(e => ({
            user_id: e.user_id,
            type: 'transfer_season',
            title: 'New Transfer Season Open',
            message: `Transfer Event #${eventNumber} is now active! Update your kingdom's recruitment settings.`,
            link: '/transfer-hub',
            metadata: { event_number: eventNumber, kingdom_number: e.kingdom_number },
          }));
          await supabase.from('notifications').insert(notifications);
        }
      }

      await fetchEvents();
    } catch (err) {
      logger.error('Error toggling current:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const executeSeasonReset = async () => {
    if (!supabase) return;
    setActionLoading('season-reset');
    setResetResult(null);
    try {
      const results: string[] = [];

      // 1. Expire all pending/viewed/interested applications
      const { data: expiredApps } = await supabase
        .from('transfer_applications')
        .update({ status: 'expired' })
        .in('status', ['pending', 'viewed', 'interested'])
        .select('id');
      results.push(`${expiredApps?.length || 0} applications expired`);

      // 2. Mark accepted applications as transferred
      const { data: transferredApps } = await supabase
        .from('transfer_applications')
        .update({ status: 'transferred' })
        .eq('status', 'accepted')
        .select('id');
      results.push(`${transferredApps?.length || 0} accepted apps → transferred`);

      // 3. Deactivate all transfer profiles
      const { data: deactivatedProfiles } = await supabase
        .from('transfer_profiles')
        .update({ is_active: false })
        .eq('is_active', true)
        .select('id');
      results.push(`${deactivatedProfiles?.length || 0} profiles deactivated`);

      // 4. Expire all active invites
      const { data: expiredInvites } = await supabase
        .from('transfer_invites')
        .update({ status: 'expired' })
        .in('status', ['pending', 'accepted'])
        .select('id');
      results.push(`${expiredInvites?.length || 0} invites expired`);

      // 5. Reset special invite caps
      const { data: resetCaps } = await supabase
        .from('kingdom_funds')
        .update({ special_invite_cap: 0 })
        .gt('special_invite_cap', 0)
        .select('id');
      results.push(`${resetCaps?.length || 0} special invite caps reset`);

      // 6. Set all events to not current
      await supabase.from('transfer_events').update({ is_current: false }).neq('event_number', 0);
      results.push('All events set to inactive');

      setResetResult(`Season reset complete:\n${results.join('\n')}`);
      await fetchEvents();
      onRefreshAll();
    } catch (err) {
      logger.error('Season reset error:', err);
      setResetResult('Season reset failed — check console');
    } finally {
      setActionLoading(null);
      setConfirmReset(false);
    }
  };

  const addEvent = async () => {
    if (!supabase || !newEventDate) return;
    setActionLoading('add-event');
    try {
      const nextNumber = events.length > 0 ? Math.max(...events.map(e => e.event_number)) + 1 : 1;
      const { error } = await supabase
        .from('transfer_events')
        .insert({
          event_number: nextNumber,
          event_date: newEventDate,
          total_groups: newEventGroups,
          is_current: false,
        });
      if (error) { logger.error('Add event failed:', error); return; }
      setAddEventOpen(false);
      setNewEventDate('');
      setNewEventGroups(7);
      await fetchEvents();
    } catch (err) {
      logger.error('Error adding event:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00Z');
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  };

  const currentEvent = events.find(e => e.is_current);

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '2rem', color: colors.textMuted }}>Loading transfer events...</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Current Season Banner */}
      <div style={{
        padding: '1rem',
        backgroundColor: currentEvent ? `${colors.success}08` : `${colors.textMuted}08`,
        border: `1px solid ${currentEvent ? `${colors.success}30` : `${colors.textMuted}30`}`,
        borderRadius: '10px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div>
          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: currentEvent ? colors.success : colors.textMuted }}>
            {currentEvent
              ? `Active Season: Transfer #${currentEvent.event_number}`
              : 'No Active Transfer Season'}
          </div>
          {currentEvent && (
            <div style={{ fontSize: '0.7rem', color: colors.textMuted, marginTop: '0.2rem' }}>
              Started {formatDate(currentEvent.event_date)} · {currentEvent.total_groups} groups · {currentEvent.kingdoms_count || 0} kingdoms
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          <button
            onClick={() => setAddEventOpen(!addEventOpen)}
            style={actionBtn(`${colors.primary}15`, `${colors.primary}40`, colors.primary)}
          >
            + Add Event
          </button>
          <button
            onClick={() => setConfirmReset(true)}
            disabled={actionLoading === 'season-reset'}
            style={actionBtn(`${colors.error}15`, `${colors.error}40`, colors.error, actionLoading === 'season-reset')}
          >
            {actionLoading === 'season-reset' ? 'Resetting...' : '🔄 Season Reset'}
          </button>
        </div>
      </div>

      {/* Add Event Form */}
      {addEventOpen && (
        <div style={{
          padding: '1rem',
          backgroundColor: colors.cardAlt,
          border: `1px solid ${colors.border}`,
          borderRadius: '10px',
          display: 'flex',
          gap: '0.75rem',
          alignItems: 'flex-end',
          flexWrap: 'wrap',
        }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.7rem', color: colors.textMuted, marginBottom: '0.25rem' }}>Event Date</label>
            <input
              type="date"
              value={newEventDate}
              onChange={e => setNewEventDate(e.target.value)}
              style={{
                padding: '0.35rem 0.5rem',
                backgroundColor: colors.bg,
                border: `1px solid ${colors.border}`,
                borderRadius: '6px',
                color: colors.text,
                fontSize: '0.8rem',
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.7rem', color: colors.textMuted, marginBottom: '0.25rem' }}>Groups</label>
            <input
              type="number"
              value={newEventGroups}
              onChange={e => setNewEventGroups(parseInt(e.target.value) || 1)}
              min={1}
              max={20}
              style={{
                padding: '0.35rem 0.5rem',
                backgroundColor: colors.bg,
                border: `1px solid ${colors.border}`,
                borderRadius: '6px',
                color: colors.text,
                fontSize: '0.8rem',
                width: '60px',
              }}
            />
          </div>
          <button
            onClick={addEvent}
            disabled={!newEventDate || actionLoading === 'add-event'}
            style={actionBtn(`${colors.success}15`, `${colors.success}40`, colors.success, !newEventDate || actionLoading === 'add-event')}
          >
            {actionLoading === 'add-event' ? 'Adding...' : 'Create Event'}
          </button>
          <button onClick={() => setAddEventOpen(false)} style={actionBtn('transparent', colors.border, colors.textMuted)}>
            Cancel
          </button>
        </div>
      )}

      {/* Season Reset Confirmation */}
      {confirmReset && (
        <div style={{
          padding: '1rem',
          backgroundColor: `${colors.error}08`,
          border: `1px solid ${colors.error}30`,
          borderRadius: '10px',
        }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: colors.error, marginBottom: '0.5rem' }}>
            ⚠️ Confirm Season Reset
          </div>
          <div style={{ fontSize: '0.75rem', color: colors.textSecondary, marginBottom: '0.75rem', lineHeight: 1.6 }}>
            This will:<br />
            • Expire all pending/viewed/interested applications<br />
            • Mark all accepted applications as transferred<br />
            • Deactivate all transfer profiles<br />
            • Expire all active invites<br />
            • Reset all special invite caps to 0<br />
            • Set all events to inactive
          </div>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <button
              onClick={executeSeasonReset}
              disabled={actionLoading === 'season-reset'}
              style={actionBtn(`${colors.error}20`, `${colors.error}50`, colors.error, actionLoading === 'season-reset')}
            >
              {actionLoading === 'season-reset' ? 'Executing...' : 'Yes, Reset Season'}
            </button>
            <button
              onClick={() => setConfirmReset(false)}
              style={actionBtn('transparent', colors.border, colors.textMuted)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Reset Result */}
      {resetResult && (
        <div style={{
          padding: '0.75rem 1rem',
          backgroundColor: `${colors.success}08`,
          border: `1px solid ${colors.success}30`,
          borderRadius: '8px',
          fontSize: '0.75rem',
          color: colors.success,
          whiteSpace: 'pre-line',
        }}>
          {resetResult}
        </div>
      )}

      {/* Events Table */}
      <div style={{
        backgroundColor: colors.cardAlt,
        borderRadius: '10px',
        border: `1px solid ${colors.border}`,
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '0.75rem 1rem',
          borderBottom: `1px solid ${colors.border}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <h4 style={{ color: colors.text, margin: 0, fontSize: '0.9rem', fontWeight: 600 }}>
            Transfer Events ({events.length})
          </h4>
          <button onClick={fetchEvents} style={actionBtn('transparent', colors.border, colors.textMuted)}>
            ↻ Refresh
          </button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${colors.border}` }}>
                {['#', 'Date', 'Groups', 'Kingdoms', 'Apps', 'Accepted', 'Transferred', 'Invites', 'Status', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '0.5rem 0.75rem', textAlign: 'left', color: colors.textMuted, fontWeight: 500, whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {events.map(ev => (
                <tr key={ev.event_number} style={{
                  borderBottom: `1px solid ${colors.border}`,
                  backgroundColor: ev.is_current ? `${colors.success}05` : 'transparent',
                }}>
                  <td style={{ padding: '0.6rem 0.75rem', fontWeight: 700, color: colors.text }}>
                    E#{ev.event_number}
                  </td>
                  <td style={{ padding: '0.6rem 0.75rem', color: colors.textSecondary, whiteSpace: 'nowrap' }}>
                    {formatDate(ev.event_date)}
                  </td>
                  <td style={{ padding: '0.6rem 0.75rem', color: colors.textSecondary, textAlign: 'center' }}>
                    {ev.total_groups}
                  </td>
                  <td style={{ padding: '0.6rem 0.75rem', color: '#22d3ee', fontWeight: 600, textAlign: 'center' }}>
                    {ev.kingdoms_count || 0}
                  </td>
                  <td style={{ padding: '0.6rem 0.75rem', color: colors.textSecondary, textAlign: 'center' }}>
                    {ev.apps_count || 0}
                  </td>
                  <td style={{ padding: '0.6rem 0.75rem', color: colors.success, fontWeight: 600, textAlign: 'center' }}>
                    {ev.accepted_count || 0}
                  </td>
                  <td style={{ padding: '0.6rem 0.75rem', color: '#a855f7', fontWeight: 600, textAlign: 'center' }}>
                    {ev.transferred_count || 0}
                  </td>
                  <td style={{ padding: '0.6rem 0.75rem', color: colors.textSecondary, textAlign: 'center' }}>
                    {ev.invites_count || 0}
                  </td>
                  <td style={{ padding: '0.6rem 0.75rem' }}>
                    <span style={{
                      padding: '0.15rem 0.4rem',
                      borderRadius: '4px',
                      fontSize: '0.65rem',
                      fontWeight: 600,
                      backgroundColor: ev.is_current ? `${colors.success}15` : `${colors.textMuted}15`,
                      color: ev.is_current ? colors.success : colors.textMuted,
                      border: `1px solid ${ev.is_current ? `${colors.success}40` : `${colors.textMuted}30`}`,
                    }}>
                      {ev.is_current ? 'Active' : 'Ended'}
                    </span>
                  </td>
                  <td style={{ padding: '0.6rem 0.75rem' }}>
                    <button
                      onClick={() => toggleCurrent(ev.event_number, !ev.is_current)}
                      disabled={actionLoading === `toggle-${ev.event_number}`}
                      style={actionBtn(
                        ev.is_current ? `${colors.warning}15` : `${colors.success}15`,
                        ev.is_current ? `${colors.warning}40` : `${colors.success}40`,
                        ev.is_current ? colors.warning : colors.success,
                        actionLoading === `toggle-${ev.event_number}`,
                      )}
                    >
                      {actionLoading === `toggle-${ev.event_number}` ? '...' : ev.is_current ? 'End Season' : 'Set Active'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Analytics Summary */}
      <div style={{
        backgroundColor: colors.cardAlt,
        borderRadius: '10px',
        padding: '1rem',
        border: `1px solid ${colors.border}`,
      }}>
        <h4 style={{ color: colors.text, margin: '0 0 0.75rem', fontSize: '0.9rem', fontWeight: 600 }}>
          📊 Transfer Analytics Summary
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.5rem' }}>
          {[
            { label: 'Total Events', value: events.length, color: colors.primary },
            { label: 'Total Kingdoms', value: events.reduce((s, e) => s + (e.kingdoms_count || 0), 0), color: '#22d3ee' },
            { label: 'Total Apps', value: events.reduce((s, e) => s + (e.apps_count || 0), 0), color: colors.textSecondary },
            { label: 'Total Transferred', value: events.reduce((s, e) => s + (e.transferred_count || 0), 0), color: '#a855f7' },
            { label: 'Total Invites', value: events.reduce((s, e) => s + (e.invites_count || 0), 0), color: colors.orange },
            { label: 'Avg Apps/Event', value: events.length > 0 ? Math.round(events.reduce((s, e) => s + (e.apps_count || 0), 0) / events.length) : 0, color: colors.blue },
          ].map((stat, i) => (
            <div key={i} style={{
              padding: '0.6rem 0.75rem',
              backgroundColor: colors.bg,
              border: `1px solid ${colors.border}`,
              borderRadius: '8px',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '0.65rem', color: colors.textMuted, textTransform: 'uppercase', marginBottom: '0.2rem' }}>
                {stat.label}
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: stat.color }}>
                {stat.value}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SeasonTab;
