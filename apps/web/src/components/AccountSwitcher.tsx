import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useIsMobile } from '../hooks/useMediaQuery';
import { useToast } from './Toast';
import { colors, transition } from '../utils/styles';
import { Card } from './shared';
import { useTranslation } from 'react-i18next';
import { logger } from '../utils/logger';

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

interface AccountSwitcherProps {
  onSwitch?: () => void;
}

const AccountSwitcher: React.FC<AccountSwitcherProps> = ({ onSwitch }) => {
  const { t } = useTranslation();
  const { user, profile, updateProfile } = useAuth();
  const isMobile = useIsMobile();
  const { showToast } = useToast();
  const [accounts, setAccounts] = useState<PlayerAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState<string | null>(null);
  const [showAddInput, setShowAddInput] = useState(false);
  const [newPlayerId, setNewPlayerId] = useState('');
  const [verifying, setVerifying] = useState(false);
  // Name verification challenge state
  const [verifyStep, setVerifyStep] = useState<'input' | 'challenge' | null>(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [pendingPlayer, setPendingPlayer] = useState<{ player_id: string; username: string; avatar_url: string; kingdom: number; town_center_level: number } | null>(null);
  const [checking, setChecking] = useState(false);

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
      const response = await fetch(`${API_BASE}/api/v1/player-link/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

  // Step 2: Re-verify to check if name now contains the code
  const handleCheckVerification = async () => {
    if (!supabase || !user?.id || !pendingPlayer) return;
    setChecking(true);
    try {
      const response = await fetch(`${API_BASE}/api/v1/player-link/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player_id: pendingPlayer.player_id }),
      });

      if (!response.ok) throw new Error('Verification failed');
      const freshData = await response.json();

      // Check if the current in-game name contains the verification code
      const nameUpper = (freshData.username || '').toUpperCase();
      if (!nameUpper.includes(verifyCode)) {
        showToast(t('accountSwitcher.codeNotFound', 'Code "{{code}}" not found in your in-game name. Change your name to include it, wait a moment, then try again.', { code: verifyCode }), 'error');
        return;
      }

      // Ownership verified — insert account
      const { error } = await supabase
        .from('player_accounts')
        .insert({
          user_id: user.id,
          player_id: pendingPlayer.player_id,
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
          throw error;
        }
        return;
      }

      showToast(t('accountSwitcher.verified', 'Ownership verified! Account added: {{name}} (K{{kingdom}})', { name: freshData.username, kingdom: freshData.kingdom }), 'success');
      resetAddFlow();
      await fetchAccounts();
    } catch (err) {
      logger.error('Failed to check verification:', err);
      showToast(err instanceof Error ? err.message : t('accountSwitcher.addFailed', 'Failed to add account'), 'error');
    } finally {
      setChecking(false);
    }
  };

  const resetAddFlow = () => {
    setShowAddInput(false);
    setNewPlayerId('');
    setVerifyStep(null);
    setVerifyCode('');
    setPendingPlayer(null);
  };

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

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={handleCheckVerification}
              disabled={checking}
              style={{
                flex: 1,
                padding: '0.5rem 0.75rem',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: '#f59e0b',
                color: '#000',
                fontSize: '0.8rem',
                fontWeight: '600',
                cursor: checking ? 'not-allowed' : 'pointer',
                opacity: checking ? 0.5 : 1,
                minHeight: isMobile ? '44px' : 'auto',
              }}
            >
              {checking ? t('accountSwitcher.checking', 'Checking...') : t('accountSwitcher.verifyNow', 'I Changed My Name — Verify')}
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
      ) : null}
    </Card>
  );
};

export default AccountSwitcher;
