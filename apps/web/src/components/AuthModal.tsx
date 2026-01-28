import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { signInWithGoogle, signInWithDiscord, signInWithEmail, signUpWithEmail } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  if (!isOpen) return null;

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      if (mode === 'signup') {
        const { error } = await signUpWithEmail(email, password);
        if (error) {
          setError(error.message);
        } else {
          setMessage('Check your email for the confirmation link!');
          setEmail('');
          setPassword('');
        }
      } else {
        const { error } = await signInWithEmail(email, password);
        if (error) {
          setError(error.message);
        } else {
          onClose();
        }
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthSignIn = async (provider: 'google' | 'discord') => {
    setError('');
    try {
      if (provider === 'google') {
        await signInWithGoogle();
      } else {
        await signInWithDiscord();
      }
    } catch (err) {
      setError('Failed to sign in. Please try again or check your connection.');
    }
  };

  return (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        backdropFilter: 'blur(4px)'
      }}
      onClick={onClose}
    >
      <div 
        style={{
          backgroundColor: '#111111',
          borderRadius: '16px',
          padding: '2rem',
          width: '100%',
          maxWidth: '400px',
          border: '1px solid #2a2a2a',
          position: 'relative'
        }}
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            background: 'none',
            border: 'none',
            color: '#6b7280',
            fontSize: '1.25rem',
            cursor: 'pointer'
          }}
        >
          ×
        </button>

        <h2 style={{ 
          fontSize: '1.5rem', 
          fontWeight: 'bold', 
          color: '#fff', 
          marginBottom: '0.5rem',
          textAlign: 'center'
        }}>
          {mode === 'signin' ? 'Welcome Back' : 'Create Account'}
        </h2>
        <p style={{ color: '#6b7280', fontSize: '0.9rem', textAlign: 'center', marginBottom: '1.5rem' }}>
          {mode === 'signin' ? 'Sign in to access your profile' : 'Join the Kingshot Atlas community'}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <button
            onClick={() => handleOAuthSignIn('google')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.75rem',
              padding: '0.75rem 1rem',
              backgroundColor: '#fff',
              border: 'none',
              borderRadius: '8px',
              color: '#333',
              fontWeight: '600',
              cursor: 'pointer',
              fontSize: '0.95rem'
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>

          <button
            onClick={() => handleOAuthSignIn('discord')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.75rem',
              padding: '0.75rem 1rem',
              backgroundColor: '#5865F2',
              border: 'none',
              borderRadius: '8px',
              color: '#fff',
              fontWeight: '600',
              cursor: 'pointer',
              fontSize: '0.95rem'
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
            </svg>
            Continue with Discord
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ flex: 1, height: '1px', backgroundColor: '#2a2a2a' }} />
          <span style={{ color: '#6b7280', fontSize: '0.85rem' }}>or</span>
          <div style={{ flex: 1, height: '1px', backgroundColor: '#2a2a2a' }} />
        </div>

        <form onSubmit={handleEmailAuth} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            style={{
              padding: '0.75rem 1rem',
              backgroundColor: '#0a0a0a',
              border: '1px solid #2a2a2a',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '0.95rem'
            }}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={6}
            style={{
              padding: '0.75rem 1rem',
              backgroundColor: '#0a0a0a',
              border: '1px solid #2a2a2a',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '0.95rem'
            }}
          />

          {error && (
            <p style={{ color: '#ef4444', fontSize: '0.85rem', textAlign: 'center' }}>{error}</p>
          )}
          {message && (
            <p style={{ color: '#22c55e', fontSize: '0.85rem', textAlign: 'center' }}>{message}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '0.75rem 1rem',
              background: loading ? '#2a2a2a' : 'linear-gradient(135deg, #22d3ee 0%, #06b6d4 100%)',
              border: 'none',
              borderRadius: '8px',
              color: loading ? '#6b7280' : '#000',
              fontWeight: 'bold',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '0.95rem'
            }}
          >
            {loading ? 'Loading...' : (mode === 'signin' ? 'Sign In' : 'Create Account')}
          </button>
        </form>

        <p style={{ color: '#6b7280', fontSize: '0.85rem', textAlign: 'center', marginTop: '1.5rem' }}>
          {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
          <button
            onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); setMessage(''); }}
            style={{
              background: 'none',
              border: 'none',
              color: '#22d3ee',
              cursor: 'pointer',
              fontSize: '0.85rem',
              textDecoration: 'underline'
            }}
          >
            {mode === 'signin' ? 'Sign up' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  );
};

export default AuthModal;
