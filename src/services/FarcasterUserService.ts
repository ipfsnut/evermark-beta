// src/services/FarcasterUserService.ts
// Service to fetch and manage Farcaster user data

import { neynarClient, NeynarAPIError } from '../lib/neynar/neynarClient';
import { 
  mapNeynarUserToApp, 
  mapNeynarCastToApp,
  type AppFarcasterUser,  // Import from the correct location
  type AppFarcasterCast,  // Import from the correct location
  type NeynarUser,
  type NeynarCast
} from '../lib/neynar/neynarTypes';

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

export class FarcasterUserCache {
  private userCache = new Map<number, CacheEntry<AppFarcasterUser>>();
  private usernameToFidCache = new Map<string, number>();
  private castCache = new Map<string, CacheEntry<AppFarcasterCast>>();
  
  private readonly USER_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly CAST_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

  setUser(fid: number, user: AppFarcasterUser): void {
    const now = Date.now();
    this.userCache.set(fid, {
      data: user,
      timestamp: now,
      expiresAt: now + this.USER_CACHE_TTL
    });
    
    // Also cache username -> fid mapping
    this.usernameToFidCache.set(user.username.toLowerCase(), fid);
  }

  getUser(fid: number): AppFarcasterUser | null {
    const entry = this.userCache.get(fid);
    if (!entry || Date.now() > entry.expiresAt) {
      this.userCache.delete(fid);
      return null;
    }
    return entry.data;
  }

  getFidByUsername(username: string): number | null {
    return this.usernameToFidCache.get(username.toLowerCase()) || null;
  }

  setCast(hash: string, cast: AppFarcasterCast): void {
    const now = Date.now();
    this.castCache.set(hash, {
      data: cast,
      timestamp: now,
      expiresAt: now + this.CAST_CACHE_TTL
    });
  }

  getCast(hash: string): AppFarcasterCast | null {
    const entry = this.castCache.get(hash);
    if (!entry || Date.now() > entry.expiresAt) {
      this.castCache.delete(hash);
      return null;
    }
    return entry.data;
  }

  clear(): void {
    this.userCache.clear();
    this.usernameToFidCache.clear();
    this.castCache.clear();
  }

  getStats() {
    return {
      users: this.userCache.size,
      usernames: this.usernameToFidCache.size,
      casts: this.castCache.size
    };
  }
}

export class FarcasterUserService {
  private cache = new FarcasterUserCache();
  private isOffline = false;

