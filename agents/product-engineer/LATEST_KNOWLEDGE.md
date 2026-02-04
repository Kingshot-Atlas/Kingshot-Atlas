# Product Engineer — Latest Knowledge

**Last Updated:** 2026-01-29  
**Purpose:** Current best practices for React development and UX implementation

---

## React Best Practices (2026)

### Component Architecture
```typescript
// Prefer: Small, focused components with clear responsibilities
function PlayerStatsCard({ player }: { player: Player }) {
  return (
    <Card>
      <CardHeader title={player.name} />
      <CardBody>
        <StatRow label="Power" value={player.power} />
        <StatRow label="Kills" value={player.kills} />
      </CardBody>
    </Card>
  );
}

// Avoid: Monolithic components that do everything
function PlayerPage() {
  // 500 lines of mixed concerns...
}
```

### Hooks Patterns
```typescript
// Custom hooks for reusable logic
function usePlayerData(playerId: string) {
  const query = useQuery(['player', playerId], () => api.getPlayer(playerId));
  
  return {
    player: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

// Composition over configuration
function useToggle(initial = false) {
  const [value, setValue] = useState(initial);
  const toggle = useCallback(() => setValue(v => !v), []);
  const setTrue = useCallback(() => setValue(true), []);
  const setFalse = useCallback(() => setValue(false), []);
  return { value, toggle, setTrue, setFalse };
}
```

### State Management Decisions
| Scenario | Solution |
|----------|----------|
| Single component state | `useState` |
| Form state | React Hook Form |
| Server/API data | React Query |
| Global UI state (theme, sidebar) | Context or Zustand |
| Complex local state | `useReducer` |

---

## Data Fetching Patterns

### React Query Usage
```typescript
// Basic query
const { data, isLoading, error } = useQuery(
  ['players', filters],
  () => fetchPlayers(filters),
  {
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 30 * 60 * 1000, // 30 minutes
  }
);

// Mutation with optimistic update
const mutation = useMutation(updatePlayer, {
  onMutate: async (newData) => {
    await queryClient.cancelQueries(['player', newData.id]);
    const previous = queryClient.getQueryData(['player', newData.id]);
    queryClient.setQueryData(['player', newData.id], newData);
    return { previous };
  },
  onError: (err, newData, context) => {
    queryClient.setQueryData(['player', newData.id], context.previous);
  },
  onSettled: () => {
    queryClient.invalidateQueries(['player']);
  },
});
```

### Loading States
```typescript
// Always show meaningful loading states
function PlayerList() {
  const { data, isLoading } = usePlayerData();

  if (isLoading) {
    return <PlayerListSkeleton count={5} />;
  }

  if (!data?.length) {
    return <EmptyState message="No players found" />;
  }

  return (
    <ul>
      {data.map(player => (
        <PlayerListItem key={player.id} player={player} />
      ))}
    </ul>
  );
}
```

---

## Error Handling

### Error Boundaries
```typescript
// Wrap feature sections in error boundaries
function App() {
  return (
    <Layout>
      <ErrorBoundary fallback={<PlayersSectionError />}>
        <PlayersSection />
      </ErrorBoundary>
      <ErrorBoundary fallback={<EventsSectionError />}>
        <EventsSection />
      </ErrorBoundary>
    </Layout>
  );
}
```

### API Error Handling
```typescript
// Typed error responses
interface ApiError {
  message: string;
  code: string;
  details?: Record<string, string>;
}

function useApiError(error: unknown): ApiError | null {
  if (!error) return null;
  if (error instanceof ApiError) return error;
  return { message: 'An unexpected error occurred', code: 'UNKNOWN' };
}
```

---

## TypeScript Patterns

### Component Props
```typescript
// Explicit, documented props
interface ButtonProps {
  /** Button label text */
  children: React.ReactNode;
  /** Click handler */
  onClick?: () => void;
  /** Visual variant */
  variant?: 'primary' | 'secondary' | 'danger';
  /** Disabled state */
  disabled?: boolean;
  /** Loading state - shows spinner and disables */
  loading?: boolean;
}
```

### Discriminated Unions for State
```typescript
// Better than separate isLoading, error, data
type AsyncState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; error: Error }
  | { status: 'success'; data: T };
```

---

## Kingshot Atlas Specifics

