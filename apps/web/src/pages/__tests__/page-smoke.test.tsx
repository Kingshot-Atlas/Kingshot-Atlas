/**
 * Page-level smoke tests — verify key pages render without crashing.
 * These tests mock all heavy dependencies to keep them fast and isolated.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// Mock localStorage (pages use it at render time)
const localStorageMock = {
  getItem: vi.fn().mockReturnValue(null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
};
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });

// ─── Global mocks ─────────────────────────────────────────────────────────────

// i18n
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));

// Supabase
vi.mock('../../lib/supabase', () => ({
  supabase: null,
  isSupabaseConfigured: false,
}));

// Logger
vi.mock('../../utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), log: vi.fn(), debug: vi.fn() },
}));

// Analytics
vi.mock('../../hooks/useAnalytics', () => ({
  useAnalytics: () => ({ trackButton: vi.fn(), trackPage: vi.fn(), trackEvent: vi.fn(), trackFeature: vi.fn() }),
}));

// Scroll depth
vi.mock('../../hooks/useScrollDepth', () => ({
  useScrollDepth: vi.fn(),
}));

// Media query
vi.mock('../../hooks/useMediaQuery', () => ({
  useIsMobile: () => false,
}));

// Document title
vi.mock('../../hooks/useDocumentTitle', () => ({
  useDocumentTitle: vi.fn(),
}));

// Meta tags
vi.mock('../../hooks/useMetaTags', () => ({
  useMetaTags: vi.fn(),
  PAGE_META_TAGS: {},
  getKingdomMetaTags: vi.fn(),
}));

// Structured data
vi.mock('../../hooks/useStructuredData', () => ({
  useStructuredData: vi.fn(),
  PAGE_BREADCRUMBS: {},
  RANKINGS_FAQ_DATA: [],
  TRANSFER_HUB_FAQ_DATA: [],
  getKingdomBreadcrumbs: vi.fn(),
}));

// Styles
vi.mock('../../utils/styles', () => ({
  neonGlow: () => ({}),
  FONT_DISPLAY: "'Inter', sans-serif",
  statTypeStyles: {
    atlasScore: { color: '#22d3ee', emoji: '💎', label: 'Atlas Score' },
    prepPhase: { color: '#eab308', emoji: '🛡️', label: 'Prep Phase' },
    battlePhase: { color: '#f97316', emoji: '⚔️', label: 'Battle Phase' },
    domination: { color: '#22c55e', emoji: '👑', label: 'Domination' },
    comeback: { color: '#3b82f6', emoji: '💪', label: 'Comeback' },
    reversal: { color: '#a855f7', emoji: '🔄', label: 'Reversal' },
    invasion: { color: '#ef4444', emoji: '💀', label: 'Invasion' },
  },
  colors: {},
}));

// Auth context
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    profile: null,
    loading: false,
    signInWithGoogle: vi.fn(),
    signInWithDiscord: vi.fn(),
    signOut: vi.fn(),
  }),
}));

// Premium context
vi.mock('../../contexts/PremiumContext', () => ({
  usePremium: () => ({
    tier: 'anonymous',
    isSupporter: false,
    isAdmin: false,
    featureLimits: {},
  }),
}));

// API service — provide the dataLoadError export and minimal apiService
vi.mock('../../services/api', () => ({
  apiService: {
    getKingdoms: vi.fn().mockResolvedValue([]),
    getKingdomProfile: vi.fn().mockResolvedValue(null),
    reloadData: vi.fn(),
  },
  dataLoadError: null,
  supabaseDataLoaded: true,
  supabaseKingdomsLoaded: true,
}));

// Breadcrumbs
vi.mock('../../components/Breadcrumbs', () => ({
  default: () => React.createElement('nav', { 'data-testid': 'breadcrumbs' }),
}));

// Toast
vi.mock('../../components/Toast', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

// Skeleton components
vi.mock('../../components/Skeleton', () => ({
  LeaderboardSkeleton: () => React.createElement('div', null, 'Loading...'),
  KingdomProfileSkeleton: () => React.createElement('div', null, 'Loading...'),
}));

// DataLoadError
vi.mock('../../components/DataLoadError', () => ({
  DataLoadError: ({ message }: { message: string }) => React.createElement('div', null, message),
}));

// User achievements
vi.mock('../../components/UserAchievements', () => ({
  incrementStat: vi.fn(),
}));

// ─── Test wrapper ─────────────────────────────────────────────────────────────

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(
      QueryClientProvider,
      { client: queryClient },
      React.createElement(MemoryRouter, null, children)
    );
  Wrapper.displayName = 'TestWrapper';
  return Wrapper;
}

// ============================================================================
// LEADERBOARDS (Rankings) — the simplest of the three to smoke test
// ============================================================================

// Additional mocks for Leaderboards
vi.mock('../../services/scoreHistoryService', () => ({
  scoreHistoryService: {
    getRankMovers: vi.fn().mockResolvedValue([]),
  },
  RankMover: {},
}));

vi.mock('../../config/transferGroups', () => ({
  getTransferGroupOptions: () => [],
  getTransferGroupLabel: () => '',
  parseTransferGroupValue: () => null,
}));

describe('Leaderboards page — smoke test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('imports without crashing', async () => {
    const mod = await import('../Leaderboards');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });

  it('renders loading state initially', async () => {
    const { default: Leaderboards } = await import('../Leaderboards');
    const Wrapper = createWrapper();
    render(React.createElement(Leaderboards), { wrapper: Wrapper });
    // Should render something (either loading skeleton or content)
    expect(document.body.innerHTML.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// KINGDOM PROFILE — route param dependent
// ============================================================================

// Extra mocks for KingdomProfile
vi.mock('../../services/statusService', () => ({
  statusService: {
    getSubmissionHistory: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../../services/analyticsService', () => ({
  analyticsService: {
    trackKingdomView: vi.fn(),
  },
}));

vi.mock('../../utils/constants', () => ({
  isAdminUsername: () => false,
}));

vi.mock('../../hooks/useKingdomProfileQueries', () => ({
  useKingdomFund: () => ({ data: null, isLoading: false }),
  useFundTransactions: () => ({ data: [], isLoading: false }),
  useKingdomPendingSubmissions: () => ({ data: [], isLoading: false }),
  useKingdomEditor: () => ({ data: null, isLoading: false }),
  useKingdomAggregateRating: () => ({ data: null, isLoading: false }),
  kingdomProfileKeys: { fund: () => ['fund'], transactions: () => ['txn'] },
}));

vi.mock('../../components/StatusSubmission', () => ({
  default: () => null,
}));

vi.mock('../../components/ReportDataModal', () => ({
  default: () => null,
}));

vi.mock('../../components/ReportKvKErrorModal', () => ({
  default: () => null,
}));

vi.mock('../../components/kingdom-profile', () => ({
  KingdomHeader: () => React.createElement('div', null, 'Header'),
  QuickStats: () => React.createElement('div', null, 'Stats'),
  PhaseCards: () => React.createElement('div', null, 'Phases'),
  KvKHistoryTable: () => React.createElement('div', null, 'History'),
  LoginGatedSection: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
}));

describe('KingdomProfile page — smoke test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('imports without crashing', async () => {
    const mod = await import('../KingdomProfile');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });
});

// ============================================================================
// TRANSFER BOARD — heavily mocked
// ============================================================================

vi.mock('../../components/TransferApplications', () => ({
  ApplyModal: () => null,
  MyApplicationsTracker: () => null,
}));

vi.mock('../../components/EditorClaiming', () => ({
  default: () => null,
}));

vi.mock('../../components/TransferHubGuide', () => ({
  default: () => null,
}));

vi.mock('../../components/transfer/EntryModal', () => ({
  default: () => null,
}));

vi.mock('../../components/transfer/ModeToggle', () => ({
  default: () => null,
}));

vi.mock('../../components/transfer/FilterPanel', () => ({
  default: () => null,
  defaultFilters: {
    tier: 'all',
    language: 'all',
    minScore: '',
    maxScore: '',
    isRecruiting: false,
    tag: 'all',
    minMatchScore: '',
    sortBy: 'tier',
    eventTime: 'all',
  },
}));

vi.mock('../../components/transfer/EndorsementOverlay', () => ({
  default: () => null,
}));

vi.mock('../../components/transfer/TransferProfileCTA', () => ({
  default: () => null,
}));

vi.mock('../../components/transfer/ContributionSuccessModal', () => ({
  default: () => null,
}));

vi.mock('../../components/transfer/TransferAuthGate', () => ({
  default: () => null,
}));

vi.mock('../../components/transfer/TransferHubErrorFallback', () => ({
  default: () => null,
}));

vi.mock('../../components/ErrorBoundary', () => ({
  default: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
}));

vi.mock('../../utils/matchScore', () => ({
  calculateMatchScore: () => ({ score: 0, details: [] }),
  calculateMatchScoreForSort: () => 0,
}));

vi.mock('../../hooks/useTransferHubQueries', () => ({
  useTransferKingdoms: () => ({ data: [], isLoading: false }),
  useTransferFunds: () => ({ data: [], isLoading: false }),
  useTransferReviewSummaries: () => ({ data: [], isLoading: false }),
  useUserTransferProfile: () => ({ data: null, isLoading: false }),
  useActiveAppCount: () => ({ data: 0, isLoading: false }),
  useEditorStatus: () => ({ data: [], isLoading: false }),
  useAtlasPlayerCount: () => ({ data: 0, isLoading: false }),
  useInvalidateTransferHub: () => vi.fn(),
  useTransferGroups: () => ({ data: [], isLoading: false }),
}));

describe('TransferBoard page — smoke test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('imports without crashing', async () => {
    const mod = await import('../TransferBoard');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });

  it('renders without crashing', async () => {
    const { default: TransferBoard } = await import('../TransferBoard');
    const Wrapper = createWrapper();
    render(React.createElement(TransferBoard), { wrapper: Wrapper });
    expect(document.body.innerHTML.length).toBeGreaterThan(0);
  });
});
