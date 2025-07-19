import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { AppProvider } from '@/providers';
import { Layout } from '@/components/layout';
import { ErrorBoundary } from '@/components/ui';

// Pages
import { HomePage } from '@/pages/HomePage';
import { ExplorePage } from '@/pages/ExplorePage';
import { ProfilePage } from '@/pages/ProfilePage';
import { LeaderboardPage } from '@/pages/LeaderboardPage';
import { StakingPage } from '@/pages/StakingPage';
import { EvermarkDetailPage } from '@/pages/EvermarkDetailPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <Layout>
          <Routes>
            {/* Main routes */}
            <Route path="/" element={<HomePage />} />
            <Route path="/explore" element={<ExplorePage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/leaderboard" element={<LeaderboardPage />} />
            <Route path="/staking" element={<StakingPage />} />
            
            {/* Evermark detail */}
            <Route path="/evermark/:id" element={<EvermarkDetailPage />} />
            
            {/* 404 fallback */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Layout>
      </AppProvider>
    </ErrorBoundary>
  );
}

export default App;