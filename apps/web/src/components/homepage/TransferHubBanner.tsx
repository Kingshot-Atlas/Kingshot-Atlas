import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { useTranslation } from 'react-i18next';
import { useAnalytics } from '../../hooks/useAnalytics';
import { getTransferStatus } from '../KvKCountdown';

const DISMISS_KEY = 'kingshot_transfer_banner_dismissed';
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // Re-show after 7 days

const TransferHubBanner: React.FC = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { trackFeature } = useAnalytics();
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState(() => {
    const ts = localStorage.getItem(DISMISS_KEY);
    if (!ts) return false;
    return Date.now() - parseInt(ts, 10) < DISMISS_DURATION_MS;
  });
  const [transferStatus, setTransferStatus] = useState(getTransferStatus());

  useEffect(() => {
    const timer = setInterval(() => {
      setTransferStatus(getTransferStatus());
    }, 60000); // Update every minute
    return () => clearInterval(timer);
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
    setDismissed(true);
    trackFeature('Transfer Banner Dismissed');
  };

  if (dismissed) return null;

  const formatTime = (days: number, hours: number) => {
    if (days > 0) return `${days}d ${hours}h`;
    return `${hours}h`;
  };

  const isLive = transferStatus.phase !== 'countdown';

  return (
    <div style={{
      maxWidth: '1200px',
      margin: '0 auto',
      padding: isMobile ? '0 0.75rem 0.5rem' : '0 2rem 0.75rem',
    }}>
      <div style={{
        background: 'linear-gradient(135deg, #0a1a0f 0%, #111 50%, #0f1a1a 100%)',
        border: '1px solid #22c55e40',
        borderRadius: '14px',
        padding: isMobile ? '1rem' : '1.25rem 1.5rem',
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        alignItems: isMobile ? 'flex-start' : 'center',
        justifyContent: 'space-between',
        gap: isMobile ? '0.75rem' : '1rem',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Subtle radial glow */}
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'radial-gradient(ellipse at 20% 50%, #22c55e08, transparent 70%)',
          pointerEvents: 'none',
        }} />

        {/* Dismiss button */}
        <button
          onClick={handleDismiss}
          style={{
            position: 'absolute',
            top: isMobile ? '0.4rem' : '0.5rem',
            right: isMobile ? '0.5rem' : '0.75rem',
            background: 'none',
            border: 'none',
            color: '#4b5563',
            cursor: 'pointer',
            fontSize: '1rem',
            zIndex: 2,
            padding: '0.25rem',
            lineHeight: 1,
          }}
          aria-label="Dismiss Transfer Hub banner"
        >
          ✕
        </button>

        {/* Content */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h3 style={{
            fontSize: isMobile ? '0.9rem' : '1.1rem',
            color: '#fff',
            marginBottom: '0.3rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontWeight: 600,
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ color: '#22c55e', flexShrink: 0 }}>
              <path d="M7 4L3 8L7 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M3 8H15C17.7614 8 20 10.2386 20 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <path d="M17 20L21 16L17 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M21 16H9C6.23858 16 4 13.7614 4 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            {isLive ? t('transferBanner.eventLive', 'Transfer Event is LIVE') : t('transferBanner.lookingToTransfer', 'Looking to transfer?')}
          </h3>
          <p style={{
            color: '#9ca3af',
            fontSize: isMobile ? '0.75rem' : '0.85rem',
            margin: 0,
          }}>
            {isLive
              ? <>{t('transferBanner.phaseActivePrefix', 'The ')}<span style={{ color: '#22c55e', fontWeight: 600 }}>{transferStatus.phaseName}</span>{t('transferBanner.phaseActiveSuffix', ' phase is active now.')}</>
              : <>{t('transferBanner.findPerfect', 'Find the perfect kingdom for you. No more blind transfers.')}</>
            }
          </p>
        </div>

        {/* Actions */}
        <div style={{
          display: 'flex',
          alignItems: isMobile ? 'center' : 'center',
          gap: isMobile ? '0.5rem' : '1rem',
          position: 'relative',
          zIndex: 1,
          width: isMobile ? '100%' : 'auto',
        }}>
          <div style={{
            padding: isMobile ? '0.4rem 0.6rem' : '0.5rem 0.75rem',
            background: '#0a0a0a',
            border: '1px solid #22c55e30',
            borderRadius: '8px',
            textAlign: 'center',
            flexShrink: 0,
          }}>
            <div style={{
              color: '#22c55e',
              fontSize: isMobile ? '0.85rem' : '1.1rem',
              fontWeight: 'bold',
              fontVariantNumeric: 'tabular-nums',
              fontFamily: 'monospace',
              lineHeight: 1.2,
            }}>
              {formatTime(transferStatus.timeLeft.days, transferStatus.timeLeft.hours)}
            </div>
            <div style={{
              color: '#6b7280',
              fontSize: '0.6rem',
              textTransform: 'uppercase',
              lineHeight: 1.2,
            }}>
              {isLive ? transferStatus.phaseName : t('transferBanner.nextTransfer', 'Next Transfer')}
            </div>
          </div>
          <button
            onClick={() => {
              trackFeature('Transfer Banner CTA Clicked');
              navigate('/transfer-hub');
            }}
            style={{
              padding: isMobile ? '0.6rem 1rem' : '0.65rem 1.25rem',
              background: '#22c55e',
              color: '#000',
              fontWeight: 600,
              border: 'none',
              borderRadius: '8px',
              fontSize: isMobile ? '0.8rem' : '0.9rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              boxShadow: '0 0 20px rgba(34, 197, 94, 0.25)',
              whiteSpace: 'nowrap',
              flex: isMobile ? 1 : 'none',
              justifyContent: 'center',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = '0 0 30px rgba(34, 197, 94, 0.4)';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = '0 0 20px rgba(34, 197, 94, 0.25)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            {t('transferBanner.browseHub', 'Browse Transfer Hub →')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TransferHubBanner;
