#!/usr/bin/env node
/**
 * Script to parse kvk_results.csv and populate kingdoms.json with full KvK history
 * 
 * CSV Format:
 * Row 1: Column status (percentages)
 * Row 2: KvK headers with dates
 * Row 3: Column names
 * Row 4+: Kingdom data
 * 
 * Columns: Row Status, Kingdom, KvKs, Wins, Preparations, Battles, Losses, Byes, Draws, Unknowns,
 *          Total Preps, Total Battles, Total Opp Other Preps, Opp Prep KvKs, Total Opp Other Battles, Opp Battle KvKs,
 *          Then pairs of (Opponent, Result) for each KvK
 */

const fs = require('fs');
const path = require('path');

const CSV_PATH = path.join(__dirname, '../data/raw/kvk_results.csv');
const JSON_PATH = path.join(__dirname, '../apps/web/src/data/kingdoms.json');

// KvK dates from the CSV header
const KVK_DATES = {
  1: 'May 24, 2025',
  2: 'Jun 21, 2025',
  3: 'Jul 19, 2025',
  4: 'Aug 16, 2025',
  5: 'Sep 13, 2025',
  6: 'Oct 11, 2025',
  7: 'Nov 8, 2025',
  8: 'Dec 6, 2025',
  9: 'Jan 3, 2026'
};

function parseCSV(csvContent) {
  const lines = csvContent.split('\n');
  const kingdoms = [];
  const kvkRecords = [];

  // Skip first 3 header rows, start from row 4 (index 3)
  for (let i = 3; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Parse CSV with proper handling of commas
    const cols = line.split(',');
    
    const rowStatus = cols[0];
    if (rowStatus !== 'Complete') continue;

    const kingdomNumber = parseInt(cols[1], 10);
    if (isNaN(kingdomNumber)) continue;

    const totalKvks = parseInt(cols[2], 10) || 0;
    const wins = parseInt(cols[3], 10) || 0;
    const preparations = parseInt(cols[4], 10) || 0;
    const battles = parseInt(cols[5], 10) || 0;
    const losses = parseInt(cols[6], 10) || 0;
    const byes = parseInt(cols[7], 10) || 0;

    // Calculate stats
    const prepWins = wins + preparations; // Wins include prep wins
    const prepLosses = losses;
    const battleWins = wins + battles;
    const battleLosses = losses;

    // Parse KvK results - starts at column 16 (index 16), pairs of (Opponent, Result)
    let kvkNumber = 1;
    let prepStreak = 0;
    let battleStreak = 0;
    let prepLossStreak = 0;
    let battleLossStreak = 0;
    let prepBestStreak = 0;
    let battleBestStreak = 0;
    let currentPrepStreak = 0;
    let currentBattleStreak = 0;
    let currentPrepLossStreak = 0;
    let currentBattleLossStreak = 0;

    for (let j = 16; j < cols.length && kvkNumber <= 9; j += 2) {
      const opponent = cols[j];
      const result = cols[j + 1];

      if (opponent && opponent !== 'N/A' && result && result !== 'N/A') {
        const opponentKingdom = parseInt(opponent, 10);
        
        // Determine prep and battle results from overall result
        let prepResult, battleResult, overallResult;
        
        switch (result) {
          case 'Win':
            prepResult = 'W';
            battleResult = 'W';
            overallResult = 'Win';
            currentPrepStreak++;
            currentBattleStreak++;
            currentPrepLossStreak = 0;
            currentBattleLossStreak = 0;
            break;
          case 'Loss':
            prepResult = 'L';
            battleResult = 'L';
            overallResult = 'Loss';
            currentPrepLossStreak++;
            currentBattleLossStreak++;
            currentPrepStreak = 0;
            currentBattleStreak = 0;
            break;
          case 'Preparation':
            prepResult = 'W';
            battleResult = 'L';
            overallResult = 'Preparation';
            currentPrepStreak++;
            currentBattleLossStreak++;
            currentPrepLossStreak = 0;
            currentBattleStreak = 0;
            break;
          case 'Battle':
            prepResult = 'L';
            battleResult = 'W';
            overallResult = 'Battle';
            currentPrepLossStreak++;
            currentBattleStreak++;
            currentPrepStreak = 0;
            currentBattleLossStreak = 0;
            break;
          case 'Bye':
            kvkNumber++;
            continue;
          default:
            kvkNumber++;
            continue;
        }

        // Track best streaks
        if (currentPrepStreak > prepBestStreak) prepBestStreak = currentPrepStreak;
        if (currentBattleStreak > battleBestStreak) battleBestStreak = currentBattleStreak;

        kvkRecords.push({
          kingdom_number: kingdomNumber,
          kvk_number: kvkNumber,
          opponent_kingdom: opponentKingdom,
          prep_result: prepResult,
          battle_result: battleResult,
          overall_result: overallResult,
          date_or_order_index: KVK_DATES[kvkNumber] || `KvK ${kvkNumber}`
        });
      }

      kvkNumber++;
    }

    // Current streaks are the final values
    prepStreak = currentPrepStreak;
    battleStreak = currentBattleStreak;
    prepLossStreak = currentPrepLossStreak;
    battleLossStreak = currentBattleLossStreak;

    // Calculate win rates
    const actualPrepWins = kvkRecords.filter(r => r.kingdom_number === kingdomNumber && (r.prep_result === 'W')).length;
    const actualBattleWins = kvkRecords.filter(r => r.kingdom_number === kingdomNumber && (r.battle_result === 'W')).length;
    const kingdomKvks = kvkRecords.filter(r => r.kingdom_number === kingdomNumber).length;

    const prepWinRate = kingdomKvks > 0 ? actualPrepWins / kingdomKvks : 0;
    const battleWinRate = kingdomKvks > 0 ? actualBattleWins / kingdomKvks : 0;

    // Calculate overall score (weighted average)
    const overallScore = (prepWinRate * 0.4 + battleWinRate * 0.6) * 10;

    kingdoms.push({
      kingdom_number: kingdomNumber,
      total_kvks: totalKvks,
      prep_wins: actualPrepWins,
      prep_losses: kingdomKvks - actualPrepWins,
      prep_win_rate: prepWinRate,
      prep_streak: prepStreak,
      prep_loss_streak: prepLossStreak,
      prep_best_streak: prepBestStreak,
      battle_wins: actualBattleWins,
      battle_losses: kingdomKvks - actualBattleWins,
      battle_win_rate: battleWinRate,
      battle_streak: battleStreak,
      battle_loss_streak: battleLossStreak,
      battle_best_streak: battleBestStreak,
      overall_score: Math.round(overallScore * 100) / 100
    });
  }

  return { kingdoms, kvkRecords };
}

