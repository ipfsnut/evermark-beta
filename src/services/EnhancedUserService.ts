import { farcasterUserService, type AppFarcasterUser } from './FarcasterUserService';

// Export the service as both named and default for compatibility
export { EnhancedUserService as default };

// ENS Resolution (using a public resolver)
class ENSResolver {
  private static readonly ENS_RESOLVER_URL = 'https://api.ensideas.com/ens/resolve';
  private static cache = new Map<string, any>();

  static async resolveAddress(address: string): Promise<{
    name?: string;
    avatar?: string;
    description?: string;
    website?: string;
    twitter?: string;
    github?: string;
  } | null> {
    try {
      // Check cache first
      const cached = this.cache.get(address.toLowerCase());
      if (cached) return cached;

      // Try to resolve ENS name for this address
      const response = await fetch(`${this.ENS_RESOLVER_URL}/${address}`);
      if (!response.ok) return null;
      
      const data = await response.json();
      
      if (data.name) {
        const ensData = {
          name: data.name,
          avatar: data.avatar,
          description: data.description,
          website: data.website,
          twitter: data.twitter,
          github: data.github
        };
        
        // Cache for 10 minutes
        this.cache.set(address.toLowerCase(), ensData);
        setTimeout(() => this.cache.delete(address.toLowerCase()), 10 * 60 * 1000);
        
        return ensData;
      }
      
      return null;
    } catch (error) {
      console.warn('ENS resolution failed:', error);
      return null;
    }
  }

  static async resolveNameToAddress(name: string): Promise<string | null> {
    try {
      const response = await fetch(`${this.ENS_RESOLVER_URL}/name/${name}`);
      if (!response.ok) return null;
      
      const data = await response.json();
      return data.address ?? null;
    } catch (error) {
      console.warn('ENS name resolution failed:', error);
      return null;
    }
  }

  // Public method to get cache size for debugging
  static getCacheSize(): number {
    return this.cache.size;
  }

  // Public method to clear cache if needed
  static clearCache(): void {
    this.cache.clear();
  }
}

// Enhanced user type
export interface EnhancedUser {
  // Primary identity - THIS IS THE KEY FOR DISPLAY
  id: string;
  displayName: string; // Prioritized: Farcaster displayName → ENS name → wallet address
  avatar?: string;
  primaryAddress?: string;
  
  // Identity sources and scoring
  source: 'farcaster' | 'ens' | 'wallet' | 'hybrid';
  identityScore: number; // 0-100 based on verification
  
  // Farcaster profile (if available)
  farcaster?: {
    fid: number;
    username: string;
    displayName: string;
    pfpUrl: string;
    bio?: string;
    followerCount: number;
    followingCount: number;
    isVerified: boolean;
    hasPowerBadge: boolean;
    verifiedAddresses: string[];
  };
  
  // ENS profile (if available)
  ens?: {
    name: string;
    avatar?: string;
    description?: string;
    website?: string;
    twitter?: string;
    github?: string;
    resolvedAddress: string;
  };
  
  // Wallet info
  wallet?: {
    address: string;
    shortAddress: string;
    chainId?: number;
    walletType?: string;
  };
  
  // Metadata
  createdAt: string;
  updatedAt: string;
  lastSeenAt: string;
}

// Cache management
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

