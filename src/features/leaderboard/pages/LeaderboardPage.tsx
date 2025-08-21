// src/features/leaderboard/pages/LeaderboardPage.tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LeaderboardTable } from '../components/LeaderboardTable';
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
        <LeaderboardTable
          onEvermarkClick={handleEvermarkClick}
          showFilters={true}
          showPagination={true}
          compactMode={false}
        />
      </div>
    </div>
  );
};

export default LeaderboardPage;