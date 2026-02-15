import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Sentry from '@sentry/react';
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

    let cancelled = false;
    let pollCount = 0;
    const hasHash = window.location.hash.length > 1;

    Sentry.addBreadcrumb({
      category: 'auth',
      message: 'AuthCallback mounted',
      data: { hasHash },
      level: 'info',
    });

    const redirect = () => {
      if (!cancelled) {
        cancelled = true;
        Sentry.addBreadcrumb({
          category: 'auth',
          message: 'AuthCallback redirect to profile',
          data: { pollCount },
          level: 'info',
        });
        navigate('/profile', { replace: true });
      }
    };

    // If no hash fragment, the user likely landed here from another tab that
    // already consumed the OAuth token, or via direct navigation.
    // Check for existing session immediately and redirect fast.
    if (!hasHash) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          redirect();
        } else {
          // No hash AND no session — can't complete sign-in
          setError('Sign-in is taking longer than expected. Please try again.');
        }
      });
      return () => { cancelled = true; };
    }

    // Timeout: 20s to accommodate slow mobile connections
    const timeoutId = setTimeout(() => {
      if (!cancelled) {
        Sentry.addBreadcrumb({
          category: 'auth',
          message: 'AuthCallback timeout reached',
          data: { pollCount, hasHash },
          level: 'warning',
        });
        // Last-resort: check if session landed via another tab while we waited
        supabase!.auth.getSession().then(({ data: { session } }) => {
          if (session) {
            redirect();
          } else {
            setError('Sign-in is taking longer than expected. Please try again.');
          }
        });
      }
    }, 20000);

    // Listen for auth state changes (fires when Supabase processes the hash)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) redirect();
    });

    // Poll for session every 1.5s — handles multi-tab race conditions
    // where onAuthStateChange may not fire (e.g. session already exists
    // from another tab, or hash was consumed before listener was set up)
    const pollSession = async () => {
      pollCount++;
      const { data: { session } } = await supabase!.auth.getSession();
      if (session) redirect();
    };
    pollSession();
    const pollId = setInterval(pollSession, 1500);

    return () => {
      cancelled = true;
      subscription.unsubscribe();
      clearTimeout(timeoutId);
      clearInterval(pollId);
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
        <p style={{ color: '#6b7280', fontSize: '0.85rem', textAlign: 'center', maxWidth: '360px', lineHeight: 1.5 }}>
          This can happen on slow connections or when multiple tabs are open. Try signing in again.
        </p>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
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
            onClick={() => { window.location.href = '/'; }}
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