export class EnhancedUserService {
  private static userCache = new Map<string, CacheEntry<EnhancedUser>>();
  private static readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * PRIMARY METHOD: Get enhanced user by Farcaster FID
   */
  static async getUserByFarcasterFID(fid: number): Promise<EnhancedUser | null> {
    const cacheKey = `farcaster:${fid}`;
    
    // Check cache first
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      console.log('🔍 Fetching enhanced user for Farcaster FID:', fid);
      
      // Fetch Farcaster profile
      const farcasterUser = await farcasterUserService.fetchUserByFid(fid);
      if (!farcasterUser) {
        console.warn('No Farcaster user found for FID:', fid);
        return null;
      }

      // Start with Farcaster data
      let enhancedUser = this.createEnhancedUserFromFarcaster(farcasterUser);

      // Try to enhance with ENS if we have verified addresses
      if (farcasterUser.verifiedAddresses.length > 0) {
        const primaryAddress = farcasterUser.verifiedAddresses[0];
        const ensEnhanced = await this.enhanceWithENS(enhancedUser, primaryAddress);
        if (ensEnhanced) {
          enhancedUser = ensEnhanced;
        }
      }

      console.log('✅ Enhanced user created:', {
        displayName: enhancedUser.displayName,
        source: enhancedUser.source,
        identityScore: enhancedUser.identityScore
      });

      this.setCache(cacheKey, enhancedUser);
      return enhancedUser;

    } catch (error) {
      console.error('❌ Failed to get enhanced user by Farcaster FID:', error);
      return null;
    }
  }

  /**
   * PRIMARY METHOD: Get enhanced user by wallet address
   */
  static async getUserByAddress(address: string): Promise<EnhancedUser | null> {
    const cacheKey = `address:${address.toLowerCase()}`;
    
    // Check cache first
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      console.log('🔍 Fetching enhanced user for address:', address);

      // Start with basic wallet user
      let enhancedUser = this.createEnhancedUserFromWallet(address);

      // Try to enhance with ENS
      const ensEnhanced = await this.enhanceWithENS(enhancedUser, address);
      if (ensEnhanced) {
        enhancedUser = ensEnhanced;
      }

      // Farcaster profile lookup by address not yet implemented


      this.setCache(cacheKey, enhancedUser);
      return enhancedUser;

    } catch (error) {
      console.error('❌ Failed to get enhanced user by address:', error);
      return null;
    }
  }

  /**
   * Create enhanced user from Farcaster profile
   */
  private static createEnhancedUserFromFarcaster(farcasterUser: AppFarcasterUser): EnhancedUser {
    const now = new Date().toISOString();
    
    return {
      id: `farcaster:${farcasterUser.fid}`,
      displayName: farcasterUser.displayName, // PRIORITY 1: Farcaster display name
      avatar: farcasterUser.pfpUrl,
      primaryAddress: farcasterUser.verifiedAddresses[0],
      
      source: 'farcaster',
      identityScore: this.calculateIdentityScore({
        hasFarcaster: true,
        isVerified: farcasterUser.isVerified,
        hasPowerBadge: farcasterUser.hasPowerBadge,
        hasVerifiedAddress: farcasterUser.verifiedAddresses.length > 0,
        followerCount: farcasterUser.followerCount
      }),
      
      farcaster: {
        fid: farcasterUser.fid,
        username: farcasterUser.username,
        displayName: farcasterUser.displayName,
        pfpUrl: farcasterUser.pfpUrl,
        bio: farcasterUser.bio,
        followerCount: farcasterUser.followerCount,
        followingCount: farcasterUser.followingCount,
        isVerified: farcasterUser.isVerified,
        hasPowerBadge: farcasterUser.hasPowerBadge,
        verifiedAddresses: farcasterUser.verifiedAddresses
      },
      
      wallet: farcasterUser.verifiedAddresses[0] ? {
        address: farcasterUser.verifiedAddresses[0],
        shortAddress: this.formatAddress(farcasterUser.verifiedAddresses[0])
      } : undefined,
      
      createdAt: now,
      updatedAt: now,
      lastSeenAt: now
    };
  }

  /**
   * Create enhanced user from wallet address only
   */
  private static createEnhancedUserFromWallet(address: string): EnhancedUser {
    const now = new Date().toISOString();
    const shortAddress = this.formatAddress(address);
    
    return {
      id: `wallet:${address.toLowerCase()}`,
      displayName: shortAddress, // PRIORITY 3: Wallet address as fallback
      primaryAddress: address,
      
      source: 'wallet',
      identityScore: this.calculateIdentityScore({
        hasWallet: true
      }),
      
      wallet: {
        address,
        shortAddress
      },
      
      createdAt: now,
      updatedAt: now,
      lastSeenAt: now
    };
  }

  /**
   * Enhance user with ENS data (REAL ENS RESOLUTION)
   */
  private static async enhanceWithENS(user: EnhancedUser, address: string): Promise<EnhancedUser | null> {
    try {
      console.log('🔍 Attempting ENS resolution for:', address);
      
      const ensData = await ENSResolver.resolveAddress(address);
      if (!ensData?.name) {
        console.log('No ENS name found for address');
        return null;
      }

      console.log('✅ ENS resolved:', ensData.name);

      // Determine new display name priority: Farcaster > ENS > Wallet
      let newDisplayName = user.displayName;
      let newAvatar = user.avatar;
      let newSource = user.source;

      if (!user.farcaster) {
        // If no Farcaster, ENS name becomes primary display name
        newDisplayName = ensData.name; // PRIORITY 2: ENS name
        newAvatar = ensData.avatar ?? user.avatar;
        newSource = 'ens';
      } else {
        // If we have Farcaster, it stays primary but we note it's hybrid
        newSource = 'hybrid';
      }

      return {
        ...user,
        displayName: newDisplayName,
        avatar: newAvatar,
        source: newSource as 'farcaster' | 'ens' | 'wallet' | 'hybrid',
        identityScore: this.calculateIdentityScore({
          ...this.getScoreFactors(user),
          hasENS: true
        }),
        ens: {
          name: ensData.name,
          avatar: ensData.avatar,
          description: ensData.description,
          website: ensData.website,
          twitter: ensData.twitter,
          github: ensData.github,
          resolvedAddress: address
        }
      };

    } catch (error) {
      console.warn('ENS enhancement failed:', error);
      return null;
    }
  }

  /**
   * Calculate identity score based on various factors
   */
  private static calculateIdentityScore(factors: {
    hasFarcaster?: boolean;
    hasENS?: boolean;
    hasWallet?: boolean;
    isVerified?: boolean;
    hasPowerBadge?: boolean;
    hasVerifiedAddress?: boolean;
    followerCount?: number;
  }): number {
    let score = 0;
    
    // Base identity scores
    if (factors.hasFarcaster) score += 30;
    if (factors.hasENS) score += 25;
    if (factors.hasWallet) score += 10;
    
    // Verification bonuses
    if (factors.isVerified) score += 20;
    if (factors.hasPowerBadge) score += 15;
    if (factors.hasVerifiedAddress) score += 10;
    
    // Social signals
    if (factors.followerCount) {
      if (factors.followerCount > 1000) score += 10;
      else if (factors.followerCount > 100) score += 5;
    }
    
    return Math.min(100, score);
  }

  /**
   * Cache management
   */
  private static setCache(key: string, user: EnhancedUser): void {
    const now = Date.now();
    this.userCache.set(key, {
      data: user,
      timestamp: now,
      expiresAt: now + this.CACHE_TTL
    });
  }

  private static getFromCache(key: string): EnhancedUser | null {
    const entry = this.userCache.get(key);
    if (!entry || Date.now() > entry.expiresAt) {
      this.userCache.delete(key);
      return null;
    }
    return entry.data;
  }

  static clearCache(): void {
    this.userCache.clear();
    console.log('🧹 Enhanced user cache cleared');
  }

  /**
   * Utilities
   */
  private static formatAddress(address: string): string {
    if (!address) return 'Unknown';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  private static getScoreFactors(user: EnhancedUser) {
    return {
      hasFarcaster: !!user.farcaster,
      hasENS: !!user.ens,
      hasWallet: !!user.wallet,
      isVerified: user.farcaster?.isVerified ?? false,
      hasPowerBadge: user.farcaster?.hasPowerBadge ?? false,
      hasVerifiedAddress: (user.farcaster?.verifiedAddresses.length ?? 0) > 0,
      followerCount: user.farcaster?.followerCount ?? 0
    };
  }

  /**
   * Debug and stats
   */
  static getStats() {
    return {
      cacheSize: this.userCache.size,
      cacheKeys: Array.from(this.userCache.keys()),
      ensResolverCacheSize: ENSResolver.getCacheSize()
    };
  }

  /**
   * Utility method to get display name with fallback priority
   */
  static getDisplayName(user: EnhancedUser | null): string {
    if (!user) return 'Anonymous';
    
    // Priority: Farcaster displayName → ENS name → wallet address
    if (user.farcaster?.displayName) return user.farcaster.displayName;
    if (user.ens?.name) return user.ens.name;
    if (user.wallet?.shortAddress) return user.wallet.shortAddress;
    
    return user.displayName ?? 'Unknown User';
  }
}