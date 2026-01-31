/**
 * KvK Data Validation Script
 * Validates data integrity between CSV source and Supabase
 * Run: node scripts/validate-kvk-data.js
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

async function validateData() {
  console.log('=== KvK Data Validation ===\n');
  
  const results = {
    passed: 0,
    failed: 0,
    warnings: 0,
    errors: []
  };

  // Test 1: CSV file exists and is readable
  console.log('Test 1: CSV file exists...');
  try {
    const stats = fs.statSync(CSV_PATH);
    if (stats.size > 0) {
      console.log('  ✓ PASS: CSV file exists (' + (stats.size / 1024).toFixed(1) + ' KB)');
      results.passed++;
    } else {
      console.log('  ✗ FAIL: CSV file is empty');
      results.failed++;
      results.errors.push('CSV file is empty');
    }
  } catch (e) {
    console.log('  ✗ FAIL: CSV file not found');
    results.failed++;
    results.errors.push('CSV file not found: ' + e.message);
  }

  // Test 2: Parse CSV and validate structure
  console.log('\nTest 2: CSV structure validation...');
  const csvContent = fs.readFileSync(CSV_PATH, 'utf-8');
  const lines = csvContent.trim().split('\n');
  const header = lines[0];
  
  const expectedColumns = ['kingdom_number', 'kvk_number', 'opponent_kingdom', 'prep_result', 'battle_result', 'overall_result', 'date'];
  const headerCols = parseCsvLine(header);
  
  let structureValid = true;
  for (let i = 0; i < expectedColumns.length; i++) {
    if (!headerCols[i] || !headerCols[i].toLowerCase().includes(expectedColumns[i].split('_')[0])) {
      structureValid = false;
      results.errors.push(`Missing or invalid column: ${expectedColumns[i]}`);
    }
  }
  
  if (structureValid) {
    console.log('  ✓ PASS: CSV has expected columns');
    results.passed++;
  } else {
    console.log('  ✗ FAIL: CSV columns do not match expected structure');
    results.failed++;
  }

  // Test 3: Parse all records
  console.log('\nTest 3: Record parsing...');
  const records = [];
  const parseErrors = [];
  
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    if (cols.length < 7) {
      parseErrors.push(`Line ${i + 1}: Insufficient columns (${cols.length})`);
      continue;
    }
    
    const kingdom = parseInt(cols[0]);
    const kvkNum = parseInt(cols[1]);
    
    if (isNaN(kingdom) || isNaN(kvkNum)) {
      parseErrors.push(`Line ${i + 1}: Invalid kingdom (${cols[0]}) or kvk_number (${cols[1]})`);
      continue;
    }
    
    records.push({
      kingdom,
      kvkNum,
      opponent: parseInt(cols[2]) || 0,
      prep: cols[3],
      battle: cols[4],
      overall: cols[5],
      date: parseDate(cols[6])
    });
  }
  
  if (parseErrors.length === 0) {
    console.log(`  ✓ PASS: All ${records.length} records parsed successfully`);
    results.passed++;
  } else if (parseErrors.length < 10) {
    console.log(`  ⚠ WARN: ${parseErrors.length} parse errors (${records.length} valid)`);
    results.warnings++;
    parseErrors.forEach(e => console.log('    - ' + e));
  } else {
    console.log(`  ✗ FAIL: ${parseErrors.length} parse errors`);
    results.failed++;
    results.errors.push(`${parseErrors.length} records failed to parse`);
  }

  // Test 4: Data validity checks
  console.log('\nTest 4: Data validity...');
  const validityErrors = [];
  const validPrep = new Set(['W', 'L', '']);
  const validBattle = new Set(['W', 'L', '']);
  
  for (const r of records) {
    if (r.kingdom < 1 || r.kingdom > 2000) {
      validityErrors.push(`Invalid kingdom: ${r.kingdom}`);
    }
    if (r.kvkNum < 1 || r.kvkNum > 20) {
      validityErrors.push(`Invalid kvk_number: ${r.kvkNum} for K${r.kingdom}`);
    }
    if (!validPrep.has(r.prep)) {
      validityErrors.push(`Invalid prep_result: ${r.prep} for K${r.kingdom}-KvK${r.kvkNum}`);
    }
    if (!validBattle.has(r.battle)) {
      validityErrors.push(`Invalid battle_result: ${r.battle} for K${r.kingdom}-KvK${r.kvkNum}`);
    }
  }
  
  if (validityErrors.length === 0) {
    console.log('  ✓ PASS: All records have valid data');
    results.passed++;
  } else {
    console.log(`  ✗ FAIL: ${validityErrors.length} validity errors`);
    results.failed++;
    validityErrors.slice(0, 5).forEach(e => console.log('    - ' + e));
    if (validityErrors.length > 5) console.log(`    ... and ${validityErrors.length - 5} more`);
  }

  // Test 5: Unique constraint check
  console.log('\nTest 5: Uniqueness check...');
  const seen = new Set();
  const duplicates = [];
  
  for (const r of records) {
    const key = `${r.kingdom}-${r.kvkNum}`;
    if (seen.has(key)) {
      duplicates.push(key);
    }
    seen.add(key);
  }
  
  if (duplicates.length === 0) {
    console.log('  ✓ PASS: No duplicate (kingdom, kvk_number) pairs');
    results.passed++;
  } else {
    console.log(`  ✗ FAIL: ${duplicates.length} duplicate keys found`);
    results.failed++;
    duplicates.slice(0, 5).forEach(d => console.log('    - ' + d));
  }

  // Test 6: Coverage stats
  console.log('\nTest 6: Coverage statistics...');
  const kingdoms = new Set(records.map(r => r.kingdom));
  const kvkNumbers = new Set(records.map(r => r.kvkNum));
  
  console.log(`  Total records: ${records.length}`);
  console.log(`  Unique kingdoms: ${kingdoms.size}`);
  console.log(`  Kingdom range: ${Math.min(...kingdoms)} - ${Math.max(...kingdoms)}`);
  console.log(`  KvK numbers: ${[...kvkNumbers].sort((a,b) => a-b).join(', ')}`);
  results.passed++;

  // Summary
  console.log('\n=== Validation Summary ===');
  console.log(`Passed: ${results.passed}`);
  console.log(`Failed: ${results.failed}`);
  console.log(`Warnings: ${results.warnings}`);
  
  if (results.failed > 0) {
    console.log('\nErrors:');
    results.errors.forEach(e => console.log('  - ' + e));
    process.exit(1);
  } else {
    console.log('\n✓ All validations passed!');
    process.exit(0);
  }
}

validateData().catch(err => {
  console.error('Validation failed:', err);
  process.exit(1);
});
