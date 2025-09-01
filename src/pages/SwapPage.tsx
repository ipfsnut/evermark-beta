// src/pages/SwapPage.tsx - Context-aware token swap interface
import React, { useState, useEffect } from 'react';
import { ArrowUpDownIcon, InfoIcon, ZapIcon, ExternalLinkIcon } from 'lucide-react';
import { themeClasses, cn } from '@/utils/theme';
import { useTheme } from '@/providers/ThemeProvider';
import { CONTRACTS } from '@/lib/contracts';
import { useFarcasterDetection } from '@/hooks/useFarcasterDetection';

// Farcaster Mini App swap interface
function FarcasterSwapInterface() {
  const { isDark } = useTheme();
  const { miniAppContext, isFrameSDKReady } = useFarcasterDetection();
  const [isSwapping, setIsSwapping] = useState(false);

  const handleSwap = async () => {
    if (!isFrameSDKReady) return;
    
    try {
      setIsSwapping(true);
      
      // Use the Farcaster Mini App SDK for native in-app swaps
      const { sdk } = await import('@farcaster/miniapp-sdk');
      
      // Use native Farcaster swap functionality
      const emarkAddress = CONTRACTS.EMARK_TOKEN;
      
      await sdk.actions.swapToken({
        tokenIn: "ETH",
        tokenOut: emarkAddress,
        chain: "base"
      });
      
    } catch (error) {
      console.error('Swap failed:', error);
    } finally {
      setIsSwapping(false);
    }
  };

  return (
    <div className={themeClasses.page}>
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto">
          <div className={cn(
            "rounded-lg p-6 border",
            isDark 
              ? "bg-gray-800/50 border-gray-700" 
              : "bg-app-bg-card border-app-border"
          )}>
            <div className="text-center mb-6">
              <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-r from-green-400 to-blue-500 rounded-full flex items-center justify-center">
                <ArrowUpDownIcon className="h-8 w-8 text-black" />
              </div>
              <h2 className={cn(
                "text-xl font-bold",
                isDark ? "text-white" : "text-gray-900"
              )}>
                Swap Tokens
              </h2>
            </div>
            
            <button
              onClick={handleSwap}
              disabled={isSwapping || !isFrameSDKReady}
              className={cn(
                "w-full py-3 px-4 rounded-lg font-medium transition-colors",
                "bg-gradient-to-r from-green-400 to-blue-500 text-black",
                "hover:from-green-500 hover:to-blue-600",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              {isSwapping ? 'Opening Farcaster Swap...' : 'Swap ETH → EMARK'}
            </button>
            
            {!isFrameSDKReady && (
              <p className={cn(
                "text-sm text-center mt-4",
                isDark ? "text-yellow-400" : "text-yellow-600"
              )}>
                Farcaster SDK not ready
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Browser/PWA swap interface
function BrowserSwapInterface() {
  const { isDark } = useTheme();
  const emarkAddress = CONTRACTS.EMARK_TOKEN;
  const uniswapUrl = `https://app.uniswap.org/#/swap?outputCurrency=${emarkAddress}&chain=base`;

  return (
    <div className={themeClasses.page}>
      {/* Header */}
      <div className={cn(
        themeClasses.section,
        "border-b border-purple-400/30"
      )}>
        <div className="container mx-auto px-4 py-8">
          <div className="text-center space-y-6">
            <div className="flex justify-center items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-r from-green-400 to-blue-500 rounded-full flex items-center justify-center shadow-lg shadow-green-500/50">
                <ArrowUpDownIcon className="h-7 w-7 text-black" />
              </div>
              <h1 className={themeClasses.headingHero}>
                TOKEN SWAP
              </h1>
            </div>
            
            <p className={cn(
              "max-w-3xl mx-auto text-lg",
              isDark ? "text-gray-300" : "text-gray-700"
            )}>
              Swap ETH for EMARK tokens on Uniswap with optimal rates and low fees.
            </p>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          {/* Uniswap Integration Card */}
          <div className={cn(
            "rounded-lg p-8 border text-center",
            isDark 
              ? "bg-gray-800/50 border-gray-700" 
              : "bg-app-bg-card border-app-border"
          )}>
            <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-r from-green-400 to-blue-500 rounded-full flex items-center justify-center">
              <ZapIcon className="h-12 w-12 text-black" />
            </div>
            
            <h2 className={cn(
              "text-2xl font-bold mb-4",
              isDark ? "text-white" : "text-gray-900"
            )}>
              Swap on Uniswap
            </h2>
            
            <p className={cn(
              "text-lg mb-6 leading-relaxed",
              isDark ? "text-gray-300" : "text-gray-700"
            )}>
              Trade EMARK tokens on Uniswap V3 with deep liquidity and competitive rates.
            </p>

            <a
              href={uniswapUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "inline-flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-colors",
                "bg-gradient-to-r from-green-400 to-blue-500 text-black",
                "hover:from-green-500 hover:to-blue-600"
              )}
            >
              <span>Open Uniswap</span>
              <ExternalLinkIcon className="h-4 w-4" />
            </a>
            
            <div className={cn(
              "mt-6 p-4 rounded-lg border",
              isDark 
                ? "bg-blue-900/20 border-blue-500/30" 
                : "bg-blue-100/50 border-blue-300/50"
            )}>
              <div className="flex items-start">
                <InfoIcon className={cn(
                  "h-5 w-5 mr-3 mt-0.5 flex-shrink-0",
                  isDark ? "text-blue-400" : "text-blue-600"
                )} />
                <div className="text-left">
                  <p className={cn(
                    "text-sm leading-relaxed",
                    isDark ? "text-blue-200" : "text-blue-800"
                  )}>
                    You&apos;ll be redirected to Uniswap with EMARK pre-selected. 
                    Connect your wallet there to complete the swap.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SwapPage(): React.ReactNode {
  const { isInFarcaster } = useFarcasterDetection();
  
  if (isInFarcaster) {
    return <FarcasterSwapInterface />;
  }
  
  return <BrowserSwapInterface />;
}