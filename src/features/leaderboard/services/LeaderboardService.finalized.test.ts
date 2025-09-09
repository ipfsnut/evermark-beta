import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LeaderboardService, type FinalizedSeason } from './LeaderboardService'
import type { LeaderboardEntry } from '../types'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('LeaderboardService - Finalized Season Methods', () => {
  const mockFinalizedSeasons: FinalizedSeason[] = [
    {
      seasonNumber: 3,
      startTime: '2024-01-01T00:00:00Z',
      endTime: '2024-01-31T23:59:59Z',
      totalVotes: '1000',
      totalEvermarksCount: 10,
      topEvermarkId: '1',
      topEvermarkVotes: '500',
      finalizedAt: '2024-02-01T00:00:00Z',
      duration: 2678400000,
      label: 'Season 3',
      description: '10 evermarks, 1,000 total votes'
    },
    {
      seasonNumber: 2,
      startTime: '2023-12-01T00:00:00Z',
      endTime: '2023-12-31T23:59:59Z',
      totalVotes: '800',
      totalEvermarksCount: 8,
      topEvermarkId: '2',
      topEvermarkVotes: '400',
      finalizedAt: '2024-01-01T00:00:00Z',
      duration: 2678400000,
      label: 'Season 2',
      description: '8 evermarks, 800 total votes'
    }
  ]

  const mockLeaderboardEntries = [
    {
      id: '1',
      tokenId: 1,
      title: 'First Evermark',
      author: 'Creator 1',
      owner: '0x1111111111111111111111111111111111111111',
      description: 'Test description 1',
      contentType: 'URL',
      sourceUrl: 'https://example.com/1',
      createdAt: '2024-01-15T00:00:00Z',
      verified: true,
      supabaseImageUrl: 'https://example.com/image1.jpg',
      ipfsHash: 'QmTest1',
      totalVotes: 500,
      rank: 1,
      percentageOfTotal: 50.0,
      finalizedAt: '2024-02-01T00:00:00Z',
      voterCount: 25,
      tags: []
    },
    {
      id: '2',
      tokenId: 2,
      title: 'Second Evermark',
      author: 'Creator 2',
      owner: '0x2222222222222222222222222222222222222222',
      description: 'Test description 2',
      contentType: 'DOI',
      sourceUrl: 'https://example.com/2',
      createdAt: '2024-01-20T00:00:00Z',
      verified: false,
      supabaseImageUrl: 'https://example.com/image2.jpg',
      ipfsHash: 'QmTest2',
      totalVotes: 300,
      rank: 2,
      percentageOfTotal: 30.0,
      finalizedAt: '2024-02-01T00:00:00Z',
      voterCount: 15,
      tags: []
    }
  ]

  const mockSeasonInfo = {
    seasonNumber: 3,
    startTime: '2024-01-01T00:00:00Z',
    endTime: '2024-01-31T23:59:59Z',
    totalVotes: 1000,
    totalEvermarksCount: 10,
    topEvermarkId: '1',
    topEvermarkVotes: 500,
    finalizedAt: '2024-02-01T00:00:00Z'
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getAvailableFinalizedSeasons', () => {
    it('should fetch and return available finalized seasons', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          seasons: mockFinalizedSeasons,
          total: 2
        })
      })

      const result = await LeaderboardService.getAvailableFinalizedSeasons()

      expect(mockFetch).toHaveBeenCalledWith('/.netlify/functions/finalized-seasons')
      expect(result).toEqual(mockFinalizedSeasons)
    })

    it('should return empty array when no seasons found', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          seasons: [],
          total: 0
        })
      })

      const result = await LeaderboardService.getAvailableFinalizedSeasons()

      expect(result).toEqual([])
    })

    it('should handle HTTP errors gracefully', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500
      })

      const result = await LeaderboardService.getAvailableFinalizedSeasons()

      expect(result).toEqual([])
    })

    it('should handle network errors gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'))

      const result = await LeaderboardService.getAvailableFinalizedSeasons()

      expect(result).toEqual([])
    })

    it('should handle malformed response gracefully', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          // Missing seasons field
          total: 0
        })
      })

      const result = await LeaderboardService.getAvailableFinalizedSeasons()

      expect(result).toEqual([])
    })
  })

  describe('getFinalizedLeaderboard', () => {
    it('should fetch finalized leaderboard for specific season', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          evermarks: mockLeaderboardEntries,
          season: 3,
          seasonInfo: mockSeasonInfo,
          total: 2
        })
      })

      const result = await LeaderboardService.getFinalizedLeaderboard(3)

      expect(mockFetch).toHaveBeenCalledWith('/.netlify/functions/finalized-leaderboard-data?season=3')
      expect(result.entries).toHaveLength(2)
      expect(result.entries[0]).toMatchObject({
        id: '1',
        rank: 1,
        evermarkId: '1',
        title: 'First Evermark',
        totalVotes: BigInt(500)
      })
      expect(result.seasonInfo).toEqual(mockSeasonInfo)
    })

    it('should handle season not found (404)', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404
      })

      const result = await LeaderboardService.getFinalizedLeaderboard(99)

      expect(result.entries).toEqual([])
      expect(result.totalCount).toBe(0)
      expect(result.filters).toEqual({ period: 'season-99' })
    })

    it('should handle other HTTP errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500
      })

      const result = await LeaderboardService.getFinalizedLeaderboard(3)

      expect(result.entries).toEqual([])
      expect(result.totalCount).toBe(0)
    })

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'))

      const result = await LeaderboardService.getFinalizedLeaderboard(3)

      expect(result.entries).toEqual([])
      expect(result.totalCount).toBe(0)
    })

    it('should convert vote amounts to BigInt correctly', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          evermarks: [{
            ...mockLeaderboardEntries[0],
            totalVotes: '1500000000000000000000' // Large number as string
          }],
          season: 3,
          total: 1
        })
      })

      const result = await LeaderboardService.getFinalizedLeaderboard(3)

      expect(result.entries[0].totalVotes).toBe(BigInt('1500000000000000000000'))
    })

    it('should handle missing evermark data gracefully', async () => {
      const incompleteEvermark = {
        id: '3',
        rank: 3,
        totalVotes: 100
        // Missing required fields like title, creator, etc.
      }

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          evermarks: [incompleteEvermark],
          season: 3,
          total: 1
        })
      })

      const result = await LeaderboardService.getFinalizedLeaderboard(3)

      expect(result.entries[0]).toMatchObject({
        id: '3',
        rank: 3,
        title: 'Untitled',
        creator: 'Unknown',
        totalVotes: BigInt(100)
      })
    })

    it('should set correct pagination properties for finalized data', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          evermarks: mockLeaderboardEntries,
          season: 3,
          total: 2
        })
      })

      const result = await LeaderboardService.getFinalizedLeaderboard(3)

      expect(result.totalPages).toBe(1)
      expect(result.currentPage).toBe(1)
      expect(result.pageSize).toBe(2) // Same as entries length
      expect(result.hasNextPage).toBe(false)
      expect(result.hasPreviousPage).toBe(false)
    })
  })

  describe('isSeasonFinalized', () => {
    beforeEach(() => {
      // Mock getAvailableFinalizedSeasons for these tests
      vi.spyOn(LeaderboardService, 'getAvailableFinalizedSeasons').mockResolvedValue(mockFinalizedSeasons)
    })

    it('should return true for finalized season', async () => {
      const result = await LeaderboardService.isSeasonFinalized(3)
      expect(result).toBe(true)
    })

    it('should return false for non-finalized season', async () => {
      const result = await LeaderboardService.isSeasonFinalized(5)
      expect(result).toBe(false)
    })

    it('should handle errors gracefully', async () => {
      vi.mocked(LeaderboardService.getAvailableFinalizedSeasons).mockRejectedValue(new Error('API error'))

      const result = await LeaderboardService.isSeasonFinalized(3)
      expect(result).toBe(false)
    })

    it('should return false when no seasons available', async () => {
      vi.mocked(LeaderboardService.getAvailableFinalizedSeasons).mockResolvedValue([])

      const result = await LeaderboardService.isSeasonFinalized(1)
      expect(result).toBe(false)
    })
  })

  describe('Edge cases and error handling', () => {
    it('should handle malformed JSON response', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.reject(new Error('Invalid JSON'))
      })

      const result = await LeaderboardService.getFinalizedLeaderboard(3)
      expect(result.entries).toEqual([])
    })

    it('should handle response without evermarks field', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          season: 3,
          total: 0
          // Missing evermarks field
        })
      })

      const result = await LeaderboardService.getFinalizedLeaderboard(3)
      expect(result.entries).toEqual([])
    })

    it('should handle null/undefined vote amounts', async () => {
      const entryWithNullVotes = {
        ...mockLeaderboardEntries[0],
        totalVotes: null,
        voterCount: undefined
      }

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          evermarks: [entryWithNullVotes],
          season: 3,
          total: 1
        })
      })

      const result = await LeaderboardService.getFinalizedLeaderboard(3)
      expect(result.entries[0].totalVotes).toBe(BigInt(0))
      expect(result.entries[0].voteCount).toBe(0)
    })

    it('should set historical change indicators for finalized data', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          evermarks: mockLeaderboardEntries,
          season: 3,
          total: 2
        })
      })

      const result = await LeaderboardService.getFinalizedLeaderboard(3)
      
      // All finalized entries should have 'same' change direction
      result.entries.forEach(entry => {
        expect(entry.change.direction).toBe('same')
        expect(entry.change.positions).toBe(0)
      })
    })
  })
})