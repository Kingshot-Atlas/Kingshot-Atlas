#!/usr/bin/env node
/**
 * Consistency Lint — Automated Drift Detection
 * 
 * Catches the classes of issues that accumulate silently:
 *   1. Banned/deprecated terms in code (e.g., "Atlas Pro", "Railway")
 *   2. Stale documentation (key files not updated in X days)
 *   3. Dead exports / orphan files
 *   4. Naming mismatches between code and branding
 * 
 * Usage: node scripts/consistency-lint.js [--strict]
 *   --strict: exit code 1 on any warning (use in CI)
 * 
 * Add new rules by extending BANNED_TERMS, FRESHNESS_CHECKS, or NAMING_CHECKS.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const WEB_SRC = path.join(ROOT, 'apps', 'web', 'src');
const API_DIR = path.join(ROOT, 'apps', 'api');
const DOCS_DIR = path.join(ROOT, 'docs');
const AGENTS_DIR = path.join(ROOT, 'agents');
const strict = process.argv.includes('--strict');

let warnings = 0;
let errors = 0;

// ─── Helpers ────────────────────────────────────────────────────────────────

function warn(category, message) {
  warnings++;
  console.log(`  ⚠️  [${category}] ${message}`);
}

function error(category, message) {
  errors++;
  console.log(`  ❌ [${category}] ${message}`);
}

function walkFiles(dir, extensions, ignore = []) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    
    if (ignore.some(pattern => fullPath.includes(pattern))) continue;
    
    if (item.isDirectory()) {
      results.push(...walkFiles(fullPath, extensions, ignore));
    } else if (extensions.some(ext => item.name.endsWith(ext))) {
      results.push(fullPath);
    }
  }
  return results;
}

function daysSinceModified(filePath) {
  try {
    const stat = fs.statSync(filePath);
    return (Date.now() - stat.mtimeMs) / (1000 * 60 * 60 * 24);
  } catch {
    return -1;
  }
}

function relPath(filePath) {
  return path.relative(ROOT, filePath);
}

// ─── 1. BANNED TERMS ────────────────────────────────────────────────────────
// Terms that should NOT appear in source code or docs.
// Each entry: { pattern, message, include (glob-like extensions), exclude (path fragments) }

const BANNED_TERMS = [
  {
    pattern: /\bAtlas Pro\b/gi,
    message: 'Use "Atlas Supporter" (rebranded Feb 2026)',
    include: ['.tsx', '.ts', '.md'],
    exclude: ['node_modules', 'CHANGELOG.md', 'ACTIVITY_LOG.md', 'DECISIONS.md', '.git', 'venv'],
    // Allow in historical docs — only flag in active code and current docs
    allowInPaths: ['releases/', 'archive/'],
  },
  {
    pattern: /\brailway\.app\b/gi,
    message: 'Railway was never used — API is on Render',
    include: ['.ts', '.tsx', '.py', '.json'],
    exclude: ['node_modules', '.git', 'venv', 'railway.json'],
  },
  {
    pattern: /\bnetlify\b/gi,
    message: 'Frontend migrated to Cloudflare Pages (Feb 2026)',
    include: ['.ts', '.tsx', '.py'],
    exclude: ['node_modules', '.git', 'venv'],
  },
  {
    pattern: /VITE_STRIPE_RECRUITER/g,
    message: 'Recruiter tier was removed — clean up env var references',
    include: ['.ts', '.tsx', '.env', '.env.example'],
    exclude: ['node_modules', '.git'],
  },
];

function runBannedTermsCheck() {
  console.log('\n🔍 Checking for banned/deprecated terms...');
  
  const allFiles = [
    ...walkFiles(WEB_SRC, ['.ts', '.tsx'], ['node_modules', '.git']),
    ...walkFiles(API_DIR, ['.py', '.json', '.md'], ['node_modules', '.git', 'venv']),
  ];
  
  // Also check .env files explicitly
  const envFiles = ['.env', '.env.example'].map(f => path.join(ROOT, 'apps', 'web', f)).filter(f => fs.existsSync(f));
  
  for (const rule of BANNED_TERMS) {
    const filesToCheck = [...allFiles, ...envFiles].filter(f => {
      const ext = path.extname(f) || path.basename(f);
      if (!rule.include.some(inc => f.endsWith(inc) || ext === inc)) return false;
      if (rule.exclude?.some(exc => f.includes(exc))) return false;
      if (rule.allowInPaths?.some(p => f.includes(p))) return false;
      return true;
    });
    
    for (const file of filesToCheck) {
      try {
        const content = fs.readFileSync(file, 'utf-8');
        const matches = content.match(rule.pattern);
        if (matches) {
          warn('BANNED_TERM', `${relPath(file)}: Found "${matches[0]}" — ${rule.message}`);
        }
      } catch { /* skip unreadable files */ }
    }
  }
}

