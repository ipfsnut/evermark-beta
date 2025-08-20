// src/pages/AboutPage.tsx - About page with contract addresses from .env
import React from 'react';
import { Link } from 'react-router-dom';
import { 
  ExternalLinkIcon, 
  BookOpenIcon, 
  GithubIcon,
  LinkIcon,
  CoinsIcon,
  VoteIcon,
  TrendingUpIcon
} from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';
import { cn } from '@/utils/responsive';

export default function AboutPage() {
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
    icon: React.ElementType;
  }) => (
    <div className={cn(
      "rounded-lg p-6 border transition-colors",
      isDark 
        ? "bg-gray-900 border-gray-800 hover:border-cyan-500/50"
        : "bg-white/90 border-yellow-200 hover:border-purple-400/50"
    )}>
      <div className="flex items-start gap-4">
        <div className={cn(
          "p-2 rounded-lg flex-shrink-0",
          isDark ? "bg-cyan-500/10" : "bg-purple-100/80"
        )}>
          <Icon className={cn(
            "w-5 h-5",
            isDark ? "text-cyan-400" : "text-purple-600"
          )} />
        </div>
        <div className="flex-1">
          <h3 className={cn(
            "text-lg font-semibold mb-2",
            isDark ? "text-white" : "text-gray-900"
          )}>{title}</h3>
          <p className={cn(
            "text-sm mb-4",
            isDark ? "text-gray-400" : "text-gray-600"
          )}>{description}</p>
          {address ? (
            <div className="space-y-2">
              <div className={cn(
                "font-mono text-xs p-2 rounded break-all",
                isDark 
                  ? "text-gray-300 bg-gray-800" 
                  : "text-gray-700 bg-yellow-100/50"
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
    <div className={cn(
      "min-h-screen transition-colors duration-200",
      isDark ? "bg-black text-white" : "bg-yellow-50 text-gray-900"
    )}>
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
            About
          </h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            On-chain content preservation and curation powered by community governance
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
              : "bg-white/90 border-yellow-200"
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
              Users can mint "Evermarks" - NFTs that permanently store important articles, research, 
              social media posts, and other digital content on IPFS and Base blockchain.
            </p>
            <p className={cn(
              "leading-relaxed",
              isDark ? "text-gray-300" : "text-gray-700"
            )}>
              Through community governance and staking mechanisms, the platform curates high-quality 
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
                : "bg-white/90 border-yellow-200"
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
                : "bg-white/90 border-yellow-200"
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
                Stake tokens to vote on content quality and participate in platform governance decisions.
              </p>
            </div>
            <div className={cn(
              "rounded-lg p-6 border",
              isDark 
                ? "bg-gray-900 border-gray-800" 
                : "bg-white/90 border-yellow-200"
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
              description="Main utility token for governance, rewards, and platform fees"
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
                  : "bg-white/90 border-yellow-200 hover:border-purple-400/50"
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
                    : "bg-white/90 border-yellow-200 hover:border-purple-400/50"
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
                    : "bg-white/90 border-yellow-200 hover:border-purple-400/50"
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
          isDark ? "border-gray-800" : "border-yellow-200"
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