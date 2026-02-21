import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { useToast } from '../Toast';
import { supabase } from '../../lib/supabase';
import { colors } from '../../utils/styles';
import { logger } from '../../utils/logger';
import type { EditorInfo } from './types';
import { formatTCLevel, inputStyle } from './types';
import { useSendInvite } from './useSendInvite';

interface WatchlistItem {
  id: string;
  recruiter_user_id: string;
  kingdom_number: number;
  player_name: string;
  player_id: string | null;
  tc_level: number | null;
  power_range: string | null;
  language: string | null;
  notes: string;
  target_event: string;
  source: string;
  transfer_profile_id: string | null;
  created_at: string;
}

// ─── Query Keys ─────────────────────────────────────────────
const watchlistKeys = {
  all: ['watchlist'] as const,
  list: (userId: string, kingdomNumber: number) =>
    [...watchlistKeys.all, 'list', userId, kingdomNumber] as const,
};

// ─── Fetch Function ─────────────────────────────────────────
async function fetchWatchlistItems(userId: string, kingdomNumber: number): Promise<WatchlistItem[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('recruiter_watchlist')
    .select('*')
    .eq('recruiter_user_id', userId)
    .eq('kingdom_number', kingdomNumber)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as WatchlistItem[]) || [];
}

interface WatchlistTabProps {
  editorInfo: EditorInfo;
}

