import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useIsMobile } from '../hooks/useMediaQuery';
import { useToast } from './Toast';
import { useAnalytics } from '../hooks/useAnalytics';
import { supabase } from '../lib/supabase';
import { neonGlow, FONT_DISPLAY, colors } from '../utils/styles';
import { moderateText } from '../utils/contentModeration';
import { copyToClipboard } from '../utils/sharing';

// =============================================
// HELPERS
// =============================================

const formatTCLevel = (tcLevel: number): string => {
  if (tcLevel <= 0) return '—';
  if (tcLevel <= 30) return `TC${tcLevel}`;
  if (tcLevel <= 34) return 'TC30';
  const tgLevel = Math.floor((tcLevel - 35) / 5) + 1;
  return `TG${tgLevel}`;
};

// =============================================
// TYPES
// =============================================

interface TransferProfileData {
  username: string;
  current_kingdom: number;
  tc_level: number;
  power_million: number;
  main_language: string;
  secondary_languages: string[];
  play_schedule: Array<{ start: string; end: string }>;
  kvk_availability: string;
  saving_for_kvk: string;
  looking_for: string[];
  group_size: string;
  player_bio: string;
  contact_method: string;
  contact_discord: string;
  contact_coordinates: string;
  is_anonymous: boolean;
  visible_to_recruiters: boolean;
}

interface ExistingProfile extends TransferProfileData {
  id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  power_range?: string;
  kvk_participation?: string;
  contact_info?: string;
}

// =============================================
// CONSTANTS
// =============================================

const LANGUAGE_OPTIONS = [
  'English', 'Mandarin Chinese', 'Hindi', 'Spanish', 'French', 'Arabic', 'Bengali',
  'Portuguese', 'Russian', 'Japanese', 'German', 'Korean', 'Turkish', 'Vietnamese',
  'Italian', 'Thai', 'Polish', 'Indonesian', 'Dutch', 'Tagalog', 'Other',
];

const KVK_AVAILABILITY_OPTIONS = [
  { value: 'every', label: 'Every KvK', desc: 'Never miss one' },
  { value: 'most', label: 'Most KvKs', desc: 'Miss occasionally' },
  { value: 'some', label: 'Some KvKs', desc: 'Participate when possible' },
  { value: 'uncertain', label: 'Uncertain', desc: "I don't know when I can or not" },
];

const SAVING_FOR_KVK_OPTIONS = [
  { value: 'aggressively', label: 'Aggressively saving', desc: 'All resources/speedups reserved for KvK' },
  { value: 'moderately', label: 'Moderately saving', desc: 'Saving some, spending some' },
  { value: 'casually', label: 'Casually saving', desc: 'Saving a little' },
  { value: 'not_saving', label: 'Not saving', desc: 'Spending freely' },
];

const LOOKING_FOR_OPTIONS = [
  { value: 'competitive', label: 'Competitive', emoji: '🏆' },
  { value: 'casual', label: 'Casual', emoji: '🌴' },
  { value: 'kvk_focused', label: 'KvK-focused', emoji: '⚔️' },
  { value: 'community_focused', label: 'Community-focused', emoji: '👥' },
  { value: 'social', label: 'Social', emoji: '💬' },
  { value: 'drama_free', label: 'Drama-free', emoji: '☮️' },
  { value: 'organized', label: 'Organized', emoji: '📋' },
  { value: 'beginner_friendly', label: 'Beginner-friendly', emoji: '🌱' },
];

const GROUP_SIZE_OPTIONS = [
  { value: 'solo', label: 'Solo' },
  { value: '2-5', label: '2-5 Players' },
  { value: '6-9', label: '6-9 Players' },
  { value: '10+', label: '10+ Players' },
];

