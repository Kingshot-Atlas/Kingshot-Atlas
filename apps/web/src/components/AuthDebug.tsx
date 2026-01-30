import React, { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const AuthDebug: React.FC = () => {
  const [debugInfo, setDebugInfo] = useState<any>({});
  
  useEffect(() => {
    const info = {
      environment: {
        isLocalhost: window.location.hostname === 'localhost',
        origin: window.location.origin,
        href: window.location.href
      },
      supabase: {
        configured: isSupabaseConfigured,
        clientExists: !!supabase,
        url: supabase ? 'SET' : 'MISSING'
      },
      envVars: {
        REACT_APP_SUPABASE_URL: process.env.REACT_APP_SUPABASE_URL ? 'SET' : 'MISSING',
        REACT_APP_SUPABASE_ANON_KEY: process.env.REACT_APP_SUPABASE_ANON_KEY ? 'SET' : 'MISSING'
      }
    };
    
    setDebugInfo(info);
    
    // Test Supabase connection
    if (supabase) {
      supabase.auth.getSession().then(({ data, error }) => {
        setDebugInfo((prev: any) => ({
          ...prev,
          sessionTest: {
            hasSession: !!data.session,
            error: error?.message || 'None'
          }
        }));
      });
    }
  }, []);
  
  const testOAuth = async (provider: 'google' | 'discord') => {
    if (!supabase) {
      alert('Supabase not configured');
      return;
    }
    
    const redirectUrl = `${window.location.origin}/profile`;
    console.log('Testing OAuth with redirect:', redirectUrl);
    
    const { error, data } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: redirectUrl,
        skipBrowserRedirect: false // Ensure browser redirect happens
      }
    });
    
    if (error) {
      console.error('OAuth error:', error);
      alert(`OAuth Error: ${error.message}`);
    } else {
      console.log('OAuth initiated:', data);
      alert('OAuth initiated - check for popup or redirect');
    }
  };
  
  return (
    <div style={{ padding: '2rem', backgroundColor: '#0a0a0a', color: '#fff', fontFamily: 'monospace' }}>
      <h1>Authentication Debug</h1>
      
      <div style={{ marginBottom: '2rem' }}>
        <h2>Environment Info</h2>
        <pre>{JSON.stringify(debugInfo.environment, null, 2)}</pre>
      </div>
      
      <div style={{ marginBottom: '2rem' }}>
        <h2>Supabase Config</h2>
        <pre>{JSON.stringify(debugInfo.supabase, null, 2)}</pre>
      </div>
      
      <div style={{ marginBottom: '2rem' }}>
        <h2>Environment Variables</h2>
        <pre>{JSON.stringify(debugInfo.envVars, null, 2)}</pre>
      </div>
      
      {debugInfo.sessionTest && (
        <div style={{ marginBottom: '2rem' }}>
          <h2>Session Test</h2>
          <pre>{JSON.stringify(debugInfo.sessionTest, null, 2)}</pre>
        </div>
      )}
      
      <div style={{ marginBottom: '2rem' }}>
        <h2>Test OAuth</h2>
        <button 
          onClick={() => testOAuth('google')}
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
          Test Google OAuth
        </button>
        <button 
          onClick={() => testOAuth('discord')}
          style={{ 
            padding: '0.5rem 1rem',
            backgroundColor: '#5865F2',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Test Discord OAuth
        </button>
      </div>
      
      <div style={{ marginBottom: '2rem' }}>
        <h2>Required Supabase Configuration</h2>
        <div style={{ backgroundColor: '#1a1a1a', padding: '1rem', borderRadius: '4px' }}>
          <h3>Redirect URLs (in Supabase Dashboard → Authentication → URL Configuration)</h3>
          <p>Add these URLs to "Redirect URLs" and "Site URL":</p>
          <ul>
            <li>http://localhost:3000 (development)</li>
            <li>https://ks-atlas.com (production)</li>
            <li>https://ks-atlas.netlify.app (Netlify)</li>
          </ul>
          
          <h3>OAuth Providers (in Supabase Dashboard → Authentication → Providers)</h3>
          <ul>
            <li>Google: Enabled with correct Client ID and Secret</li>
            <li>Discord: Enabled with correct Client ID and Secret</li>
          </ul>
          
          <h3>Common Issues</h3>
          <ul>
            <li>Popup blockers preventing OAuth window</li>
            <li>Redirect URLs not configured</li>
            <li>OAuth providers not enabled</li>
            <li>Environment variables not loaded</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default AuthDebug;
