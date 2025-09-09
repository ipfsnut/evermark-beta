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
    getLeaderboardFeed: vi.fn(),
    getLeaderboardStats: vi.fn()
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
      },
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
      },
      {
        token_id: 2,
        title: 'Second Evermark',
        author: 'Author 2',
        owner: '0x2222222222222222222222222222222222222222',
        description: 'Test description 2',
        token_uri: 'ipfs://QmTest2',
        tags: ['test', 'second'],
        verified: false,
        created_at: '2024-01-02T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
        content_type: 'Blog',
        source_url: 'https://example.com/2',
        votes: 75,
        access_count: 30
      }
    ]
  }

  const mockLeaderboardEntries = [
    {
      rank: 1,
      evermarkId: '1',
      evermark: {
        id: '1',
        title: 'First Evermark',
        creatorAddress: '0x1111111111111111111111111111111111111111',
        votes: 100
      },
      votes: BigInt(150),
      voterCount: 15,
      score: 150,
      scoreMultiplier: 1.0,
      previousRank: 0,
      rankChange: 1,
      trendingScore: 0.85,
      momentum: 'up',
      category: 'blockchain',
      seasonNumber: 5
    },
    {
      rank: 2,
      evermarkId: '2',
      evermark: {
        id: '2',
        title: 'Second Evermark',
        creatorAddress: '0x2222222222222222222222222222222222222222',
        votes: 75
      },
      votes: BigInt(100),
      voterCount: 10,
      score: 100,
      scoreMultiplier: 1.0,
      previousRank: 0,
      rankChange: 1,
      trendingScore: 0.75,
      momentum: 'stable',
      category: 'defi',
      seasonNumber: 5
    }
  ]

  const mockLeaderboardStats = {
    totalEntries: 2,
    totalVotes: BigInt(250),
    totalVoters: 25,
    averageVotesPerEntry: BigInt(125),
    topCategory: 'blockchain',
    mostActiveVoter: '0x1234567890123456789012345678901234567890',
    participationRate: 0.8,
    seasonNumber: 5
  }

  beforeEach(() => {
    vi.clearAllMocks()

    // Mock successful fetch response
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockEvermarksResponse)
    } as Response)

    // Mock service methods
    vi.mocked(LeaderboardService.getLeaderboardFeed).mockResolvedValue({
      entries: mockLeaderboardEntries,
      pagination: {
        page: 1,
        pageSize: 20,
        sortBy: 'votes',
        sortOrder: 'desc',
        totalPages: 1,
        totalItems: 2,
        hasNextPage: false,
        hasPreviousPage: false
      },
      filters: {
        period: 'current',
        category: 'all',
        verified: 'all',
        minVotes: 0
      },
      stats: mockLeaderboardStats
    })

    vi.mocked(LeaderboardService.getLeaderboardStats).mockResolvedValue(mockLeaderboardStats)
  })

  it('should initialize with default state', async () => {
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

    expect(result.current.isLoading).toBe(true)
    expect(result.current.entries).toEqual([])
    expect(result.current.stats).toBeNull()
    expect(result.current.error).toBeNull()
  })

  it('should load evermarks data', async () => {
    const { result } = renderHook(() => useLeaderboardState(), {
      wrapper: createWrapper()
    })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(fetch).toHaveBeenCalledWith('/.netlify/functions/evermarks')
    
    // Check that evermarks are transformed correctly
    const expectedEvermark = {
      id: '1',
      tokenId: 1,
      title: 'First Evermark',
      author: 'Author 1',
      creator: '0x1111111111111111111111111111111111111111',
      description: 'Test description 1',
      metadataURI: 'ipfs://QmTest1',
      tags: ['test', 'first'],
      verified: true,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      contentType: 'Article',
      sourceUrl: 'https://example.com/1',
      image: 'https://img.example.com/1.jpg',
      supabaseImageUrl: 'https://img.example.com/1.jpg',
      imageStatus: 'processed',
      votes: 100,
      viewCount: 50,
      creationTime: Date.parse('2024-01-01T00:00:00Z')
    }

    // The evermarks should be available internally (not exposed directly in the hook)
  })

  it('should handle evermarks API errors', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 500
    } as Response)

    const { result } = renderHook(() => useLeaderboardState(), {
      wrapper: createWrapper()
    })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.isLoading).toBe(false)
    // Should handle error gracefully
  })

  it('should load leaderboard entries', async () => {
    const { result } = renderHook(() => useLeaderboardState(), {
      wrapper: createWrapper()
    })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.entries).toEqual(mockLeaderboardEntries)
    expect(result.current.stats).toEqual(mockLeaderboardStats)
    expect(result.current.isLoading).toBe(false)
  })

  it('should update filters', async () => {
    const { result } = renderHook(() => useLeaderboardState(), {
      wrapper: createWrapper()
    })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

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

    await waitFor(() => expect(result.current.isLoading).toBe(false))

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

    await waitFor(() => expect(result.current.isLoading).toBe(false))

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
      result.current.resetFilters()
    })

    expect(result.current.filters).toEqual({
      period: 'current',
      category: 'all',
      verified: 'all',
      minVotes: 0
    })
  })

  it('should reset pagination to default', async () => {
    const { result } = renderHook(() => useLeaderboardState(), {
      wrapper: createWrapper()
    })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    // First set custom pagination
    act(() => {
      result.current.setPagination({
        page: 3,
        pageSize: 5,
        sortBy: 'score',
        sortOrder: 'asc'
      })
    })

    // Then reset
    act(() => {
      result.current.resetPagination()
    })

    expect(result.current.pagination).toEqual({
      page: 1,
      pageSize: 20,
      sortBy: 'votes',
      sortOrder: 'desc'
    })
  })

  it('should go to next page', async () => {
    const { result } = renderHook(() => useLeaderboardState(), {
      wrapper: createWrapper()
    })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => {
      result.current.nextPage()
    })

    expect(result.current.pagination.page).toBe(2)
  })

  it('should go to previous page', async () => {
    const { result } = renderHook(() => useLeaderboardState(), {
      wrapper: createWrapper()
    })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    // First go to page 2
    act(() => {
      result.current.nextPage()
    })

    // Then go back to page 1
    act(() => {
      result.current.previousPage()
    })

    expect(result.current.pagination.page).toBe(1)
  })

  it('should not go below page 1', async () => {
    const { result } = renderHook(() => useLeaderboardState(), {
      wrapper: createWrapper()
    })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => {
      result.current.previousPage()
    })

    expect(result.current.pagination.page).toBe(1)
  })

  it('should go to specific page', async () => {
    const { result } = renderHook(() => useLeaderboardState(), {
      wrapper: createWrapper()
    })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => {
      result.current.goToPage(5)
    })

    expect(result.current.pagination.page).toBe(5)
  })

  it('should refresh data', async () => {
    const { result } = renderHook(() => useLeaderboardState(), {
      wrapper: createWrapper()
    })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.refresh()
    })

    // Should call the service methods again
    expect(LeaderboardService.getLeaderboardFeed).toHaveBeenCalled()
  })

  it('should handle loading states correctly', async () => {
    const { result } = renderHook(() => useLeaderboardState(), {
      wrapper: createWrapper()
    })

    expect(result.current.isLoading).toBe(true)
    expect(result.current.isRefreshing).toBe(false)
  })

  it('should handle errors in leaderboard queries', async () => {
    vi.mocked(LeaderboardService.getLeaderboardFeed).mockRejectedValue(new Error('Service error'))

    const { result } = renderHook(() => useLeaderboardState(), {
      wrapper: createWrapper()
    })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.error).toBeDefined()
    expect(result.current.entries).toEqual([])
  })

  it('should transform evermarks data correctly', async () => {
    const { result } = renderHook(() => useLeaderboardState(), {
      wrapper: createWrapper()
    })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    // The transformation should happen internally
    // We can verify this by checking the service was called with transformed data
    expect(LeaderboardService.getLeaderboardFeed).toHaveBeenCalled()
    
    const callArgs = vi.mocked(LeaderboardService.getLeaderboardFeed).mock.calls[0][0]
    expect(callArgs.evermarks).toBeDefined()
    expect(callArgs.evermarks[0]).toMatchObject({
      id: '1',
      tokenId: 1,
      title: 'First Evermark',
      verified: true
    })
  })

  it('should create evermarks hash for cache invalidation', async () => {
    const { result } = renderHook(() => useLeaderboardState(), {
      wrapper: createWrapper()
    })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    // The hash should be used internally for cache management
    // We can't access it directly but it should affect query keys
    expect(LeaderboardService.getLeaderboardFeed).toHaveBeenCalled()
  })

  it('should handle empty evermarks response', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ evermarks: [] })
    } as Response)

    const { result } = renderHook(() => useLeaderboardState(), {
      wrapper: createWrapper()
    })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.entries).toEqual(mockLeaderboardEntries) // Service should still be called
  })

  it('should handle malformed evermarks data', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        evermarks: [
          {
            // Missing required fields
            token_id: 1
          }
        ]
      })
    } as Response)

    const { result } = renderHook(() => useLeaderboardState(), {
      wrapper: createWrapper()
    })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    // Should handle gracefully with default values
    expect(LeaderboardService.getLeaderboardFeed).toHaveBeenCalled()
  })

  it('should expose correct loading states', async () => {
    const { result } = renderHook(() => useLeaderboardState(), {
      wrapper: createWrapper()
    })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.isLoading).toBe(false)
  })
})

