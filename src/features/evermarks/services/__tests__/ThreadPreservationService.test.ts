import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ThreadPreservationService, type ThreadData, type ParentCastData, type UserProfile } from '../ThreadPreservationService';

// Mock fetch
global.fetch = vi.fn();
const mockFetch = fetch as any;

describe('ThreadPreservationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('preserveThread', () => {
    it('should preserve thread successfully', async () => {
      // Raw API response structure
      const mockApiResponse = {
        thread_hash: 'thread_123',
        root_cast: {
          hash: 'root_123',
          author: {
            fid: 1,
            username: 'rootuser',
          },
          text: 'Root cast content',
          timestamp: '2024-01-01T00:00:00Z',
        },
        replies: [
          {
            hash: 'reply_1',
            author: {
              fid: 2,
              username: 'user2',
            },
            text: 'First reply',
            timestamp: '2024-01-01T01:00:00Z',
            depth: 1,
          },
          {
            hash: 'reply_2',
            author: {
              fid: 3,
              username: 'user3',
            },
            text: 'Second reply',
            timestamp: '2024-01-01T02:00:00Z',
            depth: 1,
          },
        ],
        total_replies: 2,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockApiResponse),
      });

      const result = await ThreadPreservationService.preserveThread('0x123');

      expect(result).toMatchObject({
        thread_hash: 'thread_123',
        total_replies: 2,
      });
      expect(result?.reply_chain).toHaveLength(2);
      expect(mockFetch).toHaveBeenCalledWith(
        '/.netlify/functions/preserve-thread',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ castHash: '0x123' }),
        }
      );
    });

    it('should return null on API failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Internal Server Error',
      });

      const result = await ThreadPreservationService.preserveThread('0x123');

      expect(result).toBeNull();
    });

    it('should return null on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await ThreadPreservationService.preserveThread('0x123');

      expect(result).toBeNull();
    });
  });

  describe('preserveParentCast', () => {
    it('should preserve parent cast when it exists', async () => {
      const mockCastResponse = {
        success: true,
        data: {
          parent_hash: 'parent_123',
          parent_author: {
            fid: 1,
            username: 'parentuser',
          },
          parent_text: 'Parent cast content',
          parent_timestamp: '2024-01-01T00:00:00Z',
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockCastResponse),
      });

      const result = await ThreadPreservationService.preserveParentCast('0x123');

      const expected: ParentCastData = {
        hash: 'parent_123',
        author_fid: 1,
        author_username: 'parentuser',
        text: 'Parent cast content',
        timestamp: '2024-01-01T00:00:00Z',
        preserved: false,
      };

      expect(result).toEqual(expected);
      expect(mockFetch).toHaveBeenCalledWith('/.netlify/functions/farcaster-cast?hash=0x123');
    });

    it('should return null if no parent cast', async () => {
      const mockCastResponse = {
        success: false,
        data: null,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockCastResponse),
      });

      const result = await ThreadPreservationService.preserveParentCast('0x123');

      expect(result).toBeNull();
    });

    it('should return null on API failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const result = await ThreadPreservationService.preserveParentCast('0x123');

      expect(result).toBeNull();
    });
  });

  describe('preserveMentionedProfiles', () => {
    it('should preserve user profiles', async () => {
      const mockProfiles = [
        {
          fid: 1,
          username: 'user1',
          display_name: 'User One',
          pfp_url: 'https://example.com/pfp1.jpg',
          profile: {
            bio: { text: 'Bio for user 1' },
          },
          follower_count: 100,
          following_count: 50,
          verified_addresses: {
            eth_addresses: ['0x123'],
          },
          power_badge: true,
        },
        {
          fid: 2,
          username: 'user2',
          display_name: 'User Two',
          pfp_url: 'https://example.com/pfp2.jpg',
          profile: {
            bio: { text: 'Bio for user 2' },
          },
          follower_count: 200,
          following_count: 75,
          verified_addresses: {
            eth_addresses: ['0x456'],
          },
          power_badge: false,
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockProfiles),
      });

      const result = await ThreadPreservationService.preserveMentionedProfiles([1, 2]);

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        fid: 1,
        username: 'user1',
        display_name: 'User One',
        pfp_url: 'https://example.com/pfp1.jpg',
        bio: 'Bio for user 1',
        follower_count: 100,
        following_count: 50,
        verified_addresses: ['0x123'],
        power_badge: true,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        '/.netlify/functions/preserve-profiles',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fids: [1, 2] }),
        }
      );
    });

    it('should return empty array for empty input', async () => {
      const result = await ThreadPreservationService.preserveMentionedProfiles([]);

      expect(result).toEqual([]);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should return empty array on API failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Internal Server Error',
      });

      const result = await ThreadPreservationService.preserveMentionedProfiles([1, 2]);

      expect(result).toEqual([]);
    });
  });

  describe('buildConversationContext', () => {
    it('should build complete conversation context', async () => {
      const mockThreadApiResponse = {
        thread_hash: 'thread_123',
        total_replies: 1,
        replies: [
          {
            hash: 'reply_1',
            author: { fid: 2, username: 'user2' },
            text: 'Reply',
            timestamp: '2024-01-01T01:00:00Z',
          }
        ]
      };

      const mockCastData = {
        data: {
          mentioned_profiles: [
            { fid: 1 },
            { fid: 2 },
          ],
          parent_hash: 'parent_123',
        },
      };

      const mockParentData: ParentCastData = {
        hash: 'parent_123',
        author_fid: 1,
        author_username: 'parentuser',
        text: 'Parent content',
        timestamp: '2024-01-01T00:00:00Z',
        preserved: false,
      };

      const mockProfiles: UserProfile[] = [
        {
          fid: 1,
          username: 'user1',
          display_name: 'User One',
          snapshot_at: '2024-01-01T00:00:00Z',
        },
      ];

      // Mock thread preservation
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockThreadApiResponse),
        })
        // Mock cast data fetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockCastData),
        })
        // Mock parent cast preservation
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: {
              parent_hash: 'parent_123',
              parent_author: { fid: 1, username: 'parentuser' },
              parent_text: 'Parent content',
              parent_timestamp: '2024-01-01T00:00:00Z',
            },
          }),
        })
        // Mock profiles preservation
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([
            {
              fid: 1,
              username: 'user1',
              display_name: 'User One',
              verified_addresses: { eth_addresses: [] },
            },
          ]),
        });

      const result = await ThreadPreservationService.buildConversationContext('0x123');

      expect(result.thread).toMatchObject({
        thread_hash: 'thread_123',
        total_replies: 1,
      });
      expect(result.parent).toMatchObject({
        hash: 'parent_123',
        author_fid: 1,
        author_username: 'parentuser',
      });
      expect(result.mentioned_profiles).toHaveLength(1);
      expect(result.mentioned_profiles[0].fid).toBe(1);
    });

    it('should handle missing cast data gracefully', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            thread_hash: 'thread_123',
            total_replies: 0,
            replies: [],
          }),
        })
        .mockRejectedValueOnce(new Error('Cast not found'));

      const result = await ThreadPreservationService.buildConversationContext('0x123');

      expect(result.thread).toBeDefined();
      expect(result.parent).toBeNull();
      expect(result.mentioned_profiles).toEqual([]);
    });
  });

  describe('checkThreadUpdates', () => {
    it('should check for thread updates', async () => {
      const mockUpdateCheck = {
        hasUpdates: true,
        newReplyCount: 3,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockUpdateCheck),
      });

      const result = await ThreadPreservationService.checkThreadUpdates(
        'thread_123',
        '2024-01-01T00:00:00Z'
      );

      expect(result).toEqual(mockUpdateCheck);
      expect(mockFetch).toHaveBeenCalledWith(
        '/.netlify/functions/check-thread-updates?thread=thread_123&since=2024-01-01T00%3A00%3A00Z'
      );
    });

    it('should return no updates on API failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Internal Server Error',
      });

      const result = await ThreadPreservationService.checkThreadUpdates(
        'thread_123',
        '2024-01-01T00:00:00Z'
      );

      expect(result).toEqual({ hasUpdates: false });
    });

    it('should return no updates on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await ThreadPreservationService.checkThreadUpdates(
        'thread_123',
        '2024-01-01T00:00:00Z'
      );

      expect(result).toEqual({ hasUpdates: false });
    });
  });

  describe('formatUserProfile', () => {
    const formatUserProfile = (ThreadPreservationService as any).formatUserProfile;

    it('should format user profile correctly', () => {
      const rawProfile = {
        fid: 123,
        username: 'testuser',
        display_name: 'Test User',
        pfp_url: 'https://example.com/pfp.jpg',
        profile: {
          bio: {
            text: 'This is my bio',
          },
        },
        follower_count: 500,
        following_count: 100,
        verified_addresses: {
          eth_addresses: ['0x123', '0x456'],
        },
        power_badge: true,
      };

      const result = formatUserProfile(rawProfile);

      expect(result).toMatchObject({
        fid: 123,
        username: 'testuser',
        display_name: 'Test User',
        pfp_url: 'https://example.com/pfp.jpg',
        bio: 'This is my bio',
        follower_count: 500,
        following_count: 100,
        verified_addresses: ['0x123', '0x456'],
        power_badge: true,
      });

      // Should have snapshot_at field
      expect(result.snapshot_at).toBeDefined();
    });

    it('should handle missing optional fields', () => {
      const rawProfile = {
        fid: 123,
        username: 'testuser',
        display_name: 'Test User',
        verified_addresses: {},
      };

      const result = formatUserProfile(rawProfile);

      expect(result).toMatchObject({
        fid: 123,
        username: 'testuser',
        display_name: 'Test User',
        verified_addresses: [],
      });
      expect(result.power_badge).toBeUndefined();
      expect(result.snapshot_at).toBeDefined();
    });
  });
});