import React, { useState, useEffect, useCallback } from 'react';
import * as Sentry from '@sentry/react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useToast } from './Toast';
import { colors } from '../utils/styles';
import { Card } from './shared';
import { useTranslation } from 'react-i18next';
import { logger } from '../utils/logger';
import { checkAndAutoStepDown } from '../services/editorSuccessionService';
import { AccountRow, AddAccountFlow } from './account-switcher';
import type { PlayerAccount } from './account-switcher';

interface AccountSwitcherProps {
  onSwitch?: () => void;
}

const AccountSwitcher: React.FC<AccountSwitcherProps> = ({ onSwitch }) => {
  const { t } = useTranslation();
  const { user, profile, updateProfile } = useAuth();
  const { showToast } = useToast();
  const [accounts, setAccounts] = useState<PlayerAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState<string | null>(null);

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

      // Update profile linked fields (use ?? to preserve falsy-but-valid values like 0)
      const result = await updateProfile({
        linked_player_id: account.player_id,
        linked_username: account.username ?? undefined,
        linked_avatar_url: account.avatar_url ?? undefined,
        linked_kingdom: account.kingdom ?? undefined,
        linked_tc_level: account.tc_level ?? undefined,
        linked_last_synced: account.last_synced ?? undefined,
      });

      if (!result.success) {
        showToast(result.error || t('accountSwitcher.switchFailed', 'Failed to switch account'), 'error');
        return;
      }

      Sentry.addBreadcrumb({ category: 'account', message: 'Account switched', level: 'info', data: { player_id: account.player_id, kingdom: account.kingdom } });
      logger.info('[AccountSwitcher] Switched account', { player_id: account.player_id, kingdom: account.kingdom });
      showToast(t('accountSwitcher.switchedTo', 'Switched to {{name}} (K{{kingdom}})', { name: account.username || account.player_id, kingdom: account.kingdom || '?' }), 'success');

      // Auto step-down if user was editor of a different kingdom
      if (user.id && account.kingdom) {
        const stepDownResult = await checkAndAutoStepDown(user.id, account.kingdom);
        if (stepDownResult?.success) {
          if (stepDownResult.action === 'auto_promoted') {
            showToast(t('editor.autoStepDownPromoted', 'You were automatically stepped down as editor. {{name}} has been promoted.', { name: stepDownResult.promotedName }), 'info');
          } else if (stepDownResult.action === 'kingdom_unmanaged') {
            showToast(t('editor.autoStepDownUnmanaged', 'You were automatically stepped down as editor. The kingdom is now open for new claims.'), 'info');
          }
        }
      }

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

  // Don't show if user has no linked account at all, or only 1 account and no need to add
  if (loading || !user) return null;
  // Show if user has any accounts (even 1 — they might want to add more)
  if (accounts.length === 0 && !profile?.linked_player_id) return null;

  // Detect stale state: accounts exist but none is active (e.g., after unlink from Profile page)
  const hasStaleAccounts = accounts.length > 0 && !accounts.some(a => a.is_active);

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

      {/* Stale accounts hint — shown when user unlinked from Profile but still has player_accounts rows */}
      {hasStaleAccounts && (
        <div style={{
          padding: '0.5rem 0.75rem',
          borderRadius: '6px',
          backgroundColor: '#f59e0b10',
          border: '1px solid #f59e0b30',
          marginBottom: '0.75rem',
          fontSize: '0.7rem',
          color: '#f59e0b',
          lineHeight: 1.4,
        }}>
          {t('accountSwitcher.noActiveHint', 'No account is currently active. Switch to one below to re-link your profile.')}
        </div>
      )}

      {/* Account list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {accounts.map((account) => (
          <AccountRow
            key={account.id}
            account={account}
            isSwitching={switching === account.id}
            onSwitch={handleSwitch}
            onRemove={handleRemoveAccount}
          />
        ))}
      </div>

      {/* Add account flow */}
      <AddAccountFlow
        accounts={accounts}
        onAccountAdded={fetchAccounts}
      />
    </Card>
  );
};

export default AccountSwitcher;
