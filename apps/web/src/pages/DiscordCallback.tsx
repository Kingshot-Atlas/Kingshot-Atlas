import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { discordService } from '../services/discordService';

const DiscordCallback: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code');
      const errorParam = searchParams.get('error');

      if (errorParam) {
        setStatus('error');
        setError(errorParam === 'access_denied' ? 'Discord authorization was cancelled' : errorParam);
        return;
      }

      if (!code) {
        setStatus('error');
        setError('No authorization code received');
        return;
      }

      const result = await discordService.handleCallback(code);
      
      if (result.success) {
        setStatus('success');
        // Redirect to profile after short delay
        setTimeout(() => navigate('/profile?discord=linked'), 1500);
      } else {
        setStatus('error');
        setError(result.error || 'Failed to link Discord account');
      }
    };

    handleCallback();
  }, [searchParams, navigate]);

  return (
    <div style={{
      minHeight: '60vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem'
    }}>
      <div style={{
        backgroundColor: '#111116',
        borderRadius: '16px',
        padding: '2rem',
        textAlign: 'center',
        maxWidth: '400px',
        border: '1px solid #2a2a2a'
      }}>
        {status === 'processing' && (
          <>
            <div style={{
              width: '48px',
              height: '48px',
              border: '3px solid #5865F2',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 1rem'
            }} />
            <h2 style={{ color: '#fff', fontSize: '1.25rem', marginBottom: '0.5rem' }}>
              Linking Discord Account...
            </h2>
            <p style={{ color: '#9ca3af', fontSize: '0.9rem' }}>
              Please wait while we connect your accounts.
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <div style={{
              width: '48px',
              height: '48px',
              backgroundColor: '#22c55e20',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem'
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h2 style={{ color: '#22c55e', fontSize: '1.25rem', marginBottom: '0.5rem' }}>
              Discord Linked!
            </h2>
            <p style={{ color: '#9ca3af', fontSize: '0.9rem' }}>
              Redirecting to your profile...
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <div style={{
              width: '48px',
              height: '48px',
              backgroundColor: '#ef444420',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem'
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </div>
            <h2 style={{ color: '#ef4444', fontSize: '1.25rem', marginBottom: '0.5rem' }}>
              Link Failed
            </h2>
            <p style={{ color: '#9ca3af', fontSize: '0.9rem', marginBottom: '1rem' }}>
              {error}
            </p>
            <button
              onClick={() => navigate('/profile')}
              style={{
                padding: '0.6rem 1.5rem',
                backgroundColor: '#5865F2',
                border: 'none',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '0.9rem',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              Return to Profile
            </button>
          </>
        )}

        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );
};

export default DiscordCallback;