const WatchlistTab: React.FC<WatchlistTabProps> = ({ editorInfo }) => {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const { sentInviteIds, sendingInviteId, sendInvite } = useSendInvite({
    kingdomNumber: editorInfo.kingdom_number,
    source: 'Watchlist',
  });

  const queryKey = watchlistKeys.list(user?.id || '', editorInfo.kingdom_number);

  // ─── React Query: watchlist items ─────────────────────────
  const { data: items = [], isLoading: loading } = useQuery({
    queryKey,
    queryFn: () => fetchWatchlistItems(user!.id, editorInfo.kingdom_number),
    enabled: !!user,
    staleTime: 60 * 1000,
    retry: 2,
  });

  // UI-only state
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNotes, setEditNotes] = useState('');

  // Add form state
  const [formName, setFormName] = useState('');
  const [formPlayerId, setFormPlayerId] = useState('');
  const [formTcLevel, setFormTcLevel] = useState('');
  const [formPower, setFormPower] = useState('');
  const [formLanguage, setFormLanguage] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formEvent, setFormEvent] = useState('next');
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!supabase || !user || !formName.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('recruiter_watchlist').insert({
        recruiter_user_id: user.id,
        kingdom_number: editorInfo.kingdom_number,
        player_name: formName.trim(),
        player_id: formPlayerId.trim() || null,
        tc_level: formTcLevel ? parseInt(formTcLevel, 10) : null,
        power_range: formPower.trim() || null,
        language: formLanguage.trim() || null,
        notes: formNotes.trim(),
        target_event: formEvent,
        source: 'manual',
      });
      if (error) {
        if (error.code === '23505') {
          showToast('This player is already on your watchlist.', 'error');
        } else {
          showToast('Failed to add to watchlist.', 'error');
        }
        return;
      }
      showToast('Player added to watchlist!', 'success');
      resetForm();
      queryClient.invalidateQueries({ queryKey });
    } catch (err) {
      logger.error('WatchlistTab: addToWatchlist failed', err);
      showToast('Failed to add to watchlist.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateNotes = async (id: string) => {
    if (!supabase) return;
    // Optimistic update
    const prev = queryClient.getQueryData<WatchlistItem[]>(queryKey);
    queryClient.setQueryData<WatchlistItem[]>(queryKey, (old) =>
      (old || []).map(i => i.id === id ? { ...i, notes: editNotes } : i)
    );
    setEditingId(null);
    try {
      const { error } = await supabase.from('recruiter_watchlist').update({ notes: editNotes, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) {
        if (prev) queryClient.setQueryData(queryKey, prev);
        showToast('Failed to update notes.', 'error');
      } else {
        showToast('Notes updated.', 'success');
      }
    } catch (err) {
      if (prev) queryClient.setQueryData(queryKey, prev);
      logger.error('WatchlistTab: updateNotes failed', err);
      showToast('Failed to update notes.', 'error');
    }
  };

  const handleRemove = async (id: string) => {
    if (!supabase) return;
    // Optimistic remove
    const prev = queryClient.getQueryData<WatchlistItem[]>(queryKey);
    queryClient.setQueryData<WatchlistItem[]>(queryKey, (old) =>
      (old || []).filter(i => i.id !== id)
    );
    try {
      const { error } = await supabase.from('recruiter_watchlist').delete().eq('id', id);
      if (error) {
        if (prev) queryClient.setQueryData(queryKey, prev);
        showToast('Failed to remove.', 'error');
      } else {
        showToast('Removed from watchlist.', 'success');
      }
    } catch (err) {
      if (prev) queryClient.setQueryData(queryKey, prev);
      logger.error('WatchlistTab: removeFromWatchlist failed', err);
      showToast('Failed to remove.', 'error');
    }
  };

  const handleSendInvite = async (item: WatchlistItem) => {
    if (!item.transfer_profile_id) return;
    await sendInvite(item.transfer_profile_id);
  };

  const resetForm = () => {
    setFormName('');
    setFormPlayerId('');
    setFormTcLevel('');
    setFormPower('');
    setFormLanguage('');
    setFormNotes('');
    setFormEvent('next');
    setShowAddForm(false);
  };

  const handleExport = () => {
    if (items.length === 0) { showToast('Nothing to export.', 'error'); return; }
    const csv = [
      ['Name', 'Player ID', 'TC Level', 'Power', 'Language', 'Notes', 'Target Event', 'Source', 'Added'].join(','),
      ...items.map(i => [
        `"${(i.player_name || '').replace(/"/g, '""')}"`,
        i.player_id || '',
        i.tc_level || '',
        i.power_range || '',
        i.language || '',
        `"${(i.notes || '').replace(/"/g, '""')}"`,
        i.target_event || '',
        i.source || '',
        new Date(i.created_at).toLocaleDateString(),
      ].join(','))
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `watchlist-k${editorInfo.kingdom_number}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Watchlist exported!', 'success');
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file || !supabase || !user) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text) as Array<{ player_name: string; player_id?: string; tc_level?: number; power_range?: string; language?: string; notes?: string; target_event?: string }>;
        if (!Array.isArray(data) || data.length === 0) { showToast('Invalid file format.', 'error'); return; }
        let added = 0;
        for (const row of data) {
          if (!row.player_name) continue;
          const { error } = await supabase.from('recruiter_watchlist').insert({
            recruiter_user_id: user.id,
            kingdom_number: editorInfo.kingdom_number,
            player_name: row.player_name,
            player_id: row.player_id || null,
            tc_level: row.tc_level || null,
            power_range: row.power_range || null,
            language: row.language || null,
            notes: row.notes || '',
            target_event: row.target_event || 'next',
            source: 'import',
          });
          if (!error) added++;
        }
        queryClient.invalidateQueries({ queryKey });
        showToast(`Imported ${added} of ${data.length} players.`, 'success');
      } catch (err) {
        logger.error('WatchlistTab: import failed', err);
        showToast('Failed to import watchlist.', 'error');
      }
    };
    input.click();
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem', color: colors.textMuted }}>
        Loading watchlist...
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <div>
          <span style={{ color: colors.textSecondary, fontSize: '0.7rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Future Event Watchlist
          </span>
          <p style={{ color: colors.textMuted, fontSize: '0.65rem', margin: '0.15rem 0 0' }}>
            Save players interested in transferring in a future event
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
          {items.length > 0 && (
            <button
              onClick={handleExport}
              title="Export as CSV"
              style={{
                padding: '0.35rem 0.5rem',
                backgroundColor: 'transparent',
                border: '1px solid #2a2a2a',
                borderRadius: '6px',
                color: '#6b7280',
                fontSize: '0.65rem',
                cursor: 'pointer',
                minHeight: '36px',
              }}
            >
              ↓ Export
            </button>
          )}
          <button
            onClick={handleImport}
            title="Import from JSON"
            style={{
              padding: '0.35rem 0.5rem',
              backgroundColor: 'transparent',
              border: '1px solid #2a2a2a',
              borderRadius: '6px',
              color: '#6b7280',
              fontSize: '0.65rem',
              cursor: 'pointer',
              minHeight: '36px',
            }}
          >
            ↑ Import
          </button>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            style={{
              padding: '0.35rem 0.65rem',
              backgroundColor: '#22d3ee15',
              border: '1px solid #22d3ee30',
              borderRadius: '6px',
              color: '#22d3ee',
              fontSize: '0.7rem',
              fontWeight: '600',
              cursor: 'pointer',
              minHeight: '36px',
            }}
          >
            {showAddForm ? '✕ Cancel' : '+ Add Player'}
          </button>
        </div>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div style={{
          padding: '0.75rem',
          backgroundColor: colors.surface,
          borderRadius: '10px',
          border: '1px solid #22d3ee20',
          marginBottom: '0.75rem',
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '0.5rem' }}>
            <div>
              <label style={{ color: colors.textMuted, fontSize: '0.65rem', display: 'block', marginBottom: '0.2rem' }}>Player Name *</label>
              <input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Username" style={inputStyle} />
            </div>
            <div>
              <label style={{ color: colors.textMuted, fontSize: '0.65rem', display: 'block', marginBottom: '0.2rem' }}>Player ID</label>
              <input value={formPlayerId} onChange={(e) => setFormPlayerId(e.target.value)} placeholder="Optional" style={inputStyle} />
            </div>
            <div>
              <label style={{ color: colors.textMuted, fontSize: '0.65rem', display: 'block', marginBottom: '0.2rem' }}>TC Level</label>
              <input type="number" value={formTcLevel} onChange={(e) => setFormTcLevel(e.target.value)} placeholder="e.g. 25" style={inputStyle} />
            </div>
            <div>
              <label style={{ color: colors.textMuted, fontSize: '0.65rem', display: 'block', marginBottom: '0.2rem' }}>Power</label>
              <input value={formPower} onChange={(e) => setFormPower(e.target.value)} placeholder="e.g. 180M" style={inputStyle} />
            </div>
            <div>
              <label style={{ color: colors.textMuted, fontSize: '0.65rem', display: 'block', marginBottom: '0.2rem' }}>Language</label>
              <input value={formLanguage} onChange={(e) => setFormLanguage(e.target.value)} placeholder="e.g. English" style={inputStyle} />
            </div>
            <div>
              <label style={{ color: colors.textMuted, fontSize: '0.65rem', display: 'block', marginBottom: '0.2rem' }}>Target Event</label>
              <select value={formEvent} onChange={(e) => setFormEvent(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                <option value="next">Next Transfer Event</option>
                <option value="next+1">2 Events From Now</option>
                <option value="whenever">Whenever Available</option>
              </select>
            </div>
          </div>
          <div style={{ marginTop: '0.5rem' }}>
            <label style={{ color: colors.textMuted, fontSize: '0.65rem', display: 'block', marginBottom: '0.2rem' }}>Notes</label>
            <textarea
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              placeholder="Any additional info about this player..."
              rows={2}
              style={{ ...inputStyle, resize: 'vertical', minHeight: '50px' }}
            />
          </div>
          <button
            onClick={handleAdd}
            disabled={saving || !formName.trim()}
            style={{
              marginTop: '0.5rem',
              padding: '0.5rem 1rem',
              backgroundColor: '#22d3ee15',
              border: '1px solid #22d3ee40',
              borderRadius: '8px',
              color: '#22d3ee',
              fontSize: '0.75rem',
              fontWeight: '600',
              cursor: !formName.trim() ? 'default' : 'pointer',
              opacity: saving || !formName.trim() ? 0.5 : 1,
              minHeight: '40px',
              width: '100%',
            }}
          >
            {saving ? 'Saving...' : 'Add to Watchlist'}
          </button>
        </div>
      )}

      {/* Watchlist Items */}
      {items.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '2rem 1rem',
          backgroundColor: colors.surface,
          borderRadius: '10px',
          border: `1px solid ${colors.border}`,
        }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📋</div>
          <p style={{ color: colors.textMuted, fontSize: '0.8rem', margin: 0 }}>
            No players saved yet. Add players who want to transfer in a future event.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {items.map((item) => (
            <div key={item.id} style={{
              padding: '0.65rem',
              backgroundColor: colors.bg,
              borderRadius: '8px',
              border: `1px solid ${colors.border}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                    <span style={{ color: colors.text, fontWeight: '600', fontSize: '0.85rem' }}>{item.player_name}</span>
                    {item.tc_level && (
                      <span style={{ padding: '0.05rem 0.3rem', backgroundColor: '#22d3ee15', border: '1px solid #22d3ee30', borderRadius: '4px', fontSize: '0.6rem', color: '#22d3ee', fontWeight: 'bold' }}>
                        {formatTCLevel(item.tc_level)}
                      </span>
                    )}
                    {item.power_range && (
                      <span style={{ color: colors.textMuted, fontSize: '0.65rem' }}>{item.power_range}</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.2rem', flexWrap: 'wrap' }}>
                    {item.language && (
                      <span style={{ color: colors.textMuted, fontSize: '0.6rem' }}>🌐 {item.language}</span>
                    )}
                    {item.player_id && (
                      <span style={{ color: colors.textMuted, fontSize: '0.6rem' }}>ID: {item.player_id}</span>
                    )}
                    <span style={{
                      padding: '0.05rem 0.3rem',
                      backgroundColor: '#a855f710',
                      border: '1px solid #a855f725',
                      borderRadius: '4px',
                      fontSize: '0.55rem',
                      color: '#a855f7',
                    }}>
                      {item.target_event === 'next' ? 'Next Event' : item.target_event === 'next+1' ? '2 Events' : 'Whenever'}
                    </span>
                    {item.source !== 'manual' && (
                      <span style={{ fontSize: '0.55rem', color: colors.textMuted }}>via {item.source}</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleRemove(item.id)}
                  style={{
                    background: 'none', border: 'none', color: '#ef4444',
                    cursor: 'pointer', fontSize: '0.8rem', padding: '0.1rem 0.3rem',
                    opacity: 0.6, flexShrink: 0,
                  }}
                >
                  ✕
                </button>
              </div>
              {/* Notes */}
              {editingId === item.id ? (
                <div style={{ marginTop: '0.4rem' }}>
                  <textarea
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    rows={2}
                    style={{ ...inputStyle, resize: 'vertical', minHeight: '40px', fontSize: '0.7rem' }}
                  />
                  <div style={{ display: 'flex', gap: '0.3rem', marginTop: '0.3rem' }}>
                    <button onClick={() => handleUpdateNotes(item.id)} style={{ padding: '0.25rem 0.5rem', backgroundColor: '#22c55e15', border: '1px solid #22c55e30', borderRadius: '4px', color: '#22c55e', fontSize: '0.65rem', fontWeight: '600', cursor: 'pointer' }}>Save</button>
                    <button onClick={() => setEditingId(null)} style={{ padding: '0.25rem 0.5rem', backgroundColor: 'transparent', border: `1px solid ${colors.border}`, borderRadius: '4px', color: colors.textMuted, fontSize: '0.65rem', cursor: 'pointer' }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => { setEditingId(item.id); setEditNotes(item.notes || ''); }}
                  style={{ marginTop: '0.3rem', cursor: 'pointer' }}
                >
                  <p style={{ color: item.notes ? colors.textSecondary : colors.textMuted, fontSize: '0.7rem', margin: 0, fontStyle: item.notes ? 'normal' : 'italic' }}>
                    {item.notes || 'Click to add notes...'}
                  </p>
                </div>
              )}
              {/* Actions row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.35rem', paddingTop: '0.3rem', borderTop: `1px solid ${colors.border}` }}>
                <span style={{ fontSize: '0.55rem', color: colors.textMuted }}>
                  Added {new Date(item.created_at).toLocaleDateString()}
                </span>
                {item.transfer_profile_id && (
                  <button
                    disabled={sentInviteIds.has(item.transfer_profile_id!) || sendingInviteId === item.transfer_profile_id}
                    onClick={() => handleSendInvite(item)}
                    style={{
                      padding: '0.25rem 0.55rem',
                      backgroundColor: sentInviteIds.has(item.transfer_profile_id!) ? '#22c55e10' : '#a855f715',
                      border: `1px solid ${sentInviteIds.has(item.transfer_profile_id!) ? '#22c55e30' : '#a855f730'}`,
                      borderRadius: '6px',
                      color: sentInviteIds.has(item.transfer_profile_id!) ? '#22c55e' : '#a855f7',
                      fontSize: '0.65rem',
                      fontWeight: '600',
                      cursor: sentInviteIds.has(item.transfer_profile_id!) || sendingInviteId === item.transfer_profile_id ? 'default' : 'pointer',
                      minHeight: '28px',
                    }}
                  >
                    {sentInviteIds.has(item.transfer_profile_id!) ? '✓ Invited' : sendingInviteId === item.transfer_profile_id ? 'Sending...' : '📩 Send Invite'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default WatchlistTab;
