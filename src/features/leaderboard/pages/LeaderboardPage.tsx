// src/features/leaderboard/pages/LeaderboardPage.tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LeaderboardTabs } from '../components/LeaderboardTabs';
import { themeClasses } from '../../../utils/theme';
import type { LeaderboardEntry } from '../types';

interface LeaderboardPageProps {
  className?: string;
}

export const LeaderboardPage: React.FC<LeaderboardPageProps> = ({ className }) => {
  const navigate = useNavigate();

  // Handle evermark click - navigate to detail page
  const handleEvermarkClick = (entry: LeaderboardEntry) => {
    navigate(`/evermark/${entry.evermarkId}`);
  };

  return (
    <div className={`${themeClasses.page} ${className || ''}`}>
      <div className={themeClasses.container}>
        <div className="space-y-6">
          {/* Page Header */}
          <div className="text-center">
            <h1 className={`${themeClasses.headingLarge} mb-2`}>
              Leaderboard
            </h1>
            <p className="text-app-text-secondary max-w-2xl mx-auto">
              See which evermarks are trending and explore final results from completed seasons
            </p>
          </div>

          {/* Tab System */}
          <LeaderboardTabs
            onEvermarkClick={handleEvermarkClick}
          />
        </div>
      </div>
    </div>
  );
};

export default LeaderboardPage;