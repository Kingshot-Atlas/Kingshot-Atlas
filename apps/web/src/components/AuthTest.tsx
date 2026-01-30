import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

const AuthTest: React.FC = () => {
  const { user, profile, loading, isConfigured, signInWithGoogle, signInWithDiscord } = useAuth();
  const [logs, setLogs] = useState<string[]>([]);
  
  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
    console.log(message);
  };
  
  const testSignIn = async (provider: 'google' | 'discord') => {
    addLog(`Testing ${provider} sign in...`);
    addLog(`isConfigured: ${isConfigured}`);
    addLog(`loading: ${loading}`);
    addLog(`user: ${user ? 'EXISTS' : 'NULL'}`);
    addLog(`profile: ${profile ? 'EXISTS' : 'NULL'}`);
    
    if (!isConfigured) {
      addLog('ERROR: Supabase not configured');
      return;
    }
    
    try {
      addLog(`Calling signInWith${provider === 'google' ? 'Google' : 'Discord'}...`);
      if (provider === 'google') {
        await signInWithGoogle();
      } else {
        await signInWithDiscord();
      }
      addLog('Sign-in call completed');
      
      // Check if popup was blocked
      setTimeout(() => {
        addLog('Checking if popup was blocked...');
        const popup = window.open('', '_blank');
        if (!popup || popup.closed || typeof popup.closed === 'undefined') {
          addLog('WARNING: Popups may be blocked');
        } else {
          popup.close();
          addLog('Popups are allowed');
        }
      }, 1000);
      
    } catch (error) {
      addLog(`ERROR: ${error}`);
    }
  };
  
  return (
    <div style={{ padding: '2rem', backgroundColor: '#1a1a1a', minHeight: '100vh', color: '#fff' }}>
      <h1>Authentication Test</h1>
      
      <div style={{ marginBottom: '2rem' }}>
        <h2>Current Status</h2>
        <p>Configured: {isConfigured ? 'YES' : 'NO'}</p>
        <p>Loading: {loading ? 'YES' : 'NO'}</p>
        <p>User: {user ? user.email : 'NOT SIGNED IN'}</p>
        <p>Profile: {profile ? profile.username : 'NO PROFILE'}</p>
      </div>
      
      <div style={{ marginBottom: '2rem' }}>
        <h2>Test Sign In</h2>
        <button 
          onClick={() => testSignIn('google')}
          style={{ 
            marginRight: '1rem', 
            padding: '0.5rem 1rem',
            backgroundColor: '#4285F4',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Test Google Sign In
        </button>
        <button 
          onClick={() => testSignIn('discord')}
          style={{ 
            padding: '0.5rem 1rem',
            backgroundColor: '#5865F2',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Test Discord Sign In
        </button>
      </div>
      
      <div>
        <h2>Logs</h2>
        <div style={{
          backgroundColor: '#0a0a0a',
          padding: '1rem',
          borderRadius: '4px',
          fontFamily: 'monospace',
          fontSize: '0.8rem',
          maxHeight: '300px',
          overflowY: 'auto'
        }}>
          {logs.length === 0 ? (
            <p style={{ color: '#666' }}>No logs yet...</p>
          ) : (
            logs.map((log, index) => (
              <div key={index} style={{ marginBottom: '0.25rem' }}>
                {log}
              </div>
            ))
          )}
        </div>
        <button 
          onClick={() => setLogs([])}
          style={{
            marginTop: '0.5rem',
            padding: '0.25rem 0.5rem',
            backgroundColor: '#666',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Clear Logs
        </button>
      </div>
    </div>
  );
};

export default AuthTest;
