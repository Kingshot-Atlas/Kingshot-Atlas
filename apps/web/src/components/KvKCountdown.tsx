import React, { useState, useEffect } from 'react';

interface KvKCountdownProps {
  compact?: boolean;
  navbar?: boolean;
  type?: 'kvk' | 'transfer';
}

// Kingshot KvK cycles every 4 weeks
// Next KvK: Jan 31, 2026 at 12:00 UTC
// Transfer Event: Mar 2, 2026
const NEXT_KVK_DATE = new Date('2026-01-31T12:00:00Z');
const TRANSFER_EVENT_DATE = new Date('2026-03-02T00:00:00Z');

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total: number;
}

const calculateTimeLeft = (targetDate: Date): TimeLeft => {
  const now = new Date().getTime();
  const target = targetDate.getTime();
  const diff = target - now;

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

const KvKCountdown: React.FC<KvKCountdownProps> = ({ compact = false, navbar = false, type = 'kvk' }) => {
  const [kvkTimeLeft, setKvkTimeLeft] = useState<TimeLeft>(calculateTimeLeft(NEXT_KVK_DATE));
  const [transferTimeLeft, setTransferTimeLeft] = useState<TimeLeft>(calculateTimeLeft(TRANSFER_EVENT_DATE));

  useEffect(() => {
    const timer = setInterval(() => {
      setKvkTimeLeft(calculateTimeLeft(NEXT_KVK_DATE));
      setTransferTimeLeft(calculateTimeLeft(TRANSFER_EVENT_DATE));
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatNumber = (n: number) => n.toString().padStart(2, '0');

  // Navbar variant - minimal, fits in header
  if (navbar) {
    const isKvK = type === 'kvk';
    const timeLeft = isKvK ? kvkTimeLeft : transferTimeLeft;
    const label = isKvK ? 'Next KvK' : 'Next Transfer';
    const color = isKvK ? '#22d3ee' : '#a855f7';
    const liveText = isKvK ? 'LIVE' : 'OPEN';

    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.4rem',
        padding: '0.3rem 0.6rem',
        backgroundColor: `${color}08`,
        borderRadius: '6px',
        border: `1px solid ${color}30`
      }}>
        <span style={{ fontSize: '0.7rem', color: '#9ca3af', whiteSpace: 'nowrap' }}>{label}</span>
        <div style={{ 
          fontSize: '0.8rem', 
          color: color, 
          fontWeight: '600', 
          fontFamily: 'monospace',
          whiteSpace: 'nowrap'
        }}>
          {timeLeft.total > 0 
            ? `${timeLeft.days}d ${formatNumber(timeLeft.hours)}h ${formatNumber(timeLeft.minutes)}m`
            : liveText
          }
        </div>
      </div>
    );
  }

  if (compact) {
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
          <div style={{ fontSize: '0.7rem', color: '#6b7280' }}>Next KvK</div>
          <div style={{ fontSize: '0.85rem', color: '#22d3ee', fontWeight: '600', fontFamily: 'monospace' }}>
            {kvkTimeLeft.total > 0 
              ? `${kvkTimeLeft.days}d ${formatNumber(kvkTimeLeft.hours)}h ${formatNumber(kvkTimeLeft.minutes)}m`
              : 'LIVE'
            }
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      backgroundColor: '#131318',
      borderRadius: '16px',
      border: '1px solid #2a2a2a',
      padding: '1.5rem',
      marginBottom: '1.5rem'
    }}>
      {/* KvK Countdown */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '0.5rem',
          marginBottom: '1rem'
        }}>
          <span style={{ fontSize: '1.5rem' }}>⚔️</span>
          <div>
            <h3 style={{ margin: 0, color: '#fff', fontSize: '1rem', fontWeight: '600' }}>
              Next KvK
            </h3>
            <div style={{ color: '#6b7280', fontSize: '0.8rem' }}>
              {NEXT_KVK_DATE.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
          </div>
        </div>

        {kvkTimeLeft.total > 0 ? (
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
            {[
              { value: kvkTimeLeft.days, label: 'Days' },
              { value: kvkTimeLeft.hours, label: 'Hours' },
              { value: kvkTimeLeft.minutes, label: 'Min' },
              { value: kvkTimeLeft.seconds, label: 'Sec' }
            ].map((item, i) => (
              <div key={i} style={{
                backgroundColor: '#1a1a20',
                borderRadius: '10px',
                padding: '0.75rem 1rem',
                minWidth: '60px',
                textAlign: 'center'
              }}>
                <div style={{
                  fontSize: '1.5rem',
                  fontWeight: '700',
                  color: '#22d3ee',
                  fontFamily: 'monospace',
                  textShadow: '0 0 10px rgba(34, 211, 238, 0.3)'
                }}>
                  {formatNumber(item.value)}
                </div>
                <div style={{ fontSize: '0.65rem', color: '#6b7280', textTransform: 'uppercase' }}>
                  {item.label}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{
            textAlign: 'center',
            padding: '1rem',
            backgroundColor: '#22c55e20',
            borderRadius: '8px',
            border: '1px solid #22c55e50'
          }}>
            <span style={{ color: '#22c55e', fontWeight: '600', fontSize: '1.1rem' }}>
              🎉 KvK is LIVE!
            </span>
          </div>
        )}
      </div>

      {/* Divider */}
      <div style={{ height: '1px', backgroundColor: '#2a2a2a', margin: '1rem 0' }} />

      {/* Transfer Event Countdown */}
      <div>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '0.5rem',
          marginBottom: '1rem'
        }}>
          <span style={{ fontSize: '1.5rem' }}>🚀</span>
          <div>
            <h3 style={{ margin: 0, color: '#fff', fontSize: '1rem', fontWeight: '600' }}>
              Transfer Event
            </h3>
            <div style={{ color: '#6b7280', fontSize: '0.8rem' }}>
              {TRANSFER_EVENT_DATE.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
          </div>
        </div>

        {transferTimeLeft.total > 0 ? (
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
            {[
              { value: transferTimeLeft.days, label: 'Days' },
              { value: transferTimeLeft.hours, label: 'Hours' },
              { value: transferTimeLeft.minutes, label: 'Min' },
              { value: transferTimeLeft.seconds, label: 'Sec' }
            ].map((item, i) => (
              <div key={i} style={{
                backgroundColor: '#1a1a20',
                borderRadius: '10px',
                padding: '0.75rem 1rem',
                minWidth: '60px',
                textAlign: 'center'
              }}>
                <div style={{
                  fontSize: '1.5rem',
                  fontWeight: '700',
                  color: '#a855f7',
                  fontFamily: 'monospace',
                  textShadow: '0 0 10px rgba(168, 85, 247, 0.3)'
                }}>
                  {formatNumber(item.value)}
                </div>
                <div style={{ fontSize: '0.65rem', color: '#6b7280', textTransform: 'uppercase' }}>
                  {item.label}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{
            textAlign: 'center',
            padding: '1rem',
            backgroundColor: '#a855f720',
            borderRadius: '8px',
            border: '1px solid #a855f750'
          }}>
            <span style={{ color: '#a855f7', fontWeight: '600', fontSize: '1.1rem' }}>
              🚀 Transfer Event is OPEN!
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default KvKCountdown;