  constructor() {
    // Listen for online/offline events
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.isOffline = false;
        console.log('🟢 Farcaster service back online');
      });
      
      window.addEventListener('offline', () => {
        this.isOffline = true;
        console.log('🔴 Farcaster service offline - using cache only');
      });
    }
  }

  /**
   * Fetch user by FID with caching
   */
  async fetchUserByFid(fid: number): Promise<AppFarcasterUser | null> {
    try {
      // Check cache first
      const cached = this.cache.getUser(fid);
      if (cached) {
        return cached;
      }

      // If offline, return null
      if (this.isOffline) {
        console.warn(`Cannot fetch user ${fid} - offline`);
        return null;
      }

      // Check if Neynar is configured
      if (!neynarClient.isConfigured()) {
        console.warn('Neynar client not configured - cannot fetch user data');
        return null;
      }

      // Fetch from API
      const response = await neynarClient.getUserByFid(fid);
      
      if (response.users && response.users.length > 0) {
        const neynarUser: NeynarUser = response.users[0];
        const appUser = mapNeynarUserToApp(neynarUser);
        
        // Cache the result
        this.cache.setUser(fid, appUser);
        
        return appUser;
      }

      return null;
    } catch (error) {
      console.error(`Failed to fetch user ${fid}:`, error);
      
      // If it's a rate limit error, don't spam retries
      if (error instanceof NeynarAPIError && error.status === 429) {
        console.warn('Rate limited - using cache only for now');
      }
      
      return null;
    }
  }

  /**
   * Fetch user by username with caching
   */
  async fetchUserByUsername(username: string): Promise<AppFarcasterUser | null> {
    try {
      // Check if we have FID cached for this username
      const cachedFid = this.cache.getFidByUsername(username);
      if (cachedFid) {
        return this.fetchUserByFid(cachedFid);
      }

      // If offline, return null
      if (this.isOffline) {
        console.warn(`Cannot fetch user ${username} - offline`);
        return null;
      }

      // Check if Neynar is configured
      if (!neynarClient.isConfigured()) {
        console.warn('Neynar client not configured - cannot fetch user data');
        return null;
      }

      // Fetch from API
      const response = await neynarClient.getUserByUsername(username);
      
      if (response.user) {
        const neynarUser: NeynarUser = response.user;
        const appUser = mapNeynarUserToApp(neynarUser);
        
        // Cache the result
        this.cache.setUser(appUser.fid, appUser);
        
        return appUser;
      }

      return null;
    } catch (error) {
      console.error(`Failed to fetch user ${username}:`, error);
      return null;
    }
  }

  /**
   * Fetch multiple users efficiently
   */
  async fetchUsersBatch(fids: number[]): Promise<AppFarcasterUser[]> {
    try {
      const results: AppFarcasterUser[] = [];
      const uncachedFids: number[] = [];

      // Check cache for each FID
      for (const fid of fids) {
        const cached = this.cache.getUser(fid);
        if (cached) {
          results.push(cached);
        } else {
          uncachedFids.push(fid);
        }
      }

      // If all were cached or we're offline, return what we have
      if (uncachedFids.length === 0 || this.isOffline) {
        return results;
      }

      // Check if Neynar is configured
      if (!neynarClient.isConfigured()) {
        return results;
      }

      // Fetch uncached users in batch
      const response = await neynarClient.getUserBatch(uncachedFids);
      
      if (response.users) {
        for (const neynarUser of response.users) {
          const appUser = mapNeynarUserToApp(neynarUser);
          this.cache.setUser(appUser.fid, appUser);
          results.push(appUser);
        }
      }

      return results;
    } catch (error) {
      console.error('Failed to fetch users batch:', error);
      return [];
    }
  }

  /**
   * Fetch cast by hash with caching
   */
  async fetchCastByHash(hash: string): Promise<AppFarcasterCast | null> {
    try {
      // Check cache first
      const cached = this.cache.getCast(hash);
      if (cached) {
        return cached;
      }

      // If offline, return null
      if (this.isOffline) {
        console.warn(`Cannot fetch cast ${hash} - offline`);
        return null;
      }

      // Check if Neynar is configured
      if (!neynarClient.isConfigured()) {
        console.warn('Neynar client not configured - cannot fetch cast data');
        return null;
      }

      // Fetch from API
      const response = await neynarClient.getCastByHash(hash);
      
      if (response.cast) {
        const neynarCast: NeynarCast = response.cast;
        const appCast = mapNeynarCastToApp(neynarCast);
        
        // Cache the result
        this.cache.setCast(hash, appCast);
        
        // Also cache the author
        this.cache.setUser(appCast.author.fid, appCast.author);
        
        return appCast;
      }

      return null;
    } catch (error) {
      console.error(`Failed to fetch cast ${hash}:`, error);
      return null;
    }
  }

  /**
   * Extract cast hash from Farcaster URL
   */
  extractCastHashFromUrl(url: string): string | null {
    try {
      // Pattern matching for different Farcaster clients
      const patterns = [
        /warpcast\.com\/[^\/]+\/(0x[a-fA-F0-9]+)/,
        /farcaster\.xyz\/[^\/]+\/(0x[a-fA-F0-9]+)/, 
        /supercast\.xyz\/[^\/]+\/(0x[a-fA-F0-9]+)/,
        /cast\.k3l\.io\/[^\/]+\/(0x[a-fA-F0-9]+)/
      ];

      for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) {
          return match[1];
        }
      }

      // If it's already just a hash
      if (/^0x[a-fA-F0-9]{8,64}$/.test(url)) {
        return url;
      }

      return null;
    } catch (error) {
      console.error('Failed to extract cast hash from URL:', error);
      return null;
    }
  }

  /**
   * Validate FID format
   */
  isValidFid(fid: any): fid is number {
    return typeof fid === 'number' && fid > 0 && fid < 1000000000;
  }

  /**
   * Validate username format
   */
  isValidUsername(username: string): boolean {
    return /^[a-zA-Z0-9_-]{1,16}$/.test(username);
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      isOnline: !this.isOffline,
      neynarConfigured: neynarClient.isConfigured(),
      rateLimitStatus: neynarClient.getRateLimitStatus(),
      cacheStats: this.cache.getStats()
    };
  }

  /**
   * Clear all cached data
   */
  clearCache(): void {
    this.cache.clear();
  }
}

// Export singleton instance and re-export types for convenience
export const farcasterUserService = new FarcasterUserService();

// Re-export types from neynarTypes for easier importing
export type { AppFarcasterUser, AppFarcasterCast } from '../lib/neynar/neynarTypes';