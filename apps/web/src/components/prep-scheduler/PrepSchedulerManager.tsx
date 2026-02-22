import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { colors, FONT_DISPLAY } from '../../utils/styles';
import {
  PrepSchedule, PrepSubmission, SlotAssignment, ChangeRequest,
  ManagerEntry, ManagerSearchResult,
  Day, DAYS, DAY_COLORS,
  getDayLabel, getDayLabelShort,
} from './types';
import {
  getDeadlineCountdown, formatDeadlineUTC, getEffectiveSpeedups, formatMinutes, formatAvailRanges,
  isSlotInAvailability, isSkippedDay,
} from './utils';

interface PrepSchedulerManagerProps {
  isMobile: boolean;
  schedule: PrepSchedule;
  submissions: PrepSubmission[];
  assignments: SlotAssignment[];
  isManager: boolean;
  isEditorOrCoEditor: boolean;
  activeDay: Day;
  setActiveDay: (day: Day) => void;
  saving: boolean;
  managerUsername: string;
  changeRequests: ChangeRequest[];
  dayAssignments: SlotAssignment[];
  daySubmissions: PrepSubmission[];
  unassignedPlayers: PrepSubmission[];
  availabilityGaps: { slot: string; candidates: number }[];
  // Manager search
  managers: ManagerEntry[];
  assignManagerInput: string;
  setAssignManagerInput: (v: string) => void;
  managerSearchResults: ManagerSearchResult[];
  showManagerDropdown: boolean;
  setShowManagerDropdown: (v: boolean) => void;
  managerSearchRef: React.RefObject<HTMLDivElement | null>;
  // Actions
  copyShareLink: () => void;
  exportScheduleCSV: () => void;
  setView: (view: 'landing' | 'form' | 'manage' | 'gate') => void;
  closeOrReopenForm: () => void;
  toggleLock: () => void;
  archiveSchedule: () => void;
  deleteSchedule: () => void;
  runAutoAssign: (day: Day) => Promise<void>;
  assignSlot: (day: Day, slotTime: string, submissionId: string) => Promise<void>;
  removeAssignment: (assignmentId: string) => Promise<void>;
  clearDayAssignments: (day: Day) => Promise<void>;
  acknowledgeChangeRequest: (reqId: string) => Promise<void>;
  addManager: (userId: string, username: string) => Promise<void>;
  removeManagerById: (mgrId: string, userId: string) => Promise<void>;
  updateDeadline?: (newDeadline: string) => Promise<void>;
  toggleStagger: () => Promise<void>;
  removingIds: Set<string>;
  effectiveSlots: string[];
  maxSlots: number;
  updateSubmissionOptOuts?: (submissionId: string, optOuts: { skip_monday: boolean; skip_tuesday: boolean; skip_thursday: boolean }) => Promise<void>;
  updateAnySubmission?: (submissionId: string, data: Partial<PrepSubmission>) => Promise<void>;
}

