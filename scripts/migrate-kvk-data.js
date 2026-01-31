#!/usr/bin/env node
/**
 * KvK Data Migration Script
 * Migrates KvK history data from CSV to Supabase
 * 
 * Usage: node scripts/migrate-kvk-data.js
 * 
 * Prerequisites:
 * - SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables
 * - CSV file at apps/web/src/data/kingdoms_all_kvks.csv
 */

const fs = require('fs');
const path = require('path');

// Configuration
const CSV_PATH = path.join(__dirname, '../apps/web/src/data/kingdoms_all_kvks.csv');
const BATCH_SIZE = 200;
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://qdczmafwcvnwfvixxbwg.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (const char of line) {
    if (char === '"') inQuotes = !inQuotes;
    else if (char === ',' && !inQuotes) { result.push(current); current = ''; }
    else current += char;
  }
  result.push(current);
  return result;
}

function parseDate(dateStr) {
  const months = {Jan:'01',Feb:'02',Mar:'03',Apr:'04',May:'05',Jun:'06',Jul:'07',Aug:'08',Sep:'09',Oct:'10',Nov:'11',Dec:'12'};
  const match = dateStr.match(/(\w+)\s+(\d+),\s+(\d+)/);
  if (!match) return null;
  return `${match[3]}-${months[match[1]]}-${match[2].padStart(2,'0')}`;
}

function parseRecords(csvContent) {
  const lines = csvContent.trim().split('\n').slice(1); // Skip header
  return lines.map(line => {
    const p = parseCsvLine(line);
    return {
      kingdom_number: parseInt(p[0]),
      kvk_number: parseInt(p[1]),
      opponent_kingdom: parseInt(parseFloat(p[2])),
      prep_result: p[3],
      battle_result: p[4],
      overall_result: p[5],
      kvk_date: parseDate(p[6]),
      order_index: parseInt(p[7])
    };
  });
}

function generateInsertSQL(records) {
  const values = records.map(r => 
    `(${r.kingdom_number},${r.kvk_number},${r.opponent_kingdom},'${r.prep_result}','${r.battle_result}','${r.overall_result}',${r.kvk_date ? `'${r.kvk_date}'` : 'NULL'},${r.order_index})`
  ).join(',');
  
  return `INSERT INTO kvk_history (kingdom_number, kvk_number, opponent_kingdom, prep_result, battle_result, overall_result, kvk_date, order_index) VALUES ${values} ON CONFLICT (kingdom_number, kvk_number) DO UPDATE SET opponent_kingdom = EXCLUDED.opponent_kingdom, prep_result = EXCLUDED.prep_result, battle_result = EXCLUDED.battle_result, overall_result = EXCLUDED.overall_result, kvk_date = EXCLUDED.kvk_date, order_index = EXCLUDED.order_index;`;
}

async function executeSQL(sql) {
  if (!SUPABASE_KEY) {
    console.log('No SUPABASE_SERVICE_KEY - outputting SQL to stdout');
    console.log(sql);
    return { success: true, dryRun: true };
  }
  
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`
    },
    body: JSON.stringify({ query: sql })
  });
  
  if (!response.ok) {
    throw new Error(`SQL execution failed: ${response.status}`);
  }
  
  return { success: true };
}

async function main() {
  console.log('KvK Data Migration Script');
  console.log('========================');
  
  // Read CSV
  console.log(`Reading CSV from: ${CSV_PATH}`);
  const csvContent = fs.readFileSync(CSV_PATH, 'utf8');
  const records = parseRecords(csvContent);
  console.log(`Parsed ${records.length} records from CSV`);
  
  // Generate batches
  const batches = [];
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    batches.push(records.slice(i, i + BATCH_SIZE));
  }
  console.log(`Generated ${batches.length} batches of ${BATCH_SIZE} records each`);
  
  // Process batches
  let processed = 0;
  for (let i = 0; i < batches.length; i++) {
    const sql = generateInsertSQL(batches[i]);
    
    if (process.argv.includes('--dry-run')) {
      console.log(`Batch ${i + 1}/${batches.length}: ${batches[i].length} records (dry run)`);
    } else if (process.argv.includes('--output-sql')) {
      fs.writeFileSync(`/tmp/kvk_batch_${i}.sql`, sql);
      console.log(`Batch ${i + 1}/${batches.length}: written to /tmp/kvk_batch_${i}.sql`);
    } else {
      try {
        await executeSQL(sql);
        console.log(`Batch ${i + 1}/${batches.length}: ${batches[i].length} records migrated`);
      } catch (err) {
        console.error(`Batch ${i + 1} failed:`, err.message);
      }
    }
    processed += batches[i].length;
  }
  
  console.log(`\nMigration complete: ${processed} records processed`);
}

main().catch(console.error);
