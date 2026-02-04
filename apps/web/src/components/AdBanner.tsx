import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePremium } from '../contexts/PremiumContext';
import { useIsMobile } from '../hooks/useMediaQuery';

interface AdBannerProps {
  placement?: 'directory' | 'profile' | 'leaderboard';
}

// EthicalAds publisher ID - set this when you have an approved publisher account
// Apply at: https://www.ethicalads.io/publishers/
const ETHICALADS_PUBLISHER_ID = import.meta.env.VITE_ETHICALADS_PUBLISHER_ID || '';

const AdBanner: React.FC<AdBannerProps> = ({ placement: _placement = 'directory' }) => {
  const { features, tier } = usePremium();
  const isMobile = useIsMobile();
  const adRef = useRef<HTMLDivElement>(null);
  const [adLoaded, setAdLoaded] = useState(false);
  const hasEthicalAds = Boolean(ETHICALADS_PUBLISHER_ID);

  // Load EthicalAds script if publisher ID is configured
  useEffect(() => {
    if (!hasEthicalAds) return;
    
    // Check if script already loaded
    if (document.querySelector('script[src*="ethicalads"]')) {
      // Trigger ad load for SPA navigation
      if ((window as unknown as { ethicalads?: { load: () => void } }).ethicalads?.load) {
        (window as unknown as { ethicalads: { load: () => void } }).ethicalads.load();
      }
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://media.ethicalads.io/media/client/ethicalads.min.js';
    script.async = true;
    script.onload = () => {
      setAdLoaded(true);
    };
    document.head.appendChild(script);
  }, [hasEthicalAds]);

  // Pro/Recruiter users don't see ads
  if (features.adFree) {
    return null;
  }

  // If EthicalAds is configured, show their ad placement
  if (hasEthicalAds) {
    return (
      <div style={{ marginBottom: '1rem' }}>
        <div 
          ref={adRef}
          data-ea-publisher={ETHICALADS_PUBLISHER_ID}
          data-ea-type="text"
          data-ea-style="stickybox"
          className="dark horizontal"
          style={{
            backgroundColor: '#111111',
            border: '1px solid #2a2a2a',
            borderRadius: '8px',
            overflow: 'hidden'
          }}
        />
        {/* Fallback to self-promo if no ad loads */}
        {!adLoaded && <SelfPromoAd tier={tier} isMobile={isMobile} />}
      </div>
    );
  }

  // Default: Self-promotion ad encouraging upgrades
  return <SelfPromoAd tier={tier} isMobile={isMobile} />;
};

// Self-promotion component for upgrade prompts
const SelfPromoAd: React.FC<{ tier: string; isMobile: boolean }> = ({ tier, isMobile }) => (
  <div style={{
    backgroundColor: '#111111',
    border: '1px solid #2a2a2a',
    borderRadius: '8px',
    padding: isMobile ? '0.75rem' : '1rem',
    marginBottom: '1rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '1rem',
    flexWrap: 'wrap',
    position: 'relative'
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: '200px' }}>
      <div style={{
        width: '36px',
        height: '36px',
        backgroundColor: '#22d3ee15',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0
      }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="#22d3ee">
          <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
        </svg>
      </div>
      <div>
        <div style={{ color: '#fff', fontSize: isMobile ? '0.85rem' : '0.9rem', fontWeight: '600' }}>
          {tier === 'anonymous' ? 'Sign in for more features' : 'Become an Atlas Supporter'}
        </div>
        <div style={{ color: '#6b7280', fontSize: isMobile ? '0.75rem' : '0.8rem' }}>
          {tier === 'anonymous' 
            ? 'Create a free account to unlock watchlists, submissions, and more'
            : 'Full KvK history, ad-free experience, and premium features'
          }
        </div>
      </div>
    </div>
    <Link
      to={tier === 'anonymous' ? '/profile' : '/upgrade'}
      style={{
        padding: isMobile ? '0.5rem 0.875rem' : '0.5rem 1rem',
        backgroundColor: '#22d3ee',
        border: 'none',
        borderRadius: '6px',
        color: '#000',
        fontSize: isMobile ? '0.8rem' : '0.85rem',
        fontWeight: '600',
        textDecoration: 'none',
        whiteSpace: 'nowrap',
        transition: 'all 0.2s',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.35rem'
      }}
    >
      {tier === 'anonymous' ? (
        <>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
            <polyline points="10 17 15 12 10 7"/>
            <line x1="15" y1="12" x2="3" y2="12"/>
          </svg>
          Sign In
        </>
      ) : (
        <>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
          </svg>
          Go Pro
        </>
      )}
    </Link>
  </div>
);

export default AdBanner;