const UTC_HOURS = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}:00`);

// =============================================
// COMPONENT
// =============================================

const TransferProfileForm: React.FC<{
  onClose: () => void;
  onSaved: () => void;
  scrollToIncomplete?: boolean;
}> = ({ onClose, onSaved, scrollToIncomplete = false }) => {
  const { user, profile } = useAuth();
  const isMobile = useIsMobile();
  const { showToast } = useToast();
  const { trackFeature } = useAnalytics();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [existingProfile, setExistingProfile] = useState<ExistingProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const formContainerRef = useRef<HTMLDivElement>(null);
  const hasScrolledRef = useRef(false);

  const handleShareProfile = async () => {
    const tags = formData.looking_for.length > 0 ? formData.looking_for.join(', ') : 'Not set';
    const text = [
      `🚀 **${formData.is_anonymous ? 'Anonymous Player' : formData.username}** is looking for a new kingdom!`,
      `⚡ ${formData.tc_level ? formatTCLevel(formData.tc_level) : '—'} · ${formData.power_million ? `${formData.power_million}M power` : '—'}`,
      `🌐 ${formData.main_language || '—'} · 👥 ${formData.group_size || 'Solo'}`,
      `🎯 Looking for: ${tags}`,
      formData.player_bio ? `💬 "${formData.player_bio}"` : '',
      ``,
      `📋 View on Kingshot Atlas Transfer Hub:`,
      `https://ks-atlas.com/transfer-hub`,
    ].filter(Boolean).join('\n');

    const ok = await copyToClipboard(text);
    if (ok) {
      showToast('Profile link copied — paste it in Discord!', 'success');
    } else {
      showToast('Failed to copy', 'error');
    }
  };

  // Form state
  const [formData, setFormData] = useState<TransferProfileData>({
    username: '',
    current_kingdom: 0,
    tc_level: 0,
    power_million: 0,
    main_language: 'English',
    secondary_languages: [],
    play_schedule: [{ start: '10:00', end: '18:00' }],
    kvk_availability: 'most',
    saving_for_kvk: 'moderately',
    looking_for: [],
    group_size: 'solo',
    player_bio: '',
    contact_method: 'discord',
    contact_discord: '',
    contact_coordinates: '',
    is_anonymous: true,
    visible_to_recruiters: true,
  });

  // Structured coordinate fields for in-game contact
  const [coordKingdom, setCoordKingdom] = useState<string>('');
  const [coordX, setCoordX] = useState<string>('');
  const [coordY, setCoordY] = useState<string>('');

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
      // Pre-fill coordinate kingdom from linked account
      if (profile.linked_kingdom && !coordKingdom) {
        setCoordKingdom(String(profile.linked_kingdom));
      }
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
          const coords = data.contact_coordinates || (data.contact_method === 'in_game' ? data.contact_info : '') || '';
          setFormData({
            username: data.username,
            current_kingdom: data.current_kingdom,
            tc_level: data.tc_level,
            power_million: data.power_million || 0,
            main_language: data.main_language,
            secondary_languages: data.secondary_languages || [],
            play_schedule: data.play_schedule || [{ start: '10:00', end: '18:00' }],
            kvk_availability: data.kvk_availability || data.kvk_participation || 'most',
            saving_for_kvk: data.saving_for_kvk || 'moderately',
            looking_for: data.looking_for || [],
            group_size: data.group_size === '6-10' ? '6-9' : data.group_size,
            player_bio: data.player_bio,
            contact_method: data.contact_method,
            contact_discord: data.contact_discord || (data.contact_method === 'discord' ? data.contact_info : '') || '',
            contact_coordinates: coords,
            is_anonymous: data.is_anonymous ?? true,
            visible_to_recruiters: data.visible_to_recruiters ?? true,
          });
          // Parse structured coordinates (format: "K:231 X:123 Y:456")
          if (coords) {
            const kMatch = coords.match(/K:(\d+)/);
            const xMatch = coords.match(/X:(\d+)/);
            const yMatch = coords.match(/Y:(\d+)/);
            if (kMatch) setCoordKingdom(kMatch[1]);
            if (xMatch) setCoordX(xMatch[1]);
            if (yMatch) setCoordY(yMatch[1]);
          }
        }
      } catch {
        // No existing profile — that's fine
      } finally {
        setLoading(false);
      }
    };
    loadExisting();
  }, [user]);

  // Auto-scroll to first incomplete required field
  useEffect(() => {
    if (!scrollToIncomplete || loading || hasScrolledRef.current) return;
    hasScrolledRef.current = true;

    // Small delay to ensure DOM is rendered
    const timer = setTimeout(() => {
      const container = formContainerRef.current;
      if (!container) return;

      // Check required fields in order
      const fieldChecks: Array<{ field: string; isEmpty: boolean }> = [
        { field: 'power_million', isEmpty: !formData.power_million || formData.power_million <= 0 },
        { field: 'main_language', isEmpty: !formData.main_language },
        { field: 'play_schedule', isEmpty: !formData.play_schedule || formData.play_schedule.length === 0 },
        { field: 'kvk_availability', isEmpty: !formData.kvk_availability },
        { field: 'saving_for_kvk', isEmpty: !formData.saving_for_kvk },
        { field: 'looking_for', isEmpty: !formData.looking_for || formData.looking_for.length === 0 },
        { field: 'group_size', isEmpty: !formData.group_size },
        { field: 'player_bio', isEmpty: !formData.player_bio?.trim() },
        { field: 'contact_method', isEmpty: !formData.contact_method },
      ];

      const firstIncomplete = fieldChecks.find((c) => c.isEmpty);
      if (!firstIncomplete) return;

      const el = container.querySelector(`[data-field="${firstIncomplete.field}"]`) as HTMLElement;
      if (!el) return;

      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Brief highlight
      el.style.outline = '2px solid #22d3ee';
      el.style.outlineOffset = '4px';
      el.style.borderRadius = '8px';
      el.style.transition = 'outline-color 2s ease';
      setTimeout(() => {
        el.style.outlineColor = 'transparent';
      }, 2000);
    }, 400);

    return () => clearTimeout(timer);
  }, [scrollToIncomplete, loading, formData]);

  const updateField = <K extends keyof TransferProfileData>(key: K, value: TransferProfileData[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const toggleLookingFor = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      looking_for: prev.looking_for.includes(value)
        ? prev.looking_for.filter((v) => v !== value)
        : prev.looking_for.length < 4 ? [...prev.looking_for, value] : prev.looking_for,
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
    if (!formData.power_million || formData.power_million < 1) return 'Power (in millions) is required';
    if (formData.power_million > 99999) return 'Power must be 99,999M or less';
    if (!formData.main_language) return 'Main language is required';
    if (formData.play_schedule.length === 0) return 'At least one play schedule is required';
    if (!formData.kvk_availability) return 'KvK availability is required';
    if (!formData.saving_for_kvk) return 'Saving for KvK preference is required';
    if (formData.looking_for.length === 0) return 'Select at least one thing you\'re looking for';
    if (!formData.group_size) return 'Group size is required';
    if (!formData.player_bio.trim()) return 'Player bio is required';
    if (formData.player_bio.length > 150) return 'Player bio must be 150 characters or less';
    const bioCheck = moderateText(formData.player_bio);
    if (!bioCheck.isClean) return bioCheck.reason || 'Bio contains inappropriate language.';
    if (formData.contact_method === 'discord' && !formData.contact_discord.trim()) return 'Discord username is required';
    if (formData.contact_method === 'in_game' || formData.contact_method === 'both') {
      if (!coordKingdom.trim()) return 'Kingdom number is required for in-game coordinates';
      if (!coordX.trim() || !coordY.trim()) return 'Both X and Y coordinates are required';
      const xNum = parseInt(coordX, 10);
      const yNum = parseInt(coordY, 10);
      if (isNaN(xNum) || xNum < 0 || xNum > 1199) return 'X coordinate must be between 0 and 1199';
      if (isNaN(yNum) || yNum < 0 || yNum > 1199) return 'Y coordinate must be between 0 and 1199';
    }
    if (formData.contact_method === 'both' && !formData.contact_discord.trim()) return 'Discord username is required';
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
      // Compose structured coordinates into storage string
      const composedCoords = (formData.contact_method === 'in_game' || formData.contact_method === 'both')
        ? `K:${coordKingdom} X:${coordX} Y:${coordY}`
        : '';

      const payload = {
        user_id: user.id,
        username: formData.username,
        current_kingdom: formData.current_kingdom,
        tc_level: formData.tc_level,
        power_million: formData.power_million,
        main_language: formData.main_language,
        secondary_languages: formData.secondary_languages,
        play_schedule: formData.play_schedule,
        kvk_availability: formData.kvk_availability,
        saving_for_kvk: formData.saving_for_kvk,
        looking_for: formData.looking_for,
        group_size: formData.group_size,
        player_bio: formData.player_bio,
        contact_method: formData.contact_method,
        contact_discord: formData.contact_discord,
        contact_coordinates: composedCoords,
        is_anonymous: formData.is_anonymous,
        visible_to_recruiters: formData.visible_to_recruiters,
        contact_info: formData.contact_method === 'discord' ? formData.contact_discord : formData.contact_method === 'in_game' ? composedCoords : `${formData.contact_discord} | ${composedCoords}`,
        power_range: `${formData.power_million}M`,
        kvk_participation: formData.kvk_availability,
      };

      if (existingProfile) {
        const { error: updateError } = await supabase
          .from('transfer_profiles')
          .update({
            is_active: true,
            last_active_at: new Date().toISOString(),
            username: formData.username,
            current_kingdom: formData.current_kingdom,
            tc_level: formData.tc_level,
            power_million: formData.power_million,
            main_language: formData.main_language,
            secondary_languages: formData.secondary_languages,
            play_schedule: formData.play_schedule,
            kvk_availability: formData.kvk_availability,
            saving_for_kvk: formData.saving_for_kvk,
            looking_for: formData.looking_for,
            group_size: formData.group_size,
            player_bio: formData.player_bio,
            contact_method: formData.contact_method,
            contact_discord: formData.contact_discord,
            contact_coordinates: composedCoords,
            is_anonymous: formData.is_anonymous,
            visible_to_recruiters: formData.visible_to_recruiters,
            contact_info: formData.contact_method === 'discord' ? formData.contact_discord : formData.contact_method === 'in_game' ? composedCoords : `${formData.contact_discord} | ${composedCoords}`,
            power_range: `${formData.power_million}M`,
            kvk_participation: formData.kvk_availability,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingProfile.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('transfer_profiles')
          .insert(payload);

        if (insertError) throw insertError;
        trackFeature('Transfer Funnel: Profile Created');
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
        ref={formContainerRef}
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
              <div style={{ color: '#fff', fontSize: '0.85rem', fontWeight: '600' }}>{formData.tc_level ? formatTCLevel(formData.tc_level) : '—'}</div>
            </div>
          </div>
        </div>

        {/* Form Fields */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Power (Millions) */}
          <div data-field="power_million">
            <label style={labelStyle}>Total Power (in millions) *</label>
            <div style={{ position: 'relative' }}>
              <input
                type="number"
                min="1"
                max="99999"
                value={formData.power_million || ''}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  updateField('power_million', isNaN(val) ? 0 : Math.min(99999, Math.max(0, val)));
                }}
                placeholder="e.g. 100 = 100M"
                style={inputStyle}
              />
              {formData.power_million > 0 && (
                <span style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: colors.textMuted, fontSize: '0.75rem', pointerEvents: 'none' }}>
                  = {formData.power_million}M
                </span>
              )}
            </div>
          </div>

          {/* Main Language */}
          <div data-field="main_language">
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

          {/* Secondary Language */}
          <div>
            <label style={labelStyle}>Secondary Language</label>
            <select
              value={formData.secondary_languages[0] || ''}
              onChange={(e) => updateField('secondary_languages', e.target.value ? [e.target.value] : [])}
              style={inputStyle}
            >
              <option value="">None</option>
              {LANGUAGE_OPTIONS.filter((l) => l !== formData.main_language).map((lang) => (
                <option key={lang} value={lang}>{lang}</option>
              ))}
            </select>
          </div>

          {/* Play Schedule (UTC) */}
          <div data-field="play_schedule">
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

          {/* KvK Availability */}
          <div data-field="kvk_availability">
            <label style={labelStyle}>KvK Availability *</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
              {KVK_AVAILABILITY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => updateField('kvk_availability', opt.value)}
                  style={chipStyle(formData.kvk_availability === opt.value)}
                >
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Saving for KvK */}
          <div data-field="saving_for_kvk">
            <label style={labelStyle}>Saving for KvK *</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
              {SAVING_FOR_KVK_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => updateField('saving_for_kvk', opt.value)}
                  style={chipStyle(formData.saving_for_kvk === opt.value)}
                >
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Looking For */}
          <div data-field="looking_for">
            <label style={labelStyle}>What I'm Looking For * (pick up to 4)</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
              {LOOKING_FOR_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => toggleLookingFor(opt.value)}
                  style={chipStyle(formData.looking_for.includes(opt.value))}
                >
                  {opt.emoji} {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Group Size */}
          <div data-field="group_size">
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
          <div data-field="player_bio">
            <label style={labelStyle}>
              Player Bio * <span style={{
                color: formData.player_bio.length > 140 ? '#ef4444' : formData.player_bio.length > 120 ? '#eab308' : '#4b5563',
                fontSize: '0.65rem',
              }}>
                ({formData.player_bio.length}/150)
              </span>
            </label>
            <textarea
              value={formData.player_bio}
              onChange={(e) => updateField('player_bio', e.target.value.slice(0, 150))}
              placeholder="Brief intro — your experience and what you bring..."
              rows={3}
              style={{
                ...inputStyle,
                minHeight: '64px',
                resize: 'vertical',
                fontFamily: 'inherit',
              }}
            />
          </div>

          {/* Anonymity Toggle */}
          <div>
            <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', minHeight: '44px' }}>
              <input
                type="checkbox"
                checked={formData.is_anonymous}
                onChange={(e) => updateField('is_anonymous', e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: colors.primary }}
              />
              <span>Stay anonymous</span>
            </label>
            <p style={{ color: colors.textMuted, fontSize: '0.65rem', margin: '0.1rem 0 0 0' }}>
              {formData.is_anonymous
                ? 'Your username and kingdom will be hidden from recruiters until you reveal them.'
                : 'Recruiters will see your username and kingdom of origin.'}
            </p>
          </div>

          {/* Contact Method */}
          <div data-field="contact_method">
            <label style={labelStyle}>Contact Method *</label>
            <div style={{ display: 'flex', gap: '0.35rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
              <button type="button" onClick={() => updateField('contact_method', 'discord')} style={chipStyle(formData.contact_method === 'discord')}>Discord</button>
              <button type="button" onClick={() => updateField('contact_method', 'in_game')} style={chipStyle(formData.contact_method === 'in_game')}>In-Game</button>
              <button type="button" onClick={() => updateField('contact_method', 'both')} style={chipStyle(formData.contact_method === 'both')}>Both</button>
            </div>
            {(formData.contact_method === 'discord' || formData.contact_method === 'both') && (
              <input
                type="text"
                value={formData.contact_discord}
                onChange={(e) => updateField('contact_discord', e.target.value)}
                placeholder="Discord username (e.g., player#1234)"
                style={{ ...inputStyle, marginBottom: formData.contact_method === 'both' ? '0.5rem' : 0 }}
              />
            )}
            {(formData.contact_method === 'in_game' || formData.contact_method === 'both') && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <span style={{ color: colors.textSecondary, fontSize: '0.75rem', whiteSpace: 'nowrap' }}>Kingdom:</span>
                  <input
                    type="number"
                    min="1"
                    max="9999"
                    value={coordKingdom}
                    onChange={(e) => setCoordKingdom(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="—"
                    style={{
                      ...inputStyle,
                      width: '5rem',
                      textAlign: 'center',
                      padding: '0.6rem 0.4rem',
                      backgroundColor: coordKingdom && profile?.linked_kingdom ? `${colors.primary}08` : colors.bg,
                    }}
                    readOnly={!!profile?.linked_kingdom}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <span style={{ color: colors.textSecondary, fontSize: '0.75rem' }}>X:</span>
                  <input
                    type="number"
                    min="0"
                    max="1199"
                    value={coordX}
                    onChange={(e) => setCoordX(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="0-1199"
                    style={{
                      ...inputStyle,
                      width: '5.5rem',
                      textAlign: 'center',
                      padding: '0.6rem 0.4rem',
                    }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <span style={{ color: colors.textSecondary, fontSize: '0.75rem' }}>Y:</span>
                  <input
                    type="number"
                    min="0"
                    max="1199"
                    value={coordY}
                    onChange={(e) => setCoordY(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="0-1199"
                    style={{
                      ...inputStyle,
                      width: '5.5rem',
                      textAlign: 'center',
                      padding: '0.6rem 0.4rem',
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Visibility Toggle */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.75rem',
          backgroundColor: formData.visible_to_recruiters ? '#22c55e08' : '#ef444408',
          border: `1px solid ${formData.visible_to_recruiters ? '#22c55e25' : '#ef444425'}`,
          borderRadius: '8px',
          marginTop: '0.5rem',
        }}>
          <div>
            <div style={{ color: colors.text, fontSize: '0.85rem', fontWeight: '500' }}>
              {formData.visible_to_recruiters ? '👁️ Visible to Recruiters' : '🙈 Hidden from Recruiters'}
            </div>
            <div style={{ color: colors.textMuted, fontSize: '0.7rem', marginTop: '0.15rem' }}>
              {formData.visible_to_recruiters
                ? 'Kingdom editors can see your profile and send invites'
                : 'Your profile is hidden — recruiters cannot find or invite you'}
            </div>
          </div>
          <button
            type="button"
            onClick={() => updateField('visible_to_recruiters', !formData.visible_to_recruiters)}
            style={{
              padding: '0.4rem 0.8rem',
              backgroundColor: formData.visible_to_recruiters ? '#22c55e15' : '#ef444415',
              border: `1px solid ${formData.visible_to_recruiters ? '#22c55e40' : '#ef444440'}`,
              borderRadius: '6px',
              color: formData.visible_to_recruiters ? '#22c55e' : '#ef4444',
              fontSize: '0.75rem',
              fontWeight: '600',
              cursor: 'pointer',
              minHeight: '36px',
              whiteSpace: 'nowrap',
            }}
          >
            {formData.visible_to_recruiters ? 'Hide Me' : 'Show Me'}
          </button>
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

        {/* Preview Card */}
        {showPreview && (
          <div style={{
            marginTop: '1rem',
            padding: '0.75rem',
            backgroundColor: '#0a0a0a',
            border: '1px solid #22d3ee30',
            borderRadius: '10px',
          }}>
            <div style={{ fontSize: '0.65rem', color: '#22d3ee', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
              👁️ How recruiters will see your card
            </div>
            <div style={{
              backgroundColor: colors.bg,
              border: `1px solid ${colors.border}`,
              borderRadius: '10px',
              padding: '0.75rem',
            }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ color: colors.text, fontWeight: '600', fontSize: '0.85rem' }}>
                    {formData.is_anonymous ? '🔒 Anonymous' : (formData.username || 'Unknown')}
                  </span>
                  {!formData.is_anonymous && formData.current_kingdom > 0 && (
                    <span style={{ color: colors.textMuted, fontSize: '0.65rem' }}>K{formData.current_kingdom}</span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '0.3rem' }}>
                  <span style={{
                    padding: '0.1rem 0.35rem',
                    backgroundColor: '#eab30808',
                    border: '1px solid #eab30820',
                    borderRadius: '4px',
                    fontSize: '0.6rem',
                    color: '#eab308',
                  }}>
                    {formData.tc_level ? formatTCLevel(formData.tc_level) : '—'}
                  </span>
                  <span style={{
                    padding: '0.1rem 0.35rem',
                    backgroundColor: '#f9731608',
                    border: '1px solid #f9731620',
                    borderRadius: '4px',
                    fontSize: '0.6rem',
                    color: '#f97316',
                  }}>
                    {formData.power_million ? `${formData.power_million}M` : '—'}
                  </span>
                </div>
              </div>
              {/* Quick Stats */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginBottom: '0.4rem' }}>
                <span style={{ color: colors.textSecondary, fontSize: '0.65rem' }}>🌐 {formData.main_language || '—'}</span>
                {formData.kvk_availability && (
                  <span style={{ color: colors.textSecondary, fontSize: '0.65rem' }}>⚔️ {formData.kvk_availability}</span>
                )}
                <span style={{ color: colors.textSecondary, fontSize: '0.65rem' }}>👥 {formData.group_size || '—'}</span>
              </div>
              {/* Looking For Tags */}
              {formData.looking_for.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2rem', marginBottom: '0.4rem' }}>
                  {formData.looking_for.map((tag) => (
                    <span key={tag} style={{
                      padding: '0.08rem 0.35rem',
                      backgroundColor: '#22d3ee08',
                      border: '1px solid #22d3ee18',
                      borderRadius: '4px',
                      fontSize: '0.55rem',
                      color: '#22d3ee',
                    }}>
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              {/* Bio */}
              {formData.player_bio ? (
                <p style={{ color: colors.textSecondary, fontSize: '0.7rem', margin: 0, lineHeight: 1.4, fontStyle: 'italic' }}>
                  &ldquo;{formData.player_bio}&rdquo;
                </p>
              ) : (
                <p style={{ color: colors.textMuted, fontSize: '0.65rem', margin: 0, fontStyle: 'italic' }}>
                  No bio yet — add one above
                </p>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{
          display: 'flex',
          gap: '0.75rem',
          marginTop: '1.25rem',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingBottom: isMobile ? 'max(0.5rem, env(safe-area-inset-bottom))' : 0,
        }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={() => { setShowPreview(!showPreview); trackFeature('Transfer Profile Preview Toggle', { visible: !showPreview }); }}
              style={{
                padding: '0.5rem 0.75rem',
                backgroundColor: showPreview ? '#22d3ee10' : 'transparent',
                border: `1px solid ${showPreview ? '#22d3ee40' : '#2a2a2a'}`,
                borderRadius: '8px',
                color: showPreview ? '#22d3ee' : '#6b7280',
                fontSize: '0.75rem',
                cursor: 'pointer',
                minHeight: '44px',
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
              }}
            >
              👁️ {showPreview ? 'Hide' : 'Preview'}
            </button>
            {existingProfile && (
              <button
                type="button"
                onClick={() => { handleShareProfile(); trackFeature('Transfer Profile Share Clicked'); }}
                style={{
                  padding: '0.5rem 0.75rem',
                  backgroundColor: 'transparent',
                  border: '1px solid #2a2a2a',
                  borderRadius: '8px',
                  color: '#6b7280',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  minHeight: '44px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                }}
              >
                🔗 Share
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
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
    </div>
  );
};

export default TransferProfileForm;
