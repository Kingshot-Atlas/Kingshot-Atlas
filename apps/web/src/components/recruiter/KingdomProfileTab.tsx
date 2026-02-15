import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { supabase } from '../../lib/supabase';
import { colors } from '../../utils/styles';
import { moderateText } from '../../utils/contentModeration';
import { useToast } from '../Toast';
import type { EditorInfo, FundInfo } from './types';
import { LANGUAGE_OPTIONS, inputStyle } from './types';

const TIER_ORDER = ['standard', 'bronze', 'silver', 'gold'];

const KINGDOM_VIBE_OPTIONS = [
  { value: 'competitive', label: 'Competitive', emoji: '🏆' },
  { value: 'casual', label: 'Casual', emoji: '🌴' },
  { value: 'kvk_focused', label: 'KvK-focused', emoji: '⚔️' },
  { value: 'community_focused', label: 'Community-focused', emoji: '👥' },
  { value: 'social', label: 'Social', emoji: '💬' },
  { value: 'drama_free', label: 'Drama-free', emoji: '☮️' },
  { value: 'organized', label: 'Organized', emoji: '📋' },
  { value: 'beginner_friendly', label: 'Beginner-friendly', emoji: '🌱' },
];

const TIER_INFO = [
  { tier: 'Standard', cost: '$0', color: colors.textMuted, features: ['Basic listing with Atlas Score & stats', 'Community reviews from players'] },
  { tier: 'Bronze', cost: '$25+', color: colors.bronze, features: ['Min TC & Power requirements shown', 'Browse transferee profiles', 'Kingdom Policies & Vibe tags'] },
  { tier: 'Silver', cost: '$50+', color: colors.textSecondary, features: ['Everything in Bronze', 'Send invites to transferees', 'Kingdom Bio & Language display', 'Alliance Information schedule'] },
  { tier: 'Gold', cost: '$100+', color: colors.gold, features: ['Everything in Silver', '+2 alliance slots (5 total)', 'Gilded badge for all kingdom users', 'Priority placement in searches'] },
];

// =============================================
// PROFILE FIELD WRAPPER
// =============================================

