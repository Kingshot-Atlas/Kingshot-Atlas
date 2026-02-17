import React from 'react';
import { FONT_DISPLAY } from '../../utils/styles';

// =============================================
// TYPES
// =============================================

export interface MarchTimes {
  castle: { regular: number; buffed: number };
  turret1: { regular: number; buffed: number };
  turret2: { regular: number; buffed: number };
  turret3: { regular: number; buffed: number };
  turret4: { regular: number; buffed: number };
}

export interface RallyPlayer {
  id: string;
  name: string;
  team: 'ally' | 'enemy';
  marchTimes: MarchTimes;
}

export type BuildingKey = 'castle' | 'turret1' | 'turret2' | 'turret3' | 'turret4';
export type HitMode = 'simultaneous' | 'interval';
export type MarchType = 'regular' | 'buffed';

export interface RallySlot {
  playerId: string;
  playerName: string;
  marchTime: number;
  team: 'ally' | 'enemy';
  useBuffed: boolean;
}

export interface CalculatedRally {
  name: string;
  marchTime: number;
  startDelay: number;
  hitOrder: number;
  arrivalTime: number;
  team: 'ally' | 'enemy';
}

export interface RallyPreset {
  id: string;
  name: string;
  building: BuildingKey;
  hitMode: HitMode;
  interval: number;
  slots: { playerId: string; useBuffed: boolean }[];
  counterSlots?: { playerId: string; useBuffed: boolean }[];
  counterHitMode?: HitMode;
  counterInterval?: number;
}

// =============================================
// CONSTANTS
// =============================================

export const BUILDING_LABELS: Record<BuildingKey, string> = {
  castle: "King's Castle",
  turret1: 'Turret 1 (South)',
  turret2: 'Turret 2 (West)',
  turret3: 'Turret 3 (East)',
  turret4: 'Turret 4 (North)',
};

export const BUILDING_SHORT: Record<BuildingKey, string> = {
  castle: 'KC',
  turret1: 'T1',
  turret2: 'T2',
  turret3: 'T3',
  turret4: 'T4',
};

// i18n-aware building label helpers — pass t() from useTranslation()
export const getBuildingLabel = (key: BuildingKey, t: (k: string, fallback: string) => string): string => {
  const map: Record<BuildingKey, [string, string]> = {
    castle: ['building.castle', "King's Castle"],
    turret1: ['building.turret1', 'Turret 1 (South)'],
    turret2: ['building.turret2', 'Turret 2 (West)'],
    turret3: ['building.turret3', 'Turret 3 (East)'],
    turret4: ['building.turret4', 'Turret 4 (North)'],
  };
  const [i18nKey, fallback] = map[key];
  return t(i18nKey, fallback);
};

export const getBuildingShort = (key: BuildingKey, t: (k: string, fallback: string) => string): string => {
  const map: Record<BuildingKey, [string, string]> = {
    castle: ['building.castleShort', 'KC'],
    turret1: ['building.turret1Short', 'T1'],
    turret2: ['building.turret2Short', 'T2'],
    turret3: ['building.turret3Short', 'T3'],
    turret4: ['building.turret4Short', 'T4'],
  };
  const [i18nKey, fallback] = map[key];
  return t(i18nKey, fallback);
};

export const BUILDING_COLORS: Record<BuildingKey, string> = {
  castle: '#fbbf24',
  turret1: '#ef4444',
  turret2: '#3b82f6',
  turret3: '#22c55e',
  turret4: '#a855f7',
};

export const DEFAULT_MARCH: MarchTimes = {
  castle: { regular: 0, buffed: 0 },
  turret1: { regular: 0, buffed: 0 },
  turret2: { regular: 0, buffed: 0 },
  turret3: { regular: 0, buffed: 0 },
  turret4: { regular: 0, buffed: 0 },
};

export const ALLY_COLOR = '#3b82f6';
export const ENEMY_COLOR = '#ef4444';

export const RALLY_COLORS = [
  '#3b82f6', '#22c55e', '#f59e0b', '#a855f7',
  '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16', '#06b6d4',
];

export const COUNTER_COLORS = [
  '#ef4444', '#f97316', '#ec4899', '#a855f7',
  '#f59e0b', '#84cc16', '#14b8a6', '#6366f1', '#3b82f6', '#22c55e',
];

export const BUFF_DURATION_MS = 2 * 60 * 60 * 1000; // 2 hours

export const STORAGE_KEY_PLAYERS = 'atlas_rally_players_v2';
export const STORAGE_KEY_PRESETS = 'atlas_rally_presets';
export const STORAGE_KEY_BUFF_TIMERS = 'atlas_rally_buff_timers';

export const BUFF_MULTIPLIER = 1.55;

// =============================================
// SHARED STYLES
// =============================================

export const focusRingStyle = `
  .rally-focusable:focus-visible {
    outline: 2px solid #60a5fa;
    outline-offset: 2px;
  }
`;

export const CARD: React.CSSProperties = {
  backgroundColor: '#111111', borderRadius: '14px',
  border: '1px solid #2a2a2a', padding: '0.75rem',
};

