#!/usr/bin/env node
/**
 * Execute the generated seed SQL against Supabase using the REST API.
 * Splits the SQL file into individual statements and executes them sequentially.
 * 
 * Usage: SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/exec-seed-sql.js
 */

const fs = require('fs');
const path = require('path');

const SQL_PATH = path.join(__dirname, '..', 'data', 'generated', 'transfer-history-seed.sql');

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  
  if (!url || !key) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY env vars');
    process.exit(1);
  }

  const sql = fs.readFileSync(SQL_PATH, 'utf-8');
  
  // Split into individual INSERT statements (skip comments and empty lines)
  const statements = sql
    .split(/;\s*\n/)
    .map(s => s.trim())
    .filter(s => s && !s.startsWith('--'));

  // Skip the first 4 statements (transfer_events INSERTs already done)
  const historyStatements = statements.filter(s => 
    s.includes('transfer_status_history')
  );

  console.log(`Found ${historyStatements.length} INSERT batches to execute`);

  let totalInserted = 0;
  for (let i = 0; i < historyStatements.length; i++) {
    const stmt = historyStatements[i] + ';';
    const rowCount = (stmt.match(/\(/g) || []).length - 1; // approximate
    
    const resp = await fetch(`${url}/rest/v1/rpc/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': key,
        'Authorization': `Bearer ${key}`,
      },
      body: JSON.stringify({})
    });

    // Use the SQL endpoint instead
    const sqlResp = await fetch(`${url}/pg/query`, {
      method: 'POST', 
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
      },
      body: JSON.stringify({ query: stmt })
    });

    if (!sqlResp.ok) {
      // Fallback: try via postgrest
      // Actually let's use the raw postgres connection approach
      console.error(`Batch ${i + 1} failed: ${sqlResp.status}`);
      const text = await sqlResp.text();
      console.error(text.substring(0, 200));
    } else {
      totalInserted += rowCount;
      process.stdout.write(`\rExecuted batch ${i + 1}/${historyStatements.length}`);
    }
  }
  
  console.log(`\nDone. Approximately ${totalInserted} rows inserted.`);
}

main().catch(console.error);
