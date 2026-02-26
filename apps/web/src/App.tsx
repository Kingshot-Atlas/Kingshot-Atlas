import React, { Suspense, lazy } from 'react';
import * as Sentry from '@sentry/react';
import { BrowserRouter as Router, Routes, Route, useLocation, Link } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import Header from './components/Header';
import ErrorBoundary from './components/ErrorBoundary';
import RouteErrorBoundary from './components/RouteErrorBoundary';
import { ToastProvider } from './components/Toast';
import KeyboardShortcutsModal from './components/KeyboardShortcutsModal';
import FeedbackWidget from './components/FeedbackWidget';
import SignupNudgeBar from './components/SignupNudgeBar';
import SiteFooter from './components/SiteFooter';
import KvKPhaseBanner from './components/KvKPhaseBanner';
import CampaignSettlersBanner from './components/CampaignSettlersBanner';
import { useKeyboardShortcuts, useKeyboardHelp } from './hooks/useKeyboardShortcuts';
import { usePageTracking } from './hooks/useAnalytics';
// REMOVED: useKingdomsRealtime was causing resource exhaustion on Supabase Nano instance
// Every visitor opened 2 realtime channels (kingdoms + kvk_history) draining CPU/IO
// Kingdom data changes rarely — React Query caching with refetchOnWindowFocus is sufficient
import { useTranslation } from 'react-i18next';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { PremiumProvider } from './contexts/PremiumContext';
import { AccessibilityProvider } from './contexts/AccessibilityContext';
import { FavoritesProvider } from './contexts/FavoritesContext';
import './App.css';

