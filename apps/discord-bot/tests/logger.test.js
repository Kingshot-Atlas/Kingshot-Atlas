/**
 * Unit tests for logger module — verify all exported methods exist and are functions.
 * Prevents silent breakage when logger API changes (e.g. reactionRoles crash).
 * Run: node tests/logger.test.js
 */

const logger = require('../src/utils/logger');

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

console.log('📝 Logger Module Exports');

// All expected exports must exist and be functions
const expectedFunctions = [
  'logCommand',
  'logError',
  'logGuildEvent',
  'logMultirallyUpsell',
  'getStats',
  'getFormattedStats',
  'syncToApi',
  'error',
  'info',
  'warn',
  'debug',
];

for (const name of expectedFunctions) {
  assert(`logger.${name} exists`, typeof logger[name], 'function');
}

// Verify convenience methods don't throw when called with basic args
console.log('📝 Logger Convenience Methods (smoke test)');

try {
  logger.info('test info message');
  passed++;
} catch (e) {
  failed++;
  console.error(`  ❌ logger.info() threw: ${e.message}`);
}

try {
  logger.warn('test warn message');
  passed++;
} catch (e) {
  failed++;
  console.error(`  ❌ logger.warn() threw: ${e.message}`);
}

try {
  logger.error('test error message');
  passed++;
} catch (e) {
  failed++;
  console.error(`  ❌ logger.error() threw: ${e.message}`);
}

try {
  logger.debug('test debug message');
  passed++;
} catch (e) {
  failed++;
  console.error(`  ❌ logger.debug() threw: ${e.message}`);
}

// getStats should return an object with expected shape
console.log('📝 Logger getStats Shape');
const stats = logger.getStats();
assert('getStats returns object', typeof stats, 'object');
assert('getStats has totals', typeof stats.totals, 'object');
assert('getStats has today', typeof stats.today, 'object');
assert('getStats has topCommands', Array.isArray(stats.topCommands), true);

// getFormattedStats should return a string
assert('getFormattedStats returns string', typeof logger.getFormattedStats(), 'string');

// ─── Summary ───────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) {
  console.log(`✅ All ${passed} tests passed`);
  process.exit(0);
} else {
  console.log(`❌ ${failed} failed, ${passed} passed`);
  process.exit(1);
}
