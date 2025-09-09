import React, { Suspense, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { AppProviders } from '../src/providers/AppProviders';
import { Layout } from '../src/components/layout';
import { ErrorBoundary } from '../src/components/ui';
import { PWAInstallPrompt } from '../src/components/PWAInstallPrompt';

// Lazy load pages for better performance
const HomePage = React.lazy(() => import('../src/pages/HomePage'));
const ExplorePage = React.lazy(() => import('../src/pages/ExplorePage'));
const AboutPage = React.lazy(() => import('../src/pages/AboutPage'));
const DocsPage = React.lazy(() => import('../src/pages/DocsPage'));
const SwapPage = React.lazy(() => import('../src/pages/SwapPage'));
const MyEvermarksPage = React.lazy(() => import('../src/pages/MyEvermarksPage'));
const LeaderboardPage = React.lazy(() => import('../src/features/leaderboard/pages/LeaderboardPage'));
const StakingPage = React.lazy(() => import('../src/features/staking/pages/StakingPage'));
const EvermarkDetailPage = React.lazy(() => import('../src/features/evermarks/pages/EvermarkDetailPage'));
const CreatePage = React.lazy(() => import('../src/features/evermarks/pages/CreatePage'));
const ReferralsPage = React.lazy(() => import('../src/pages/ReferralsPage'));
const BetaPage = React.lazy(() => import('./pages/BetaPage'));
const AdminPage = React.lazy(() => import('../src/pages/AdminPage'));
const TransactionTestPage = React.lazy(() => import('../src/pages/TransactionTestPage'));
const NotFoundPage = React.lazy(() => import('../src/pages/NotFoundPage'));

// Loading fallback component
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-black text-white">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyber-primary mx-auto mb-4"></div>
        <p className="text-gray-400">Loading Evermark...</p>
      </div>
    </div>
  );
}

// App content with routing (separated for clean provider structure)
function AppContent() {
  // Handle Mini App shared links
  useEffect(() => {
    const handleMiniAppLinks = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const isMiniAppShare = urlParams.get('fc_miniapp') === '1';
      const shareSource = urlParams.get('fc_source');
      
      if (isMiniAppShare) {
        console.log('🔗 Opened via Mini App share link:', { shareSource });
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, '', cleanUrl);
        
        if (shareSource === 'share') {
          console.log('📱 Successfully opened shared content in Mini App');
        }
      }
    };

    handleMiniAppLinks();
  }, []);

  return (
    <>
      <Layout>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Core feature routes */}
            <Route path="/" element={<HomePage />} />
            <Route path="/explore" element={<ExplorePage />} />
            <Route path="/my-evermarks" element={<MyEvermarksPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/docs" element={<DocsPage />} />
            <Route path="/docs/:docId" element={<DocsPage />} />
            <Route path="/swap" element={<SwapPage />} />
            <Route path="/leaderboard" element={<LeaderboardPage />} />
            <Route path="/staking" element={<StakingPage />} />
            <Route path="/beta" element={<BetaPage />} />
            <Route path="/referrals" element={<ReferralsPage />} />
            
            {/* Evermark-specific routes */}
            <Route path="/create" element={<CreatePage />} />
            <Route path="/evermark/:id" element={<EvermarkDetailPage />} />
            
            {/* Admin route */}
            <Route path="/admin" element={<AdminPage />} />
            
            {/* Test route for transaction functionality */}
            <Route path="/transaction-test" element={<TransactionTestPage />} />
            
            {/* Catch-all route */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </Layout>
      
      {/* PWA Install Prompt - shown outside layout */}
      <PWAInstallPrompt />
    </>
  );
}

// Main App component
function App() {
  return (
    <ErrorBoundary>
      <AppProviders>
        <AppContent />
      </AppProviders>
    </ErrorBoundary>
  );
}

export default App;