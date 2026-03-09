import React from 'react';
import { useTranslation } from 'react-i18next';

interface BearShareMenuProps {
  showShareMenu: boolean;
  setShowShareMenu: React.Dispatch<React.SetStateAction<boolean>>;
  shareMenuRef: React.RefObject<HTMLDivElement | null>;
  isCapturing: boolean;
  isMobile: boolean;
  handleCopyImage: () => void;
  handleCopyLink: () => void;
  handleExportCSV: () => void;
}

const BearShareMenu: React.FC<BearShareMenuProps> = ({
  showShareMenu,
  setShowShareMenu,
  shareMenuRef,
  isCapturing,
  isMobile,
  handleCopyImage,
  handleCopyLink,
  handleExportCSV,
}) => {
  const { t } = useTranslation();

  return (
    <div style={{ position: 'relative' }} ref={shareMenuRef}>
      <button
        onClick={() => setShowShareMenu(prev => !prev)}
        disabled={isCapturing}
        title={t('bearRally.share', 'Share')}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
          padding: '0.3rem 0.55rem', backgroundColor: '#1a1a1a',
          border: '1px solid #333', borderRadius: '6px',
          color: '#9ca3af', fontSize: '0.65rem', fontWeight: 600, cursor: 'pointer',
          opacity: isCapturing ? 0.5 : 1,
        }}
      >
        📤 {!isMobile && t('bearRally.share', 'Share')}
        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ marginLeft: '2px', transition: 'transform 0.15s', transform: showShareMenu ? 'rotate(180deg)' : 'rotate(0deg)' }}><path d="M6 9l6 6 6-6"/></svg>
      </button>
      {showShareMenu && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, zIndex: 60,
          marginTop: '4px', minWidth: '160px',
          backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.6)', overflow: 'hidden',
        }}>
          <button
            onClick={handleCopyImage}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.55rem 0.75rem', background: 'none', border: 'none', borderBottom: '1px solid #2a2a2a',
              color: '#d1d5db', fontSize: '0.75rem', fontWeight: 500, cursor: 'pointer',
              textAlign: 'left', transition: 'background-color 0.1s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#2a2a2a'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            <span style={{ fontSize: '0.85rem' }}>📸</span>
            {t('bearRally.copyImage', 'Copy Image')}
          </button>
          <button
            onClick={handleCopyLink}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.55rem 0.75rem', background: 'none', border: 'none', borderBottom: '1px solid #2a2a2a',
              color: '#d1d5db', fontSize: '0.75rem', fontWeight: 500, cursor: 'pointer',
              textAlign: 'left', transition: 'background-color 0.1s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#2a2a2a'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            <span style={{ fontSize: '0.85rem' }}>🔗</span>
            {t('bearRally.copyLink', 'Copy Link')}
          </button>
          <button
            onClick={handleExportCSV}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.55rem 0.75rem', background: 'none', border: 'none',
              color: '#d1d5db', fontSize: '0.75rem', fontWeight: 500, cursor: 'pointer',
              textAlign: 'left', transition: 'background-color 0.1s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#2a2a2a'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            <span style={{ fontSize: '0.85rem' }}>📊</span>
            {t('bearRally.exportCSV', 'Export CSV')}
          </button>
        </div>
      )}
    </div>
  );
};

export default BearShareMenu;
