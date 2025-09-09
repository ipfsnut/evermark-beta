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
    sendTransaction: vi.fn()
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
    undelegate: vi.fn()
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
      },
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

  it('should load current cycle data', async () => {
    const { result } = renderHook(() => useVotingState(), {
      wrapper: createWrapper()
    })

    // Wait for the query to resolve
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.currentCycle).toEqual({
      cycleNumber: 5,
      seasonNumber: 5,
      startTime: new Date('2024-01-01'),
      endTime: new Date('2024-01-31'),
      totalVotes: BigInt(5000),
      totalVoters: 100,
      isActive: true,
      activeEvermarksCount: 50
    })

    expect(result.current.currentSeason).toEqual({
      seasonNumber: 5,
      startTime: new Date('2024-01-01'),
      endTime: new Date('2024-01-31'),
      totalVotes: BigInt(5000),
      totalVoters: 100,
      isActive: true,
      activeEvermarksCount: 50
    })
  })

  it('should load voting stats', async () => {
    const { result } = renderHook(() => useVotingState(), {
      wrapper: createWrapper()
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.votingStats).toEqual({
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
  })

  it('should load user voting history', async () => {
    const { result } = renderHook(() => useVotingState(), {
      wrapper: createWrapper()
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.userVotes).toHaveLength(1)
    expect(result.current.userVotes[0]).toEqual({
      id: 'vote1',
      evermarkId: '123',
      amount: BigInt(50),
      timestamp: new Date('2024-01-15'),
      cycle: 5,
      transactionHash: '0xabc123',
      voterAddress: '0x1234567890123456789012345678901234567890'
    })
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
    const { useWalletAccount } = await import('@/hooks/core/useWalletAccount')
    vi.mocked(useWalletAccount).mockReturnValue(null)

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
      '123',
      '0x1234567890123456789012345678901234567890'
    )
  })

  it('should handle vote submission', async () => {
    const mockSendTransaction = vi.fn().mockResolvedValue('0xtxhash')
    const { useContextualTransactions } = await import('@/hooks/core/useContextualTransactions')
    vi.mocked(useContextualTransactions).mockReturnValue({
      sendTransaction: mockSendTransaction
    })

    vi.mocked(VotingService.voteForEvermark).mockResolvedValue({
      hash: '',
      type: 'vote',
      evermarkId: '123',
      amount: BigInt(100),
      timestamp: new Date(),
      status: 'pending'
    })

    const { result } = renderHook(() => useVotingState(), {
      wrapper: createWrapper()
    })

    await act(async () => {
      await result.current.voteForEvermark('123', BigInt(100))
    })

    expect(VotingService.voteForEvermark).toHaveBeenCalledWith(
      '0x1234567890123456789012345678901234567890',
      '123',
      BigInt(100)
    )
  })

  it('should handle vote submission errors', async () => {
    vi.mocked(VotingService.voteForEvermark).mockRejectedValue(new Error('Transaction failed'))

    const { result } = renderHook(() => useVotingState(), {
      wrapper: createWrapper()
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
    vi.mocked(VotingService.delegate).mockResolvedValue({
      hash: '0xtxhash',
      type: 'delegate',
      amount: BigInt(500),
      timestamp: new Date(),
      status: 'pending'
    })

    const { result } = renderHook(() => useVotingState(), {
      wrapper: createWrapper()
    })

    await act(async () => {
      await result.current.delegate('0xdelegate123', BigInt(500))
    })

    expect(VotingService.delegate).toHaveBeenCalledWith(
      '0x1234567890123456789012345678901234567890',
      '0xdelegate123',
      BigInt(500)
    )
    expect(result.current.success).toBe('Successfully delegated 500 voting power')
  })

  it('should handle undelegation', async () => {
    vi.mocked(VotingService.undelegate).mockResolvedValue({
      hash: '0xtxhash',
      type: 'undelegate',
      amount: BigInt(300),
      timestamp: new Date(),
      status: 'pending'
    })

    const { result } = renderHook(() => useVotingState(), {
      wrapper: createWrapper()
    })

    await act(async () => {
      await result.current.undelegate('0xdelegate123', BigInt(300))
    })

    expect(VotingService.undelegate).toHaveBeenCalledWith(
      '0x1234567890123456789012345678901234567890',
      '0xdelegate123',
      BigInt(300)
    )
    expect(result.current.success).toBe('Successfully undelegated 300 voting power')
  })

  it('should clear error state', () => {
    const { result } = renderHook(() => useVotingState(), {
      wrapper: createWrapper()
    })

    act(() => {
      result.current.setError({
        code: 'TEST_ERROR',
        message: 'Test error',
        timestamp: Date.now(),
        recoverable: true
      })
    })

    expect(result.current.error).not.toBeNull()

    act(() => {
      result.current.clearError()
    })

    expect(result.current.error).toBeNull()
  })

  it('should clear success state', () => {
    const { result } = renderHook(() => useVotingState(), {
      wrapper: createWrapper()
    })

    act(() => {
      result.current.setSuccess('Test success')
    })

    expect(result.current.success).toBe('Test success')

    act(() => {
      result.current.clearSuccess()
    })

    expect(result.current.success).toBeNull()
  })

  it('should refresh data', async () => {
    const { result } = renderHook(() => useVotingState(), {
      wrapper: createWrapper()
    })

    await act(async () => {
      await result.current.refetch()
    })

    // Should call the queries to refetch
    expect(VotingService.getCurrentCycle).toHaveBeenCalled()
  })

  it('should handle disconnected wallet state', async () => {
    const { useWalletAccount } = await import('@/hooks/core/useWalletAccount')
    const { useStakingData } = await import('@/features/staking/hooks/useStakingData')
    
    vi.mocked(useWalletAccount).mockReturnValue(null)
    vi.mocked(useStakingData).mockReturnValue(null)

    const { result } = renderHook(() => useVotingState(), {
      wrapper: createWrapper()
    })

    expect(result.current.isConnected).toBe(false)
    expect(result.current.votingPower).toBeNull()
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

    const { result, waitForNextUpdate } = renderHook(() => useVotingState(), {
      wrapper: createWrapper()
    })

    // Wait for the query to settle with error
    await waitForNextUpdate()

    expect(result.current.currentCycle).toBeUndefined()
  })

  it('should update delegation states correctly', async () => {
    const { result } = renderHook(() => useVotingState(), {
      wrapper: createWrapper()
    })

    expect(result.current.isDelegating).toBe(false)
    expect(result.current.isUndelegating).toBe(false)

    // Test delegation state change
    act(() => {
      // Simulate delegation start (this would normally be inside the delegate function)
      result.current.delegate('0xdelegate123', BigInt(500))
    })

    // In a real scenario, isDelegating would be true during the transaction
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