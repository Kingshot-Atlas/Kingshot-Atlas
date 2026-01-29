# Specialist Handoff Template - Kingshot Atlas

**Project:** Kingshot Atlas  
**Path:** `/Users/giovanni/projects/ai/Kingshot Atlas`  
**Template Version:** 2.0

---

## How to Use This Template

When the Manager needs specialist help:
1. Copy this template
2. Fill in the task-specific sections
3. Save as `HANDOFF_[SPECIALIST]_[DATE].md`
4. Direct specialist to read files in this order:
   - `STATUS_SNAPSHOT.md` (current project state)
   - `FILE_CLAIMS.md` (check for conflicts)
   - Their `SPECIALIST.md` and `LATEST_KNOWLEDGE.md`
   - This handoff document

---

# Handoff: [SPECIALIST NAME]

**Date:** [YYYY-MM-DD]  
**Manager Session:** [Cascade session identifier if known]  
**Priority:** [High/Medium/Low]

---

## ⚠️ Before You Start

1. **Read** `STATUS_SNAPSHOT.md` - Current project state
2. **Check** `FILE_CLAIMS.md` - Ensure no conflicts
3. **Claim** your files before editing
4. **Log** start in `ACTIVITY_LOG.md`

---

## Project Context

**Kingshot Atlas** is a web application for tracking and comparing gaming kingdoms.

**Live URL:** https://ks-atlas.com

**Tech Stack:**
- Frontend: React 19, TypeScript, Tailwind CSS
- Backend: Python FastAPI
- Database: SQLite (PostgreSQL-ready)
- Hosting: Netlify (frontend), Railway/Render (backend)

**Key Files:**
- Status: `STATUS_SNAPSHOT.md` (this directory)
- Style Guide: `/apps/web/src/STYLE_GUIDE.md`
- Agent Protocol: `/docs/AGENT_PROTOCOL.md`

---

## Task Description

[Clear description of what needs to be done]

---

## Goals

- [ ] Goal 1
- [ ] Goal 2
- [ ] Goal 3

---

## Constraints

- Follow existing style guide
- No breaking changes to API contracts
- [Add task-specific constraints]

---

## Relevant Files

| File | Purpose |
|------|---------|
| `/path/to/file` | Description |

---

## Dependencies

**Blocks:** [None / List agents waiting on this work]  
**Blocked By:** [None / List what this work depends on]  
**Notify On Completion:** [Agents to alert when done]

---

## Success Criteria

- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Tests pass
- [ ] Build succeeds

---

## Files to Claim

| File | Purpose |
|------|---------|
| `/path/to/file` | Description |

---

## Return Instructions

When complete:
1. **Release** claims in `FILE_CLAIMS.md`
2. **Log** completion in `ACTIVITY_LOG.md`
3. **Update** `STATUS_SNAPSHOT.md` if significant changes
4. **Update** your worklog in `worklogs/[your-agent].md`

Provide:
- Summary of changes made
- List of files modified
- Key decisions and rationale
- Any follow-up recommendations

---

## Notes from Manager

[Any additional context, warnings, or guidance]

---

*Template version 2.0*
