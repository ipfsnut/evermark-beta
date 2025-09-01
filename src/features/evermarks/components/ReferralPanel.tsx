import React, { useState, useCallback } from 'react';
import { CopyIcon, ShareIcon, CheckCircleIcon, ExternalLinkIcon } from 'lucide-react';
import { useActiveAccount } from 'thirdweb/react';
import { useTheme } from '@/providers/ThemeProvider';
import { cn } from '@/utils/responsive';

interface ReferralPanelProps {
  className?: string;
}

export function ReferralPanel({ className = '' }: ReferralPanelProps) {
  const account = useActiveAccount();
  const { isDark } = useTheme();
  const [copied, setCopied] = useState(false);

  const generateReferralLink = useCallback(() => {
    if (!account?.address) return '';
    const baseUrl = window.location.origin;
    return `${baseUrl}/create?ref=${account.address}`;
  }, [account?.address]);

  const copyReferralLink = useCallback(async () => {
    const link = generateReferralLink();
    if (!link) return;

    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy referral link:', error);
    }
  }, [generateReferralLink]);

  const shareReferralLink = useCallback(async () => {
    const link = generateReferralLink();
    if (!link) return;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Create an Evermark with my referral',
          text: 'Join me in creating permanent content references on the blockchain!',
          url: link
        });
      } catch (error) {
        console.error('Failed to share referral link:', error);
      }
    } else {
      // Fallback to copy
      copyReferralLink();
    }
  }, [generateReferralLink, copyReferralLink]);

  if (!account?.address) {
    return (
      <div className={cn(
        "border rounded-lg p-6",
        isDark 
          ? "bg-gray-800/50 border-gray-700" 
          : "bg-white border-gray-300",
        className
      )}>
        <div className="text-center">
          <ShareIcon className={cn(
            "mx-auto h-12 w-12 mb-4",
            isDark ? "text-gray-600" : "text-gray-400"
          )} />
          <h3 className={cn(
            "text-lg font-medium mb-2",
            isDark ? "text-white" : "text-gray-900"
          )}>
            Referral System
          </h3>
          <p className={cn(
            "text-sm",
            isDark ? "text-gray-400" : "text-gray-600"
          )}>
            Connect your wallet to generate referral links and earn 10% of minting fees
          </p>
        </div>
      </div>
    );
  }

  const referralLink = generateReferralLink();

  return (
    <div className={cn(
      "border rounded-lg p-6",
      isDark 
        ? "bg-gray-800/50 border-gray-700" 
        : "bg-white border-gray-300",
      className
    )}>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-r from-green-400 to-purple-500 rounded-full flex items-center justify-center">
            <ShareIcon className="h-5 w-5 text-black" />
          </div>
          <div>
            <h3 className={cn(
              "text-lg font-bold",
              isDark ? "text-white" : "text-gray-900"
            )}>
              Referral System
            </h3>
            <p className={cn(
              "text-sm",
              isDark ? "text-gray-400" : "text-gray-600"
            )}>
              Earn 10% of every minting fee from your referrals
            </p>
          </div>
        </div>

        <div className={cn(
          "border rounded-lg p-4",
          isDark 
            ? "bg-gray-700/50 border-gray-600" 
            : "bg-gray-100/50 border-gray-300"
        )}>
          <h4 className={cn(
            "text-sm font-medium mb-2",
            isDark ? "text-cyan-400" : "text-purple-600"
          )}>
            Your Referral Link
          </h4>
          <div className="flex gap-2">
            <input
              type="text"
              value={referralLink}
              readOnly
              className={cn(
                "flex-1 px-3 py-2 text-xs border rounded focus:ring-2 focus:ring-opacity-20",
                isDark 
                  ? "bg-gray-800 border-gray-600 text-gray-300 focus:border-cyan-400 focus:ring-cyan-400" 
                  : "bg-white border-gray-300 text-gray-700 focus:border-purple-400 focus:ring-purple-400"
              )}
            />
            <button
              onClick={copyReferralLink}
              className={cn(
                "px-3 py-2 rounded transition-colors",
                copied
                  ? "bg-green-600 text-white"
                  : (isDark 
                      ? "bg-gray-600 text-gray-300 hover:bg-gray-500" 
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300")
              )}
              title={copied ? "Copied!" : "Copy link"}
            >
              {copied ? (
                <CheckCircleIcon className="h-4 w-4" />
              ) : (
                <CopyIcon className="h-4 w-4" />
              )}
            </button>
            <button
              onClick={shareReferralLink}
              className={cn(
                "px-3 py-2 rounded transition-colors",
                isDark 
                  ? "bg-purple-600 text-white hover:bg-purple-700" 
                  : "bg-purple-600 text-white hover:bg-purple-700"
              )}
              title="Share link"
            >
              <ExternalLinkIcon className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className={cn(
          "text-xs space-y-2",
          isDark ? "text-gray-400" : "text-gray-600"
        )}>
          <div className="flex items-center justify-between">
            <span>Referral Fee:</span>
            <span className="text-green-400 font-medium">10% of 0.00007 ETH</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Your Earnings per Referral:</span>
            <span className="text-green-400 font-medium">0.000007 ETH</span>
          </div>
          <div className="pt-2 border-t border-gray-600">
            <p className="text-xs">
              Share this link with friends. When they create an Evermark using your link,
              you&apos;ll automatically receive 10% of the minting fee.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}