// ─── 2. DOC FRESHNESS ───────────────────────────────────────────────────────
// Key docs that should be updated regularly. Warns if stale beyond threshold.

const FRESHNESS_CHECKS = [
  {
    file: 'docs/CHANGELOG.md',
    maxDays: 7,
    message: 'CHANGELOG not updated in over a week — users can\'t see recent work',
  },
  {
    file: 'agents/project-instances/kingshot-atlas/STATUS_SNAPSHOT.md',
    maxDays: 5,
    message: 'STATUS_SNAPSHOT is stale — agents will work from outdated context',
  },
  {
    file: 'agents/project-instances/kingshot-atlas/FEATURES_IMPLEMENTED.md',
    maxDays: 7,
    message: 'FEATURES_IMPLEMENTED may be out of date — risk of duplicate work',
  },
  {
    file: 'docs/releases/coming-soon.md',
    maxDays: 14,
    message: 'Coming-soon page may list shipped features as "in progress"',
  },
  {
    file: 'agents/project-instances/kingshot-atlas/DECISIONS.md',
    maxDays: 14,
    message: 'DECISIONS.md may be missing recent ADRs — new architectural decisions undocumented',
  },
  {
    file: 'agents/AGENT_REGISTRY.md',
    maxDays: 30,
    message: 'AGENT_REGISTRY.md is stale — agent capabilities may have changed',
  },
];

function runFreshnessCheck() {
  console.log('\n📅 Checking document freshness...');
  
  for (const check of FRESHNESS_CHECKS) {
    const fullPath = path.join(ROOT, check.file);
    const days = daysSinceModified(fullPath);
    
    if (days < 0) {
      warn('FRESHNESS', `${check.file}: File not found`);
    } else if (days > check.maxDays) {
      warn('FRESHNESS', `${check.file}: Last modified ${Math.floor(days)}d ago (max ${check.maxDays}d) — ${check.message}`);
    }
  }
}

// ─── 3. COMPONENT SIZE ──────────────────────────────────────────────────────
// Flag components that exceed a line-count threshold.
// Known large files are baselined — only NEW files growing past the limit trigger warnings.

const MAX_COMPONENT_LINES = 800;

// Baseline: Known large files as of 2026-02-12. These need dedicated refactor sessions.
// Remove entries from this list as they get split.
const SIZE_BASELINE = new Set([
  'apps/web/src/pages/AdminDashboard.tsx',
  'apps/web/src/pages/CompareKingdoms.tsx',
  'apps/web/src/pages/GiftCodeRedeemer.tsx',
  'apps/web/src/pages/KingdomDirectory.tsx',
  'apps/web/src/pages/Leaderboards.tsx',
  'apps/web/src/pages/MissingDataRegistry.tsx',
  'apps/web/src/pages/Profile.tsx',
  'apps/web/src/pages/RallyCoordinator.tsx',
  'apps/web/src/pages/TransferBoard.tsx',
  'apps/web/src/pages/UserDirectory.tsx',
  'apps/web/src/pages/BotDashboard.tsx',
  'apps/web/src/components/EditorClaiming.tsx',
  'apps/web/src/components/KingdomListingCard.tsx',
  'apps/web/src/components/KingdomReviews.tsx',
  'apps/web/src/components/RecruiterDashboard.tsx',
  'apps/web/src/components/TransferApplications.tsx',
  'apps/web/src/components/recruiter/ApplicationCard.tsx',
  'apps/web/src/components/recruiter/BrowseTransfereesTab.tsx',
  'apps/web/src/components/TransferProfileForm.tsx',
  'apps/web/src/components/admin/SpotlightTab.tsx',
  'apps/web/src/components/admin/TransferHubAdminTab.tsx',
  'apps/web/src/components/admin/ImportTab.tsx',
  'apps/web/src/components/rally/RallySubComponents.tsx',
]);

