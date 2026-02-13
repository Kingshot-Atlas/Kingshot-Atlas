import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FONT_DISPLAY } from '../../utils/styles';

interface TransferAuthGateProps {
  gateType: 'login' | 'link';
  isMobile: boolean;
  endorseClaimId: string | null;
  onClose: () => void;
}

const TransferAuthGate: React.FC<TransferAuthGateProps> = ({ gateType, isMobile, endorseClaimId, onClose }) => {
  const { t } = useTranslation();

  return (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center',
        zIndex: 1100, padding: isMobile ? 0 : '1rem',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#111111', border: '1px solid #22d3ee30',
          borderRadius: isMobile ? '16px 16px 0 0' : '16px',
          padding: isMobile ? '2rem 1.5rem' : '2.5rem',
          maxWidth: '420px', width: '100%',
          textAlign: 'center',
          paddingBottom: isMobile ? 'max(2rem, env(safe-area-inset-bottom))' : '2.5rem',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{
          width: '50px', height: '50px', borderRadius: '50%',
          backgroundColor: '#22d3ee10', border: '2px solid #22d3ee30',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 1rem', fontSize: '1.3rem',
        }}>
          {gateType === 'login' ? '🔒' : '🔗'}
        </div>
        <h2 style={{
          fontFamily: FONT_DISPLAY, fontSize: '1.1rem',
          color: '#fff', margin: '0 0 0.5rem 0',
        }}>
          {gateType === 'login' ? t('transferHub.signInRequired', 'Sign In Required') : t('transferHub.linkYourAccount', 'Link Your Account')}
        </h2>
        <p style={{ color: '#9ca3af', fontSize: '0.85rem', margin: '0 0 1.25rem 0', lineHeight: 1.5 }}>
          {gateType === 'login'
            ? (endorseClaimId
                ? t('transferHub.signInEndorseCandidate', 'Sign in to endorse this editor candidate.')
                : t('transferHub.signInApplyTransfers', 'Sign in to apply for transfers, create your profile, and manage recruitment.'))
            : (endorseClaimId
                ? t('transferHub.linkToVerifyEndorse', 'Link your Kingshot account to verify your kingdom and endorse.')
                : t('transferHub.linkToAccess', 'Link your Kingshot account to apply for transfers and access all Transfer Hub features.'))}
        </p>
        <Link
          to="/profile"
          onClick={() => {
            if (endorseClaimId) localStorage.setItem('atlas_pending_endorsement', endorseClaimId);
            onClose();
          }}
          style={{
            display: 'inline-block', padding: '0.6rem 1.5rem',
            backgroundColor: '#22d3ee', color: '#000', borderRadius: '8px',
            fontWeight: '600', fontSize: '0.85rem', textDecoration: 'none',
            minHeight: '44px', lineHeight: '44px',
          }}
        >
          {gateType === 'login' ? t('common.signIn', 'Sign In') : t('transferHub.goToProfile', 'Go to Profile')}
        </Link>
      </div>
    </div>
  );
};

export default TransferAuthGate;