### Project Structure
```
/apps/web/src/
├── components/     # Reusable UI components
├── pages/          # Page-level components
├── hooks/          # Custom React hooks
├── utils/          # Utility functions
├── data/           # Data types, schemas, mocks
├── contexts/       # React contexts
└── styles/         # Global styles (Design Lead owns)
```

### Key Data Types
```typescript
// Player data structure
interface Player {
  id: string;
  name: string;
  kingdom: number;
  power: number;
  killPoints: number;
  deaths: number;
  alliance?: string;
}

// Event data structure
interface GameEvent {
  id: string;
  name: string;
  type: 'kvk' | 'transfer' | 'other';
  startDate: Date;
  endDate: Date;
  phases?: EventPhase[];
}
```

### Component Conventions
- Use function components (no classes)
- Props interfaces named `[Component]Props`
- Export components as named exports
- One component per file (with rare exceptions for tightly coupled components)

---

## Accessibility Basics

### Keyboard Navigation
- All interactive elements focusable
- Logical tab order
- Visible focus indicators
- Escape closes modals/dropdowns

### Screen Readers
- Semantic HTML (button, nav, main, etc.)
- ARIA labels where needed
- Alt text for meaningful images
- Announce dynamic changes

### Quick Wins
```typescript
// ✅ Good: Semantic, accessible
<button onClick={handleClick}>Save Player</button>

// ❌ Bad: Div pretending to be button
<div onClick={handleClick}>Save Player</div>

// ✅ Good: Label associated with input
<label htmlFor="player-name">Name</label>
<input id="player-name" type="text" />

// ❌ Bad: No label association
<span>Name</span>
<input type="text" />
```

---

## Performance Patterns

### Memoization
```typescript
// Memoize expensive computations
const sortedPlayers = useMemo(
  () => players.sort((a, b) => b.power - a.power),
  [players]
);

// Memoize callbacks passed to children
const handleSelect = useCallback(
  (id: string) => setSelectedId(id),
  []
);

// Memoize components that receive stable props
const PlayerCard = memo(function PlayerCard({ player }: Props) {
  return <div>...</div>;
});
```

### Code Splitting
```typescript
// Lazy load heavy components
const HeavyChart = lazy(() => import('./HeavyChart'));

function Dashboard() {
  return (
    <Suspense fallback={<ChartSkeleton />}>
      <HeavyChart data={data} />
    </Suspense>
  );
}
```

---

## Testing Approach

### Component Tests
```typescript
// Test user behavior, not implementation
test('shows player stats when loaded', async () => {
  render(<PlayerCard playerId="123" />);
  
  // Wait for data
  await screen.findByText('John Doe');
  
  // Verify display
  expect(screen.getByText('Power: 50,000,000')).toBeInTheDocument();
  expect(screen.getByText('Kills: 1,234,567')).toBeInTheDocument();
});

test('shows error state on API failure', async () => {
  server.use(
    rest.get('/api/player/:id', (req, res, ctx) => {
      return res(ctx.status(500));
    })
  );
  
  render(<PlayerCard playerId="123" />);
  
  await screen.findByText(/failed to load/i);
});
```

---

## Code Quality Standards (Kingshot Atlas)

### Type Safety
- **Avoid `as any`** — Use proper type assertions or generics
- **Use `keyof` for dynamic property access** — `kingdom[field as keyof Kingdom]`
- **Prefer union types** — `'king' | 'r4' | 'r5'` over `any`

### Common Patterns
```typescript
// ✅ Good: Typed getValue function
{ getValue: (k: Kingdom) => k.overall_score, format: (v: number) => v.toFixed(1) }

// ❌ Bad: Using 'as any' for dynamic access
{ valueKey: 'overall_score', format: (v: number) => (k as any)[valueKey] }

// ✅ Good: Proper select handler typing
onChange={(e) => setFilterBy(e.target.value as 'all' | 'alliance' | 'region')}

// ❌ Bad: Casting to any
onChange={(e) => setFilterBy(e.target.value as any)}
```

### Import Shared Utilities
Always import from shared utilities instead of duplicating:
```typescript
// ✅ Good: Import from utils
import { neonGlow, colors, tooltipStyles } from '../utils/styles';

// ❌ Bad: Duplicate function in component
const neonGlow = (color: string) => ({ ... });
```

### Dead Code Removal
- Remove unused imports, variables, and functions
- Remove eslint-disable comments when the underlying issue is fixed
- Clean up deprecated code paths

---

## New Infrastructure (2026-01-29)

