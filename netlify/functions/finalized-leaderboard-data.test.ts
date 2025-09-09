import { describe, it, expect, vi, beforeEach } from 'vitest'
import { handler } from './finalized-leaderboard-data'
import type { HandlerEvent, HandlerContext } from '@netlify/functions'

// Mock Supabase client
const mockSupabaseClient = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn(),
        order: vi.fn(() => ({ data: [], error: null }))
      })),
      in: vi.fn(() => ({ data: [], error: null }))
    }))
  }))
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabaseClient)
}))

describe('finalized-leaderboard-data function', () => {
  const mockContext: HandlerContext = {} as HandlerContext

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.VITE_SUPABASE_URL = 'https://test.supabase.co'
    process.env.VITE_SUPABASE_ANON_KEY = 'test-key'
  })

  it('should handle OPTIONS request', async () => {
    const event: HandlerEvent = {
      httpMethod: 'OPTIONS',
      queryStringParameters: null,
      body: null,
      headers: {},
      multiValueHeaders: {},
      path: '',
      pathParameters: null,
      multiValueQueryStringParameters: null,
      stageVariables: null,
      requestContext: {} as any,
      resource: '',
      isBase64Encoded: false
    }

    const result = await handler(event, mockContext)

    expect(result.statusCode).toBe(200)
    expect(result.headers).toHaveProperty('Access-Control-Allow-Origin', '*')
  })

  it('should reject non-GET requests', async () => {
    const event: HandlerEvent = {
      httpMethod: 'POST',
      queryStringParameters: null,
      body: null,
      headers: {},
      multiValueHeaders: {},
      path: '',
      pathParameters: null,
      multiValueQueryStringParameters: null,
      stageVariables: null,
      requestContext: {} as any,
      resource: '',
      isBase64Encoded: false
    }

    const result = await handler(event, mockContext)

    expect(result.statusCode).toBe(405)
    expect(JSON.parse(result.body)).toEqual({ error: 'Method not allowed' })
  })

  it('should require season parameter', async () => {
    const event: HandlerEvent = {
      httpMethod: 'GET',
      queryStringParameters: {},
      body: null,
      headers: {},
      multiValueHeaders: {},
      path: '',
      pathParameters: null,
      multiValueQueryStringParameters: null,
      stageVariables: null,
      requestContext: {} as any,
      resource: '',
      isBase64Encoded: false
    }

    const result = await handler(event, mockContext)

    expect(result.statusCode).toBe(400)
    expect(JSON.parse(result.body)).toEqual({ error: 'Season parameter is required' })
  })

  it('should validate season number', async () => {
    const event: HandlerEvent = {
      httpMethod: 'GET',
      queryStringParameters: { season: 'invalid' },
      body: null,
      headers: {},
      multiValueHeaders: {},
      path: '',
      pathParameters: null,
      multiValueQueryStringParameters: null,
      stageVariables: null,
      requestContext: {} as any,
      resource: '',
      isBase64Encoded: false
    }

    const result = await handler(event, mockContext)

    expect(result.statusCode).toBe(400)
    expect(JSON.parse(result.body)).toEqual({ error: 'Invalid season number' })
  })

  it('should return 404 when season not finalized', async () => {
    // Mock season query to return null
    const mockSeasonQuery = vi.fn().mockResolvedValue({ data: null, error: new Error('Not found') })
    mockSupabaseClient.from.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: mockSeasonQuery
        }))
      }))
    })

    const event: HandlerEvent = {
      httpMethod: 'GET',
      queryStringParameters: { season: '5' },
      body: null,
      headers: {},
      multiValueHeaders: {},
      path: '',
      pathParameters: null,
      multiValueQueryStringParameters: null,
      stageVariables: null,
      requestContext: {} as any,
      resource: '',
      isBase64Encoded: false
    }

    const result = await handler(event, mockContext)

    expect(result.statusCode).toBe(404)
    expect(JSON.parse(result.body)).toMatchObject({
      error: 'Season not finalized or not found',
      message: 'Season 5 has not been finalized yet'
    })
  })

  it('should return finalized leaderboard data successfully', async () => {
    const mockSeasonData = {
      season_number: 3,
      start_time: '2024-01-01T00:00:00Z',
      end_time: '2024-01-31T23:59:59Z',
      total_votes: 1000,
      total_evermarks_count: 2,
      top_evermark_id: '1',
      top_evermark_votes: 500,
      finalized_at: '2024-02-01T00:00:00Z'
    }

    const mockLeaderboardData = [
      {
        evermark_id: '1',
        final_rank: 1,
        total_votes: 500,
        percentage_of_total: 50.0,
        finalized_at: '2024-02-01T00:00:00Z'
      },
      {
        evermark_id: '2',
        final_rank: 2,
        total_votes: 300,
        percentage_of_total: 30.0,
        finalized_at: '2024-02-01T00:00:00Z'
      }
    ]

    const mockEvermarksData = [
      {
        token_id: 1,
        title: 'First Evermark',
        author: 'Creator 1',
        owner: '0x1111',
        description: 'Test description 1',
        content_type: 'URL',
        source_url: 'https://example.com/1',
        created_at: '2024-01-15T00:00:00Z',
        verified: true,
        supabase_image_url: 'https://example.com/image1.jpg',
        ipfs_image_hash: 'QmTest1'
      },
      {
        token_id: 2,
        title: 'Second Evermark',
        author: 'Creator 2',
        owner: '0x2222',
        description: 'Test description 2',
        content_type: 'DOI',
        source_url: 'https://example.com/2',
        created_at: '2024-01-20T00:00:00Z',
        verified: false,
        supabase_image_url: 'https://example.com/image2.jpg',
        ipfs_image_hash: 'QmTest2'
      }
    ]

    // Mock the database queries
    const mockSeasonQuery = vi.fn().mockResolvedValue({ data: mockSeasonData, error: null })
    const mockLeaderboardQuery = vi.fn().mockResolvedValue({ data: mockLeaderboardData, error: null })
    const mockEvermarksQuery = vi.fn().mockResolvedValue({ data: mockEvermarksData, error: null })

    let queryCount = 0
    mockSupabaseClient.from.mockImplementation((table: string) => {
      queryCount++
      if (table === 'finalized_seasons') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: mockSeasonQuery
            }))
          }))
        }
      } else if (table === 'finalized_leaderboards') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => mockLeaderboardQuery())
            }))
          }))
        }
      } else if (table === 'beta_evermarks') {
        return {
          select: vi.fn(() => ({
            in: vi.fn(() => mockEvermarksQuery())
          }))
        }
      }
      return { select: vi.fn(() => ({ data: [], error: null })) }
    })

    const event: HandlerEvent = {
      httpMethod: 'GET',
      queryStringParameters: { season: '3' },
      body: null,
      headers: {},
      multiValueHeaders: {},
      path: '',
      pathParameters: null,
      multiValueQueryStringParameters: null,
      stageVariables: null,
      requestContext: {} as any,
      resource: '',
      isBase64Encoded: false
    }

    const result = await handler(event, mockContext)

    expect(result.statusCode).toBe(200)
    const responseBody = JSON.parse(result.body)
    
    expect(responseBody.evermarks).toHaveLength(2)
    expect(responseBody.season).toBe(3)
    expect(responseBody.seasonInfo).toMatchObject({
      seasonNumber: 3,
      totalVotes: 1000,
      totalEvermarksCount: 2
    })
    expect(responseBody.evermarks[0]).toMatchObject({
      id: '1',
      tokenId: 1,
      title: 'First Evermark',
      rank: 1,
      totalVotes: 500,
      percentageOfTotal: 50.0
    })
  })

  it('should handle missing evermark metadata gracefully', async () => {
    const mockSeasonData = {
      season_number: 3,
      start_time: '2024-01-01T00:00:00Z',
      end_time: '2024-01-31T23:59:59Z',
      total_votes: 1000,
      total_evermarks_count: 1,
      finalized_at: '2024-02-01T00:00:00Z'
    }

    const mockLeaderboardData = [
      {
        evermark_id: '999', // Non-existent evermark
        final_rank: 1,
        total_votes: 500,
        percentage_of_total: 100.0,
        finalized_at: '2024-02-01T00:00:00Z'
      }
    ]

    const mockSeasonQuery = vi.fn().mockResolvedValue({ data: mockSeasonData, error: null })
    const mockLeaderboardQuery = vi.fn().mockResolvedValue({ data: mockLeaderboardData, error: null })
    const mockEvermarksQuery = vi.fn().mockResolvedValue({ data: [], error: null }) // No matching evermarks

    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === 'finalized_seasons') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: mockSeasonQuery
            }))
          }))
        }
      } else if (table === 'finalized_leaderboards') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => mockLeaderboardQuery())
            }))
          }))
        }
      } else if (table === 'beta_evermarks') {
        return {
          select: vi.fn(() => ({
            in: vi.fn(() => mockEvermarksQuery())
          }))
        }
      }
      return { select: vi.fn(() => ({ data: [], error: null })) }
    })

    const event: HandlerEvent = {
      httpMethod: 'GET',
      queryStringParameters: { season: '3' },
      body: null,
      headers: {},
      multiValueHeaders: {},
      path: '',
      pathParameters: null,
      multiValueQueryStringParameters: null,
      stageVariables: null,
      requestContext: {} as any,
      resource: '',
      isBase64Encoded: false
    }

    const result = await handler(event, mockContext)

    expect(result.statusCode).toBe(200)
    const responseBody = JSON.parse(result.body)
    
    // Should filter out entries without matching evermark metadata
    expect(responseBody.evermarks).toHaveLength(0)
    expect(responseBody.debug.finalizedLeaderboardEntries).toBe(1)
    expect(responseBody.debug.evermarkMatches).toBe(0)
  })

  it('should handle database errors', async () => {
    const mockSeasonQuery = vi.fn().mockResolvedValue({ 
      data: null, 
      error: new Error('Database connection failed') 
    })
    
    mockSupabaseClient.from.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: mockSeasonQuery
        }))
      }))
    })

    const event: HandlerEvent = {
      httpMethod: 'GET',
      queryStringParameters: { season: '3' },
      body: null,
      headers: {},
      multiValueHeaders: {},
      path: '',
      pathParameters: null,
      multiValueQueryStringParameters: null,
      stageVariables: null,
      requestContext: {} as any,
      resource: '',
      isBase64Encoded: false
    }

    const result = await handler(event, mockContext)

    expect(result.statusCode).toBe(500)
    expect(JSON.parse(result.body)).toMatchObject({
      error: 'Internal server error'
    })
  })

  it('should return empty result when no leaderboard data exists', async () => {
    const mockSeasonData = {
      season_number: 3,
      start_time: '2024-01-01T00:00:00Z',
      end_time: '2024-01-31T23:59:59Z',
      total_votes: 0,
      total_evermarks_count: 0,
      finalized_at: '2024-02-01T00:00:00Z'
    }

    const mockSeasonQuery = vi.fn().mockResolvedValue({ data: mockSeasonData, error: null })
    const mockLeaderboardQuery = vi.fn().mockResolvedValue({ data: [], error: null })

    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === 'finalized_seasons') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: mockSeasonQuery
            }))
          }))
        }
      } else if (table === 'finalized_leaderboards') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => mockLeaderboardQuery())
            }))
          }))
        }
      }
      return { select: vi.fn(() => ({ data: [], error: null })) }
    })

    const event: HandlerEvent = {
      httpMethod: 'GET',
      queryStringParameters: { season: '3' },
      body: null,
      headers: {},
      multiValueHeaders: {},
      path: '',
      pathParameters: null,
      multiValueQueryStringParameters: null,
      stageVariables: null,
      requestContext: {} as any,
      resource: '',
      isBase64Encoded: false
    }

    const result = await handler(event, mockContext)

    expect(result.statusCode).toBe(200)
    const responseBody = JSON.parse(result.body)
    
    expect(responseBody.evermarks).toHaveLength(0)
    expect(responseBody.total).toBe(0)
    expect(responseBody.message).toContain('No leaderboard data found')
  })
})