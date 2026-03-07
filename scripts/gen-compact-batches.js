const fs = require('fs');
const path = require('path');
const CSV_PATH = path.join(__dirname, '..', 'data', 'raw', 'Kingshot Transfer Groups History.csv');
const raw = fs.readFileSync(CSV_PATH, 'utf-8');
const lines = raw.split('\n').filter(l => l.trim()).slice(2);

for (let event = 2; event <= 4; event++) {
  const rows = [];
  for (const line of lines) {
    const parts = line.split(',');
    if (parts.length < 9) continue;
    const kingdom = parseInt(parts[0], 10);
    if (isNaN(kingdom) || kingdom < 1) continue;
    const groupIdx = (event - 1) * 2 + 1;
    const statusIdx = groupIdx + 1;
    const groupVal = (parts[groupIdx] || '').trim();
    const statusVal = (parts[statusIdx] || '').trim();
    if (!groupVal || groupVal === 'N/A') continue;
    const groupNum = parseInt(groupVal, 10);
    if (isNaN(groupNum)) continue;
    const status = statusVal === 'Leading' ? 'Leading' : 'Ordinary';
    rows.push(`(${kingdom},${event},${groupNum},'${status}',false)`);
  }

  const BATCH = 250;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const batchNum = Math.floor(i / BATCH) + 1;
    const totalBatches = Math.ceil(rows.length / BATCH);
    const sql = 'INSERT INTO transfer_status_history (kingdom_number,event_number,group_number,status,is_unofficial) VALUES ' + batch.join(',') + ';';
    const fname = path.join(__dirname, '..', 'data', 'generated', `batch-e${event}-b${batchNum}.sql`);
    fs.writeFileSync(fname, sql);
    console.log(`Event ${event} batch ${batchNum}/${totalBatches}: ${batch.length} rows, ${sql.length} chars`);
  }
}
