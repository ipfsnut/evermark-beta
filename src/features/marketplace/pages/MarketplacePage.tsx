// Marketplace page for trading Evermark NFTs
import React from 'react';
import { useMarketplaceState } from '../hooks/useMarketplaceState';
import { getMarketplaceExplorerUrl } from '../services/MarketplaceService';

export default function MarketplacePage() {
  const {
    activeTab,
    setActiveTab,
    listings,
    userListings,
    stats,
    isLoadingListings,
    isLoadingUserListings,
    isLoadingStats,
    isConnected,
    hasListings,
    hasUserListings,
  } = useMarketplaceState();

  const tabs = [
    { id: 'browse' as const, label: 'Browse', icon: '🛍️' },
    { id: 'my-listings' as const, label: 'My Listings', icon: '📝', requireAuth: true },
    { id: 'my-purchases' as const, label: 'My Purchases', icon: '🎯', requireAuth: true },
    { id: 'activity' as const, label: 'Activity', icon: '📊' },
  ];

  const filteredTabs = tabs.filter(tab => !tab.requireAuth || isConnected);

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Evermark Marketplace</h1>
        <p className="text-gray-400 mb-4">
          Trade Evermark NFTs with a 1% transaction fee. Revenue funds leaderboard rewards.
        </p>
        
        {/* Stats Row */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <div className="text-sm text-gray-400">Total Volume</div>
              <div className="text-lg font-bold text-white">{stats.totalVolume} ETH</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <div className="text-sm text-gray-400">Floor Price</div>
              <div className="text-lg font-bold text-white">{stats.floorPrice} ETH</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <div className="text-sm text-gray-400">Total Sales</div>
              <div className="text-lg font-bold text-white">{stats.totalSales.toLocaleString()}</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <div className="text-sm text-gray-400">Active Listings</div>
              <div className="text-lg font-bold text-white">{stats.activeListings}</div>
            </div>
          </div>
        )}

        {/* Quick Link to Contract */}
        <div className="mb-6">
          <a
            href={getMarketplaceExplorerUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center space-x-2 text-cyber-primary hover:text-cyber-secondary transition-colors"
          >
            <span>View Marketplace Contract on BaseScan</span>
            <span>→</span>
          </a>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-1 mb-8 bg-gray-800 rounded-lg p-1">
        {filteredTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              flex items-center space-x-2 px-4 py-2 rounded-md transition-colors flex-1 justify-center
              ${activeTab === tab.id
                ? 'bg-cyber-primary text-black font-medium'
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
              }
            `}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="min-h-96">
        {activeTab === 'browse' && (
          <div>
            <h2 className="text-xl font-semibold text-white mb-4">Browse Listings</h2>
            {isLoadingListings ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyber-primary mx-auto mb-4"></div>
                <p className="text-gray-400">Loading marketplace listings...</p>
              </div>
            ) : hasListings ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {listings.map((listing) => (
                  <div key={listing.listingId} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                    <div className="text-white font-medium mb-2">Evermark #{listing.tokenId}</div>
                    <div className="text-cyber-primary text-lg font-bold mb-2">{listing.price} ETH</div>
                    <div className="text-gray-400 text-sm mb-4">by {listing.seller.slice(0, 6)}...{listing.seller.slice(-4)}</div>
                    <button className="w-full bg-cyber-primary text-black py-2 rounded-md hover:bg-opacity-90 transition-colors">
                      Buy Now
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">🛍️</div>
                <h3 className="text-xl font-semibold text-white mb-2">No listings yet</h3>
                <p className="text-gray-400">Be the first to list an Evermark NFT for sale!</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'my-listings' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-white">My Listings</h2>
              <button className="bg-cyber-primary text-black px-4 py-2 rounded-md hover:bg-opacity-90 transition-colors">
                Create Listing
              </button>
            </div>
            
            {!isConnected ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">🔐</div>
                <h3 className="text-xl font-semibold text-white mb-2">Connect Your Wallet</h3>
                <p className="text-gray-400">Connect your wallet to view and manage your listings.</p>
              </div>
            ) : isLoadingUserListings ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyber-primary mx-auto mb-4"></div>
                <p className="text-gray-400">Loading your listings...</p>
              </div>
            ) : hasUserListings ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {userListings.map((listing) => (
                  <div key={listing.listingId} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                    <div className="text-white font-medium mb-2">Evermark #{listing.tokenId}</div>
                    <div className="text-cyber-primary text-lg font-bold mb-2">{listing.price} ETH</div>
                    <div className={`text-sm mb-4 ${listing.isActive ? 'text-green-400' : 'text-red-400'}`}>
                      {listing.isActive ? 'Active' : 'Inactive'}
                    </div>
                    <button className="w-full bg-red-600 text-white py-2 rounded-md hover:bg-red-700 transition-colors">
                      Cancel Listing
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">📝</div>
                <h3 className="text-xl font-semibold text-white mb-2">No active listings</h3>
                <p className="text-gray-400">Create your first listing to start selling your Evermarks.</p>
              </div>
            )}
          </div>
        )}

        {(activeTab === 'my-purchases' || activeTab === 'activity') && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🚧</div>
            <h3 className="text-xl font-semibold text-white mb-2">Coming Soon</h3>
            <p className="text-gray-400">This feature is currently under development.</p>
          </div>
        )}
      </div>

      {/* Revenue Information */}
      <div className="mt-12 bg-blue-900/20 border border-blue-500/30 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-300 mb-2">💰 Revenue Distribution</h3>
        <p className="text-blue-200 text-sm">
          Trading fees (1% of transaction value) fund rewards for top-performing Evermarks on the leaderboard, 
          creating additional incentives for quality content creation and community engagement.
        </p>
      </div>
    </div>
  );
}