const PrepSchedulerManager: React.FC<PrepSchedulerManagerProps> = (props) => {
  const { t } = useTranslation();
  const {
    isMobile, schedule, submissions, assignments,
    isManager, isEditorOrCoEditor, activeDay, setActiveDay, saving,
    managerUsername, changeRequests,
    dayAssignments, daySubmissions, unassignedPlayers, availabilityGaps,
    managers, assignManagerInput, setAssignManagerInput, managerSearchResults,
    showManagerDropdown, setShowManagerDropdown, managerSearchRef,
    copyShareLink, exportScheduleCSV,
    setView, closeOrReopenForm, toggleLock, archiveSchedule, deleteSchedule,
    runAutoAssign, assignSlot, removeAssignment, clearDayAssignments,
    acknowledgeChangeRequest, addManager, removeManagerById, updateDeadline,
    toggleStagger, removingIds, effectiveSlots, maxSlots,
    updateSubmissionOptOuts, updateAnySubmission,
  } = props;

  const cardStyle: React.CSSProperties = {
    backgroundColor: colors.cardAlt, borderRadius: '12px', padding: isMobile ? '1rem' : '1.25rem',
    border: `1px solid ${colors.border}`,
  };
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '0.5rem 0.75rem', backgroundColor: colors.bg,
    border: `1px solid ${colors.border}`, borderRadius: '6px', color: colors.text,
    fontSize: isMobile ? '1rem' : '0.85rem', outline: 'none', boxSizing: 'border-box',
  };

  const [showAllActions, setShowAllActions] = useState(false);
  const [showAllSlots, setShowAllSlots] = useState(false);
  const [expandedSubmissionId, setExpandedSubmissionId] = useState<string | null>(null);
  const [editingSubId, setEditingSubId] = useState<string | null>(null);
  const [editSpeedups, setEditSpeedups] = useState<{ general: number; training: number; construction: number; research: number }>({ general: 0, training: 0, construction: 0, research: 0 });
  const [editingDeadline, setEditingDeadline] = useState(false);
  const [deadlineInput, setDeadlineInput] = useState(() => {
    if (!schedule.deadline) return '';
    const d = new Date(schedule.deadline);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}T${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
  });

  const assignedCount = dayAssignments.length;
  const pendingRequests = changeRequests.filter(r => r.status === 'pending');

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a' }}>
      {/* Header */}
      <div style={{ padding: isMobile ? '1rem' : '1.5rem 2rem', background: 'linear-gradient(180deg, #111111 0%, #0a0a0a 100%)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', flexDirection: isMobile ? 'column' : 'row', gap: '0.75rem' }}>
            <div>
              <h1 style={{ fontSize: isMobile ? '1.1rem' : '1.5rem', fontFamily: FONT_DISPLAY, margin: 0 }}>
                <span style={{ color: '#fff' }}>K{schedule.kingdom_number}</span>
                <span style={{ color: '#a855f7', marginLeft: '0.5rem' }}>{t('prepScheduler.prepManager', 'Prep Manager')}</span>
                {schedule.kvk_number && <span style={{ color: colors.textMuted, fontSize: '0.8rem', marginLeft: '0.5rem' }}>KvK #{schedule.kvk_number}</span>}
              </h1>
              <p style={{ color: colors.textMuted, fontSize: '0.75rem', margin: '0.25rem 0 0', display: 'flex', flexWrap: 'wrap', gap: '0.25rem', alignItems: 'center' }}>
                <span>{submissions.length} {t('prepScheduler.submissions', 'submissions')}</span>
                <span>·</span>
                <span>{assignedCount}/{maxSlots} {t('prepScheduler.slotsFor', 'slots for')} {getDayLabel(activeDay, t)}</span>
                {(() => { const skipCount = submissions.filter(s => isSkippedDay(s, activeDay)).length; return skipCount > 0 ? <><span>·</span><span style={{ color: '#f59e0b' }}>{skipCount} {t('prepScheduler.skipped', 'skipped')} {getDayLabel(activeDay, t)}</span></> : null; })()}
                {managerUsername && <><span>·</span><span>{t('prepScheduler.manager', 'Manager')}: <span style={{ color: '#a855f7' }}>{managerUsername}</span></span></>}
                {schedule.status === 'archived' && <span style={{ padding: '0.1rem 0.4rem', backgroundColor: `${colors.textMuted}20`, borderRadius: '4px', fontSize: '0.65rem', color: colors.textMuted }}>{t('prepScheduler.archived', 'ARCHIVED')}</span>}
                {schedule.status === 'closed' && <span style={{ padding: '0.1rem 0.4rem', backgroundColor: '#ef444420', borderRadius: '4px', fontSize: '0.65rem', color: '#ef4444', fontWeight: 600 }}>🔒 {t('prepScheduler.formClosedTag', 'FORM CLOSED')}</span>}
                {schedule.is_locked && <span style={{ padding: '0.1rem 0.4rem', backgroundColor: '#22c55e20', borderRadius: '4px', fontSize: '0.65rem', color: '#22c55e', fontWeight: 600 }}>✅ {t('prepScheduler.lockedIn', 'LOCKED IN')}</span>}
                {schedule.stagger_enabled && <span style={{ padding: '0.1rem 0.4rem', backgroundColor: '#8b5cf620', borderRadius: '4px', fontSize: '0.65rem', color: '#8b5cf6', fontWeight: 600 }}>⏱️ {t('prepScheduler.staggerTag', 'STAGGER')}</span>}
                {pendingRequests.length > 0 && <span style={{ padding: '0.1rem 0.4rem', backgroundColor: '#ef444420', borderRadius: '4px', fontSize: '0.65rem', color: '#ef4444', fontWeight: 600 }}>🔔 {pendingRequests.length} {t('prepScheduler.changeRequests', 'change requests')}</span>}
                {(() => { const dl = getDeadlineCountdown(schedule.deadline, t); const utcLabel = formatDeadlineUTC(schedule.deadline); return dl ? <><span style={{ padding: '0.1rem 0.4rem', backgroundColor: dl.urgent ? '#ef444420' : '#f59e0b20', borderRadius: '4px', fontSize: '0.65rem', color: dl.urgent ? '#ef4444' : '#f59e0b', fontWeight: 600 }}>⏰ {dl.text}</span>{utcLabel && <span style={{ fontSize: '0.6rem', color: '#6b7280' }}>{utcLabel}</span>}</> : null; })()}
                {(isEditorOrCoEditor || isManager) && updateDeadline && !editingDeadline && (
                  <button onClick={() => setEditingDeadline(true)} style={{ background: 'none', border: 'none', color: '#a855f7', fontSize: '0.6rem', cursor: 'pointer', padding: '0.1rem 0.3rem', fontWeight: 600 }}>✏️ {schedule.deadline ? t('prepScheduler.editDeadline', 'Edit Deadline') : t('prepScheduler.setDeadline', 'Set Deadline')}</button>
                )}
                {editingDeadline && updateDeadline && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', flexWrap: 'wrap' }}>
                    <input type="date" value={deadlineInput ? deadlineInput.split('T')[0] : ''} onChange={(e) => {
                      const date = e.target.value;
                      if (!date) { setDeadlineInput(''); return; }
                      const tp = deadlineInput ? deadlineInput.split('T')[1] || '00:00' : '00:00';
                      setDeadlineInput(`${date}T${tp}`);
                    }} style={{ padding: '0.15rem 0.3rem', backgroundColor: colors.bg, border: `1px solid ${colors.border}`, borderRadius: '4px', color: colors.text, fontSize: '0.6rem' }} />
                    <select value={deadlineInput ? String(parseInt(deadlineInput.split('T')[1]?.split(':')[0] || '0')) : '0'} onChange={(e) => {
                      const dp = deadlineInput ? deadlineInput.split('T')[0] : new Date().toISOString().split('T')[0];
                      const mn = deadlineInput ? deadlineInput.split('T')[1]?.split(':')[1] || '00' : '00';
                      setDeadlineInput(`${dp}T${String(e.target.value).padStart(2, '0')}:${mn}`);
                    }} style={{ padding: '0.15rem 0.2rem', backgroundColor: colors.bg, border: `1px solid ${colors.border}`, borderRadius: '4px', color: colors.text, fontSize: '0.6rem', minWidth: 40, textAlign: 'center' }}>
                      {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{String(i).padStart(2, '0')}</option>)}
                    </select>
                    <span style={{ color: colors.textMuted, fontWeight: 700, fontSize: '0.6rem' }}>:</span>
                    <select value={deadlineInput ? String(parseInt(deadlineInput.split('T')[1]?.split(':')[1] || '0')) : '0'} onChange={(e) => {
                      const dp = deadlineInput ? deadlineInput.split('T')[0] : new Date().toISOString().split('T')[0];
                      const hr = deadlineInput ? deadlineInput.split('T')[1]?.split(':')[0] || '00' : '00';
                      setDeadlineInput(`${dp}T${hr}:${String(e.target.value).padStart(2, '0')}`);
                    }} style={{ padding: '0.15rem 0.2rem', backgroundColor: colors.bg, border: `1px solid ${colors.border}`, borderRadius: '4px', color: colors.text, fontSize: '0.6rem', minWidth: 40, textAlign: 'center' }}>
                      {[0, 15, 30, 45].map(m => <option key={m} value={m}>{String(m).padStart(2, '0')}</option>)}
                    </select>
                    <span style={{ color: colors.textMuted, fontSize: '0.55rem', fontWeight: 600 }}>UTC</span>
                    <button onClick={async () => { await updateDeadline(deadlineInput); setEditingDeadline(false); }} disabled={saving} style={{ background: 'none', border: '1px solid #a855f730', borderRadius: '4px', color: '#a855f7', fontSize: '0.55rem', cursor: 'pointer', padding: '0.15rem 0.35rem', fontWeight: 600 }}>{saving ? '...' : '✓'}</button>
                    <button onClick={() => setEditingDeadline(false)} style={{ background: 'none', border: 'none', color: colors.textMuted, fontSize: '0.55rem', cursor: 'pointer', padding: '0.15rem 0.2rem' }}>✗</button>
                  </span>
                )}
              </p>
            </div>
            {/* Action buttons — collapsible on mobile */}
            {isMobile ? (
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {/* Primary actions always visible */}
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={copyShareLink} style={{ flex: 1, padding: '0.55rem 0.75rem', backgroundColor: `${colors.primary}15`, border: `1px solid ${colors.primary}30`, borderRadius: '8px', color: colors.primary, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', minHeight: '44px' }}>🔗 {t('prepScheduler.copyFormLink', 'Copy Form Link')}</button>
                  <button onClick={() => setView('form')} style={{ flex: 1, padding: '0.55rem 0.75rem', backgroundColor: '#a855f715', border: '1px solid #a855f730', borderRadius: '8px', color: '#a855f7', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', minHeight: '44px' }}>� {t('prepScheduler.viewForm', 'View Form')}</button>
                </div>
                {/* Toggle for more actions */}
                <button onClick={() => setShowAllActions(prev => !prev)} style={{ padding: '0.4rem', backgroundColor: 'transparent', border: `1px solid ${colors.border}`, borderRadius: '6px', color: colors.textMuted, fontSize: '0.75rem', cursor: 'pointer', textAlign: 'center' }}>
                  {showAllActions ? `▲ ${t('prepScheduler.hideActions', 'Hide Actions')}` : `▼ ${t('prepScheduler.moreActions', 'More Actions')}`}
                </button>
                {showAllActions && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', padding: '0.5rem', backgroundColor: `${colors.bg}80`, borderRadius: '8px', border: `1px solid ${colors.border}` }}>
                    <button onClick={exportScheduleCSV} style={{ padding: '0.5rem 0.75rem', backgroundColor: '#22c55e15', border: '1px solid #22c55e30', borderRadius: '6px', color: '#22c55e', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', textAlign: 'left', minHeight: '40px' }}>📊 {t('prepScheduler.exportCSV', 'Export CSV')}</button>
                    {schedule.status !== 'archived' && (isEditorOrCoEditor || isManager) && (
                      <button onClick={closeOrReopenForm} style={{ padding: '0.5rem 0.75rem', backgroundColor: schedule.status === 'closed' ? '#22c55e15' : '#ef444415', border: `1px solid ${schedule.status === 'closed' ? '#22c55e30' : '#ef444430'}`, borderRadius: '6px', color: schedule.status === 'closed' ? '#22c55e' : '#ef4444', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', textAlign: 'left', minHeight: '40px' }}>{schedule.status === 'closed' ? `🔓 ${t('prepScheduler.reopenForm', 'Reopen Form')}` : `🔒 ${t('prepScheduler.closeForm', 'Close Form')}`}</button>
                    )}
                    {schedule.status !== 'archived' && (isEditorOrCoEditor || isManager) && (
                      <button onClick={toggleLock} style={{ padding: '0.5rem 0.75rem', backgroundColor: schedule.is_locked ? '#f59e0b15' : '#22c55e15', border: `1px solid ${schedule.is_locked ? '#f59e0b30' : '#22c55e30'}`, borderRadius: '6px', color: schedule.is_locked ? '#f59e0b' : '#22c55e', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', textAlign: 'left', minHeight: '40px' }}>{schedule.is_locked ? `🔓 ${t('prepScheduler.unlockSchedule', 'Unlock Schedule')}` : `✅ ${t('prepScheduler.lockInSchedule', 'Lock In Schedule')}`}</button>
                    )}
                    {schedule.status !== 'archived' && (isEditorOrCoEditor || isManager) && (
                      <button onClick={toggleStagger} disabled={saving} style={{ padding: '0.5rem 0.75rem', backgroundColor: schedule.stagger_enabled ? '#8b5cf615' : '#6366f115', border: `1px solid ${schedule.stagger_enabled ? '#8b5cf630' : '#6366f130'}`, borderRadius: '6px', color: schedule.stagger_enabled ? '#8b5cf6' : '#6366f1', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', textAlign: 'left', minHeight: '40px', opacity: saving ? 0.6 : 1 }}>{schedule.stagger_enabled ? `⏱️ ${t('prepScheduler.disableStagger', 'Disable Stagger')}` : `⏱️ ${t('prepScheduler.enableStagger', 'Enable Stagger')}`}</button>
                    )}
                    {schedule.status === 'active' && isEditorOrCoEditor && (
                      <button onClick={archiveSchedule} style={{ padding: '0.5rem 0.75rem', backgroundColor: `${colors.textMuted}10`, border: `1px solid ${colors.border}`, borderRadius: '6px', color: colors.textMuted, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', textAlign: 'left', minHeight: '40px' }}>📦 {t('prepScheduler.archive', 'Archive')}</button>
                    )}
                    {schedule.status === 'archived' && (isEditorOrCoEditor || isManager) && (
                      <button onClick={deleteSchedule} style={{ padding: '0.5rem 0.75rem', backgroundColor: '#ef444415', border: '1px solid #ef444430', borderRadius: '6px', color: '#ef4444', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', textAlign: 'left', minHeight: '40px' }}>🗑️ {t('prepScheduler.deleteSchedule', 'Delete Schedule')}</button>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button onClick={copyShareLink} style={{ padding: '0.4rem 0.75rem', backgroundColor: `${colors.primary}15`, border: `1px solid ${colors.primary}30`, borderRadius: '6px', color: colors.primary, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>🔗 {t('prepScheduler.copyFormLink', 'Copy Form Link')}</button>
                <button onClick={exportScheduleCSV} style={{ padding: '0.4rem 0.75rem', backgroundColor: '#22c55e15', border: '1px solid #22c55e30', borderRadius: '6px', color: '#22c55e', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>📊 {t('prepScheduler.exportCSV', 'Export CSV')}</button>
                <button onClick={() => setView('form')} style={{ padding: '0.4rem 0.75rem', backgroundColor: '#a855f715', border: '1px solid #a855f730', borderRadius: '6px', color: '#a855f7', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>📝 {t('prepScheduler.viewForm', 'View Form')}</button>
                {schedule.status !== 'archived' && (isEditorOrCoEditor || isManager) && (
                  <button onClick={closeOrReopenForm} style={{ padding: '0.4rem 0.75rem', backgroundColor: schedule.status === 'closed' ? '#22c55e15' : '#ef444415', border: `1px solid ${schedule.status === 'closed' ? '#22c55e30' : '#ef444430'}`, borderRadius: '6px', color: schedule.status === 'closed' ? '#22c55e' : '#ef4444', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>{schedule.status === 'closed' ? `🔓 ${t('prepScheduler.reopenForm', 'Reopen Form')}` : `🔒 ${t('prepScheduler.closeForm', 'Close Form')}`}</button>
                )}
                {schedule.status !== 'archived' && (isEditorOrCoEditor || isManager) && (
                  <button onClick={toggleLock} style={{ padding: '0.4rem 0.75rem', backgroundColor: schedule.is_locked ? '#f59e0b15' : '#22c55e15', border: `1px solid ${schedule.is_locked ? '#f59e0b30' : '#22c55e30'}`, borderRadius: '6px', color: schedule.is_locked ? '#f59e0b' : '#22c55e', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>{schedule.is_locked ? `🔓 ${t('prepScheduler.unlockSchedule', 'Unlock Schedule')}` : `✅ ${t('prepScheduler.lockInSchedule', 'Lock In Schedule')}`}</button>
                )}
                {schedule.status !== 'archived' && (isEditorOrCoEditor || isManager) && (
                  <button onClick={toggleStagger} disabled={saving} style={{ padding: '0.4rem 0.75rem', backgroundColor: schedule.stagger_enabled ? '#8b5cf615' : '#6366f115', border: `1px solid ${schedule.stagger_enabled ? '#8b5cf630' : '#6366f130'}`, borderRadius: '6px', color: schedule.stagger_enabled ? '#8b5cf6' : '#6366f1', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>{schedule.stagger_enabled ? `⏱️ ${t('prepScheduler.disableStagger', 'Disable Stagger')}` : `⏱️ ${t('prepScheduler.enableStagger', 'Enable Stagger')}`}</button>
                )}
                {schedule.status === 'active' && isEditorOrCoEditor && (
                  <button onClick={archiveSchedule} style={{ padding: '0.4rem 0.75rem', backgroundColor: `${colors.textMuted}10`, border: `1px solid ${colors.border}`, borderRadius: '6px', color: colors.textMuted, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>📦 {t('prepScheduler.archive', 'Archive')}</button>
                )}
                {schedule.status === 'archived' && (isEditorOrCoEditor || isManager) && (
                  <button onClick={deleteSchedule} style={{ padding: '0.4rem 0.75rem', backgroundColor: '#ef444415', border: '1px solid #ef444430', borderRadius: '6px', color: '#ef4444', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>🗑️ {t('prepScheduler.deleteSchedule', 'Delete Schedule')}</button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: isMobile ? '0.75rem' : '1rem 2rem' }}>
        {/* Prep Manager Assignment */}
        {isEditorOrCoEditor && (
          <div style={{ ...cardStyle, marginBottom: '1rem', borderColor: '#a855f730' }}>
            <h4 style={{ color: '#a855f7', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.5rem' }}>👤 {t('prepScheduler.prepManagers', 'Prep Managers')}</h4>
            {managers.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.5rem' }}>
                {managers.map(mgr => (
                  <div key={mgr.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.2rem 0.5rem', backgroundColor: '#a855f715', border: '1px solid #a855f730', borderRadius: '20px' }}>
                    <span style={{ color: '#a855f7', fontSize: '0.75rem', fontWeight: 600 }}>{mgr.username}</span>
                    <button onClick={() => removeManagerById(mgr.id, mgr.user_id)} style={{ background: 'none', border: 'none', color: colors.error, cursor: 'pointer', fontSize: '0.8rem', padding: '0 0.1rem', lineHeight: 1 }}>×</button>
                  </div>
                ))}
              </div>
            )}
            <div ref={managerSearchRef} style={{ position: 'relative' }}>
              <input
                value={assignManagerInput}
                onChange={(e) => setAssignManagerInput(e.target.value)}
                onFocus={() => { if (managerSearchResults.length > 0) setShowManagerDropdown(true); }}
                placeholder={t('prepScheduler.searchPlaceholder', 'Search by username or player ID...')}
                style={{ ...inputStyle, width: isMobile ? '100%' : '280px' }}
              />
              {showManagerDropdown && managerSearchResults.length > 0 && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: isMobile ? 0 : 'auto',
                  width: isMobile ? '100%' : '280px', backgroundColor: '#1a1a1a', border: `1px solid ${colors.border}`,
                  borderRadius: '8px', marginTop: '2px', zIndex: 50, maxHeight: '200px', overflowY: 'auto',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                }}>
                  {managerSearchResults.map(u => {
                    const alreadyAdded = managers.some(m => m.user_id === u.id);
                    return (
                      <button
                        key={u.id}
                        onClick={() => !alreadyAdded && addManager(u.id, u.linked_username || u.username)}
                        disabled={alreadyAdded}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%',
                          padding: '0.5rem 0.75rem', background: 'none', border: 'none', borderBottom: `1px solid ${colors.borderSubtle}`,
                          color: alreadyAdded ? colors.textMuted : colors.text, fontSize: '0.8rem', textAlign: 'left',
                          cursor: alreadyAdded ? 'default' : 'pointer', opacity: alreadyAdded ? 0.5 : 1,
                        }}
                        onMouseEnter={(e) => { if (!alreadyAdded) e.currentTarget.style.backgroundColor = '#252525'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                      >
                        <span style={{ fontWeight: 600 }}>{u.linked_username || u.username}</span>
                        {u.linked_player_id && <span style={{ color: colors.textMuted, fontSize: '0.7rem' }}>ID: {u.linked_player_id}</span>}
                        {alreadyAdded && <span style={{ marginLeft: 'auto', color: '#a855f7', fontSize: '0.65rem' }}>✓</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            {managers.length === 0 && <p style={{ color: colors.textMuted, fontSize: '0.7rem', marginTop: '0.35rem' }}>{t('prepScheduler.noManagers', 'No managers assigned yet. Search and add Prep Managers above.')}</p>}
          </div>
        )}

        {/* Change Requests Panel */}
        {(isManager || isEditorOrCoEditor) && pendingRequests.length > 0 && (
          <div style={{ ...cardStyle, marginBottom: '1rem', borderColor: '#ef444430', backgroundColor: '#ef444408' }}>
            <h4 style={{ color: '#ef4444', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.5rem' }}>🔔 {t('prepScheduler.pendingChangeRequests', 'Pending Change Requests')}</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {pendingRequests.map(req => {
                const sub = submissions.find(s => s.id === req.submission_id);
                return (
                  <div key={req.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.6rem', backgroundColor: '#1a1a1a', borderRadius: '6px', border: '1px solid #2a2a2a', flexWrap: 'wrap' }}>
                    <span style={{ color: '#ef4444', fontSize: '0.7rem', fontWeight: 600 }}>{req.request_type === 'cant_attend' ? '❌' : req.request_type === 'change_slot' ? '🔄' : '💬'}</span>
                    <span style={{ color: colors.text, fontSize: '0.75rem', fontWeight: 600 }}>{sub?.username || 'Unknown'}</span>
                    {req.day && <span style={{ color: DAY_COLORS[req.day as Day], fontSize: '0.65rem' }}>{getDayLabel(req.day as Day, t)}</span>}
                    <span style={{ color: colors.textMuted, fontSize: '0.7rem', flex: 1 }}>{req.message || req.request_type.replace('_', ' ')}</span>
                    <button onClick={() => acknowledgeChangeRequest(req.id)} style={{ padding: '0.2rem 0.5rem', backgroundColor: '#22c55e15', border: '1px solid #22c55e30', borderRadius: '4px', color: '#22c55e', fontSize: '0.65rem', fontWeight: 600, cursor: 'pointer' }}>✓ {t('prepScheduler.resolve', 'Resolve')}</button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Day Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          {DAYS.map(day => {
            const dayCount = assignments.filter(a => a.day === day).length;
            return (
              <button key={day} onClick={() => { setActiveDay(day); setShowAllSlots(false); }}
                style={{ padding: isMobile ? '0.5rem 0.5rem' : '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: activeDay === day ? 700 : 400, flex: isMobile ? 1 : undefined,
                  backgroundColor: activeDay === day ? `${DAY_COLORS[day]}20` : 'transparent',
                  border: `1px solid ${activeDay === day ? `${DAY_COLORS[day]}50` : colors.border}`,
                  color: activeDay === day ? DAY_COLORS[day] : colors.textMuted,
                  display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: 'center', gap: isMobile ? '0.1rem' : '0.3rem',
                  minHeight: isMobile ? '48px' : undefined }}>
                <span>{isMobile ? getDayLabelShort(day, t) : getDayLabel(day, t)}</span>
                <span style={{ fontSize: isMobile ? '0.65rem' : '0.8rem', opacity: 0.8 }}>({dayCount}/{maxSlots})</span>
              </button>
            );
          })}
        </div>

        {/* Auto-assign + Stats */}
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button onClick={() => runAutoAssign(activeDay)} disabled={saving || daySubmissions.length === 0}
            style={{ padding: '0.5rem 1rem', backgroundColor: `${DAY_COLORS[activeDay]}20`, border: `1px solid ${DAY_COLORS[activeDay]}50`, borderRadius: '8px', color: DAY_COLORS[activeDay], fontSize: '0.8rem', fontWeight: 600, cursor: daySubmissions.length > 0 ? 'pointer' : 'not-allowed', opacity: saving ? 0.6 : 1 }}>
            {saving ? t('prepScheduler.assigning', 'Assigning...') : `⚡ ${t('prepScheduler.autoAssign', 'Auto-Assign')} ${getDayLabel(activeDay, t)}`}
          </button>
          <span style={{ color: colors.textMuted, fontSize: '0.75rem' }}>
            {daySubmissions.length} {t('prepScheduler.available', 'available')} · {unassignedPlayers.length} {t('prepScheduler.unassigned', 'unassigned')}
            {availabilityGaps.length > 0 && <span style={{ color: colors.error }}> · {availabilityGaps.length} {t('prepScheduler.uncoveredSlots', 'uncovered slots')}</span>}
          </span>
        </div>

        {/* Unassigned Players Warning */}
        {unassignedPlayers.length > 0 && dayAssignments.length > 0 && (
          <div style={{ ...cardStyle, marginBottom: '1rem', borderColor: '#f59e0b30', backgroundColor: '#f59e0b08' }}>
            <h4 style={{ color: '#f59e0b', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.5rem' }}>
              ⚠️ {unassignedPlayers.length} {t('prepScheduler.unassignedPlayers', 'Unassigned Players — Waitlist')}
            </h4>
            <p style={{ color: colors.textMuted, fontSize: '0.7rem', marginBottom: '0.5rem' }}>
              {t('prepScheduler.waitlistDesc', 'These players have availability but weren\'t assigned a slot. You can manually assign them using the dropdowns below.')}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
              {unassignedPlayers.slice(0, 12).map(sub => (
                <span key={sub.id} style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem', backgroundColor: '#f59e0b15', border: '1px solid #f59e0b25', color: '#f59e0b' }}>
                  {sub.username} ({formatMinutes(getEffectiveSpeedups(sub, activeDay, schedule))})
                </span>
              ))}
              {unassignedPlayers.length > 12 && <span style={{ color: colors.textMuted, fontSize: '0.7rem', alignSelf: 'center' }}>+{unassignedPlayers.length - 12} {t('prepScheduler.more', 'more')}</span>}
            </div>
          </div>
        )}

        {/* Two-column layout: submissions + slots */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '3fr 1fr', gap: '1rem' }}>
          {/* Submissions — Table on desktop, Cards on mobile */}
          <div style={cardStyle}>
            <h3 style={{ color: DAY_COLORS[activeDay], fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem' }}>📊 {t('prepScheduler.submissionsTable', 'Submissions')} — {getDayLabel(activeDay, t)}</h3>

            {isMobile ? (
              /* Mobile: Card-based layout */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {daySubmissions.map((sub, idx) => {
                  const effective = getEffectiveSpeedups(sub, activeDay, schedule);
                  const assignment = dayAssignments.find(a => a.submission_id === sub.id);
                  const availKey = `${activeDay}_availability` as keyof PrepSubmission;
                  const avail = (sub[availKey] as string[][] | undefined) || [];
                  const rank = idx + 1;
                  const isBeyondCutoff = rank > maxSlots;
                  return (
                    <div key={sub.id} style={{
                      padding: '0.6rem', borderRadius: '8px',
                      backgroundColor: isBeyondCutoff ? '#ef444410' : assignment ? `${DAY_COLORS[activeDay]}08` : colors.bg,
                      border: `1px solid ${isBeyondCutoff ? '#ef444430' : assignment ? `${DAY_COLORS[activeDay]}20` : colors.borderSubtle}`,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span style={{ color: isBeyondCutoff ? '#ef4444' : DAY_COLORS[activeDay], fontWeight: 700, fontSize: '0.75rem', minWidth: '20px' }}>#{rank}</span>
                          <span style={{ color: colors.text, fontWeight: 600, fontSize: '0.8rem' }}>{sub.username}</span>
                          {sub.alliance_tag && <span style={{ color: colors.textMuted, fontSize: '0.7rem' }}>[{sub.alliance_tag}]</span>}
                        </div>
                        {sub.screenshot_url && <a href={sub.screenshot_url} target="_blank" rel="noopener noreferrer" style={{ color: '#22c55e', fontSize: '0.75rem' }}>📷</a>}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.7rem', color: colors.textMuted }}>
                          <span style={{ color: DAY_COLORS[activeDay], fontWeight: 600 }}>{formatMinutes(effective)}</span>
                          <span>{formatAvailRanges(avail)}</span>
                        </div>
                        {assignment ? (
                          <span style={{ padding: '0.15rem 0.4rem', borderRadius: '4px', fontSize: '0.7rem', backgroundColor: `${DAY_COLORS[activeDay]}20`, color: DAY_COLORS[activeDay], fontWeight: 600 }}>{assignment.slot_time}</span>
                        ) : isBeyondCutoff ? (
                          <span style={{ fontSize: '0.6rem', color: '#ef4444', fontWeight: 600 }}>WAIT</span>
                        ) : (
                          <span style={{ color: colors.textMuted, fontSize: '0.65rem' }}>—</span>
                        )}
                      </div>
                    </div>
                  );
                })}
                {daySubmissions.length === 0 && (
                  <p style={{ padding: '1rem', textAlign: 'center', color: colors.textMuted, fontSize: '0.8rem' }}>{t('prepScheduler.noSubmissions', 'No submissions for')} {getDayLabel(activeDay, t)}.</p>
                )}
              </div>
            ) : (
              /* Desktop: Table layout */
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                  <thead><tr style={{ borderBottom: `1px solid ${colors.border}` }}>
                    <th style={{ textAlign: 'center', padding: '0.4rem', color: colors.textMuted, fontWeight: 600, width: '30px' }}>#</th>
                    <th style={{ textAlign: 'left', padding: '0.4rem', color: colors.textMuted, fontWeight: 600 }}>{t('prepScheduler.alliance', 'Alliance')}</th>
                    <th style={{ textAlign: 'left', padding: '0.4rem', color: colors.textMuted, fontWeight: 600 }}>{t('prepScheduler.username', 'Username')}</th>
                    <th style={{ textAlign: 'right', padding: '0.4rem', color: colors.textMuted, fontWeight: 600 }}>{t('prepScheduler.speedupsLabel', 'Speedups')}</th>
                    <th style={{ textAlign: 'center', padding: '0.4rem', color: colors.textMuted, fontWeight: 600 }}>{t('prepScheduler.proof', 'Proof')}</th>
                    <th style={{ textAlign: 'left', padding: '0.4rem', color: colors.textMuted, fontWeight: 600 }}>{t('prepScheduler.availability', 'Availability')}</th>
                    <th style={{ textAlign: 'center', padding: '0.4rem', color: colors.textMuted, fontWeight: 600 }}>{t('prepScheduler.slot', 'Slot')}</th>
                  </tr></thead>
                  <tbody>
                    {daySubmissions.map((sub, idx) => {
                      const effective = getEffectiveSpeedups(sub, activeDay, schedule);
                      const assignment = dayAssignments.find(a => a.submission_id === sub.id);
                      const availKey = `${activeDay}_availability` as keyof PrepSubmission;
                      const avail = (sub[availKey] as string[][] | undefined) || [];
                      const rank = idx + 1;
                      const isBeyondCutoff = rank > maxSlots;
                      const hasChanged = !!sub.speedup_changed_at;
                      return (
                        <tr key={sub.id} style={{ borderBottom: `1px solid ${isBeyondCutoff ? '#ef444430' : colors.borderSubtle}`, backgroundColor: isBeyondCutoff ? '#ef444410' : assignment ? `${DAY_COLORS[activeDay]}08` : 'transparent' }}>
                          <td style={{ padding: '0.4rem', textAlign: 'center', color: isBeyondCutoff ? '#ef4444' : DAY_COLORS[activeDay], fontWeight: 700, fontSize: '0.7rem' }}>{rank}{isBeyondCutoff && <span title={`Beyond ${maxSlots}-user cutoff`} style={{ display: 'block', fontSize: '0.5rem', color: '#ef4444' }}>WAIT</span>}</td>
                          <td style={{ padding: '0.4rem', color: colors.textMuted }}>{sub.alliance_tag || '—'}</td>
                          <td style={{ padding: '0.4rem', color: isBeyondCutoff ? '#ef4444' : assignment ? colors.text : colors.textMuted, fontWeight: assignment ? 500 : 400 }}>{sub.username}{hasChanged && <span title={`Speedups changed ${new Date(sub.speedup_changed_at!).toLocaleDateString()}`} style={{ marginLeft: '0.3rem', color: '#f59e0b', fontSize: '0.65rem', cursor: 'help' }}>⚠️</span>}</td>
                          <td style={{ padding: '0.4rem', textAlign: 'right', color: isBeyondCutoff ? '#ef4444' : DAY_COLORS[activeDay], fontWeight: 600 }}>{formatMinutes(effective)}</td>
                          <td style={{ padding: '0.4rem', textAlign: 'center' }}>
                            {sub.screenshot_url ? (
                              <a href={sub.screenshot_url} target="_blank" rel="noopener noreferrer" style={{ color: '#22c55e', fontSize: '0.7rem' }}>📷</a>
                            ) : <span style={{ color: colors.textMuted, fontSize: '0.65rem' }}>—</span>}
                          </td>
                          <td style={{ padding: '0.4rem', color: colors.textSecondary, fontSize: '0.7rem', whiteSpace: 'nowrap' }}>{formatAvailRanges(avail)}</td>
                          <td style={{ padding: '0.4rem', textAlign: 'center' }}>
                            {assignment ? (
                              <span style={{ padding: '0.15rem 0.4rem', borderRadius: '4px', fontSize: '0.7rem', backgroundColor: `${DAY_COLORS[activeDay]}20`, color: DAY_COLORS[activeDay], fontWeight: 600 }}>{assignment.slot_time}</span>
                            ) : (
                              <span style={{ color: colors.textMuted, fontSize: '0.65rem' }}>—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {daySubmissions.length === 0 && (
                      <tr><td colSpan={7} style={{ padding: '1rem', textAlign: 'center', color: colors.textMuted }}>{t('prepScheduler.noSubmissions', 'No submissions for')} {getDayLabel(activeDay, t)}.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Slot Assignment Grid */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <h3 style={{ color: DAY_COLORS[activeDay], fontSize: '0.85rem', fontWeight: 700, margin: 0 }}>🗓️ {t('prepScheduler.slots', 'Slots')}</h3>
              {dayAssignments.length > 0 && (
                <button onClick={() => clearDayAssignments(activeDay)} style={{ background: 'none', border: `1px solid ${colors.error}20`, borderRadius: '4px', color: colors.error, cursor: 'pointer', fontSize: '0.6rem', padding: '0.15rem 0.4rem', opacity: 0.7 }}>
                  {t('prepScheduler.clearDay', 'Clear Day')}
                </button>
              )}
            </div>
            {isMobile && !showAllSlots && (
              <p style={{ color: colors.textMuted, fontSize: '0.7rem', marginBottom: '0.4rem' }}>
                {t('prepScheduler.showingAssigned', 'Showing assigned slots only.')}
              </p>
            )}
            <div style={{ maxHeight: isMobile ? undefined : '500px', overflowY: isMobile ? undefined : 'auto' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '4px' : '2px' }}>
                {(isMobile && !showAllSlots
                  ? effectiveSlots.filter(slot => {
                      const hasAssignment = dayAssignments.some(a => a.slot_time === slot);
                      const isGap = availabilityGaps.some(g => g.slot === slot);
                      return hasAssignment || isGap;
                    })
                  : effectiveSlots
                ).map(slot => {
                  const assignment = dayAssignments.find(a => a.slot_time === slot);
                  const assignedSub = assignment ? submissions.find(s => s.id === assignment.submission_id) : null;
                  const isGap = availabilityGaps.some(g => g.slot === slot);
                  return (
                    <div key={slot} style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '0.5rem' : '0.35rem', padding: isMobile ? '0.5rem 0.6rem' : '0.25rem 0.4rem', borderRadius: isMobile ? '8px' : '4px',
                      backgroundColor: assignment ? `${DAY_COLORS[activeDay]}10` : isGap ? `${colors.error}05` : 'transparent',
                      border: `1px solid ${assignment ? `${DAY_COLORS[activeDay]}20` : isGap ? `${colors.error}15` : 'transparent'}`,
                      minHeight: isMobile ? '44px' : undefined }}>
                      <span style={{ color: isGap ? colors.error : colors.textMuted, fontSize: isMobile ? '0.8rem' : '0.65rem', fontFamily: 'monospace', width: isMobile ? '44px' : '36px', flexShrink: 0, fontWeight: assignment ? 600 : 400 }}>{slot}</span>
                      {assignment && assignedSub ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flex: 1, minWidth: 0 }}
                          title={assignment.assigned_by ? `${t('prepScheduler.assignedBy', 'Assigned by')} ${managers.find(m => m.user_id === assignment.assigned_by)?.username || submissions.find(s => s.user_id === assignment.assigned_by)?.username || t('prepScheduler.manager', 'Manager')}` : undefined}>
                          <span style={{ color: DAY_COLORS[activeDay], fontSize: isMobile ? '0.85rem' : '0.7rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{assignedSub.username}</span>
                          <button onClick={() => removeAssignment(assignment.id)} disabled={removingIds.has(assignment.id)} style={{ marginLeft: 'auto', background: 'none', border: isMobile ? `1px solid ${colors.error}30` : 'none', borderRadius: isMobile ? '6px' : 0, color: removingIds.has(assignment.id) ? colors.textMuted : colors.error, cursor: removingIds.has(assignment.id) ? 'not-allowed' : 'pointer', fontSize: isMobile ? '0.8rem' : '0.7rem', padding: isMobile ? '0.25rem 0.5rem' : '0 0.15rem', flexShrink: 0, minHeight: isMobile ? '32px' : undefined, opacity: removingIds.has(assignment.id) ? 0.4 : 1 }}>×</button>
                        </div>
                      ) : (
                        <select value="" onChange={(e) => { if (e.target.value) assignSlot(activeDay, slot, e.target.value); }}
                          style={{ flex: 1, padding: isMobile ? '0.4rem 0.3rem' : '0.1rem 0.2rem', backgroundColor: 'transparent', border: `1px solid ${colors.borderSubtle}`, borderRadius: '4px', color: colors.textMuted, fontSize: isMobile ? '0.85rem' : '0.65rem', minWidth: 0 }}>
                          <option value="">{isGap ? '⚠️ none' : '—'}</option>
                          {submissions
                            .filter(s => !isSkippedDay(s, activeDay))
                            .sort((a, b) => {
                              const aAssigned = dayAssignments.some(da => da.submission_id === a.id);
                              const bAssigned = dayAssignments.some(da => da.submission_id === b.id);
                              if (aAssigned !== bAssigned) return aAssigned ? 1 : -1;
                              return getEffectiveSpeedups(b, activeDay, schedule) - getEffectiveSpeedups(a, activeDay, schedule);
                            })
                            .map(s => {
                              const sAvailKey = `${activeDay}_availability` as keyof PrepSubmission;
                              const sAvail = (s[sAvailKey] as string[][] | undefined) || [];
                              const inAvail = isSlotInAvailability(slot, sAvail);
                              const existingSlot = dayAssignments.find(da => da.submission_id === s.id);
                              return (
                                <option key={s.id} value={s.id}>
                                  {!inAvail ? '⚠️ ' : ''}{existingSlot ? `↔ ` : ''}{s.username}{existingSlot ? ` (${existingSlot.slot_time})` : ''}
                                </option>
                              );
                            })
                          }
                        </select>
                      )}
                    </div>
                  );
                })}
                {isMobile && !showAllSlots && dayAssignments.length === 0 && availabilityGaps.length === 0 && (
                  <p style={{ padding: '0.75rem', textAlign: 'center', color: colors.textMuted, fontSize: '0.8rem' }}>{t('prepScheduler.noSlotsAssigned', 'No slots assigned yet. Use Auto-Assign or expand to assign manually.')}</p>
                )}
              </div>
            </div>
            {isMobile && (
              <button onClick={() => setShowAllSlots(prev => !prev)} style={{
                marginTop: '0.5rem', width: '100%', padding: '0.5rem', backgroundColor: 'transparent',
                border: `1px solid ${colors.border}`, borderRadius: '6px', color: colors.textMuted,
                fontSize: '0.75rem', cursor: 'pointer', textAlign: 'center', minHeight: '40px',
              }}>
                {showAllSlots
                  ? `▲ ${t('prepScheduler.showAssignedOnly', 'Show Assigned Only')}`
                  : `▼ ${t('prepScheduler.showAllSlots', 'Show All {{count}} Slots').replace('{{count}}', String(maxSlots))}`}
              </button>
            )}
          </div>
        </div>

        {/* All Submissions Panel — for editors/managers to view & edit any player's form */}
        {(isEditorOrCoEditor || isManager) && submissions.length > 0 && (
          <div style={{ ...cardStyle, marginTop: '1rem' }}>
            <h3 style={{ color: '#a855f7', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem' }}>📋 {t('prepScheduler.allSubmissions', 'All Submissions')} ({submissions.length})</h3>
            <p style={{ color: colors.textMuted, fontSize: '0.7rem', marginBottom: '0.75rem' }}>{t('prepScheduler.allSubmissionsDesc', 'Click a player to view details. Editors can edit speedups and opt-outs.')}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              {submissions.map(sub => {
                const isExpanded = expandedSubmissionId === sub.id;
                const isEditing = editingSubId === sub.id;
                const totalSpeedups = sub.general_speedups + sub.training_speedups + sub.construction_speedups + sub.research_speedups;
                return (
                  <div key={sub.id} style={{ borderRadius: '8px', border: `1px solid ${isExpanded ? '#a855f730' : colors.borderSubtle}`, backgroundColor: isExpanded ? '#a855f708' : 'transparent', overflow: 'hidden' }}>
                    {/* Summary row */}
                    <div
                      onClick={() => { setExpandedSubmissionId(isExpanded ? null : sub.id); setEditingSubId(null); }}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.6rem', cursor: 'pointer' }}
                    >
                      <span style={{ color: isExpanded ? '#a855f7' : colors.text, fontWeight: 600, fontSize: '0.8rem', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub.username}</span>
                      {sub.alliance_tag && <span style={{ color: colors.textMuted, fontSize: '0.7rem' }}>[{sub.alliance_tag}]</span>}
                      <span style={{ color: colors.textMuted, fontSize: '0.7rem', fontFamily: 'monospace' }}>{formatMinutes(totalSpeedups)}</span>
                      {sub.screenshot_url && <a href={sub.screenshot_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ color: '#22c55e', fontSize: '0.7rem' }}>📷</a>}
                      <span style={{ color: colors.textMuted, fontSize: '0.7rem' }}>{isExpanded ? '▲' : '▼'}</span>
                    </div>
                    {/* Expanded details */}
                    {isExpanded && (
                      <div style={{ padding: '0 0.6rem 0.6rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {/* Speedups */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.3rem', fontSize: '0.7rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.2rem 0.4rem', backgroundColor: '#a855f708', borderRadius: '4px' }}><span style={{ color: '#a855f7' }}>🔧 {t('prepScheduler.general', 'General')}</span><span style={{ color: colors.text, fontWeight: 600 }}>{isEditing ? '' : formatMinutes(sub.general_speedups)}</span></div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.2rem 0.4rem', backgroundColor: '#ef444408', borderRadius: '4px' }}><span style={{ color: '#ef4444' }}>⚔️ {t('prepScheduler.training', 'Training')}</span><span style={{ color: colors.text, fontWeight: 600 }}>{isEditing ? '' : formatMinutes(sub.training_speedups)}</span></div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.2rem 0.4rem', backgroundColor: '#f59e0b08', borderRadius: '4px' }}><span style={{ color: '#f59e0b' }}>🏗️ {t('prepScheduler.construction', 'Construction')}</span><span style={{ color: colors.text, fontWeight: 600 }}>{isEditing ? '' : formatMinutes(sub.construction_speedups)}</span></div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.2rem 0.4rem', backgroundColor: '#3b82f608', borderRadius: '4px' }}><span style={{ color: '#3b82f6' }}>🔬 {t('prepScheduler.research', 'Research')}</span><span style={{ color: colors.text, fontWeight: 600 }}>{isEditing ? '' : formatMinutes(sub.research_speedups)}</span></div>
                        </div>
                        {/* Availability per day */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                          {DAYS.map(day => {
                            const skipKey = `skip_${day}` as 'skip_monday' | 'skip_tuesday' | 'skip_thursday';
                            const isSkipped = sub[skipKey];
                            const availKey = `${day}_availability` as keyof PrepSubmission;
                            const avail = (sub[availKey] as string[][] | undefined) || [];
                            return (
                              <div key={day} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.2rem 0.4rem', borderRadius: '4px', backgroundColor: isSkipped ? `${colors.textMuted}05` : `${DAY_COLORS[day]}08`, fontSize: '0.7rem' }}>
                                <span style={{ color: isSkipped ? colors.textMuted : DAY_COLORS[day], fontWeight: 600, minWidth: '50px' }}>{getDayLabelShort(day, t)}</span>
                                {isSkipped ? (
                                  <span style={{ color: '#f59e0b', fontSize: '0.65rem' }}>⏭ {t('prepScheduler.optedOut', 'Opted Out')}</span>
                                ) : (
                                  <span style={{ color: colors.textMuted }}>{formatAvailRanges(avail)}</span>
                                )}
                                {/* Inline opt-out toggle for managers */}
                                {updateSubmissionOptOuts && (
                                  <label style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.2rem', cursor: 'pointer' }} onClick={e => e.stopPropagation()}>
                                    <input type="checkbox" checked={isSkipped} onChange={() => {
                                      updateSubmissionOptOuts(sub.id, {
                                        skip_monday: day === 'monday' ? !isSkipped : sub.skip_monday,
                                        skip_tuesday: day === 'tuesday' ? !isSkipped : sub.skip_tuesday,
                                        skip_thursday: day === 'thursday' ? !isSkipped : sub.skip_thursday,
                                      });
                                    }} style={{ width: '14px', height: '14px', accentColor: DAY_COLORS[day], cursor: 'pointer' }} />
                                    <span style={{ color: colors.textMuted, fontSize: '0.6rem' }}>{t('prepScheduler.skipDay', 'Skip this day')}</span>
                                  </label>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        {/* Edit speedups inline */}
                        {updateAnySubmission && !isEditing && (
                          <button onClick={(e) => { e.stopPropagation(); setEditingSubId(sub.id); setEditSpeedups({ general: sub.general_speedups, training: sub.training_speedups, construction: sub.construction_speedups, research: sub.research_speedups }); }}
                            style={{ padding: '0.35rem 0.75rem', backgroundColor: '#a855f710', border: '1px solid #a855f730', borderRadius: '6px', color: '#a855f7', fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer', alignSelf: 'flex-start' }}>
                            ✏️ {t('prepScheduler.editSpeedups', 'Edit Speedups')}
                          </button>
                        )}
                        {isEditing && updateAnySubmission && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.3rem' }}>
                              {[{ key: 'general' as const, icon: '🔧', color: '#a855f7', label: t('prepScheduler.general', 'General') },
                                { key: 'training' as const, icon: '⚔️', color: '#ef4444', label: t('prepScheduler.training', 'Training') },
                                { key: 'construction' as const, icon: '🏗️', color: '#f59e0b', label: t('prepScheduler.construction', 'Construction') },
                                { key: 'research' as const, icon: '🔬', color: '#3b82f6', label: t('prepScheduler.research', 'Research') },
                              ].map(st => (
                                <div key={st.key}>
                                  <label style={{ color: colors.textMuted, fontSize: '0.65rem', fontWeight: 600, display: 'block', marginBottom: '0.15rem' }}>{st.icon} {st.label}</label>
                                  <input type="number" value={editSpeedups[st.key] || ''} onChange={e => setEditSpeedups(prev => ({ ...prev, [st.key]: parseInt(e.target.value) || 0 }))} min={0}
                                    style={{ ...inputStyle, padding: '0.35rem 0.5rem', fontSize: '0.8rem' }} />
                                </div>
                              ))}
                            </div>
                            <div style={{ display: 'flex', gap: '0.4rem' }}>
                              <button onClick={async () => { await updateAnySubmission(sub.id, { general_speedups: editSpeedups.general, training_speedups: editSpeedups.training, construction_speedups: editSpeedups.construction, research_speedups: editSpeedups.research }); setEditingSubId(null); }} disabled={saving}
                                style={{ padding: '0.35rem 0.75rem', backgroundColor: '#22c55e15', border: '1px solid #22c55e30', borderRadius: '6px', color: '#22c55e', fontSize: '0.7rem', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>
                                {saving ? '...' : `✓ ${t('prepScheduler.save', 'Save')}`}
                              </button>
                              <button onClick={() => setEditingSubId(null)}
                                style={{ padding: '0.35rem 0.75rem', backgroundColor: 'transparent', border: `1px solid ${colors.border}`, borderRadius: '6px', color: colors.textMuted, fontSize: '0.7rem', cursor: 'pointer' }}>
                                {t('prepScheduler.cancel', 'Cancel')}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: '1.5rem', paddingBottom: '1rem' }}>
          <Link to="/tools/prep-scheduler" style={{ color: '#22d3ee', textDecoration: 'none', fontSize: '0.8rem' }}>← {t('prepScheduler.backToSchedules', 'Back to Schedules')}</Link>
        </div>
      </div>
    </div>
  );
};

export default PrepSchedulerManager;
