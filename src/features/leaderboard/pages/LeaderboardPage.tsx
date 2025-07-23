// src/features/leaderboard/pages/LeaderboardPage.tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LeaderboardTable } from '../components/LeaderboardTable';
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
    <div className={`min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 ${className || ''}`}>
      <div className="container mx-auto px-4 py-8">
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