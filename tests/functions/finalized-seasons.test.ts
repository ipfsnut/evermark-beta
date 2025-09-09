import { describe, it, expect, vi, beforeEach } from 'vitest'
import { handler } from './finalized-seasons'
import type { HandlerEvent, HandlerContext } from '@netlify/functions'

// Mock Supabase client
const mockSupabaseClient = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      order: vi.fn(() => ({ data: [], error: null }))
    }))
  }))
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabaseClient)
}))

describe('finalized-seasons function', () => {
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

  it('should return finalized seasons successfully', async () => {
    const mockSeasonsData = [
      {
        season_number: 3,
        start_time: '2024-01-01T00:00:00Z',
        end_time: '2024-01-31T23:59:59Z',
        total_votes: 1000,
        total_evermarks_count: 10,
        top_evermark_id: '1',
        top_evermark_votes: 500,
        finalized_at: '2024-02-01T00:00:00Z'
      },
      {
        season_number: 2,
        start_time: '2023-12-01T00:00:00Z',
        end_time: '2023-12-31T23:59:59Z',
        total_votes: 800,
        total_evermarks_count: 8,
        top_evermark_id: '2',
        top_evermark_votes: 400,
        finalized_at: '2024-01-01T00:00:00Z'
      },
      {
        season_number: 1,
        start_time: '2023-11-01T00:00:00Z',
        end_time: '2023-11-30T23:59:59Z',
        total_votes: 600,
        total_evermarks_count: 6,
        top_evermark_id: '3',
        top_evermark_votes: 300,
        finalized_at: '2023-12-01T00:00:00Z'
      }
    ]

    const mockQuery = vi.fn().mockResolvedValue({ 
      data: mockSeasonsData, 
      error: null 
    })
    
    mockSupabaseClient.from.mockReturnValue({
      select: vi.fn(() => ({
        order: mockQuery
      }))
    })

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

    expect(result.statusCode).toBe(200)
    const responseBody = JSON.parse(result.body)
    
    expect(responseBody.seasons).toHaveLength(3)
    expect(responseBody.total).toBe(3)
    
    // Check transformed data structure
    expect(responseBody.seasons[0]).toMatchObject({
      seasonNumber: 3,
      startTime: '2024-01-01T00:00:00Z',
      endTime: '2024-01-31T23:59:59Z',
      totalVotes: 1000,
      totalEvermarksCount: 10,
      topEvermarkId: '1',
      topEvermarkVotes: 500,
      finalizedAt: '2024-02-01T00:00:00Z',
      label: 'Season 3',
      description: '10 evermarks, 1000 total votes'
    })

    // Verify ordering (newest first)
    expect(responseBody.seasons[0].seasonNumber).toBe(3)
    expect(responseBody.seasons[1].seasonNumber).toBe(2)
    expect(responseBody.seasons[2].seasonNumber).toBe(1)
  })

  it('should calculate duration correctly', async () => {
    const mockSeasonsData = [
      {
        season_number: 1,
        start_time: '2024-01-01T00:00:00Z',
        end_time: '2024-01-31T23:59:59Z',
        total_votes: 1000,
        total_evermarks_count: 10,
        top_evermark_id: '1',
        top_evermark_votes: 500,
        finalized_at: '2024-02-01T00:00:00Z'
      }
    ]

    const mockQuery = vi.fn().mockResolvedValue({ 
      data: mockSeasonsData, 
      error: null 
    })
    
    mockSupabaseClient.from.mockReturnValue({
      select: vi.fn(() => ({
        order: mockQuery
      }))
    })

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

    expect(result.statusCode).toBe(200)
    const responseBody = JSON.parse(result.body)
    
    const expectedDuration = new Date('2024-01-31T23:59:59Z').getTime() - new Date('2024-01-01T00:00:00Z').getTime()
    expect(responseBody.seasons[0].duration).toBe(expectedDuration)
  })

  it('should return empty result when no seasons found', async () => {
    const mockQuery = vi.fn().mockResolvedValue({ 
      data: [], 
      error: null 
    })
    
    mockSupabaseClient.from.mockReturnValue({
      select: vi.fn(() => ({
        order: mockQuery
      }))
    })

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

    expect(result.statusCode).toBe(200)
    const responseBody = JSON.parse(result.body)
    
    expect(responseBody.seasons).toEqual([])
    expect(responseBody.total).toBe(0)
    expect(responseBody.message).toBe('No finalized seasons found')
  })

  it('should handle null seasons data', async () => {
    const mockQuery = vi.fn().mockResolvedValue({ 
      data: null, 
      error: null 
    })
    
    mockSupabaseClient.from.mockReturnValue({
      select: vi.fn(() => ({
        order: mockQuery
      }))
    })

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

    expect(result.statusCode).toBe(200)
    const responseBody = JSON.parse(result.body)
    
    expect(responseBody.seasons).toEqual([])
    expect(responseBody.total).toBe(0)
  })

  it('should handle database errors', async () => {
    const mockQuery = vi.fn().mockResolvedValue({ 
      data: null, 
      error: new Error('Database connection failed') 
    })
    
    mockSupabaseClient.from.mockReturnValue({
      select: vi.fn(() => ({
        order: mockQuery
      }))
    })

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

    expect(result.statusCode).toBe(500)
    expect(JSON.parse(result.body)).toMatchObject({
      error: 'Internal server error',
      message: 'Database connection failed'
    })
  })

  it('should handle unexpected errors', async () => {
    // Mock an unexpected error during execution
    mockSupabaseClient.from.mockImplementation(() => {
      throw new Error('Unexpected error')
    })

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

    expect(result.statusCode).toBe(500)
    expect(JSON.parse(result.body)).toMatchObject({
      error: 'Internal server error',
      message: 'Unexpected error'
    })
  })

  it('should use correct database query', async () => {
    const mockQuery = vi.fn().mockResolvedValue({ data: [], error: null })
    const mockOrder = vi.fn(() => mockQuery())
    const mockSelect = vi.fn(() => ({ order: mockOrder }))
    const mockFrom = vi.fn(() => ({ select: mockSelect }))
    
    mockSupabaseClient.from = mockFrom

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

    await handler(event, mockContext)

    expect(mockFrom).toHaveBeenCalledWith('finalized_seasons')
    expect(mockSelect).toHaveBeenCalledWith('*')
    expect(mockOrder).toHaveBeenCalledWith('season_number', { ascending: false })
  })

  it('should include debug information in response', async () => {
    const mockSeasonsData = [
      {
        season_number: 1,
        start_time: '2024-01-01T00:00:00Z',
        end_time: '2024-01-31T23:59:59Z',
        total_votes: 1000,
        total_evermarks_count: 10,
        top_evermark_id: '1',
        top_evermark_votes: 500,
        finalized_at: '2024-02-01T00:00:00Z'
      }
    ]

    const mockQuery = vi.fn().mockResolvedValue({ 
      data: mockSeasonsData, 
      error: null 
    })
    
    mockSupabaseClient.from.mockReturnValue({
      select: vi.fn(() => ({
        order: mockQuery
      }))
    })

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

    expect(result.statusCode).toBe(200)
    const responseBody = JSON.parse(result.body)
    
    expect(responseBody.debug).toEqual({
      rawSeasonCount: 1,
      dataSource: 'finalized_seasons_table'
    })
  })

  it('should format vote counts correctly in descriptions', async () => {
    const mockSeasonsData = [
      {
        season_number: 1,
        start_time: '2024-01-01T00:00:00Z',
        end_time: '2024-01-31T23:59:59Z',
        total_votes: '1500', // String representation
        total_evermarks_count: 15,
        top_evermark_id: '1',
        top_evermark_votes: '750',
        finalized_at: '2024-02-01T00:00:00Z'
      }
    ]

    const mockQuery = vi.fn().mockResolvedValue({ 
      data: mockSeasonsData, 
      error: null 
    })
    
    mockSupabaseClient.from.mockReturnValue({
      select: vi.fn(() => ({
        order: mockQuery
      }))
    })

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

    expect(result.statusCode).toBe(200)
    const responseBody = JSON.parse(result.body)
    
    expect(responseBody.seasons[0].description).toBe('15 evermarks, 1500 total votes')
  })
})