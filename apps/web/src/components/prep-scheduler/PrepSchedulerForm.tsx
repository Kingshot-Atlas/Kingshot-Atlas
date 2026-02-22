import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { colors, neonGlow, FONT_DISPLAY } from '../../utils/styles';
import {
  PrepSchedule, PrepSubmission, SlotAssignment,
  Day, DAYS, DAY_COLORS, TZ_ABBR, UTC_OFFSET_HOURS,
  getDayLabel, getBuffLabel,
} from './types';
import { getDeadlineCountdown, formatDeadlineUTC, getEffectiveSpeedups, formatMinutes, formatAvailRanges, isSkippedDay } from './utils';
import TimeRangePicker from './TimeRangePicker';

interface PrepSchedulerFormProps {
  isMobile: boolean;
  schedule: PrepSchedule;
  existingSubmission: PrepSubmission | null;
  mySubmissions: PrepSubmission[];
  assignments: SlotAssignment[];
  // Form state
  formUsername: string; setFormUsername: (v: string) => void;
  formAlliance: string; setFormAlliance: (v: string) => void;
  mondayAvail: string[][]; setMondayAvail: (v: string[][]) => void;
  tuesdayAvail: string[][]; setTuesdayAvail: (v: string[][]) => void;
  thursdayAvail: string[][]; setThursdayAvail: (v: string[][]) => void;
  generalSpeedups: number; setGeneralSpeedups: (v: number) => void;
  trainingSpeedups: number; setTrainingSpeedups: (v: number) => void;
  constructionSpeedups: number; setConstructionSpeedups: (v: number) => void;
  researchSpeedups: number; setResearchSpeedups: (v: number) => void;
  generalTarget: string; setGeneralTarget: (v: string) => void;
  generalAllocation: { construction: number; training: number; research: number } | null;
  setGeneralAllocation: (v: { construction: number; training: number; research: number } | null) => void;
  skipMonday: boolean; setSkipMonday: (v: boolean) => void;
  skipTuesday: boolean; setSkipTuesday: (v: boolean) => void;
  skipThursday: boolean; setSkipThursday: (v: boolean) => void;
  screenshotPreview: string;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleScreenshotChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  saving: boolean;
  submitForm: () => Promise<void>;
  // Change request
  showChangeRequestForm: boolean; setShowChangeRequestForm: (v: boolean) => void;
  changeRequestDay: Day; setChangeRequestDay: (v: Day) => void;
  changeRequestType: 'cant_attend' | 'change_slot' | 'other'; setChangeRequestType: (v: 'cant_attend' | 'change_slot' | 'other') => void;
  changeRequestMessage: string; setChangeRequestMessage: (v: string) => void;
  submitChangeRequest: () => Promise<void>;
  // Non-qualifying popup
  showNonQualifyingPopup: boolean; setShowNonQualifyingPopup: (v: boolean) => void;
  // Multi-account
  startAltSubmission: () => void;
  editSubmission: (sub: PrepSubmission) => void;
  // Refill mode
  isRefilling?: boolean;
  setIsRefilling?: (v: boolean) => void;
  // Opt-out editing
  updateSubmissionOptOuts?: (submissionId: string, optOuts: { skip_monday: boolean; skip_tuesday: boolean; skip_thursday: boolean }) => Promise<void>;
}

// ─── Speedup Section — Simple number inputs only ──────────────────────────────

const SPEEDUP_TYPES = [
  { key: 'general' as const, icon: '🔧', color: '#a855f7', i18nKey: 'prepScheduler.general', fallback: 'General' },
  { key: 'training' as const, icon: '⚔️', color: '#ef4444', i18nKey: 'prepScheduler.training', fallback: 'Training' },
  { key: 'construction' as const, icon: '🏗️', color: '#f59e0b', i18nKey: 'prepScheduler.construction', fallback: 'Construction' },
  { key: 'research' as const, icon: '🔬', color: '#3b82f6', i18nKey: 'prepScheduler.research', fallback: 'Research' },
] as const;

