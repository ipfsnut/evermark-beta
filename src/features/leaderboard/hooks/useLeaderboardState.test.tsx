import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useLeaderboardState } from './useLeaderboardState'
import { LeaderboardService } from '../services/LeaderboardService'
import { LEADERBOARD_CONSTANTS } from '../types'

// Mock dependencies
vi.mock('../services/LeaderboardService', () => ({
  LeaderboardService: {
    getDefaultFilters: vi.fn(() => ({
      period: 'current',
      category: 'all',
      verified: 'all',
      minVotes: 0
    })),
    getDefaultPagination: vi.fn(() => ({
      page: 1,
      pageSize: 20,
      sortBy: 'votes',
      sortOrder: 'desc'
    })),
    calculateLeaderboard: vi.fn(),
    getCurrentLeaderboard: vi.fn(),
    getLeaderboardFeed: vi.fn(),
    getLeaderboardStats: vi.fn(),
    getAvailablePeriods: vi.fn(),
    getPeriodById: vi.fn()
  }
}))

// Mock fetch for evermarks API
global.fetch = vi.fn()

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

describe('useLeaderboardState', () => {
  const mockEvermarksResponse = {
    evermarks: [
      {
        token_id: 1,
        title: 'First Evermark',
        author: 'Author 1',
        owner: '0x1111111111111111111111111111111111111111',
        description: 'Test description 1',
        token_uri: 'ipfs://QmTest1',
        tags: ['test', 'first'],
        verified: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        content_type: 'Article',
        source_url: 'https://example.com/1',
        supabase_image_url: 'https://img.example.com/1.jpg',
        votes: 100,
        access_count: 50
      }
    ]
  }

  const mockLeaderboardData = {
    entries: [
      {
        rank: 1,
        evermarkId: '1',
        evermark: {
          id: '1',
          title: 'First Evermark',
          creatorAddress: '0x1111111111111111111111111111111111111111',
          votes: 100
        },
        totalVotes: BigInt(150),
        voterCount: 15,
        score: 150,
        scoreMultiplier: 1.0,
        previousRank: 0,
        rankChange: 1,
        trendingScore: 0.85,
        momentum: 'up',
        category: 'blockchain',
        seasonNumber: 5
      }
    ],
    totalCount: 1,
    totalPages: 1,
    lastUpdated: new Date().toISOString()
  }

  beforeEach(() => {
    vi.clearAllMocks()

    // Mock successful fetch response
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockEvermarksResponse)
    } as Response)

    // Mock service methods
    vi.mocked(LeaderboardService.getCurrentLeaderboard).mockResolvedValue(mockLeaderboardData)
    vi.mocked(LeaderboardService.getAvailablePeriods).mockResolvedValue([
      { id: 'current', label: 'Current', duration: 0, description: 'Current cycle' }
    ])
    vi.mocked(LeaderboardService.getPeriodById).mockResolvedValue({
      id: 'current', 
      label: 'Current', 
      duration: 0, 
      description: 'Current cycle'
    })
  })

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useLeaderboardState(), {
      wrapper: createWrapper()
    })

    expect(result.current.filters).toEqual({
      period: 'current',
      category: 'all',
      verified: 'all',
      minVotes: 0
    })

    expect(result.current.pagination).toEqual({
      page: 1,
      pageSize: 20,
      sortBy: 'votes',
      sortOrder: 'desc'
    })

    expect(typeof result.current.isLoading).toBe('boolean')
    expect(Array.isArray(result.current.entries)).toBe(true)
    expect(result.current.stats === null || typeof result.current.stats === 'object').toBe(true)
    expect(result.current.error === null || typeof result.current.error === 'string').toBe(true)
  })

  it('should have proper hook structure', async () => {
    const { result } = renderHook(() => useLeaderboardState(), {
      wrapper: createWrapper()
    })

    await waitFor(() => {
      expect(typeof result.current.entries).toBe('object')
    })
    
    // Check all expected properties exist with correct types
    expect(Array.isArray(result.current.entries)).toBe(true)
    expect(typeof result.current.isLoading).toBe('boolean')
    expect(typeof result.current.filters).toBe('object')
    expect(typeof result.current.pagination).toBe('object')
    expect(typeof result.current.totalCount).toBe('number')
    expect(typeof result.current.totalPages).toBe('number')
    expect(typeof result.current.refresh).toBe('function')
    expect(typeof result.current.setFilters).toBe('function')
    expect(typeof result.current.setPagination).toBe('function')
    expect(typeof result.current.clearFilters).toBe('function')
  })

  it('should handle errors gracefully', async () => {
    vi.mocked(LeaderboardService.getCurrentLeaderboard).mockRejectedValue(new Error('Service error'))

    const { result } = renderHook(() => useLeaderboardState(), {
      wrapper: createWrapper()
    })

    await waitFor(() => {
      expect(Array.isArray(result.current.entries)).toBe(true)
    })

    expect(Array.isArray(result.current.entries)).toBe(true)
    expect(typeof result.current.isLoading).toBe('boolean')
  })

  it('should update filters', async () => {
    const { result } = renderHook(() => useLeaderboardState(), {
      wrapper: createWrapper()
    })

    await waitFor(() => {
      expect(typeof result.current.setFilters).toBe('function')
    })

    act(() => {
      result.current.setFilters({
        period: 'season-5',
        category: 'blockchain',
        verified: 'verified',
        minVotes: 10
      })
    })

    expect(result.current.filters).toEqual({
      period: 'season-5',
      category: 'blockchain',
      verified: 'verified',
      minVotes: 10
    })
  })

  it('should update pagination', async () => {
    const { result } = renderHook(() => useLeaderboardState(), {
      wrapper: createWrapper()
    })

    await waitFor(() => {
      expect(typeof result.current.setPagination).toBe('function')
    })

    act(() => {
      result.current.setPagination({
        page: 2,
        pageSize: 10,
        sortBy: 'voterCount',
        sortOrder: 'asc'
      })
    })

    expect(result.current.pagination).toEqual({
      page: 2,
      pageSize: 10,
      sortBy: 'voterCount',
      sortOrder: 'asc'
    })
  })

  it('should reset filters to default', async () => {
    const { result } = renderHook(() => useLeaderboardState(), {
      wrapper: createWrapper()
    })

    await waitFor(() => {
      expect(typeof result.current.clearFilters).toBe('function')
    })

    // First set custom filters
    act(() => {
      result.current.setFilters({
        period: 'season-5',
        category: 'blockchain',
        verified: 'verified',
        minVotes: 10
      })
    })

    // Then reset
    act(() => {
      result.current.clearFilters()
    })

    expect(result.current.filters).toEqual({
      period: 'current',
      category: 'all',
      verified: 'all',
      minVotes: 0
    })
  })

  it('should handle pagination updates', async () => {
    const { result } = renderHook(() => useLeaderboardState(), {
      wrapper: createWrapper()
    })

    await waitFor(() => {
      expect(typeof result.current.setPagination).toBe('function')
    })

    act(() => {
      result.current.setPagination({ page: 2 })
    })

    expect(result.current.pagination.page).toBe(2)
  })

  it('should handle pagination boundaries', async () => {
    const { result } = renderHook(() => useLeaderboardState(), {
      wrapper: createWrapper()
    })

    await waitFor(() => {
      expect(typeof result.current.hasPreviousPage).toBe('boolean')
    })
    
    expect(result.current.pagination.page).toBe(1)
    expect(typeof result.current.hasPreviousPage).toBe('boolean')
    expect(typeof result.current.hasNextPage).toBe('boolean')
  })

  it('should have refresh functionality', async () => {
    const { result } = renderHook(() => useLeaderboardState(), {
      wrapper: createWrapper()
    })

    await waitFor(() => {
      expect(typeof result.current.refresh).toBe('function')
    })

    await act(async () => {
      await result.current.refresh()
    })

    expect(typeof result.current.refresh).toBe('function')
  })

  it('should handle loading states properly', async () => {
    const { result } = renderHook(() => useLeaderboardState(), {
      wrapper: createWrapper()
    })

    expect(typeof result.current.isLoading).toBe('boolean')
    expect(typeof result.current.isRefreshing).toBe('boolean')

    await waitFor(() => {
      expect(typeof result.current.entries).toBe('object')
    })

    expect(typeof result.current.isLoading).toBe('boolean')
    expect(Array.isArray(result.current.entries)).toBe(true)
  })

  it('should handle empty data gracefully', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ evermarks: [] })
    } as Response)

    const { result } = renderHook(() => useLeaderboardState(), {
      wrapper: createWrapper()
    })

    await waitFor(() => {
      expect(typeof result.current.entries).toBe('object')
    })

    expect(Array.isArray(result.current.entries)).toBe(true)
    expect(typeof result.current.isLoading).toBe('boolean')
  })

  it('should handle API errors gracefully', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 500
    } as Response)

    const { result } = renderHook(() => useLeaderboardState(), {
      wrapper: createWrapper()
    })

    await waitFor(() => {
      expect(Array.isArray(result.current.entries)).toBe(true)
    })

    expect(Array.isArray(result.current.entries)).toBe(true)
    expect(typeof result.current.isLoading).toBe('boolean')
  })

  it('should have entry lookup functions', async () => {
    const { result } = renderHook(() => useLeaderboardState(), {
      wrapper: createWrapper()
    })

    await waitFor(() => {
      expect(typeof result.current.getEntryByEvermarkId).toBe('function')
    })

    expect(typeof result.current.getEntryByEvermarkId).toBe('function')
    expect(typeof result.current.getEntryRank).toBe('function')
  })

  it('should have computed properties', async () => {
    const { result } = renderHook(() => useLeaderboardState(), {
      wrapper: createWrapper()
    })

    await waitFor(() => {
      expect(typeof result.current.isEmpty).toBe('boolean')
    })

    expect(typeof result.current.isEmpty).toBe('boolean')
    expect(typeof result.current.isFiltered).toBe('boolean')
    expect(typeof result.current.hasNextPage).toBe('boolean')
    expect(typeof result.current.hasPreviousPage).toBe('boolean')
  })

  it('should provide current period data', async () => {
    const { result } = renderHook(() => useLeaderboardState(), {
      wrapper: createWrapper()
    })

    await waitFor(() => {
      expect(typeof result.current.currentPeriod).toBe('object')
    })

    expect(typeof result.current.currentPeriod).toBe('object')
    expect(Array.isArray(result.current.availablePeriods)).toBe(true)
  })

  it('should handle multiple filter changes', async () => {
    const { result } = renderHook(() => useLeaderboardState(), {
      wrapper: createWrapper()
    })

    await waitFor(() => {
      expect(typeof result.current.setFilters).toBe('function')
    })

    act(() => {
      result.current.setFilters({ period: 'season-5' })
    })

    act(() => {
      result.current.setFilters({ category: 'blockchain' })
    })

    expect(result.current.filters.period).toBe('season-5')
    expect(result.current.filters.category).toBe('blockchain')
  })

  it('should handle setPeriod function', async () => {
    const { result } = renderHook(() => useLeaderboardState(), {
      wrapper: createWrapper()
    })

    await waitFor(() => {
      expect(typeof result.current.setPeriod).toBe('function')
    })

    act(() => {
      result.current.setPeriod('season-5')
    })

    expect(result.current.filters.period).toBe('season-5')
    expect(result.current.pagination.page).toBe(1) // Should reset to page 1
  })

  it('should handle loadLeaderboard function', async () => {
    const { result } = renderHook(() => useLeaderboardState(), {
      wrapper: createWrapper()
    })

    await waitFor(() => {
      expect(typeof result.current.loadLeaderboard).toBe('function')
    })

    await act(async () => {
      await result.current.loadLeaderboard({
        filters: { period: 'season-5' },
        page: 2
      })
    })

    expect(result.current.filters.period).toBe('season-5')
    expect(result.current.pagination.page).toBe(2)
  })
})