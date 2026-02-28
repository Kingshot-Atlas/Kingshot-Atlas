import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useIsMobile } from '../hooks/useMediaQuery';
import { useToast } from './Toast';
import { colors, transition } from '../utils/styles';
import { Card } from './shared';
import { useTranslation } from 'react-i18next';
import { logger } from '../utils/logger';
import { getAuthHeaders } from '../services/authHeaders';

interface PlayerAccount {
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

interface PlayerVerificationData {
  player_id?: string;
  username: string;
  avatar_url: string;
  kingdom: number;
  town_center_level: number;
}

interface AccountSwitcherProps {
  onSwitch?: () => void;
}

// sessionStorage key for persisting verification flow across app switches (mobile)
const VERIFY_STATE_KEY = 'atlas_alt_verify_state';

interface PersistedVerifyState {
  newPlayerId: string;
  verifyStep: 'input' | 'challenge' | null;
  verifyCode: string;
  pendingPlayer: { player_id: string; username: string; avatar_url: string; kingdom: number; town_center_level: number } | null;
  showAddInput: boolean;
}

function saveVerifyState(state: PersistedVerifyState) {
  try { sessionStorage.setItem(VERIFY_STATE_KEY, JSON.stringify(state)); } catch { /* quota */ }
}

function loadVerifyState(): PersistedVerifyState | null {
  try {
    const raw = sessionStorage.getItem(VERIFY_STATE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function clearVerifyState() {
  try { sessionStorage.removeItem(VERIFY_STATE_KEY); } catch { /* noop */ }
}

const AccountSwitcher: React.FC<AccountSwitcherProps> = ({ onSwitch }) => {
  const { t } = useTranslation();
  const { user, profile, updateProfile } = useAuth();
  const isMobile = useIsMobile();
  const { showToast } = useToast();
  const [accounts, setAccounts] = useState<PlayerAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState<string | null>(null);

  // Restore persisted verification state (survives mobile app-switch page refresh)
  const restored = loadVerifyState();
  const [showAddInput, setShowAddInput] = useState(restored?.showAddInput ?? false);
  const [newPlayerId, setNewPlayerId] = useState(restored?.newPlayerId ?? '');
  const [verifying, setVerifying] = useState(false);
  // Name verification challenge state
  const [verifyStep, setVerifyStep] = useState<'input' | 'challenge' | null>(restored?.verifyStep ?? null);
  const [verifyCode, setVerifyCode] = useState(restored?.verifyCode ?? '');
  const [pendingPlayer, setPendingPlayer] = useState<{ player_id: string; username: string; avatar_url: string; kingdom: number; town_center_level: number } | null>(restored?.pendingPlayer ?? null);
  const [polling, setPolling] = useState(false);
  const [pollCount, setPollCount] = useState(0);
  const [detectedName, setDetectedName] = useState<string | null>(null);
  const [pollTimedOut, setPollTimedOut] = useState(false);
  const pollingActiveRef = useRef(false);
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

  const fetchAccounts = useCallback(async () => {
    if (!supabase || !user?.id) return;
    try {
      const { data, error } = await supabase
        .from('player_accounts')
        .select('*')
        .eq('user_id', user.id)
        .order('is_active', { ascending: false })
        .order('created_at', { ascending: true });
      if (error) throw error;
      setAccounts(data || []);
    } catch (err) {
      logger.error('Failed to fetch player accounts:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  // Show toast when verification draft is restored from sessionStorage
  useEffect(() => {
    if (restored) {
      showToast(t('accountSwitcher.draftRestored', 'Verification progress restored'), 'info');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist verification flow state to sessionStorage on every change
  useEffect(() => {
    if (showAddInput || verifyStep || verifyCode || pendingPlayer) {
      saveVerifyState({ newPlayerId, verifyStep, verifyCode, pendingPlayer, showAddInput });
    }
  }, [newPlayerId, verifyStep, verifyCode, pendingPlayer, showAddInput]);

  // Also save on visibilitychange (catches mobile tab kill before useEffect fires)
  useEffect(() => {
    if (!showAddInput && !verifyStep) return;
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        saveVerifyState({ newPlayerId, verifyStep, verifyCode, pendingPlayer, showAddInput });
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [newPlayerId, verifyStep, verifyCode, pendingPlayer, showAddInput]);

  const handleSwitch = async (account: PlayerAccount) => {
    if (!supabase || !user?.id || !updateProfile || account.is_active) return;
    setSwitching(account.id);
    try {
      // Deactivate all accounts for this user
      await supabase
        .from('player_accounts')
        .update({ is_active: false })
        .eq('user_id', user.id);

      // Activate the selected account
      await supabase
        .from('player_accounts')
        .update({ is_active: true })
        .eq('id', account.id);

      // Update profile linked fields
      const result = await updateProfile({
        linked_player_id: account.player_id,
        linked_username: account.username || undefined,
        linked_avatar_url: account.avatar_url || undefined,
        linked_kingdom: account.kingdom || undefined,
        linked_tc_level: account.tc_level || undefined,
        linked_last_synced: account.last_synced || undefined,
      });

      if (!result.success) {
        showToast(result.error || t('accountSwitcher.switchFailed', 'Failed to switch account'), 'error');
        return;
      }

      showToast(t('accountSwitcher.switchedTo', 'Switched to {{name}} (K{{kingdom}})', { name: account.username || account.player_id, kingdom: account.kingdom || '?' }), 'success');
      await fetchAccounts();
      onSwitch?.();
    } catch (err) {
      logger.error('Failed to switch account:', err);
      showToast(t('accountSwitcher.switchFailed', 'Failed to switch account'), 'error');
    } finally {
      setSwitching(null);
    }
  };

  const handleRemoveAccount = async (account: PlayerAccount) => {
    if (!supabase || !user?.id) return;
    if (account.is_active) {
      showToast(t('accountSwitcher.cantRemoveActive', 'Switch to another account before removing this one'), 'error');
      return;
    }
    try {
      await supabase
        .from('player_accounts')
        .delete()
        .eq('id', account.id);
      showToast(t('accountSwitcher.removed', 'Account removed'), 'info');
      await fetchAccounts();
    } catch (err) {
      logger.error('Failed to remove account:', err);
    }
  };

  // Generate a random 4-char alphanumeric code for ownership verification
  const generateCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  };

  // Step 1: Verify player ID exists and check uniqueness
  const handleVerifyPlayerId = async () => {
    if (!supabase || !user?.id) return;
    const id = newPlayerId.trim();
    if (!id || !/^\d{6,20}$/.test(id)) {
      showToast(t('linkAccount.playerIdFormat', 'Player ID must be 6-20 digits'), 'error');
      return;
    }

    if (accounts.some(a => a.player_id === id)) {
      showToast(t('accountSwitcher.alreadyAdded', 'This account is already linked'), 'error');
      return;
    }

    setVerifying(true);
    try {
      const authHeaders = await getAuthHeaders({ requireAuth: false });
      const response = await fetch(`${API_BASE}/api/v1/player-link/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ player_id: id }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail?.error || 'Failed to verify player');
      }

      const playerData = await response.json();

      // Check if already linked by someone else
      const { data: existing } = await supabase
        .from('player_accounts')
        .select('user_id')
        .eq('player_id', id)
        .maybeSingle();

      if (existing && existing.user_id !== user.id) {
        showToast(t('linkAccount.alreadyLinked', 'This Player ID is already linked to another Atlas account.'), 'error');
        return;
      }

      const { data: profileExisting } = await supabase
        .from('profiles')
        .select('id')
        .eq('linked_player_id', id)
        .neq('id', user.id)
        .maybeSingle();

      if (profileExisting) {
        showToast(t('linkAccount.alreadyLinked', 'This Player ID is already linked to another Atlas account.'), 'error');
        return;
      }

      // Player found & available — move to name verification challenge
      const code = generateCode();
      setVerifyCode(code);
      setPendingPlayer(playerData);
      setVerifyStep('challenge');
    } catch (err) {
      logger.error('Failed to verify player:', err);
      showToast(err instanceof Error ? err.message : t('accountSwitcher.addFailed', 'Failed to add account'), 'error');
    } finally {
      setVerifying(false);
    }
  };

  // ─── Auto-Polling Verification ───────────────────────────────────────────
  // Polls Century Games API every 8s after user clicks verify.
  // Stays within the 10/min backend rate limit. Max ~5 minutes.
  // Century Games API caches player names for several minutes after a change.
  const POLL_INTERVAL_MS = 8000;
  const MAX_POLL_ATTEMPTS = 38;

  const checkVerificationOnce = async (playerId: string, code: string): Promise<{ verified: boolean; freshData?: PlayerVerificationData }> => {
    try {
      const authHeaders = await getAuthHeaders({ requireAuth: false });
      const response = await fetch(`${API_BASE}/api/v1/player-link/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ player_id: playerId }),
      });
      if (!response.ok) return { verified: false };
      const freshData = await response.json();
      setDetectedName(freshData.username || null);
      const nameUpper = (freshData.username || '').toUpperCase();
      return { verified: nameUpper.includes(code), freshData };
    } catch {
      return { verified: false };
    }
  };

  const stopPolling = useCallback(() => {
    pollingActiveRef.current = false;
    setPolling(false);
    setPollCount(0);
    setDetectedName(null);
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
  }, []);

  const startVerificationPolling = async () => {
    if (!supabase || !user?.id || !pendingPlayer) return;
    const playerId = pendingPlayer.player_id;
    const code = verifyCode;

    pollingActiveRef.current = true;
    setPolling(true);
    setPollTimedOut(false);
    setDetectedName(null);

    const insertAccount = async (freshData: PlayerVerificationData): Promise<boolean> => {
      const { error } = await supabase!
        .from('player_accounts')
        .insert({
          user_id: user!.id,
          player_id: playerId,
          username: freshData.username,
          avatar_url: freshData.avatar_url,
          kingdom: freshData.kingdom,
          tc_level: freshData.town_center_level,
          is_active: false,
          last_synced: new Date().toISOString(),
        });
      if (error) {
        if (error.code === '23505') {
          showToast(t('linkAccount.alreadyLinked', 'This Player ID is already linked to another Atlas account.'), 'error');
        } else {
          logger.error('Failed to insert verified account:', error);
          showToast(t('accountSwitcher.addFailed', 'Failed to add account'), 'error');
        }
        return false;
      }
      return true;
    };

    const poll = async (attempt: number) => {
      if (!pollingActiveRef.current) return;

      if (attempt > MAX_POLL_ATTEMPTS) {
        pollingActiveRef.current = false;
        setPolling(false);
        setPollTimedOut(true);
        showToast(t('accountSwitcher.pollTimeout', 'Verification timed out. The game server may be slow to update. You can try again — the code is still valid.'), 'error');
        return;
      }

      setPollCount(attempt);
      const result = await checkVerificationOnce(playerId, code);
      if (!pollingActiveRef.current) return;

      if (result.verified && result.freshData) {
        const inserted = await insertAccount(result.freshData);
        pollingActiveRef.current = false;
        setPolling(false);
        if (inserted) {
          showToast(t('accountSwitcher.verified', 'Ownership verified! Account added: {{name}} (K{{kingdom}})', { name: result.freshData.username, kingdom: result.freshData.kingdom }), 'success');
          resetAddFlow();
          await fetchAccounts();
        }
        return;
      }

      pollTimeoutRef.current = setTimeout(() => poll(attempt + 1), POLL_INTERVAL_MS);
    };

    await poll(1);
  };

  const resetAddFlow = () => {
    stopPolling();
    setShowAddInput(false);
    setNewPlayerId('');
    setVerifyStep(null);
    setVerifyCode('');
    setPendingPlayer(null);
    clearVerifyState();
  };

  useEffect(() => {
    return () => {
      pollingActiveRef.current = false;
      if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
    };
  }, []);

  // Don't show if user has no linked account at all, or only 1 account and no need to add
  if (loading || !user) return null;
  // Show if user has any accounts (even 1 — they might want to add more)
  if (accounts.length === 0 && !profile?.linked_player_id) return null;

  return (
    <Card
      padding={{ mobile: '1rem', desktop: '1.25rem' }}
      style={{ backgroundColor: colors.card, borderRadius: '12px' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: '600', color: colors.text }}>
          {t('accountSwitcher.title', 'Linked Accounts')}
        </h4>
        <span style={{ fontSize: '0.7rem', color: colors.textMuted }}>
          {accounts.length} {t('accountSwitcher.accountCount', 'account(s)')}
        </span>
      </div>

      {/* Account list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {accounts.map((account) => (
          <div
            key={account.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.6rem 0.75rem',
              borderRadius: '8px',
              backgroundColor: account.is_active ? `${colors.success}10` : colors.surface,
              border: `1px solid ${account.is_active ? `${colors.success}30` : colors.border}`,
              transition: transition.fast,
              cursor: account.is_active ? 'default' : 'pointer',
            }}
            onClick={() => !account.is_active && handleSwitch(account)}
          >
            {/* Avatar */}
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              backgroundColor: colors.card,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.9rem',
              border: `2px solid ${account.is_active ? colors.success : colors.border}`,
              overflow: 'hidden',
              flexShrink: 0,
            }}>
              {account.avatar_url ? (
                <img
                  src={account.avatar_url}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  referrerPolicy="no-referrer"
                />
              ) : '👤'}
            </div>

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: '0.85rem',
                fontWeight: '600',
                color: account.is_active ? colors.success : colors.text,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {account.username || account.player_id}
              </div>
              <div style={{ fontSize: '0.7rem', color: colors.textMuted }}>
                K{account.kingdom || '?'} · TC{account.tc_level || '?'}
              </div>
            </div>

            {/* Status / Actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
              {account.is_active ? (
                <span style={{
                  fontSize: '0.65rem',
                  padding: '0.15rem 0.4rem',
                  borderRadius: '4px',
                  backgroundColor: `${colors.success}20`,
                  color: colors.success,
                  fontWeight: '600',
                }}>
                  {t('accountSwitcher.active', 'ACTIVE')}
                </span>
              ) : (
                <>
                  {switching === account.id ? (
                    <span style={{ fontSize: '0.7rem', color: colors.textMuted }}>
                      {t('accountSwitcher.switching', 'Switching...')}
                    </span>
                  ) : (
                    <>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleSwitch(account); }}
                        style={{
                          padding: '0.25rem 0.5rem',
                          fontSize: '0.7rem',
                          borderRadius: '4px',
                          border: `1px solid ${colors.primary}40`,
                          backgroundColor: `${colors.primary}10`,
                          color: colors.primary,
                          cursor: 'pointer',
                          fontWeight: '600',
                          minHeight: isMobile ? '32px' : 'auto',
                        }}
                      >
                        {t('accountSwitcher.switch', 'Switch')}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRemoveAccount(account); }}
                        style={{
                          padding: '0.25rem 0.4rem',
                          fontSize: '0.7rem',
                          borderRadius: '4px',
                          border: `1px solid ${colors.error}30`,
                          backgroundColor: 'transparent',
                          color: colors.error,
                          cursor: 'pointer',
                          minHeight: isMobile ? '32px' : 'auto',
                        }}
                        title={t('accountSwitcher.remove', 'Remove')}
                      >
                        ✕
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add account */}
      {!showAddInput ? (
        <button
          onClick={() => { setShowAddInput(true); setVerifyStep('input'); }}
          style={{
            width: '100%',
            marginTop: '0.75rem',
            padding: '0.5rem',
            borderRadius: '8px',
            border: `1px dashed ${colors.border}`,
            backgroundColor: 'transparent',
            color: colors.textSecondary,
            fontSize: '0.8rem',
            cursor: 'pointer',
            transition: transition.fast,
            minHeight: isMobile ? '44px' : 'auto',
          }}
        >
          + {t('accountSwitcher.addAccount', 'Add Another Account')}
        </button>
      ) : verifyStep === 'input' ? (
        <div style={{ marginTop: '0.75rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              value={newPlayerId}
              onChange={(e) => setNewPlayerId(e.target.value.replace(/\D/g, ''))}
              placeholder={t('linkAccount.playerIdPlaceholder', 'Enter Player ID')}
              style={{
                flex: 1,
                padding: '0.5rem 0.75rem',
                borderRadius: '6px',
                border: `1px solid ${colors.border}`,
                backgroundColor: colors.surface,
                color: colors.text,
                fontSize: '0.85rem',
                outline: 'none',
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleVerifyPlayerId()}
              autoFocus
            />
            <button
              onClick={handleVerifyPlayerId}
              disabled={verifying || !newPlayerId.trim()}
              style={{
                padding: '0.5rem 0.75rem',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: colors.primary,
                color: '#000',
                fontSize: '0.8rem',
                fontWeight: '600',
                cursor: verifying ? 'not-allowed' : 'pointer',
                opacity: verifying || !newPlayerId.trim() ? 0.5 : 1,
                minHeight: isMobile ? '44px' : 'auto',
              }}
            >
              {verifying ? '...' : t('accountSwitcher.next', 'Next')}
            </button>
            <button
              onClick={resetAddFlow}
              style={{
                padding: '0.5rem',
                borderRadius: '6px',
                border: `1px solid ${colors.border}`,
                backgroundColor: 'transparent',
                color: colors.textMuted,
                fontSize: '0.8rem',
                cursor: 'pointer',
                minHeight: isMobile ? '44px' : 'auto',
              }}
            >
              ✕
            </button>
          </div>
          <p style={{ fontSize: '0.7rem', color: colors.textMuted, marginTop: '0.4rem' }}>
            {t('accountSwitcher.addHint', 'Enter the Player ID of your other in-game account. A quick ownership check will follow.')}
          </p>
        </div>
      ) : verifyStep === 'challenge' && pendingPlayer ? (
        <div style={{ marginTop: '0.75rem' }}>
          {/* Show found player */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            padding: '0.5rem 0.65rem',
            borderRadius: '6px',
            backgroundColor: colors.surface,
            marginBottom: '0.6rem',
          }}>
            <div style={{
              width: '28px', height: '28px', borderRadius: '50%',
              backgroundColor: colors.card, overflow: 'hidden', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem',
            }}>
              {pendingPlayer.avatar_url ? (
                <img src={pendingPlayer.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} referrerPolicy="no-referrer" />
              ) : '👤'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.8rem', fontWeight: '600', color: colors.text }}>{pendingPlayer.username}</div>
              <div style={{ fontSize: '0.65rem', color: colors.textMuted }}>K{pendingPlayer.kingdom ?? '?'} · TC{pendingPlayer.town_center_level ?? '?'}</div>
            </div>
          </div>

          {/* Verification instructions */}
          <div style={{
            padding: '0.75rem',
            borderRadius: '8px',
            backgroundColor: '#f59e0b10',
            border: '1px solid #f59e0b30',
            marginBottom: '0.6rem',
          }}>
            <p style={{ fontSize: '0.8rem', color: '#f59e0b', fontWeight: '600', margin: '0 0 0.4rem' }}>
              {t('accountSwitcher.verifyOwnership', 'Verify Ownership')}
            </p>
            <p style={{ fontSize: '0.7rem', color: colors.textMuted, margin: '0 0 0.4rem', lineHeight: 1.4 }}>
              {t('accountSwitcher.verifyWhy', 'This prevents players from falsely claiming others\' accounts.')}
            </p>
            <p style={{ fontSize: '0.75rem', color: colors.textSecondary, margin: '0 0 0.5rem', lineHeight: 1.5 }}>
              {t('accountSwitcher.verifyInstructions', 'To prove you own this account, temporarily add this code anywhere in your in-game name:')}
            </p>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              padding: '0.5rem',
              borderRadius: '6px',
              backgroundColor: '#111',
              fontFamily: 'monospace',
              fontSize: '1.2rem',
              fontWeight: 'bold',
              color: '#f59e0b',
              letterSpacing: '0.15em',
              userSelect: 'all',
            }}>
              {verifyCode}
            </div>
            <p style={{ fontSize: '0.65rem', color: colors.textMuted, margin: '0.4rem 0 0', lineHeight: 1.4 }}>
              {t('accountSwitcher.verifyNote', 'Example: "{{name}} {{code}}" — you can remove it after verification.', { name: pendingPlayer.username, code: verifyCode })}
            </p>
          </div>

          {polling ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', borderRadius: '6px', backgroundColor: '#f59e0b10', border: '1px solid #f59e0b30', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '1rem' }}>{pollCount % 2 === 0 ? '⏳' : '🔄'}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.8rem', color: '#f59e0b', fontWeight: '600' }}>
                    {t('accountSwitcher.polling', 'Checking your in-game name...')}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: colors.textMuted, marginTop: '0.15rem' }}>
                    {t('accountSwitcher.pollAttempt', 'Attempt {{count}} of {{max}} · Rechecking every {{seconds}}s', { count: pollCount, max: MAX_POLL_ATTEMPTS, seconds: Math.round(POLL_INTERVAL_MS / 1000) })}
                  </div>
                  {detectedName && (
                    <div style={{ fontSize: '0.65rem', color: colors.textMuted, marginTop: '0.25rem' }}>
                      {t('accountSwitcher.detectedName', 'Game server sees: "{{name}}"', { name: detectedName })}
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={stopPolling}
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '6px',
                  border: `1px solid ${colors.border}`,
                  backgroundColor: 'transparent',
                  color: colors.textMuted,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  minHeight: isMobile ? '44px' : 'auto',
                }}
              >
                {t('accountSwitcher.stopChecking', 'Stop Checking')}
              </button>
            </div>
          ) : pollTimedOut ? (
            <div>
              <div style={{ padding: '0.5rem 0.75rem', borderRadius: '6px', backgroundColor: '#ef444410', border: '1px solid #ef444430', marginBottom: '0.5rem' }}>
                <div style={{ fontSize: '0.8rem', color: '#ef4444', fontWeight: '600', marginBottom: '0.25rem' }}>
                  {t('accountSwitcher.timedOutTitle', 'Verification timed out')}
                </div>
                <div style={{ fontSize: '0.7rem', color: colors.textMuted, lineHeight: 1.4 }}>
                  {t('accountSwitcher.timedOutDesc', 'The game server may take a few minutes to update your name. Make sure "{{code}}" is in your in-game name and try again.', { code: verifyCode })}
                </div>
                {detectedName && (
                  <div style={{ fontSize: '0.7rem', color: colors.textMuted, marginTop: '0.25rem' }}>
                    {t('accountSwitcher.lastDetected', 'Last name seen: "{{name}}"', { name: detectedName })}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={startVerificationPolling}
                  style={{
                    flex: 1,
                    padding: '0.5rem 0.75rem',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: '#f59e0b',
                    color: '#000',
                    fontSize: '0.8rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    minHeight: isMobile ? '44px' : 'auto',
                  }}
                >
                  {t('accountSwitcher.retryVerify', 'Try Again')}
                </button>
                <button
                  onClick={resetAddFlow}
                  style={{
                    padding: '0.5rem',
                    borderRadius: '6px',
                    border: `1px solid ${colors.border}`,
                    backgroundColor: 'transparent',
                    color: colors.textMuted,
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    minHeight: isMobile ? '44px' : 'auto',
                  }}
                >
                  ✕
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={startVerificationPolling}
                style={{
                  flex: 1,
                  padding: '0.5rem 0.75rem',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: '#f59e0b',
                  color: '#000',
                  fontSize: '0.8rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  minHeight: isMobile ? '44px' : 'auto',
                }}
              >
                {t('accountSwitcher.verifyNow', 'I Changed My Name — Verify')}
              </button>
              <button
                onClick={resetAddFlow}
                style={{
                  padding: '0.5rem',
                  borderRadius: '6px',
                  border: `1px solid ${colors.border}`,
                  backgroundColor: 'transparent',
                  color: colors.textMuted,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  minHeight: isMobile ? '44px' : 'auto',
                }}
              >
                ✕
              </button>
            </div>
          )}
        </div>
      ) : null}
    </Card>
  );
};

export default AccountSwitcher;
