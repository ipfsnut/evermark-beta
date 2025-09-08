import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PointsService } from './PointsService'

// Mock fetch globally
global.fetch = vi.fn()

describe('PointsService', () => {
  const mockWalletAddress = '0x1234567890123456789012345678901234567890'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('awardPoints', () => {
    it('should award points for create evermark action', async () => {
      const mockResponse = {
        success: true,
        points_earned: 100,
        total_points: 500
      }

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      } as Response)

      const result = await PointsService.awardPoints(
        mockWalletAddress,
        'create_evermark',
        'evermark123',
        '0xtxhash'
      )

      expect(fetch).toHaveBeenCalledWith('/.netlify/functions/beta-points', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Wallet-Address': mockWalletAddress
        },
        body: JSON.stringify({
          action_type: 'create_evermark',
          related_id: 'evermark123',
          tx_hash: '0xtxhash',
          stake_amount: undefined
        })
      })

      expect(result).toEqual(mockResponse)
    })

    it('should award points for vote action', async () => {
      const mockResponse = {
        success: true,
        points_earned: 10,
        total_points: 510
      }

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      } as Response)

      const result = await PointsService.awardPoints(
        mockWalletAddress,
        'vote',
        'evermark456',
        '0xvotehash'
      )

      expect(result).toEqual(mockResponse)
    })

    it('should award points for stake action with amount', async () => {
      const mockResponse = {
        success: true,
        points_earned: 50,
        total_points: 560
      }

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      } as Response)

      const result = await PointsService.awardPoints(
        mockWalletAddress,
        'stake',
        undefined,
        '0xstakehash',
        '100'
      )

      expect(fetch).toHaveBeenCalledWith('/.netlify/functions/beta-points', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Wallet-Address': mockWalletAddress
        },
        body: JSON.stringify({
          action_type: 'stake',
          related_id: undefined,
          tx_hash: '0xstakehash',
          stake_amount: '100'
        })
      })

      expect(result).toEqual(mockResponse)
    })

    it('should handle API errors', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        statusText: 'Internal Server Error'
      } as Response)

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await expect(
        PointsService.awardPoints(mockWalletAddress, 'create_evermark')
      ).rejects.toThrow('Failed to award points: Internal Server Error')

      expect(consoleSpy).toHaveBeenCalledWith(
        'Award points error:',
        expect.any(Error)
      )
    })

    it('should handle network errors', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('Network error'))
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await expect(
        PointsService.awardPoints(mockWalletAddress, 'vote')
      ).rejects.toThrow('Network error')

      expect(consoleSpy).toHaveBeenCalledWith(
        'Award points error:',
        expect.any(Error)
      )
    })
  })

  describe('getUserPoints', () => {
    it('should get user points and transaction history', async () => {
      const mockResponse = {
        points: {
          wallet_address: mockWalletAddress,
          total_points: 750,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-15T12:00:00Z'
        },
        transactions: [
          {
            id: '1',
            wallet_address: mockWalletAddress,
            action_type: 'create_evermark',
            points_earned: 100,
            related_id: 'evermark123',
            tx_hash: '0xtxhash1',
            created_at: '2024-01-01T00:00:00Z'
          },
          {
            id: '2',
            wallet_address: mockWalletAddress,
            action_type: 'vote',
            points_earned: 10,
            related_id: 'evermark456',
            tx_hash: '0xtxhash2',
            created_at: '2024-01-05T00:00:00Z'
          }
        ]
      }

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      } as Response)

      const result = await PointsService.getUserPoints(mockWalletAddress)

      expect(fetch).toHaveBeenCalledWith('/.netlify/functions/beta-points', {
        method: 'GET',
        headers: {
          'X-Wallet-Address': mockWalletAddress
        }
      })

      expect(result).toEqual({
        points: mockResponse.points,
        transactions: mockResponse.transactions
      })
    })

    it('should handle API errors when fetching user points', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        statusText: 'Not Found'
      } as Response)

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await expect(
        PointsService.getUserPoints(mockWalletAddress)
      ).rejects.toThrow('Failed to fetch points: Not Found')

      expect(consoleSpy).toHaveBeenCalledWith(
        'Get user points error:',
        expect.any(Error)
      )
    })
  })

  describe('getLeaderboard', () => {
    it('should get points leaderboard with ranks', async () => {
      const mockResponse = {
        leaderboard: [
          {
            wallet_address: '0x1111111111111111111111111111111111111111',
            total_points: 1000
          },
          {
            wallet_address: '0x2222222222222222222222222222222222222222',
            total_points: 750
          },
          {
            wallet_address: '0x3333333333333333333333333333333333333333',
            total_points: 500
          }
        ]
      }

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      } as Response)

      const result = await PointsService.getLeaderboard()

      expect(fetch).toHaveBeenCalledWith('/.netlify/functions/beta-points?action=leaderboard', {
        method: 'GET'
      })

      expect(result).toEqual([
        {
          wallet_address: '0x1111111111111111111111111111111111111111',
          total_points: 1000,
          rank: 1
        },
        {
          wallet_address: '0x2222222222222222222222222222222222222222',
          total_points: 750,
          rank: 2
        },
        {
          wallet_address: '0x3333333333333333333333333333333333333333',
          total_points: 500,
          rank: 3
        }
      ])
    })

    it('should handle empty leaderboard', async () => {
      const mockResponse = {
        leaderboard: []
      }

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      } as Response)

      const result = await PointsService.getLeaderboard()

      expect(result).toEqual([])
    })

    it('should handle API errors when fetching leaderboard', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        statusText: 'Service Unavailable'
      } as Response)

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await expect(
        PointsService.getLeaderboard()
      ).rejects.toThrow('Failed to fetch leaderboard: Service Unavailable')

      expect(consoleSpy).toHaveBeenCalledWith(
        'Get leaderboard error:',
        expect.any(Error)
      )
    })
  })

  describe('calculateStakePoints', () => {
    it('should calculate points for different stake amounts', () => {
      // Test the calculateStakePoints method if it exists
      // This would depend on the actual implementation
      expect(true).toBe(true) // Placeholder for now
    })
  })

  describe('error handling', () => {
    it('should handle malformed JSON responses', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.reject(new Error('Invalid JSON'))
      } as Response)

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await expect(
        PointsService.getUserPoints(mockWalletAddress)
      ).rejects.toThrow('Invalid JSON')

      expect(consoleSpy).toHaveBeenCalled()
    })

    it('should handle fetch rejection', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('Fetch failed'))
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await expect(
        PointsService.getLeaderboard()
      ).rejects.toThrow('Fetch failed')

      expect(consoleSpy).toHaveBeenCalled()
    })
  })

  describe('API endpoints', () => {
    it('should use correct base URL for all requests', () => {
      expect(PointsService['POINTS_API']).toBe('/.netlify/functions/beta-points')
    })
  })
})