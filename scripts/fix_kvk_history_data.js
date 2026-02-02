#!/usr/bin/env node
/**
 * Fix KvK History Data Migration
 * 
 * This script re-imports kvk_history data from the correct CSV source
 * to fix data corruption issues discovered on 2026-02-02.
 * 
 * Issue: Supabase kvk_history has wrong opponents and results for many kingdoms
 * Root cause: Unknown - possibly a bad import or data mix-up
 * 
 * Usage: SUPABASE_SERVICE_KEY=xxx node scripts/fix_kvk_history_data.js
 * Or from apps/web: node ../../scripts/fix_kvk_history_data.js
 */

const fs = require('fs');
const path = require('path');

// Try to load supabase-js from multiple locations
let createClient;
try {
  createClient = require('@supabase/supabase-js').createClient;
} catch {
  try {
    createClient = require(path.join(__dirname, '../apps/web/node_modules/@supabase/supabase-js')).createClient;
  } catch {
    console.error('ERROR: Cannot find @supabase/supabase-js');
    console.error('Run from apps/web directory: cd apps/web && node ../../scripts/fix_kvk_history_data.js');
    process.exit(1);
  }
}

const SUPABASE_URL = 'https://qdczmafwcvnwfvixxbwg.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error('ERROR: SUPABASE_SERVICE_KEY environment variable required');
  console.error('Get it from: Supabase Dashboard > Settings > API > service_role key');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

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

async function main() {
  console.log('=== KvK History Data Fix Migration ===\n');
  
  // Read CSV
  const csvPath = path.join(__dirname, '../apps/web/src/data/kingdoms_all_kvks.csv');
  console.log(`Reading CSV from: ${csvPath}`);
  const csvContent = fs.readFileSync(csvPath, 'utf8');
  const lines = csvContent.trim().split('\n').slice(1); // Skip header
  
  console.log(`Found ${lines.length} records in CSV\n`);
  
  // Parse all records
  const records = [];
  for (const line of lines) {
    const p = parseCsvLine(line);
    if (p.length < 8) continue;
    
    const kingdom_number = parseInt(p[0]);
    const kvk_number = parseInt(p[1]);
    const opponent_kingdom = parseInt(parseFloat(p[2]));
    const prep_result = p[3].trim();
    const battle_result = p[4].trim();
    const overall_result = p[5].trim();
    const kvk_date = parseDate(p[6]);
    const order_index = parseInt(p[7]);
    
    if (isNaN(kingdom_number) || isNaN(kvk_number)) continue;
    
    records.push({
      kingdom_number,
      kvk_number,
      opponent_kingdom,
      prep_result,
      battle_result,
      overall_result,
      kvk_date,
      order_index
    });
  }
  
  console.log(`Parsed ${records.length} valid records\n`);
  
  // Upsert in batches (this will update existing records and insert new ones)
  const BATCH_SIZE = 500;
  let updated = 0;
  let errors = 0;
  
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    
    const { error } = await supabase
      .from('kvk_history')
      .upsert(batch, { 
        onConflict: 'kingdom_number,kvk_number',
        ignoreDuplicates: false 
      });
    
    if (error) {
      console.error(`Batch ${Math.floor(i / BATCH_SIZE) + 1} error:`, error.message);
      errors += batch.length;
    } else {
      updated += batch.length;
      console.log(`Updated batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} records (total: ${updated})`);
    }
  }
  
  console.log(`\n✅ Migration complete!`);
  console.log(`   Updated: ${updated} records`);
  console.log(`   Errors: ${errors} records`);
  
  // Verify Kingdom 208
  console.log(`\n--- Verifying Kingdom 208 ---`);
  const { data: k208 } = await supabase
    .from('kvk_history')
    .select('kvk_number, opponent_kingdom, prep_result, battle_result')
    .eq('kingdom_number', 208)
    .order('kvk_number');
  
  console.log('Kingdom 208 records after fix:');
  for (const r of k208 || []) {
    console.log(`  KvK ${r.kvk_number}: vs ${r.opponent_kingdom} (${r.prep_result}/${r.battle_result})`);
  }
  
  // Now recalculate affected kingdom stats
  console.log(`\n--- Recalculating Kingdom Stats ---`);
  
  // Get unique kingdoms from CSV
  const uniqueKingdoms = [...new Set(records.map(r => r.kingdom_number))];
  console.log(`Recalculating stats for ${uniqueKingdoms.length} kingdoms...`);
  
  // Trigger recalculation for each kingdom
  let recalculated = 0;
  for (const kingdomNumber of uniqueKingdoms) {
    try {
      // Try RPC first
      const { error } = await supabase.rpc('recalculate_kingdom_stats', { p_kingdom_number: kingdomNumber });
      if (!error) {
        recalculated++;
        if (recalculated % 100 === 0) {
          console.log(`  Recalculated ${recalculated} kingdoms...`);
        }
      }
    } catch (e) {
      // RPC might not exist, stats are calculated via trigger
    }
  }
  
  console.log(`\n✅ Recalculated ${recalculated} kingdoms`);
  console.log('\nMigration complete! Please verify Kingdom 208 in the UI.');
}

main().catch(console.error);
