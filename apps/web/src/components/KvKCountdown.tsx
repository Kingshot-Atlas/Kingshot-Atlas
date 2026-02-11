import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

interface KvKCountdownProps {
  compact?: boolean;
  navbar?: boolean;
  type?: 'kvk' | 'transfer';
}

// KvK Schedule: Every 4 weeks (see EventCalendar.tsx for single source of truth)
// - Preparation: Monday 00:00 UTC to Saturday 10:00 UTC
// - Battle Phase: Saturday 10:00 UTC to Saturday 22:00 UTC
//   └─ Castle Battle: Saturday 12:00 UTC to Saturday 18:00 UTC (core competitive window)
//      Winning Castle Battle = Winning the "Battle Phase"
// Reference: KvK #10 started Monday, January 26, 2026 at 00:00 UTC
const KVK_REFERENCE_DATE = new Date('2026-01-26T00:00:00Z');
const KVK_CYCLE_MS = 28 * 24 * 60 * 60 * 1000;
const KVK_PREP_DURATION_MS = 5 * 24 * 60 * 60 * 1000 + 10 * 60 * 60 * 1000; // 5 days 10 hours (ends Saturday 10:00 UTC)
const KVK_BATTLE_DURATION_MS = 12 * 60 * 60 * 1000; // 12 hours (10:00 - 22:00 UTC)
const KVK_CASTLE_BATTLE_START_OFFSET_MS = 2 * 60 * 60 * 1000; // 2 hours after battle start (12:00 UTC)
const KVK_CASTLE_BATTLE_DURATION_MS = 6 * 60 * 60 * 1000; // 6 hours (12:00 - 18:00 UTC)

// Transfer Schedule: Every 8 weeks
// - Pre-Transfer: Sunday 00:00 UTC to Wednesday 00:00 UTC (3 days)
// - Invitational: Wednesday 00:00 UTC to Friday 00:00 UTC (2 days)
// - Open Transfer: Friday 00:00 UTC to Sunday 00:00 UTC (2 days)
// Reference: Transfer Event #3 started Sunday, January 4, 2026 at 00:00 UTC
const TRANSFER_REFERENCE_DATE = new Date('2026-01-04T00:00:00Z');
const TRANSFER_CYCLE_MS = 56 * 24 * 60 * 60 * 1000;
const TRANSFER_PRE_DURATION_MS = 3 * 24 * 60 * 60 * 1000;
const TRANSFER_INVITE_DURATION_MS = 2 * 24 * 60 * 60 * 1000;
const TRANSFER_OPEN_DURATION_MS = 2 * 24 * 60 * 60 * 1000;

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total: number;
}

type KvKPhase = 'countdown' | 'preparation' | 'battle' | 'castle-battle';
type TransferPhase = 'countdown' | 'pre-transfer' | 'invitational' | 'open';

interface EventStatus {
  phase: string;
  phaseName: string;
  timeLeft: TimeLeft;
  eventNumber: number;
  color: string;
  icon: string;
}

const calculateTimeLeft = (targetMs: number): TimeLeft => {
  const diff = targetMs;
  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, total: 0 };
  }
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
    minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
    seconds: Math.floor((diff % (1000 * 60)) / 1000),
    total: diff
  };
};

