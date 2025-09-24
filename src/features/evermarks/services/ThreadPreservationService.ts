import type { ThreadData, ParentCastData, UserProfile } from '../types';

const THREAD_CONFIG = {
  API_BASE: import.meta.env.VITE_API_URL || '/.netlify/functions',
  NEYNAR_API_KEY: import.meta.env.VITE_NEYNAR_API_KEY,
  MAX_THREAD_DEPTH: 100,
  MAX_REPLIES_TO_FETCH: 500,
};

export class ThreadPreservationService {
  /**
   * Preserve entire thread including all replies
   */
  static async preserveThread(castHash: string): Promise<ThreadData | null> {
    try {
      console.log('🧵 Preserving thread for cast:', castHash);

      // Fetch thread data from Neynar
      const response = await fetch(`${THREAD_CONFIG.API_BASE}/preserve-thread`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ castHash }),
      });

      if (!response.ok) {
        console.error('Failed to preserve thread:', response.statusText);
        return null;
      }

      const threadData = await response.json();
      return this.formatThreadData(threadData);
    } catch (error) {
      console.error('Error preserving thread:', error);
      return null;
    }
  }

  /**
   * Format raw thread data into structured format
   */
  private static formatThreadData(raw: any): ThreadData {
    return {
      thread_hash: raw.thread_hash,
      root_cast: raw.root_cast ? {
        hash: raw.root_cast.hash,
        author_fid: raw.root_cast.author.fid,
        author_username: raw.root_cast.author.username,
        text: raw.root_cast.text,
        timestamp: raw.root_cast.timestamp,
      } : undefined,
      reply_chain: raw.replies?.map((reply: any, index: number) => ({
        hash: reply.hash,
        author_fid: reply.author.fid,
        author_username: reply.author.username,
        text: reply.text,
        timestamp: reply.timestamp,
        depth: reply.depth || index,
      })) || [],
      total_replies: raw.total_replies || 0,
      participants: this.extractParticipants(raw.replies || []),
    };
  }

  /**
   * Extract unique participants from replies
   */
  private static extractParticipants(replies: any[]): ThreadData['participants'] {
    const participantMap = new Map<number, { username: string; count: number }>();

    replies.forEach(reply => {
      const fid = reply.author.fid;
      if (participantMap.has(fid)) {
        const participant = participantMap.get(fid)!;
        participant.count++;
      } else {
        participantMap.set(fid, {
          username: reply.author.username,
          count: 1,
        });
      }
    });

    return Array.from(participantMap.entries()).map(([fid, data]) => ({
      fid,
      username: data.username,
      reply_count: data.count,
    }));
  }

  /**
   * Fetch and preserve parent cast if exists
   */
  static async preserveParentCast(castHash: string): Promise<ParentCastData | null> {
    try {
      const response = await fetch(
        `${THREAD_CONFIG.API_BASE}/farcaster-cast?hash=${castHash}`
      );

      if (!response.ok) {
        return null;
      }

      const result = await response.json();
      if (!result.success || !result.data) {
        return null;
      }

      const cast = result.data;
      return {
        hash: cast.parent_hash,
        author_fid: cast.parent_author?.fid,
        author_username: cast.parent_author?.username,
        text: cast.parent_text || '',
        timestamp: cast.parent_timestamp || '',
        preserved: false, // Will be updated when parent is preserved
      };
    } catch (error) {
      console.error('Error fetching parent cast:', error);
      return null;
    }
  }

  /**
   * Preserve user profiles mentioned in cast
   */
  static async preserveMentionedProfiles(fids: number[]): Promise<UserProfile[]> {
    if (!fids || fids.length === 0) return [];

    try {
      const response = await fetch(`${THREAD_CONFIG.API_BASE}/preserve-profiles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fids }),
      });

      if (!response.ok) {
        return [];
      }

      const profiles = await response.json();
      return profiles.map((profile: any) => this.formatUserProfile(profile));
    } catch (error) {
      console.error('Error preserving profiles:', error);
      return [];
    }
  }

  /**
   * Format user profile data
   */
  private static formatUserProfile(raw: any): UserProfile {
    return {
      fid: raw.fid,
      username: raw.username,
      display_name: raw.display_name,
      pfp_url: raw.pfp_url,
      bio: raw.profile?.bio?.text,
      follower_count: raw.follower_count,
      following_count: raw.following_count,
      verified_addresses: raw.verified_addresses?.eth_addresses || [],
      power_badge: raw.power_badge,
      snapshot_at: new Date().toISOString(),
    };
  }

  /**
   * Build complete conversation context
   */
  static async buildConversationContext(castHash: string): Promise<{
    thread: ThreadData | null;
    parent: ParentCastData | null;
    mentioned_profiles: UserProfile[];
  }> {
    // Fetch all data in parallel
    const [thread, castData] = await Promise.all([
      this.preserveThread(castHash),
      fetch(`${THREAD_CONFIG.API_BASE}/farcaster-cast?hash=${castHash}`)
        .then(r => r.json())
        .catch(() => null),
    ]);

    // Extract mentioned FIDs
    const mentionedFids: number[] = [];
    if (castData?.data?.mentioned_profiles) {
      castData.data.mentioned_profiles.forEach((profile: any) => {
        if (profile.fid) mentionedFids.push(profile.fid);
      });
    }

    // Fetch parent and profiles in parallel
    const [parent, profiles] = await Promise.all([
      castData?.data?.parent_hash 
        ? this.preserveParentCast(castData.data.parent_hash)
        : Promise.resolve(null),
      this.preserveMentionedProfiles(mentionedFids),
    ]);

    return {
      thread,
      parent,
      mentioned_profiles: profiles,
    };
  }

  /**
   * Check if thread has been updated since preservation
   */
  static async checkThreadUpdates(
    threadHash: string, 
    lastPreservedAt: string
  ): Promise<{ hasUpdates: boolean; newReplyCount?: number }> {
    try {
      const response = await fetch(
        `${THREAD_CONFIG.API_BASE}/check-thread-updates?` +
        `thread=${threadHash}&since=${encodeURIComponent(lastPreservedAt)}`
      );

      if (!response.ok) {
        return { hasUpdates: false };
      }

      return await response.json();
    } catch (error) {
      console.error('Error checking thread updates:', error);
      return { hasUpdates: false };
    }
  }
}