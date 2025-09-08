import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LeaderboardService } from './LeaderboardService'
import { VotingService } from '../../voting/services/VotingService'
import { VotingCacheService } from '../../voting/services/VotingCacheService'
import { LeaderboardSyncService } from './LeaderboardSyncService'
import { BlockchainLeaderboardService } from './BlockchainLeaderboardService'
import { FinalizationService } from './FinalizationService'
import type { Evermark } from '../../evermarks/types'

// Mock all service dependencies
vi.mock('../../voting/services/VotingService', () => ({
  VotingService: {
    getEvermarkVotes: vi.fn(),
    getCurrentSeason: vi.fn()
  }
}))

vi.mock('../../voting/services/VotingCacheService', () => ({
  VotingCacheService: {
    getCachedVotingData: vi.fn(),
    getBulkVotingData: vi.fn(),
    isCacheStale: vi.fn(),
    syncEvermarkToCache: vi.fn()
  }
}))

vi.mock('./LeaderboardSyncService', () => ({
  LeaderboardSyncService: {
    syncLeaderboard: vi.fn(),
    getEvermarkRankingData: vi.fn()
  }
}))

vi.mock('./BlockchainLeaderboardService', () => ({
  BlockchainLeaderboardService: {
    getLeaderboard: vi.fn(),
    calculateBlockchainLeaderboard: vi.fn()
  }
}))

vi.mock('./FinalizationService', () => ({
  FinalizationService: {
    hasStoredFinalization: vi.fn(),
    getFinalizedLeaderboard: vi.fn(),
    finalizeSeasonLeaderboard: vi.fn()
  }
}))

