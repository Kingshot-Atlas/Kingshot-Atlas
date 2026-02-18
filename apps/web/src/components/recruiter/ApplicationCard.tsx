import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { colors } from '../../utils/styles';
import { logger } from '../../utils/logger';
import type { IncomingApplication } from './types';
import { formatTCLevel, STATUS_ACTIONS, STATUS_LABELS, inputStyle } from './types';

interface AppMessage {
  id: string;
  sender_user_id: string;
  message: string;
  created_at: string;
}

const ApplicationCard: React.FC<{
  application: IncomingApplication;
  onStatusChange: (id: string, newStatus: string) => void;
  updating: string | null;
  unreadCount?: number;
  kingdomNumber?: number;
  onMovedToWatchlist?: () => void;
}> = ({ application, onStatusChange, updating, unreadCount = 0, kingdomNumber, onMovedToWatchlist }) => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [confirmingDecline, setConfirmingDecline] = useState(false);
  const [editingNote, setEditingNote] = useState(false);
  const [noteText, setNoteText] = useState(application.recruiter_note || '');
  const [savingNote, setSavingNote] = useState(false);
  // Messaging state
  const [messages, setMessages] = useState<AppMessage[]>([]);
  const [msgText, setMsgText] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);
  const [showMessages, setShowMessages] = useState(false);
  const msgEndRef = useRef<HTMLDivElement>(null);
  // Watchlist move state
  const [movingToWatchlist, setMovingToWatchlist] = useState(false);
  const [movedToWatchlist, setMovedToWatchlist] = useState(false);
  // Outcome tracking state
  const [showOutcomePrompt, setShowOutcomePrompt] = useState(false);
  const [outcomeSubmitting, setOutcomeSubmitting] = useState(false);
  const [outcomeSubmitted, setOutcomeSubmitted] = useState(false);
  const profile = application.profile;
  const isAnon = profile?.is_anonymous && application.status !== 'accepted';
  const statusInfo = STATUS_LABELS[application.status] || { label: application.status, color: colors.textMuted };
  const actions = STATUS_ACTIONS[application.status];

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const getDaysRemaining = () => {
    const diff = new Date(application.expires_at).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  const daysLeft = getDaysRemaining();

  // Load messages when panel is toggled open + subscribe to real-time updates
  useEffect(() => {
    if (!showMessages || !supabase) return;
    const sb = supabase;
    const load = async () => {
      const { data } = await sb
        .from('application_messages')
        .select('id, sender_user_id, message, created_at')
        .eq('application_id', application.id)
        .order('created_at', { ascending: true });
      if (data) setMessages(data);

      // Mark messages as read (upsert read status)
      if (user) {
        sb.from('message_read_status')
          .upsert({ application_id: application.id, user_id: user.id, last_read_at: new Date().toISOString() }, { onConflict: 'application_id,user_id' })
          .then(() => {});
      }
    };
    load();

    // Real-time subscription for new messages
    const channel = sb
      .channel(`app-msgs-${application.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'application_messages',
        filter: `application_id=eq.${application.id}`,
      }, (payload) => {
        const row = payload.new as AppMessage;
        setMessages(prev => {
          if (prev.some(m => m.id === row.id)) return prev;
          return [...prev, row];
        });
      })
      .subscribe();

    return () => { sb.removeChannel(channel); };
  }, [showMessages, application.id]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) msgEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Check if recruiter already submitted outcome for this application
  useEffect(() => {
    if (application.status !== 'accepted' || !supabase || !user) return;
    supabase
      .from('transfer_outcomes')
      .select('id')
      .eq('application_id', application.id)
      .eq('confirmed_by', user.id)
      .maybeSingle()
      .then(({ data }) => { if (data) setOutcomeSubmitted(true); });
  }, [application.id, application.status, user]);

  const handleRecruiterOutcome = async (didTransfer: boolean, satisfaction?: number) => {
    if (!supabase || !user) return;
    setOutcomeSubmitting(true);
    try {
      await supabase.from('transfer_outcomes').upsert({
        application_id: application.id,
        confirmed_by: user.id,
        confirmed_role: 'recruiter',
        did_transfer: didTransfer,
        satisfaction_rating: satisfaction || null,
        feedback: null,
      }, { onConflict: 'application_id,confirmed_by' });
      setOutcomeSubmitted(true);
      setShowOutcomePrompt(false);
    } catch (err) {
      logger.error('ApplicationCard: submit outcome failed', err);
    } finally {
      setOutcomeSubmitting(false);
    }
  };

  const sendMessage = async () => {
    if (!supabase || !user || !msgText.trim() || sendingMsg) return;
    setSendingMsg(true);
    try {
      const { data, error } = await supabase
        .from('application_messages')
        .insert({ application_id: application.id, sender_user_id: user.id, message: msgText.trim() })
        .select('id, sender_user_id, message, created_at')
        .single();
      if (!error && data) {
        setMessages(prev => [...prev, data]);
        setMsgText('');
      }
    } catch (err) {
      logger.error('ApplicationCard: send message failed', err);
    } finally {
      setSendingMsg(false);
    }
  };

  return (
    <div style={{
      backgroundColor: colors.bg,
      border: `1px solid ${statusInfo.color}25`,
      borderRadius: '10px',
      overflow: 'hidden',
    }}>
      {/* Header Row */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          padding: isMobile ? '0.75rem' : '0.75rem 1rem',
          cursor: 'pointer',
          display: 'flex',
          alignItems: isMobile ? 'flex-start' : 'center',
          justifyContent: 'space-between',
          flexDirection: isMobile ? 'column' : 'row',
          gap: '0.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 0 }}>
          <span style={{ color: colors.text, fontWeight: '600', fontSize: '0.85rem' }}>
            {isAnon ? `🔒 ${t('appCard.anonymousApplicant', 'Anonymous Applicant')}` : (profile?.username || t('appCard.unknownPlayer', 'Unknown Player'))}
          </span>
          {profile && (
            <span style={{ color: colors.textSecondary, fontSize: '0.7rem' }}>
              Kingdom {profile.current_kingdom} • {formatTCLevel(profile.tc_level)} • {profile.power_million ? `${profile.power_million}M` : profile.power_range}
            </span>
          )}
          <span style={{
            padding: '0.1rem 0.4rem',
            backgroundColor: `${statusInfo.color}15`,
            border: `1px solid ${statusInfo.color}30`,
            borderRadius: '4px',
            fontSize: '0.6rem',
            color: statusInfo.color,
            fontWeight: 'bold',
            textTransform: 'uppercase',
          }}>
            {statusInfo.label}
          </span>
          {application.status === 'accepted' && profile?.linked_player_id && (
            <span style={{ color: colors.textMuted, fontSize: '0.6rem' }}>
              ID: <span style={{ color: '#22d3ee', fontWeight: '600' }}>{profile.linked_player_id}</span>
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ color: '#4b5563', fontSize: '0.65rem' }}>
            {formatDate(application.applied_at)}
          </span>
          {daysLeft <= 3 && daysLeft > 0 && application.status !== 'accepted' && application.status !== 'declined' && (
            <span style={{ color: '#f59e0b', fontSize: '0.6rem', fontWeight: '600' }}>
              {daysLeft}d left
            </span>
          )}
          <svg
            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2"
            style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </div>
      </div>

      {/* Expanded Profile Details */}
      {expanded && profile && (
        <div style={{
          padding: isMobile ? '0 0.75rem 0.75rem' : '0 1rem 1rem',
          borderTop: '1px solid #1a1a1a',
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
            gap: '0.5rem',
            marginTop: '0.75rem',
          }}>
            <div>
              <span style={{ color: colors.textMuted, fontSize: '0.65rem' }}>{t('appCard.language', 'Language')}</span>
              <div style={{ color: '#d1d5db', fontSize: '0.8rem' }}>{profile.main_language}</div>
            </div>
            <div>
              <span style={{ color: colors.textMuted, fontSize: '0.65rem' }}>{t('appCard.kvkAvailability', 'KvK Availability')}</span>
              <div style={{ color: '#d1d5db', fontSize: '0.8rem', textTransform: 'capitalize' }}>{profile.kvk_availability || '—'}</div>
            </div>
            <div>
              <span style={{ color: colors.textMuted, fontSize: '0.65rem' }}>{t('appCard.savingForKvk', 'Saving for KvK')}</span>
              <div style={{ color: '#d1d5db', fontSize: '0.8rem', textTransform: 'capitalize' }}>{(profile.saving_for_kvk || '—').replace(/_/g, ' ')}</div>
            </div>
            <div>
              <span style={{ color: colors.textMuted, fontSize: '0.65rem' }}>{t('appCard.groupSize', 'Group Size')}</span>
              <div style={{ color: '#d1d5db', fontSize: '0.8rem' }}>{profile.group_size}</div>
            </div>
            <div>
              <span style={{ color: colors.textMuted, fontSize: '0.65rem' }}>{t('appCard.contact', 'Contact')}</span>
              {isAnon ? (
                <div style={{ color: colors.textMuted, fontSize: '0.8rem', fontStyle: 'italic' }}>
                  🔒 {t('appCard.revealedAfterAcceptance', 'Revealed after acceptance')}
                </div>
              ) : (
                <div style={{ color: '#22d3ee', fontSize: '0.8rem' }}>
                  {(profile.contact_method === 'discord' || profile.contact_method === 'both') && profile.contact_discord && (
                    <span>💬 {profile.contact_discord}</span>
                  )}
                  {profile.contact_method === 'both' && ' · '}
                  {(profile.contact_method === 'in_game' || profile.contact_method === 'both') && profile.contact_coordinates && (
                    <span>🎮 {(() => {
                      const m = profile.contact_coordinates.match(/^K:(\d+) X:(\d+) Y:(\d+)$/);
                      return m ? `K${m[1]} · X:${m[2]} Y:${m[3]}` : profile.contact_coordinates;
                    })()}</span>
                  )}
                  {!profile.contact_discord && !profile.contact_coordinates && profile.contact_info && (
                    <span>{profile.contact_method === 'discord' ? '💬 ' : '🎮 '}{profile.contact_info}</span>
                  )}
                </div>
              )}
            </div>
          </div>

          {profile.looking_for.length > 0 && (
            <div style={{ marginTop: '0.5rem' }}>
              <span style={{ color: colors.textMuted, fontSize: '0.65rem' }}>{t('appCard.lookingFor', 'Looking For')}</span>
              <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                {profile.looking_for.slice(0, 3).map((tag) => (
                  <span key={tag} style={{
                    padding: '0.1rem 0.4rem',
                    backgroundColor: '#22d3ee10',
                    border: '1px solid #22d3ee20',
                    borderRadius: '4px',
                    fontSize: '0.6rem',
                    color: '#22d3ee',
                  }}>
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {profile.player_bio && (
            <div style={{ marginTop: '0.5rem' }}>
              <span style={{ color: colors.textMuted, fontSize: '0.65rem' }}>{t('appCard.bio', 'Bio')}</span>
              <p style={{ color: '#d1d5db', fontSize: '0.8rem', margin: '0.2rem 0 0 0', lineHeight: 1.4 }}>
                {profile.player_bio}
              </p>
            </div>
          )}

          {application.applicant_note && (
            <div style={{
              marginTop: '0.5rem',
              padding: '0.5rem 0.75rem',
              backgroundColor: '#22d3ee08',
              border: '1px solid #22d3ee15',
              borderRadius: '8px',
            }}>
              <span style={{ color: '#22d3ee', fontSize: '0.65rem', fontWeight: '600' }}>📝 {t('appCard.applicantNote', 'Applicant Note')}</span>
              <p style={{ color: '#d1d5db', fontSize: '0.78rem', margin: '0.2rem 0 0 0', lineHeight: 1.4 }}>
                {application.applicant_note}
              </p>
            </div>
          )}

          {/* Recruiter Private Note */}
          <div style={{
            marginTop: '0.5rem',
            padding: '0.5rem 0.75rem',
            backgroundColor: '#a855f708',
            border: '1px solid #a855f715',
            borderRadius: '8px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ color: '#a855f7', fontSize: '0.65rem', fontWeight: '600' }}>🔒 {t('appCard.recruiterNote', 'Recruiter Note')}</span>
              {!editingNote && (
                <button
                  onClick={(e) => { e.stopPropagation(); setEditingNote(true); setNoteText(application.recruiter_note || ''); }}
                  style={{ background: 'none', border: 'none', color: '#a855f7', fontSize: '0.6rem', cursor: 'pointer', padding: '0.1rem 0.3rem' }}
                >
                  {application.recruiter_note ? t('appCard.edit', 'Edit') : t('appCard.addNote', 'Add Note')}
                </button>
              )}
            </div>
            {editingNote ? (
              <div style={{ marginTop: '0.3rem' }}>
                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder={t('appCard.privateNotePlaceholder', 'Private note about this applicant...')}
                  rows={2}
                  maxLength={500}
                  onClick={(e) => e.stopPropagation()}
                  style={{ ...inputStyle, resize: 'vertical', minHeight: '40px', fontSize: '0.7rem' }}
                />
                <div style={{ display: 'flex', gap: '0.3rem', marginTop: '0.3rem' }}>
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (!supabase) return;
                      setSavingNote(true);
                      try {
                        await supabase.from('transfer_applications').update({ recruiter_note: noteText.trim() || null }).eq('id', application.id);
                        setEditingNote(false);
                      } catch (err) {
                        logger.error('ApplicationCard: save recruiter note failed', err);
                      } finally {
                        setSavingNote(false);
                      }
                    }}
                    disabled={savingNote}
                    style={{ padding: '0.25rem 0.5rem', backgroundColor: '#a855f715', border: '1px solid #a855f730', borderRadius: '4px', color: '#a855f7', fontSize: '0.65rem', fontWeight: '600', cursor: 'pointer' }}
                  >
                    {savingNote ? t('appCard.saving', 'Saving...') : t('appCard.save', 'Save')}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setEditingNote(false); }}
                    style={{ padding: '0.25rem 0.5rem', backgroundColor: 'transparent', border: `1px solid ${colors.border}`, borderRadius: '4px', color: colors.textMuted, fontSize: '0.65rem', cursor: 'pointer' }}
                  >
                    {t('appCard.cancel', 'Cancel')}
                  </button>
                </div>
              </div>
            ) : application.recruiter_note ? (
              <p style={{ color: '#d1d5db', fontSize: '0.78rem', margin: '0.2rem 0 0 0', lineHeight: 1.4 }}>
                {application.recruiter_note}
              </p>
            ) : (
              <p style={{ color: colors.textMuted, fontSize: '0.7rem', margin: '0.2rem 0 0 0', fontStyle: 'italic' }}>
                {t('appCard.noRecruiterNotes', 'No recruiter notes yet')}
              </p>
            )}
          </div>

          {/* Move to Watchlist */}
          {kingdomNumber && profile && !movedToWatchlist && ['pending', 'viewed', 'interested'].includes(application.status) && (
            <button
              onClick={async (e) => {
                e.stopPropagation();
                if (!supabase || !user || movingToWatchlist) return;
                setMovingToWatchlist(true);
                try {
                  const { error } = await supabase.from('recruiter_watchlist').insert({
                    recruiter_user_id: user.id,
                    kingdom_number: kingdomNumber,
                    player_name: profile.username || 'Unknown',
                    player_id: profile.linked_player_id || null,
                    tc_level: profile.tc_level || null,
                    power_range: profile.power_range || (profile.power_million ? `${profile.power_million}M` : null),
                    language: profile.main_language || null,
                    notes: `From application (${new Date(application.applied_at).toLocaleDateString()}). ${application.recruiter_note || ''}`.trim(),
                    target_event: 'next',
                    source: 'application',
                    transfer_profile_id: application.transfer_profile_id,
                  });
                  if (error) {
                    if (error.code === '23505') {
                      setMovedToWatchlist(true);
                    } else {
                      logger.error('ApplicationCard: move to watchlist failed', error);
                    }
                  } else {
                    setMovedToWatchlist(true);
                    onMovedToWatchlist?.();
                  }
                } catch (err) {
                  logger.error('ApplicationCard: move to watchlist failed', err);
                } finally {
                  setMovingToWatchlist(false);
                }
              }}
              disabled={movingToWatchlist}
              style={{
                marginTop: '0.5rem',
                display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                background: 'none', border: `1px solid #eab30830`,
                borderRadius: '6px', padding: '0.3rem 0.6rem',
                color: '#eab308', fontSize: '0.65rem', fontWeight: '600',
                cursor: movingToWatchlist ? 'not-allowed' : 'pointer',
                opacity: movingToWatchlist ? 0.5 : 1,
              }}
            >
              {movingToWatchlist ? '...' : `👁️ ${t('appCard.moveToWatchlist', 'Move to Watchlist')}`}
            </button>
          )}
          {movedToWatchlist && (
            <span style={{ marginTop: '0.5rem', display: 'block', color: '#eab308', fontSize: '0.65rem', fontWeight: '600' }}>
              ✓ {t('appCard.addedToWatchlist', 'Added to Watchlist')}
            </span>
          )}

          {/* Message Thread */}
          <div style={{ marginTop: '0.5rem' }}>
            <button
              onClick={(e) => { e.stopPropagation(); setShowMessages(!showMessages); }}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.35rem',
                background: 'none', border: `1px solid ${colors.border}`,
                borderRadius: '6px', padding: '0.3rem 0.6rem',
                color: '#3b82f6', fontSize: '0.65rem', fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              💬 {showMessages ? t('appCard.hideMessages', 'Hide Messages') : `${t('appCard.messages', 'Messages')}${messages.length > 0 ? ` (${messages.length})` : ''}`}
              {!showMessages && unreadCount > 0 && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  minWidth: '16px', height: '16px', padding: '0 4px',
                  backgroundColor: '#ef4444', borderRadius: '8px',
                  fontSize: '0.5rem', fontWeight: '700', color: '#fff',
                }}>{unreadCount}</span>
              )}
            </button>
            {showMessages && (
              <div style={{
                marginTop: '0.4rem',
                padding: '0.5rem',
                backgroundColor: '#0a0a0a',
                border: `1px solid ${colors.border}`,
                borderRadius: '8px',
                maxHeight: '200px',
                overflowY: 'auto',
              }}>
                {messages.length === 0 && (
                  <p style={{ color: colors.textMuted, fontSize: '0.7rem', textAlign: 'center', margin: '0.5rem 0' }}>
                    {t('appCard.noMessagesYet', 'No messages yet. Start the conversation.')}
                  </p>
                )}
                {messages.map(msg => {
                  const isMe = msg.sender_user_id === user?.id;
                  return (
                    <div key={msg.id} style={{
                      display: 'flex',
                      justifyContent: isMe ? 'flex-end' : 'flex-start',
                      marginBottom: '0.3rem',
                    }}>
                      <div style={{
                        maxWidth: '80%',
                        padding: '0.3rem 0.5rem',
                        backgroundColor: isMe ? '#3b82f615' : '#ffffff08',
                        border: `1px solid ${isMe ? '#3b82f630' : '#ffffff15'}`,
                        borderRadius: isMe ? '8px 8px 2px 8px' : '8px 8px 8px 2px',
                      }}>
                        <p style={{ color: '#d1d5db', fontSize: '0.72rem', margin: 0, lineHeight: 1.4, wordBreak: 'break-word' }}>
                          {msg.message}
                        </p>
                        <span style={{ color: '#4b5563', fontSize: '0.5rem', display: 'block', textAlign: isMe ? 'right' : 'left', marginTop: '0.1rem' }}>
                          {new Date(msg.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  );
                })}
                <div ref={msgEndRef} />
                {/* Send box */}
                <div style={{ display: 'flex', gap: '0.3rem', marginTop: '0.4rem', borderTop: `1px solid ${colors.border}`, paddingTop: '0.4rem' }}>
                  <input
                    type="text"
                    value={msgText}
                    onChange={(e) => setMsgText(e.target.value.slice(0, 500))}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                    onClick={(e) => e.stopPropagation()}
                    placeholder={t('appCard.typeMessage', 'Type a message...')}
                    style={{ ...inputStyle, flex: 1, fontSize: '0.7rem', minHeight: '32px', padding: '0.3rem 0.5rem' }}
                  />
                  <button
                    onClick={(e) => { e.stopPropagation(); sendMessage(); }}
                    disabled={sendingMsg || !msgText.trim()}
                    style={{
                      padding: '0.3rem 0.5rem',
                      backgroundColor: '#3b82f615',
                      border: '1px solid #3b82f630',
                      borderRadius: '6px',
                      color: '#3b82f6',
                      fontSize: '0.65rem',
                      fontWeight: '600',
                      cursor: sendingMsg || !msgText.trim() ? 'not-allowed' : 'pointer',
                      opacity: sendingMsg || !msgText.trim() ? 0.5 : 1,
                      minHeight: '32px',
                    }}
                  >
                    {sendingMsg ? '...' : t('appCard.send', 'Send')}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Outcome Tracking for Accepted Applications */}
          {application.status === 'accepted' && (
            <div style={{
              marginTop: '0.5rem',
              padding: '0.5rem 0.75rem',
              backgroundColor: '#22c55e08',
              border: '1px solid #22c55e15',
              borderRadius: '8px',
            }}>
              {outcomeSubmitted ? (
                <span style={{ color: '#22c55e', fontSize: '0.7rem', fontWeight: '600' }}>✓ {t('appCard.outcomeSubmitted', 'Transfer outcome submitted')}</span>
              ) : showOutcomePrompt ? (
                <div>
                  <span style={{ color: '#d1d5db', fontSize: '0.7rem', fontWeight: '600', marginBottom: '0.3rem', display: 'block' }}>{t('appCard.didPlayerTransfer', 'Did this player transfer to your kingdom?')}</span>
                  <div style={{ display: 'flex', gap: '0.3rem', marginTop: '0.3rem' }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleRecruiterOutcome(true, 4); }}
                      disabled={outcomeSubmitting}
                      style={{ padding: '0.3rem 0.6rem', backgroundColor: '#22c55e15', border: '1px solid #22c55e30', borderRadius: '6px', color: '#22c55e', fontSize: '0.65rem', fontWeight: '600', cursor: 'pointer' }}
                    >
                      ✅ {t('appCard.yesTransferred', 'Yes, transferred')}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleRecruiterOutcome(false); }}
                      disabled={outcomeSubmitting}
                      style={{ padding: '0.3rem 0.6rem', backgroundColor: '#ef444415', border: '1px solid #ef444430', borderRadius: '6px', color: '#ef4444', fontSize: '0.65rem', fontWeight: '600', cursor: 'pointer' }}
                    >
                      ❌ {t('appCard.no', 'No')}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setShowOutcomePrompt(false); }}
                      style={{ padding: '0.3rem 0.4rem', backgroundColor: 'transparent', border: 'none', color: colors.textMuted, fontSize: '0.65rem', cursor: 'pointer' }}
                    >
                      {t('appCard.cancel', 'Cancel')}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={(e) => { e.stopPropagation(); setShowOutcomePrompt(true); }}
                  style={{ background: 'none', border: `1px solid #22c55e25`, borderRadius: '6px', padding: '0.3rem 0.6rem', color: '#22c55e', fontSize: '0.65rem', fontWeight: '600', cursor: 'pointer' }}
                >
                  📋 {t('appCard.confirmOutcome', 'Confirm transfer outcome')}
                </button>
              )}
            </div>
          )}

          {/* Action Buttons */}
          {actions && (
            <div style={{
              display: 'flex', gap: '0.5rem', marginTop: '0.75rem',
              flexWrap: 'wrap',
            }}>
              {confirmingDecline ? (
                <>
                  <span style={{ color: '#ef4444', fontSize: '0.75rem', fontWeight: '600', alignSelf: 'center' }}>
                    {t('appCard.declineConfirm', 'Decline this application?')}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmingDecline(false);
                      onStatusChange(application.id, 'declined');
                    }}
                    disabled={updating === application.id}
                    style={{
                      padding: '0.4rem 0.75rem',
                      backgroundColor: '#ef444420',
                      border: '1px solid #ef444450',
                      borderRadius: '6px',
                      color: '#ef4444',
                      fontSize: '0.75rem',
                      fontWeight: '700',
                      cursor: 'pointer',
                      minHeight: '44px',
                      display: 'inline-flex',
                      alignItems: 'center',
                    }}
                  >
                    {t('appCard.yesDecline', 'Yes, Decline')}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmingDecline(false);
                    }}
                    style={{
                      padding: '0.4rem 0.75rem',
                      backgroundColor: '#ffffff08',
                      border: '1px solid #ffffff15',
                      borderRadius: '6px',
                      color: '#9ca3af',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      minHeight: '44px',
                      display: 'inline-flex',
                      alignItems: 'center',
                    }}
                  >
                    {t('appCard.cancel', 'Cancel')}
                  </button>
                </>
              ) : actions.next.map((nextStatus) => {
                const actionColor = actions.colors[nextStatus];
                if (!actionColor) return null;
                const isDecline = nextStatus === 'declined';
                return (
                  <button
                    key={nextStatus}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isDecline) {
                        setConfirmingDecline(true);
                      } else {
                        onStatusChange(application.id, nextStatus);
                      }
                    }}
                    disabled={updating === application.id}
                    style={{
                      padding: '0.4rem 0.75rem',
                      backgroundColor: actionColor.bg,
                      border: `1px solid ${actionColor.border}`,
                      borderRadius: '6px',
                      color: actionColor.text,
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      cursor: updating === application.id ? 'not-allowed' : 'pointer',
                      opacity: updating === application.id ? 0.5 : 1,
                      textTransform: 'capitalize',
                      minHeight: '44px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {updating === application.id ? '...' : nextStatus === 'viewed' ? t('appCard.markViewed', 'Mark Viewed') : (nextStatus === 'declined' && application.status === 'accepted') ? t('appCard.cancelApproval', 'Cancel Approval') : nextStatus.charAt(0).toUpperCase() + nextStatus.slice(1)}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ApplicationCard;
