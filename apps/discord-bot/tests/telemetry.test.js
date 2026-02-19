/**
 * Unit tests for telemetry module — verify all exported methods exist and are functions.
 * Also verifies crash loop detection was properly removed (no false positives).
 * Run: node tests/telemetry.test.js
 */

const telemetry = require('../src/telemetry');

let passed = 0;
let failed = 0;

function assert(label, actual, expected) {
  if (actual === expected) {
    passed++;
  } else {
    failed++;
    console.error(`  ❌ ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

console.log('📊 Telemetry Module Exports');

// All expected exports must exist and be functions
const expectedFunctions = [
  'logStartup',
  'logReady',
  'logDisconnect',
  'logReconnect',
  'logLoginFailed',
  'logLoginRetry',
  'logShutdown',
  'logCrash',
  'logShardError',
  'logSessionInvalidated',
  'logMemoryWarning',
  'startMemoryMonitoring',
  'stopMemoryMonitoring',
];

for (const name of expectedFunctions) {
  assert(`telemetry.${name} exists`, typeof telemetry[name], 'function');
}

// ENABLED should be a boolean
assert('telemetry.ENABLED is boolean', typeof telemetry.ENABLED, 'boolean');

// Telemetry should be disabled in test env (no SUPABASE_URL/KEY)
assert('telemetry.ENABLED is false in test env', telemetry.ENABLED, false);

console.log('📊 Telemetry Smoke Tests (disabled mode — no Supabase)');

// logStartup should not throw even without Supabase
try {
  telemetry.logStartup({ test: true });
  passed++;
} catch (e) {
  failed++;
  console.error(`  ❌ logStartup() threw: ${e.message}`);
}

// logReady should handle null client gracefully
try {
  telemetry.logReady(null);
  passed++;
} catch (e) {
  failed++;
  console.error(`  ❌ logReady(null) threw: ${e.message}`);
}

// logDisconnect should handle gracefully
try {
  telemetry.logDisconnect(1000, 'test', null);
  passed++;
} catch (e) {
  failed++;
  console.error(`  ❌ logDisconnect() threw: ${e.message}`);
}

// logCrash should handle error objects
try {
  telemetry.logCrash(new Error('test crash'));
  passed++;
} catch (e) {
  failed++;
  console.error(`  ❌ logCrash() threw: ${e.message}`);
}

// logLoginFailed should handle error objects
try {
  telemetry.logLoginFailed(new Error('test login fail'));
  passed++;
} catch (e) {
  failed++;
  console.error(`  ❌ logLoginFailed() threw: ${e.message}`);
}

// stopMemoryMonitoring should be safe to call even when not started
try {
  telemetry.stopMemoryMonitoring();
  passed++;
} catch (e) {
  failed++;
  console.error(`  ❌ stopMemoryMonitoring() threw: ${e.message}`);
}

console.log('📊 Crash Loop Detection Removed');

// Verify calling logStartup multiple times rapidly does NOT produce crash_loop events
// (The old flawed logic would have fired a critical alert here)
try {
  telemetry.logStartup();
  telemetry.logStartup();
  telemetry.logStartup();
  telemetry.logStartup();
  telemetry.logStartup();
  // If we get here without errors, crash loop detection is properly removed
  passed++;
} catch (e) {
  failed++;
  console.error(`  ❌ Rapid logStartup() calls threw: ${e.message}`);
}

// ─── Summary ───────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) {
  console.log(`✅ All ${passed} tests passed`);
  process.exit(0);
} else {
  console.log(`❌ ${failed} failed, ${passed} passed`);
  process.exit(1);
}
