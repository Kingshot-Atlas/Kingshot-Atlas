import React, { Suspense, lazy } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTrustedSubmitter } from '../hooks/useTrustedSubmitter';
import { isAdminUsername } from '../utils/constants';
import { useTranslation } from 'react-i18next';

const KvKSpreadsheetTab = lazy(() => import('../components/admin/KvKSpreadsheetTab'));

const KvKSpreadsheet: React.FC = () => {
  const { user, profile } = useAuth();
  const { isTrusted, loading: trustedLoading } = useTrustedSubmitter();
  const { t } = useTranslation();

  const isAdmin = profile?.username && isAdminUsername(profile.username);

  // Must be logged in
  if (!user) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem 1rem', color: '#6b7280' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔒</div>
        <h2 style={{ color: '#fff', marginBottom: '0.5rem' }}>{t('common.signInRequired', 'Sign In Required')}</h2>
        <p style={{ marginBottom: '1.5rem', maxWidth: '400px', margin: '0 auto 1.5rem' }}>
          {t('kvkSpreadsheet.signInMessage', 'You need to sign in to access the KvK Results Spreadsheet.')}
        </p>
      </div>
    );
  }

  // Loading trusted status
  if (trustedLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
        <div className="loading-spinner-sm" />
      </div>
    );
  }

  // Must be admin or trusted submitter
  if (!isAdmin && !isTrusted) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem 1rem', color: '#6b7280' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🚫</div>
        <h2 style={{ color: '#ef4444', marginBottom: '0.5rem' }}>{t('common.accessDenied', 'Access Denied')}</h2>
        <p style={{ marginBottom: '1.5rem', maxWidth: '440px', margin: '0 auto 1.5rem' }}>
          {t('kvkSpreadsheet.accessDeniedMessage', 'This page is only available to trusted data submitters and admins. Contact an admin if you believe you should have access.')}
        </p>
        <Link
          to="/"
          style={{
            display: 'inline-block',
            padding: '0.6rem 1.5rem',
            backgroundColor: '#22d3ee',
            color: '#000',
            borderRadius: '8px',
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          {t('common.backToHome', 'Back to Home')}
        </Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
          <h1 style={{ color: '#fff', fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>
            {t('kvkSpreadsheet.title', 'KvK Results Spreadsheet')}
          </h1>
          {isTrusted && !isAdmin && (
            <span style={{
              padding: '0.15rem 0.5rem',
              backgroundColor: '#10b98115',
              border: '1px solid #10b98130',
              borderRadius: '6px',
              color: '#10b981',
              fontSize: '0.65rem',
              fontWeight: 700,
              textTransform: 'uppercase',
            }}>
              Trusted Submitter
            </span>
          )}
        </div>
        <p style={{ color: '#6b7280', fontSize: '0.85rem', margin: 0 }}>
          {t('kvkSpreadsheet.subtitle', 'Collaborative real-time spreadsheet for entering KvK matchup results.')}
        </p>
      </div>

      {/* Spreadsheet */}
      <Suspense fallback={
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
          <div className="loading-spinner-sm" />
        </div>
      }>
        <KvKSpreadsheetTab />
      </Suspense>
    </div>
  );
};

export default KvKSpreadsheet;