// Lazy load pages for code splitting
const KingdomDirectory = lazy(() => import('./pages/KingdomDirectory'));
const KingdomProfile = lazy(() => import('./pages/KingdomProfile'));
const CompareKingdoms = lazy(() => import('./pages/CompareKingdoms'));
const Tools = lazy(() => import('./pages/Tools'));
const Leaderboards = lazy(() => import('./pages/Leaderboards'));
const Profile = lazy(() => import('./pages/Profile'));
const About = lazy(() => import('./pages/About'));
const UserDirectory = lazy(() => import('./pages/UserDirectory'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const SupportAtlas = lazy(() => import('./pages/SupportAtlas'));
const Changelog = lazy(() => import('./pages/Changelog'));
const MissingDataRegistry = lazy(() => import('./pages/MissingDataRegistry'));
const DiscordCallback = lazy(() => import('./pages/DiscordCallback'));
const KvKSeasons = lazy(() => import('./pages/KvKSeasons'));
const TransferBoard = lazy(() => import('./pages/TransferBoard'));
const AtlasBot = lazy(() => import('./pages/AtlasBot'));
const Ambassadors = lazy(() => import('./pages/Ambassadors'));
const RallyCoordinator = lazy(() => import('./pages/RallyCoordinator'));
const BattlePlannerLanding = lazy(() => import('./pages/BattlePlannerLanding'));
const GiftCodes = lazy(() => import('./pages/GiftCodes'));
const TransferHubLanding = lazy(() => import('./pages/TransferHubLanding'));
const AuthCallback = lazy(() => import('./pages/AuthCallback'));
const CancelSurvey = lazy(() => import('./pages/CancelSurvey'));
const Messages = lazy(() => import('./pages/Messages'));
const KingdomCommunities = lazy(() => import('./pages/KingdomCommunities'));
const PrepScheduler = lazy(() => import('./pages/PrepScheduler'));
const PrepSchedulerLanding = lazy(() => import('./pages/PrepSchedulerLanding'));
const BotDashboard = lazy(() => import('./pages/BotDashboard'));
const TermsOfService = lazy(() => import('./pages/TermsOfService'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const AllianceBaseDesigner = lazy(() => import('./pages/AllianceBaseDesigner'));
const BaseDesignerLanding = lazy(() => import('./pages/BaseDesignerLanding'));
const SharedBaseDesigner = lazy(() => import('./pages/SharedBaseDesigner'));
const KingdomSettlers = lazy(() => import('./pages/KingdomSettlers'));
const AdminCampaignDraw = lazy(() => import('./pages/AdminCampaignDraw'));

// 404 Not Found component
const NotFound = () => {
  const { t } = useTranslation();
  return (
    <div style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '2rem' }}>
      <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🔍</div>
      <h1 style={{ fontSize: '2rem', fontWeight: 700, color: '#fff', marginBottom: '0.5rem' }}>404</h1>
      <p style={{ color: '#6b7280', marginBottom: '1.5rem', maxWidth: '400px' }}>
        {t('errors.pageNotFound', 'This page doesn\'t exist. It may have been moved or removed.')}
      </p>
      <Link to="/" style={{ padding: '0.75rem 1.5rem', backgroundColor: '#22d3ee', color: '#000', borderRadius: '8px', fontWeight: 600, textDecoration: 'none' }}>
        {t('common.backToHome', 'Back to Home')}
      </Link>
    </div>
  );
};

// Loading fallback component
const PageLoader = () => (
  <div style={{ 
    display: 'flex', 
    justifyContent: 'center', 
    alignItems: 'center', 
    minHeight: '200px',
    color: '#6b7280' 
  }}>
    Loading...
  </div>
);

// Page transition wrapper
const PageTransition: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  return (
    <div key={location.pathname} className="page-transition">
      {children}
      <style>{`
        .page-transition {
          animation: pageIn 0.3s ease-out;
        }
        @keyframes pageIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

function AppContent() {
  const { showHelp, openHelp, closeHelp } = useKeyboardHelp();
  useKeyboardShortcuts({ onShowHelp: openHelp });
  usePageTracking(); // Track page views for analytics
  
  // Realtime subscriptions REMOVED (2026-02-25 incident)
  // Kingdom data changes rarely — React Query handles caching + refetch on window focus

  return (
    <div className="min-h-screen bg-bg">
      <Header />
      <CampaignSettlersBanner />
      <KvKPhaseBanner />
      <KeyboardShortcutsModal isOpen={showHelp} onClose={closeHelp} />
      <main className="container mx-auto px-4 py-8">
        <PageTransition>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<ErrorBoundary><KingdomDirectory /></ErrorBoundary>} />
              <Route path="/kingdom/:kingdomNumber" element={<RouteErrorBoundary><KingdomProfile /></RouteErrorBoundary>} />
              <Route path="/kingdom/:kingdomNumber/fund" element={<RouteErrorBoundary><KingdomProfile /></RouteErrorBoundary>} />
              <Route path="/compare" element={<ErrorBoundary><CompareKingdoms /></ErrorBoundary>} />
              <Route path="/tools" element={<ErrorBoundary><Tools /></ErrorBoundary>} />
              <Route path="/rankings" element={<ErrorBoundary><Leaderboards /></ErrorBoundary>} />
              <Route path="/leaderboards" element={<ErrorBoundary><Leaderboards /></ErrorBoundary>} /> {/* Legacy redirect */}
              <Route path="/profile" element={<ErrorBoundary><Profile /></ErrorBoundary>} />
              <Route path="/profile/:userId" element={<RouteErrorBoundary><Profile /></RouteErrorBoundary>} />
              <Route path="/players" element={<ErrorBoundary><UserDirectory /></ErrorBoundary>} />
              <Route path="/about" element={<ErrorBoundary><About /></ErrorBoundary>} />
              <Route path="/admin" element={<ErrorBoundary><AdminDashboard /></ErrorBoundary>} />
              <Route path="/support" element={<ErrorBoundary><SupportAtlas /></ErrorBoundary>} />
              <Route path="/upgrade" element={<ErrorBoundary><SupportAtlas /></ErrorBoundary>} />
              <Route path="/pro" element={<ErrorBoundary><SupportAtlas /></ErrorBoundary>} />
              <Route path="/changelog" element={<ErrorBoundary><Changelog /></ErrorBoundary>} />
              <Route path="/contribute-data" element={<ErrorBoundary><MissingDataRegistry /></ErrorBoundary>} />
              <Route path="/auth/discord/callback" element={<ErrorBoundary><DiscordCallback /></ErrorBoundary>} />
              <Route path="/seasons" element={<ErrorBoundary><KvKSeasons /></ErrorBoundary>} />
              <Route path="/seasons/:seasonNumber" element={<ErrorBoundary><KvKSeasons /></ErrorBoundary>} />
              <Route path="/transfer-hub" element={<ErrorBoundary><TransferBoard /></ErrorBoundary>} />
              <Route path="/transfer-board" element={<ErrorBoundary><TransferBoard /></ErrorBoundary>} /> {/* Legacy redirect */}
              <Route path="/atlas-bot" element={<ErrorBoundary><AtlasBot /></ErrorBoundary>} />
              <Route path="/ambassadors" element={<ErrorBoundary><Ambassadors /></ErrorBoundary>} />
              <Route path="/tools/battle-planner" element={<ErrorBoundary><BattlePlannerLanding /></ErrorBoundary>} />
              <Route path="/tools/kvk-battle-planner" element={<ErrorBoundary><RallyCoordinator /></ErrorBoundary>} />
              <Route path="/gift-codes" element={<ErrorBoundary><GiftCodes /></ErrorBoundary>} />
              <Route path="/tools/gift-codes" element={<ErrorBoundary><GiftCodes /></ErrorBoundary>} /> {/* Legacy redirect */}
              <Route path="/transfer-hub/about" element={<ErrorBoundary><TransferHubLanding /></ErrorBoundary>} />
              <Route path="/auth/callback" element={<ErrorBoundary><AuthCallback /></ErrorBoundary>} />
              <Route path="/cancel-survey" element={<ErrorBoundary><CancelSurvey /></ErrorBoundary>} />
              <Route path="/kingdoms/communities" element={<ErrorBoundary><KingdomCommunities /></ErrorBoundary>} />
              <Route path="/tools/prep-scheduler-info" element={<ErrorBoundary><PrepSchedulerLanding /></ErrorBoundary>} />
              <Route path="/tools/prep-scheduler" element={<ErrorBoundary><PrepScheduler /></ErrorBoundary>} />
              <Route path="/tools/prep-scheduler/:scheduleId" element={<ErrorBoundary><PrepScheduler /></ErrorBoundary>} />
              <Route path="/atlas-bot/dashboard" element={<ErrorBoundary><BotDashboard /></ErrorBoundary>} />
              <Route path="/messages" element={<ErrorBoundary><Messages /></ErrorBoundary>} />
              <Route path="/terms" element={<ErrorBoundary><TermsOfService /></ErrorBoundary>} />
              <Route path="/privacy" element={<ErrorBoundary><PrivacyPolicy /></ErrorBoundary>} />
              <Route path="/tools/base-designer" element={<ErrorBoundary><AllianceBaseDesigner /></ErrorBoundary>} />
              <Route path="/tools/base-designer/about" element={<ErrorBoundary><BaseDesignerLanding /></ErrorBoundary>} />
              <Route path="/tools/base-designer/view/:token" element={<ErrorBoundary><SharedBaseDesigner /></ErrorBoundary>} />
              <Route path="/campaigns/kingdom-settlers" element={<ErrorBoundary><KingdomSettlers /></ErrorBoundary>} />
              <Route path="/admin/campaign-draw" element={<ErrorBoundary><AdminCampaignDraw /></ErrorBoundary>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </PageTransition>
      </main>
      <SiteFooter />
      <FeedbackWidget />
      <SignupNudgeBar />
    </div>
  );
}

function App() {
  return (
    <Sentry.ErrorBoundary fallback={<div className="min-h-screen bg-bg flex items-center justify-center text-white">Something went wrong. Please refresh the page.</div>}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AccessibilityProvider>
            <AuthProvider>
              <PremiumProvider>
                <ToastProvider>
                  <FavoritesProvider>
                    <Router>
                      <AppContent />
                    </Router>
                  </FavoritesProvider>
                </ToastProvider>
              </PremiumProvider>
            </AuthProvider>
          </AccessibilityProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </Sentry.ErrorBoundary>
  );
}

export default App;
