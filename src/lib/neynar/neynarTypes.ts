// src/lib/neynar/neynarTypes.ts
// TypeScript interfaces for Neynar API responses

export interface NeynarUser {
  fid: number;
  username: string;
  display_name: string;
  pfp_url: string;
  profile: {
    bio: {
      text: string;
      mentioned_profiles: any[];
    };
  };
  follower_count: number;
  following_count: number;
  verifications: string[]; // Ethereum addresses
  verified_addresses: {
    eth_addresses: string[];
    sol_addresses: string[];
  };
  active_status: 'active' | 'inactive';
  power_badge: boolean;
  viewer_context?: {
    following: boolean;
    followed_by: boolean;
  };
}

export interface NeynarCast {
  hash: string;
  thread_hash: string;
  parent_hash?: string;
  parent_url?: string;
  root_parent_url?: string;
  parent_author?: {
    fid: number;
  };
  author: NeynarUser;
  text: string;
  timestamp: string;
  embeds: NeynarEmbed[];
  reactions: {
    likes_count: number;
    recasts_count: number;
    likes: Array<{
      fid: number;
      fname: string;
    }>;
    recasts: Array<{
      fid: number;
      fname: string;
    }>;
  };
  replies: {
    count: number;
  };
  mentioned_profiles: NeynarUser[];
  channel?: {
    id: string;
    name: string;
    image_url: string;
  };
}

export interface NeynarEmbed {
  url?: string;
  cast_id?: {
    fid: number;
    hash: string;
  };
  metadata?: {
    content_type?: string;
    content_length?: number;
    _status?: string;
    image?: {
      height_px: number;
      width_px: number;
    };
    html?: {
      charset?: string;
      language?: string;
      ogDescription?: string;
      ogImage?: Array<{
        height?: string;
        type?: string;
        url?: string;
        width?: string;
      }>;
      ogTitle?: string;
      ogUrl?: string;
    };
  };
}

export interface NeynarProfile extends NeynarUser {
  // Extended profile information
  location?: {
    latitude?: number;
    longitude?: number;
    address?: {
      city?: string;
      state?: string;
      country?: string;
    };
  };
  custody_address: string;
  recovery_address?: string;
}

export interface NeynarVerification {
  fid: number;
  address: string;
  timestamp: string;
  block_hash: string;
  signature: string;
}

export interface NeynarFollowResponse {
  users: NeynarUser[];
  next?: {
    cursor?: string;
  };
}

export interface NeynarUserBulkResponse {
  users: NeynarUser[];
}

export interface NeynarCastResponse {
  cast: NeynarCast;
}

export interface NeynarSearchResponse {
  result: {
    users: NeynarUser[];
  };
}

// Application-specific mapped types
export interface AppFarcasterUser {
  fid: number;
  username: string;
  displayName: string;
  pfpUrl: string;
  bio?: string;
  followerCount: number;
  followingCount: number;
  verifiedAddresses: string[];
  isVerified: boolean;
  hasPowerBadge: boolean;
  isActive: boolean;
}

export interface AppFarcasterCast {
  hash: string;
  author: AppFarcasterUser;
  content: string;
  timestamp: Date;
  likes: number;
  recasts: number;
  replies: number;
  embeds: {
    type: 'url' | 'image' | 'cast';
    url?: string;
    title?: string;
    description?: string;
    imageUrl?: string;
  }[];
  parentHash?: string;
  channel?: {
    id: string;
    name: string;
    imageUrl: string;
  };
}

// Validation helpers
export function mapNeynarUserToApp(neynarUser: NeynarUser): AppFarcasterUser {
  return {
    fid: neynarUser.fid,
    username: neynarUser.username,
    displayName: neynarUser.display_name,
    pfpUrl: neynarUser.pfp_url,
    bio: neynarUser.profile?.bio?.text,
    followerCount: neynarUser.follower_count,
    followingCount: neynarUser.following_count,
    verifiedAddresses: [
      ...neynarUser.verified_addresses.eth_addresses,
      ...neynarUser.verified_addresses.sol_addresses
    ],
    isVerified: neynarUser.verifications.length > 0,
    hasPowerBadge: neynarUser.power_badge,
    isActive: neynarUser.active_status === 'active'
  };
}

export function mapNeynarCastToApp(neynarCast: NeynarCast): AppFarcasterCast {
  return {
    hash: neynarCast.hash,
    author: mapNeynarUserToApp(neynarCast.author),
    content: neynarCast.text,
    timestamp: new Date(neynarCast.timestamp),
    likes: neynarCast.reactions.likes_count,
    recasts: neynarCast.reactions.recasts_count,
    replies: neynarCast.replies.count,
    embeds: neynarCast.embeds.map(embed => ({
      type: embed.cast_id ? 'cast' : embed.metadata?.image ? 'image' : 'url',
      url: embed.url,
      title: embed.metadata?.html?.ogTitle,
      description: embed.metadata?.html?.ogDescription,
      imageUrl: embed.metadata?.html?.ogImage?.[0]?.url
    })),
    parentHash: neynarCast.parent_hash,
    channel: neynarCast.channel ? {
      id: neynarCast.channel.id,
      name: neynarCast.channel.name,
      imageUrl: neynarCast.channel.image_url
    } : undefined
  };
}

// Type guards
export function isNeynarUser(obj: any): obj is NeynarUser {
  return obj && 
    typeof obj.fid === 'number' &&
    typeof obj.username === 'string' &&
    typeof obj.display_name === 'string';
}

export function isNeynarCast(obj: any): obj is NeynarCast {
  return obj &&
    typeof obj.hash === 'string' &&
    obj.author &&
    isNeynarUser(obj.author) &&
    typeof obj.text === 'string';
}

// Configuration validation
export interface NeynarConfig {
  apiKey: string;
  rateLimitEnabled: boolean;
  maxRequestsPerMinute: number;
  timeoutMs: number;
  retryAttempts: number;
}

export const DEFAULT_NEYNAR_CONFIG: NeynarConfig = {
  apiKey: '',
  rateLimitEnabled: true,
  maxRequestsPerMinute: 150,
  timeoutMs: 10000,
  retryAttempts: 3
};

export function validateNeynarConfig(config: Partial<NeynarConfig>): boolean {
  return !!(config.apiKey && config.apiKey.length > 0);
}