const ProfileField: React.FC<{
  label: string;
  tierRequired: string;
  currentTier: string;
  children: React.ReactNode;
}> = ({ label, tierRequired, currentTier, children }) => {
  const currentIdx = TIER_ORDER.indexOf(currentTier);
  const requiredIdx = TIER_ORDER.indexOf(tierRequired);
  const locked = currentIdx < requiredIdx;

  return (
    <div style={{
      backgroundColor: '#111111',
      borderRadius: '10px',
      border: `1px solid ${locked ? '#1a1a1a' : '#2a2a2a'}`,
      padding: '0.75rem',
      opacity: locked ? 0.5 : 1,
      position: 'relative',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
        <span style={{ color: '#9ca3af', fontSize: '0.75rem', fontWeight: '600' }}>{label}</span>
        {locked && (
          <span style={{
            padding: '0.1rem 0.3rem',
            backgroundColor: '#f59e0b15',
            border: '1px solid #f59e0b30',
            borderRadius: '4px',
            fontSize: '0.55rem',
            color: '#f59e0b',
            fontWeight: 'bold',
            textTransform: 'uppercase',
          }}>
            {tierRequired}+ Required
          </span>
        )}
      </div>
      {locked ? (
        <p style={{ color: '#4b5563', fontSize: '0.7rem', margin: 0 }}>
          Upgrade to {tierRequired} tier to unlock this feature.
        </p>
      ) : children}
    </div>
  );
};

// =============================================
// KINGDOM PROFILE TAB
// =============================================

interface KingdomProfileTabProps {
  fund: FundInfo | null;
  editorInfo: EditorInfo | null;
  onFundUpdate: (updatedFund: FundInfo) => void;
}

const KingdomProfileTab: React.FC<KingdomProfileTabProps> = ({ fund, editorInfo, onFundUpdate }) => {
  const isMobile = useIsMobile();
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [profileDraft, setProfileDraft] = useState<Partial<FundInfo>>({});
  const [savingProfile, setSavingProfile] = useState(false);
  const [statusHistory, setStatusHistory] = useState<Array<{ id: string; old_status: string; new_status: string; submitted_at: string; status: string; submitted_by: string; submitter_name?: string }>>([]);
  const [loadingStatusHistory, setLoadingStatusHistory] = useState(false);

  // Auto-load status history on mount
  useEffect(() => {
    if (editorInfo && statusHistory.length === 0) {
      loadStatusHistory();
    }
  }, [editorInfo]);

  const loadStatusHistory = async () => {
    if (!supabase || !editorInfo) return;
    setLoadingStatusHistory(true);
    try {
      const { data } = await supabase
        .from('status_submissions')
        .select('id, old_status, new_status, submitted_at, status, submitted_by')
        .eq('kingdom_number', editorInfo.kingdom_number)
        .order('submitted_at', { ascending: false })
        .limit(15);

      if (data && data.length > 0) {
        const userIds = [...new Set(data.map(d => d.submitted_by).filter(Boolean))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, linked_username, username')
          .in('id', userIds);
        const profileMap = new Map(profiles?.map(p => [p.id, p.linked_username || p.username || 'Unknown']) || []);
        setStatusHistory(data.map(d => ({ ...d, submitter_name: profileMap.get(d.submitted_by) || 'Unknown' })));
      } else {
        setStatusHistory([]);
      }
    } catch {
      // silent
    } finally {
      setLoadingStatusHistory(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!supabase || !fund || !editorInfo || Object.keys(profileDraft).length === 0) return;

    // Content moderation check on text fields
    const textFields: (keyof FundInfo)[] = ['recruitment_pitch', 'what_we_offer', 'what_we_want'];
    for (const field of textFields) {
      const value = profileDraft[field];
      if (typeof value === 'string' && value.trim()) {
        const result = moderateText(value);
        if (!result.isClean) {
          showToast(result.reason || 'Content contains inappropriate language.', 'error');
          return;
        }
      }
    }

    setSavingProfile(true);
    try {
      const updatePayload = { ...profileDraft, updated_at: new Date().toISOString() };
      const { error } = await supabase
        .from('kingdom_funds')
        .update(updatePayload)
        .eq('kingdom_number', editorInfo.kingdom_number);

      if (error) {
        showToast('Failed to save profile: ' + error.message, 'error');
      } else {
        onFundUpdate({ ...fund, ...updatePayload } as FundInfo);
        setProfileDraft({});
        showToast('Kingdom profile updated!', 'success');
      }
    } catch {
      showToast('Failed to save profile.', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  if (!fund) {
    return (
      <div style={{
        textAlign: 'center', padding: '2rem 1rem',
        backgroundColor: '#111111', borderRadius: '12px',
        border: '1px solid #2a2a2a',
      }}>
        <p style={{ color: '#fff', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
          {t('recruiter.startFundToEdit', 'Start a Kingdom Fund to edit your listing profile')}
        </p>
        <p style={{ color: '#6b7280', fontSize: '0.8rem' }}>
          {t('recruiter.contributeToUnlock', 'Contribute to your kingdom fund to unlock tier features and customize your listing.')}
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {/* Tier Info */}
      <div style={{
        backgroundColor: '#111111', borderRadius: '10px',
        border: '1px solid #2a2a2a', padding: '0.75rem',
      }}>
        <span style={{ color: '#9ca3af', fontSize: '0.7rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('recruiter.fundTierBenefits', 'Fund Tier Benefits')}</span>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: '0.5rem', marginTop: '0.5rem' }}>
          {TIER_INFO.map((t) => {
            const isCurrentTier = t.tier.toLowerCase() === fund.tier;
            return (
              <div key={t.tier} style={{
                padding: '0.5rem 0.6rem',
                borderRadius: '8px',
                border: isCurrentTier ? `1px solid ${t.color}50` : '1px solid #1a1a1a',
                backgroundColor: isCurrentTier ? `${t.color}08` : '#0a0a0a',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ color: t.color, fontWeight: 'bold', fontSize: '0.8rem' }}>{t.tier}</span>
                  <span style={{ color: '#6b7280', fontSize: '0.65rem' }}>{t.cost}</span>
                </div>
                <div style={{ marginTop: '0.25rem' }}>
                  {t.features.map((f) => (
                    <div key={f} style={{ color: '#9ca3af', fontSize: '0.65rem', lineHeight: 1.5 }}>• {f}</div>
                  ))}
                </div>
                {isCurrentTier && (
                  <span style={{ display: 'inline-block', marginTop: '0.3rem', padding: '0.1rem 0.3rem', backgroundColor: `${t.color}20`, borderRadius: '3px', fontSize: '0.55rem', color: t.color, fontWeight: 'bold' }}>CURRENT</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Kingdom Vibe (Bronze+) — pick up to 3 */}
      <ProfileField label="Kingdom Vibe (pick up to 3)" tierRequired="bronze" currentTier={fund.tier}>
        <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
          {KINGDOM_VIBE_OPTIONS.map((opt) => {
            const currentVibe = profileDraft.kingdom_vibe ?? fund.kingdom_vibe ?? [];
            const selected = currentVibe.includes(opt.value);
            return (
              <button key={opt.value} onClick={() => {
                if (selected) {
                  setProfileDraft(d => ({ ...d, kingdom_vibe: currentVibe.filter(v => v !== opt.value) }));
                } else if (currentVibe.length < 3) {
                  setProfileDraft(d => ({ ...d, kingdom_vibe: [...currentVibe, opt.value] }));
                }
              }} style={{
                padding: '0.25rem 0.5rem', borderRadius: '12px', fontSize: '0.7rem', cursor: currentVibe.length >= 3 && !selected ? 'not-allowed' : 'pointer',
                backgroundColor: selected ? '#22d3ee15' : '#0a0a0a',
                border: `1px solid ${selected ? '#22d3ee40' : '#2a2a2a'}`,
                color: selected ? '#22d3ee' : '#6b7280',
                opacity: currentVibe.length >= 3 && !selected ? 0.4 : 1,
                minHeight: '36px',
              }}>
                {opt.emoji} {opt.label}
              </button>
            );
          })}
        </div>
      </ProfileField>

      {/* NAP / Sanctuary / Castle (Bronze+) */}
      <ProfileField label="Kingdom Policies" tierRequired="bronze" currentTier={fund.tier}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {([
            { key: 'nap_policy' as const, label: 'NAP (Non-Aggression Pact)', desc: 'Kingdom enforces NAP agreements' },
            { key: 'sanctuary_distribution' as const, label: 'Sanctuary Distribution', desc: 'Sanctuaries are distributed fairly' },
            { key: 'castle_rotation' as const, label: 'Castle Rotation', desc: 'King role is rotated between more than 1 alliance' },
          ]).map(({ key, label, desc }) => {
            const val = profileDraft[key] ?? fund[key];
            return (
              <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                <div>
                  <div style={{ color: '#d1d5db', fontSize: '0.75rem', fontWeight: '500' }}>{label}</div>
                  <div style={{ color: '#6b7280', fontSize: '0.6rem' }}>{desc}</div>
                </div>
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  {[
                    { v: true, label: '✓', color: '#22c55e' },
                    { v: false, label: '✗', color: '#ef4444' },
                    { v: null, label: '—', color: '#6b7280' },
                  ].map((opt) => (
                    <button key={String(opt.v)} onClick={() => setProfileDraft(d => ({ ...d, [key]: opt.v }))} style={{
                      width: '32px', height: '32px', borderRadius: '6px',
                      backgroundColor: val === opt.v ? `${opt.color}15` : '#0a0a0a',
                      border: `1px solid ${val === opt.v ? `${opt.color}40` : '#2a2a2a'}`,
                      color: opt.color, fontSize: '0.8rem', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </ProfileField>

      {/* Min Requirements (Bronze+) */}
      <ProfileField label="Minimum Requirements" tierRequired="bronze" currentTier={fund.tier}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
          <div>
            <span style={{ color: '#6b7280', fontSize: '0.65rem' }}>{t('recruiter.minTCLevel', 'Min TC Level')}</span>
            <select
              value={profileDraft.min_tc_level ?? fund.min_tc_level ?? ''}
              onChange={(e) => setProfileDraft(d => ({ ...d, min_tc_level: e.target.value ? parseInt(e.target.value) : null }))}
              style={inputStyle}
            >
              <option value="">None</option>
              {Array.from({ length: 30 }, (_, i) => i + 1).map((lvl) => (
                <option key={lvl} value={lvl}>TC {lvl}</option>
              ))}
              {[
                { label: 'TG1 (TC 35)', value: 35 },
                { label: 'TG2 (TC 40)', value: 40 },
                { label: 'TG3 (TC 45)', value: 45 },
                { label: 'TG4 (TC 50)', value: 50 },
                { label: 'TG5 (TC 55)', value: 55 },
                { label: 'TG6 (TC 60)', value: 60 },
                { label: 'TG7 (TC 65)', value: 65 },
                { label: 'TG8 (TC 70)', value: 70 },
              ].map((tg) => (
                <option key={tg.value} value={tg.value}>{tg.label}</option>
              ))}
            </select>
          </div>
          <div>
            <span style={{ color: '#6b7280', fontSize: '0.65rem' }}>{t('recruiter.minPowerMillions', 'Min Power (in Millions)')}</span>
            <input
              type="number"
              min={0}
              max={99999}
              step={1}
              value={profileDraft.min_power_million ?? fund.min_power_million ?? ''}
              onChange={(e) => {
                const val = e.target.value;
                if (val === '') {
                  setProfileDraft(d => ({ ...d, min_power_million: null }));
                } else {
                  const num = Math.floor(Math.abs(parseInt(val) || 0));
                  if (num <= 99999) {
                    setProfileDraft(d => ({ ...d, min_power_million: num }));
                  }
                }
              }}
              placeholder="e.g. 100 = 100M"
              style={inputStyle}
            />
            {(profileDraft.min_power_million ?? fund.min_power_million) != null && (
              <span style={{ color: colors.textSecondary, fontSize: '0.6rem', marginTop: '0.25rem', display: 'block' }}>
                = {profileDraft.min_power_million ?? fund.min_power_million}M power
              </span>
            )}
          </div>
        </div>
      </ProfileField>

      {/* Kingdom Bio (Silver+) */}
      <ProfileField label="Kingdom Bio" tierRequired="silver" currentTier={fund.tier}>
        <textarea
          value={profileDraft.recruitment_pitch ?? fund.recruitment_pitch ?? ''}
          onChange={(e) => setProfileDraft(d => ({ ...d, recruitment_pitch: e.target.value.slice(0, 150) || null }))}
          maxLength={150}
          rows={3}
          placeholder="Sell your kingdom in a sentence or two..."
          style={{ ...inputStyle, resize: 'vertical', minHeight: '70px' }}
        />
        <span style={{ color: (profileDraft.recruitment_pitch ?? fund.recruitment_pitch ?? '').length > 140 ? '#ef4444' : '#4b5563', fontSize: '0.6rem' }}>
          {(profileDraft.recruitment_pitch ?? fund.recruitment_pitch ?? '').length}/150
        </span>
      </ProfileField>

      {/* Languages (Silver+) */}
      <ProfileField label="Languages" tierRequired="silver" currentTier={fund.tier}>
        <div style={{ marginBottom: '0.4rem' }}>
          <span style={{ color: '#6b7280', fontSize: '0.65rem' }}>{t('recruiter.mainLanguage', 'Main Language')}</span>
          <select
            value={profileDraft.main_language ?? fund.main_language ?? ''}
            onChange={(e) => setProfileDraft(d => ({ ...d, main_language: e.target.value || null }))}
            style={inputStyle}
          >
            <option value="">Select language...</option>
            {LANGUAGE_OPTIONS.map((lang) => (
              <option key={lang} value={lang}>{lang}</option>
            ))}
          </select>
        </div>
        <div>
          <span style={{ color: '#6b7280', fontSize: '0.65rem' }}>{t('recruiter.secondaryLanguage', 'Secondary Language')}</span>
          <select
            value={(profileDraft.secondary_languages ?? fund.secondary_languages ?? [])[0] || ''}
            onChange={(e) => setProfileDraft(d => ({ ...d, secondary_languages: e.target.value ? [e.target.value] : [] }))}
            style={inputStyle}
          >
            <option value="">None</option>
            {LANGUAGE_OPTIONS.filter(l => l !== (profileDraft.main_language ?? fund.main_language)).map((lang) => (
              <option key={lang} value={lang}>{lang}</option>
            ))}
          </select>
        </div>
      </ProfileField>

      {/* Alliance Details (Silver+) — language, secondary language, open spots per alliance */}
      <ProfileField label="Alliance Details" tierRequired="silver" currentTier={fund.tier}>
        <div style={{ fontSize: '0.65rem', color: '#6b7280', marginBottom: '0.4rem' }}>
          Set language, secondary language, and open spots for each alliance. Visible on your listing.
        </div>
        {(() => {
          const events = profileDraft.alliance_events ?? fund.alliance_events ?? { alliances: [], schedule: {} };
          const alliances = events.alliances || [];
          const allianceDetails = profileDraft.alliance_details ?? fund.alliance_details ?? {};

          if (alliances.length === 0) {
            return (
              <div style={{ color: '#4b5563', fontSize: '0.7rem', fontStyle: 'italic', textAlign: 'center', padding: '0.5rem' }}>
                Add alliances in Alliance Information below first
              </div>
            );
          }

          type AllianceDetail = { language?: string; secondary_language?: string; spots?: number };
          const updateDetail = (key: string, field: keyof AllianceDetail, value: string | number | undefined) => {
            const updated = { ...allianceDetails as Record<string, AllianceDetail> };
            const current = updated[key] || {};
            updated[key] = { ...current, [field]: value };
            setProfileDraft(d => ({ ...d, alliance_details: updated }));
          };

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {alliances.map((tag: string, idx: number) => {
                const key = tag || `alliance_${idx}`;
                const detail = (allianceDetails as Record<string, AllianceDetail>)[key] || {};
                return (
                  <div key={idx} style={{
                    padding: '0.5rem',
                    backgroundColor: '#0a0a0a',
                    border: '1px solid #2a2a2a',
                    borderRadius: '6px',
                  }}>
                    <div style={{ color: '#22d3ee', fontSize: '0.7rem', fontWeight: '600', marginBottom: '0.3rem' }}>
                      [{tag || `Alliance ${idx + 1}`}]
                    </div>
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: '100px' }}>
                        <span style={{ color: '#6b7280', fontSize: '0.6rem' }}>Main Language</span>
                        <select
                          value={detail.language || ''}
                          onChange={(e) => updateDetail(key, 'language', e.target.value || undefined)}
                          style={inputStyle}
                        >
                          <option value="">Select...</option>
                          {LANGUAGE_OPTIONS.map(lang => (
                            <option key={lang} value={lang}>{lang}</option>
                          ))}
                        </select>
                      </div>
                      <div style={{ flex: 1, minWidth: '100px' }}>
                        <span style={{ color: '#6b7280', fontSize: '0.6rem' }}>Secondary Language</span>
                        <select
                          value={detail.secondary_language || ''}
                          onChange={(e) => updateDetail(key, 'secondary_language', e.target.value || undefined)}
                          style={inputStyle}
                        >
                          <option value="">None</option>
                          {LANGUAGE_OPTIONS.filter(l => l !== detail.language).map(lang => (
                            <option key={lang} value={lang}>{lang}</option>
                          ))}
                        </select>
                      </div>
                      {fund.tier === 'gold' && (
                        <div style={{ width: '90px' }}>
                          <span style={{ color: '#6b7280', fontSize: '0.6rem' }}>Open Spots</span>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={detail.spots ?? ''}
                            onChange={(e) => {
                              const val = Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
                              updateDetail(key, 'spots', val);
                            }}
                            placeholder="0-100"
                            style={inputStyle}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </ProfileField>

      {/* Alliance Information (Silver+) — table format */}
      <ProfileField label="Alliance Information (UTC)" tierRequired="silver" currentTier={fund.tier}>
        {(() => {
          const EVENT_TYPES = [
            { key: 'bear_hunt', label: 'Bear Hunt', slots: 2 },
            { key: 'viking_vengeance', label: 'Viking Vengeance', slots: 1 },
            { key: 'swordland_showdown', label: 'Swordland Showdown', slots: 2 },
            { key: 'tri_alliance_clash', label: 'Tri-Alliance Clash', slots: 2 },
          ];
          const UTC_TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
            const h = Math.floor(i / 2).toString().padStart(2, '0');
            const m = i % 2 === 0 ? '00' : '30';
            return `${h}:${m}`;
          });
          const defaultData = { alliances: [] as string[], schedule: {} as Record<string, string[][]> };
          const current = profileDraft.alliance_events ?? fund.alliance_events ?? defaultData;
          const alliances = current.alliances || [];
          const schedule = current.schedule || {};

          const updateData = (newAlliances: string[], newSchedule: Record<string, string[][]>) => {
            setProfileDraft(d => ({ ...d, alliance_events: { alliances: newAlliances, schedule: newSchedule } }));
          };

          const maxAlliances = fund.tier === 'gold' ? 5 : 3;
          const addAlliance = () => {
            if (alliances.length >= maxAlliances) return;
            const newAlliances = [...alliances, ''];
            const newSchedule = { ...schedule };
            EVENT_TYPES.forEach(et => {
              const existing = newSchedule[et.key] || [];
              newSchedule[et.key] = [...existing, Array(et.slots).fill('')];
            });
            updateData(newAlliances, newSchedule);
          };

          const removeAlliance = (idx: number) => {
            const newAlliances = alliances.filter((_, i) => i !== idx);
            const newSchedule = { ...schedule };
            EVENT_TYPES.forEach(et => {
              const existing = newSchedule[et.key] || [];
              newSchedule[et.key] = existing.filter((_, i) => i !== idx);
            });
            updateData(newAlliances, newSchedule);
          };

          const updateAllianceTag = (idx: number, val: string) => {
            const newAlliances = alliances.map((a, i) => i === idx ? val.toUpperCase() : a);
            updateData(newAlliances, schedule);
          };

          const updateTimeSlot = (eventKey: string, allianceIdx: number, slotIdx: number, val: string) => {
            const newSchedule = { ...schedule };
            const eventSlots = [...(newSchedule[eventKey] || [])];
            const allianceSlots = [...(eventSlots[allianceIdx] || [])];
            allianceSlots[slotIdx] = val;
            eventSlots[allianceIdx] = allianceSlots;
            newSchedule[eventKey] = eventSlots;
            updateData(alliances, newSchedule);
          };

          return (
            <div>
              {/* Alliance tag inputs */}
              <div style={{ display: 'flex', gap: '0.3rem', marginBottom: '0.4rem', alignItems: 'flex-end' }}>
                {alliances.map((tag, idx) => (
                  <div key={idx} style={{ flex: 1 }}>
                    <span style={{ color: '#6b7280', fontSize: '0.6rem' }}>Alliance {idx + 1}</span>
                    <div style={{ display: 'flex', gap: '0.2rem' }}>
                      {idx > 0 && (
                        <button onClick={() => {
                          const newAlliances = [...alliances];
                          const tmpA = newAlliances[idx]!;
                          newAlliances[idx] = newAlliances[idx - 1]!;
                          newAlliances[idx - 1] = tmpA;
                          const newSchedule = { ...schedule };
                          EVENT_TYPES.forEach(et => {
                            const arr = [...(newSchedule[et.key] || [])];
                            if (arr[idx] !== undefined && arr[idx - 1] !== undefined) {
                              const tmpS = arr[idx]!;
                              arr[idx] = arr[idx - 1]!;
                              arr[idx - 1] = tmpS;
                            }
                            newSchedule[et.key] = arr;
                          });
                          updateData(newAlliances, newSchedule);
                        }} style={{
                          padding: '0.2rem 0.3rem', backgroundColor: '#22d3ee08', border: '1px solid #22d3ee20',
                          borderRadius: '4px', color: '#22d3ee', fontSize: '0.55rem', cursor: 'pointer', minHeight: '32px',
                        }} title="Move left">◀</button>
                      )}
                      <input
                        type="text"
                        value={tag}
                        maxLength={6}
                        onChange={(e) => updateAllianceTag(idx, e.target.value)}
                        placeholder={`Tag ${idx + 1}`}
                        style={{ ...inputStyle, flex: 1 }}
                      />
                      {idx < alliances.length - 1 && (
                        <button onClick={() => {
                          const newAlliances = [...alliances];
                          const tmpA = newAlliances[idx]!;
                          newAlliances[idx] = newAlliances[idx + 1]!;
                          newAlliances[idx + 1] = tmpA;
                          const newSchedule = { ...schedule };
                          EVENT_TYPES.forEach(et => {
                            const arr = [...(newSchedule[et.key] || [])];
                            if (arr[idx] !== undefined && arr[idx + 1] !== undefined) {
                              const tmpS = arr[idx]!;
                              arr[idx] = arr[idx + 1]!;
                              arr[idx + 1] = tmpS;
                            }
                            newSchedule[et.key] = arr;
                          });
                          updateData(newAlliances, newSchedule);
                        }} style={{
                          padding: '0.2rem 0.3rem', backgroundColor: '#22d3ee08', border: '1px solid #22d3ee20',
                          borderRadius: '4px', color: '#22d3ee', fontSize: '0.55rem', cursor: 'pointer', minHeight: '32px',
                        }} title="Move right">▶</button>
                      )}
                      <button onClick={() => removeAlliance(idx)} style={{
                        padding: '0.2rem 0.4rem', backgroundColor: '#ef444410', border: '1px solid #ef444425',
                        borderRadius: '4px', color: '#ef4444', fontSize: '0.6rem', cursor: 'pointer', minHeight: '32px',
                      }}>✕</button>
                    </div>
                  </div>
                ))}
                {alliances.length < maxAlliances && (
                  <button onClick={addAlliance} style={{
                    padding: '0.3rem 0.5rem', backgroundColor: '#22d3ee10', border: '1px solid #22d3ee25',
                    borderRadius: '6px', color: '#22d3ee', fontSize: '0.65rem', cursor: 'pointer', minHeight: '36px', whiteSpace: 'nowrap',
                  }}>+ Alliance {fund.tier === 'gold' && alliances.length >= 3 ? '(Gold)' : ''}</button>
                )}
              </div>

              {/* Time slots table */}
              {alliances.length > 0 && (
                <div style={{ border: '1px solid #2a2a2a', borderRadius: '6px', overflow: 'hidden' }}>
                  {/* Header */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: `120px ${alliances.map(() => '1fr').join(' ')}`,
                    backgroundColor: '#0f0f0f',
                    borderBottom: '1px solid #2a2a2a',
                  }}>
                    <div style={{ padding: '0.3rem 0.4rem', fontSize: '0.6rem', color: '#6b7280', fontWeight: '600' }}>Event</div>
                    {alliances.map((tag, i) => (
                      <div key={i} style={{
                        padding: '0.3rem 0.3rem', fontSize: '0.6rem', color: '#22d3ee', fontWeight: '700', textAlign: 'center',
                        borderLeft: '1px solid #2a2a2a',
                      }}>{tag || `Alliance ${i + 1}`}</div>
                    ))}
                  </div>
                  {/* Rows */}
                  {EVENT_TYPES.map((et, rowIdx) => (
                    <div key={et.key} style={{
                      display: 'grid',
                      gridTemplateColumns: `120px ${alliances.map(() => '1fr').join(' ')}`,
                      borderBottom: rowIdx < EVENT_TYPES.length - 1 ? '1px solid #2a2a2a' : 'none',
                    }}>
                      <div style={{
                        padding: '0.35rem 0.4rem', fontSize: '0.6rem', color: '#9ca3af', fontWeight: '500',
                        display: 'flex', alignItems: 'center',
                      }}>
                        {et.label}
                        <span style={{ color: '#4b5563', fontSize: '0.5rem', marginLeft: '0.2rem' }}>({et.slots === 1 ? '1 slot' : '2 slots'})</span>
                      </div>
                      {alliances.map((_, aIdx) => {
                        const slots = schedule[et.key]?.[aIdx] || Array(et.slots).fill('');
                        return (
                          <div key={aIdx} style={{
                            padding: '0.2rem 0.25rem',
                            borderLeft: '1px solid #2a2a2a',
                            display: 'flex', flexDirection: 'column', gap: '0.15rem',
                          }}>
                            {Array.from({ length: et.slots }).map((_, sIdx) => (
                              <select
                                key={sIdx}
                                value={slots[sIdx] || ''}
                                onChange={(e) => updateTimeSlot(et.key, aIdx, sIdx, e.target.value)}
                                style={{ ...inputStyle, fontSize: '0.65rem', padding: '0.2rem 0.3rem' }}
                              >
                                <option value="">--:--</option>
                                {UTC_TIME_OPTIONS.map(t => (
                                  <option key={t} value={t}>{t}</option>
                                ))}
                              </select>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}

              {alliances.length === 0 && (
                <div style={{ color: '#6b7280', fontSize: '0.7rem', fontStyle: 'italic', textAlign: 'center', padding: '0.5rem' }}>
                  Add an alliance to set event times
                </div>
              )}
            </div>
          );
        })()}
      </ProfileField>

      {/* Save Button */}
      <button
        onClick={handleSaveProfile}
        disabled={savingProfile || Object.keys(profileDraft).length === 0}
        style={{
          padding: '0.6rem 1.5rem',
          backgroundColor: Object.keys(profileDraft).length === 0 ? '#1a1a1a' : '#22c55e15',
          border: `1px solid ${Object.keys(profileDraft).length === 0 ? '#2a2a2a' : '#22c55e40'}`,
          borderRadius: '10px',
          color: Object.keys(profileDraft).length === 0 ? '#4b5563' : '#22c55e',
          fontWeight: '600',
          fontSize: '0.85rem',
          cursor: Object.keys(profileDraft).length === 0 ? 'default' : 'pointer',
          minHeight: '44px',
          width: '100%',
          opacity: savingProfile ? 0.6 : 1,
        }}
      >
        {savingProfile ? t('recruiter.saving', 'Saving...') : Object.keys(profileDraft).length === 0 ? t('recruiter.noChanges', 'No Changes') : t('recruiter.saveProfileChanges', 'Save Profile Changes')}
      </button>

      {/* Transfer Status Change History */}
      <div style={{
        backgroundColor: '#111111', borderRadius: '10px',
        border: '1px solid #2a2a2a', padding: '0.75rem',
        marginTop: '0.5rem',
      }}>
        <span style={{ color: '#9ca3af', fontSize: '0.7rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {t('recruiter.statusHistory', 'Transfer Status History')}
        </span>
        {loadingStatusHistory ? (
          <div style={{ color: '#6b7280', fontSize: '0.75rem', padding: '0.75rem 0', textAlign: 'center' }}>Loading...</div>
        ) : statusHistory.length === 0 ? (
          <div style={{ color: '#4b5563', fontSize: '0.7rem', padding: '0.75rem 0', textAlign: 'center', fontStyle: 'italic' }}>
            {t('recruiter.noStatusChanges', 'No status changes yet')}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.5rem' }}>
            {statusHistory.map((entry) => {
              const isApproved = entry.status === 'approved';
              const isPending = entry.status === 'pending';
              const isRejected = entry.status === 'rejected';
              return (
                <div key={entry.id} style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.4rem 0.5rem', borderRadius: '6px',
                  backgroundColor: '#0a0a0a', border: '1px solid #1a1a1a',
                  fontSize: '0.7rem',
                }}>
                  <span style={{ color: isApproved ? '#22c55e' : isPending ? '#eab308' : '#ef4444', fontSize: '0.75rem', flexShrink: 0 }}>
                    {isApproved ? '✓' : isPending ? '⏳' : '✕'}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ color: '#9ca3af' }}>{entry.old_status || 'Unannounced'}</span>
                    <span style={{ color: '#4b5563', margin: '0 0.25rem' }}>→</span>
                    <span style={{ color: '#e5e7eb', fontWeight: '500' }}>{entry.new_status}</span>
                    <span style={{ color: '#4b5563', marginLeft: '0.4rem' }}>
                      by {entry.submitter_name}
                    </span>
                  </div>
                  <span style={{ color: '#4b5563', fontSize: '0.6rem', flexShrink: 0, whiteSpace: 'nowrap' }}>
                    {new Date(entry.submitted_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>
                  {isRejected && <span style={{ color: '#ef4444', fontSize: '0.55rem', padding: '0.1rem 0.25rem', border: '1px solid #ef444430', borderRadius: '3px' }}>Rejected</span>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default KingdomProfileTab;