const getKvKStatus = (): EventStatus => {
  const now = Date.now();
  const refTime = KVK_REFERENCE_DATE.getTime();
  const timeSinceRef = now - refTime;
  const cycleNumber = Math.floor(timeSinceRef / KVK_CYCLE_MS);
  const positionInCycle = ((timeSinceRef % KVK_CYCLE_MS) + KVK_CYCLE_MS) % KVK_CYCLE_MS;
  
  const kvkNumber = 10 + cycleNumber;
  const prepEnd = KVK_PREP_DURATION_MS;
  const battleEnd = prepEnd + KVK_BATTLE_DURATION_MS;
  
  let phase: KvKPhase;
  let phaseName: string;
  let timeLeftMs: number;
  let color: string;
  let icon: string;
  
  // Castle Battle timing within Battle Phase
  const castleBattleStart = prepEnd + KVK_CASTLE_BATTLE_START_OFFSET_MS; // 12:00 UTC
  const castleBattleEnd = castleBattleStart + KVK_CASTLE_BATTLE_DURATION_MS; // 18:00 UTC
  
  if (positionInCycle < prepEnd) {
    phase = 'preparation';
    phaseName = 'Prep Phase';
    timeLeftMs = prepEnd - positionInCycle;
    color = '#fbbf24'; // Yellow
    icon = '🛡️';
  } else if (positionInCycle >= castleBattleStart && positionInCycle < castleBattleEnd) {
    // Castle Battle is active (12:00 - 18:00 UTC) - this is the core competitive window
    phase = 'castle-battle';
    phaseName = 'Castle Battle';
    timeLeftMs = castleBattleEnd - positionInCycle;
    color = '#dc2626'; // Bright Red
    icon = '🏰';
  } else if (positionInCycle < battleEnd) {
    phase = 'battle';
    phaseName = positionInCycle < castleBattleStart ? 'Battle Phase (Castle Soon)' : 'Battle Phase';
    timeLeftMs = positionInCycle < castleBattleStart ? castleBattleStart - positionInCycle : battleEnd - positionInCycle;
    color = '#ef4444'; // Red
    icon = '⚔️';
  } else {
    phase = 'countdown';
    phaseName = 'Next KvK';
    timeLeftMs = KVK_CYCLE_MS - positionInCycle;
    color = '#22d3ee'; // Cyan
    icon = '⚔️';
  }
  
  return {
    phase,
    phaseName,
    timeLeft: calculateTimeLeft(timeLeftMs),
    eventNumber: phase === 'countdown' ? kvkNumber + 1 : kvkNumber,
    color,
    icon
  };
};

const getTransferStatus = (): EventStatus => {
  const now = Date.now();
  const refTime = TRANSFER_REFERENCE_DATE.getTime();
  const timeSinceRef = now - refTime;
  const cycleNumber = Math.floor(timeSinceRef / TRANSFER_CYCLE_MS);
  const positionInCycle = ((timeSinceRef % TRANSFER_CYCLE_MS) + TRANSFER_CYCLE_MS) % TRANSFER_CYCLE_MS;
  
  const eventNumber = 3 + cycleNumber;
  const preEnd = TRANSFER_PRE_DURATION_MS;
  const inviteEnd = preEnd + TRANSFER_INVITE_DURATION_MS;
  const openEnd = inviteEnd + TRANSFER_OPEN_DURATION_MS;
  
  let phase: TransferPhase;
  let phaseName: string;
  let timeLeftMs: number;
  let color: string;
  let icon: string;
  
  if (positionInCycle < preEnd) {
    phase = 'pre-transfer';
    phaseName = 'Pre-Transfer';
    timeLeftMs = preEnd - positionInCycle;
    color = '#8b5cf6'; // Purple
    icon = '📋';
  } else if (positionInCycle < inviteEnd) {
    phase = 'invitational';
    phaseName = 'Invitational';
    timeLeftMs = inviteEnd - positionInCycle;
    color = '#f59e0b'; // Amber
    icon = '✉️';
  } else if (positionInCycle < openEnd) {
    phase = 'open';
    phaseName = 'Open Transfer';
    timeLeftMs = openEnd - positionInCycle;
    color = '#22c55e'; // Green
    icon = '🚀';
  } else {
    phase = 'countdown';
    phaseName = 'Next Transfer';
    timeLeftMs = TRANSFER_CYCLE_MS - positionInCycle;
    color = '#a855f7'; // Purple
    icon = '🚀';
  }
  
  return {
    phase,
    phaseName,
    timeLeft: calculateTimeLeft(timeLeftMs),
    eventNumber: phase === 'countdown' ? eventNumber + 1 : eventNumber,
    color,
    icon
  };
};

