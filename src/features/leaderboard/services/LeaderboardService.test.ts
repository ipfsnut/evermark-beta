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
    isCacheStale: vi.fn(),
    syncEvermarkToCache: vi.fn()
  }
}))

vi.mock('./LeaderboardSyncService', () => ({
  LeaderboardSyncService: {
    syncLeaderboard: vi.fn()
  }
}))

vi.mock('./BlockchainLeaderboardService', () => ({
  BlockchainLeaderboardService: {
    getLeaderboard: vi.fn()
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
        votes: 100,
        supporters: 10,
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
        votes: 50,
        supporters: 5,
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
        votes: 75,
        supporters: 8,
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

    vi.mocked(VotingCacheService.isCacheStale).mockResolvedValue(false)
    vi.mocked(FinalizationService.hasStoredFinalization).mockResolvedValue(false)
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

      // Mock cached voting data for each evermark
      vi.mocked(VotingCacheService.getCachedVotingData)
        .mockResolvedValueOnce({ votes: BigInt(200), voterCount: 20 }) // evermark 1
        .mockResolvedValueOnce({ votes: BigInt(150), voterCount: 15 }) // evermark 2
        .mockResolvedValueOnce({ votes: BigInt(100), voterCount: 10 }) // evermark 3

      const result = await LeaderboardService.calculateLeaderboard(mockEvermarks, 'current')

      expect(result).toHaveLength(3)
      expect(result[0].rank).toBe(1)
      expect(result[0].evermarkId).toBe('1')
      expect(result[0].votes).toBe(BigInt(200))
      expect(result[1].rank).toBe(2)
      expect(result[2].rank).toBe(3)
    })

    it('should handle specific season calculations', async () => {
      vi.mocked(VotingService.getEvermarkVotes)
        .mockResolvedValueOnce(BigInt(180)) // evermark 1
        .mockResolvedValueOnce(BigInt(120)) // evermark 2
        .mockResolvedValueOnce(BigInt(90))  // evermark 3

      const result = await LeaderboardService.calculateLeaderboard(mockEvermarks, 'season-3')

      expect(VotingService.getEvermarkVotes).toHaveBeenCalledWith('1', 3)
      expect(VotingService.getEvermarkVotes).toHaveBeenCalledWith('2', 3)
      expect(VotingService.getEvermarkVotes).toHaveBeenCalledWith('3', 3)
      expect(result).toHaveLength(3)
    })

    it('should sort entries by votes descending', async () => {
      // Return votes in non-sorted order to test sorting
      vi.mocked(VotingCacheService.getCachedVotingData)
        .mockResolvedValueOnce({ votes: BigInt(50), voterCount: 5 })   // evermark 1
        .mockResolvedValueOnce({ votes: BigInt(200), voterCount: 20 }) // evermark 2
        .mockResolvedValueOnce({ votes: BigInt(100), voterCount: 10 }) // evermark 3

      const result = await LeaderboardService.calculateLeaderboard(mockEvermarks, 'current')

      expect(result[0].evermarkId).toBe('2') // Highest votes
      expect(result[0].votes).toBe(BigInt(200))
      expect(result[1].evermarkId).toBe('3') // Middle votes
      expect(result[1].votes).toBe(BigInt(100))
      expect(result[2].evermarkId).toBe('1') // Lowest votes
      expect(result[2].votes).toBe(BigInt(50))
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
      vi.mocked(VotingCacheService.getCachedVotingData)
        .mockResolvedValueOnce({ votes: BigInt(100), voterCount: 10 })
        .mockResolvedValueOnce({ votes: BigInt(100), voterCount: 10 }) // Same votes
        .mockResolvedValueOnce({ votes: BigInt(50), voterCount: 5 })

      const result = await LeaderboardService.calculateLeaderboard(mockEvermarks, 'current')

      expect(result[0].votes).toBe(BigInt(100))
      expect(result[1].votes).toBe(BigInt(100))
      expect(result[2].votes).toBe(BigInt(50))
      // Ranks should still be sequential
      expect(result[0].rank).toBe(1)
      expect(result[1].rank).toBe(2)
      expect(result[2].rank).toBe(3)
    })

    it('should handle empty evermarks array', async () => {
      const result = await LeaderboardService.calculateLeaderboard([], 'current')
      expect(result).toEqual([])
    })

    it('should handle errors gracefully', async () => {
      vi.mocked(VotingCacheService.getCachedVotingData).mockRejectedValue(new Error('Cache error'))
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const result = await LeaderboardService.calculateLeaderboard(mockEvermarks, 'current')

      // Should still return results with fallback values
      expect(result).toHaveLength(3)
      expect(consoleSpy).toHaveBeenCalled()
    })

    it('should include evermark metadata in results', async () => {
      vi.mocked(VotingCacheService.getCachedVotingData)
        .mockResolvedValue({ votes: BigInt(100), voterCount: 10 })

      const result = await LeaderboardService.calculateLeaderboard(mockEvermarks, 'current')

      expect(result[0]).toHaveProperty('evermark')
      expect(result[0].evermark).toEqual(mockEvermarks[0])
      expect(result[0]).toHaveProperty('score')
      expect(result[0]).toHaveProperty('trendingScore')
      expect(result[0]).toHaveProperty('momentum')
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

      expect(result[0]).toHaveProperty('evermark')
      expect(result[0].evermark).toEqual(mockEvermarks[0])
      expect(result[0]).toHaveProperty('score')
      expect(result[0]).toHaveProperty('trendingScore')
    })

    it('should handle missing evermark data', () => {
      const finalizedEntries = [
        {
          rank: 1,
          evermarkId: '999', // Non-existent evermark
          votes: BigInt(200),
          voterCount: 20,
          scoreMultiplier: 1.5,
          seasonNumber: 5
        }
      ]

      const enhanceFinalizedEntries = (LeaderboardService as any).enhanceFinalizedEntries
      const result = enhanceFinalizedEntries(finalizedEntries, mockEvermarks)

      expect(result).toHaveLength(0) // Should filter out missing evermarks
    })
  })
})