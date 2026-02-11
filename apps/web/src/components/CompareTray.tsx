import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAnalytics } from '../hooks/useAnalytics';
import { useIsMobile } from '../hooks/useMediaQuery';
import { usePremium } from '../contexts/PremiumContext';
import { useTranslation } from 'react-i18next';

interface CompareTrayProps {
  compareKingdom1: string;
  compareKingdom2: string;
  setCompareKingdom1: (val: string) => void;
  setCompareKingdom2: (val: string) => void;
  compareHistory: { k1: number; k2: number }[];
  setCompareHistory: React.Dispatch<React.SetStateAction<{ k1: number; k2: number }[]>>;
  showCompareTray: boolean;
  setShowCompareTray: (val: boolean) => void;
}

const CompareTray: React.FC<CompareTrayProps> = ({
  compareKingdom1,
  compareKingdom2,
  setCompareKingdom1,
  setCompareKingdom2,
  compareHistory,
  setCompareHistory,
  showCompareTray,
  setShowCompareTray
}) => {
  const navigate = useNavigate();
  const { trackFeature } = useAnalytics();
  const [showHistory, setShowHistory] = useState(false);
  const isMobile = useIsMobile();
  const { features } = usePremium();
  const { t } = useTranslation();
  
  // Check if user can compare (multiCompare > 0 means they can compare at least 2)
  const canCompare = features.multiCompare >= 2;

  const handleCompare = () => {
    if (compareKingdom1 && compareKingdom2) {
      const k1 = parseInt(compareKingdom1);
      const k2 = parseInt(compareKingdom2);
      
      trackFeature('Compare Tray', { kingdom1: k1, kingdom2: k2 });
      setCompareHistory(prev => {
        const newHistory = [{ k1, k2 }, ...prev.filter(h => !(h.k1 === k1 && h.k2 === k2))].slice(0, 5);
        return newHistory;
      });
      
      navigate(`/compare?kingdoms=${compareKingdom1},${compareKingdom2}`);
    }
  };

  if (!showCompareTray) {
    return (
      <button 
        onClick={() => setShowCompareTray(true)}
        aria-label="Open compare kingdoms panel"
        style={{ 
          position: 'fixed', 
          bottom: isMobile ? '1rem' : '1.5rem', 
          right: isMobile ? '1rem' : '1.5rem', 
          padding: isMobile ? '0.875rem 1.25rem' : '1rem 1.5rem',
          minHeight: '48px',
          background: 'linear-gradient(135deg, #22d3ee 0%, #06b6d4 100%)', 
          border: '2px solid rgba(255, 255, 255, 0.3)', 
          borderRadius: '50px', 
          color: '#fff', 
          fontWeight: 'bold', 
          fontSize: isMobile ? '0.9rem' : '1rem',
          cursor: 'pointer', 
          boxShadow: '0 4px 25px rgba(34, 211, 238, 0.6), 0 0 40px rgba(34, 211, 238, 0.3)', 
          display: 'flex', 
          alignItems: 'center', 
          gap: isMobile ? '0.5rem' : '0.75rem', 
          zIndex: 1000,
          animation: 'comparePulse 2s ease-in-out infinite',
          transition: 'transform 0.2s ease, box-shadow 0.2s ease'
        }}
        onMouseEnter={(e) => {
          if (!isMobile) {
            e.currentTarget.style.transform = 'scale(1.08)';
            e.currentTarget.style.boxShadow = '0 6px 35px rgba(34, 211, 238, 0.8), 0 0 60px rgba(34, 211, 238, 0.4)';
          }
        }}
        onMouseLeave={(e) => {
          if (!isMobile) {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = '0 4px 25px rgba(34, 211, 238, 0.6), 0 0 40px rgba(34, 211, 238, 0.3)';
          }
        }}
      >
        {t('compare.compareKingdoms', 'Compare Kingdoms')}
        <style>{`
          @keyframes comparePulse {
            0%, 100% { box-shadow: 0 4px 25px rgba(34, 211, 238, 0.6), 0 0 40px rgba(34, 211, 238, 0.3); }
            50% { box-shadow: 0 4px 35px rgba(34, 211, 238, 0.8), 0 0 60px rgba(34, 211, 238, 0.5); }
          }
        `}</style>
      </button>
    );
  }

  // Anonymous users see login prompt instead of compare inputs
  if (!canCompare) {
    return (
      <div 
        role="region"
        aria-label="Compare kingdoms panel"
        style={{ 
          position: 'fixed', 
          bottom: 0, 
          left: 0, 
          right: 0, 
          background: 'linear-gradient(180deg, #0d1117 0%, #111111 100%)', 
          borderTop: '2px solid #22d3ee', 
          padding: isMobile ? '1rem' : '1.25rem 2rem',
          paddingBottom: isMobile ? 'max(1rem, env(safe-area-inset-bottom))' : '1.25rem',
          boxShadow: '0 -8px 40px rgba(34, 211, 238, 0.25), 0 -2px 20px rgba(0, 0, 0, 0.5)', 
          zIndex: 1000,
          animation: 'traySlideUp 0.3s ease-out'
        }}>
        <style>{`
          @keyframes traySlideUp {
            from { transform: translateY(100%); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
          }
        `}</style>
        <div style={{ 
          maxWidth: '900px', 
          margin: '0 auto', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          gap: '1rem',
          flexWrap: 'wrap'
        }}>
          <span style={{ color: '#9ca3af', fontSize: isMobile ? '0.85rem' : '0.95rem' }}>
            🔒 {t('compare.signInToCompare', 'Sign in to compare kingdoms')}
          </span>
          <Link
            to="/profile"
            style={{
              padding: '0.5rem 1rem',
              background: 'linear-gradient(135deg, #22d3ee 0%, #06b6d4 100%)',
              borderRadius: '6px',
              color: '#000',
              fontWeight: '600',
              fontSize: '0.85rem',
              textDecoration: 'none'
            }}
          >
            {t('common.signIn', 'Sign In')}
          </Link>
          <button 
            onClick={() => setShowCompareTray(false)}
            aria-label="Close compare panel"
            style={{ 
              padding: '0.5rem',
              backgroundColor: 'transparent', 
              border: '1px solid #3a3a3a', 
              borderRadius: '6px', 
              color: '#6b7280', 
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div 
      role="region"
      aria-label="Compare kingdoms panel"
      style={{ 
        position: 'fixed', 
        bottom: 0, 
        left: 0, 
        right: 0, 
        background: 'linear-gradient(180deg, #0d1117 0%, #111111 100%)', 
        borderTop: '2px solid #22d3ee', 
        padding: isMobile ? '1rem' : '1.25rem 2rem',
        paddingBottom: isMobile ? 'max(1rem, env(safe-area-inset-bottom))' : '1.25rem',
        boxShadow: '0 -8px 40px rgba(34, 211, 238, 0.25), 0 -2px 20px rgba(0, 0, 0, 0.5)', 
        zIndex: 1000,
        animation: 'traySlideUp 0.3s ease-out'
      }}>
      <style>{`
        @keyframes traySlideUp {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
      <div style={{ 
        maxWidth: '900px', 
        margin: '0 auto', 
        display: 'flex', 
        alignItems: isMobile ? 'stretch' : 'center', 
        justifyContent: 'center', 
        gap: isMobile ? '0.75rem' : '1rem', 
        flexWrap: 'wrap',
        flexDirection: isMobile ? 'column' : 'row'
      }}>
        {!isMobile && (
          <span style={{ 
            color: '#22d3ee', 
            fontWeight: '600', 
            fontSize: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <span style={{ fontSize: '1.2rem' }}>⚖️</span>
            {t('compare.quickCompare', 'Quick Compare:')}
          </span>
        )}
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: isMobile ? 'center' : 'flex-start' }}>
          <input 
            type="text" 
            inputMode="numeric" 
            pattern="[0-9]*" 
            value={compareKingdom1} 
            onChange={(e) => setCompareKingdom1(e.target.value.replace(/[^0-9]/g, ''))}
            placeholder={isMobile ? "K1" : "Kingdom A"}
            aria-label="First kingdom number to compare"
            style={{ 
              width: isMobile ? '80px' : '100px', 
              padding: isMobile ? '0.75rem' : '0.6rem 0.75rem',
              minHeight: '44px',
              backgroundColor: '#0a0a0a', 
              border: '1px solid #fff', 
              borderRadius: '8px', 
              color: '#fff', 
              fontSize: '1rem', 
              textAlign: 'center' 
            }} 
          />
          <span style={{ color: '#6b7280', fontWeight: '500', fontSize: '0.85rem' }}>vs</span>
          <input 
            type="text" 
            inputMode="numeric" 
            pattern="[0-9]*" 
            value={compareKingdom2} 
            onChange={(e) => setCompareKingdom2(e.target.value.replace(/[^0-9]/g, ''))}
            placeholder={isMobile ? "K2" : "Kingdom B"}
            aria-label="Second kingdom number to compare"
            style={{ 
              width: isMobile ? '80px' : '100px', 
              padding: isMobile ? '0.75rem' : '0.6rem 0.75rem',
              minHeight: '44px',
              backgroundColor: '#0a0a0a', 
              border: '1px solid #fff', 
              borderRadius: '8px', 
              color: '#fff', 
              fontSize: '1rem', 
              textAlign: 'center' 
            }} 
          />
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: isMobile ? 'center' : 'flex-start', flexWrap: 'wrap' }}>
          <button 
            onClick={handleCompare} 
            disabled={!compareKingdom1 || !compareKingdom2} 
            style={{ 
              padding: isMobile ? '0.75rem 1.25rem' : '0.6rem 1.5rem',
              minHeight: '44px',
              flex: isMobile ? '1' : 'none',
              background: compareKingdom1 && compareKingdom2 ? 'linear-gradient(135deg, #22d3ee 0%, #06b6d4 100%)' : '#2a2a2a', 
              border: 'none', 
              borderRadius: '8px', 
              color: '#fff', 
              fontWeight: 'bold', 
              cursor: compareKingdom1 && compareKingdom2 ? 'pointer' : 'not-allowed', 
              opacity: compareKingdom1 && compareKingdom2 ? 1 : 0.5, 
              boxShadow: compareKingdom1 && compareKingdom2 ? '0 0 15px rgba(34, 211, 238, 0.4)' : 'none', 
              transition: 'all 0.2s ease' 
            }}
          >
            {t('compare.compare', 'Compare')}
          </button>

          {compareHistory.length > 0 && !isMobile && (
            <button 
              onClick={() => setShowHistory(!showHistory)}
              aria-expanded={showHistory}
              aria-label="Show comparison history"
              style={{ 
                padding: '0.6rem 1rem',
                minHeight: '44px',
                backgroundColor: 'transparent', 
                border: '1px solid #3a3a3a', 
                borderRadius: '8px', 
                color: '#6b7280', 
                cursor: 'pointer', 
                fontSize: '0.85rem', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.5rem' 
              }}
            >
              <svg style={{ width: '14px', height: '14px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {t('compare.history', 'History')}
            </button>
          )}

          <button 
            onClick={() => { setCompareKingdom1(''); setCompareKingdom2(''); }}
            aria-label="Clear comparison inputs"
            style={{ 
              padding: isMobile ? '0.75rem 1rem' : '0.6rem 1rem',
              minHeight: '44px',
              backgroundColor: 'transparent', 
              border: '1px solid #3a3a3a', 
              borderRadius: '8px', 
              color: '#6b7280', 
              cursor: 'pointer', 
              fontSize: '0.85rem' 
            }}
          >
            {t('common.clear', 'Clear')}
          </button>

          <button 
            onClick={() => setShowCompareTray(false)}
            aria-label="Close compare panel"
            style={{ 
              padding: '0.5rem',
              minWidth: '44px',
              minHeight: '44px',
              backgroundColor: 'transparent', 
              border: 'none', 
              color: '#6b7280', 
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
      
      {showHistory && compareHistory.length > 0 && (
        <div style={{ 
          position: 'absolute', 
          bottom: '100%', 
          left: '50%', 
          transform: 'translateX(-50%)', 
          marginBottom: '0.5rem', 
          backgroundColor: '#111111', 
          border: '1px solid #2a2a2a', 
          borderRadius: '12px', 
          padding: '0.5rem', 
          minWidth: '200px', 
          boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.4)' 
        }}>
          <div style={{ 
            padding: '0.5rem', 
            color: '#6b7280', 
            fontSize: '0.75rem', 
            borderBottom: '1px solid #2a2a2a', 
            marginBottom: '0.5rem' 
          }}>
            {t('compare.recentComparisons', 'Recent Comparisons')}
          </div>
          {compareHistory.map((h, i) => (
            <button 
              key={i} 
              onClick={() => { 
                setCompareKingdom1(h.k1.toString()); 
                setCompareKingdom2(h.k2.toString()); 
                setShowHistory(false); 
              }} 
              style={{ 
                width: '100%', 
                padding: '0.75rem', 
                backgroundColor: 'transparent', 
                border: 'none', 
                borderRadius: '8px', 
                color: '#fff', 
                cursor: 'pointer', 
                fontSize: '0.9rem', 
                textAlign: 'left', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between', 
                transition: 'background-color 0.2s' 
              }} 
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1a1a1a'} 
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <span>K{h.k1} vs K{h.k2}</span>
              <svg style={{ width: '14px', height: '14px', color: '#6b7280' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default CompareTray;
