import React from 'react';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { colors, transition } from '../../utils/styles';
import { useTranslation } from 'react-i18next';
import type { PlayerAccount } from './types';

interface AccountRowProps {
  account: PlayerAccount;
  isSwitching: boolean;
  onSwitch: (account: PlayerAccount) => void;
  onRemove: (account: PlayerAccount) => void;
}

const AccountRow: React.FC<AccountRowProps> = ({ account, isSwitching, onSwitch, onRemove }) => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();

  return (
    <div
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
      onClick={() => !account.is_active && onSwitch(account)}
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
            {isSwitching ? (
              <span style={{ fontSize: '0.7rem', color: colors.textMuted }}>
                {t('accountSwitcher.switching', 'Switching...')}
              </span>
            ) : (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); onSwitch(account); }}
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
                  onClick={(e) => { e.stopPropagation(); onRemove(account); }}
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
  );
};

export default AccountRow;
