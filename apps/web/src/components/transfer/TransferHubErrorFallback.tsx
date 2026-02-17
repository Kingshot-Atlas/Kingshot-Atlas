import React from 'react';
import { useTranslation } from 'react-i18next';
import { colors } from '../../utils/styles';

interface TransferHubErrorFallbackProps {
  section: string;
  onRetry: () => void;
}

const TransferHubErrorFallback: React.FC<TransferHubErrorFallbackProps> = ({ section, onRetry }) => {
  const { t } = useTranslation();

  return (
    <div style={{
      textAlign: 'center',
      padding: '1.5rem 1rem',
      backgroundColor: colors.surface,
      borderRadius: '12px',
      border: `1px solid #ef444430`,
      margin: '0.5rem 0',
    }}>
      <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem', opacity: 0.6 }}>⚠️</div>
      <p style={{ color: colors.text, fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem' }}>
        {t('transferHub.error.title', 'Something went wrong')}
      </p>
      <p style={{ color: colors.textMuted, fontSize: '0.75rem', marginBottom: '0.75rem' }}>
        {t('transferHub.error.description', 'The {{section}} section encountered an error. Your other data is safe.', { section })}
      </p>
      <button
        onClick={onRetry}
        style={{
          padding: '0.5rem 1.25rem',
          backgroundColor: '#22d3ee15',
          border: '1px solid #22d3ee30',
          borderRadius: '8px',
          color: '#22d3ee',
          fontSize: '0.8rem',
          fontWeight: 600,
          cursor: 'pointer',
          minHeight: '44px',
        }}
      >
        {t('transferHub.error.retry', 'Try Again')}
      </button>
    </div>
  );
};

export default TransferHubErrorFallback;
