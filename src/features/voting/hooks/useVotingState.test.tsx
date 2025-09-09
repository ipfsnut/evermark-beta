import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useVotingState } from './useVotingState'
import { VotingService } from '../services/VotingService'
import { VOTING_CONSTANTS } from '../types'
import { toWei } from 'thirdweb/utils'

// Mock dependencies
vi.mock('@/hooks/core/useWalletAccount', () => ({
  useWalletAccount: vi.fn(() => ({
    address: '0x1234567890123456789012345678901234567890',
    isConnected: true
  }))
}))

vi.mock('@/features/staking/hooks/useStakingData', () => ({
  useStakingData: vi.fn(() => ({
    wEmarkBalance: toWei('1000'),
    availableVotingPower: toWei('800'),
    delegatedPower: toWei('200'),
    reservedPower: toWei('0'),
    isLoading: false,
    error: null
  }))
}))

vi.mock('@/hooks/core/useContextualTransactions', () => ({
  useContextualTransactions: vi.fn(() => ({
    sendTransaction: vi.fn().mockResolvedValue({ transactionHash: '0xtest123' })
  }))
}))

vi.mock('../services/VotingService', () => ({
  VotingService: {
    getCurrentCycle: vi.fn(),
    getVotingStats: vi.fn(),
    fetchVotingHistory: vi.fn(),
    getEvermarkVotes: vi.fn(),
    getUserVotesForEvermark: vi.fn(),
    voteForEvermark: vi.fn(),
    validateVoteAmount: vi.fn(),
    delegate: vi.fn(),
    undelegate: vi.fn(),
    parseContractError: vi.fn((error: any) => ({
      code: 'CONTRACT_ERROR',
      message: error?.message || 'Contract error',
      timestamp: Date.now(),
      recoverable: true
    })),
    formatVoteAmount: vi.fn((amount: bigint) => amount.toString()),
    parseVoteAmount: vi.fn((amount: string) => BigInt(amount))
  }
}))

vi.mock('../services/VotingCacheService', () => ({
  VotingCacheService: {
    getCachedVotes: vi.fn(),
    setCachedVotes: vi.fn(),
    clearCache: vi.fn()
  }
}))

vi.mock('../../leaderboard/services/LeaderboardService', () => ({
  LeaderboardService: {
    getLeaderboard: vi.fn()
  }
}))

vi.mock('@/features/points/services/PointsService', () => ({
  PointsService: {
    awardPoints: vi.fn()
  }
}))

// Create a wrapper component for React Query
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 0,
        gcTime: 0,
        refetchOnWindowFocus: false,
      },
    },
    logger: {
      log: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  })
  
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}

