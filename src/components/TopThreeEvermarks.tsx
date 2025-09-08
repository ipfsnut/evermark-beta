// src/components/TopThreeEvermarks.tsx
import React from 'react';
import { Link } from 'react-router-dom';
import { 
  TrophyIcon, 
  VoteIcon, 
  UserIcon, 
  ExternalLinkIcon,
  ChevronRightIcon,
  CrownIcon,
  MedalIcon,
  AwardIcon
} from 'lucide-react';

import { cn, useIsMobile } from '../utils/responsive';
import { useThemeClasses } from '../providers/ThemeProvider';
import { useQuery } from '@tanstack/react-query';
import { VotingService } from '../features/voting';

interface LeaderboardEntry {
  id: string;
  title: string;
  description?: string;
  image?: string;
  supabaseImageUrl?: string;
  totalVotes: string;
  author: string;
  rank: number;
  contentType?: string;
}

const TopThreeEvermarks: React.FC = () => {
  const isMobile = useIsMobile();
  const dynamicTheme = useThemeClasses();
  
  // Use the working leaderboard API endpoint directly
  const { data: leaderboardData, isLoading, error } = useQuery({
    queryKey: ['top-three-evermarks'],
    queryFn: async () => {
      const response = await fetch('/.netlify/functions/leaderboard-data?limit=3');
      if (!response.ok) throw new Error('Failed to fetch leaderboard data');
      return response.json();
    },
    staleTime: 30 * 1000, // 30 seconds
    retry: 2
  });

  const entries = leaderboardData?.evermarks || [];

  // Get top 3 entries
  const top3 = entries?.slice(0, 3) || [];

  if (error) {
    return null; // Don't show section if there's an error
  }

  if (isLoading) {
    return (
      <div className={cn(
        "container mx-auto px-4",
        isMobile ? "py-6" : "py-8"
      )}>
        <div className={cn(
          "text-center",
          isMobile ? "mb-6" : "mb-8"
        )}>
          <div className="flex items-center justify-center gap-2 mb-2">
            <TrophyIcon className={cn(
              "text-yellow-400",
              isMobile ? "h-5 w-5" : "h-6 w-6"
            )} />
            <h2 className={cn(
              `font-bold ${dynamicTheme.text.primary}`,
              isMobile ? "text-xl" : "text-2xl"
            )}>Top Voted Evermarks</h2>
          </div>
          <p className={cn(
            `${dynamicTheme.text.muted} animate-pulse`,
            isMobile ? "text-sm px-4" : ""
          )}>Loading community favorites...</p>
        </div>
      </div>
    );
  }

  if (!top3.length) {
    return null; // Don't show section if no data
  }

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <CrownIcon className="h-5 w-5 text-yellow-400" />;
      case 2:
        return <MedalIcon className="h-5 w-5 text-gray-400" />;
      case 3:
        return <AwardIcon className="h-5 w-5 text-orange-400" />;
      default:
        return <TrophyIcon className="h-5 w-5 text-gray-500" />;
    }
  };

  const getRankGradient = (rank: number) => {
    switch (rank) {
      case 1:
        return 'from-yellow-400 to-yellow-600';
      case 2:
        return 'from-gray-400 to-gray-600';
      case 3:
        return 'from-orange-400 to-orange-600';
      default:
        return 'from-gray-400 to-gray-600';
    }
  };

  const getRankGlow = (rank: number) => {
    switch (rank) {
      case 1:
        return 'shadow-yellow-500/20';
      case 2:
        return 'shadow-gray-500/20';
      case 3:
        return 'shadow-orange-500/20';
      default:
        return 'shadow-gray-500/20';
    }
  };

  return (
    <div className={cn(
      "container mx-auto px-4",
      isMobile ? "py-6" : "py-8"
    )}>
      {/* Section Header */}
      <div className={cn(
        "text-center",
        isMobile ? "mb-6" : "mb-8"
      )}>
        <div className="flex items-center justify-center gap-2 mb-2">
          <TrophyIcon className={cn(
            "text-yellow-400",
            isMobile ? "h-5 w-5" : "h-6 w-6"
          )} />
          <h2 className={cn(
            `font-bold ${dynamicTheme.text.primary}`,
            isMobile ? "text-xl" : "text-2xl"
          )}>Top Voted Evermarks</h2>
        </div>
        <p className={cn(
          dynamicTheme.text.muted,
          isMobile ? "text-sm px-4" : ""
        )}>Community favorites ranked by votes</p>
      </div>

      {/* Top 3 Grid */}
      <div className={cn(
        isMobile 
          ? "space-y-4" 
          : "grid grid-cols-1 md:grid-cols-3 gap-6"
      )}>
        {top3.map((entry, index) => {
          const rank = index + 1;
          const voteCount = VotingService.formatVoteAmount(entry.totalVotes, 6);
          
          return (
            <Link
              key={entry.id}
              to={`/evermark/${entry.id}`}
              className={cn(
                `group ${dynamicTheme.bg.card} ${dynamicTheme.border.primary} border rounded-lg transition-all duration-300 hover:shadow-lg hover:scale-105`,
                getRankGlow(rank),
                isMobile ? "p-4" : "p-6",
                // Make #1 stand out more on desktop
                !isMobile && rank === 1 ? "md:scale-105 md:shadow-xl" : ""
              )}
            >
              {/* Rank Badge */}
              <div className="flex items-center justify-between mb-3">
                <div className={cn(
                  "flex items-center gap-2 rounded-full px-3 py-1 bg-gradient-to-r text-black font-bold",
                  getRankGradient(rank),
                  isMobile ? "text-sm" : ""
                )}>
                  {getRankIcon(rank)}
                  <span>#{rank}</span>
                </div>
                <ExternalLinkIcon className={cn(
                  `${dynamicTheme.text.muted} group-hover:${dynamicTheme.text.secondary} transition-colors`,
                  isMobile ? "h-4 w-4" : "h-5 w-5"
                )} />
              </div>

              {/* Content Preview */}
              <div className="mb-4">
                {(entry.supabaseImageUrl || entry.image) && (
                  <div className={cn(
                    "w-full mb-3 rounded-lg overflow-hidden",
                    // Different aspect ratios and backgrounds for different content types
                    entry.contentType === 'README' || entry.contentType === 'ISBN'
                      ? "h-40 bg-gradient-to-br from-amber-900/10 to-gray-800/20"  // Taller container for books with warm background
                      : "h-32 bg-gray-200 dark:bg-gray-700"  // Fixed height for other content
                  )}>
                    <img
                      src={entry.supabaseImageUrl || entry.image}
                      alt={entry.title}
                      className={cn(
                        "w-full h-full transition-transform duration-300 group-hover:scale-105",
                        entry.contentType === 'README' || entry.contentType === 'ISBN'
                          ? "object-contain border-4 border-red-500"  // VERY OBVIOUS: Red border for book covers
                          : "object-cover border-4 border-blue-500"   // VERY OBVIOUS: Blue border for other content
                      )}
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                    {/* Debug indicator */}
                    {(entry.contentType === 'README' || entry.contentType === 'ISBN') && (
                      <div className="absolute top-2 right-2 bg-red-600 text-white px-2 py-1 text-xs font-bold rounded">
                        BOOK: {entry.contentType}
                      </div>
                    )}
                  </div>
                )}
                
                <h3 className={cn(
                  `font-semibold ${dynamicTheme.text.primary} group-hover:${dynamicTheme.text.accent} transition-colors line-clamp-2`,
                  isMobile ? "text-base mb-2" : "text-lg mb-2"
                )}>
                  {entry.title}
                </h3>
                
                {entry.description && (
                  <p className={cn(
                    `${dynamicTheme.text.muted} line-clamp-2`,
                    isMobile ? "text-sm" : ""
                  )}>
                    {entry.description}
                  </p>
                )}
              </div>

              {/* Stats Footer */}
              <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-1">
                  <VoteIcon className={cn(
                    "text-purple-400",
                    isMobile ? "h-3 w-3" : "h-4 w-4"
                  )} />
                  <span className={cn(
                    "font-bold text-purple-400",
                    isMobile ? "text-sm" : ""
                  )}>
                    {voteCount}
                  </span>
                </div>
                
                <div className="flex items-center gap-1">
                  <UserIcon className={cn(
                    dynamicTheme.text.muted,
                    isMobile ? "h-3 w-3" : "h-4 w-4"
                  )} />
                  <span className={cn(
                    `${dynamicTheme.text.muted} font-medium truncate max-w-24`,
                    isMobile ? "text-xs" : "text-sm"
                  )}>
                    {entry.author}
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* View All Link */}
      <div className={cn(
        "text-center",
        isMobile ? "mt-6" : "mt-8"
      )}>
        <Link 
          to="/leaderboard"
          className="inline-flex items-center text-cyan-400 hover:text-cyan-300 font-medium group transition-colors"
        >
          <span className={cn(isMobile ? "text-sm" : "")}>View Full Leaderboard</span>
          <ChevronRightIcon className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
        </Link>
      </div>
    </div>
  );
};

export default TopThreeEvermarks;