import React, { useState, useEffect } from 'react';
import { getKvKStatus, getTransferStatus, EventStatus } from '../KvKCountdown';
import { useTranslation } from 'react-i18next';

const MobileCountdowns: React.FC = () => {
  const { t } = useTranslation();
  const [kvkStatus, setKvkStatus] = useState<EventStatus>(getKvKStatus());
  const [transferStatus, setTransferStatus] = useState<EventStatus>(getTransferStatus());

  useEffect(() => {
    const timer = setInterval(() => {
      setKvkStatus(getKvKStatus());
      setTransferStatus(getTransferStatus());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const pad = (n: number) => n.toString().padStart(2, '0');

  const formatTime = (s: EventStatus) => {
    const { days, hours, minutes, seconds } = s.timeLeft;
    if (days > 0) return `${days}d ${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;
    return `${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;
  };

  const kvkIsLive = kvkStatus.phase !== 'countdown';
  const transferIsLive = transferStatus.phase !== 'countdown';

  return (
    <div style={{
      display: 'flex',
      gap: '0.5rem',
      padding: '0 0.75rem 0.5rem',
    }}>
      {/* KvK Pill */}
      <div style={{
        flex: 1,
        padding: '0.5rem 0.6rem',
        borderRadius: '10px',
        background: `${kvkStatus.color}08`,
        border: `1px solid ${kvkStatus.color}25`,
        textAlign: 'center',
      }}>
        <div style={{
          fontSize: '0.6rem',
          color: '#9ca3af',
          textTransform: 'uppercase',
          marginBottom: '0.15rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.25rem',
        }}>
          {kvkStatus.icon} {kvkIsLive ? ({'Prep Phase': t('countdown.prepPhase', 'Prep Phase'), 'Castle Battle': t('countdown.castleBattle', 'Castle Battle'), 'Battle Phase': t('countdown.battlePhase', 'Battle Phase'), 'Battle Phase (Castle Soon)': t('countdown.battlePhaseCastleSoon', 'Battle Phase (Castle Soon)')}[kvkStatus.phaseName] || kvkStatus.phaseName) : t('countdown.nextKvk', 'Next KvK')}
          {kvkIsLive && (
            <span style={{
              color: kvkStatus.color,
              fontSize: '0.55rem',
              fontWeight: 700,
              animation: 'pulse 2s infinite',
            }}>
              {t('countdown.live', 'LIVE')}
            </span>
          )}
        </div>
        <div style={{
          color: kvkStatus.color,
          fontSize: '0.8rem',
          fontWeight: 600,
          fontFamily: 'monospace',
          fontVariantNumeric: 'tabular-nums',
        }}>
          {formatTime(kvkStatus)}
        </div>
      </div>

      {/* Transfer Pill */}
      <div style={{
        flex: 1,
        padding: '0.5rem 0.6rem',
        borderRadius: '10px',
        background: `${transferStatus.color}08`,
        border: `1px solid ${transferStatus.color}25`,
        textAlign: 'center',
      }}>
        <div style={{
          fontSize: '0.6rem',
          color: '#9ca3af',
          textTransform: 'uppercase',
          marginBottom: '0.15rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.25rem',
        }}>
          🔀 {transferIsLive ? ({'Pre-Transfer': t('countdown.preTransferPhase', 'Pre-Transfer'), 'Invitational': t('countdown.invitationalPhase', 'Invitational'), 'Open Transfer': t('countdown.openTransferPhase', 'Open Transfer')}[transferStatus.phaseName] || transferStatus.phaseName) : t('countdown.nextTransfer', 'Next Transfer')}
          {transferIsLive && (
            <span style={{
              color: transferStatus.color,
              fontSize: '0.55rem',
              fontWeight: 700,
              animation: 'pulse 2s infinite',
            }}>
              {t('countdown.live', 'LIVE')}
            </span>
          )}
        </div>
        <div style={{
          color: transferStatus.color,
          fontSize: '0.8rem',
          fontWeight: 600,
          fontFamily: 'monospace',
          fontVariantNumeric: 'tabular-nums',
        }}>
          {formatTime(transferStatus)}
        </div>
      </div>
    </div>
  );
};

export default MobileCountdowns;
