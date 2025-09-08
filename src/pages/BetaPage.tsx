import React from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { useWalletAccount } from '@/hooks/core/useWalletAccount';
import { useBetaPoints } from '@/features/points/hooks/useBetaPoints';
import { FlaskConicalIcon, TrophyIcon, CoinsIcon, UserIcon, CalendarIcon, ExternalLinkIcon } from 'lucide-react';
import { cn } from '@/utils/responsive';
import { PointsService } from '@/features/points/services/PointsService';

function BetaPage() {
  const { isDark } = useTheme();
  const account = useWalletAccount();
  const { userPoints, transactions, leaderboard, isLoading, error } = useBetaPoints();

  if (!account) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4">
        <div className={cn(
          "max-w-md w-full rounded-lg border p-8 text-center",
          isDark 
            ? "bg-gray-900 border-gray-800" 
            : "bg-white border-gray-200"
        )}>
          <FlaskConicalIcon className="h-12 w-12 mx-auto mb-4 text-purple-500" />
          <h2 className={cn(
            "text-xl font-bold mb-2",
            isDark ? "text-white" : "text-gray-900"
          )}>
            Beta Dashboard
          </h2>
          <p className={cn(
            "text-sm mb-4",
            isDark ? "text-gray-400" : "text-gray-600"
          )}>
            Connect your wallet to view your beta points and activity.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-2 border-purple-500 border-t-transparent rounded-full mx-auto mb-2"></div>
          <p className={cn("text-sm", isDark ? "text-gray-400" : "text-gray-600")}>
            Loading beta data...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className={cn(
          "max-w-md w-full rounded-lg border p-8 text-center",
          isDark 
            ? "bg-red-950/20 border-red-900" 
            : "bg-red-50 border-red-200"
        )}>
          <p className="text-red-500 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  const totalPoints = userPoints?.total_points || 0;
  const userRank = leaderboard.findIndex(entry => entry.wallet_address === account.address) + 1;

  const actionTypeLabels = {
    create_evermark: 'Create Evermark',
    vote: 'Vote',
    stake: 'Stake'
  };

  const actionTypeIcons = {
    create_evermark: UserIcon,
    vote: TrophyIcon,
    stake: CoinsIcon
  };

  return (
    <div className="min-h-screen p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center mb-2">
            <FlaskConicalIcon className="h-8 w-8 text-purple-500 mr-3" />
            <h1 className={cn(
              "text-3xl font-bold",
              isDark ? "text-white" : "text-gray-900"
            )}>
              Beta Dashboard
            </h1>
          </div>
          <p className={cn(
            "text-sm",
            isDark ? "text-gray-400" : "text-gray-600"
          )}>
            Track your beta participation and earn points for early access rewards.
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Total Points */}
          <div className={cn(
            "rounded-lg border p-6",
            isDark 
              ? "bg-gray-900 border-gray-800" 
              : "bg-white border-gray-200"
          )}>
            <div className="flex items-center justify-between mb-2">
              <h3 className={cn(
                "text-sm font-medium",
                isDark ? "text-gray-400" : "text-gray-600"
              )}>
                Total Points
              </h3>
              <TrophyIcon className="h-5 w-5 text-purple-500" />
            </div>
            <p className={cn(
              "text-2xl font-bold",
              isDark ? "text-white" : "text-gray-900"
            )}>
              {PointsService.formatPoints(totalPoints)}
            </p>
          </div>

          {/* Rank */}
          <div className={cn(
            "rounded-lg border p-6",
            isDark 
              ? "bg-gray-900 border-gray-800" 
              : "bg-white border-gray-200"
          )}>
            <div className="flex items-center justify-between mb-2">
              <h3 className={cn(
                "text-sm font-medium",
                isDark ? "text-gray-400" : "text-gray-600"
              )}>
                Leaderboard Rank
              </h3>
              <TrophyIcon className="h-5 w-5 text-yellow-500" />
            </div>
            <p className={cn(
              "text-2xl font-bold",
              isDark ? "text-white" : "text-gray-900"
            )}>
              {userRank > 0 ? `#${userRank}` : 'Unranked'}
            </p>
          </div>

          {/* Activity */}
          <div className={cn(
            "rounded-lg border p-6",
            isDark 
              ? "bg-gray-900 border-gray-800" 
              : "bg-white border-gray-200"
          )}>
            <div className="flex items-center justify-between mb-2">
              <h3 className={cn(
                "text-sm font-medium",
                isDark ? "text-gray-400" : "text-gray-600"
              )}>
                Total Activities
              </h3>
              <UserIcon className="h-5 w-5 text-blue-500" />
            </div>
            <p className={cn(
              "text-2xl font-bold",
              isDark ? "text-white" : "text-gray-900"
            )}>
              {transactions.length}
            </p>
          </div>
        </div>

        {/* Recent Activity */}
        <div className={cn(
          "rounded-lg border",
          isDark 
            ? "bg-gray-900 border-gray-800" 
            : "bg-white border-gray-200"
        )}>
          <div className="p-6 border-b border-gray-200 dark:border-gray-800">
            <h2 className={cn(
              "text-lg font-semibold",
              isDark ? "text-white" : "text-gray-900"
            )}>
              Recent Activity
            </h2>
            <p className={cn(
              "text-sm mt-1",
              isDark ? "text-gray-400" : "text-gray-600"
            )}>
              Your latest beta participation
            </p>
          </div>
          
          <div className="p-6">
            {transactions.length === 0 ? (
              <div className="text-center py-8">
                <FlaskConicalIcon className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <p className={cn(
                  "text-sm",
                  isDark ? "text-gray-400" : "text-gray-600"
                )}>
                  No activity yet. Start by creating Evermarks, voting, or staking!
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {transactions.map((transaction) => {
                  const Icon = actionTypeIcons[transaction.action_type];
                  const actionLabel = actionTypeLabels[transaction.action_type];
                  
                  return (
                    <div
                      key={transaction.id}
                      className={cn(
                        "flex items-center justify-between p-4 rounded-lg border",
                        isDark 
                          ? "bg-gray-800/50 border-gray-700" 
                          : "bg-gray-50 border-gray-200"
                      )}
                    >
                      <div className="flex items-center">
                        <div className={cn(
                          "w-10 h-10 rounded-lg flex items-center justify-center mr-3",
                          isDark 
                            ? "bg-gray-700" 
                            : "bg-white"
                        )}>
                          <Icon className="h-5 w-5 text-purple-500" />
                        </div>
                        <div>
                          <p className={cn(
                            "font-medium text-sm",
                            isDark ? "text-white" : "text-gray-900"
                          )}>
                            {actionLabel}
                          </p>
                          <div className="flex items-center text-xs text-gray-500">
                            <CalendarIcon className="h-3 w-3 mr-1" />
                            {new Date(transaction.created_at).toLocaleDateString()}
                            {transaction.tx_hash && (
                              <>
                                <span className="mx-2">•</span>
                                <a
                                  href={`https://basescan.org/tx/${transaction.tx_hash}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center hover:text-purple-500 transition-colors"
                                >
                                  View TX <ExternalLinkIcon className="h-3 w-3 ml-1" />
                                </a>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={cn(
                          "font-bold text-sm",
                          isDark ? "text-white" : "text-gray-900"
                        )}>
                          +{transaction.points_earned} pts
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Point System Info */}
        <div className={cn(
          "rounded-lg border mt-8 p-6",
          isDark 
            ? "bg-purple-950/20 border-purple-900" 
            : "bg-purple-50 border-purple-200"
        )}>
          <h3 className="text-lg font-semibold text-purple-600 mb-4">
            How to Earn Points
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="flex items-start">
              <UserIcon className="h-5 w-5 text-purple-500 mr-2 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-purple-600">Create Evermark</p>
                <p className={cn(
                  "text-xs",
                  isDark ? "text-purple-300" : "text-purple-600"
                )}>
                  10 points per Evermark
                </p>
              </div>
            </div>
            <div className="flex items-start">
              <TrophyIcon className="h-5 w-5 text-purple-500 mr-2 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-purple-600">Vote</p>
                <p className={cn(
                  "text-xs",
                  isDark ? "text-purple-300" : "text-purple-600"
                )}>
                  1 point per vote transaction
                </p>
              </div>
            </div>
            <div className="flex items-start">
              <CoinsIcon className="h-5 w-5 text-purple-500 mr-2 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-purple-600">Stake</p>
                <p className={cn(
                  "text-xs",
                  isDark ? "text-purple-300" : "text-purple-600"
                )}>
                  1 point per 1M EMARK staked
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default BetaPage;