#!/usr/bin/env node
/**
 * Parse the Transfer Groups History CSV and output SQL INSERT statements
 * for transfer_events and transfer_status_history tables.
 * 
 * Usage: node scripts/seed-transfer-history.js
 */

const fs = require('fs');
const path = require('path');

const CSV_PATH = path.join(__dirname, '..', 'data', 'raw', 'Kingshot Transfer Groups History.csv');

// Corrected dates per user
const EVENT_DATES = {
  1: '2025-09-14',
  2: '2025-11-09',
  3: '2026-01-04',
  4: '2026-03-01',
};

function parseCSV() {
  const raw = fs.readFileSync(CSV_PATH, 'utf-8');
  const lines = raw.split('\n').filter(l => l.trim());
  
  // Skip header rows (line 0 = event names/dates, line 1 = column headers)
  const dataLines = lines.slice(2);
  
  const rows = [];
  
  for (const line of dataLines) {
    // Parse CSV carefully (handles quoted fields)
    const parts = line.split(',');
    if (parts.length < 9) continue;
    
    const kingdom = parseInt(parts[0], 10);
    if (isNaN(kingdom) || kingdom < 1) continue;
    
    // Transfer #1: cols 1,2
    // Transfer #2: cols 3,4
    // Transfer #3: cols 5,6
    // Transfer #4: cols 7,8
    for (let event = 1; event <= 4; event++) {
      const groupIdx = (event - 1) * 2 + 1;
      const statusIdx = groupIdx + 1;
      const groupVal = parts[groupIdx]?.trim();
      const statusVal = parts[statusIdx]?.trim();
      
      if (!groupVal || groupVal === 'N/A' || !statusVal || statusVal === 'N/A') continue;
      
      const groupNum = parseInt(groupVal, 10);
      if (isNaN(groupNum)) continue;
      
      rows.push({
        kingdom_number: kingdom,
        event_number: event,
        group_number: groupNum,
        status: statusVal === 'Leading' ? 'Leading' : 'Ordinary',
        is_unofficial: false,
      });
    }
  }
  
  return rows;
}

function computeGroupStats(rows) {
  const stats = {};
  for (const r of rows) {
    const key = r.event_number;
    if (!stats[key]) stats[key] = new Set();
    stats[key].add(r.group_number);
  }
  return Object.fromEntries(
    Object.entries(stats).map(([e, groups]) => [e, groups.size])
  );
}

function generateSQL(rows) {
  const groupStats = computeGroupStats(rows);
  
  const lines = [];
  
  // Insert transfer events
  lines.push('-- Transfer Events');
  for (let e = 1; e <= 4; e++) {
    const isCurrent = e === 4;
    lines.push(
      `INSERT INTO transfer_events (event_number, event_date, total_groups, is_current) VALUES (${e}, '${EVENT_DATES[e]}', ${groupStats[e]}, ${isCurrent});`
    );
  }
  lines.push('');
  
  // Insert transfer_status_history in batches by event
  for (let event = 1; event <= 4; event++) {
    const eventRows = rows.filter(r => r.event_number === event);
    lines.push(`-- Transfer #${event}: ${eventRows.length} kingdoms`);
    
    // Batch inserts (100 rows per INSERT for efficiency)
    const BATCH_SIZE = 100;
    for (let i = 0; i < eventRows.length; i += BATCH_SIZE) {
      const batch = eventRows.slice(i, i + BATCH_SIZE);
      const values = batch.map(r => 
        `(${r.kingdom_number}, ${r.event_number}, ${r.group_number}, '${r.status}', ${r.is_unofficial})`
      ).join(',\n  ');
      
      lines.push(`INSERT INTO transfer_status_history (kingdom_number, event_number, group_number, status, is_unofficial) VALUES\n  ${values};`);
    }
    lines.push('');
  }
  
  return lines.join('\n');
}

// Run
const rows = parseCSV();
console.log(`Parsed ${rows.length} transfer status entries from CSV`);

const groupStats = computeGroupStats(rows);
for (const [event, groups] of Object.entries(groupStats)) {
  const eventRows = rows.filter(r => r.event_number === parseInt(event));
  console.log(`  Transfer #${event}: ${eventRows.length} kingdoms, ${groups} groups`);
}

const sql = generateSQL(rows);
const outPath = path.join(__dirname, '..', 'data', 'generated', 'transfer-history-seed.sql');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, sql, 'utf-8');
console.log(`\nSQL written to: ${outPath}`);
