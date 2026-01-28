import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

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
  const [showHistory, setShowHistory] = useState(false);

  const handleCompare = () => {
    if (compareKingdom1 && compareKingdom2) {
      const k1 = parseInt(compareKingdom1);
      const k2 = parseInt(compareKingdom2);
      
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
        style={{ 
          position: 'fixed', 
          bottom: '1rem', 
          right: '1rem', 
          padding: '0.75rem 1rem', 
          background: 'linear-gradient(135deg, #22d3ee 0%, #06b6d4 100%)', 
          border: 'none', 
          borderRadius: '8px', 
          color: '#fff', 
          fontWeight: 'bold', 
          cursor: 'pointer', 
          boxShadow: '0 4px 15px rgba(34, 211, 238, 0.4)', 
          display: 'flex', 
          alignItems: 'center', 
          gap: '0.5rem', 
          zIndex: 1000 
        }}
      >
        Compare
      </button>
    );
  }

  return (
    <div style={{ 
      position: 'fixed', 
      bottom: 0, 
      left: 0, 
      right: 0, 
      backgroundColor: '#111111', 
      borderTop: '1px solid #22d3ee', 
      padding: '1rem 2rem', 
      boxShadow: '0 -4px 20px rgba(34, 211, 238, 0.2)', 
      zIndex: 1000 
    }}>
      <div style={{ 
        maxWidth: '900px', 
        margin: '0 auto', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        gap: '1rem', 
        flexWrap: 'wrap' 
      }}>
        <span style={{ color: '#9ca3af', fontWeight: '500' }}>Quick Compare:</span>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <input 
            type="text" 
            inputMode="numeric" 
            pattern="[0-9]*" 
            value={compareKingdom1} 
            onChange={(e) => setCompareKingdom1(e.target.value.replace(/[^0-9]/g, ''))} 
            placeholder="Kingdom A" 
            style={{ 
              width: '100px', 
              padding: '0.6rem 0.75rem', 
              backgroundColor: '#0a0a0a', 
              border: '1px solid #fff', 
              borderRadius: '8px', 
              color: '#fff', 
              fontSize: '0.9rem', 
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
            placeholder="Kingdom B" 
            style={{ 
              width: '100px', 
              padding: '0.6rem 0.75rem', 
              backgroundColor: '#0a0a0a', 
              border: '1px solid #fff', 
              borderRadius: '8px', 
              color: '#fff', 
              fontSize: '0.9rem', 
              textAlign: 'center' 
            }} 
          />
        </div>

        <button 
          onClick={handleCompare} 
          disabled={!compareKingdom1 || !compareKingdom2} 
          style={{ 
            padding: '0.6rem 1.5rem', 
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
          Compare
        </button>

        {compareHistory.length > 0 && (
          <button 
            onClick={() => setShowHistory(!showHistory)} 
            style={{ 
              padding: '0.6rem 1rem', 
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
            History
          </button>
        )}

        <button 
          onClick={() => { setCompareKingdom1(''); setCompareKingdom2(''); }} 
          style={{ 
            padding: '0.6rem 1rem', 
            backgroundColor: 'transparent', 
            border: '1px solid #3a3a3a', 
            borderRadius: '8px', 
            color: '#6b7280', 
            cursor: 'pointer', 
            fontSize: '0.85rem' 
          }}
        >
          Clear
        </button>

        <button 
          onClick={() => setShowCompareTray(false)} 
          style={{ 
            padding: '0.4rem', 
            backgroundColor: 'transparent', 
            border: 'none', 
            color: '#6b7280', 
            cursor: 'pointer', 
            marginLeft: 'auto' 
          }}
        >
          <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
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
            Recent Comparisons
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
