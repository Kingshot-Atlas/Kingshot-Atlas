import React, { Suspense, lazy } from 'react';
import * as Sentry from '@sentry/react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import Header from './components/Header';
import ErrorBoundary from './components/ErrorBoundary';
import RouteErrorBoundary from './components/RouteErrorBoundary';
import { ToastProvider } from './components/Toast';
import KeyboardShortcutsModal from './components/KeyboardShortcutsModal';
import FeedbackWidget from './components/FeedbackWidget';
import SignupNudgeBar from './components/SignupNudgeBar';
import CampaignNotificationBanner from './components/CampaignNotificationBanner';
import KvKPhaseBanner from './components/KvKPhaseBanner';
import { useKeyboardShortcuts, useKeyboardHelp } from './hooks/useKeyboardShortcuts';
import { usePageTracking } from './hooks/useAnalytics';
import { useKingdomsRealtime } from './hooks/useKingdomsRealtime';
import { useToast } from './components/Toast';
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
const GiftCodeRedeemer = lazy(() => import('./pages/GiftCodeRedeemer'));
const GiftCodeLanding = lazy(() => import('./pages/GiftCodeLanding'));
const TransferHubLanding = lazy(() => import('./pages/TransferHubLanding'));
const AuthCallback = lazy(() => import('./pages/AuthCallback'));
const CancelSurvey = lazy(() => import('./pages/CancelSurvey'));
const KingdomCommunities = lazy(() => import('./pages/KingdomCommunities'));
const PrepScheduler = lazy(() => import('./pages/PrepScheduler'));
const PrepSchedulerLanding = lazy(() => import('./pages/PrepSchedulerLanding'));
const BotDashboard = lazy(() => import('./pages/BotDashboard'));

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
  const { showToast } = useToast();
  const { t } = useTranslation();
  useKeyboardShortcuts({ onShowHelp: openHelp });
  usePageTracking(); // Track page views for analytics
  
  // Subscribe to real-time kingdom and KvK history updates with toast notifications
  useKingdomsRealtime({
    onKingdomUpdate: (kingdomNumber, eventType) => {
      if (eventType === 'UPDATE') {
        showToast(`🔄 ${t('realtime.kingdomUpdated', { number: kingdomNumber })}`, 'info');
      }
    },
    onKvkHistoryUpdate: (kingdomNumber, kvkNumber, eventType) => {
      if (eventType === 'UPDATE') {
        showToast(`📊 ${t('realtime.kvkCorrected', { kingdom: kingdomNumber, kvk: kvkNumber })}`, 'success');
      } else if (eventType === 'INSERT') {
        showToast(`✨ ${t('realtime.newKvkRecord', { number: kingdomNumber })}`, 'info');
      }
    }
  });

  return (
    <div className="min-h-screen bg-bg">
      <Header />
      <KvKPhaseBanner />
      <CampaignNotificationBanner />
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
              <Route path="/gift-codes" element={<ErrorBoundary><GiftCodeLanding /></ErrorBoundary>} />
              <Route path="/transfer-hub/about" element={<ErrorBoundary><TransferHubLanding /></ErrorBoundary>} />
              <Route path="/tools/gift-codes" element={<ErrorBoundary><GiftCodeRedeemer /></ErrorBoundary>} />
              <Route path="/auth/callback" element={<ErrorBoundary><AuthCallback /></ErrorBoundary>} />
              <Route path="/cancel-survey" element={<ErrorBoundary><CancelSurvey /></ErrorBoundary>} />
              <Route path="/kingdoms/communities" element={<ErrorBoundary><KingdomCommunities /></ErrorBoundary>} />
              <Route path="/tools/prep-scheduler-info" element={<ErrorBoundary><PrepSchedulerLanding /></ErrorBoundary>} />
              <Route path="/tools/prep-scheduler" element={<ErrorBoundary><PrepScheduler /></ErrorBoundary>} />
              <Route path="/tools/prep-scheduler/:scheduleId" element={<ErrorBoundary><PrepScheduler /></ErrorBoundary>} />
              <Route path="/atlas-bot/dashboard" element={<ErrorBoundary><BotDashboard /></ErrorBoundary>} />
            </Routes>
          </Suspense>
        </PageTransition>
      </main>
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