### React Query
The app now uses `@tanstack/react-query` for data fetching:
```typescript
import { useKingdoms, useKingdomProfile, useLeaderboard } from '../hooks/useKingdoms';

// Usage
const { data: kingdoms, isLoading, error } = useKingdoms(filters, sort);
const { data: profile } = useKingdomProfile(kingdomNumber);
```

Query keys are centralized in `kingdomKeys` for consistent cache management.

### Zod Schemas
Validation schemas are in `/src/schemas/index.ts`:
- `KingdomSchema`, `KingdomProfileSchema` - Data validation
- `ProfileEditSchema`, `StatusSubmissionSchema` - Form validation
- `FilterOptionsSchema`, `SortOptionsSchema` - Filter validation

### Keyboard Shortcuts
Global shortcuts via `useKeyboardShortcuts` hook:
- `?` - Show help modal
- `/` - Focus search
- `g h` - Go home
- `g l` - Go to leaderboards
- `g p` - Go to profile
- Arrow keys - Navigate cards

### Testing
- Unit tests: `/src/utils/kingdomStats.test.ts` (20 tests)
- E2E tests: `/e2e/keyboard-shortcuts.spec.ts`

### Performance Optimizations (2026-01-29)

#### Debounced Resize Handlers
All media query hooks now use debounced resize handlers to prevent excessive re-renders:
```typescript
// In useMediaQuery.ts - useDebouncedCallback helper
const useDebouncedCallback = (callback: () => void, delay: number): (() => void) => {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbackRef = useRef(callback);
  
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);
  
  return useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => callbackRef.current(), delay);
  }, [delay]);
};

// Usage in hooks
const handleResize = useDebouncedCallback(() => {
  setIsMobile(window.innerWidth < BREAKPOINTS.mobile);
}, 100);
```

This prevents layout thrashing during window resize events.

#### React.memo for List Items
`KingdomCard` is now wrapped with `React.memo` to prevent unnecessary re-renders when parent components update:
```typescript
export default memo(KingdomCard);
```

### Shared Components (2026-01-29)

New reusable components in `/src/components/shared/`:

| Component | Purpose | Usage |
|-----------|---------|-------|
| `Tooltip` | Consistent tooltip behavior (hover on desktop, tap on mobile) | `<Tooltip content={<>...</>}>{children}</Tooltip>` |
| `TierBadge` | Power tier display with S-tier animation | `<TierBadge tier="S" />` |
| `WinRateBar` | Win rate progress bar with streak display | `<WinRateBar winRate={0.75} wins={6} losses={2} ... />` |
| `StatBox` | Stat display box with optional tooltip | `<StatBox value={5} label="KvKs" tooltip={{...}} />` |

Import from: `import { Tooltip, TierBadge, WinRateBar, StatBox } from '../components/shared';`

### Bundle Analysis

`source-map-explorer` is now available for bundle analysis:
```bash
# Generate bundle with source maps
GENERATE_SOURCEMAP=true npm run build

# Analyze bundle
npx source-map-explorer 'build/static/js/main.*.js'
```

### API Fallback Pattern (2026-01-30)

**Critical:** When API returns 404, always check local data fallback before returning null:

```typescript
// ✅ CORRECT: Check local data on 404
if (response.status === 404) {
  const localData = localKingdoms.find(k => k.kingdom_number === id);
  if (localData) {
    logger.log(`Using local data for kingdom ${id}`);
    return toProfile(localData);
  }
  return null; // Only null if truly not found anywhere
}

// ❌ WRONG: Immediately returning null on 404
if (response.status === 404) return null;
```

This pattern ensures kingdom profiles work even when API database is out of sync with local `kingdoms.json` data.

---

## Service Worker + OAuth Gotcha (2026-01-31)

**Problem:** Cached service workers from production builds interfere with OAuth redirects in development, causing:
```
FetchEvent resulted in a network error response: a redirected response was used for a request whose redirect mode is not "follow"
```

**Root Cause:** Workbox service worker precaches routes and handles fetch events with `redirect: 'manual'`, which breaks Supabase OAuth callbacks that include hash fragments (`#access_token=...`).

**Solution:** Automatically unregister service workers in development mode:
```typescript
// main.tsx
if (import.meta.env.DEV && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    registrations.forEach(registration => {
      registration.unregister();
      console.log('[DEV] Service worker unregistered');
    });
  });
}
```

