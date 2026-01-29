# Kingshot Atlas - Project Context for Specialists

**Last Updated:** 2026-01-28  
**Read this before starting any work on this project.**

---

## ⚠️ BEFORE YOU START

1. **Read** `STATUS_SNAPSHOT.md` - Current project state
2. **Check** `FILE_CLAIMS.md` - Ensure no conflicts
3. **Scan** `ACTIVITY_LOG.md` - See recent changes

All files are in this directory: `/agents/project-instances/kingshot-atlas/`

---

## Project Overview

**Kingshot Atlas** is a web application for tracking and comparing gaming kingdoms. Users can browse kingdoms, view detailed profiles, compare multiple kingdoms side-by-side, and track battle outcomes.

**Live URL:** https://ks-atlas.com

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, TypeScript, Tailwind CSS |
| State | React hooks, local state |
| Backend | Python FastAPI |
| Database | SQLite (PostgreSQL-ready) |
| Frontend Hosting | Netlify (ks-atlas.com) |
| Backend Hosting | Railway/Render |

---

## Project Structure

```
/Kingshot Atlas/
├── apps/
│   ├── web/               # React frontend
│   │   ├── src/
│   │   │   ├── components/   # Reusable components
│   │   │   ├── pages/        # Page components
│   │   │   ├── types/        # TypeScript types
│   │   │   ├── utils/        # Utility functions
│   │   │   └── STYLE_GUIDE.md
│   │   └── public/
│   └── api/               # FastAPI backend
│       └── database.py
├── docs/                  # Project documentation
│   ├── AGENT_PROTOCOL.md
│   ├── STATE_PACKET.md
│   └── ...
├── agents/                # Agent system (this directory)
└── data/                  # Data files
```

---

## Key Design Decisions

### Visual Style
- Dark theme: Background `#0a0a0a`, surfaces `#1a1a1a`
- Card borders: `#2a2a2a`, hover with accent at 50% opacity
- Accent color: Cyan `#22d3ee`
- Neon glow effects on scores

### Components
- `KingdomCard` - Grid view card for kingdoms
- `KingdomTable` - Table view for kingdoms
- `CompareTray` - Floating widget for comparison selection
- `FilterPanel` - Filtering controls (created, not integrated)

### Data Patterns
- Power tiers: S (≥12), A (≥8), B (≥5), C (<5)
- Outcomes: Victory, Defeat, Draw
- `getPowerTier()` centralized in `types/index.ts`

---

## Current State

See `STATUS_SNAPSHOT.md` in this directory for real-time status.

**Recent Work:**
- Established coordination system (2026-01-28)
- Refactored KingdomDirectory.tsx (1191 → 878 lines)
- Extracted components: SkeletonCard, KingdomTable, CompareTray
- Added unit tests for core utilities
- Deployed to Netlify with custom domain

**Known Issues:**
- `getOutcome()` case-sensitivity test failing
- ESLint warnings in Admin.tsx, Profile.tsx
- FilterPanel created but not integrated

---

## Source of Truth Files

| Topic | File |
|-------|------|
| **Current status** | `STATUS_SNAPSHOT.md` (this directory) |
| **Activity log** | `ACTIVITY_LOG.md` (this directory) |
| **File claims** | `FILE_CLAIMS.md` (this directory) |
| Visual styling | `/apps/web/src/STYLE_GUIDE.md` |
| Agent behavior | `/docs/AGENT_PROTOCOL.md` |
| State packet | `/docs/STATE_PACKET.md` |
| Power tiers | `/apps/web/src/types/index.ts` |

---

## Commands

```bash
# Frontend
cd apps/web
npm install
npm start          # Dev server (http://localhost:3000)
npm run build      # Production build
npm test           # Run tests

# Backend
cd apps/api
python -m uvicorn main:app --reload  # http://127.0.0.1:8000
```

---

## Deployment

- **Frontend:** Netlify with custom domain
- **Live URL:** https://ks-atlas.com
- **Netlify URL:** https://ks-atlas.netlify.app
- **Policy:** Local testing only unless user explicitly requests deployment

---

## Coordination Checklist

Before starting work:
- [ ] Read `STATUS_SNAPSHOT.md`
- [ ] Check `FILE_CLAIMS.md`
- [ ] Scan `ACTIVITY_LOG.md`

After completing work:
- [ ] Release claims in `FILE_CLAIMS.md`
- [ ] Log completion in `ACTIVITY_LOG.md`
- [ ] Update `STATUS_SNAPSHOT.md`
- [ ] Update your worklog in `worklogs/[your-agent].md`

---

*Read STATUS_SNAPSHOT.md and STYLE_GUIDE.md before making changes.*
