/**
 * Unit tests for isEventDay() — alliance event scheduling logic
 * Run: node tests/isEventDay.test.js
 */

const { isEventDay } = require('../src/allianceReminders');

let passed = 0;
let failed = 0;

function assert(label, actual, expected) {
  if (actual === expected) {
    passed++;
  } else {
    failed++;
    console.error(`  ❌ ${label}: expected ${expected}, got ${actual}`);
  }
}

// ─── Bear Hunt (every 2 days) ──────────────────────────────────────────────

console.log('🐻 Bear Hunt');
const bearRef = '2026-02-15T00:00:00Z'; // Saturday

assert('Day 0 (ref date itself)', isEventDay('bear_hunt', bearRef, new Date('2026-02-15T10:00:00Z')), true);
assert('Day 1 (off day)', isEventDay('bear_hunt', bearRef, new Date('2026-02-16T10:00:00Z')), false);
assert('Day 2 (event day)', isEventDay('bear_hunt', bearRef, new Date('2026-02-17T10:00:00Z')), true);
assert('Day 3 (off day)', isEventDay('bear_hunt', bearRef, new Date('2026-02-18T10:00:00Z')), false);
assert('Day 4 (event day)', isEventDay('bear_hunt', bearRef, new Date('2026-02-19T10:00:00Z')), true);
assert('No reference → always true', isEventDay('bear_hunt', null, new Date('2026-02-19T10:00:00Z')), true);
assert('Before ref date → false', isEventDay('bear_hunt', bearRef, new Date('2026-02-14T10:00:00Z')), false);

// ─── Viking Vengeance (biweekly: Tue & Thu) ────────────────────────────────

console.log('🪓 Viking Vengeance');
const vvRef = '2026-02-24T00:00:00Z'; // Tuesday

assert('Ref date (Tue) → true', isEventDay('viking_vengeance', vvRef, new Date('2026-02-24T16:00:00Z')), true);
assert('Thu same week → true', isEventDay('viking_vengeance', vvRef, new Date('2026-02-26T16:00:00Z')), true);
assert('Wed same week → false', isEventDay('viking_vengeance', vvRef, new Date('2026-02-25T16:00:00Z')), false);
assert('Tue next week (off week) → false', isEventDay('viking_vengeance', vvRef, new Date('2026-03-03T16:00:00Z')), false);
assert('Tue 2 weeks later → true', isEventDay('viking_vengeance', vvRef, new Date('2026-03-10T16:00:00Z')), true);
assert('Thu 2 weeks later → true', isEventDay('viking_vengeance', vvRef, new Date('2026-03-12T16:00:00Z')), true);
assert('No reference → true on Tue', isEventDay('viking_vengeance', null, new Date('2026-03-03T16:00:00Z')), true);
assert('No reference → false on Wed', isEventDay('viking_vengeance', null, new Date('2026-03-04T16:00:00Z')), false);

// ─── Swordland Showdown (biweekly: Sunday) ─────────────────────────────────

console.log('⚔️  Swordland Showdown');
const ssRef = '2026-02-22T00:00:00Z'; // Sunday

assert('Ref date (Sun) → true', isEventDay('swordland_showdown', ssRef, new Date('2026-02-22T10:00:00Z')), true);
assert('Mon after → false', isEventDay('swordland_showdown', ssRef, new Date('2026-02-23T10:00:00Z')), false);
assert('Sun 1 week (off week) → false', isEventDay('swordland_showdown', ssRef, new Date('2026-03-01T10:00:00Z')), false);
assert('Sun 2 weeks → true (Mar 8)', isEventDay('swordland_showdown', ssRef, new Date('2026-03-08T10:00:00Z')), true);
assert('Sun 3 weeks → false', isEventDay('swordland_showdown', ssRef, new Date('2026-03-15T10:00:00Z')), false);
assert('Sun 4 weeks → true (Mar 22)', isEventDay('swordland_showdown', ssRef, new Date('2026-03-22T10:00:00Z')), true);
assert('No reference → true on Sun', isEventDay('swordland_showdown', null, new Date('2026-03-08T10:00:00Z')), true);

// ─── Tri-Alliance Clash (monthly: Saturday, every 4 weeks) ─────────────────

console.log('🛡️  Tri-Alliance Clash');
const tacRef = '2026-02-21T00:00:00Z'; // Saturday

assert('Ref date (Sat) → true', isEventDay('tri_alliance_clash', tacRef, new Date('2026-02-21T10:00:00Z')), true);
assert('Sun after → false', isEventDay('tri_alliance_clash', tacRef, new Date('2026-02-22T10:00:00Z')), false);
assert('Sat 2 weeks → false', isEventDay('tri_alliance_clash', tacRef, new Date('2026-03-07T10:00:00Z')), false);
assert('Sat 4 weeks → true (Mar 21)', isEventDay('tri_alliance_clash', tacRef, new Date('2026-03-21T10:00:00Z')), true);
assert('Sat 8 weeks → true (Apr 18)', isEventDay('tri_alliance_clash', tacRef, new Date('2026-04-18T10:00:00Z')), true);
assert('No reference → true on Sat', isEventDay('tri_alliance_clash', null, new Date('2026-03-07T10:00:00Z')), true);

// ─── Edge Cases ────────────────────────────────────────────────────────────

console.log('🔧 Edge Cases');
assert('Unknown event type → false', isEventDay('unknown_event', null, new Date()), false);
assert('Midnight UTC boundary', isEventDay('bear_hunt', bearRef, new Date('2026-02-17T00:00:00Z')), true);
assert('Late night UTC (23:59)', isEventDay('bear_hunt', bearRef, new Date('2026-02-17T23:59:59Z')), true);

// ─── Summary ───────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) {
  console.log(`✅ All ${passed} tests passed`);
  process.exit(0);
} else {
  console.log(`❌ ${failed} failed, ${passed} passed`);
  process.exit(1);
}
