---
description: Find and implement the top critical improvements for a feature, with bug checks, i18n, and safe local deployment
---

# /improve Workflow

A careful, safety-first workflow for identifying and implementing critical improvements on any feature area. Combines bug fixing, i18n sync, and local verification without breaking existing functionality.

## When to Use
- After launching a new feature that needs polish
- When the user asks for "next improvements" or "things to fix"
- Periodic feature quality audits

## Steps

### 1. Load Context (via /task)
Read the standard project context files:
- `/docs/VISION.md`, `/agents/AGENT_REGISTRY.md`
- `/agents/project-instances/kingshot-atlas/STATUS_SNAPSHOT.md`
- `/agents/project-instances/kingshot-atlas/FEATURES_IMPLEMENTED.md`

Adopt the appropriate agent identity (usually Product Engineer for UI features).

### 2. Audit the Feature
Read ALL files in the target feature directory:
- Types, constants, utilities
- Custom hooks
- Every sub-component
- The page-level shell
- Barrel exports

Look for:
- **Bugs:** Runtime errors, logic errors, missing null checks, broken conditionals
- **Missing i18n:** Hardcoded English strings not wrapped in `t()`
- **Type safety:** `any` types, unsafe casts, missing interfaces
- **UX gaps:** Missing loading/empty/error states, accessibility issues, mobile problems
- **Performance:** Unnecessary re-renders, missing memoization, memory leaks
- **Dead code:** Unused imports, unreachable branches

### 3. Implement Improvements from User Prompt
If the user provided specific improvements to implement:

**⚠️ SAFETY RULES:**
- Make minimal, focused edits — no unnecessary refactors
- Never delete or weaken existing functionality
- Preserve all existing imports, exports, and interfaces
- Test each change mentally before applying — will existing callers still work?
- If a change touches shared types or utils, check ALL consumers first

**Edit sequence:**
1. Fix the issue with the smallest possible change
2. If new i18n keys are needed, add EN keys first
3. Verify the edit doesn't break other components that import from the same module

### 4. i18n Sync (if new strings were added)
Follow the `/i18n-translate` workflow:
1. Add EN keys to `src/locales/en/translation.json`
2. Translate to all 8 languages (ES, FR, ZH, DE, KO, JA, AR, TR)
3. Sync to `public/locales/` via `npm run i18n:sync` or manual copy
4. Validate with `npm run i18n:diff` if available

### 5. Bug Check Before Build
Before running the build:
- Grep for obvious issues: `console.log` (should use logger), `alert(`, `confirm(`
- Check that all imports resolve (no typos in import paths)
- Verify no circular dependencies were introduced

### 6. Local Build Verification
// turbo
```bash
cd /Users/giovanni/projects/ai/Kingshot\ Atlas/apps/web && npm run build
```

### If build fails:
1. Read the error output carefully
2. Fix the root cause (not symptoms)
3. Re-run build
4. Document any gotchas

### If build succeeds:
- Task is complete — changes remain local (uncommitted)
- Ready for user review

### 7. Recommend Next 5 Improvements

⚠️ **THIS STEP IS MANDATORY. YOU MUST ALWAYS COMPLETE THIS STEP BEFORE ENDING THE SESSION.**
⚠️ **DO NOT SKIP THIS STEP. DO NOT END THE CONVERSATION WITHOUT OUTPUTTING THESE 5 SUGGESTIONS.**
⚠️ **If you are running low on context, output the suggestions IMMEDIATELY before anything else.**

After ALL implementation and build verification is done, you MUST present **exactly 5 recommended next improvements** for the user to evaluate. These are NOT auto-implemented — they are suggestions for the user's next prompt.

**Rules:**
- Output exactly 5 suggestions, no more, no fewer
- Each must be specific and actionable (not vague)
- Each must reference a specific file, component, or system
- Prioritize: Bugs > Accessibility > UX gaps > i18n gaps > Type safety > Performance > Polish
- These suggestions should be contextually related to the feature you just worked on

**Format each recommendation as:**
```
**[N]. [Title]** (Risk: Low/Medium/High)
- **What:** [1 sentence describing the issue or opportunity]
- **Fix:** [1 sentence describing what the fix looks like]
- **Why:** [1 sentence on user/business impact]
```

**Example:**
```
**1. Add undo support for queue reorder** (Risk: Low)
- **What:** Users can accidentally reorder the queue with no way to undo
- **Fix:** Store previous queue state and show an undo toast for 5 seconds after each reorder
- **Why:** Prevents frustration during time-sensitive rally coordination
```

### 8. DO NOT commit or deploy unless the user explicitly says "commit", "deploy", or "ship".

## Integration with /task
This workflow can be invoked as a sub-step of `/task`. When used standalone, it still follows the post-task documentation requirements from `/task` (ACTIVITY_LOG, FEATURES_IMPLEMENTED, suggestions).