**Quick Fix for Users:** Run in DevTools Console:
```javascript
navigator.serviceWorker.getRegistrations().then(r => r.forEach(reg => reg.unregister()));
location.reload();
```

---

## Subscription Tier Sync Issue (2026-01-31)

**Problem:** User has active Stripe subscription but `subscription_tier` in database shows `free`.

**Root Cause:** Stripe webhooks may fail silently or the initial subscription creation didn't properly update the `profiles` table.

**Manual Fix:**
```sql
-- Check current tier
SELECT id, username, subscription_tier FROM profiles WHERE username = 'USERNAME';

-- Update to correct tier based on Stripe subscription
UPDATE profiles SET subscription_tier = 'pro' WHERE id = 'USER_ID';
```

**Prevention:** Ensure webhook handler at `/api/webhooks/stripe` properly updates `subscription_tier` on:
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

**TC Level to TG Tier Mapping (Source of Truth):**
| Level Range | Display |
|-------------|---------|
| 1-30 | TC 1-30 |
| 31-34 | TC 30 |
| 35-39 | TG1 |
| 40-44 | TG2 |
| 45-49 | TG3 |
| 50-54 | TG4 |
| 55-59 | TG5 |
| 60+ | TG6+ |

Formula: `tgTier = Math.floor((level - 35) / 5) + 1`

---

## User Display Pattern (2026-02-04)

**Rule:** Wherever user profiles are displayed, prioritize Kingshot account data over OAuth provider data.

### Data Priority
```typescript
// Avatar: Use linked Kingshot avatar, fallback to OAuth avatar
const displayAvatar = profile.linked_avatar_url || profile.avatar_url;

// Username: Use linked Kingshot username, fallback to OAuth username
const displayName = profile.linked_username || profile.username || 'Anonymous';
```

### Tier-Based Styling
```typescript
import { getDisplayTier, SUBSCRIPTION_COLORS, SubscriptionTier } from '../utils/constants';
import { neonGlow } from '../utils/styles';

// Determine display tier (handles admin detection via ADMIN_USERNAMES)
const displayTier = getDisplayTier(profile.subscription_tier, profile.linked_username || profile.username);

// Get username color based on tier
const getUsernameColor = (tier: SubscriptionTier): string => {
  switch (tier) {
    case 'admin': return SUBSCRIPTION_COLORS.admin;     // #f59e0b (Gold)
    case 'recruiter': return SUBSCRIPTION_COLORS.recruiter; // #a855f7 (Purple)
    case 'pro': return SUBSCRIPTION_COLORS.pro;         // #FF6B8A (Pink)
    default: return '#ffffff';                          // White for free
  }
};

// Apply neon glow for paid tiers and admins
const isPaidOrAdmin = displayTier === 'pro' || displayTier === 'recruiter' || displayTier === 'admin';
const usernameStyle = {
  color: getUsernameColor(displayTier),
  ...(isPaidOrAdmin ? neonGlow(getUsernameColor(displayTier)) : {})
};
```

### Tier Badges
```typescript
// Render appropriate badge based on displayTier
{displayTier === 'admin' && (
  <span style={{
    fontSize: '0.6rem',
    padding: '0.1rem 0.3rem',
    backgroundColor: `${SUBSCRIPTION_COLORS.admin}15`,
    border: `1px solid ${SUBSCRIPTION_COLORS.admin}40`,
    borderRadius: '3px',
    color: SUBSCRIPTION_COLORS.admin,
    fontWeight: '600',
  }}>ADMIN</span>
)}
// Similar for 'pro' (SUPPORTER) and 'recruiter' (RECRUITER)
```

### Components Using This Pattern
| Component | Status |
|-----------|--------|
| `UserDirectory.tsx` | ✅ Correct |
| `Header.tsx` | ✅ Correct |
| `Profile.tsx` | ✅ Correct |
| `PlayersFromMyKingdom.tsx` | ✅ Fixed 2026-02-04 |
| `KingdomPlayers.tsx` | ✅ Fixed 2026-02-04 |

### Avatar Image Best Practice
```typescript
// Always add referrerPolicy for external avatar URLs (Akamai CDN compatibility)
<img 
  src={displayAvatar} 
  alt={displayName}
  referrerPolicy="no-referrer"
  onError={(e) => {
    (e.target as HTMLImageElement).style.display = 'none';
  }}
/>
```

---

*Updated by Product Engineer based on current React best practices.*
