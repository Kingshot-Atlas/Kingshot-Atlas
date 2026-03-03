export interface PlayerAccount {
  id: string;
  player_id: string;
  username: string | null;
  avatar_url: string | null;
  kingdom: number | null;
  tc_level: number | null;
  is_active: boolean;
  last_synced: string | null;
  created_at: string;
}

export interface PlayerVerificationData {
  player_id?: string;
  username: string;
  avatar_url: string;
  kingdom: number;
  town_center_level: number;
}

export interface PersistedVerifyState {
  newPlayerId: string;
  verifyStep: 'input' | 'challenge' | null;
  verifyCode: string;
  pendingPlayer: { player_id: string; username: string; avatar_url: string; kingdom: number; town_center_level: number } | null;
  showAddInput: boolean;
}

// sessionStorage key for persisting verification flow across app switches (mobile)
const VERIFY_STATE_KEY = 'atlas_alt_verify_state';

export function saveVerifyState(state: PersistedVerifyState) {
  try { sessionStorage.setItem(VERIFY_STATE_KEY, JSON.stringify(state)); } catch { /* quota */ }
}

export function loadVerifyState(): PersistedVerifyState | null {
  try {
    const raw = sessionStorage.getItem(VERIFY_STATE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function clearVerifyState() {
  try { sessionStorage.removeItem(VERIFY_STATE_KEY); } catch { /* noop */ }
}