const SpeedupSection: React.FC<{
  isMobile: boolean;
  generalSpeedups: number; setGeneralSpeedups: (v: number) => void;
  trainingSpeedups: number; setTrainingSpeedups: (v: number) => void;
  constructionSpeedups: number; setConstructionSpeedups: (v: number) => void;
  researchSpeedups: number; setResearchSpeedups: (v: number) => void;
  inputStyle: React.CSSProperties; labelStyle: React.CSSProperties; cardStyle: React.CSSProperties;
  t: (key: string, fallback: string) => string;
}> = ({ isMobile, generalSpeedups, setGeneralSpeedups, trainingSpeedups, setTrainingSpeedups, constructionSpeedups, setConstructionSpeedups, researchSpeedups, setResearchSpeedups, inputStyle, labelStyle, cardStyle, t }) => {
  type SpeedupKey = 'general' | 'training' | 'construction' | 'research';
  const values: Record<SpeedupKey, number> = { general: generalSpeedups, training: trainingSpeedups, construction: constructionSpeedups, research: researchSpeedups };
  const setters: Record<SpeedupKey, (v: number) => void> = { general: setGeneralSpeedups, training: setTrainingSpeedups, construction: setConstructionSpeedups, research: setResearchSpeedups };

  return (
    <div style={cardStyle}>
      <label style={{ ...labelStyle, marginBottom: '0.25rem', fontSize: '0.85rem' }}>⏱️ {t('prepScheduler.speedups', 'Speedups (in minutes)')}</label>
      <p style={{ color: colors.textMuted, fontSize: '0.7rem', marginBottom: '0.75rem' }}>{t('prepScheduler.speedupsDesc', 'Total minutes of each speedup type you plan to use this KvK Prep Phase.')}</p>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '0.75rem' }}>
        {SPEEDUP_TYPES.map(st => (
          <div key={st.key}>
            <label style={labelStyle}>{st.icon} {t(st.i18nKey, st.fallback)}</label>
            <input type="number" value={values[st.key] || ''} onChange={(e) => setters[st.key](parseInt(e.target.value) || 0)} placeholder="0" style={inputStyle} min={0} />
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── General Speedup Allocation Section ──────────────────────────────────────

const ALLOC_TYPES = [
  { key: 'construction' as const, icon: '🏗️', color: '#f59e0b', i18nKey: 'prepScheduler.construction', fallback: 'Construction' },
  { key: 'research' as const, icon: '🔬', color: '#3b82f6', i18nKey: 'prepScheduler.research', fallback: 'Research' },
  { key: 'training' as const, icon: '⚔️', color: '#ef4444', i18nKey: 'prepScheduler.training', fallback: 'Training' },
] as const;

const GeneralTargetSection: React.FC<{
  generalSpeedups: number;
  generalTarget: string; setGeneralTarget: (v: string) => void;
  generalAllocation: { construction: number; training: number; research: number } | null;
  setGeneralAllocation: (v: { construction: number; training: number; research: number } | null) => void;
  labelStyle: React.CSSProperties; cardStyle: React.CSSProperties;
  t: (key: string, fallback: string) => string;
}> = ({ generalSpeedups, generalTarget, setGeneralTarget, generalAllocation, setGeneralAllocation, labelStyle, cardStyle, t }) => {
  const [advancedMode, setAdvancedMode] = useState(!!generalAllocation);

  const formatTime = (mins: number) => {
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  const handleToggleAdvanced = () => {
    if (advancedMode) {
      setAdvancedMode(false);
      setGeneralAllocation(null);
    } else {
      setAdvancedMode(true);
      setGeneralTarget('');
      setGeneralAllocation({ construction: 34, training: 33, research: 33 });
    }
  };

  const handleAllocChange = (key: 'construction' | 'training' | 'research', newVal: number) => {
    if (!generalAllocation) return;
    const other1Key = key === 'construction' ? 'training' : 'construction';
    const other2Key = key === 'construction' ? 'research' : key === 'training' ? 'research' : 'training';
    const remaining = 100 - newVal;
    const otherTotal = generalAllocation[other1Key] + generalAllocation[other2Key];
    let v1: number, v2: number;
    if (otherTotal === 0) {
      v1 = Math.round(remaining / 2);
      v2 = remaining - v1;
    } else {
      v1 = Math.round((generalAllocation[other1Key] / otherTotal) * remaining);
      v2 = remaining - v1;
    }
    setGeneralAllocation({ ...generalAllocation, [key]: newVal, [other1Key]: v1, [other2Key]: v2 });
  };

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
        <label style={{ ...labelStyle, marginBottom: 0 }}>{t('prepScheduler.generalTarget', 'Where will you spend most of your General Speedups?')}</label>
        {generalSpeedups > 0 && (
          <button
            onClick={handleToggleAdvanced}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.3rem',
              background: advancedMode ? '#a855f710' : 'none',
              border: `1px solid ${advancedMode ? '#a855f740' : colors.border}`,
              borderRadius: '5px', padding: '0.2rem 0.5rem',
              color: advancedMode ? '#a855f7' : colors.textMuted,
              fontSize: '0.65rem', fontWeight: 600, cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            📊 {advancedMode ? t('prepScheduler.simpleMode', 'Simple') : t('prepScheduler.advancedSplit', 'Split %')}
          </button>
        )}
      </div>

      {!advancedMode ? (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
          {ALLOC_TYPES.map(tt => (
            <button key={tt.key} onClick={() => setGeneralTarget(tt.key)}
              style={{ padding: '0.4rem 0.75rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem',
                backgroundColor: generalTarget === tt.key ? `${tt.color}20` : 'transparent',
                border: `1px solid ${generalTarget === tt.key ? `${tt.color}50` : colors.border}`,
                color: generalTarget === tt.key ? tt.color : colors.textMuted,
                fontWeight: generalTarget === tt.key ? 600 : 400 }}>
              {tt.icon} {t(tt.i18nKey, tt.fallback)}
            </button>
          ))}
        </div>
      ) : (
        <div style={{ marginTop: '0.5rem' }}>
          {generalSpeedups > 0 && (
            <p style={{ color: colors.textMuted, fontSize: '0.7rem', marginBottom: '0.5rem' }}>
              {t('prepScheduler.allocDesc', 'Split your {{total}} General Speedups across types.').replace('{{total}}', formatTime(generalSpeedups))}
            </p>
          )}
          {/* Visual distribution bar */}
          {generalAllocation && generalSpeedups > 0 && (
            <div style={{ display: 'flex', height: '8px', borderRadius: '4px', overflow: 'hidden', marginBottom: '0.75rem', backgroundColor: colors.border }}>
              {ALLOC_TYPES.map(at => {
                const p = generalAllocation[at.key];
                return p > 0 ? (
                  <div key={at.key} style={{ width: `${p}%`, backgroundColor: at.color, transition: 'width 0.3s ease' }} />
                ) : null;
              })}
            </div>
          )}
          {/* Per-type sliders */}
          {generalAllocation && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {ALLOC_TYPES.map(at => {
                const pct = generalAllocation[at.key];
                const mins = Math.round(generalSpeedups * pct / 100);
                return (
                  <div key={at.key}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                      <span style={{ color: at.color, fontSize: '0.7rem', fontWeight: 600 }}>{at.icon} {t(at.i18nKey, at.fallback)}</span>
                      <span style={{ color: colors.textMuted, fontSize: '0.65rem', fontFamily: "'JetBrains Mono', monospace" }}>
                        {formatTime(mins)} <span style={{ color: at.color }}>({pct}%)</span>
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={pct}
                      onChange={(e) => handleAllocChange(at.key, parseInt(e.target.value) || 0)}
                      style={{
                        width: '100%', height: '6px', appearance: 'none', WebkitAppearance: 'none',
                        background: `linear-gradient(to right, ${at.color} 0%, ${at.color} ${pct}%, ${colors.border} ${pct}%, ${colors.border} 100%)`,
                        borderRadius: '3px', outline: 'none', cursor: 'pointer',
                      }}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const PrepSchedulerForm: React.FC<PrepSchedulerFormProps> = (props) => {
  const { t } = useTranslation();
  const {
    isMobile, schedule, existingSubmission, mySubmissions, assignments,
    formUsername, setFormUsername, formAlliance, setFormAlliance,
    mondayAvail, setMondayAvail, tuesdayAvail, setTuesdayAvail,
    thursdayAvail, setThursdayAvail,
    generalSpeedups, setGeneralSpeedups, trainingSpeedups, setTrainingSpeedups,
    constructionSpeedups, setConstructionSpeedups, researchSpeedups, setResearchSpeedups,
    generalTarget, setGeneralTarget,
    generalAllocation, setGeneralAllocation,
    skipMonday, setSkipMonday, skipTuesday, setSkipTuesday, skipThursday, setSkipThursday,
    screenshotPreview, fileInputRef, handleScreenshotChange,
    saving, submitForm,
    showChangeRequestForm, setShowChangeRequestForm,
    changeRequestDay, setChangeRequestDay, changeRequestType, setChangeRequestType,
    changeRequestMessage, setChangeRequestMessage, submitChangeRequest,
    showNonQualifyingPopup, setShowNonQualifyingPopup,
    startAltSubmission, editSubmission,
    isRefilling, setIsRefilling, updateSubmissionOptOuts,
  } = props;

  // Filter out disabled days from the schedule
  const enabledDays = useMemo(() => DAYS.filter(d => !(schedule.disabled_days || []).includes(d)), [schedule.disabled_days]);

  // Is this an alt-account submission (no existing submission loaded = new alt form)?
  const isAltMode = !existingSubmission && mySubmissions.length > 0;

  // Whether the form is in read-only mode (submitted and not an alt form in progress, and not refilling)
  const isReadOnly = !!existingSubmission && !isAltMode && !isRefilling;

  // Progress tracking for mobile
  const formProgress = useMemo(() => {
    const steps = [
      { done: !!formUsername.trim() && !!formAlliance.trim() },
      { done: skipMonday || mondayAvail.some(r => r[0] && r[1]) },
      { done: skipTuesday || tuesdayAvail.some(r => r[0] && r[1]) },
      { done: skipThursday || thursdayAvail.some(r => r[0] && r[1]) },
      { done: generalSpeedups > 0 || trainingSpeedups > 0 || constructionSpeedups > 0 || researchSpeedups > 0 },
      { done: !!generalTarget || !!generalAllocation },
      { done: !!screenshotPreview },
    ];
    return { completed: steps.filter(s => s.done).length, total: steps.length };
  }, [formUsername, formAlliance, skipMonday, skipTuesday, skipThursday, mondayAvail, tuesdayAvail, thursdayAvail, generalSpeedups, trainingSpeedups, constructionSpeedups, researchSpeedups, generalTarget, generalAllocation, screenshotPreview]);

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '0.5rem 0.75rem', backgroundColor: colors.bg,
    border: `1px solid ${colors.border}`, borderRadius: '6px', color: colors.text,
    fontSize: isMobile ? '1rem' : '0.85rem', outline: 'none', boxSizing: 'border-box',
  };
  const labelStyle: React.CSSProperties = {
    color: colors.textSecondary, fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.3rem',
  };
  const cardStyle: React.CSSProperties = {
    backgroundColor: colors.cardAlt, borderRadius: '12px', padding: isMobile ? '1rem' : '1.25rem',
    border: `1px solid ${colors.border}`,
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a' }}>
      {/* Header */}
      <div style={{ padding: isMobile ? '1.5rem 1rem' : '2rem', textAlign: 'center', background: 'linear-gradient(180deg, #111111 0%, #0a0a0a 100%)' }}>
        <h1 style={{ fontSize: isMobile ? '1.25rem' : '1.75rem', fontFamily: FONT_DISPLAY, marginBottom: '0.25rem' }}>
          <span style={{ color: '#fff' }}>{t('prepScheduler.kingdom', 'Kingdom')} {schedule.kingdom_number}</span>
          <span style={{ ...neonGlow('#a855f7'), marginLeft: '0.5rem' }}>{t('prepScheduler.prepForm', 'PREP FORM')}</span>
        </h1>
        {schedule.kvk_number && <p style={{ color: '#9ca3af', fontSize: '0.85rem' }}>KvK #{schedule.kvk_number}</p>}
        {schedule.notes && <p style={{ color: '#a855f7', fontSize: '0.8rem', fontStyle: 'italic', marginTop: '0.5rem', maxWidth: '500px', margin: '0.5rem auto 0' }}>{schedule.notes}</p>}
        {(() => { const dl = getDeadlineCountdown(schedule.deadline, t); const utcLabel = formatDeadlineUTC(schedule.deadline); return dl && !dl.expired ? (
          <div style={{ marginTop: '0.5rem', display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '0.15rem' }}>
            <div style={{ padding: '0.3rem 0.8rem', backgroundColor: dl.urgent ? '#ef444415' : '#f59e0b15', border: `1px solid ${dl.urgent ? '#ef444430' : '#f59e0b30'}`, borderRadius: '20px' }}>
              <span style={{ color: dl.urgent ? '#ef4444' : '#f59e0b', fontSize: '0.75rem', fontWeight: 600 }}>⏰ {dl.text}</span>
            </div>
            {utcLabel && <span style={{ color: '#6b7280', fontSize: '0.65rem' }}>{utcLabel}</span>}
          </div>
        ) : null; })()}
        {schedule.status === 'closed' && (
          <div style={{ marginTop: '0.5rem', padding: '0.3rem 0.8rem', backgroundColor: '#ef444415', border: '1px solid #ef444430', borderRadius: '20px', display: 'inline-block' }}>
            <span style={{ color: '#ef4444', fontSize: '0.75rem', fontWeight: 600 }}>🔒 {t('prepScheduler.formClosed', 'Form is closed — no new submissions or changes allowed')}</span>
          </div>
        )}
        {existingSubmission && schedule.status !== 'closed' && (
          <div style={{ marginTop: '0.5rem', padding: '0.3rem 0.8rem', backgroundColor: '#22c55e15', border: '1px solid #22c55e30', borderRadius: '20px', display: 'inline-block' }}>
            <span style={{ color: '#22c55e', fontSize: '0.75rem', fontWeight: 600 }}>✅ {t('prepScheduler.submittedResponse', 'Your response has been submitted')}</span>
          </div>
        )}
        {isAltMode && (
          <div style={{ marginTop: '0.5rem', padding: '0.3rem 0.8rem', backgroundColor: '#a855f715', border: '1px solid #a855f730', borderRadius: '20px', display: 'inline-block' }}>
            <span style={{ color: '#a855f7', fontSize: '0.75rem', fontWeight: 600 }}>👤 {t('prepScheduler.altAccountSubmission', 'Submitting for an alt account')}</span>
          </div>
        )}
      </div>

      {/* Mobile Progress Indicator */}
      {isMobile && !isReadOnly && (
        <div style={{ maxWidth: '600px', margin: '0 auto', padding: '0 1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <div style={{ flex: 1, height: '4px', borderRadius: '2px', backgroundColor: colors.border, overflow: 'hidden' }}>
              <div style={{
                width: `${(formProgress.completed / formProgress.total) * 100}%`,
                height: '100%', borderRadius: '2px',
                backgroundColor: formProgress.completed === formProgress.total ? '#22c55e' : '#a855f7',
                transition: 'width 0.3s ease',
              }} />
            </div>
            <span style={{ color: formProgress.completed === formProgress.total ? '#22c55e' : colors.textMuted, fontSize: '0.65rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
              {formProgress.completed}/{formProgress.total}
            </span>
          </div>
        </div>
      )}

      <div style={{ maxWidth: '600px', margin: '0 auto', padding: isMobile ? '1rem' : '1.5rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* View My Slot */}
          {existingSubmission && assignments.filter(a => a.submission_id === existingSubmission.id).length > 0 && (
            <div style={{ ...cardStyle, borderColor: '#22c55e30', backgroundColor: '#22c55e08' }}>
              <h4 style={{ color: '#22c55e', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem' }}>🗓️ {t('prepScheduler.yourSlots', 'Your Assigned Slots')}</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                {enabledDays.map(day => {
                  const mySlots = assignments.filter(a => a.submission_id === existingSubmission.id && a.day === day);
                  if (mySlots.length === 0) return null;
                  const buffType = day === 'monday' ? schedule.monday_buff : day === 'tuesday' ? schedule.tuesday_buff : schedule.thursday_buff;
                  return (
                    <div key={day} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.35rem 0.5rem', backgroundColor: `${DAY_COLORS[day]}10`, borderRadius: '6px', border: `1px solid ${DAY_COLORS[day]}20` }}>
                      <span style={{ color: DAY_COLORS[day], fontSize: '0.8rem', fontWeight: 600, minWidth: '70px' }}>{getDayLabel(day, t)}</span>
                      <span style={{ color: colors.textMuted, fontSize: '0.7rem' }}>{getBuffLabel(buffType, t)}</span>
                      <span style={{ marginLeft: 'auto', color: DAY_COLORS[day], fontSize: '0.8rem', fontWeight: 700, fontFamily: 'monospace' }}>
                        {mySlots.map(s => s.slot_time).join(', ')} UTC
                      </span>
                    </div>
                  );
                })}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <p style={{ color: colors.textMuted, fontSize: '0.7rem', margin: 0 }}>{t('prepScheduler.beOnline', 'Be online at these times to receive the buff.')}</p>
                <button onClick={() => setShowChangeRequestForm(true)} style={{ padding: '0.25rem 0.6rem', backgroundColor: '#f59e0b15', border: '1px solid #f59e0b30', borderRadius: '4px', color: '#f59e0b', fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer' }}>🔄 {t('prepScheduler.requestChange', 'Request Change')}</button>
              </div>
            </div>
          )}

          {/* Non-qualifying notice — show whenever assigned slots = 0 for any submitted account */}
          {existingSubmission && assignments.filter(a => mySubmissions.some(ms => ms.id === a.submission_id)).length === 0 && !showNonQualifyingPopup && (
            <div style={{ ...cardStyle, borderColor: schedule.is_locked ? '#ef444430' : '#f59e0b30', backgroundColor: schedule.is_locked ? '#ef444408' : '#f59e0b08' }}>
              <h4 style={{ color: schedule.is_locked ? '#ef4444' : '#f59e0b', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                {schedule.is_locked ? `❌ ${t('prepScheduler.notAssigned', 'You were not assigned a slot')}` : `⏳ ${t('prepScheduler.pendingAssignment', 'Awaiting slot assignment')}`}
              </h4>
              <p style={{ color: colors.textMuted, fontSize: '0.75rem', marginBottom: '0.5rem', lineHeight: 1.5 }}>
                {schedule.is_locked
                  ? t('prepScheduler.notAssignedDesc', 'The schedule has been locked and you did not receive an appointment slot. This may be due to the 48-user limit per day or scheduling conflicts.')
                  : t('prepScheduler.pendingAssignmentDesc', 'Your Prep Manager has not assigned you a slot yet. Check back later or contact your Prep Manager.')}
              </p>
              {schedule.is_locked && (
                <button onClick={() => setShowNonQualifyingPopup(true)} style={{ padding: '0.4rem 0.8rem', backgroundColor: '#a855f715', border: '1px solid #a855f730', borderRadius: '6px', color: '#a855f7', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>📊 {t('prepScheduler.viewReport', 'View Report')}</button>
              )}
            </div>
          )}

          {/* Multi-account submission switcher */}
          {mySubmissions.length > 0 && !isAltMode && (
            <div style={{ ...cardStyle, borderColor: '#a855f730', backgroundColor: '#a855f708' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: mySubmissions.length > 1 ? '0.5rem' : 0 }}>
                <span style={{ color: colors.textSecondary, fontSize: '0.75rem', fontWeight: 600 }}>
                  👤 {t('prepScheduler.yourSubmissions', 'Your Submissions')} ({mySubmissions.length})
                </span>
                {schedule.status !== 'closed' && (
                  <button onClick={startAltSubmission} style={{ padding: '0.25rem 0.6rem', backgroundColor: '#a855f715', border: '1px solid #a855f730', borderRadius: '4px', color: '#a855f7', fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer' }}>
                    + {t('prepScheduler.addAltAccount', 'Alt Account')}
                  </button>
                )}
              </div>
              {mySubmissions.length > 1 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  {mySubmissions.map(sub => (
                    <div key={sub.id} onClick={() => editSubmission(sub)}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.35rem 0.5rem', borderRadius: '6px', cursor: 'pointer',
                        backgroundColor: existingSubmission?.id === sub.id ? '#a855f715' : 'transparent',
                        border: `1px solid ${existingSubmission?.id === sub.id ? '#a855f730' : 'transparent'}` }}>
                      <span style={{ color: existingSubmission?.id === sub.id ? '#a855f7' : colors.textMuted, fontSize: '0.8rem', fontWeight: existingSubmission?.id === sub.id ? 600 : 400 }}>{sub.username}</span>
                      <span style={{ color: colors.textMuted, fontSize: '0.65rem' }}>{sub.alliance_tag || ''}</span>
                      {assignments.some(a => a.submission_id === sub.id) && (
                        <span style={{ marginLeft: 'auto', color: '#22c55e', fontSize: '0.65rem' }}>✅</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Username & Alliance */}
          {isReadOnly ? (
            <div style={cardStyle}>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={labelStyle}>{t('prepScheduler.username', 'Username')}</label>
                  <div style={{ ...inputStyle, backgroundColor: `${colors.bg}80`, opacity: 0.8 }}>{formUsername}</div>
                </div>
                <div>
                  <label style={labelStyle}>{t('prepScheduler.alliance', 'Alliance')}</label>
                  <div style={{ ...inputStyle, backgroundColor: `${colors.bg}80`, opacity: 0.8 }}>{formAlliance || '—'}</div>
                </div>
              </div>
            </div>
          ) : (
            <div style={cardStyle}>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={labelStyle}>{t('prepScheduler.username', 'Username')} *</label>
                  {isAltMode ? (
                    <input type="text" value={formUsername} onChange={(e) => setFormUsername(e.target.value)} placeholder={t('prepScheduler.altUsernamePlaceholder', 'Alt account username')} style={inputStyle} />
                  ) : (
                    <div style={{ ...inputStyle, backgroundColor: `${colors.bg}80`, opacity: 0.8, cursor: 'not-allowed' }} title={t('prepScheduler.usernameAutoAssigned', 'Auto-assigned from your linked account')}>{formUsername || '—'}</div>
                  )}
                </div>
                <div>
                  <label style={labelStyle}>{t('prepScheduler.alliance', 'Alliance')} <span style={{ color: '#ef4444' }}>*</span></label>
                  <input type="text" value={formAlliance} onChange={(e) => setFormAlliance(e.target.value.toUpperCase().slice(0, 3))} maxLength={3} placeholder="e.g. ABC" style={{ ...inputStyle, borderColor: formAlliance.trim().length !== 3 ? '#ef444450' : colors.border }} />
                  {formAlliance.trim().length > 0 && formAlliance.trim().length !== 3 && (
                    <span style={{ color: '#ef4444', fontSize: '0.65rem', marginTop: '0.2rem', display: 'block' }}>{t('prepScheduler.allianceExact3', 'Alliance tag must be exactly 3 characters.')}</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Availability, Speedups, Target, Screenshot — hidden when read-only */}
          {isReadOnly ? (
            <>
              {/* Read-only summary of submission */}
              <div style={cardStyle}>
                <label style={{ ...labelStyle, fontSize: '0.85rem', marginBottom: '0.5rem' }}>📋 {t('prepScheduler.submissionSummary', 'Submission Summary')}</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {enabledDays.map(day => {
                    const isSkipped = isSkippedDay(existingSubmission!, day);
                    const buffType = day === 'monday' ? schedule.monday_buff : day === 'tuesday' ? schedule.tuesday_buff : schedule.thursday_buff;
                    const availKey = `${day}_availability` as keyof PrepSubmission;
                    const avail = (existingSubmission![availKey] as string[][] | undefined) || [];
                    const effective = getEffectiveSpeedups(existingSubmission!, day, schedule);
                    return (
                      <div key={day} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.35rem 0.5rem', borderRadius: '6px', backgroundColor: isSkipped ? `${colors.textMuted}05` : `${DAY_COLORS[day]}08`, border: `1px solid ${isSkipped ? colors.border : `${DAY_COLORS[day]}20`}` }}>
                        <span style={{ color: isSkipped ? colors.textMuted : DAY_COLORS[day], fontSize: '0.8rem', fontWeight: 600, minWidth: '70px' }}>{getDayLabel(day, t)}</span>
                        <span style={{ color: colors.textMuted, fontSize: '0.65rem' }}>{getBuffLabel(buffType, t)}</span>
                        {isSkipped ? (
                          <span style={{ marginLeft: 'auto', color: '#f59e0b', fontSize: '0.7rem' }}>⏭ {t('prepScheduler.optedOut', 'Opted Out')}</span>
                        ) : (
                          <>
                            <span style={{ color: colors.textMuted, fontSize: '0.65rem' }}>{formatAvailRanges(avail)}</span>
                            <span style={{ marginLeft: 'auto', color: DAY_COLORS[day], fontSize: '0.75rem', fontWeight: 600, fontFamily: 'monospace' }}>{formatMinutes(effective)}</span>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
                {existingSubmission!.screenshot_url && (
                  <div style={{ marginTop: '0.5rem' }}>
                    <a href={existingSubmission!.screenshot_url} target="_blank" rel="noopener noreferrer" style={{ color: '#22c55e', fontSize: '0.75rem' }}>📷 {t('prepScheduler.viewScreenshot', 'View Screenshot')}</a>
                  </div>
                )}
              </div>

              {/* Opt-out editing — form fillers can toggle their day opt-outs */}
              {updateSubmissionOptOuts && schedule.status !== 'closed' && (
                <div style={cardStyle}>
                  <label style={{ ...labelStyle, fontSize: '0.85rem', marginBottom: '0.5rem' }}>⏭ {t('prepScheduler.editOptOuts', 'Edit Opt-Outs')}</label>
                  <p style={{ color: colors.textMuted, fontSize: '0.7rem', marginBottom: '0.5rem' }}>{t('prepScheduler.editOptOutsDesc', 'Toggle which days you want to opt out of. Changes are saved immediately.')}</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    {enabledDays.map(day => {
                      const skipKey = `skip_${day}` as 'skip_monday' | 'skip_tuesday' | 'skip_thursday';
                      const isSkipped = existingSubmission![skipKey];
                      return (
                        <label key={day} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', padding: '0.35rem 0.5rem', borderRadius: '6px', backgroundColor: isSkipped ? `${DAY_COLORS[day]}08` : 'transparent', border: `1px solid ${isSkipped ? `${DAY_COLORS[day]}20` : 'transparent'}` }}>
                          <input type="checkbox" checked={isSkipped} onChange={() => {
                            updateSubmissionOptOuts(existingSubmission!.id, {
                              skip_monday: day === 'monday' ? !isSkipped : existingSubmission!.skip_monday,
                              skip_tuesday: day === 'tuesday' ? !isSkipped : existingSubmission!.skip_tuesday,
                              skip_thursday: day === 'thursday' ? !isSkipped : existingSubmission!.skip_thursday,
                            });
                          }} style={{ width: '16px', height: '16px', accentColor: DAY_COLORS[day], cursor: 'pointer' }} />
                          <span style={{ color: isSkipped ? DAY_COLORS[day] : colors.textMuted, fontSize: '0.8rem', fontWeight: isSkipped ? 600 : 400 }}>
                            {t('prepScheduler.skipDayLabel', 'Skip {{day}}', { day: getDayLabel(day, t) })}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Re-fill Form button */}
              {setIsRefilling && schedule.status !== 'closed' && (
                <div style={{ textAlign: 'center' }}>
                  <button onClick={() => setIsRefilling(true)}
                    style={{ padding: '0.5rem 1.25rem', backgroundColor: '#a855f710', border: '1px solid #a855f730', borderRadius: '8px', color: '#a855f7', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
                    ✏️ {t('prepScheduler.refillForm', 'Update My Form')}
                  </button>
                  <p style={{ color: colors.textMuted, fontSize: '0.65rem', marginTop: '0.3rem' }}>{t('prepScheduler.refillDesc', 'Edit your speedups, availability, or other details.')}</p>
                </div>
              )}
            </>
          ) : (
            <>
              {/* Availability per day */}
              {enabledDays.map(day => {
                const isSkipped = day === 'monday' ? skipMonday : day === 'tuesday' ? skipTuesday : skipThursday;
                const setSkipped = day === 'monday' ? setSkipMonday : day === 'tuesday' ? setSkipTuesday : setSkipThursday;
                const buffType = day === 'monday' ? schedule.monday_buff : day === 'tuesday' ? schedule.tuesday_buff : schedule.thursday_buff;
                return (
                  <div key={day} style={{ ...cardStyle, borderColor: `${DAY_COLORS[day]}30`, opacity: isSkipped ? 0.6 : 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <label style={{ ...labelStyle, marginBottom: 0, color: DAY_COLORS[day] }}>
                        {getDayLabel(day, t)} — {getBuffLabel(buffType, t)}
                      </label>
                      {day !== 'monday' && !isSkipped && (
                        <button onClick={() => {
                          if (day === 'tuesday') setTuesdayAvail([...mondayAvail]);
                          if (day === 'thursday') setThursdayAvail([...tuesdayAvail]);
                        }} style={{ padding: '0.2rem 0.5rem', backgroundColor: `${DAY_COLORS[day]}10`, border: `1px solid ${DAY_COLORS[day]}30`, borderRadius: '4px', color: DAY_COLORS[day], fontSize: '0.65rem', cursor: 'pointer' }}>
                          {t('prepScheduler.copyFrom', 'Copy from')} {day === 'tuesday' ? getDayLabel('monday', t) : getDayLabel('tuesday', t)}
                        </button>
                      )}
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginBottom: isSkipped ? 0 : '0.5rem' }}>
                      <input type="checkbox" checked={isSkipped} onChange={(e) => setSkipped(e.target.checked)}
                        style={{ width: '14px', height: '14px', accentColor: DAY_COLORS[day], cursor: 'pointer' }} />
                      <span style={{ color: isSkipped ? DAY_COLORS[day] : colors.textMuted, fontSize: '0.75rem', fontWeight: isSkipped ? 600 : 400 }}>
                        {t('prepScheduler.dontNeedBuff', "I don't need this buff")}
                      </span>
                    </label>
                    {!isSkipped && (
                      <>
                        <p style={{ color: colors.textMuted, fontSize: '0.7rem', marginBottom: '0.5rem' }}>
                          {t('prepScheduler.timezoneHint', 'Select up to 3 time ranges when you can play (UTC).')} <span style={{ color: '#a855f7' }}>{t('prepScheduler.yourTimezone', 'Your timezone')}: {TZ_ABBR} (UTC{UTC_OFFSET_HOURS >= 0 ? '+' : ''}{UTC_OFFSET_HOURS})</span>
                        </p>
                        <TimeRangePicker
                          ranges={day === 'monday' ? mondayAvail : day === 'tuesday' ? tuesdayAvail : thursdayAvail}
                          onChange={day === 'monday' ? setMondayAvail : day === 'tuesday' ? setTuesdayAvail : setThursdayAvail}
                          accentColor={DAY_COLORS[day]}
                          isMobile={isMobile}
                        />
                      </>
                    )}
                  </div>
                );
              })}

              {/* Speedups */}
              <SpeedupSection
                isMobile={isMobile}
                generalSpeedups={generalSpeedups} setGeneralSpeedups={setGeneralSpeedups}
                trainingSpeedups={trainingSpeedups} setTrainingSpeedups={setTrainingSpeedups}
                constructionSpeedups={constructionSpeedups} setConstructionSpeedups={setConstructionSpeedups}
                researchSpeedups={researchSpeedups} setResearchSpeedups={setResearchSpeedups}
                inputStyle={inputStyle} labelStyle={labelStyle} cardStyle={cardStyle}
                t={t}
              />

              {/* General Speedup Target with allocation */}
              <GeneralTargetSection
                generalSpeedups={generalSpeedups}
                generalTarget={generalTarget} setGeneralTarget={setGeneralTarget}
                generalAllocation={generalAllocation} setGeneralAllocation={setGeneralAllocation}
                labelStyle={labelStyle} cardStyle={cardStyle}
                t={t}
              />

              {/* Screenshot Upload — Required */}
              <div style={{ ...cardStyle, borderColor: !screenshotPreview ? '#ef444430' : colors.border }}>
                <label style={labelStyle}>📸 {t('prepScheduler.screenshotProofRequired', 'Screenshot Proof')} <span style={{ color: '#ef4444' }}>*</span></label>
                <p style={{ color: colors.textMuted, fontSize: '0.7rem', marginBottom: '0.5rem' }}>{t('prepScheduler.screenshotDesc', 'Upload a screenshot of your speedups. JPEG, PNG, GIF, or WebP. Max 5MB.')}</p>
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" onChange={handleScreenshotChange} style={{ display: 'none' }} />
                <button onClick={() => fileInputRef.current?.click()}
                  style={{ padding: '0.4rem 0.75rem', backgroundColor: `${colors.primary}15`, border: `1px solid ${colors.primary}30`, borderRadius: '6px', color: colors.primary, fontSize: '0.8rem', cursor: 'pointer' }}>
                  {screenshotPreview ? `📷 ${t('prepScheduler.changeScreenshot', 'Change Screenshot')}` : `📷 ${t('prepScheduler.uploadScreenshot', 'Upload Screenshot')}`}
                </button>
                {screenshotPreview && (
                  <div style={{ marginTop: '0.5rem' }}>
                    <img src={screenshotPreview} alt="Screenshot preview" style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '8px', border: `1px solid ${colors.border}` }} />
                  </div>
                )}
              </div>
            </>
          )}

          {/* Submit — inline on desktop, spacer + sticky bar on mobile */}
          {!isReadOnly && !isMobile && (
            <>
              {schedule.status === 'closed' ? (
                <div style={{ padding: '0.75rem 1.5rem', backgroundColor: '#ef444410', border: '1px solid #ef444430', borderRadius: '10px', textAlign: 'center' }}>
                  <span style={{ color: '#ef4444', fontSize: '0.85rem', fontWeight: 600 }}>🔒 {t('prepScheduler.formClosedLocked', 'Form is closed — submissions are locked')}</span>
                </div>
              ) : (
                <button onClick={submitForm} disabled={saving || !formUsername.trim() || formAlliance.trim().length !== 3}
                  style={{ padding: '0.75rem 1.5rem', backgroundColor: '#a855f720', border: '1px solid #a855f750', borderRadius: '10px', color: '#a855f7', fontSize: '0.9rem', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving || formAlliance.trim().length !== 3 ? 0.6 : 1 }}>
                  {saving ? t('prepScheduler.submitting', 'Submitting...') : isAltMode ? `📤 ${t('prepScheduler.submitAlt', 'Submit Alt Account')}` : `📤 ${t('prepScheduler.submit', 'Submit')}`}
                </button>
              )}
            </>
          )}

          {/* Spacer for mobile sticky bar */}
          {isMobile && !isReadOnly && <div style={{ height: '70px' }} />}

          <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
            <Link to="/tools" style={{ color: '#22d3ee', textDecoration: 'none', fontSize: '0.8rem' }}>← {t('prepScheduler.backToTools', 'Back to Tools')}</Link>
          </div>
        </div>
      </div>

      {/* Mobile Sticky Submit Bar */}
      {isMobile && !isReadOnly && schedule.status !== 'closed' && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
          padding: '0.75rem 1rem',
          backgroundColor: 'rgba(10, 10, 10, 0.95)',
          borderTop: '1px solid #a855f730',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}>
          <button onClick={submitForm} disabled={saving || !formUsername.trim() || formAlliance.trim().length !== 3}
            style={{
              width: '100%', padding: '0.85rem 1.5rem',
              backgroundColor: '#a855f720', border: '1px solid #a855f750',
              borderRadius: '10px', color: '#a855f7', fontSize: '1rem',
              fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer',
              opacity: (saving || !formUsername.trim() || formAlliance.trim().length !== 3) ? 0.5 : 1,
              minHeight: '50px',
            }}>
            {saving ? t('prepScheduler.submitting', 'Submitting...') : isAltMode ? `📤 ${t('prepScheduler.submitAlt', 'Submit Alt Account')}` : `📤 ${t('prepScheduler.submit', 'Submit')}`}
          </button>
        </div>
      )}
      {isMobile && !isReadOnly && schedule.status === 'closed' && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
          padding: '0.75rem 1rem',
          backgroundColor: 'rgba(10, 10, 10, 0.95)',
          borderTop: '1px solid #ef444430',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}>
          <div style={{ padding: '0.75rem 1.5rem', backgroundColor: '#ef444410', border: '1px solid #ef444430', borderRadius: '10px', textAlign: 'center' }}>
            <span style={{ color: '#ef4444', fontSize: '0.85rem', fontWeight: 600 }}>🔒 {t('prepScheduler.formClosedLocked', 'Form is closed — submissions are locked')}</span>
          </div>
        </div>
      )}

      {/* Change Request Modal */}
      {showChangeRequestForm && existingSubmission && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: '1rem' }} onClick={() => setShowChangeRequestForm(false)}>
          <div onClick={e => e.stopPropagation()} style={{ backgroundColor: colors.surface, border: `1px solid ${colors.border}`, borderRadius: '12px', padding: '1.25rem', width: '100%', maxWidth: '400px' }}>
            <h4 style={{ color: colors.text, fontSize: '0.95rem', margin: '0 0 1rem', fontWeight: 600 }}>🔄 {t('prepScheduler.requestSlotChange', 'Request Slot Change')}</h4>
            <div style={{ marginBottom: '0.75rem' }}>
              <label style={labelStyle}>{t('prepScheduler.type', 'Type')}</label>
              <select value={changeRequestType} onChange={e => setChangeRequestType(e.target.value as 'cant_attend' | 'change_slot' | 'other')} style={{ ...inputStyle, width: '100%' }}>
                <option value="cant_attend">❌ {t('prepScheduler.cantAttend', "Can't attend my assigned slot")}</option>
                <option value="change_slot">🔄 {t('prepScheduler.needDifferentTime', 'Need a different time')}</option>
                <option value="other">💬 {t('prepScheduler.other', 'Other')}</option>
              </select>
            </div>
            <div style={{ marginBottom: '0.75rem' }}>
              <label style={labelStyle}>{t('prepScheduler.day', 'Day')}</label>
              <select value={changeRequestDay} onChange={e => setChangeRequestDay(e.target.value as Day)} style={{ ...inputStyle, width: '100%' }}>
                {enabledDays.map(d => <option key={d} value={d}>{getDayLabel(d, t)}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={labelStyle}>{t('prepScheduler.messageOptional', 'Message (optional)')}</label>
              <textarea value={changeRequestMessage} onChange={e => setChangeRequestMessage(e.target.value)} placeholder={t('prepScheduler.messagePlaceholder', 'Explain your situation...')} rows={3} maxLength={500} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowChangeRequestForm(false)} style={{ padding: '0.5rem 1rem', backgroundColor: colors.border, border: 'none', borderRadius: '6px', color: colors.textSecondary, fontSize: '0.8rem', cursor: 'pointer' }}>{t('prepScheduler.cancel', 'Cancel')}</button>
              <button onClick={submitChangeRequest} disabled={saving} style={{ padding: '0.5rem 1rem', backgroundColor: '#a855f720', border: '1px solid #a855f750', borderRadius: '6px', color: '#a855f7', fontSize: '0.8rem', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}>{saving ? t('prepScheduler.sending', 'Sending...') : t('prepScheduler.submitRequest', 'Submit Request')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Non-Qualifying Report Popup */}
      {showNonQualifyingPopup && existingSubmission && schedule && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: '1rem' }} onClick={() => setShowNonQualifyingPopup(false)}>
          <div onClick={e => e.stopPropagation()} style={{ backgroundColor: colors.surface, border: `1px solid ${colors.border}`, borderRadius: '12px', padding: '1.25rem', width: '100%', maxWidth: '420px' }}>
            <h4 style={{ color: colors.text, fontSize: '0.95rem', margin: '0 0 0.75rem', fontWeight: 600 }}>📊 {t('prepScheduler.yourPrepReport', 'Your Prep Report')}</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {enabledDays.map(day => {
                const isSkipped = isSkippedDay(existingSubmission, day);
                const effective = getEffectiveSpeedups(existingSubmission, day, schedule);
                const buffType = day === 'monday' ? schedule.monday_buff : day === 'tuesday' ? schedule.tuesday_buff : schedule.thursday_buff;
                const availKey = `${day}_availability` as keyof PrepSubmission;
                const avail = (existingSubmission[availKey] as string[][] | undefined) || [];
                const hasSlot = assignments.some(a => a.submission_id === existingSubmission.id && a.day === day);
                return (
                  <div key={day} style={{ padding: '0.5rem', borderRadius: '6px', border: `1px solid ${isSkipped ? colors.border : hasSlot ? '#22c55e30' : '#ef444430'}`, backgroundColor: isSkipped ? `${colors.textMuted}05` : hasSlot ? '#22c55e08' : '#ef444408' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                      <span style={{ color: isSkipped ? colors.textMuted : hasSlot ? '#22c55e' : '#ef4444', fontSize: '0.8rem', fontWeight: 700 }}>{getDayLabel(day, t)}</span>
                      <span style={{ color: colors.textMuted, fontSize: '0.65rem' }}>{getBuffLabel(buffType, t)}</span>
                      <span style={{ marginLeft: 'auto', fontSize: '0.7rem', fontWeight: 600, color: isSkipped ? '#f59e0b' : hasSlot ? '#22c55e' : '#ef4444' }}>
                        {isSkipped ? `⏭ ${t('prepScheduler.optedOut', 'Opted Out')}` : hasSlot ? `✅ ${t('prepScheduler.qualified', 'Qualified')}` : `❌ ${t('prepScheduler.notSelected', 'Not Selected')}`}
                      </span>
                    </div>
                    {!isSkipped && (
                      <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.7rem', color: colors.textMuted }}>
                        <span>{t('prepScheduler.speedupsLabel', 'Speedups')}: {formatMinutes(effective)}</span>
                        <span>{t('prepScheduler.availability', 'Availability')}: {avail.length > 0 ? formatAvailRanges(avail) : t('prepScheduler.none', 'None')}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <button onClick={() => setShowNonQualifyingPopup(false)} style={{ marginTop: '1rem', padding: '0.5rem 1rem', backgroundColor: colors.border, border: 'none', borderRadius: '6px', color: colors.textSecondary, fontSize: '0.8rem', cursor: 'pointer', width: '100%' }}>{t('prepScheduler.close', 'Close')}</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PrepSchedulerForm;
