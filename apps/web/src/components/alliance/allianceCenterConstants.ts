import type React from 'react';

export const ACCENT = '#3b82f6';
export const ACCENT_DIM = '#3b82f615';
export const ACCENT_BORDER = '#3b82f630';

export const inputBase: React.CSSProperties = {
  width: '100%', padding: '0.5rem 0.6rem', backgroundColor: '#0d1117',
  border: '1px solid #2a2a2a', borderRadius: '6px', color: '#fff',
  fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box',
};

export const thStyle: React.CSSProperties = {
  padding: '0.5rem 0.6rem', color: '#6b7280', fontSize: '0.7rem', fontWeight: 700,
  textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap', textAlign: 'center',
};

export const tdStyle: React.CSSProperties = {
  padding: '0.45rem 0.6rem', verticalAlign: 'middle',
};

// ─── Troop constants (matching Battle Registry) ───
export const TROOP_COLORS = { infantry: '#3b82f6', cavalry: '#f97316', archers: '#ef4444' };
export const MIN_TIER = 8;
export const MAX_TIER = 11;
export const MIN_TG = 0;
export const MAX_TG = 8;

// ─── TG badge color helper (unique per level) ───
export const TG_COLORS: Record<string, { bg: string; fg: string }> = {
  TC30: { bg: '#94a3b820', fg: '#94a3b8' }, // slate
  TG1:  { bg: '#22d3ee20', fg: '#22d3ee' }, // cyan
  TG2:  { bg: '#10b98120', fg: '#10b981' }, // emerald
  TG3:  { bg: '#84cc1620', fg: '#84cc16' }, // lime
  TG4:  { bg: '#eab30820', fg: '#eab308' }, // yellow
  TG5:  { bg: '#f9731620', fg: '#f97316' }, // orange
  TG6:  { bg: '#ef444420', fg: '#ef4444' }, // red
  TG7:  { bg: '#ec489920', fg: '#ec4899' }, // pink
  TG8:  { bg: '#a855f720', fg: '#a855f7' }, // purple
};
export function tgBadgeColor(label: string): { bg: string; fg: string } {
  return TG_COLORS[label] || { bg: '#6b728020', fg: '#6b7280' };
}

// ─── Language name helper (English names instead of flags) ───
export const LANG_NAMES: Record<string, string> = {
  english: 'English', spanish: 'Spanish', french: 'French', german: 'German', portuguese: 'Portuguese',
  italian: 'Italian', dutch: 'Dutch', russian: 'Russian', polish: 'Polish', turkish: 'Turkish',
  arabic: 'Arabic', chinese: 'Chinese', japanese: 'Japanese', korean: 'Korean', vietnamese: 'Vietnamese',
  thai: 'Thai', indonesian: 'Indonesian', malay: 'Malay', hindi: 'Hindi', swedish: 'Swedish',
  norwegian: 'Norwegian', danish: 'Danish', finnish: 'Finnish', greek: 'Greek', czech: 'Czech',
  romanian: 'Romanian', hungarian: 'Hungarian', ukrainian: 'Ukrainian', tagalog: 'Tagalog', filipino: 'Filipino',
  persian: 'Persian', hebrew: 'Hebrew', bengali: 'Bengali', urdu: 'Urdu', tamil: 'Tamil',
  en: 'English', es: 'Spanish', fr: 'French', de: 'German', pt: 'Portuguese', it: 'Italian', nl: 'Dutch',
  ru: 'Russian', pl: 'Polish', tr: 'Turkish', ar: 'Arabic', zh: 'Chinese', ja: 'Japanese', ko: 'Korean',
  vi: 'Vietnamese', th: 'Thai', id: 'Indonesian', ms: 'Malay', hi: 'Hindi', sv: 'Swedish', no: 'Norwegian',
  da: 'Danish', fi: 'Finnish', el: 'Greek', cs: 'Czech', ro: 'Romanian', hu: 'Hungarian', uk: 'Ukrainian',
};
export function langName(lang: string | null | undefined): string | null {
  if (!lang || !lang.trim()) return null;
  return LANG_NAMES[lang.toLowerCase().trim()] || LANG_NAMES[lang.toLowerCase().trim().slice(0, 2)] || null;
}

// ─── Availability tooltip day labels ───
export const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ─── Shared modal styles (eliminates 6+ identical inline objects) ───
export const modalBackdrop = (isMobile: boolean): React.CSSProperties => ({
  position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
  display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center',
  zIndex: 1000, padding: isMobile ? '0' : '1rem',
});

export const modalContent = (isMobile: boolean, opts?: { maxWidth?: string; borderColor?: string }): React.CSSProperties => ({
  width: '100%', maxWidth: opts?.maxWidth ?? '400px',
  backgroundColor: '#111111',
  borderRadius: isMobile ? '16px 16px 0 0' : '16px',
  border: `1px solid ${opts?.borderColor ?? '#2a2a2a'}`,
  padding: isMobile ? '1.25rem 1rem' : '1.5rem',
  boxShadow: '0 16px 64px rgba(0,0,0,0.5)',
  maxHeight: isMobile ? '90vh' : '85vh',
  overflowY: 'auto' as const,
  WebkitOverflowScrolling: 'touch' as const,
  paddingBottom: isMobile ? 'max(1.5rem, env(safe-area-inset-bottom))' : '1.5rem',
});

export const modalContentCentered = (isMobile: boolean, opts?: { maxWidth?: string; borderColor?: string }): React.CSSProperties => ({
  ...modalContent(isMobile, opts),
  textAlign: 'center' as const,
});

// ─── Sort types ───
export type SortKey = 'name' | 'id' | 'tc' | 'infantry' | 'cavalry' | 'archers' | 'lang' | 'avail';
export type SortDir = 'asc' | 'desc';
