import React from 'react';
import { ShareIcon, TrendingUpIcon, UsersIcon } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';
import { cn } from '@/utils/responsive';
import { ReferralPanel, ReferralEarnings } from '@/features/evermarks';
import { WalletConnect } from '@/components/ConnectButton';
import { useActiveAccount } from 'thirdweb/react';

export default function ReferralsPage() {
  const { isDark } = useTheme();
  const account = useActiveAccount();

  return (
    <div className={cn(
      "min-h-screen transition-colors duration-200",
      isDark ? "bg-black text-white" : "bg-gray-50 text-gray-900"
    )}>
      {/* Header */}
      <div className={cn(
        "border-b border-green-400/30",
        isDark 
          ? "bg-gradient-to-r from-gray-900 via-black to-gray-900" 
          : "bg-gradient-to-r from-gray-100 via-gray-50 to-gray-100"
      )}>
        <div className="container mx-auto px-4 py-8">
          <div className="text-center space-y-6">
            <div className="flex justify-center items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-r from-green-400 to-purple-500 rounded-full flex items-center justify-center shadow-lg shadow-green-500/50">
                <ShareIcon className="h-7 w-7 text-black" />
              </div>
              <h1 className="text-4xl md:text-6xl font-black bg-gradient-to-r from-green-400 via-cyan-400 to-purple-500 bg-clip-text text-transparent">
                REFERRAL SYSTEM
              </h1>
            </div>
            
            <p className={cn(
              "max-w-3xl mx-auto text-lg",
              isDark ? "text-gray-300" : "text-gray-700"
            )}>
              Earn <span className="text-green-400 font-bold">10% of minting fees</span> from every 
              Evermark created through your referral link. Share the future of content preservation!
            </p>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Stats Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className={cn(
            "border rounded-lg p-6 text-center",
            isDark 
              ? "bg-gray-800/50 border-gray-700" 
              : "bg-white border-gray-300"
          )}>
            <div className="w-12 h-12 bg-gradient-to-r from-green-400 to-cyan-400 rounded-full flex items-center justify-center mx-auto mb-4">
              <TrendingUpIcon className="h-6 w-6 text-black" />
            </div>
            <div className="text-3xl font-bold text-green-400 mb-2">10%</div>
            <div className={cn(
              "text-sm",
              isDark ? "text-gray-400" : "text-gray-600"
            )}>
              Commission Rate
            </div>
          </div>

          <div className={cn(
            "border rounded-lg p-6 text-center",
            isDark 
              ? "bg-gray-800/50 border-gray-700" 
              : "bg-white border-gray-300"
          )}>
            <div className="w-12 h-12 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full flex items-center justify-center mx-auto mb-4">
              <UsersIcon className="h-6 w-6 text-black" />
            </div>
            <div className="text-3xl font-bold text-purple-400 mb-2">∞</div>
            <div className={cn(
              "text-sm",
              isDark ? "text-gray-400" : "text-gray-600"
            )}>
              Unlimited Referrals
            </div>
          </div>

          <div className={cn(
            "border rounded-lg p-6 text-center",
            isDark 
              ? "bg-gray-800/50 border-gray-700" 
              : "bg-white border-gray-300"
          )}>
            <div className="w-12 h-12 bg-gradient-to-r from-cyan-400 to-blue-400 rounded-full flex items-center justify-center mx-auto mb-4">
              <ShareIcon className="h-6 w-6 text-black" />
            </div>
            <div className="text-3xl font-bold text-cyan-400 mb-2">0.000007</div>
            <div className={cn(
              "text-sm",
              isDark ? "text-gray-400" : "text-gray-600"
            )}>
              ETH per Referral
            </div>
          </div>
        </div>

        {!account && (
          <div className={cn(
            "mb-8 p-6 rounded-lg border text-center",
            isDark 
              ? "bg-amber-900/30 border-amber-500/50" 
              : "bg-amber-100/80 border-amber-300"
          )}>
            <h3 className={cn(
              "text-lg font-medium mb-3",
              isDark ? "text-amber-300" : "text-amber-700"
            )}>
              Connect Your Wallet
            </h3>
            <p className={cn(
              "mb-4 text-sm",
              isDark ? "text-amber-200" : "text-amber-600"
            )}>
              Connect your wallet to generate referral links and track your earnings
            </p>
            <WalletConnect />
          </div>
        )}

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Referral Link Generator */}
          <ReferralPanel />

          {/* Earnings Tracker */}
          <ReferralEarnings />
        </div>

        {/* How it Works Section */}
        <div className={cn(
          "border rounded-lg p-8",
          isDark 
            ? "bg-gray-800/50 border-gray-700" 
            : "bg-white border-gray-300"
        )}>
          <h2 className={cn(
            "text-2xl font-bold mb-6 text-center",
            isDark ? "text-white" : "text-gray-900"
          )}>
            How the Referral System Works
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-green-400 to-cyan-400 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-black">1</span>
              </div>
              <h3 className={cn(
                "font-semibold mb-2",
                isDark ? "text-white" : "text-gray-900"
              )}>
                Generate Your Link
              </h3>
              <p className={cn(
                "text-sm",
                isDark ? "text-gray-400" : "text-gray-600"
              )}>
                Create a unique referral link tied to your wallet address
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-black">2</span>
              </div>
              <h3 className={cn(
                "font-semibold mb-2",
                isDark ? "text-white" : "text-gray-900"
              )}>
                Share with Friends
              </h3>
              <p className={cn(
                "text-sm",
                isDark ? "text-gray-400" : "text-gray-600"
              )}>
                Share your link on social media, blogs, or directly with friends
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-cyan-400 to-blue-400 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-black">3</span>
              </div>
              <h3 className={cn(
                "font-semibold mb-2",
                isDark ? "text-white" : "text-gray-900"
              )}>
                Earn Automatically
              </h3>
              <p className={cn(
                "text-sm",
                isDark ? "text-gray-400" : "text-gray-600"
              )}>
                Receive 10% of the minting fee (0.000007 ETH) for each successful referral
              </p>
            </div>
          </div>

          <div className={cn(
            "mt-8 p-4 rounded-lg border",
            isDark 
              ? "bg-blue-900/30 border-blue-500/50" 
              : "bg-blue-100/50 border-blue-300"
          )}>
            <h4 className={cn(
              "font-medium mb-2",
              isDark ? "text-blue-300" : "text-blue-700"
            )}>
              Key Benefits:
            </h4>
            <ul className={cn(
              "text-sm space-y-1",
              isDark ? "text-blue-200" : "text-blue-600"
            )}>
              <li>• Passive income from content creation</li>
              <li>• No limit on number of referrals</li>
              <li>• Automatic payment distribution</li>
              <li>• Claim earnings anytime</li>
              <li>• Help grow the Evermark ecosystem</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}