function runComponentSizeCheck() {
  console.log('\n📏 Checking component sizes...');
  
  const componentDirs = [
    path.join(WEB_SRC, 'pages'),
    path.join(WEB_SRC, 'components'),
  ];
  
  let baselinedCount = 0;
  
  for (const dir of componentDirs) {
    const files = walkFiles(dir, ['.tsx'], ['node_modules', '.test.', '__tests__']);
    
    for (const file of files) {
      try {
        const content = fs.readFileSync(file, 'utf-8');
        const lines = content.split('\n').length;
        const rel = relPath(file);
        
        if (lines > MAX_COMPONENT_LINES) {
          if (SIZE_BASELINE.has(rel)) {
            baselinedCount++;
          } else {
            warn('SIZE', `${rel}: ${lines} lines (max ${MAX_COMPONENT_LINES}) — consider splitting`);
          }
        }
      } catch { /* skip */ }
    }
  }
  
  if (baselinedCount > 0) {
    console.log(`     ℹ️  ${baselinedCount} baselined large files tracked (not blocking)`);
  }
}

// ─── 4. ESLINT-DISABLE AUDIT ────────────────────────────────────────────────
// Count eslint-disable comments — they accumulate silently.

// Baseline: 30 eslint-disable comments as of 2026-02-19.
// Most are intentional React "fetch on dep change" patterns.
// This threshold catches NEW additions beyond the baseline.
const MAX_ESLINT_DISABLES = 30;

function runEslintDisableCheck() {
  console.log('\n🚫 Checking eslint-disable count...');
  
  const files = walkFiles(WEB_SRC, ['.ts', '.tsx'], ['node_modules', '.test.', '__tests__']);
  let totalDisables = 0;
  const fileHits = [];
  
  for (const file of files) {
    try {
      const content = fs.readFileSync(file, 'utf-8');
      const matches = content.match(/eslint-disable/g);
      if (matches) {
        totalDisables += matches.length;
        fileHits.push({ file: relPath(file), count: matches.length });
      }
    } catch { /* skip */ }
  }
  
  if (totalDisables > MAX_ESLINT_DISABLES) {
    warn('ESLINT_DISABLE', `${totalDisables} eslint-disable comments across ${fileHits.length} files (max ${MAX_ESLINT_DISABLES})`);
    for (const hit of fileHits) {
      console.log(`      → ${hit.file} (${hit.count})`);
    }
  }
}

// ─── 5. STALE FILE DETECTOR ─────────────────────────────────────────────────
// Files that are known to be stale / should not exist.

const STALE_FILES = [
  { file: 'apps/api/railway.json', reason: 'Railway was never used — API is on Render' },
];

function runStaleFileCheck() {
  console.log('\n🗑️  Checking for known stale files...');
  
  for (const check of STALE_FILES) {
    const fullPath = path.join(ROOT, check.file);
    if (fs.existsSync(fullPath)) {
      warn('STALE_FILE', `${check.file} still exists — ${check.reason}`);
    }
  }
}

// ─── 6. SHARED COMPONENT ADOPTION ────────────────────────────────────────────
// Detect inline patterns that should use shared components from components/shared/.
// This catches NEW instances of anti-patterns documented in STYLE_GUIDE.md.