describe('LeaderboardService', () => {
  const mockEvermarks: Evermark[] = [
    {
      id: '1',
      title: 'First Evermark',
      contentHash: 'QmTest1',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
      creatorAddress: '0x1111111111111111111111111111111111111111',
      description: 'Test description 1',
      tags: ['test', 'first'],
      isVerified: true,
      metadata: {
        sourceUrl: 'https://example.com/1',
        title: 'First Evermark',
        description: 'Test description 1'
      },
      stats: {
        votes: 200,
        supporters: 20,
        comments: 5
      }
    },
    {
      id: '2',
      title: 'Second Evermark',
      contentHash: 'QmTest2',
      createdAt: new Date('2024-01-02'),
      updatedAt: new Date('2024-01-02'),
      creatorAddress: '0x2222222222222222222222222222222222222222',
      description: 'Test description 2',
      tags: ['test', 'second'],
      isVerified: false,
      metadata: {
        sourceUrl: 'https://example.com/2',
        title: 'Second Evermark',
        description: 'Test description 2'
      },
      stats: {
        votes: 150,
        supporters: 15,
        comments: 2
      }
    },
    {
      id: '3',
      title: 'Third Evermark',
      contentHash: 'QmTest3',
      createdAt: new Date('2024-01-03'),
      updatedAt: new Date('2024-01-03'),
      creatorAddress: '0x3333333333333333333333333333333333333333',
      description: 'Test description 3',
      tags: ['test', 'third'],
      isVerified: true,
      metadata: {
        sourceUrl: 'https://example.com/3',
        title: 'Third Evermark',
        description: 'Test description 3'
      },
      stats: {
        votes: 100,
        supporters: 10,
        comments: 3
      }
    }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Default mock implementations
    vi.mocked(VotingCacheService.getCachedVotingData).mockImplementation(async (evermarkId: string) => {
      const evermark = mockEvermarks.find(e => e.id === evermarkId)
      return {
        votes: BigInt(evermark?.stats?.votes || 0),
        voterCount: evermark?.stats?.supporters || 0
      }
    })

    vi.mocked(VotingCacheService.getBulkVotingData).mockImplementation(async (evermarkIds: string[]) => {
      const result = new Map()
      evermarkIds.forEach(id => {
        const evermark = mockEvermarks.find(e => e.id === id)
        result.set(id, {
          votes: BigInt(evermark?.stats?.votes || 0),
          voterCount: evermark?.stats?.supporters || 0
        })
      })
      return result
    })

    vi.mocked(VotingCacheService.isCacheStale).mockResolvedValue(false)
    vi.mocked(FinalizationService.hasStoredFinalization).mockResolvedValue(false)

    // Mock the imported services directly since we already mocked them at module level
    vi.mocked(LeaderboardSyncService.getEvermarkRankingData).mockResolvedValue({
      votes: BigInt(100),
      totalVoters: 10,
      rank: 1
    })

    vi.mocked(BlockchainLeaderboardService.calculateBlockchainLeaderboard).mockResolvedValue([
      {
        rank: 1,
        evermarkId: '1',
        evermark: mockEvermarks[0],
        votes: BigInt(200),
        voterCount: 20,
        score: 200,
        scoreMultiplier: 1.0,
        previousRank: 0,
        rankChange: 1,
        trendingScore: 0.9,
        momentum: 'up',
        category: 'blockchain',
        seasonNumber: 6
      }
    ])
  })

  describe('getCachedVotingData', () => {
    it('should return cached voting data when available', async () => {
      vi.mocked(VotingCacheService.getCachedVotingData).mockResolvedValue({
        votes: BigInt(150),
        voterCount: 15
      })

      // Access the private method through reflection for testing
      const getCachedVotingData = (LeaderboardService as any).getCachedVotingData
      const result = await getCachedVotingData('1', 100)

      expect(result).toEqual({
        votes: BigInt(150),
        voterCount: 15
      })
      expect(VotingCacheService.getCachedVotingData).toHaveBeenCalledWith('1')
    })

    it('should refresh stale cache data', async () => {
      vi.mocked(VotingCacheService.getCachedVotingData)
        .mockResolvedValueOnce({ votes: BigInt(0), voterCount: 0 }) // First call returns zeros
        .mockResolvedValueOnce({ votes: BigInt(200), voterCount: 20 }) // Second call after refresh

      vi.mocked(VotingCacheService.isCacheStale).mockResolvedValue(true)
      vi.mocked(VotingCacheService.syncEvermarkToCache).mockResolvedValue(undefined)

      const getCachedVotingData = (LeaderboardService as any).getCachedVotingData
      const result = await getCachedVotingData('1', 100)

      expect(result).toEqual({
        votes: BigInt(200),
        voterCount: 20
      })
      expect(VotingCacheService.syncEvermarkToCache).toHaveBeenCalledWith('1')
    })

    it('should return cached zeros when cache is not stale', async () => {
      vi.mocked(VotingCacheService.getCachedVotingData).mockResolvedValue({
        votes: BigInt(0),
        voterCount: 0
      })
      vi.mocked(VotingCacheService.isCacheStale).mockResolvedValue(false)

      const getCachedVotingData = (LeaderboardService as any).getCachedVotingData
      const result = await getCachedVotingData('1', 100)

      expect(result).toEqual({
        votes: BigInt(0),
        voterCount: 0
      })
    })

    it('should handle errors and return fallback values', async () => {
      vi.mocked(VotingCacheService.getCachedVotingData).mockRejectedValue(new Error('Cache error'))
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const getCachedVotingData = (LeaderboardService as any).getCachedVotingData
      const result = await getCachedVotingData('1', 150)

      expect(result).toEqual({
        votes: BigInt(150),
        voterCount: 1
      })
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to get cached voting data'),
        expect.any(Error)
      )
    })

    it('should return zero voter count for zero fallback votes', async () => {
      vi.mocked(VotingCacheService.getCachedVotingData).mockRejectedValue(new Error('Cache error'))

      const getCachedVotingData = (LeaderboardService as any).getCachedVotingData
      const result = await getCachedVotingData('1', 0)

      expect(result).toEqual({
        votes: BigInt(0),
        voterCount: 0
      })
    })
  })

  describe('calculateLeaderboard', () => {
    it('should use finalized data for completed seasons', async () => {
      const mockFinalizedEntries = [
        {
          rank: 1,
          evermarkId: '1',
          votes: BigInt(200),
          voterCount: 20,
          scoreMultiplier: 1.5,
          seasonNumber: 5
        },
        {
          rank: 2,
          evermarkId: '2',
          votes: BigInt(150),
          voterCount: 15,
          scoreMultiplier: 1.2,
          seasonNumber: 5
        }
      ]

      const mockEnhancedEntries = [
        {
          rank: 1,
          evermarkId: '1',
          evermark: mockEvermarks[0],
          votes: BigInt(200),
          voterCount: 20,
          scoreMultiplier: 1.5,
          score: 300,
          previousRank: 0,
          rankChange: 1,
          trendingScore: 0.85,
          momentum: 'up',
          category: 'blockchain',
          seasonNumber: 5
        }
      ]

      vi.mocked(FinalizationService.hasStoredFinalization).mockResolvedValue(true)
      vi.mocked(FinalizationService.getFinalizedLeaderboard).mockResolvedValue(mockFinalizedEntries)
      vi.spyOn(LeaderboardService as any, 'enhanceFinalizedEntries').mockReturnValue(mockEnhancedEntries)

      const result = await LeaderboardService.calculateLeaderboard(mockEvermarks, 'season-5')

      expect(FinalizationService.hasStoredFinalization).toHaveBeenCalledWith(5)
      expect(FinalizationService.getFinalizedLeaderboard).toHaveBeenCalledWith(5)
      expect(result).toEqual(mockEnhancedEntries)
    })

    it('should calculate live leaderboard for current period', async () => {
      vi.mocked(VotingService.getCurrentSeason).mockResolvedValue({
        seasonNumber: 6,
        startTime: new Date('2024-02-01'),
        endTime: new Date('2024-02-28'),
        totalVotes: BigInt(1000),
        totalVoters: 50,
        isActive: true,
        activeEvermarksCount: 3
      })

      // Mock getBulkVotingData with higher vote counts to avoid blockchain fallback
      vi.mocked(VotingCacheService.getBulkVotingData).mockResolvedValue(
        new Map([
          ['1', { votes: BigInt(200), voterCount: 20 }],
          ['2', { votes: BigInt(150), voterCount: 15 }],
          ['3', { votes: BigInt(100), voterCount: 10 }]
        ])
      )

      const result = await LeaderboardService.calculateLeaderboard(mockEvermarks, 'current')

      expect(result).toHaveLength(3)
      expect(result[0].rank).toBe(1)
      expect(result[0].evermarkId).toBe('1')
      expect(result[0].totalVotes).toBe(BigInt(200)) // Use totalVotes not votes
      expect(result[1].rank).toBe(2)
      expect(result[2].rank).toBe(3)
    })

    it('should handle specific season calculations', async () => {
      // Mock FinalizationService to return false for hasStoredFinalization
      vi.mocked(FinalizationService.hasStoredFinalization).mockResolvedValue(false)
      
      // Mock getBulkVotingData to return low vote counts to trigger blockchain fallback
      vi.mocked(VotingCacheService.getBulkVotingData).mockResolvedValue(
        new Map([
          ['1', { votes: BigInt(0), voterCount: 0 }],
          ['2', { votes: BigInt(0), voterCount: 0 }],
          ['3', { votes: BigInt(0), voterCount: 0 }]
        ])
      )

      // Mock BlockchainLeaderboardService.calculateBlockchainLeaderboard for season calculation
      vi.mocked(BlockchainLeaderboardService.calculateBlockchainLeaderboard).mockResolvedValue([
        {
          rank: 1,
          evermarkId: '1',
          evermark: mockEvermarks[0],
          votes: BigInt(180),
          voterCount: 18,
          score: 180,
          scoreMultiplier: 1.0,
          previousRank: 0,
          rankChange: 1,
          trendingScore: 0.9,
          momentum: 'up',
          category: 'blockchain',
          seasonNumber: 3
        },
        {
          rank: 2,
          evermarkId: '2',
          evermark: mockEvermarks[1],
          votes: BigInt(120),
          voterCount: 12,
          score: 120,
          scoreMultiplier: 1.0,
          previousRank: 0,
          rankChange: 1,
          trendingScore: 0.8,
          momentum: 'up',
          category: 'blockchain',
          seasonNumber: 3
        }
      ])

      const result = await LeaderboardService.calculateLeaderboard(mockEvermarks, 'season-3')

      expect(BlockchainLeaderboardService.calculateBlockchainLeaderboard).toHaveBeenCalledWith(mockEvermarks, 3)
      expect(result).toHaveLength(2)
    })

    it('should sort entries by votes descending', async () => {
      // Mock getBulkVotingData with votes in non-sorted order to test sorting
      vi.mocked(VotingCacheService.getBulkVotingData).mockResolvedValue(
        new Map([
          ['1', { votes: BigInt(50), voterCount: 5 }],   // evermark 1 - lowest
          ['2', { votes: BigInt(200), voterCount: 20 }], // evermark 2 - highest
          ['3', { votes: BigInt(100), voterCount: 10 }]  // evermark 3 - middle
        ])
      )

      const result = await LeaderboardService.calculateLeaderboard(mockEvermarks, 'current')

      // Results should be sorted by votes descending
      expect(result[0].evermarkId).toBe('2') // Highest votes (200)
      expect(result[0].totalVotes).toBe(BigInt(200))
      expect(result[1].evermarkId).toBe('3') // Middle votes (100)
      expect(result[1].totalVotes).toBe(BigInt(100))
      expect(result[2].evermarkId).toBe('1') // Lowest votes (50)
      expect(result[2].totalVotes).toBe(BigInt(50))
    })

    it('should assign correct ranks', async () => {
      vi.mocked(VotingCacheService.getCachedVotingData)
        .mockResolvedValueOnce({ votes: BigInt(300), voterCount: 30 })
        .mockResolvedValueOnce({ votes: BigInt(200), voterCount: 20 })
        .mockResolvedValueOnce({ votes: BigInt(100), voterCount: 10 })

      const result = await LeaderboardService.calculateLeaderboard(mockEvermarks, 'current')

      expect(result[0].rank).toBe(1)
      expect(result[1].rank).toBe(2)
      expect(result[2].rank).toBe(3)
    })

    it('should handle ties in voting', async () => {
      vi.mocked(VotingCacheService.getBulkVotingData).mockResolvedValue(
        new Map([
          ['1', { votes: BigInt(100), voterCount: 10 }],
          ['2', { votes: BigInt(100), voterCount: 10 }], // Same votes as evermark 1
          ['3', { votes: BigInt(50), voterCount: 5 }]
        ])
      )

      const result = await LeaderboardService.calculateLeaderboard(mockEvermarks, 'current')

      expect(result[0].totalVotes).toBe(BigInt(100))
      expect(result[1].totalVotes).toBe(BigInt(100))
      expect(result[2].totalVotes).toBe(BigInt(50))
      // Ranks should still be sequential
      expect(result[0].rank).toBe(1)
      expect(result[1].rank).toBe(2)
      expect(result[2].rank).toBe(3)
    })

    it('should handle empty evermarks array', async () => {
      // Reset the blockchain service mock to return empty array for empty input
      vi.mocked(BlockchainLeaderboardService.calculateBlockchainLeaderboard).mockResolvedValue([])
      
      const result = await LeaderboardService.calculateLeaderboard([], 'current')
      expect(result).toEqual([])
    })

    it('should handle errors gracefully', async () => {
      // Mock getBulkVotingData to return empty Map with no votes to trigger blockchain fallback
      vi.mocked(VotingCacheService.getBulkVotingData).mockResolvedValue(new Map())
      
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const result = await LeaderboardService.calculateLeaderboard(mockEvermarks, 'current')

      // Should fallback to blockchain service (which returns 1 entry from default mock)
      expect(result).toHaveLength(1)
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Using blockchain leaderboard service')
      )
    })

    it('should include evermark metadata in results', async () => {
      vi.mocked(VotingCacheService.getBulkVotingData).mockResolvedValue(
        new Map([['1', { votes: BigInt(100), voterCount: 10 }]])
      )

      const result = await LeaderboardService.calculateLeaderboard(mockEvermarks.slice(0, 1), 'current')

      // The LeaderboardService returns LeaderboardEntry format, not with nested evermark object
      expect(result[0]).toHaveProperty('title')
      expect(result[0]).toHaveProperty('description')
      expect(result[0]).toHaveProperty('creator')
      expect(result[0]).toHaveProperty('totalVotes')
      expect(result[0]).toHaveProperty('voteCount')
      expect(result[0].title).toBe('First Evermark')
      expect(result[0].creator).toBe('Unknown') // Since mockEvermarks doesn't have creator field
    })

    it('should handle blockchain service integration', async () => {
      // Test fallback to blockchain service when cache fails
      vi.mocked(VotingCacheService.getCachedVotingData).mockRejectedValue(new Error('Cache unavailable'))
      vi.mocked(BlockchainLeaderboardService.getLeaderboard).mockResolvedValue([
        {
          rank: 1,
          evermarkId: '1',
          votes: BigInt(250),
          voterCount: 25,
          score: 250,
          scoreMultiplier: 1.0,
          previousRank: 0,
          rankChange: 1,
          trendingScore: 0.9,
          momentum: 'up',
          category: 'blockchain',
          seasonNumber: 6,
          evermark: mockEvermarks[0]
        }
      ])

      // In a real implementation, this might fall back to blockchain service
      const result = await LeaderboardService.calculateLeaderboard(mockEvermarks, 'current')

      // Even with cache errors, should return some results
      expect(result).toHaveLength(3)
    })
  })

  describe('enhanceFinalizedEntries', () => {
    beforeEach(() => {
      // Clear all mocks for this test suite to avoid interference
      vi.clearAllMocks()
      // Restore the enhanceFinalizedEntries method that was spied on in parent beforeEach
      vi.restoreAllMocks()
    })

    it('should enhance finalized entries with evermark metadata', () => {
      const finalizedEntries = [
        {
          rank: 1,
          evermarkId: '1',
          votes: BigInt(200),
          voterCount: 20,
          scoreMultiplier: 1.5,
          seasonNumber: 5
        }
      ]

      const enhanceFinalizedEntries = (LeaderboardService as any).enhanceFinalizedEntries
      const result = enhanceFinalizedEntries(finalizedEntries, mockEvermarks)

      expect(result[0]).toHaveProperty('title')
      expect(result[0]).toHaveProperty('description')
      expect(result[0]).toHaveProperty('creator')
      expect(result[0].title).toBe('First Evermark')
    })

    it('should handle missing evermark data', () => {
      const finalizedEntries = [
        {
          rank: 1,
          evermarkId: '999' // Non-existent evermark
        }
      ]

      const enhanceFinalizedEntries = (LeaderboardService as any).enhanceFinalizedEntries
      const result = enhanceFinalizedEntries(finalizedEntries, mockEvermarks)

      // The implementation returns the entry as-is when evermark not found
      expect(result).toHaveLength(1) 
      expect(result[0].evermarkId).toBe('999')
      expect(result[0].rank).toBe(1)
    })
  })
})