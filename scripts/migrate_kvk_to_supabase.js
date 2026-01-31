/**
 * Migration script to load KvK history from CSV into Supabase
 * Run with: node scripts/migrate_kvk_to_supabase.js
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Supabase config - using service role key for migration
const SUPABASE_URL = 'https://qdczmafwcvnwfvixxbwg.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error('ERROR: SUPABASE_SERVICE_KEY environment variable not set');
  console.error('Get it from: Supabase Dashboard > Settings > API > service_role key');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Parse date string like "Oct 11, 2025" to ISO date
function parseDate(dateStr) {
  if (!dateStr) return null;
  const cleaned = dateStr.replace(/"/g, '').trim();
  const date = new Date(cleaned);
  return isNaN(date.getTime()) ? null : date.toISOString().split('T')[0];
}

async function migrate() {
  console.log('Starting KvK history migration to Supabase...\n');

  // Read CSV file
  const csvPath = path.join(__dirname, '../apps/web/src/data/kingdoms_all_kvks.csv');
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const lines = csvContent.trim().split('\n');

  // Skip header
  const dataLines = lines.slice(1);
  console.log(`Found ${dataLines.length} KvK records to migrate\n`);

  // Parse CSV into records
  const records = [];
  for (const line of dataLines) {
    // Parse CSV: kingdom_number,kvk_number,opponent_kingdom,prep_result,battle_result,overall_result,kvk_date,order_index
    const parts = line.split(',');
    if (parts.length < 8) continue;

    const kingdom_number = parseInt(parts[0]);
    const kvk_number = parseInt(parts[1]);
    const opponent_kingdom = parseInt(parseFloat(parts[2])); // Some have .0
    const prep_result = parts[3].trim();
    const battle_result = parts[4].trim();
    const overall_result = parts[5].trim();
    const kvk_date = parseDate(parts[6]);
    const order_index = parseInt(parts[7]);

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

  // Insert in batches of 500
  const BATCH_SIZE = 500;
  let inserted = 0;
  let errors = 0;

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    
    const { data, error } = await supabase
      .from('kvk_history')
      .upsert(batch, { onConflict: 'kingdom_number,kvk_number' });

    if (error) {
      console.error(`Batch ${Math.floor(i / BATCH_SIZE) + 1} error:`, error.message);
      errors += batch.length;
    } else {
      inserted += batch.length;
      console.log(`Inserted batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} records (total: ${inserted})`);
    }
  }

  console.log(`\n✅ Migration complete!`);
  console.log(`   Inserted: ${inserted} records`);
  console.log(`   Errors: ${errors} records`);

  // Verify count
  const { count } = await supabase
    .from('kvk_history')
    .select('*', { count: 'exact', head: true });

  console.log(`   Total in database: ${count} records`);
}

migrate().catch(console.error);
