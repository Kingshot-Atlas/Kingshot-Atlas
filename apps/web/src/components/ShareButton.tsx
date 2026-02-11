import React, { useState, useRef, useEffect, useCallback, lazy, Suspense } from 'react';
import { useAnalytics } from '../hooks/useAnalytics';
import { useIsMobile } from '../hooks/useMediaQuery';
import { useAuth } from '../contexts/AuthContext';
import { isReferralEligible } from '../utils/constants';
import { useTranslation } from 'react-i18next';
import { incrementStat } from './UserAchievements';
import {
  copyToClipboard,
  copyImageToClipboard,
  downloadBlob,
  generateKingdomCard,
  generateComparisonCard,
  generateShareUrl,
  generateDiscordMessage,
  generateEmbedCode,
  shareNative
} from '../utils/sharing';

// Lazy load QR code component
const QRCode = lazy(() => import('./QRCode'));

interface ShareButtonProps {
  type: 'kingdom' | 'compare';
  kingdomData?: {
    number: number;
    score: number;
    tier: string;
    rank: number;
    prepWinRate: number;
    battleWinRate: number;
    totalKvks: number;
  };
  compareData?: {
    kingdom1: { number: number; score: number; tier: string };
    kingdom2: { number: number; score: number; tier: string };
    winner: 'kingdom1' | 'kingdom2' | 'tie';
  };
}