function runSharedComponentCheck() {
  console.log('\n🧩 Checking shared component adoption...');
  
  const files = walkFiles(WEB_SRC, ['.tsx'], ['node_modules', '.test.', '__tests__', 'shared/']);
  
  // Pattern: inline <button style={{...}}> that should use <Button> from shared
  // Exclude files that already import Button from shared
  const buttonAntiPattern = /<button\s+style=\{\{/g;
  
  // Pattern: dead Tooltip imports (non-shared Tooltip.tsx was deleted)
  const deadTooltipImport = /from\s+['"].*\/Tooltip['"]/g;
  const smartTooltipImport = /SmartTooltip/;
  
  for (const file of files) {
    try {
      const content = fs.readFileSync(file, 'utf-8');
      const rel = relPath(file);
      
      // Check for inline styled buttons (skip if file already uses shared Button)
      const usesSharedButton = /from\s+['"].*shared['"]/.test(content) && /Button/.test(content);
      if (!usesSharedButton) {
        const buttonMatches = content.match(buttonAntiPattern);
        if (buttonMatches && buttonMatches.length >= 2) {
          warn('SHARED_COMPONENT', `${rel}: ${buttonMatches.length} inline <button style={{}}> — consider using <Button> from shared/`);
        }
      }
      
      // Check for dead Tooltip imports (should use SmartTooltip)
      if (deadTooltipImport.test(content) && !smartTooltipImport.test(content)) {
        warn('SHARED_COMPONENT', `${rel}: imports non-shared Tooltip — use SmartTooltip from shared/ instead`);
      }
    } catch { /* skip */ }
  }
}

// ─── 7. STALE IN-PROGRESS DETECTOR ──────────────────────────────────────────
// Detect features marked "In Progress" in FEATURES_IMPLEMENTED.md that may be stale.

function runStaleInProgressCheck() {
  console.log('\n🔄 Checking for stale In Progress items...');
  
  const featuresFile = path.join(ROOT, 'agents', 'project-instances', 'kingshot-atlas', 'FEATURES_IMPLEMENTED.md');
  if (!fs.existsSync(featuresFile)) {
    warn('STALE_PROGRESS', 'FEATURES_IMPLEMENTED.md not found');
    return;
  }
  
  const content = fs.readFileSync(featuresFile, 'utf-8');
  const lines = content.split('\n');
  const staleItems = [];
  const now = Date.now();
  const MAX_IN_PROGRESS_DAYS = 14;
  
  for (const line of lines) {
    // Skip legend/header rows (e.g., "| 🔨 In Progress | Currently being developed |")
    if (/Legend|Status.*Meaning|^\|[-\s|]+\|$/.test(line)) continue;
    if (/Currently being developed/.test(line)) continue;
    if (/🔨 In Progress|In Progress/.test(line) && line.includes('|')) {
      // Try to extract date from the line (format: 2026-MM-DD in notes or date column)
      const dateMatch = line.match(/(\d{4}-\d{2}-\d{2})/);
      if (dateMatch) {
        const itemDate = new Date(dateMatch[1]);
        const daysSince = (now - itemDate.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSince > MAX_IN_PROGRESS_DAYS) {
          // Extract feature name (first cell after |)
          const cells = line.split('|').map(c => c.trim()).filter(Boolean);
          const name = cells[0] || 'Unknown';
          staleItems.push({ name, days: Math.floor(daysSince), date: dateMatch[1] });
        }
      } else {
        // No date found — flag as potentially stale
        const cells = line.split('|').map(c => c.trim()).filter(Boolean);
        const name = cells[0] || 'Unknown';
        staleItems.push({ name, days: -1, date: 'no date' });
      }
    }
  }
  
  for (const item of staleItems) {
    if (item.days > 0) {
      warn('STALE_PROGRESS', `"${item.name}" has been In Progress for ${item.days}d (since ${item.date}, max ${MAX_IN_PROGRESS_DAYS}d)`);
    } else {
      warn('STALE_PROGRESS', `"${item.name}" is In Progress with no date — may be stale`);
    }
  }
}

// ─── 8. CHANGELOG SYNC DETECTOR ──────────────────────────────────────────────
// Detect drift between Changelog.tsx (user-facing React) and CHANGELOG.md (markdown).
// Extracts dates from both and warns about entries present in one but missing from the other.

// Entries before this date are excluded from sync checks (predate CHANGELOG.md creation).
const CHANGELOG_SYNC_IGNORE_BEFORE = new Date('2026-02-01');

// Intentional exclusions — dates that exist in one source but not the other by design.
// Format: "Month DD, YYYY" (normalized, no parenthetical suffixes).
const CHANGELOG_SYNC_ALLOW_LIST = new Set([
  // Feb 14 component refactoring is internal — intentionally excluded from user-facing Changelog.tsx
  'February 14, 2026',
]);

function runChangelogSyncCheck() {
  console.log('\n🔄 Checking Changelog.tsx ↔ CHANGELOG.md sync...');
  
  const jsonFile = path.join(WEB_SRC, 'data', 'changelog.json');
  const mdFile = path.join(DOCS_DIR, 'CHANGELOG.md');
  
  if (!fs.existsSync(jsonFile)) {
    warn('CHANGELOG_SYNC', 'src/data/changelog.json not found');
    return;
  }
  if (!fs.existsSync(mdFile)) {
    warn('CHANGELOG_SYNC', 'CHANGELOG.md not found');
    return;
  }
  
  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  
  // Parse "Month DD, YYYY" → Date for filtering
  function parseHumanDate(str) {
    const parts = str.match(/(\w+)\s+(\d+),\s+(\d{4})/);
    if (!parts) return null;
    const mi = monthNames.indexOf(parts[1]);
    return mi >= 0 ? new Date(+parts[3], mi, +parts[2]) : null;
  }
  
  // Extract dates from changelog.json (the single source of truth for user-facing changelog)
  const jsonData = JSON.parse(fs.readFileSync(jsonFile, 'utf-8'));
  const jsonDates = new Set();
  for (const entry of jsonData) {
    const normalized = entry.date.replace(/\s*\(.*\)/, '').trim();
    const d = parseHumanDate(normalized);
    if (d && d >= CHANGELOG_SYNC_IGNORE_BEFORE) {
      jsonDates.add(normalized);
    }
  }
  
  // Extract dates from CHANGELOG.md (format: ## [2026-02-12] — Title)
  const mdContent = fs.readFileSync(mdFile, 'utf-8');
  const mdDatePattern = /^## \[(\d{4}-\d{2}-\d{2})\]/gm;
  const mdDates = new Set();
  while ((match = mdDatePattern.exec(mdContent)) !== null) {
    const d = new Date(match[1] + 'T12:00:00');
    if (d >= CHANGELOG_SYNC_IGNORE_BEFORE) {
      const formatted = `${monthNames[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
      mdDates.add(formatted);
    }
  }
  
  // Find dates in JSON but not in MD (excluding allow-listed)
  const missingFromMd = [];
  for (const date of jsonDates) {
    if (!mdDates.has(date) && !CHANGELOG_SYNC_ALLOW_LIST.has(date)) {
      missingFromMd.push(date);
    }
  }
  
  // Find dates in MD but not in JSON (excluding allow-listed)
  const missingFromJson = [];
  for (const date of mdDates) {
    if (!jsonDates.has(date) && !CHANGELOG_SYNC_ALLOW_LIST.has(date)) {
      missingFromJson.push(date);
    }
  }
  
  if (missingFromMd.length > 0) {
    warn('CHANGELOG_SYNC', `${missingFromMd.length} date(s) in changelog.json missing from CHANGELOG.md: ${missingFromMd.join(', ')}`);
  }
  if (missingFromJson.length > 0) {
    warn('CHANGELOG_SYNC', `${missingFromJson.length} date(s) in CHANGELOG.md missing from changelog.json: ${missingFromJson.join(', ')}`);
  }
  
  // Check changelog.json freshness
  const jsonDays = daysSinceModified(jsonFile);
  if (jsonDays > 5) {
    warn('CHANGELOG_SYNC', `changelog.json last modified ${Math.floor(jsonDays)}d ago (max 5d) — user-facing changelog may be stale`);
  }
}

// ─── MAIN ───────────────────────────────────────────────────────────────────

console.log('🧹 Kingshot Atlas — Consistency Lint');
console.log('━'.repeat(50));

runBannedTermsCheck();
runFreshnessCheck();
runComponentSizeCheck();
runEslintDisableCheck();
runStaleFileCheck();
runSharedComponentCheck();
runStaleInProgressCheck();
runChangelogSyncCheck();

console.log('\n' + '━'.repeat(50));
if (errors > 0) {
  console.log(`\n💥 ${errors} error(s), ${warnings} warning(s)`);
  process.exit(1);
} else if (warnings > 0) {
  console.log(`\n⚠️  ${warnings} warning(s) found`);
  if (strict) {
    console.log('   (--strict mode: exiting with code 1)');
    process.exit(1);
  }
} else {
  console.log('\n✅ No consistency issues found');
}
