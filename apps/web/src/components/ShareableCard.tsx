import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Kingdom, getPowerTier, TIER_COLORS } from '../types';

interface ShareableCardProps {
  kingdom: Kingdom;
  onClose: () => void;
}

const ShareableCard: React.FC<ShareableCardProps> = ({ kingdom, onClose }) => {
  const { t } = useTranslation();
  const cardRef = useRef<HTMLDivElement>(null);

  const tier = getPowerTier(kingdom.overall_score);
  const tierColor = TIER_COLORS[tier];

  const handleCopyAsText = () => {
    const text = `K-${kingdom.kingdom_number} | Tier ${tier}
Atlas Score: ${kingdom.overall_score.toFixed(2)}
Prep: ${kingdom.prep_wins}-${kingdom.prep_losses} (${Math.round(kingdom.prep_win_rate * 100)}%)
Battle: ${kingdom.battle_wins}-${kingdom.battle_losses} (${Math.round(kingdom.battle_win_rate * 100)}%)
Total KvKs: ${kingdom.total_kvks}
${window.location.origin}/kingdom/${kingdom.kingdom_number}`;
    navigator.clipboard.writeText(text);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/kingdom/${kingdom.kingdom_number}`);
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0,0,0,0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '1rem'
    }} onClick={onClose}>
      <div 
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: '#0a0a0a',
          borderRadius: '16px',
          padding: '1.5rem',
          maxWidth: '400px',
          width: '100%',
          border: '1px solid #22d3ee'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ color: '#fff', fontSize: '1rem', fontWeight: '600' }}>{t('shareableCard.title')}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: '1.25rem', cursor: 'pointer' }}>×</button>
        </div>

        {/* Preview Card */}
        <div
          ref={cardRef}
          style={{
            backgroundColor: '#151515',
            borderRadius: '12px',
            padding: '1rem',
            marginBottom: '1rem',
            border: `2px solid ${tierColor}`
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#fff', fontFamily: "'Cinzel', serif" }}>Kingdom {kingdom.kingdom_number}</span>
              <span style={{
                padding: '0.15rem 0.4rem',
                borderRadius: '4px',
                fontSize: '0.65rem',
                fontWeight: 'bold',
                backgroundColor: `${tierColor}20`,
                color: tierColor,
                border: `1px solid ${tierColor}40`
              }}>{tier}</span>
            </div>
            <span style={{ color: '#22d3ee', fontWeight: 'bold', fontSize: '1.1rem' }}>{kingdom.overall_score.toFixed(2)}</span>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.8rem' }}>
            <div style={{ color: '#eab308' }}>Prep: {kingdom.prep_wins}-{kingdom.prep_losses}</div>
            <div style={{ color: '#eab308', textAlign: 'right' }}>{Math.round(kingdom.prep_win_rate * 100)}%</div>
            <div style={{ color: '#f97316' }}>Battle: {kingdom.battle_wins}-{kingdom.battle_losses}</div>
            <div style={{ color: '#f97316', textAlign: 'right' }}>{Math.round(kingdom.battle_win_rate * 100)}%</div>
          </div>
          
          <div style={{ marginTop: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid #2a2a2a', display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
            <span style={{ color: '#6b7280' }}>Total KvKs: {kingdom.total_kvks}</span>
            <span style={{ color: '#22d3ee' }}>Kingshot Atlas</span>
          </div>
        </div>

        {/* Share Actions */}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={handleCopyAsText}
            style={{
              flex: 1,
              padding: '0.75rem',
              backgroundColor: '#22d3ee',
              border: 'none',
              borderRadius: '8px',
              color: '#000',
              fontWeight: '600',
              fontSize: '0.85rem',
              cursor: 'pointer'
            }}
          >
            {t('shareableCard.copyAsText')}
          </button>
          <button
            onClick={handleCopyLink}
            style={{
              flex: 1,
              padding: '0.75rem',
              backgroundColor: '#2a2a2a',
              border: '1px solid #3a3a3a',
              borderRadius: '8px',
              color: '#fff',
              fontWeight: '600',
              fontSize: '0.85rem',
              cursor: 'pointer'
            }}
          >
            {t('shareableCard.copyLink')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShareableCard;
