import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

/**
 * Dedicated OAuth callback page.
 * Supabase redirects here after Google/Discord sign-in with #access_token=... in the hash.
 * The Supabase client (detectSessionInUrl: true) processes the hash automatically.
 * This page waits for the session to be established, then redirects to /profile.
 */
const AuthCallback: React.FC = () => {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setError('Authentication is not configured.');
      return;
    }

    let timeoutId: ReturnType<typeof setTimeout>;
    let cancelled = false;

    // Listen for auth state changes (fires when Supabase processes the hash)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      if (session) {
        navigate('/profile', { replace: true });
      }
    });

    // Also check if session is already established (hash processed before listener was set up)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      if (session) {
        navigate('/profile', { replace: true });
      }
    });

    // Timeout after 10 seconds — show error with retry
    timeoutId = setTimeout(() => {
      if (!cancelled) {
        setError('Sign-in is taking longer than expected. Please try again.');
      }
    }, 10000);

    return () => {
      cancelled = true;
      subscription.unsubscribe();
      clearTimeout(timeoutId);
    };
  }, [navigate]);

  if (error) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#0a0a0a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: '1.5rem',
        padding: '2rem'
      }}>
        <div style={{ color: '#ef4444', fontSize: '1.1rem', textAlign: 'center' }}>{error}</div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button
            onClick={() => navigate('/profile', { replace: true })}
            style={{
              padding: '0.75rem 1.5rem',
              background: 'linear-gradient(135deg, #22d3ee 0%, #06b6d4 100%)',
              border: 'none',
              borderRadius: '8px',
              color: '#000',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            Go to Profile
          </button>
          <button
            onClick={() => window.location.href = '/'}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: 'transparent',
              border: '1px solid #3a3a3a',
              borderRadius: '8px',
              color: '#9ca3af',
              cursor: 'pointer'
            }}
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#0a0a0a',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      gap: '1rem'
    }}>
      <div style={{
        width: '40px',
        height: '40px',
        border: '3px solid #1a1a1a',
        borderTopColor: '#22d3ee',
        borderRadius: '50%',
        animation: 'authSpin 0.8s linear infinite'
      }} />
      <div style={{ color: '#9ca3af', fontSize: '1rem' }}>Signing you in...</div>
      <style>{`
        @keyframes authSpin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default AuthCallback;
