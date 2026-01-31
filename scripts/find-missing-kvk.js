/**
 * Find missing KvK records by comparing CSV to Supabase data
 * Outputs SQL INSERT statements for missing records
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

// Read CSV
const csvContent = fs.readFileSync(CSV_PATH, 'utf-8');
const lines = csvContent.trim().split('\n');
const header = lines[0];

// Parse all CSV records
const csvRecords = [];
for (let i = 1; i < lines.length; i++) {
  const cols = parseCsvLine(lines[i]);
  if (cols.length < 7) continue;
  
  const kingdom = parseInt(cols[0]);
  const kvkNum = parseInt(cols[1]);
  const opponent = parseInt(cols[2]) || 0;
  const prep = cols[3] || '';
  const battle = cols[4] || '';
  const overall = cols[5] || '';
  const dateStr = cols[6] || '';
  const orderIndex = i;
  
  if (isNaN(kingdom) || isNaN(kvkNum)) continue;
  
  const date = parseDate(dateStr);
  
  csvRecords.push({
    key: `${kingdom}-${kvkNum}`,
    kingdom,
    kvkNum,
    opponent,
    prep,
    battle,
    overall,
    date,
    orderIndex
  });
}

console.log(`Total CSV records: ${csvRecords.length}`);

// Read Supabase keys from stdin (piped from query result)
const supabaseKeys = new Set();
const stdinData = process.argv[2] || '';
if (stdinData) {
  // Parse JSON array of {kingdom_number, kvk_number}
  try {
    const records = JSON.parse(stdinData);
    for (const r of records) {
      supabaseKeys.add(`${r.kingdom_number}-${r.kvk_number}`);
    }
  } catch (e) {
    console.error('Failed to parse Supabase data:', e.message);
  }
}

console.log(`Supabase records: ${supabaseKeys.size}`);

// Find missing
const missing = csvRecords.filter(r => !supabaseKeys.has(r.key));
console.log(`Missing records: ${missing.length}`);

if (missing.length > 0) {
  // Generate SQL
  const values = missing.map(r => {
    const dateVal = r.date ? `'${r.date}'` : 'NULL';
    return `(${r.kingdom},${r.kvkNum},${r.opponent},'${r.prep}','${r.battle}','${r.overall}',${dateVal},${r.orderIndex})`;
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

  fs.writeFileSync('/tmp/kvk_missing_final.sql', sql);
  console.log('SQL written to /tmp/kvk_missing_final.sql');
  
  // Also output first few missing for debugging
  console.log('\nFirst 10 missing:');
  missing.slice(0, 10).forEach(r => console.log(`  K${r.kingdom} KvK${r.kvkNum}`));
}
