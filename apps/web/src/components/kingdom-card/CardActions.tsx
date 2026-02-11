import React, { useState, memo } from 'react';
import { Kingdom } from '../../types';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { useTranslation } from 'react-i18next';

interface CardActionsProps {
  kingdom: Kingdom;
  onCopyLink?: () => void;
  onAddToCompare?: (kingdomNumber: number) => void;
  cardRef: React.RefObject<HTMLDivElement | null>;
}

const CardActions: React.FC<CardActionsProps> = ({ 
  kingdom, 
  onCopyLink, 
  onAddToCompare,
  cardRef 
}) => {
  const [showPopup, setShowPopup] = useState(false);
  const { t } = useTranslation();
  const isMobile = useIsMobile();

  const handleCopyLink = () => {
    const url = `${window.location.origin}/kingdom/${kingdom.kingdom_number}`;
    navigator.clipboard.writeText(url);
    if (onCopyLink) onCopyLink();
    setShowPopup(false);
  };

  const handleCopyImage = async () => {
    setShowPopup(false);
    await new Promise(r => setTimeout(r, 50));
    if (cardRef.current) {
      try {
        const html2canvas = (await import('html2canvas')).default;
        const canvas = await html2canvas(cardRef.current, {
          backgroundColor: '#0a0a0a',
          scale: 2,
          logging: false,
          ignoreElements: (el) => el.classList.contains('share-popup')
        });
        
        // Convert canvas to blob
        const blob = await new Promise<Blob | null>((resolve) => {
          canvas.toBlob(resolve, 'image/png');
        });
        
        if (!blob) return;

        // Try clipboard first (works on desktop, some mobile browsers)
        let copied = false;
        if (navigator.clipboard?.write) {
          try {
            await navigator.clipboard.write([
              new ClipboardItem({ 'image/png': blob })
            ]);
            copied = true;
            if (onCopyLink) onCopyLink();
          } catch {
            // Clipboard failed — try alternatives below
          }
        }
        
        // Mobile fallback: try Web Share API (native share sheet)
        if (!copied && isMobile && navigator.share) {
          try {
            const file = new File([blob], `Kingdom-${kingdom.kingdom_number}.png`, { type: 'image/png' });
            await navigator.share({ files: [file] });
            copied = true;
          } catch {
            // Share cancelled or unsupported — fall through to download
          }
        }
        
        // Last resort: download the file
        if (!copied) {
          const link = document.createElement('a');
          link.download = `Kingdom-${kingdom.kingdom_number}-stats.png`;
          link.href = canvas.toDataURL('image/png');
          link.click();
        }
      } catch (err) {
        console.error('Failed to generate image:', err);
      }
    }
  };

  const handleCompare = () => {
    if (onAddToCompare) onAddToCompare(kingdom.kingdom_number);
    setShowPopup(false);
  };

  const buttonStyle: React.CSSProperties = {
    width: '100%',
    padding: isMobile ? '0.75rem 1rem' : '0.5rem 0.75rem',
    minHeight: isMobile ? '44px' : 'auto',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '6px',
    color: '#d1d5db',
    cursor: 'pointer',
    fontSize: isMobile ? '0.875rem' : '0.75rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    textAlign: 'left'
  };

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setShowPopup(!showPopup);
        }}
        aria-expanded={showPopup}
        aria-haspopup="menu"
        aria-label={`Actions for Kingdom ${kingdom.kingdom_number}`}
        style={{
          padding: isMobile ? '0.5rem 0.75rem' : '0.4rem 0.6rem',
          minHeight: isMobile ? '44px' : 'auto',
          minWidth: isMobile ? '44px' : 'auto',
          backgroundColor: 'transparent',
          border: '1px solid #3a3a3a',
          borderRadius: '6px',
          color: '#6b7280',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          display: 'flex',
          alignItems: 'center',
          gap: '0.35rem',
          fontSize: isMobile ? '0.8rem' : '0.7rem'
        }}
        onMouseEnter={(e) => {
          if (!isMobile) {
            e.currentTarget.style.borderColor = '#22d3ee';
            e.currentTarget.style.color = '#22d3ee';
          }
        }}
        onMouseLeave={(e) => {
          if (!isMobile) {
            e.currentTarget.style.borderColor = '#3a3a3a';
            e.currentTarget.style.color = '#6b7280';
          }
        }}
      >
        {t('kingdomCard.actions', 'Actions')}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      
      {showPopup && (
        <div
          className="share-popup"
          role="menu"
          aria-label="Kingdom actions"
          style={{
            position: 'absolute',
            bottom: '100%',
            right: 0,
            marginBottom: '8px',
            backgroundColor: '#1a1a2e',
            border: '1px solid #333',
            borderRadius: '8px',
            padding: isMobile ? '0.5rem' : '0.5rem',
            zIndex: 1000,
            minWidth: isMobile ? '180px' : '160px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.5)'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={handleCopyLink}
            role="menuitem"
            style={buttonStyle}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#2a2a3e'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
            </svg>
            {t('kingdomCard.copyLink')}
          </button>
          
          <button
            onClick={handleCopyImage}
            role="menuitem"
            style={buttonStyle}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#2a2a3e'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
            {t('kingdomCard.copyImage', 'Copy Image')}
          </button>
          
          <button
            onClick={handleCompare}
            role="menuitem"
            style={buttonStyle}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#2a2a3e'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            {t('kingdomCard.compareKingdom', 'Compare Kingdom')}
          </button>
        </div>
      )}
    </div>
  );
};

export default memo(CardActions);
