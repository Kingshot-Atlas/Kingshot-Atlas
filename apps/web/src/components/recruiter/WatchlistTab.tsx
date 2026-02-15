import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { useAnalytics } from '../../hooks/useAnalytics';
import { useToast } from '../Toast';
import { supabase } from '../../lib/supabase';
import { colors } from '../../utils/styles';
import type { EditorInfo } from './types';
import { formatTCLevel, inputStyle } from './types';

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

interface WatchlistTabProps {
  editorInfo: EditorInfo;
}

const WatchlistTab: React.FC<WatchlistTabProps> = ({ editorInfo }) => {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const { showToast } = useToast();
  const { trackFeature } = useAnalytics();

  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNotes, setEditNotes] = useState('');
  const [sentInviteIds, setSentInviteIds] = useState<Set<string>>(new Set());
  const [sendingInviteId, setSendingInviteId] = useState<string | null>(null);

  // Add form state
  const [formName, setFormName] = useState('');
  const [formPlayerId, setFormPlayerId] = useState('');
  const [formTcLevel, setFormTcLevel] = useState('');
  const [formPower, setFormPower] = useState('');
  const [formLanguage, setFormLanguage] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formEvent, setFormEvent] = useState('next');
  const [saving, setSaving] = useState(false);

  const fetchWatchlist = useCallback(async () => {
    if (!supabase || !user) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('recruiter_watchlist')
        .select('*')
        .eq('recruiter_user_id', user.id)
        .eq('kingdom_number', editorInfo.kingdom_number)
        .order('created_at', { ascending: false });
      setItems(data || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [user, editorInfo.kingdom_number]);

  useEffect(() => {
    fetchWatchlist();
  }, [fetchWatchlist]);

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
      fetchWatchlist();
    } catch {
      showToast('Failed to add to watchlist.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateNotes = async (id: string) => {
    if (!supabase) return;
    try {
      await supabase.from('recruiter_watchlist').update({ notes: editNotes, updated_at: new Date().toISOString() }).eq('id', id);
      setItems(prev => prev.map(i => i.id === id ? { ...i, notes: editNotes } : i));
      setEditingId(null);
      showToast('Notes updated.', 'success');
    } catch {
      showToast('Failed to update notes.', 'error');
    }
  };

  const handleRemove = async (id: string) => {
    if (!supabase) return;
    try {
      await supabase.from('recruiter_watchlist').delete().eq('id', id);
      setItems(prev => prev.filter(i => i.id !== id));
      showToast('Removed from watchlist.', 'success');
    } catch {
      showToast('Failed to remove.', 'error');
    }
  };

  const handleSendInvite = async (item: WatchlistItem) => {
    if (!supabase || !user || !editorInfo || !item.transfer_profile_id) return;
    setSendingInviteId(item.id);
    try {
      // Check for existing pending invite
      const { data: existing } = await supabase
        .from('transfer_invites')
        .select('id')
        .eq('kingdom_number', editorInfo.kingdom_number)
        .eq('recipient_profile_id', item.transfer_profile_id)
        .eq('status', 'pending')
        .maybeSingle();
      if (existing) {
        showToast('An invite is already pending for this player.', 'error');
        setSentInviteIds(prev => new Set(prev).add(item.id));
        return;
      }

      const { error } = await supabase.from('transfer_invites').insert({
        kingdom_number: editorInfo.kingdom_number,
        sender_user_id: user.id,
        recipient_profile_id: item.transfer_profile_id,
      });
      if (error) {
        showToast('Failed to send invite: ' + error.message, 'error');
        return;
      }
      setSentInviteIds(prev => new Set(prev).add(item.id));
      trackFeature('Watchlist Invite Sent', { kingdom: editorInfo.kingdom_number });
      showToast('Invite sent!', 'success');

      // Notify the transferee
      const { data: profileRow } = await supabase
        .from('transfer_profiles')
        .select('user_id')
        .eq('id', item.transfer_profile_id)
        .single();
      if (profileRow) {
        await supabase.from('notifications').insert({
          user_id: profileRow.user_id,
          type: 'transfer_invite',
          title: 'Kingdom Invite Received',
          message: `Kingdom ${editorInfo.kingdom_number} has invited you to transfer!`,
          link: '/transfer-hub',
          metadata: { kingdom_number: editorInfo.kingdom_number },
        });
      }
    } catch {
      showToast('Failed to send invite.', 'error');
    } finally {
      setSendingInviteId(null);
    }
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
                    disabled={sentInviteIds.has(item.id) || sendingInviteId === item.id}
                    onClick={() => handleSendInvite(item)}
                    style={{
                      padding: '0.25rem 0.55rem',
                      backgroundColor: sentInviteIds.has(item.id) ? '#22c55e10' : '#a855f715',
                      border: `1px solid ${sentInviteIds.has(item.id) ? '#22c55e30' : '#a855f730'}`,
                      borderRadius: '6px',
                      color: sentInviteIds.has(item.id) ? '#22c55e' : '#a855f7',
                      fontSize: '0.65rem',
                      fontWeight: '600',
                      cursor: sentInviteIds.has(item.id) || sendingInviteId === item.id ? 'default' : 'pointer',
                      minHeight: '28px',
                    }}
                  >
                    {sentInviteIds.has(item.id) ? '✓ Invited' : sendingInviteId === item.id ? 'Sending...' : '📩 Send Invite'}
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