const KvKCountdown: React.FC<KvKCountdownProps> = ({ compact = false, navbar = false, type = 'kvk' }) => {
  const { t } = useTranslation();
  const [kvkStatus, setKvkStatus] = useState<EventStatus>(getKvKStatus());
  const [transferStatus, setTransferStatus] = useState<EventStatus>(getTransferStatus());

  const translatePhase = (phaseName: string): string => {
    const map: Record<string, string> = {
      'Prep Phase': t('countdown.prepPhase', 'Prep Phase'),
      'Castle Battle': t('countdown.castleBattle', 'Castle Battle'),
      'Battle Phase': t('countdown.battlePhase', 'Battle Phase'),
      'Battle Phase (Castle Soon)': t('countdown.battlePhaseCastleSoon', 'Battle Phase (Castle Soon)'),
      'Pre-Transfer': t('countdown.preTransferPhase', 'Pre-Transfer'),
      'Invitational': t('countdown.invitationalPhase', 'Invitational'),
      'Open Transfer': t('countdown.openTransferPhase', 'Open Transfer'),
      'Next KvK': t('countdown.nextKvk', 'Next KvK'),
      'Next Transfer': t('countdown.nextTransfer', 'Next Transfer'),
    };
    return map[phaseName] || phaseName;
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setKvkStatus(getKvKStatus());
      setTransferStatus(getTransferStatus());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatNumber = (n: number) => n.toString().padStart(2, '0');

  // Navbar variant - minimal
  if (navbar) {
    const status = type === 'kvk' ? kvkStatus : transferStatus;
    const isLive = status.phase !== 'countdown';

    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.4rem',
        padding: '0.3rem 0.6rem',
        backgroundColor: `${status.color}10`,
        borderRadius: '6px',
        border: `1px solid ${status.color}30`
      }}>
        <span style={{ fontSize: '0.8rem' }}>{status.icon}</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
          <span style={{ fontSize: '0.65rem', color: '#9ca3af', whiteSpace: 'nowrap', lineHeight: 1 }}>
            {translatePhase(status.phaseName)}
          </span>
          <div style={{ 
            fontSize: '0.8rem', 
            color: status.color, 
            fontWeight: '600', 
            fontFamily: 'monospace',
            whiteSpace: 'nowrap',
            lineHeight: 1.2
          }}>
            {isLive && <span style={{ marginRight: '0.25rem', animation: 'pulse 2s infinite' }}>●</span>}
            {`${status.timeLeft.days}d ${formatNumber(status.timeLeft.hours)}h ${formatNumber(status.timeLeft.minutes)}m ${formatNumber(status.timeLeft.seconds)}s`}
          </div>
        </div>
      </div>
    );
  }

  if (compact) {
    const status = type === 'kvk' ? kvkStatus : transferStatus;
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.5rem 0.75rem',
        backgroundColor: '#131318',
        borderRadius: '8px',
        border: '1px solid #2a2a2a'
      }}>
        <div>
          <div style={{ fontSize: '0.7rem', color: '#6b7280' }}>{translatePhase(status.phaseName)}</div>
          <div style={{ fontSize: '0.85rem', color: status.color, fontWeight: '600', fontFamily: 'monospace' }}>
            {`${status.timeLeft.days}d ${formatNumber(status.timeLeft.hours)}h ${formatNumber(status.timeLeft.minutes)}m`}
          </div>
        </div>
      </div>
    );
  }

  // Full variant - renders one or both events depending on type prop
  const renderEventCard = (status: EventStatus, title: string, singleMode = false) => {
    const isLive = status.phase !== 'countdown';
    
    return (
      <div style={{ marginBottom: singleMode ? 0 : '1.5rem' }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          marginBottom: singleMode ? '0.5rem' : '1rem',
          gap: '0.5rem',
        }}>
          <span style={{ fontSize: singleMode ? '1rem' : '1.5rem' }}>{status.icon}</span>
          {status.phase === 'countdown' ? (
            <h3 style={{ margin: 0, color: '#fff', fontSize: singleMode ? '0.85rem' : '1rem', fontWeight: '600' }}>
              {t('countdown.nextEvent', 'Next {{title}} Event', { title })}
            </h3>
          ) : (
            <>
              <h3 style={{ margin: 0, color: '#fff', fontSize: singleMode ? '0.85rem' : '1rem', fontWeight: '600' }}>
                {title} #{status.eventNumber}
              </h3>
              <span style={{ 
                color: status.color, 
                fontSize: singleMode ? '0.7rem' : '0.8rem',
                fontWeight: '500'
              }}>
                {translatePhase(status.phaseName)}
              </span>
            </>
          )}
          {isLive && (
            <span style={{ 
              padding: '0.1rem 0.35rem',
              backgroundColor: `${status.color}20`,
              borderRadius: '4px',
              fontSize: '0.65rem',
              color: status.color,
              fontWeight: '600',
            }}>
              {t('countdown.live', 'LIVE')}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: singleMode ? '0.5rem' : '0.75rem', justifyContent: 'center' }}>
          {[
            { value: status.timeLeft.days, label: t('countdown.days', 'Days') },
            { value: status.timeLeft.hours, label: t('countdown.hours', 'Hours') },
            { value: status.timeLeft.minutes, label: t('countdown.min', 'Min') },
            { value: status.timeLeft.seconds, label: t('countdown.sec', 'Sec') }
          ].map((item, i) => (
            <div key={i} style={{
              backgroundColor: '#1a1a20',
              borderRadius: singleMode ? '8px' : '10px',
              padding: singleMode ? '0.4rem 0.6rem' : '0.75rem 1rem',
              minWidth: singleMode ? '48px' : '60px',
              textAlign: 'center',
              border: isLive ? `1px solid ${status.color}30` : 'none'
            }}>
              <div style={{
                fontSize: singleMode ? '1.1rem' : '1.5rem',
                fontWeight: '700',
                color: status.color,
                fontFamily: 'monospace',
                textShadow: `0 0 10px ${status.color}30`
              }}>
                {formatNumber(item.value)}
              </div>
              <div style={{ fontSize: '0.6rem', color: '#6b7280', textTransform: 'uppercase' }}>
                {item.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Single-event mode: render only the specified type with a lighter wrapper
  if (type === 'transfer') {
    return (
      <div style={{
        backgroundColor: '#131318',
        borderRadius: '12px',
        border: '1px solid #2a2a2a',
        padding: '0.75rem 1rem',
        display: 'inline-block',
      }}>
        {renderEventCard(transferStatus, 'Transfer', true)}
      </div>
    );
  }

  if (type === 'kvk') {
    return (
      <div style={{
        backgroundColor: '#131318',
        borderRadius: '12px',
        border: '1px solid #2a2a2a',
        padding: '0.75rem 1rem',
        display: 'inline-block',
      }}>
        {renderEventCard(kvkStatus, 'KvK', true)}
      </div>
    );
  }

  // Default: both events
  return (
    <div style={{
      backgroundColor: '#131318',
      borderRadius: '16px',
      border: '1px solid #2a2a2a',
      padding: '1.5rem',
      marginBottom: '1.5rem'
    }}>
      {renderEventCard(kvkStatus, 'KvK')}
      <div style={{ height: '1px', backgroundColor: '#2a2a2a', margin: '1rem 0' }} />
      {renderEventCard(transferStatus, 'Transfer')}
    </div>
  );
};

export { getKvKStatus, getTransferStatus };
export type { EventStatus };
export default KvKCountdown;