function main() {
  console.log('Reading CSV file...');
  const csvContent = fs.readFileSync(CSV_PATH, 'utf-8');

  console.log('Parsing CSV data...');
  const { kingdoms, kvkRecords } = parseCSV(csvContent);

  console.log(`Parsed ${kingdoms.length} kingdoms and ${kvkRecords.length} KvK records`);

  // Read existing JSON to preserve any additional fields
  let existingData = { kingdoms: [], kvk_records: [] };
  try {
    existingData = JSON.parse(fs.readFileSync(JSON_PATH, 'utf-8'));
    console.log(`Existing JSON has ${existingData.kingdoms?.length || 0} kingdoms and ${existingData.kvk_records?.length || 0} records`);
  } catch (e) {
    console.log('No existing JSON found, creating new file');
  }

  // Merge data - update existing kingdoms with new data
  const mergedKingdoms = kingdoms.map(newK => {
    const existingK = existingData.kingdoms?.find(k => k.kingdom_number === newK.kingdom_number);
    return existingK ? { ...existingK, ...newK } : newK;
  });

  // Write updated JSON
  const outputData = {
    kingdoms: mergedKingdoms,
    kvk_records: kvkRecords
  };

  fs.writeFileSync(JSON_PATH, JSON.stringify(outputData, null, 2));
  console.log(`\nUpdated ${JSON_PATH}`);
  console.log(`Total kingdoms: ${mergedKingdoms.length}`);
  console.log(`Total KvK records: ${kvkRecords.length}`);

  // Verify Kingdom 139
  const k139 = mergedKingdoms.find(k => k.kingdom_number === 139);
  const k139Records = kvkRecords.filter(r => r.kingdom_number === 139);
  console.log(`\nKingdom 139 verification:`);
  console.log(`  Total KvKs: ${k139?.total_kvks}`);
  console.log(`  Records in data: ${k139Records.length}`);
  console.log(`  KvKs: ${k139Records.map(r => r.kvk_number).join(', ')}`);
}

main();
