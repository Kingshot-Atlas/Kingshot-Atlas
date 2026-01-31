/**
 * KvK Data Sync Script
 * Syncs new KvK records from CSV to Supabase
 * 
 * Usage:
 *   node scripts/sync-kvk-data.js                    # Dry run (show what would be synced)
 *   node scripts/sync-kvk-data.js --apply            # Apply changes to Supabase
 *   node scripts/sync-kvk-data.js --kingdom 172      # Sync specific kingdom only
 * 
 * Environment:
 *   SUPABASE_URL - Supabase project URL
 *   SUPABASE_SERVICE_KEY - Supabase service role key (for write access)
 */

const fs = require('fs');
const path = require('path');

const CSV_PATH = path.join(__dirname, '../apps/web/src/data/kingdoms_all_kvks.csv');

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
  return match[3] + '-' + months[match[1]] + '-' + match[2].padStart(2,'0');
}

function loadCsvRecords(filterKingdom = null) {
  const csvContent = fs.readFileSync(CSV_PATH, 'utf-8');
  const lines = csvContent.trim().split('\n');
  const records = [];
  
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    if (cols.length < 7) continue;
    
    const kingdom = parseInt(cols[0]);
    const kvkNum = parseInt(cols[1]);
    
    if (isNaN(kingdom) || isNaN(kvkNum)) continue;
    if (filterKingdom && kingdom !== filterKingdom) continue;
    
    records.push({
      kingdom_number: kingdom,
      kvk_number: kvkNum,
      opponent_kingdom: parseInt(cols[2]) || 0,
      prep_result: cols[3] || '',
      battle_result: cols[4] || '',
      overall_result: cols[5] || '',
      kvk_date: parseDate(cols[6]),
      order_index: i
    });
  }
  
  return records;
}

function generateUpsertSQL(records, batchSize = 100) {
  const batches = [];
  
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    const values = batch.map(r => {
      const dateVal = r.kvk_date ? `'${r.kvk_date}'` : 'NULL';
      return `(${r.kingdom_number},${r.kvk_number},${r.opponent_kingdom},'${r.prep_result}','${r.battle_result}','${r.overall_result}',${dateVal},${r.order_index})`;
    });
    
    const sql = `INSERT INTO kvk_history (kingdom_number, kvk_number, opponent_kingdom, prep_result, battle_result, overall_result, kvk_date, order_index) VALUES
${values.join(',\n')}
ON CONFLICT (kingdom_number, kvk_number) DO UPDATE SET
opponent_kingdom = EXCLUDED.opponent_kingdom,
prep_result = EXCLUDED.prep_result,
battle_result = EXCLUDED.battle_result,
overall_result = EXCLUDED.overall_result,
kvk_date = EXCLUDED.kvk_date,
order_index = EXCLUDED.order_index;`;
    
    batches.push(sql);
  }
  
  return batches;
}

async function main() {
  const args = process.argv.slice(2);
  const applyMode = args.includes('--apply');
  const kingdomArg = args.find(a => a.startsWith('--kingdom'));
  const filterKingdom = kingdomArg ? parseInt(args[args.indexOf(kingdomArg) + 1] || args[args.indexOf('--kingdom') + 1]) : null;
  
  console.log('=== KvK Data Sync ===\n');
  console.log(`Mode: ${applyMode ? 'APPLY (will write to Supabase)' : 'DRY RUN (preview only)'}`);
  if (filterKingdom) console.log(`Filter: Kingdom ${filterKingdom} only`);
  console.log('');
  
  // Load CSV records
  const records = loadCsvRecords(filterKingdom);
  console.log(`CSV records to sync: ${records.length}`);
  
  if (records.length === 0) {
    console.log('No records to sync.');
    return;
  }
  
  // Generate SQL batches
  const batches = generateUpsertSQL(records);
  console.log(`SQL batches generated: ${batches.length}`);
  
  if (!applyMode) {
    // Dry run - show sample
    console.log('\n--- Sample SQL (first batch) ---');
    console.log(batches[0].substring(0, 500) + '...');
    console.log('\n--- End Sample ---');
    console.log('\nRun with --apply to execute these changes.');
    
    // Write batches to temp files for manual review
    const outputDir = '/tmp/kvk_sync';
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);
    batches.forEach((sql, i) => {
      fs.writeFileSync(`${outputDir}/batch_${i + 1}.sql`, sql);
    });
    console.log(`\nSQL files written to ${outputDir}/`);
  } else {
    // Apply mode - would need Supabase client
    console.log('\n⚠️  Apply mode requires SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables.');
    console.log('For now, use the generated SQL files with Supabase MCP or SQL editor.');
    
    const outputDir = '/tmp/kvk_sync';
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);
    batches.forEach((sql, i) => {
      fs.writeFileSync(`${outputDir}/batch_${i + 1}.sql`, sql);
    });
    console.log(`\nSQL files written to ${outputDir}/`);
    console.log('Execute these with: supabase db execute < /tmp/kvk_sync/batch_1.sql');
  }
  
  // Summary
  console.log('\n=== Sync Summary ===');
  console.log(`Records: ${records.length}`);
  console.log(`Kingdoms: ${new Set(records.map(r => r.kingdom_number)).size}`);
  console.log(`KvK range: ${Math.min(...records.map(r => r.kvk_number))} - ${Math.max(...records.map(r => r.kvk_number))}`);
}

main().catch(err => {
  console.error('Sync failed:', err);
  process.exit(1);
});
