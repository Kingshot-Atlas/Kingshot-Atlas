import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { colors, neonGlow, FONT_DISPLAY } from '../../utils/styles';
import { PrepSchedule } from './types';

interface PrepSchedulerListProps {
  isMobile: boolean;
  user: { id: string } | null;
  profile: { linked_kingdom?: number; linked_player_id?: string; is_admin?: boolean } | null;
  goldKingdoms: Set<number>;
  mySchedules: PrepSchedule[];
  kingdomSchedules: PrepSchedule[];
  navigate: (path: string) => void;
  isEditorOrCoEditor: boolean;
  isManager: boolean;
  // Create schedule props
  createKingdom: number;
  setCreateKingdom: (v: number) => void;
  createKvkNumber: number;
  setCreateKvkNumber: (v: number) => void;
  createNotes: string;
  setCreateNotes: (v: string) => void;
  createDeadline: string;
  setCreateDeadline: (v: string) => void;
  createSchedule: () => Promise<void>;
  saving: boolean;
}

const PrepSchedulerList: React.FC<PrepSchedulerListProps> = ({
  isMobile, user, profile, goldKingdoms, mySchedules, kingdomSchedules, navigate,
  isEditorOrCoEditor, isManager,
  createKingdom, setCreateKingdom, createKvkNumber, setCreateKvkNumber,
  createNotes, setCreateNotes, createDeadline, setCreateDeadline,
  createSchedule, saving,
}) => {
  const { t } = useTranslation();

  // Check for return URL (after login/linking)
  const returnUrl = (() => { try { return sessionStorage.getItem('prep_return_url'); } catch { return null; } })();
  if (returnUrl && user && profile?.linked_player_id) {
    sessionStorage.removeItem('prep_return_url');
    navigate(returnUrl);
    return null;
  }

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
      <div style={{ padding: isMobile ? '1.5rem 1rem' : '2rem', textAlign: 'center', background: 'linear-gradient(180deg, #111111 0%, #0a0a0a 100%)' }}>
        <div style={{ maxWidth: '700px', margin: '0 auto' }}>
          <h1 style={{ fontSize: isMobile ? '1.5rem' : '2rem', fontFamily: FONT_DISPLAY, marginBottom: '0.5rem', letterSpacing: '0.04em' }}>
            <span style={{ color: '#fff' }}>KvK</span>
            <span style={{ ...neonGlow('#a855f7'), marginLeft: '0.5rem' }}>PREP SCHEDULER</span>
          </h1>
          <p style={{ color: '#9ca3af', fontSize: isMobile ? '0.85rem' : '0.95rem', lineHeight: 1.6 }}>
            {t('prepScheduler.subtitle', 'Coordinate Castle Appointments for your kingdom\'s Prep Phase. Collect player availability and speedup data, then assign optimal buff slots.')}
          </p>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.5rem', padding: '0.2rem 0.6rem', backgroundColor: '#ffc30b15', border: '1px solid #ffc30b30', borderRadius: '20px' }}>
            <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#ffc30b' }}>👑 {t('prepScheduler.goldTierOnly', 'GOLD TIER KINGDOMS ONLY')}</span>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '700px', margin: '0 auto', padding: isMobile ? '1rem' : '1.5rem' }}>
        {/* Return notification */}
        {returnUrl && user && !profile?.linked_player_id && (
          <div style={{ ...cardStyle, marginBottom: '1rem', borderColor: '#22d3ee30', backgroundColor: '#22d3ee08' }}>
            <p style={{ color: '#22d3ee', fontSize: '0.8rem', fontWeight: 600 }}>
              🔗 {t('prepScheduler.linkReturnHint', 'Link your Kingshot account to access the prep form you were invited to.')}
            </p>
          </div>
        )}

        {/* Fill The Form CTA */}
        {kingdomSchedules.length > 0 && user && profile?.linked_kingdom && goldKingdoms.has(profile.linked_kingdom) && (
          <div style={{ ...cardStyle, marginBottom: '1.5rem', borderColor: '#a855f730', backgroundColor: '#a855f708' }}>
            <h3 style={{ color: '#a855f7', fontSize: '0.95rem', marginBottom: '0.5rem', fontWeight: 700 }}>📅 {t('prepScheduler.activeSchedule', 'Your Kingdom Has an Active Prep Schedule')}</h3>
            <p style={{ color: colors.textMuted, fontSize: '0.8rem', marginBottom: '0.75rem', lineHeight: 1.5 }}>
              {t('prepScheduler.activeScheduleDesc', 'Kingdom {{kingdom}} has {{count}} active schedule(s). Submit your speedups and availability so your Prep Manager can assign you a slot.', { kingdom: profile.linked_kingdom, count: kingdomSchedules.length })}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {kingdomSchedules.map(ks => (
                <button key={ks.id} onClick={() => navigate(`/tools/prep-scheduler/${ks.id}`)}
                  style={{ padding: '0.6rem 1rem', backgroundColor: '#a855f720', border: '1px solid #a855f750', borderRadius: '8px', color: '#a855f7', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', width: 'fit-content', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  📝 {t('prepScheduler.fillForm', 'Fill The Form')}{ks.kvk_number ? ` — KvK #${ks.kvk_number}` : ''}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Gold Tier Required notice */}
        {user && profile?.linked_kingdom && !goldKingdoms.has(profile.linked_kingdom) && !kingdomSchedules.length && mySchedules.length === 0 && (
          <div style={{ ...cardStyle, marginBottom: '1.5rem', borderColor: '#ffc30b30', backgroundColor: '#ffc30b08' }}>
            <h3 style={{ color: '#ffc30b', fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.5rem' }}>👑 {t('prepScheduler.goldTierRequired', 'Gold Tier Required')}</h3>
            <p style={{ color: colors.textMuted, fontSize: '0.8rem', lineHeight: 1.5 }}>
              {t('prepScheduler.goldTierRequiredDesc', 'The KvK Prep Scheduler is available for Gold Tier kingdoms. Encourage your kingdom to reach Gold tier through the Kingdom Fund to unlock this tool!')}
            </p>
          </div>
        )}

        {/* Permission info banner for non-editors with Gold Tier kingdoms */}
        {user && profile?.linked_kingdom && goldKingdoms.has(profile.linked_kingdom) && !profile?.is_admin && !isEditorOrCoEditor && !isManager && (
          <div style={{ ...cardStyle, marginBottom: '1.5rem', borderColor: '#a855f730', backgroundColor: '#a855f708', display: 'flex', alignItems: 'flex-start', gap: '0.6rem' }}>
            <span style={{ fontSize: '1rem', flexShrink: 0 }}>ℹ️</span>
            <p style={{ color: colors.textMuted, fontSize: '0.8rem', lineHeight: 1.5, margin: 0 }}>
              {t('prepScheduler.noPermissionBanner', 'Only Editors, Co-Editors, and Prep Managers can create schedules. Ask your kingdom leadership for access.')}
            </p>
          </div>
        )}

        {/* Create New Schedule — only Editors, Co-Editors, Prep Managers, or admins */}
        {user && (profile?.is_admin || ((isEditorOrCoEditor || isManager) && profile?.linked_kingdom && goldKingdoms.has(profile.linked_kingdom))) && (
          <div style={{ ...cardStyle, marginBottom: '1.5rem' }}>
            <h3 style={{ color: colors.text, fontSize: '1rem', marginBottom: '0.75rem', fontWeight: 700 }}>📋 {t('prepScheduler.createSchedule', 'Create New Schedule')}</h3>
            <p style={{ color: colors.textMuted, fontSize: '0.75rem', marginBottom: '1rem', lineHeight: 1.5 }}>
              {t('prepScheduler.createScheduleDesc', 'Create a Prep Schedule for your Gold Tier kingdom. You\'ll get a shareable link for players to submit their availability and speedups.')}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <label style={labelStyle}>{t('prepScheduler.kingdomNumber', 'Kingdom Number')} *</label>
                <input type="number" value={createKingdom || ''} readOnly={!!profile?.linked_kingdom} style={{ ...inputStyle, ...(profile?.linked_kingdom ? { opacity: 0.7, cursor: 'not-allowed', backgroundColor: '#1a1a1a' } : {}) }} onChange={(e) => { if (!profile?.linked_kingdom) setCreateKingdom(parseInt(e.target.value) || 0); }} placeholder="e.g. 172" />
                {profile?.linked_kingdom && <p style={{ color: colors.textMuted, fontSize: '0.65rem', marginTop: '0.2rem' }}>{t('prepScheduler.autoFilled', 'Auto-filled from your linked kingdom.')}</p>}
                {createKingdom > 0 && !goldKingdoms.has(createKingdom) && (
                  <p style={{ color: colors.error, fontSize: '0.7rem', marginTop: '0.25rem' }}>⚠️ {t('prepScheduler.notGoldTier', 'Kingdom {{kingdom}} is not Gold Tier. Only Gold Tier kingdoms can use this tool.', { kingdom: createKingdom })}</p>
                )}
              </div>
              <div>
                <label style={labelStyle}>{t('prepScheduler.kvkNumber', 'KvK Number (optional)')}</label>
                <input type="number" value={createKvkNumber || ''} onChange={(e) => setCreateKvkNumber(parseInt(e.target.value) || 0)} placeholder="e.g. 11" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>{t('prepScheduler.notesForPlayers', 'Notes for Players (optional)')}</label>
                <textarea value={createNotes} onChange={(e) => setCreateNotes(e.target.value)} placeholder={t('prepScheduler.notesPlaceholder', 'Any instructions or reminders...')} rows={3} maxLength={500} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }} />
              </div>
              <div>
                <label style={labelStyle}>{t('prepScheduler.submissionDeadline', 'Submission Deadline (optional)')} <span style={{ color: colors.textMuted, fontWeight: 400 }}>(UTC{(() => { const o = -new Date().getTimezoneOffset(); const h = Math.floor(Math.abs(o) / 60); const m = Math.abs(o) % 60; return `${o >= 0 ? '+' : '-'}${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`; })()})</span></label>
                <input type="datetime-local" value={createDeadline} onChange={(e) => setCreateDeadline(e.target.value)} style={inputStyle} />
                {createDeadline && (() => { const d = new Date(createDeadline); return !isNaN(d.getTime()) ? (
                  <p style={{ color: '#a855f7', fontSize: '0.65rem', marginTop: '0.25rem', fontWeight: 600 }}>
                    → UTC: {d.toISOString().replace('T', ' ').slice(0, 16)} UTC
                  </p>
                ) : null; })()}
                <p style={{ color: colors.textMuted, fontSize: '0.65rem', marginTop: '0.2rem' }}>{t('prepScheduler.deadlineHint', 'Enter the deadline in your local time. It will be stored and displayed in UTC.')}</p>
              </div>
              <button onClick={createSchedule} disabled={saving || !createKingdom || !goldKingdoms.has(createKingdom)}
                style={{ padding: '0.6rem 1.25rem', backgroundColor: createKingdom && goldKingdoms.has(createKingdom) ? '#a855f720' : `${colors.textMuted}10`, border: `1px solid ${createKingdom && goldKingdoms.has(createKingdom) ? '#a855f750' : colors.border}`, borderRadius: '8px', color: createKingdom && goldKingdoms.has(createKingdom) ? '#a855f7' : colors.textMuted, fontSize: '0.85rem', fontWeight: 600, cursor: createKingdom && goldKingdoms.has(createKingdom) ? 'pointer' : 'not-allowed', width: 'fit-content', opacity: saving ? 0.6 : 1 }}>
                {saving ? t('prepScheduler.creating', 'Creating...') : `✨ ${t('prepScheduler.createScheduleBtn', 'Create Schedule')}`}
              </button>
            </div>
          </div>
        )}

        {/* My Schedules */}
        {mySchedules.length > 0 && (
          <div style={cardStyle}>
            <h3 style={{ color: colors.text, fontSize: '1rem', marginBottom: '0.75rem', fontWeight: 700 }}>📁 {t('prepScheduler.mySchedules', 'My Schedules')}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {mySchedules.map(s => (
                <div key={s.id} onClick={() => navigate(`/tools/prep-scheduler/${s.id}`)}
                  style={{ padding: '0.75rem', borderRadius: '8px', cursor: 'pointer', backgroundColor: colors.bg, border: `1px solid ${colors.borderSubtle}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ color: colors.text, fontWeight: 600, fontSize: '0.85rem' }}>{t('prepScheduler.kingdom', 'Kingdom')} {s.kingdom_number}</span>
                    {s.kvk_number && <span style={{ color: colors.textMuted, fontSize: '0.75rem', marginLeft: '0.5rem' }}>KvK #{s.kvk_number}</span>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ padding: '0.15rem 0.4rem', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 600, backgroundColor: s.status === 'active' ? `${colors.success}20` : `${colors.textMuted}20`, color: s.status === 'active' ? colors.success : colors.textMuted }}>{s.status}</span>
                    <span style={{ color: colors.textMuted, fontSize: '0.7rem' }}>→</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State — no schedules, no active kingdom schedules */}
        {mySchedules.length === 0 && kingdomSchedules.length === 0 && user && (
          <div style={{ ...cardStyle, marginTop: '1rem', textAlign: 'center', padding: isMobile ? '1.5rem 1rem' : '2rem' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📭</div>
            <h3 style={{ color: colors.text, fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.5rem' }}>
              {t('prepScheduler.noSchedulesYet', 'No Schedules Yet')}
            </h3>
            <p style={{ color: colors.textMuted, fontSize: '0.8rem', lineHeight: 1.6 }}>
              {profile?.linked_kingdom && goldKingdoms.has(profile.linked_kingdom)
                ? t('prepScheduler.noSchedulesGold', 'Create your first Prep Schedule above to coordinate Castle Appointments for your kingdom.')
                : t('prepScheduler.noSchedulesGeneral', 'When your kingdom has an active Prep Schedule, it will appear here. Ask your Prep Manager to share the form link with you.')}
            </p>
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
          <Link to="/tools" style={{ color: '#22d3ee', textDecoration: 'none', fontSize: '0.8rem' }}>← {t('prepScheduler.backToTools', 'Back to Tools')}</Link>
        </div>
      </div>
    </div>
  );
};

export default PrepSchedulerList;
