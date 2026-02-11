/**
 * DataLoadError Component
 * ADR-011: Displays error state when Supabase data fails to load
 * Shows clear messaging instead of silently showing stale/no data
 */
import { dataLoadError } from '../services/api';
import { useTranslation } from 'react-i18next';

interface DataLoadErrorProps {
  onRetry?: () => void;
  className?: string;
}

export function DataLoadError({ onRetry, className = '' }: DataLoadErrorProps) {
  const { t } = useTranslation();
  if (!dataLoadError) return null;

  return (
    <div data-testid="data-load-error" className={className} style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center', 
      padding: '2rem', 
      textAlign: 'center' 
    }}>
      <div style={{
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        border: '1px solid rgba(239, 68, 68, 0.3)',
        borderRadius: '12px',
        padding: '1.5rem',
        maxWidth: '400px'
      }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
        <h3 style={{ 
          fontSize: '1.125rem', 
          fontWeight: '600', 
          color: '#f87171', 
          marginBottom: '0.5rem' 
        }}>
          {t('dataLoadError.title', 'Data Unavailable')}
        </h3>
        <p style={{ color: '#9ca3af', marginBottom: '1rem' }}>
          {dataLoadError}
        </p>
        {onRetry && (
          <button
            onClick={onRetry}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 1rem',
              backgroundColor: '#d97706',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: '500',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#b45309'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#d97706'}
          >
            🔄 {t('common.retry', 'Try Again')}
          </button>
        )}
        <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '1rem' }}>
          {t('dataLoadError.persistMessage', 'Kingdom data is fetched from our database. If this persists, please try again later.')}
        </p>
      </div>
    </div>
  );
}

export default DataLoadError;