export const cardHeader = (color: string = '#fff'): React.CSSProperties => ({
  color, fontSize: '0.9rem', fontWeight: '700', fontFamily: FONT_DISPLAY, marginBottom: '0.5rem',
});

export const arrowBtnStyle = (active: boolean, isMobile: boolean = false): React.CSSProperties => ({
  width: isMobile ? '44px' : '28px', height: isMobile ? '44px' : '28px', borderRadius: isMobile ? '8px' : '4px',
  backgroundColor: isMobile ? (active ? '#ffffff08' : 'transparent') : 'transparent',
  border: isMobile ? `1px solid ${active ? '#2a2a2a' : '#1a1a1a'}` : 'none',
  color: active ? '#d1d5db' : '#374151', cursor: active ? 'pointer' : 'default',
  fontSize: isMobile ? '0.8rem' : '0.7rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: 0,
});

export const menuItemStyle: React.CSSProperties = {
  display: 'block', width: '100%', padding: '0.5rem 0.75rem',
  backgroundColor: 'transparent', border: 'none', color: '#d1d5db',
  fontSize: '0.8rem', cursor: 'pointer', textAlign: 'left',
  minHeight: '44px', lineHeight: '1.5',
};

export const inputStyle: React.CSSProperties = {
  padding: '0.5rem 0.75rem', backgroundColor: '#0a0a0a',
  border: '1px solid #2a2a2a', borderRadius: '8px',
  color: '#fff', fontSize: '1rem', outline: 'none',
  width: '100%', minHeight: '44px', boxSizing: 'border-box',
};

export const cancelBtnStyle: React.CSSProperties = {
  padding: '0.5rem 1rem', backgroundColor: 'transparent',
  border: '1px solid #2a2a2a', borderRadius: '8px',
  color: '#9ca3af', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer',
};

export const saveBtnStyle: React.CSSProperties = {
  padding: '0.5rem 1rem', border: 'none', borderRadius: '8px',
  color: '#000', fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer',
};

// =============================================
// HELPER FUNCTIONS
// =============================================

export const formatTime = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return sec === 0 ? `${m}m` : `${m}:${sec.toString().padStart(2, '0')}`;
};

export const formatCountdown = (ms: number): string => {
  if (ms <= 0) return '0:00';
  const totalSec = Math.ceil(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

export const estimateBuffed = (regular: number): number => {
  if (regular <= 0) return 0;
  return Math.ceil(regular / BUFF_MULTIPLIER);
};

export const estimateRegular = (buffed: number): number => {
  if (buffed <= 0) return 0;
  return Math.ceil(buffed * BUFF_MULTIPLIER);
};

export function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
}

export function saveToStorage<T>(key: string, data: T) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch { /* quota exceeded — silent */ }
}

export const playEnemyBuffExpireSound = () => {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.frequency.value = 660;
    osc2.type = 'sine';
    gain2.gain.setValueAtTime(0.3, ctx.currentTime + 0.3);
    gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.8);
    osc2.start(ctx.currentTime + 0.3);
    osc2.stop(ctx.currentTime + 0.8);
  } catch { /* audio not supported */ }
  try { navigator.vibrate?.([200, 100, 200]); } catch { /* vibrate not supported */ }
};

export const playAllyBuffExpireSound = () => {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 523;
    osc.type = 'triangle';
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.frequency.value = 784;
    osc2.type = 'triangle';
    gain2.gain.setValueAtTime(0.25, ctx.currentTime + 0.25);
    gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.7);
    osc2.start(ctx.currentTime + 0.25);
    osc2.stop(ctx.currentTime + 0.7);
  } catch { /* audio not supported */ }
  try { navigator.vibrate?.([100]); } catch { /* vibrate not supported */ }
};

// =============================================
// CALCULATION ENGINE
// =============================================

export function calculateRallyTimings(
  slots: RallySlot[],
  gap: number
): CalculatedRally[] {
  if (slots.length === 0) return [];
  if (slots.length === 1) {
    const s = slots[0]!;
    return [{ name: s.playerName, marchTime: s.marchTime, startDelay: 0, hitOrder: 1, arrivalTime: s.marchTime, team: s.team }];
  }

  // Timeline does NOT include fill time — only march-to-hit
  const marchTimes = slots.map(s => s.marchTime);
  const desiredHits: number[] = slots.map((_, i) => i * gap);
  const offsets: number[] = marchTimes.map((t, i) => t - (desiredHits[i] as number));
  const maxOffset = Math.max(...offsets);
  const startDelays = offsets.map(o => maxOffset - o);

  const results: CalculatedRally[] = slots.map((s, i) => {
    const delay = startDelays[i] ?? 0;
    return {
      name: s.playerName,
      marchTime: s.marchTime,
      startDelay: delay,
      hitOrder: i + 1,
      arrivalTime: delay + s.marchTime,
      team: s.team,
    };
  });

  return results.sort((a, b) => a.startDelay - b.startDelay);
}
