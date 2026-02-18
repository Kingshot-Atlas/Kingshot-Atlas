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
  skipMonday: boolean; setSkipMonday: (v: boolean) => void;
  skipTuesday: boolean; setSkipTuesday: (v: boolean) => void;
  skipThursday: boolean; setSkipThursday: (v: boolean) => void;
  screenshotPreview: string;
  fileInputRef: React.RefObject<HTMLInputElement>;
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
}

// ─── Speedup Section with Advanced Slider Mode ──────────────────────────────

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
  const [advancedMode, setAdvancedMode] = useState(false);

  type SpeedupKey = 'general' | 'training' | 'construction' | 'research';
  const values: Record<SpeedupKey, number> = { general: generalSpeedups, training: trainingSpeedups, construction: constructionSpeedups, research: researchSpeedups };
  const setters: Record<SpeedupKey, (v: number) => void> = { general: setGeneralSpeedups, training: setTrainingSpeedups, construction: setConstructionSpeedups, research: setResearchSpeedups };
  const total = useMemo(() => generalSpeedups + trainingSpeedups + constructionSpeedups + researchSpeedups, [generalSpeedups, trainingSpeedups, constructionSpeedups, researchSpeedups]);

  const pct = (v: number) => total > 0 ? Math.round((v / total) * 100) : 0;

  const formatTime = (mins: number) => {
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
        <label style={{ ...labelStyle, marginBottom: 0, fontSize: '0.85rem' }}>⏱️ {t('prepScheduler.speedups', 'Speedups (in minutes)')}</label>
        <button
          onClick={() => setAdvancedMode(!advancedMode)}
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
          📊 {advancedMode ? t('prepScheduler.simpleMode', 'Simple') : t('prepScheduler.advancedMode', 'Advanced')}
        </button>
      </div>
      <p style={{ color: colors.textMuted, fontSize: '0.7rem', marginBottom: '0.75rem' }}>{t('prepScheduler.speedupsDesc', 'Total minutes of each speedup type you plan to use this KvK Prep Phase.')}</p>

      {/* Number inputs — always visible */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '0.75rem' }}>
        {SPEEDUP_TYPES.map(st => (
          <div key={st.key}>
            <label style={labelStyle}>{st.icon} {t(st.i18nKey, st.fallback)}</label>
            <input type="number" value={values[st.key] || ''} onChange={(e) => setters[st.key](parseInt(e.target.value) || 0)} placeholder="0" style={inputStyle} min={0} />
          </div>
        ))}
      </div>

      {/* Advanced mode: percentage sliders + visual distribution */}
      {advancedMode && (
        <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: `1px solid ${colors.border}` }}>
          {/* Total summary */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
            <span style={{ color: colors.textSecondary, fontSize: '0.75rem', fontWeight: 600 }}>
              {t('prepScheduler.totalSpeedups', 'Total')}: <span style={{ color: '#a855f7', fontFamily: "'JetBrains Mono', monospace" }}>{formatTime(total)}</span>
            </span>
            {total > 0 && (
              <span style={{ color: colors.textMuted, fontSize: '0.65rem' }}>
                {t('prepScheduler.distribution', 'Distribution')} ↓
              </span>
            )}
          </div>

          {/* Visual distribution bar */}
          {total > 0 && (
            <div style={{ display: 'flex', height: '8px', borderRadius: '4px', overflow: 'hidden', marginBottom: '0.75rem', backgroundColor: `${colors.border}` }}>
              {SPEEDUP_TYPES.map(st => {
                const p = pct(values[st.key]);
                return p > 0 ? (
                  <div key={st.key} style={{ width: `${p}%`, backgroundColor: st.color, transition: 'width 0.3s ease' }} title={`${t(st.i18nKey, st.fallback)}: ${p}%`} />
                ) : null;
              })}
            </div>
          )}

          {/* Per-type slider bars */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {SPEEDUP_TYPES.map(st => {
              const v = values[st.key];
              const p = pct(v);
              const maxSlider = Math.max(total * 2, 10000); // Slider max = 2x total or 10k mins
              return (
                <div key={st.key}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                    <span style={{ color: st.color, fontSize: '0.7rem', fontWeight: 600 }}>{st.icon} {t(st.i18nKey, st.fallback)}</span>
                    <span style={{ color: colors.textMuted, fontSize: '0.65rem', fontFamily: "'JetBrains Mono', monospace" }}>
                      {formatTime(v)} {total > 0 && <span style={{ color: st.color }}>({p}%)</span>}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={maxSlider}
                    step={30}
                    value={v}
                    onChange={(e) => setters[st.key](parseInt(e.target.value) || 0)}
                    style={{
                      width: '100%', height: '6px', appearance: 'none', WebkitAppearance: 'none',
                      background: `linear-gradient(to right, ${st.color} 0%, ${st.color} ${(v / maxSlider) * 100}%, ${colors.border} ${(v / maxSlider) * 100}%, ${colors.border} 100%)`,
                      borderRadius: '3px', outline: 'none', cursor: 'pointer',
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

const PrepSchedulerForm: React.FC<PrepSchedulerFormProps> = (props) => {
  const { t } = useTranslation();
  const {
    isMobile, schedule, existingSubmission, assignments,
    formUsername, setFormUsername, formAlliance, setFormAlliance,
    mondayAvail, setMondayAvail, tuesdayAvail, setTuesdayAvail,
    thursdayAvail, setThursdayAvail,
    generalSpeedups, setGeneralSpeedups, trainingSpeedups, setTrainingSpeedups,
    constructionSpeedups, setConstructionSpeedups, researchSpeedups, setResearchSpeedups,
    generalTarget, setGeneralTarget,
    skipMonday, setSkipMonday, skipTuesday, setSkipTuesday, skipThursday, setSkipThursday,
    screenshotPreview, fileInputRef, handleScreenshotChange,
    saving, submitForm,
    showChangeRequestForm, setShowChangeRequestForm,
    changeRequestDay, setChangeRequestDay, changeRequestType, setChangeRequestType,
    changeRequestMessage, setChangeRequestMessage, submitChangeRequest,
    showNonQualifyingPopup, setShowNonQualifyingPopup,
  } = props;

  // Progress tracking for mobile
  const formProgress = useMemo(() => {
    const steps = [
      { done: !!formUsername.trim() && !!formAlliance.trim() },
      { done: skipMonday || mondayAvail.some(r => r[0] && r[1]) },
      { done: skipTuesday || tuesdayAvail.some(r => r[0] && r[1]) },
      { done: skipThursday || thursdayAvail.some(r => r[0] && r[1]) },
      { done: generalSpeedups > 0 || trainingSpeedups > 0 || constructionSpeedups > 0 || researchSpeedups > 0 },
      { done: !!generalTarget },
    ];
    return { completed: steps.filter(s => s.done).length, total: steps.length };
  }, [formUsername, formAlliance, skipMonday, skipTuesday, skipThursday, mondayAvail, tuesdayAvail, thursdayAvail, generalSpeedups, trainingSpeedups, constructionSpeedups, researchSpeedups, generalTarget]);

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
            <span style={{ color: '#22c55e', fontSize: '0.75rem', fontWeight: 600 }}>✅ {t('prepScheduler.editingResponse', 'Editing your existing response')}</span>
          </div>
        )}
      </div>

      {/* Mobile Progress Indicator */}
      {isMobile && (
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
                {DAYS.map(day => {
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

          {/* Non-qualifying notice */}
          {existingSubmission && schedule.is_locked && assignments.filter(a => a.submission_id === existingSubmission.id).length === 0 && !showNonQualifyingPopup && (
            <div style={{ ...cardStyle, borderColor: '#ef444430', backgroundColor: '#ef444408' }}>
              <h4 style={{ color: '#ef4444', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem' }}>❌ {t('prepScheduler.notAssigned', 'You were not assigned a slot')}</h4>
              <p style={{ color: colors.textMuted, fontSize: '0.75rem', marginBottom: '0.5rem', lineHeight: 1.5 }}>
                {t('prepScheduler.notAssignedDesc', 'The schedule has been locked and you did not receive an appointment slot. This may be due to the 48-user limit per day or scheduling conflicts.')}
              </p>
              <button onClick={() => setShowNonQualifyingPopup(true)} style={{ padding: '0.4rem 0.8rem', backgroundColor: '#a855f715', border: '1px solid #a855f730', borderRadius: '6px', color: '#a855f7', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>📊 {t('prepScheduler.viewReport', 'View Report')}</button>
            </div>
          )}

          {/* Username & Alliance */}
          <div style={cardStyle}>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={labelStyle}>{t('prepScheduler.username', 'Username')} *</label>
                <input type="text" value={formUsername} onChange={(e) => setFormUsername(e.target.value)} placeholder={t('prepScheduler.usernamePlaceholder', 'In-game username')} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>{t('prepScheduler.alliance', 'Alliance')} *</label>
                <input type="text" value={formAlliance} onChange={(e) => setFormAlliance(e.target.value)} placeholder="e.g. ABC" style={inputStyle} />
              </div>
            </div>
          </div>

          {/* Availability per day */}
          {DAYS.map(day => {
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

          {/* General Speedup Target */}
          <div style={cardStyle}>
            <label style={labelStyle}>{t('prepScheduler.generalTarget', 'Where will you spend most of your General Speedups?')}</label>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
              {(['construction', 'research', 'training'] as const).map(tt => (
                <button key={tt} onClick={() => setGeneralTarget(tt)}
                  style={{ padding: '0.4rem 0.75rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem',
                    backgroundColor: generalTarget === tt ? `${tt === 'construction' ? DAY_COLORS.monday : tt === 'research' ? DAY_COLORS.tuesday : DAY_COLORS.thursday}20` : 'transparent',
                    border: `1px solid ${generalTarget === tt ? `${tt === 'construction' ? DAY_COLORS.monday : tt === 'research' ? DAY_COLORS.tuesday : DAY_COLORS.thursday}50` : colors.border}`,
                    color: generalTarget === tt ? (tt === 'construction' ? DAY_COLORS.monday : tt === 'research' ? DAY_COLORS.tuesday : DAY_COLORS.thursday) : colors.textMuted,
                    fontWeight: generalTarget === tt ? 600 : 400 }}>
                  {getBuffLabel(tt, t)}
                </button>
              ))}
            </div>
          </div>

          {/* Screenshot Upload */}
          <div style={cardStyle}>
            <label style={labelStyle}>📸 {t('prepScheduler.screenshotProof', 'Screenshot Proof (optional)')}</label>
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

          {/* Submit — inline on desktop, spacer + sticky bar on mobile */}
          {!isMobile && (
            <>
              {schedule.status === 'closed' ? (
                <div style={{ padding: '0.75rem 1.5rem', backgroundColor: '#ef444410', border: '1px solid #ef444430', borderRadius: '10px', textAlign: 'center' }}>
                  <span style={{ color: '#ef4444', fontSize: '0.85rem', fontWeight: 600 }}>🔒 {t('prepScheduler.formClosedLocked', 'Form is closed — submissions are locked')}</span>
                </div>
              ) : (
                <button onClick={submitForm} disabled={saving || !formUsername.trim()}
                  style={{ padding: '0.75rem 1.5rem', backgroundColor: '#a855f720', border: '1px solid #a855f750', borderRadius: '10px', color: '#a855f7', fontSize: '0.9rem', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>
                  {saving ? t('prepScheduler.submitting', 'Submitting...') : existingSubmission ? `✏️ ${t('prepScheduler.updateSubmission', 'Update Submission')}` : `📤 ${t('prepScheduler.submit', 'Submit')}`}
                </button>
              )}
            </>
          )}

          {/* Spacer for mobile sticky bar */}
          {isMobile && <div style={{ height: '70px' }} />}

          <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
            <Link to="/tools" style={{ color: '#22d3ee', textDecoration: 'none', fontSize: '0.8rem' }}>← {t('prepScheduler.backToTools', 'Back to Tools')}</Link>
          </div>
        </div>
      </div>

      {/* Mobile Sticky Submit Bar */}
      {isMobile && schedule.status !== 'closed' && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
          padding: '0.75rem 1rem',
          backgroundColor: 'rgba(10, 10, 10, 0.95)',
          borderTop: '1px solid #a855f730',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}>
          <button onClick={submitForm} disabled={saving || !formUsername.trim()}
            style={{
              width: '100%', padding: '0.85rem 1.5rem',
              backgroundColor: '#a855f720', border: '1px solid #a855f750',
              borderRadius: '10px', color: '#a855f7', fontSize: '1rem',
              fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer',
              opacity: (saving || !formUsername.trim()) ? 0.5 : 1,
              minHeight: '50px',
            }}>
            {saving ? t('prepScheduler.submitting', 'Submitting...') : existingSubmission ? `✏️ ${t('prepScheduler.updateSubmission', 'Update Submission')}` : `📤 ${t('prepScheduler.submit', 'Submit')}`}
          </button>
        </div>
      )}
      {isMobile && schedule.status === 'closed' && (
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
                {DAYS.map(d => <option key={d} value={d}>{getDayLabel(d, t)}</option>)}
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
              {DAYS.map(day => {
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
