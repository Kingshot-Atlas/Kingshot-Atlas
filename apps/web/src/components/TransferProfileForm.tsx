import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useIsMobile } from '../hooks/useMediaQuery';
import { supabase } from '../lib/supabase';
import { neonGlow, FONT_DISPLAY, colors } from '../utils/styles';

// =============================================
// TYPES
// =============================================

interface TransferProfileData {
  username: string;
  current_kingdom: number;
  tc_level: number;
  power_range: string;
  main_language: string;
  secondary_languages: string[];
  play_schedule: Array<{ start: string; end: string }>;
  kvk_participation: string;
  looking_for: string[];
  group_size: string;
  player_bio: string;
  contact_method: string;
  contact_info: string;
}

interface ExistingProfile extends TransferProfileData {
  id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// =============================================
// CONSTANTS
// =============================================

const POWER_RANGE_OPTIONS = [
  '0 - 50M', '50 - 100M', '100 - 150M', '150 - 200M', '200 - 250M', '250 - 300M', '300 - 500M', '500 - 750M', '750 - 1,000M', '1,000M+',
];

const LANGUAGE_OPTIONS = [
  'English', 'Spanish', 'Portuguese', 'Arabic', 'Turkish', 'French', 'German',
  'Russian', 'Chinese', 'Japanese', 'Korean', 'Indonesian', 'Thai', 'Vietnamese', 'Other',
];

const KVK_PARTICIPATION_OPTIONS = [
  { value: 'every', label: 'Every KvK' },
  { value: 'most', label: 'Most KvKs' },
  { value: 'sometimes', label: 'Sometimes' },
  { value: 'rarely', label: 'Rarely' },
];

const LOOKING_FOR_OPTIONS = [
  { value: 'active_kvk', label: 'Active KvK' },
  { value: 'competitive', label: 'Competitive' },
  { value: 'alliance_events', label: 'Alliance Events' },
  { value: 'growth', label: 'Growing Kingdom' },
  { value: 'established', label: 'Established Kingdom' },
  { value: 'social', label: 'Social Community' },
  { value: 'war_focused', label: 'War Focused' },
  { value: 'farm_friendly', label: 'Farm Friendly' },
];

const GROUP_SIZE_OPTIONS = [
  { value: 'solo', label: 'Solo' },
  { value: '2-5', label: '2-5 Players' },
  { value: '6-10', label: '6-10 Players' },
  { value: '10+', label: '10+ Players' },
];

const UTC_HOURS = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}:00`);

// =============================================
// COMPONENT
// =============================================

const TransferProfileForm: React.FC<{
  onClose: () => void;
  onSaved: () => void;
}> = ({ onClose, onSaved }) => {
  const { user, profile } = useAuth();
  const isMobile = useIsMobile();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [existingProfile, setExistingProfile] = useState<ExistingProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState<TransferProfileData>({
    username: '',
    current_kingdom: 0,
    tc_level: 0,
    power_range: '',
    main_language: 'English',
    secondary_languages: [],
    play_schedule: [{ start: '10:00', end: '18:00' }],
    kvk_participation: 'most',
    looking_for: [],
    group_size: 'solo',
    player_bio: '',
    contact_method: 'discord',
    contact_info: '',
  });

  // Auto-fill from linked account
  useEffect(() => {
    if (profile) {
      setFormData((prev) => ({
        ...prev,
        username: profile.linked_username || profile.username || '',
        current_kingdom: profile.linked_kingdom || 0,
        tc_level: profile.linked_tc_level || 0,
        main_language: profile.language || 'English',
      }));
    }
  }, [profile]);

  // Load existing profile
  useEffect(() => {
    const loadExisting = async () => {
      if (!supabase || !user) {
        setLoading(false);
        return;
      }
      try {
        const { data, error: fetchError } = await supabase
          .from('transfer_profiles')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (data && !fetchError) {
          setExistingProfile(data as ExistingProfile);
          setFormData({
            username: data.username,
            current_kingdom: data.current_kingdom,
            tc_level: data.tc_level,
            power_range: data.power_range,
            main_language: data.main_language,
            secondary_languages: data.secondary_languages || [],
            play_schedule: data.play_schedule || [{ start: '10:00', end: '18:00' }],
            kvk_participation: data.kvk_participation,
            looking_for: data.looking_for || [],
            group_size: data.group_size,
            player_bio: data.player_bio,
            contact_method: data.contact_method,
            contact_info: data.contact_info,
          });
        }
      } catch {
        // No existing profile — that's fine
      } finally {
        setLoading(false);
      }
    };
    loadExisting();
  }, [user]);

  const updateField = <K extends keyof TransferProfileData>(key: K, value: TransferProfileData[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const toggleLookingFor = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      looking_for: prev.looking_for.includes(value)
        ? prev.looking_for.filter((v) => v !== value)
        : prev.looking_for.length < 8 ? [...prev.looking_for, value] : prev.looking_for,
    }));
  };

  const toggleSecondaryLanguage = (lang: string) => {
    if (lang === formData.main_language) return;
    setFormData((prev) => ({
      ...prev,
      secondary_languages: prev.secondary_languages.includes(lang)
        ? prev.secondary_languages.filter((l) => l !== lang)
        : prev.secondary_languages.length < 3 ? [...prev.secondary_languages, lang] : prev.secondary_languages,
    }));
  };

  const addTimeRange = () => {
    if (formData.play_schedule.length < 3) {
      setFormData((prev) => ({
        ...prev,
        play_schedule: [...prev.play_schedule, { start: '00:00', end: '08:00' }],
      }));
    }
  };

  const removeTimeRange = (index: number) => {
    if (formData.play_schedule.length > 1) {
      setFormData((prev) => ({
        ...prev,
        play_schedule: prev.play_schedule.filter((_, idx) => idx !== index),
      }));
    }
  };

  const updateTimeRange = (index: number, field: 'start' | 'end', value: string) => {
    setFormData((prev) => ({
      ...prev,
      play_schedule: prev.play_schedule.map((range, idx) =>
        idx === index ? { ...range, [field]: value } : range
      ),
    }));
  };

  // Validation
  const validate = (): string | null => {
    if (!formData.username.trim()) return 'Username is required';
    if (!formData.current_kingdom || formData.current_kingdom <= 0) return 'Current kingdom is required';
    if (!formData.tc_level || formData.tc_level < 1) return 'TC level is required';
    if (!formData.power_range) return 'Power range is required';
    if (!formData.main_language) return 'Main language is required';
    if (formData.play_schedule.length === 0) return 'At least one play schedule is required';
    if (!formData.kvk_participation) return 'KvK participation is required';
    if (formData.looking_for.length === 0) return 'Select at least one thing you\'re looking for';
    if (!formData.group_size) return 'Group size is required';
    if (!formData.player_bio.trim()) return 'Player bio is required';
    if (formData.player_bio.length > 300) return 'Player bio must be 300 characters or less';
    if (!formData.contact_info.trim()) return 'Contact info is required';
    return null;
  };

  const handleSubmit = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!supabase || !user) {
      setError('You must be signed in to create a transfer profile');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload = {
        user_id: user.id,
        ...formData,
      };

      if (existingProfile) {
        const { error: updateError } = await supabase
          .from('transfer_profiles')
          .update({
            ...formData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingProfile.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('transfer_profiles')
          .insert(payload);

        if (insertError) throw insertError;
      }

      onSaved();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save profile';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  // Styles
  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.6rem 0.75rem',
    backgroundColor: colors.bg,
    border: `1px solid ${colors.border}`,
    borderRadius: '8px',
    color: colors.text,
    fontSize: isMobile ? '1rem' : '0.85rem',
    minHeight: '44px',
  };

  const labelStyle: React.CSSProperties = {
    color: colors.textSecondary,
    fontSize: '0.75rem',
    fontWeight: '500',
    marginBottom: '0.35rem',
    display: 'block',
  };

  const chipStyle = (active: boolean): React.CSSProperties => ({
    padding: '0.35rem 0.75rem',
    backgroundColor: active ? `${colors.primary}15` : colors.bg,
    border: `1px solid ${active ? `${colors.primary}50` : colors.border}`,
    borderRadius: '8px',
    color: active ? colors.primary : colors.textSecondary,
    fontSize: '0.75rem',
    cursor: 'pointer',
    fontWeight: active ? '600' : '400',
    minHeight: '44px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  });

  if (!user) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem', color: colors.textSecondary }}>
        <p>You must be signed in to create a transfer profile.</p>
      </div>
    );
  }

  if (!profile?.linked_player_id) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <p style={{ color: colors.warning, fontSize: '1rem', fontWeight: '600', marginBottom: '0.5rem' }}>
          Link Your Kingshot Account First
        </p>
        <p style={{ color: colors.textSecondary, fontSize: '0.85rem', marginBottom: '1rem' }}>
          You need to link your Kingshot account before creating a transfer profile. This ensures your kingdom and TC level are verified.
        </p>
        <a
          href="/profile"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.6rem 1.25rem',
            backgroundColor: `${colors.primary}15`,
            border: `1px solid ${colors.primary}40`,
            borderRadius: '8px',
            color: colors.primary,
            fontSize: '0.85rem',
            fontWeight: '600',
            textDecoration: 'none',
          }}
        >
          Go to Profile →
        </a>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem', color: colors.textSecondary }}>
        Loading...
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.85)',
      display: 'flex',
      alignItems: isMobile ? 'flex-end' : 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: isMobile ? 0 : '1rem',
    }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: colors.surface,
          border: `1px solid ${colors.border}`,
          borderRadius: isMobile ? '16px 16px 0 0' : '16px',
          padding: isMobile ? '1.25rem 1rem' : '1.5rem',
          paddingBottom: isMobile ? 'max(1.25rem, env(safe-area-inset-bottom))' : '1.5rem',
          maxWidth: '600px',
          width: '100%',
          maxHeight: isMobile ? '90vh' : '85vh',
          overflowY: 'auto',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.6)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <div>
            <h2 style={{
              fontFamily: FONT_DISPLAY,
              fontSize: isMobile ? '1.1rem' : '1.25rem',
              color: colors.text,
              margin: 0,
            }}>
              {existingProfile ? 'Edit' : 'Create'} <span style={{ ...neonGlow(colors.primary) }}>Transfer Profile</span>
            </h2>
            <p style={{ color: colors.textSecondary, fontSize: '0.75rem', margin: '0.25rem 0 0 0' }}>
              This is what kingdoms will see when reviewing your application
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#6b7280',
              cursor: 'pointer',
              padding: '0.5rem',
              minWidth: '44px',
              minHeight: '44px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Auto-filled section */}
        <div style={{
          backgroundColor: '#0a0a0a',
          border: '1px solid #22d3ee25',
          borderRadius: '10px',
          padding: '0.75rem 1rem',
          marginBottom: '1rem',
        }}>
          <span style={{ color: '#22d3ee', fontSize: '0.7rem', fontWeight: 'bold' }}>AUTO-FILLED FROM LINKED ACCOUNT</span>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, 1fr)', gap: '0.5rem', marginTop: '0.5rem' }}>
            <div>
              <span style={{ color: '#6b7280', fontSize: '0.65rem' }}>Username</span>
              <div style={{ color: '#fff', fontSize: '0.85rem', fontWeight: '600' }}>{formData.username || '—'}</div>
            </div>
            <div>
              <span style={{ color: '#6b7280', fontSize: '0.65rem' }}>Kingdom</span>
              <div style={{ color: '#fff', fontSize: '0.85rem', fontWeight: '600' }}>{formData.current_kingdom || '—'}</div>
            </div>
            <div>
              <span style={{ color: '#6b7280', fontSize: '0.65rem' }}>TC Level</span>
              <div style={{ color: '#fff', fontSize: '0.85rem', fontWeight: '600' }}>{formData.tc_level || '—'}</div>
            </div>
          </div>
        </div>

        {/* Form Fields */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Power Range */}
          <div>
            <label style={labelStyle}>Power Range *</label>
            <select
              value={formData.power_range}
              onChange={(e) => updateField('power_range', e.target.value)}
              style={inputStyle}
            >
              <option value="">Select power range</option>
              {POWER_RANGE_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>

          {/* Main Language */}
          <div>
            <label style={labelStyle}>Main Language *</label>
            <select
              value={formData.main_language}
              onChange={(e) => updateField('main_language', e.target.value)}
              style={inputStyle}
            >
              {LANGUAGE_OPTIONS.map((lang) => (
                <option key={lang} value={lang}>{lang}</option>
              ))}
            </select>
          </div>

          {/* Secondary Languages */}
          <div>
            <label style={labelStyle}>Secondary Languages (up to 3)</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
              {LANGUAGE_OPTIONS.filter((l) => l !== formData.main_language).map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => toggleSecondaryLanguage(lang)}
                  style={chipStyle(formData.secondary_languages.includes(lang))}
                >
                  {lang}
                </button>
              ))}
            </div>
          </div>

          {/* Play Schedule (UTC) */}
          <div>
            <label style={labelStyle}>Play Schedule — UTC (1-3 ranges) *</label>
            {formData.play_schedule.map((range, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <select
                  value={range.start}
                  onChange={(e) => updateTimeRange(idx, 'start', e.target.value)}
                  style={{ ...inputStyle, width: 'auto', flex: 1 }}
                >
                  {UTC_HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
                <span style={{ color: '#6b7280', fontSize: '0.8rem' }}>to</span>
                <select
                  value={range.end}
                  onChange={(e) => updateTimeRange(idx, 'end', e.target.value)}
                  style={{ ...inputStyle, width: 'auto', flex: 1 }}
                >
                  {UTC_HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
                {formData.play_schedule.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeTimeRange(idx)}
                    style={{
                      background: 'none', border: 'none', color: '#ef4444',
                      cursor: 'pointer', padding: '0.25rem', minWidth: '36px', minHeight: '36px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6L6 18M6 6l12 12"/>
                    </svg>
                  </button>
                )}
              </div>
            ))}
            {formData.play_schedule.length < 3 && (
              <button
                type="button"
                onClick={addTimeRange}
                style={{
                  padding: '0.35rem 0.75rem',
                  backgroundColor: 'transparent',
                  border: '1px dashed #2a2a2a',
                  borderRadius: '8px',
                  color: '#6b7280',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  minHeight: '36px',
                }}
              >
                + Add Time Range
              </button>
            )}
          </div>

          {/* KvK Participation */}
          <div>
            <label style={labelStyle}>KvK Participation *</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
              {KVK_PARTICIPATION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => updateField('kvk_participation', opt.value)}
                  style={chipStyle(formData.kvk_participation === opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Looking For */}
          <div>
            <label style={labelStyle}>What I'm Looking For * (up to 8)</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
              {LOOKING_FOR_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => toggleLookingFor(opt.value)}
                  style={chipStyle(formData.looking_for.includes(opt.value))}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Group Size */}
          <div>
            <label style={labelStyle}>Group Size *</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
              {GROUP_SIZE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => updateField('group_size', opt.value)}
                  style={chipStyle(formData.group_size === opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Player Bio */}
          <div>
            <label style={labelStyle}>
              Player Bio * <span style={{
                color: formData.player_bio.length > 280 ? '#ef4444' : formData.player_bio.length > 250 ? '#eab308' : '#4b5563',
                fontSize: '0.65rem',
              }}>
                ({formData.player_bio.length}/300)
              </span>
            </label>
            <textarea
              value={formData.player_bio}
              onChange={(e) => updateField('player_bio', e.target.value.slice(0, 300))}
              placeholder="Tell kingdoms about yourself, your experience, and what you bring to the table..."
              rows={4}
              style={{
                ...inputStyle,
                minHeight: '80px',
                resize: 'vertical',
                fontFamily: 'inherit',
              }}
            />
          </div>

          {/* Contact Method */}
          <div>
            <label style={labelStyle}>Contact Method *</label>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <button
                type="button"
                onClick={() => updateField('contact_method', 'discord')}
                style={chipStyle(formData.contact_method === 'discord')}
              >
                Discord
              </button>
              <button
                type="button"
                onClick={() => updateField('contact_method', 'in_game')}
                style={chipStyle(formData.contact_method === 'in_game')}
              >
                In-Game Coordinates
              </button>
            </div>
            <input
              type="text"
              value={formData.contact_info}
              onChange={(e) => updateField('contact_info', e.target.value)}
              placeholder={formData.contact_method === 'discord' ? 'Discord username (e.g., player#1234)' : 'In-game coordinates (e.g., X:123 Y:456)'}
              style={inputStyle}
            />
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div style={{
            marginTop: '1rem',
            padding: '0.6rem 0.75rem',
            backgroundColor: '#ef444415',
            border: '1px solid #ef444440',
            borderRadius: '8px',
            color: '#ef4444',
            fontSize: '0.8rem',
          }}>
            {error}
          </div>
        )}

        {/* Action Buttons */}
        <div style={{
          display: 'flex',
          gap: '0.75rem',
          marginTop: '1.25rem',
          justifyContent: 'flex-end',
          paddingBottom: isMobile ? 'max(0.5rem, env(safe-area-inset-bottom))' : 0,
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '0.6rem 1.25rem',
              backgroundColor: 'transparent',
              border: '1px solid #2a2a2a',
              borderRadius: '8px',
              color: '#9ca3af',
              fontSize: '0.85rem',
              cursor: 'pointer',
              minHeight: '44px',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            style={{
              padding: '0.6rem 1.25rem',
              backgroundColor: saving ? '#22d3ee50' : '#22d3ee',
              border: 'none',
              borderRadius: '8px',
              color: '#000',
              fontSize: '0.85rem',
              fontWeight: '600',
              cursor: saving ? 'not-allowed' : 'pointer',
              minHeight: '44px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
            }}
          >
            {saving ? 'Saving...' : existingProfile ? 'Update Profile' : 'Create Profile'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TransferProfileForm;
