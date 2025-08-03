// src/lib/neynar/neynarClient.ts
// Neynar API client with authentication and rate limiting

const NEYNAR_API_BASE = 'https://api.neynar.com/v2';
const NEYNAR_API_KEY = import.meta.env.VITE_NEYNAR_API_KEY;

if (!NEYNAR_API_KEY) {
  console.warn('⚠️ VITE_NEYNAR_API_KEY not found - Farcaster features will be limited');
}

export interface NeynarRequestConfig {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: any;
  headers?: Record<string, string>;
}

export class NeynarRateLimiter {
  private requests: number[] = [];
  private readonly maxRequests = 150; // Neynar rate limit
  private readonly windowMs = 60 * 1000; // 1 minute

  canMakeRequest(): boolean {
    const now = Date.now();
    // Remove requests older than window
    this.requests = this.requests.filter(time => now - time < this.windowMs);
    return this.requests.length < this.maxRequests;
  }

  recordRequest(): void {
    this.requests.push(Date.now());
  }

  getTimeUntilReset(): number {
    if (this.requests.length === 0) return 0;
    const oldestRequest = Math.min(...this.requests);
    return Math.max(0, this.windowMs - (Date.now() - oldestRequest));
  }
}

export class NeynarAPIError extends Error {
  constructor(
    message: string,
    public status?: number,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'NeynarAPIError';
  }
}

export class NeynarClient {
  private apiKey: string;
  private rateLimiter = new NeynarRateLimiter();

  constructor(apiKey?: string) {
    this.apiKey = apiKey || NEYNAR_API_KEY || '';
    if (!this.apiKey) {
      console.warn('NeynarClient initialized without API key');
    }
  }

  private async makeRequest<T>(
    endpoint: string, 
    config: NeynarRequestConfig = {}
  ): Promise<T> {
    if (!this.apiKey) {
      throw new NeynarAPIError('Neynar API key not configured');
    }

    // Check rate limiting
    if (!this.rateLimiter.canMakeRequest()) {
      const waitTime = this.rateLimiter.getTimeUntilReset();
      throw new NeynarAPIError(
        `Rate limit exceeded. Try again in ${Math.ceil(waitTime / 1000)} seconds`,
        429,
        'RATE_LIMIT_EXCEEDED'
      );
    }

    const url = `${NEYNAR_API_BASE}${endpoint}`;
    const headers = {
      'accept': 'application/json',
      'api_key': this.apiKey,
      'content-type': 'application/json',
      ...config.headers
    };

    try {
      this.rateLimiter.recordRequest();
      
      const response = await fetch(url, {
        method: config.method || 'GET',
        headers,
        body: config.body ? JSON.stringify(config.body) : undefined
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new NeynarAPIError(
          errorData.message || `HTTP ${response.status}: ${response.statusText}`,
          response.status,
          errorData.code,
          errorData
        );
      }

      return await response.json();
    } catch (error) {
      if (error instanceof NeynarAPIError) {
        throw error;
      }
      
      // Network or parsing error
      throw new NeynarAPIError(
        error instanceof Error ? error.message : 'Unknown API error',
        0,
        'NETWORK_ERROR'
      );
    }
  }

  // User lookup methods
  async getUserByFid(fid: number): Promise<any> {
    return this.makeRequest(`/farcaster/user/bulk?fids=${fid}`);
  }

  async getUserByUsername(username: string): Promise<any> {
    return this.makeRequest(`/farcaster/user/by_username?username=${username}`);
  }

  async getUserBatch(fids: number[]): Promise<any> {
    const fidsParam = fids.join(',');
    return this.makeRequest(`/farcaster/user/bulk?fids=${fidsParam}`);
  }

  // Cast methods
  async getCastByHash(hash: string): Promise<any> {
    return this.makeRequest(`/farcaster/cast?identifier=${hash}&type=hash`);
  }

  async getCastByUrl(url: string): Promise<any> {
    return this.makeRequest(`/farcaster/cast?identifier=${encodeURIComponent(url)}&type=url`);
  }

  // Search methods  
  async searchUsers(query: string, limit = 10): Promise<any> {
    return this.makeRequest(`/farcaster/user/search?q=${encodeURIComponent(query)}&limit=${limit}`);
  }

  // Verification methods
  async getVerifications(fid: number): Promise<any> {
    return this.makeRequest(`/farcaster/verifications?fid=${fid}`);
  }

  // Following/followers
  async getFollowing(fid: number, limit = 100): Promise<any> {
    return this.makeRequest(`/farcaster/following?fid=${fid}&limit=${limit}`);
  }

  async getFollowers(fid: number, limit = 100): Promise<any> {
    return this.makeRequest(`/farcaster/followers?fid=${fid}&limit=${limit}`);
  }

  // Utility methods
  isConfigured(): boolean {
    return !!this.apiKey;
  }

  getRateLimitStatus() {
    return {
      canMakeRequest: this.rateLimiter.canMakeRequest(),
      timeUntilReset: this.rateLimiter.getTimeUntilReset()
    };
  }
}

// Export singleton instance
export const neynarClient = new NeynarClient();

// Export hook for React components
export function useNeynarClient() {
  return neynarClient;
}