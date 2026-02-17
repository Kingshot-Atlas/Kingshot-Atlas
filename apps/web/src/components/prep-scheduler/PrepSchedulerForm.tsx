import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { colors, neonGlow, FONT_DISPLAY } from '../../utils/styles';
import {
  PrepSchedule, PrepSubmission, SlotAssignment,
  Day, DAYS, DAY_COLORS, TZ_ABBR, UTC_OFFSET_HOURS,
  getDayLabel, getBuffLabel,
} from './types';
import { getDeadlineCountdown, getEffectiveSpeedups, formatMinutes, formatAvailRanges, isSkippedDay } from './utils';
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
        {(() => { const dl = getDeadlineCountdown(schedule.deadline, t); return dl && !dl.expired ? (
          <div style={{ marginTop: '0.5rem', padding: '0.3rem 0.8rem', backgroundColor: dl.urgent ? '#ef444415' : '#f59e0b15', border: `1px solid ${dl.urgent ? '#ef444430' : '#f59e0b30'}`, borderRadius: '20px', display: 'inline-block' }}>
            <span style={{ color: dl.urgent ? '#ef4444' : '#f59e0b', fontSize: '0.75rem', fontWeight: 600 }}>⏰ {dl.text}</span>
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
                <label style={labelStyle}>{t('prepScheduler.alliance', 'Alliance')}</label>
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
          <div style={cardStyle}>
            <label style={{ ...labelStyle, marginBottom: '0.5rem', fontSize: '0.85rem' }}>⏱️ {t('prepScheduler.speedups', 'Speedups (in minutes)')}</label>
            <p style={{ color: colors.textMuted, fontSize: '0.7rem', marginBottom: '0.75rem' }}>{t('prepScheduler.speedupsDesc', 'Total minutes of each speedup type you plan to use this KvK Prep Phase.')}</p>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '0.75rem' }}>
              <div><label style={labelStyle}>🔧 {t('prepScheduler.general', 'General')}</label><input type="number" value={generalSpeedups || ''} onChange={(e) => setGeneralSpeedups(parseInt(e.target.value) || 0)} placeholder="0" style={inputStyle} min={0} /></div>
              <div><label style={labelStyle}>⚔️ {t('prepScheduler.training', 'Training')}</label><input type="number" value={trainingSpeedups || ''} onChange={(e) => setTrainingSpeedups(parseInt(e.target.value) || 0)} placeholder="0" style={inputStyle} min={0} /></div>
              <div><label style={labelStyle}>🏗️ {t('prepScheduler.construction', 'Construction')}</label><input type="number" value={constructionSpeedups || ''} onChange={(e) => setConstructionSpeedups(parseInt(e.target.value) || 0)} placeholder="0" style={inputStyle} min={0} /></div>
              <div><label style={labelStyle}>🔬 {t('prepScheduler.research', 'Research')}</label><input type="number" value={researchSpeedups || ''} onChange={(e) => setResearchSpeedups(parseInt(e.target.value) || 0)} placeholder="0" style={inputStyle} min={0} /></div>
            </div>
          </div>

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

          {/* Submit */}
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

          <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
            <Link to="/tools" style={{ color: '#22d3ee', textDecoration: 'none', fontSize: '0.8rem' }}>← {t('prepScheduler.backToTools', 'Back to Tools')}</Link>
          </div>
        </div>
      </div>

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
