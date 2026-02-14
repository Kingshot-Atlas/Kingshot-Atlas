import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { usePremium } from '../../contexts/PremiumContext';
import { useToast } from '../Toast';
import { getCustomerPortalUrl, createPortalSession } from '../../lib/stripe';
import { useTranslation } from 'react-i18next';
import { logger } from '../../utils/logger';

interface SubscriptionSectionProps {
  themeColor: string;
  isMobile: boolean;
}

const SubscriptionSection: React.FC<SubscriptionSectionProps> = ({ themeColor, isMobile }) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { tierName, isSupporter, isAdmin } = usePremium();
  const { showToast } = useToast();
  const [managingSubscription, setManagingSubscription] = useState(false);

  return (
    <div style={{
      backgroundColor: '#111111',
      borderRadius: '12px',
      padding: isMobile ? '1rem' : '1.25rem',
      marginBottom: '1.5rem',
      border: `1px solid ${isSupporter ? themeColor : '#2a2a2a'}30`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: '600', color: '#fff', width: '100%', textAlign: 'center' }}>
          {t('profile.subscription', 'Subscription')}
        </h3>
      </div>
      <div style={{ textAlign: 'center', marginBottom: '0.75rem' }}>
        <div style={{
          display: 'inline-block',
          padding: '0.25rem 0.75rem',
          backgroundColor: isAdmin ? '#ef444420' 
            : isSupporter ? '#22d3ee20' 
            : '#3a3a3a20',
          borderRadius: '9999px',
          fontSize: '0.75rem',
          fontWeight: '600',
          color: isAdmin ? '#ef4444' 
            : isSupporter ? '#22d3ee' 
            : '#9ca3af',
        }}>
          {tierName}
        </div>
      </div>
      
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column',
        alignItems: 'center', 
        gap: '0.75rem',
      }}>
        <p style={{ color: '#6b7280', fontSize: isMobile ? '0.8rem' : '0.85rem', margin: 0, lineHeight: 1.5, textAlign: 'center' }}>
          {isAdmin 
            ? t('profile.adminAccess', 'You have full admin access to all features.')
            : isSupporter 
            ? t('profile.supporterAccess', 'You have full access to Atlas Supporter features. Thanks for backing the project.')
            : t('profile.freeAccess', 'Stop guessing. Get deeper insights, unlimited bot commands, and support the platform that helps you win.')}
        </p>
        
        {isSupporter && !isAdmin ? (
          <button
            onClick={async () => {
              if (!user) return;
              setManagingSubscription(true);
              try {
                const portalUrl = await createPortalSession(user.id);
                window.location.href = portalUrl;
              } catch (error) {
                logger.warn('API portal failed, trying direct URL:', error);
                const directPortalUrl = getCustomerPortalUrl();
                if (directPortalUrl && directPortalUrl !== '/profile') {
                  window.location.href = directPortalUrl;
                } else {
                  alert(t('profile.portalError', 'Unable to open subscription management. Please email support@ks-atlas.com for assistance.'));
                }
              } finally {
                setManagingSubscription(false);
              }
            }}
            disabled={managingSubscription}
            style={{
              padding: isMobile ? '0.75rem 1rem' : '0.5rem 1rem',
              minHeight: isMobile ? '48px' : 'auto',
              width: isMobile ? '100%' : 'auto',
              backgroundColor: 'transparent',
              border: `1px solid ${themeColor}50`,
              borderRadius: '10px',
              color: themeColor,
              fontSize: isMobile ? '0.9rem' : '0.85rem',
              fontWeight: '500',
              cursor: managingSubscription ? 'wait' : 'pointer',
              opacity: managingSubscription ? 0.7 : 1,
              WebkitTapHighlightColor: 'transparent'
            }}
          >
            {managingSubscription ? t('support.opening') : t('support.manageSubscription')}
          </button>
        ) : !isAdmin ? (
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column',
            alignItems: 'center', 
            gap: '0.5rem', 
            width: isMobile ? '100%' : 'auto'
          }}>
            <Link
              to="/support"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: isMobile ? '0.75rem 1.5rem' : '0.5rem 1.25rem',
                minHeight: isMobile ? '48px' : 'auto',
                background: `linear-gradient(135deg, ${themeColor} 0%, ${themeColor}cc 100%)`,
                borderRadius: '10px',
                color: '#000',
                fontSize: isMobile ? '0.9rem' : '0.85rem',
                fontWeight: '600',
                textDecoration: 'none',
                WebkitTapHighlightColor: 'transparent'
              }}
            >
              {t('profile.becomeSupporter', 'Become an Atlas Supporter')}
            </Link>
            <button
              onClick={async () => {
                if (!user) return;
                setManagingSubscription(true);
                try {
                  const { syncSubscription } = await import('../../lib/stripe');
                  const result = await syncSubscription(user.id);
                  if (result.synced && result.tier !== 'free') {
                    showToast(result.message || 'Subscription synced!', 'success');
                    window.location.reload();
                  } else {
                    showToast(result.message || 'No active subscription found.', 'info');
                  }
                } catch (error) {
                  logger.error('Sync error:', error);
                  showToast('Unable to sync subscription. Please email support@ks-atlas.com', 'error');
                } finally {
                  setManagingSubscription(false);
                }
              }}
              disabled={managingSubscription}
              style={{
                padding: isMobile ? '0.625rem 0.75rem' : '0.5rem 0.75rem',
                minHeight: isMobile ? '44px' : 'auto',
                backgroundColor: 'transparent',
                border: 'none',
                color: '#6b7280',
                fontSize: isMobile ? '0.8rem' : '0.75rem',
                cursor: managingSubscription ? 'wait' : 'pointer',
                textDecoration: 'underline',
                WebkitTapHighlightColor: 'transparent'
              }}
            >
              {managingSubscription ? t('profile.syncing', 'Syncing...') : t('profile.subscriptionNotShowing', 'Subscription not showing?')}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default SubscriptionSection;