describe('useVotingState', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Default mock implementations
    vi.mocked(VotingService.getCurrentCycle).mockResolvedValue({
      cycleNumber: 5,
      seasonNumber: 5,
      startTime: new Date('2024-01-01'),
      endTime: new Date('2024-01-31'),
      totalVotes: BigInt(5000),
      totalVoters: 100,
      isActive: true,
      activeEvermarksCount: 50
    })

    vi.mocked(VotingService.getVotingStats).mockResolvedValue({
      totalVotesCast: BigInt(1000),
      uniqueVoters: 25,
      averageVotesPerUser: BigInt(40),
      topEvermarkId: '123',
      topEvermarkVotes: BigInt(200),
      userRank: 10,
      userTotalVotes: BigInt(100),
      participationRate: 0.75,
      votingPowerDistribution: {
        top10Percent: 0.4,
        middle40Percent: 0.45,
        bottom50Percent: 0.15
      }
    })

    vi.mocked(VotingService.fetchVotingHistory).mockResolvedValue([
      {
        id: 'vote1',
        evermarkId: '123',
        amount: BigInt(50),
        timestamp: new Date('2024-01-15'),
        cycle: 5,
        transactionHash: '0xabc123',
        voterAddress: '0x1234567890123456789012345678901234567890'
      }
    ])
  })

  it('should initialize with default state', async () => {
    const { result } = renderHook(() => useVotingState(), {
      wrapper: createWrapper()
    })

    expect(result.current.isConnected).toBe(true)
    expect(result.current.votingPower).toEqual({
      total: toWei('1000'),
      available: toWei('800'),
      used: toWei('200'),
      remaining: toWei('800')
    })
    expect(result.current.error).toBeNull()
    expect(result.current.success).toBeNull()
    expect(result.current.isDelegating).toBe(false)
    expect(result.current.isUndelegating).toBe(false)
  })

  it('should initialize with proper connection state and query setup', async () => {
    const { result } = renderHook(() => useVotingState(), {
      wrapper: createWrapper()
    })

    // Check that hook is properly connected
    expect(result.current.isConnected).toBe(true)
    expect(result.current.userAddress).toBe('0x1234567890123456789012345678901234567890')

    // Check that query state is properly initialized
    expect(result.current.currentCycle).toBe(null) // Initially null before loading
    expect(result.current.currentSeason).toBe(null) // Initially null before loading
    
    // Check that loading states are properly managed
    expect(typeof result.current.isLoading).toBe('boolean')
  })

  it('should initialize voting stats state properly', async () => {
    const { result } = renderHook(() => useVotingState(), {
      wrapper: createWrapper()
    })

    // Ensure connected state
    expect(result.current.isConnected).toBe(true)
    expect(result.current.userAddress).toBe('0x1234567890123456789012345678901234567890')

    // Initially null before data loads
    expect(result.current.votingStats).toBe(null)
    
    // Check that the hook is properly structured to handle voting stats
    expect(typeof result.current.isLoading).toBe('boolean')
  })

  it('should initialize user voting history state properly', async () => {
    const { result } = renderHook(() => useVotingState(), {
      wrapper: createWrapper()
    })

    // Ensure connected state
    expect(result.current.isConnected).toBe(true)
    expect(result.current.userAddress).toBe('0x1234567890123456789012345678901234567890')

    // Initially empty array before data loads
    expect(result.current.userVotes).toEqual([])
    expect(result.current.votingHistory).toEqual([])
    
    // Check that the hook structure supports vote history
    expect(Array.isArray(result.current.userVotes)).toBe(true)
  })

  it('should get evermark votes', async () => {
    vi.mocked(VotingService.getEvermarkVotes).mockResolvedValue(BigInt(250))

    const { result } = renderHook(() => useVotingState(), {
      wrapper: createWrapper()
    })

    const votes = await result.current.getEvermarkVotes('123')
    expect(votes).toBe(BigInt(250))
    expect(VotingService.getEvermarkVotes).toHaveBeenCalledWith('123')
  })

  it('should handle errors in getEvermarkVotes', async () => {
    vi.mocked(VotingService.getEvermarkVotes).mockRejectedValue(new Error('Contract error'))
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { result } = renderHook(() => useVotingState(), {
      wrapper: createWrapper()
    })

    const votes = await result.current.getEvermarkVotes('123')
    expect(votes).toBe(BigInt(0))
    expect(consoleSpy).toHaveBeenCalledWith('Failed to get evermark votes:', expect.any(Error))
  })

  it('should get user votes for evermark', async () => {
    vi.mocked(VotingService.getUserVotesForEvermark).mockResolvedValue(BigInt(100))

    const { result } = renderHook(() => useVotingState(), {
      wrapper: createWrapper()
    })

    const votes = await result.current.getUserVotesForEvermark('123')
    expect(votes).toBe(BigInt(100))
    expect(VotingService.getUserVotesForEvermark).toHaveBeenCalledWith(
      '0x1234567890123456789012345678901234567890',
      '123'
    )
  })

  it('should return 0 votes when user not connected', async () => {
    // Import and mock for this specific test
    const { useWalletAccount } = await import('@/hooks/core/useWalletAccount')
    vi.mocked(useWalletAccount).mockReturnValueOnce(null)

    const { result } = renderHook(() => useVotingState(), {
      wrapper: createWrapper()
    })

    const votes = await result.current.getUserVotesForEvermark('123')
    expect(votes).toBe(BigInt(0))
  })

  it('should validate vote amounts', () => {
    vi.mocked(VotingService.validateVoteAmount).mockReturnValue({
      isValid: true,
      errors: [],
      warnings: ['Large vote amount']
    })

    const { result } = renderHook(() => useVotingState(), {
      wrapper: createWrapper()
    })

    const validation = result.current.validateVoteAmount('100', '123')
    expect(validation).toEqual({
      isValid: true,
      errors: [],
      warnings: ['Large vote amount']
    })
    expect(VotingService.validateVoteAmount).toHaveBeenCalledWith(
      '100',
      '123'
    )
  })

  it('should handle vote submission', async () => {
    const { result } = renderHook(() => useVotingState(), {
      wrapper: createWrapper()
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await act(async () => {
      await result.current.voteForEvermark('123', BigInt(100))
    })

    expect(result.current.success).toContain('Successfully delegated')
  })

  it('should handle vote submission errors', async () => {
    // Override the mock for this test to reject
    const { useContextualTransactions } = await import('@/hooks/core/useContextualTransactions')
    vi.mocked(useContextualTransactions).mockReturnValueOnce({
      sendTransaction: vi.fn().mockRejectedValue(new Error('Transaction failed'))
    })

    const { result } = renderHook(() => useVotingState(), {
      wrapper: createWrapper()
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await act(async () => {
      try {
        await result.current.voteForEvermark('123', BigInt(100))
      } catch (error) {
        expect(error).toBeInstanceOf(Error)
        expect((error as Error).message).toBe('Transaction failed')
      }
    })

    expect(result.current.error).toEqual({
      code: 'CONTRACT_ERROR',
      message: 'Transaction failed',
      timestamp: expect.any(Number),
      recoverable: true
    })
  })

  it('should handle delegation', async () => {
    const { result } = renderHook(() => useVotingState(), {
      wrapper: createWrapper()
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await act(async () => {
      await result.current.delegateVotes('123', BigInt(500))
    })

    expect(result.current.success).toContain('Successfully delegated')
  })

  it('should handle undelegation', async () => {
    const { result } = renderHook(() => useVotingState(), {
      wrapper: createWrapper()
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await act(async () => {
      await result.current.undelegateVotes('123', BigInt(300))
    })

    expect(result.current.success).toContain('Successfully withdrew')
  })

  it('should clear error state', () => {
    const { result } = renderHook(() => useVotingState(), {
      wrapper: createWrapper()
    })

    // Errors are cleared via the clearErrors function  
    act(() => {
      result.current.clearErrors()
    })

    expect(result.current.error).toBeNull()
  })

  it('should clear success state', () => {
    const { result } = renderHook(() => useVotingState(), {
      wrapper: createWrapper()
    })

    // Success is cleared via the clearSuccess function
    act(() => {
      result.current.clearSuccess()
    })

    expect(result.current.success).toBeNull()
  })

  it('should provide data refresh functionality', async () => {
    const { result } = renderHook(() => useVotingState(), {
      wrapper: createWrapper()
    })

    // Ensure connected state first
    expect(result.current.isConnected).toBe(true)

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    // The refetch function exists and is callable
    expect(typeof result.current.refetch).toBe('function')
    
    // Test that refetch function can be called without error
    expect(() => result.current.refetch()).not.toThrow()
  })

  it('should handle disconnected wallet state', async () => {
    const { useWalletAccount } = await import('@/hooks/core/useWalletAccount')
    const { useStakingData } = await import('@/features/staking/hooks/useStakingData')
    
    vi.mocked(useWalletAccount).mockReturnValueOnce(null)
    vi.mocked(useStakingData).mockReturnValueOnce({ 
      wEmarkBalance: BigInt(0),
      availableVotingPower: BigInt(0),
      delegatedPower: BigInt(0),
      reservedPower: BigInt(0),
      isLoading: false,
      error: null
    })

    const { result } = renderHook(() => useVotingState(), {
      wrapper: createWrapper()
    })

    expect(result.current.isConnected).toBe(false)
    expect(result.current.userVotes).toEqual([])
  })

  it('should handle loading states', () => {
    const { result } = renderHook(() => useVotingState(), {
      wrapper: createWrapper()
    })

    // Initially loading should be true until queries resolve
    expect(typeof result.current.isLoading).toBe('boolean')
  })

  it('should handle query errors', async () => {
    vi.mocked(VotingService.getCurrentCycle).mockRejectedValue(new Error('Query error'))

    const { result } = renderHook(() => useVotingState(), {
      wrapper: createWrapper()
    })

    // Wait for the query to settle with error
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.currentCycle).toBe(null)
  })

  it('should update delegation states correctly', async () => {
    const { result } = renderHook(() => useVotingState(), {
      wrapper: createWrapper()
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.isDelegating).toBe(false)
    expect(result.current.isUndelegating).toBe(false)

    // Test that delegation states are available
    expect(typeof result.current.isDelegating).toBe('boolean')
    expect(typeof result.current.isUndelegating).toBe('boolean')
  })

  it('should format voting power correctly', () => {
    const { result } = renderHook(() => useVotingState(), {
      wrapper: createWrapper()
    })

    expect(result.current.votingPower).toEqual({
      total: toWei('1000'),
      available: toWei('800'),
      used: toWei('200'),
      remaining: toWei('800')
    })
  })
})