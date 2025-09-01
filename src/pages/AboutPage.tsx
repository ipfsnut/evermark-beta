// src/pages/AboutPage.tsx - About page with contract addresses from .env
import React from 'react';
import { Link as _Link } from 'react-router-dom';
import { 
  ExternalLinkIcon, 
  BookOpenIcon, 
  GithubIcon,
  LinkIcon,
  CoinsIcon,
  VoteIcon,
  TrendingUpIcon
} from 'lucide-react';
import { themeClasses, cn } from '@/utils/theme';
import { useTheme } from '@/providers/ThemeProvider';

export default function AboutPage(): React.ReactNode {
  const { isDark } = useTheme();
  
  // Get contract addresses from environment variables
  const contracts = {
    emark: import.meta.env.VITE_EMARK_ADDRESS,
    wemark: import.meta.env.VITE_WEMARK_ADDRESS,  
    evermarkNFT: import.meta.env.VITE_EVERMARK_NFT_ADDRESS,
    evermarkVoting: import.meta.env.VITE_EVERMARK_VOTING_ADDRESS,
    nftStaking: import.meta.env.VITE_NFT_STAKING_ADDRESS,
    evermarkRewards: import.meta.env.VITE_EVERMARK_REWARDS_ADDRESS,
    marketplace: import.meta.env.VITE_MARKETPLACE_ADDRESS,
    feeCollector: import.meta.env.VITE_FEE_COLLECTOR_ADDRESS
  };

  const chainId = import.meta.env.VITE_CHAIN_ID || '8453';
  const baseScanUrl = 'https://basescan.org';

  const ContractCard = ({ 
    title, 
    address, 
    description, 
    icon: Icon 
  }: { 
    title: string; 
    address: string | undefined; 
    description: string; 
    icon: React.ComponentType<{ className?: string }>;
  }) => (
    <div className={cn(
      "rounded-lg p-6 border transition-colors",
      isDark 
        ? "bg-gray-900 border-gray-800 hover:border-cyan-500/50"
        : "bg-app-bg-card border-app-border hover:border-app-border-hover"
    )}>
      <div className="flex items-start gap-4">
        <div className={themeClasses.iconContainer}>
          <Icon className={themeClasses.iconPrimary} />
        </div>
        <div className="flex-1">
          <h3 className={themeClasses.heading}>{title}</h3>
          <p className={themeClasses.description}>{description}</p>
          {address ? (
            <div className="space-y-2">
              <div className={cn(
                "font-mono text-xs p-2 rounded break-all",
                isDark 
                  ? "text-gray-300 bg-gray-800" 
                  : "text-app-text-on-card bg-app-bg-secondary"
              )}>
                {address}
              </div>
              <a
                href={`${baseScanUrl}/address/${address}`}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "inline-flex items-center gap-2 text-sm transition-colors",
                  isDark 
                    ? "text-cyan-400 hover:text-cyan-300" 
                    : "text-purple-600 hover:text-purple-500"
                )}
              >
                View on BaseScan <ExternalLinkIcon className="w-3 h-3" />
              </a>
            </div>
          ) : (
            <div className={cn(
              "text-sm",
              isDark ? "text-gray-500" : "text-gray-400"
            )}>Not configured</div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className={themeClasses.page}>
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className={`${themeClasses.headingLarge} mb-4`}>
            About
          </h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            On-chain content preservation and curation powered by community voting
          </p>
        </div>

        {/* Overview */}
        <div className="mb-12">
          <h2 className={cn(
            "text-2xl font-semibold mb-6",
            isDark ? "text-white" : "text-gray-900"
          )}>What is Evermark?</h2>
          <div className={cn(
            "rounded-lg p-6 border",
            isDark 
              ? "bg-gray-900 border-gray-800" 
              : "bg-app-bg-card border-app-border"
          )}>
            <div className={cn(
              "border rounded-lg p-4 mb-6",
              isDark 
                ? "bg-cyan-500/10 border-cyan-500/30" 
                : "bg-purple-100/50 border-purple-300/50"
            )}>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">🧪</span>
                <h3 className={cn(
                  "text-lg font-semibold",
                  isDark ? "text-cyan-400" : "text-purple-700"
                )}>Beta Version</h3>
              </div>
              <p className={cn(
                "text-sm leading-relaxed",
                isDark ? "text-cyan-200" : "text-purple-800"
              )}>
                You are currently using <strong>Evermark Beta</strong>. This is a testing version of the protocol 
                running on Base blockchain. Features may be limited, and data from this beta may not carry 
                over to the full production release. Thank you for helping us test and improve the platform!
              </p>
            </div>
            
            <p className={cn(
              "leading-relaxed mb-4",
              isDark ? "text-gray-300" : "text-gray-700"
            )}>
              Evermark is a decentralized platform for preserving valuable content on the blockchain. 
              Users can mint &quot;Evermarks&quot; - NFTs that permanently store important articles, research, 
              social media posts, and other digital content on IPFS and Base blockchain.
            </p>
            <p className={cn(
              "leading-relaxed",
              isDark ? "text-gray-300" : "text-gray-700"
            )}>
              Through community voting and staking mechanisms, the platform curates high-quality 
              content while rewarding contributors and voters who help surface the most valuable information.
            </p>
          </div>
        </div>

        {/* Key Features */}
        <div className="mb-12">
          <h2 className={cn(
            "text-2xl font-semibold mb-6",
            isDark ? "text-white" : "text-gray-900"
          )}>Key Features</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className={cn(
              "rounded-lg p-6 border",
              isDark 
                ? "bg-gray-900 border-gray-800" 
                : "bg-app-bg-card border-app-border"
            )}>
              <BookOpenIcon className={cn(
                "w-8 h-8 mb-4",
                isDark ? "text-cyan-400" : "text-purple-600"
              )} />
              <h3 className={cn(
                "text-lg font-semibold mb-2",
                isDark ? "text-white" : "text-gray-900"
              )}>Content Preservation</h3>
              <p className={cn(
                "text-sm",
                isDark ? "text-gray-400" : "text-gray-600"
              )}>
                Permanently store content on IPFS with blockchain provenance and tamper-proof metadata.
              </p>
            </div>
            <div className={cn(
              "rounded-lg p-6 border",
              isDark 
                ? "bg-gray-900 border-gray-800" 
                : "bg-app-bg-card border-app-border"
            )}>
              <VoteIcon className={cn(
                "w-8 h-8 mb-4",
                isDark ? "text-purple-400" : "text-green-600"
              )} />
              <h3 className={cn(
                "text-lg font-semibold mb-2",
                isDark ? "text-white" : "text-gray-900"
              )}>Community Governance</h3>
              <p className={cn(
                "text-sm",
                isDark ? "text-gray-400" : "text-gray-600"
              )}>
                Stake tokens to vote on content quality and participate in content curation.
              </p>
            </div>
            <div className={cn(
              "rounded-lg p-6 border",
              isDark 
                ? "bg-gray-900 border-gray-800" 
                : "bg-app-bg-card border-app-border"
            )}>
              <TrendingUpIcon className={cn(
                "w-8 h-8 mb-4",
                isDark ? "text-green-400" : "text-cyan-600"
              )} />
              <h3 className={cn(
                "text-lg font-semibold mb-2",
                isDark ? "text-white" : "text-gray-900"
              )}>Quality Curation</h3>
              <p className={cn(
                "text-sm",
                isDark ? "text-gray-400" : "text-gray-600"
              )}>
                Leaderboards surface the highest-quality content based on community votes and engagement.
              </p>
            </div>
          </div>
        </div>

        {/* Smart Contracts */}
        <div className="mb-12">
          <h2 className={cn(
            "text-2xl font-semibold mb-6",
            isDark ? "text-white" : "text-gray-900"
          )}>Smart Contracts</h2>
          <p className={cn(
            "mb-6",
            isDark ? "text-gray-300" : "text-gray-700"
          )}>
            Evermark Beta runs on Base (Chain ID: {chainId}). Below are the core smart contracts:
          </p>
          
          <div className="grid gap-6">
            <ContractCard
              title="$EMARK Token"
              address={contracts.emark}
              description="Main utility token for content curation, rewards, and platform fees"
              icon={CoinsIcon}
            />
            
            <ContractCard
              title="WEMARK (Wrapped EMARK)"
              address={contracts.wemark}
              description="Wrapped version of EMARK used for staking and voting power"
              icon={LinkIcon}
            />
            
            <ContractCard
              title="Evermark NFT"
              address={contracts.evermarkNFT}
              description="NFT contract for minting Evermarks with IPFS metadata"
              icon={BookOpenIcon}
            />
            
            <ContractCard
              title="Evermark Voting"
              address={contracts.evermarkVoting}
              description="Governance contract for community voting on content quality"
              icon={VoteIcon}
            />
            
            <ContractCard
              title="NFT Staking"
              address={contracts.nftStaking}
              description="Staking mechanism for earning voting power and rewards"
              icon={TrendingUpIcon}
            />
            
            <ContractCard
              title="Evermark Rewards"
              address={contracts.evermarkRewards}
              description="Distribution of rewards to active community members"
              icon={CoinsIcon}
            />
          </div>
        </div>

        {/* Links */}
        <div className="mb-12">
          <h2 className={cn(
            "text-2xl font-semibold mb-6",
            isDark ? "text-white" : "text-gray-900"
          )}>Learn More</h2>
          <div className="grid gap-6">
            <a
              href="/docs"
              className={cn(
                "rounded-lg p-6 border transition-colors group",
                isDark 
                  ? "bg-gray-900 border-gray-800 hover:border-cyan-500/50"
                  : "bg-app-bg-card border-app-border hover:border-app-border-hover"
              )}
            >
              <div className="flex items-center gap-4">
                <BookOpenIcon className={cn(
                  "w-8 h-8",
                  isDark ? "text-cyan-400" : "text-purple-600"
                )} />
                <div>
                  <h3 className={cn(
                    "text-lg font-semibold transition-colors",
                    isDark 
                      ? "text-white group-hover:text-cyan-400" 
                      : "text-gray-900 group-hover:text-purple-600"
                  )}>
                    Documentation
                  </h3>
                  <p className={cn(
                    "text-sm",
                    isDark ? "text-gray-400" : "text-gray-600"
                  )}>
                    Complete guide to using Evermark
                  </p>
                </div>
              </div>
            </a>
            
            <div className="grid md:grid-cols-2 gap-6">
              <a
                href="https://github.com/ipfsnut/evermark-beta"
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "rounded-lg p-6 border transition-colors group",
                  isDark 
                    ? "bg-gray-900 border-gray-800 hover:border-cyan-500/50"
                    : "bg-app-bg-card border-app-border hover:border-app-border-hover"
                )}
              >
                <div className="flex items-center gap-4">
                  <GithubIcon className={cn(
                    "w-8 h-8",
                    isDark ? "text-cyan-400" : "text-purple-600"
                  )} />
                  <div>
                    <h3 className={cn(
                      "text-lg font-semibold transition-colors",
                      isDark 
                        ? "text-white group-hover:text-cyan-400" 
                        : "text-gray-900 group-hover:text-purple-600"
                    )}>
                      Frontend Repository
                    </h3>
                    <p className={cn(
                      "text-sm",
                      isDark ? "text-gray-400" : "text-gray-600"
                    )}>
                      Evermark Beta web application
                    </p>
                  </div>
                </div>
              </a>
              
              <a
                href="https://github.com/ipfsnut/evermark-contracts"
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "rounded-lg p-6 border transition-colors group",
                  isDark 
                    ? "bg-gray-900 border-gray-800 hover:border-cyan-500/50"
                    : "bg-app-bg-card border-app-border hover:border-app-border-hover"
                )}
              >
                <div className="flex items-center gap-4">
                  <GithubIcon className={cn(
                    "w-8 h-8",
                    isDark ? "text-cyan-400" : "text-purple-600"
                  )} />
                  <div>
                    <h3 className={cn(
                      "text-lg font-semibold transition-colors",
                      isDark 
                        ? "text-white group-hover:text-cyan-400" 
                        : "text-gray-900 group-hover:text-purple-600"
                    )}>
                      Smart Contracts
                    </h3>
                    <p className={cn(
                      "text-sm",
                      isDark ? "text-gray-400" : "text-gray-600"
                    )}>
                      Evermark protocol smart contracts
                    </p>
                  </div>
                </div>
              </a>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={cn(
          "text-center pt-8 border-t",
          isDark ? "border-gray-800" : "border-app-border"
        )}>
          <p className={cn(
            "text-sm",
            isDark ? "text-gray-400" : "text-gray-600"
          )}>
            Evermark Beta - Built on Base blockchain with ❤️ by the community
          </p>
        </div>
      </div>
    </div>
  );
}