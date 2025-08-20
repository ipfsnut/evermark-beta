// src/pages/SwapPage.tsx - Token swap interface (stub)
import React from 'react';
import { ArrowUpDownIcon, InfoIcon, ZapIcon } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';
import { cn } from '@/utils/responsive';

export default function SwapPage() {
  const { isDark } = useTheme();

  return (
    <div className={cn(
      "min-h-screen transition-colors duration-200",
      isDark ? "bg-black text-white" : "bg-yellow-50 text-gray-900"
    )}>
      {/* Header */}
      <div className={cn(
        "border-b border-purple-400/30",
        isDark 
          ? "bg-gradient-to-r from-gray-900 via-black to-gray-900" 
          : "bg-gradient-to-r from-yellow-100 via-yellow-50 to-yellow-100"
      )}>
        <div className="container mx-auto px-4 py-8">
          <div className="text-center space-y-6">
            <div className="flex justify-center items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-r from-green-400 to-blue-500 rounded-full flex items-center justify-center shadow-lg shadow-green-500/50">
                <ArrowUpDownIcon className="h-7 w-7 text-black" />
              </div>
              <h1 className="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-green-400 via-blue-400 to-purple-500 bg-clip-text text-transparent">
                TOKEN SWAP <span className="text-2xl md:text-3xl text-cyan-400 font-normal">[COMING SOON]</span>
              </h1>
            </div>
            
            <p className={cn(
              "max-w-3xl mx-auto text-lg",
              isDark ? "text-gray-300" : "text-gray-700"
            )}>
              Seamlessly swap between EMARK and other tokens on Base network with optimal rates and low fees.
            </p>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          {/* Coming Soon Card */}
          <div className={cn(
            "rounded-lg p-8 border text-center",
            isDark 
              ? "bg-gray-800/50 border-gray-700" 
              : "bg-white/90 border-yellow-200"
          )}>
            <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-r from-green-400 to-blue-500 rounded-full flex items-center justify-center">
              <ZapIcon className="h-12 w-12 text-black" />
            </div>
            
            <h2 className={cn(
              "text-2xl font-bold mb-4",
              isDark ? "text-white" : "text-gray-900"
            )}>
              Swap Feature Coming Soon
            </h2>
            
            <p className={cn(
              "text-lg mb-6 leading-relaxed",
              isDark ? "text-gray-300" : "text-gray-700"
            )}>
              We're building a powerful token swap interface that will allow you to easily exchange EMARK tokens 
              and interact with DeFi protocols on Base network.
            </p>

            {/* Feature Preview */}
            <div className="space-y-4 mb-8">
              <div className={cn(
                "p-4 rounded-lg border",
                isDark 
                  ? "bg-gray-700/30 border-gray-600" 
                  : "bg-yellow-100/50 border-yellow-300"
              )}>
                <h3 className={cn(
                  "font-semibold mb-2",
                  isDark ? "text-white" : "text-gray-900"
                )}>
                  Planned Features:
                </h3>
                <ul className={cn(
                  "text-left space-y-2",
                  isDark ? "text-gray-300" : "text-gray-700"
                )}>
                  <li className="flex items-center">
                    <span className="w-2 h-2 bg-green-400 rounded-full mr-3"></span>
                    Swap EMARK ↔ ETH, USDC, and other Base tokens
                  </li>
                  <li className="flex items-center">
                    <span className="w-2 h-2 bg-blue-400 rounded-full mr-3"></span>
                    Real-time price quotes and slippage protection
                  </li>
                  <li className="flex items-center">
                    <span className="w-2 h-2 bg-purple-400 rounded-full mr-3"></span>
                    Integration with popular DEX aggregators
                  </li>
                  <li className="flex items-center">
                    <span className="w-2 h-2 bg-cyan-400 rounded-full mr-3"></span>
                    Gas-optimized transactions and MEV protection
                  </li>
                </ul>
              </div>
            </div>

            <div className={cn(
              "p-4 rounded-lg border",
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
                    <strong>Stay tuned!</strong> The swap feature is currently in development. 
                    Follow our updates for the latest progress and launch timeline.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Current Alternative */}
          <div className={cn(
            "mt-8 p-6 rounded-lg border",
            isDark 
              ? "bg-gray-800/30 border-gray-700" 
              : "bg-white/60 border-yellow-200"
          )}>
            <h3 className={cn(
              "text-lg font-semibold mb-3",
              isDark ? "text-white" : "text-gray-900"
            )}>
              For Now: External DEX Options
            </h3>
            <p className={cn(
              "text-sm mb-4",
              isDark ? "text-gray-400" : "text-gray-600"
            )}>
              While we build our integrated swap feature, you can trade EMARK tokens on these platforms:
            </p>
            <div className="space-y-2">
              <a
                href="https://app.uniswap.org/"
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "block p-3 rounded-lg border transition-colors",
                  isDark 
                    ? "bg-gray-700/30 border-gray-600 hover:border-purple-400/50 text-purple-400 hover:text-purple-300" 
                    : "bg-yellow-50 border-yellow-300 hover:border-purple-400/50 text-purple-600 hover:text-purple-500"
                )}
              >
                <span className="font-medium">Uniswap V3</span>
                <span className={cn(
                  "block text-xs mt-1",
                  isDark ? "text-gray-400" : "text-gray-600"
                )}>
                  Leading DEX on Base network
                </span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}