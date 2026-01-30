// Test script to verify Supabase configuration
console.log('Testing Supabase configuration...');
console.log('Environment variables:');
console.log('REACT_APP_SUPABASE_URL:', process.env.REACT_APP_SUPABASE_URL ? 'SET' : 'MISSING');
console.log('REACT_APP_SUPABASE_ANON_KEY:', process.env.REACT_APP_SUPABASE_ANON_KEY ? 'SET' : 'MISSING');

// Test Supabase client creation
import { supabase, isSupabaseConfigured } from './lib/supabase.js';

console.log('\nSupabase client:');
console.log('isConfigured:', isSupabaseConfigured);
console.log('supabase client:', supabase ? 'CREATED' : 'NULL');

if (supabase) {
  // Test a simple auth check
  supabase.auth.getSession().then(({ data, error }) => {
    console.log('\nAuth session check:');
    console.log('Has session:', !!data.session);
    console.log('Error:', error);
  });
}
