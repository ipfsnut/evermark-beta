// src/App.tsx - Main application component with feature-first routing
import React, { Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { AppProviders } from '@/providers/AppProviders';
import { Layout } from '@/components/layout';
import { ErrorBoundary } from '@/components/ui';

// Lazy load pages for better performance
const HomePage = React.lazy(() => import('@/pages/HomePage'));
const ExplorePage = React.lazy(() => import('@/pages/ExplorePage'));
const ProfilePage = React.lazy(() => import('@/pages/ProfilePage'));
const LeaderboardPage = React.lazy(() => import('@/pages/LeaderboardPage'));
const StakingPage = React.lazy(() => import('@/pages/StakingPage'));
const EvermarkDetailPage = React.lazy(() => import('@/pages/EvermarkDetailPage'));
const CreateEvermarkPage = React.lazy(() => import('@/pages/CreateEvermarkPage'));
const NotFoundPage = React.lazy(() => import('@/pages/NotFoundPage'));

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
  return (
    <Layout>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Core feature routes */}
          <Route path="/" element={<HomePage />} />
          <Route path="/explore" element={<ExplorePage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="/staking" element={<StakingPage />} />
          
          {/* Evermark-specific routes */}
          <Route path="/create" element={<CreateEvermarkPage />} />
          <Route path="/evermark/:id" element={<EvermarkDetailPage />} />
          
          {/* Catch-all route */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </Layout>
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