# Kingshot Atlas - Project Context for Specialists

**Last Updated:** 2026-01-27  
**Read this before starting any work on this project.**

---

## Project Overview

**Kingshot Atlas** is a web application for tracking and comparing gaming kingdoms. Users can browse kingdoms, view detailed profiles, compare multiple kingdoms side-by-side, and track battle outcomes.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript, Tailwind CSS |
| State | React hooks, local state |
| Backend | Python FastAPI |
| Database | SQLite |
| Frontend Hosting | Netlify |
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

See `/docs/STATE_PACKET.md` for latest status.

**Recent Work:**
- Refactored KingdomDirectory.tsx (1191 → 878 lines)
- Extracted components: SkeletonCard, KingdomTable, CompareTray
- Added unit tests for core utilities
- Deployed to Netlify

**Known Issues:**
- `getOutcome()` case-sensitivity test failing
- ESLint warnings in Admin.tsx, Profile.tsx

---

## Source of Truth Files

| Topic | File |
|-------|------|
| Visual styling | `/apps/web/src/STYLE_GUIDE.md` |
| Agent behavior | `/docs/AGENT_PROTOCOL.md` |
| Current state | `/docs/STATE_PACKET.md` |
| Power tiers | `/apps/web/src/types/index.ts` |

---

## Commands

```bash
# Frontend
cd apps/web
npm install
npm start          # Dev server
npm run build      # Production build
npm test           # Run tests

# Backend
cd apps/api
python -m uvicorn main:app --reload
```

---

## Deployment

- **Frontend:** Auto-deploys to Netlify from main branch
- **Site URL:** https://kingshot-atlas.netlify.app
- **Policy:** Local testing only unless user explicitly requests deployment

---

*Read the relevant STYLE_GUIDE.md and STATE_PACKET.md before making changes.*