const ShareButton: React.FC<ShareButtonProps> = ({ type, kingdomData, compareData }) => {
  const { t } = useTranslation();
  const [showMenu, setShowMenu] = useState(false);
  const [copying, setCopying] = useState<string | null>(null);
  const [showEmbedCode, setShowEmbedCode] = useState(false);
  const [showQRCode, setShowQRCode] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { trackFeature } = useAnalytics();
  const { profile } = useAuth();
  const isMobile = useIsMobile();

  // Auto-append ?ref= for referral-eligible users
  const refParam = profile && isReferralEligible(profile) && profile.linked_username
    ? profile.linked_username : null;

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
        setShowEmbedCode(false);
      }
    };
    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  const showFeedback = useCallback((action: string) => {
    setCopying(action);
    setTimeout(() => setCopying(null), 2000);
  }, []);

  const handleCopyLink = useCallback(async () => {
    let url: string;
    if (type === 'kingdom' && kingdomData) {
      const params: Record<string, string | number> = {};
      if (refParam) params.ref = refParam;
      url = generateShareUrl(`/kingdom/${kingdomData.number}`, params);
    } else if (type === 'compare' && compareData) {
      const params: Record<string, string | number> = {
        k1: compareData.kingdom1.number,
        k2: compareData.kingdom2.number,
      };
      if (refParam) params.ref = refParam;
      url = generateShareUrl('/compare', params);
    } else {
      url = window.location.href;
    }

    const success = await copyToClipboard(url);
    if (success) {
      showFeedback('link');
      trackFeature('Share Link Copied', { type, hasReferral: !!refParam });
      incrementStat('linksShared');
    }
  }, [type, kingdomData, compareData, showFeedback, trackFeature, refParam]);

  const handleCopyDiscord = useCallback(async () => {
    if (type === 'kingdom' && kingdomData) {
      const message = generateDiscordMessage(
        kingdomData.number,
        kingdomData.score,
        kingdomData.tier,
        kingdomData.rank
      );
      const success = await copyToClipboard(message);
      if (success) {
        showFeedback('discord');
        trackFeature('Share Discord Copied', { type });
      }
    }
  }, [type, kingdomData, showFeedback, trackFeature]);

  const handleCopyImage = useCallback(async () => {
    try {
      let blob: Blob;
      const filename = type === 'kingdom' && kingdomData
        ? `kingdom-${kingdomData.number}.png`
        : 'comparison.png';
      
      if (type === 'kingdom' && kingdomData) {
        blob = await generateKingdomCard(
          kingdomData.number,
          kingdomData.score,
          kingdomData.tier,
          kingdomData.rank,
          kingdomData.prepWinRate,
          kingdomData.battleWinRate,
          kingdomData.totalKvks
        );
      } else if (type === 'compare' && compareData) {
        blob = await generateComparisonCard(
          compareData.kingdom1,
          compareData.kingdom2,
          compareData.winner
        );
      } else {
        return;
      }

      // Pass filename to copyImageToClipboard for mobile share
      const success = await copyImageToClipboard(blob, filename);
      if (success) {
        // On mobile, Web Share API was used (shows share sheet)
        showFeedback(isMobile ? 'shared' : 'image');
        trackFeature(isMobile ? 'Share Image Shared' : 'Share Image Copied', { type });
      } else {
        // Fallback to download if clipboard/share not supported
        downloadBlob(blob, filename);
        showFeedback('downloaded');
        trackFeature('Share Image Downloaded', { type });
      }
    } catch (err) {
      console.error('Failed to generate image:', err);
    }
  }, [type, kingdomData, compareData, showFeedback, trackFeature, isMobile]);

  const handleDownloadImage = useCallback(async () => {
    try {
      let blob: Blob;
      
      if (type === 'kingdom' && kingdomData) {
        blob = await generateKingdomCard(
          kingdomData.number,
          kingdomData.score,
          kingdomData.tier,
          kingdomData.rank,
          kingdomData.prepWinRate,
          kingdomData.battleWinRate,
          kingdomData.totalKvks
        );
      } else if (type === 'compare' && compareData) {
        blob = await generateComparisonCard(
          compareData.kingdom1,
          compareData.kingdom2,
          compareData.winner
        );
      } else {
        return;
      }

      const filename = type === 'kingdom' && kingdomData
        ? `kingdom-${kingdomData.number}.png`
        : 'comparison.png';
      downloadBlob(blob, filename);
      showFeedback('downloaded');
      trackFeature('Share Image Downloaded', { type });
    } catch (err) {
      console.error('Failed to generate image:', err);
    }
  }, [type, kingdomData, compareData, showFeedback, trackFeature]);

  const handleNativeShare = useCallback(async () => {
    let url: string;
    if (type === 'kingdom' && kingdomData) {
      const params: Record<string, string | number> = {};
      if (refParam) params.ref = refParam;
      url = generateShareUrl(`/kingdom/${kingdomData.number}`, params);
    } else if (type === 'compare' && compareData) {
      const params: Record<string, string | number> = {
        k1: compareData.kingdom1.number,
        k2: compareData.kingdom2.number,
      };
      if (refParam) params.ref = refParam;
      url = generateShareUrl('/compare', params);
    } else {
      url = window.location.href;
    }

    const title = type === 'kingdom' && kingdomData
      ? `Kingdom #${kingdomData.number} - Kingshot Atlas`
      : 'Kingdom Comparison - Kingshot Atlas';

    const text = type === 'kingdom' && kingdomData
      ? `Check out Kingdom #${kingdomData.number} with Atlas Score ${kingdomData.score.toFixed(1)}`
      : 'Compare kingdoms on Kingshot Atlas';

    const success = await shareNative({ title, text, url });
    if (success) {
      trackFeature('Native Share Used', { type });
      setShowMenu(false);
    }
  }, [type, kingdomData, compareData, trackFeature, refParam]);

  const handleCopyEmbed = useCallback(async () => {
    if (type === 'kingdom' && kingdomData) {
      const embedCode = generateEmbedCode(kingdomData.number);
      const success = await copyToClipboard(embedCode);
      if (success) {
        showFeedback('embed');
        trackFeature('Share Embed Copied', { type });
      }
    }
  }, [type, kingdomData, showFeedback, trackFeature]);

  const menuItems = [
    {
      icon: '🔗',
      label: t('share.copyLink', 'Copy Link'),
      action: handleCopyLink,
      feedback: 'link',
      feedbackText: t('share.linkCopied', 'Link copied!')
    },
    ...(type === 'kingdom' ? [{
      icon: '💬',
      label: t('share.copyForDiscord', 'Copy for Discord'),
      action: handleCopyDiscord,
      feedback: 'discord',
      feedbackText: t('share.discordCopied', 'Discord message copied!')
    }] : []),
    {
      icon: '📷',
      label: isMobile ? t('share.shareImage', 'Share Image') : t('share.copyAsImage', 'Copy as Image'),
      action: handleCopyImage,
      feedback: isMobile ? 'shared' : 'image',
      feedbackText: isMobile ? t('share.sharing', 'Sharing...') : t('share.imageCopied', 'Image copied!')
    },
    {
      icon: '⬇️',
      label: t('share.downloadPNG', 'Download PNG'),
      action: handleDownloadImage,
      feedback: 'downloaded',
      feedbackText: t('share.downloaded', 'Downloaded!')
    },
    ...(type === 'kingdom' ? [{
      icon: '📋',
      label: t('share.getEmbedCode', 'Get Embed Code'),
      action: () => setShowEmbedCode(true),
      feedback: 'embed',
      feedbackText: t('share.embedCopied', 'Embed code copied!')
    }] : []),
    {
      icon: '📱',
      label: t('share.showQRCode', 'Show QR Code'),
      action: () => setShowQRCode(true),
      feedback: 'qr',
      feedbackText: t('share.qrShown', 'QR Code shown!')
    },
    ...(typeof navigator !== 'undefined' && 'share' in navigator ? [{
      icon: '📤',
      label: t('share.shareNative', 'Share...'),
      action: handleNativeShare,
      feedback: 'native',
      feedbackText: t('share.shared', 'Shared!')
    }] : [])
  ];

  return (
    <div style={{ position: 'relative' }} ref={menuRef}>
      <button
        onClick={() => setShowMenu(!showMenu)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          padding: isMobile ? '0.35rem 0.6rem' : '0.5rem 0.75rem',
          backgroundColor: showMenu ? '#22d3ee20' : '#1a1a1a',
          border: `1px solid ${showMenu ? '#22d3ee40' : '#333'}`,
          borderRadius: '6px',
          color: showMenu ? '#22d3ee' : '#9ca3af',
          cursor: 'pointer',
          fontSize: isMobile ? '0.75rem' : '0.85rem',
          fontWeight: '500',
          transition: 'all 0.2s'
        }}
        onMouseEnter={(e) => {
          if (!showMenu) {
            e.currentTarget.style.backgroundColor = '#22d3ee15';
            e.currentTarget.style.borderColor = '#22d3ee30';
            e.currentTarget.style.color = '#22d3ee';
          }
        }}
        onMouseLeave={(e) => {
          if (!showMenu) {
            e.currentTarget.style.backgroundColor = '#1a1a1a';
            e.currentTarget.style.borderColor = '#333';
            e.currentTarget.style.color = '#9ca3af';
          }
        }}
        aria-label="Share options"
        aria-expanded={showMenu}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
        </svg>
        {t('common.share', 'Share')}
      </button>

      {showMenu && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: '0.5rem',
            backgroundColor: '#0a0a0a',
            border: '1px solid #2a2a2a',
            borderRadius: '8px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            minWidth: '200px',
            zIndex: 1000,
            overflow: 'hidden'
          }}
        >
          {showQRCode ? (
            <div style={{ padding: '1rem', textAlign: 'center' }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                marginBottom: '0.75rem'
              }}>
                <span style={{ color: '#fff', fontSize: '0.85rem', fontWeight: '600' }}>
                  {t('share.qrCode', 'QR Code')}
                </span>
                <button
                  onClick={() => setShowQRCode(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#6b7280',
                    cursor: 'pointer',
                    fontSize: '1.2rem',
                    padding: 0
                  }}
                >
                  ×
                </button>
              </div>
              <Suspense fallback={<div style={{ color: '#6b7280', padding: '2rem' }}>{t('common.loading', 'Loading...')}</div>}>
                <QRCode 
                  value={type === 'kingdom' && kingdomData 
                    ? `https://ks-atlas.com/kingdom/${kingdomData.number}`
                    : type === 'compare' && compareData
                      ? `https://ks-atlas.com/compare?kingdoms=${compareData.kingdom1.number},${compareData.kingdom2.number}`
                      : window.location.href
                  }
                  size={160}
                  bgColor="#ffffff"
                  fgColor="#000000"
                />
              </Suspense>
              <p style={{ color: '#6b7280', fontSize: '0.7rem', marginTop: '0.75rem' }}>
                {t('share.scanToOpen', 'Scan to open on mobile')}
              </p>
            </div>
          ) : showEmbedCode && type === 'kingdom' && kingdomData ? (
            <div style={{ padding: '1rem' }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                marginBottom: '0.75rem'
              }}>
                <span style={{ color: '#fff', fontSize: '0.85rem', fontWeight: '600' }}>
                  {t('share.embedCode', 'Embed Code')}
                </span>
                <button
                  onClick={() => setShowEmbedCode(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#6b7280',
                    cursor: 'pointer',
                    fontSize: '1.2rem',
                    padding: 0
                  }}
                >
                  ×
                </button>
              </div>
              <textarea
                readOnly
                value={generateEmbedCode(kingdomData.number)}
                style={{
                  width: '100%',
                  height: '80px',
                  backgroundColor: '#131318',
                  border: '1px solid #333',
                  borderRadius: '4px',
                  color: '#9ca3af',
                  fontSize: '0.7rem',
                  fontFamily: 'monospace',
                  padding: '0.5rem',
                  resize: 'none'
                }}
              />
              <button
                onClick={handleCopyEmbed}
                style={{
                  width: '100%',
                  marginTop: '0.5rem',
                  padding: '0.5rem',
                  backgroundColor: copying === 'embed' ? '#22c55e' : '#22d3ee',
                  border: 'none',
                  borderRadius: '4px',
                  color: '#000',
                  fontWeight: '600',
                  cursor: 'pointer',
                  fontSize: '0.8rem'
                }}
              >
                {copying === 'embed' ? t('share.copied', '✓ Copied!') : t('share.copyCode', 'Copy Code')}
              </button>
            </div>
          ) : (
            <>
              <div style={{ 
                padding: '0.5rem 0.75rem', 
                borderBottom: '1px solid #2a2a2a',
                color: '#6b7280',
                fontSize: '0.7rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                {t('share.shareType', 'Share {{type}}', { type: type === 'kingdom' ? t('common.kingdom', 'Kingdom') : t('share.comparison', 'Comparison') })}
              </div>
              {menuItems.map((item, i) => (
                <button
                  key={i}
                  onClick={item.action}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    width: '100%',
                    padding: '0.65rem 0.75rem',
                    backgroundColor: copying === item.feedback ? '#22c55e20' : 'transparent',
                    border: 'none',
                    color: copying === item.feedback ? '#22c55e' : '#e5e5e5',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    textAlign: 'left',
                    transition: 'background-color 0.15s'
                  }}
                  onMouseEnter={(e) => {
                    if (copying !== item.feedback) {
                      e.currentTarget.style.backgroundColor = '#1a1a1a';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (copying !== item.feedback) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  <span style={{ fontSize: '1rem' }}>{item.icon}</span>
                  <span>{copying === item.feedback ? item.feedbackText : item.label}</span>
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default ShareButton;
