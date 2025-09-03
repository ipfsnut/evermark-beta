import { describe, it, expect, vi, beforeEach } from 'vitest'
import { handler } from './evermarks'
import type { HandlerEvent, HandlerContext } from '@netlify/functions'

// Mock Supabase
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnThis(),
      data: null,
      error: null,
    })),
  })),
}))

describe('Evermarks API Handler', () => {
  const mockContext = {} as HandlerContext
  
  beforeEach(() => {
    vi.clearAllMocks()
    // Set required environment variables
    process.env.SUPABASE_URL = 'https://test.supabase.co'
    process.env.SUPABASE_ANON_KEY = 'test-anon-key'
  })

  describe('OPTIONS requests', () => {
    it('should handle CORS preflight requests', async () => {
      const event: HandlerEvent = {
        httpMethod: 'OPTIONS',
        headers: {},
        body: null,
        path: '/api/evermarks',
        queryStringParameters: null,
        multiValueHeaders: {},
        multiValueQueryStringParameters: null,
        isBase64Encoded: false,
        rawUrl: '',
        rawQuery: '',
      }

      const response = await handler(event, mockContext)

      expect(response.statusCode).toBe(200)
      expect(response.headers).toHaveProperty('Access-Control-Allow-Origin', '*')
      expect(response.headers).toHaveProperty('Access-Control-Allow-Methods')
    })
  })

  describe('GET requests', () => {
    it('should fetch all evermarks without wallet filter', async () => {
      const mockEvermarks = [
        {
          token_id: 1,
          title: 'Test Evermark',
          author: 'Test Author',
          owner: '0x123',
          content_type: 'article',
          verified: true,
        },
      ]

      const event: HandlerEvent = {
        httpMethod: 'GET',
        headers: {},
        body: null,
        path: '/api/evermarks',
        queryStringParameters: null,
        multiValueHeaders: {},
        multiValueQueryStringParameters: null,
        isBase64Encoded: false,
        rawUrl: '',
        rawQuery: '',
      }

      const response = await handler(event, mockContext)

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('evermarks')
      expect(body).toHaveProperty('total')
    })

    it('should fetch evermarks filtered by wallet address', async () => {
      const walletAddress = '0x1234567890123456789012345678901234567890'
      
      const event: HandlerEvent = {
        httpMethod: 'GET',
        headers: {},
        body: null,
        path: '/api/evermarks',
        queryStringParameters: {
          wallet: walletAddress,
        },
        multiValueHeaders: {},
        multiValueQueryStringParameters: null,
        isBase64Encoded: false,
        rawUrl: '',
        rawQuery: '',
      }

      const response = await handler(event, mockContext)

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('evermarks')
      expect(body).toHaveProperty('wallet', walletAddress.toLowerCase())
    })

    it('should handle pagination parameters', async () => {
      const event: HandlerEvent = {
        httpMethod: 'GET',
        headers: {},
        body: null,
        path: '/api/evermarks',
        queryStringParameters: {
          page: '2',
          limit: '10',
        },
        multiValueHeaders: {},
        multiValueQueryStringParameters: null,
        isBase64Encoded: false,
        rawUrl: '',
        rawQuery: '',
      }

      const response = await handler(event, mockContext)

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('page', 2)
      expect(body).toHaveProperty('limit', 10)
    })

    it('should return 400 for invalid wallet address', async () => {
      const event: HandlerEvent = {
        httpMethod: 'GET',
        headers: {},
        body: null,
        path: '/api/evermarks',
        queryStringParameters: {
          wallet: 'invalid-address',
        },
        multiValueHeaders: {},
        multiValueQueryStringParameters: null,
        isBase64Encoded: false,
        rawUrl: '',
        rawQuery: '',
      }

      const response = await handler(event, mockContext)

      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('error')
    })
  })

  describe('POST requests', () => {
    it('should create a new evermark', async () => {
      const newEvermark = {
        title: 'New Evermark',
        author: 'New Author',
        owner: '0x1234567890123456789012345678901234567890',
        content_type: 'article',
        source_url: 'https://example.com',
        token_uri: 'ipfs://test',
      }

      const event: HandlerEvent = {
        httpMethod: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-wallet-address': newEvermark.owner,
        },
        body: JSON.stringify(newEvermark),
        path: '/api/evermarks',
        queryStringParameters: null,
        multiValueHeaders: {},
        multiValueQueryStringParameters: null,
        isBase64Encoded: false,
        rawUrl: '',
        rawQuery: '',
      }

      const response = await handler(event, mockContext)

      expect(response.statusCode).toBe(201)
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('evermark')
    })

    it('should return 401 if wallet address not provided', async () => {
      const event: HandlerEvent = {
        httpMethod: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          title: 'Test',
        }),
        path: '/api/evermarks',
        queryStringParameters: null,
        multiValueHeaders: {},
        multiValueQueryStringParameters: null,
        isBase64Encoded: false,
        rawUrl: '',
        rawQuery: '',
      }

      const response = await handler(event, mockContext)

      expect(response.statusCode).toBe(401)
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('error', 'Wallet address required')
    })

    it('should return 400 for invalid body', async () => {
      const event: HandlerEvent = {
        httpMethod: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-wallet-address': '0x1234567890123456789012345678901234567890',
        },
        body: 'invalid json',
        path: '/api/evermarks',
        queryStringParameters: null,
        multiValueHeaders: {},
        multiValueQueryStringParameters: null,
        isBase64Encoded: false,
        rawUrl: '',
        rawQuery: '',
      }

      const response = await handler(event, mockContext)

      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('error')
    })
  })

  describe('PUT requests', () => {
    it('should update an existing evermark', async () => {
      const updates = {
        title: 'Updated Title',
        description: 'Updated Description',
      }

      const event: HandlerEvent = {
        httpMethod: 'PUT',
        headers: {
          'content-type': 'application/json',
          'x-wallet-address': '0x1234567890123456789012345678901234567890',
        },
        body: JSON.stringify(updates),
        path: '/api/evermarks',
        queryStringParameters: {
          token_id: '1',
        },
        multiValueHeaders: {},
        multiValueQueryStringParameters: null,
        isBase64Encoded: false,
        rawUrl: '',
        rawQuery: '',
      }

      const response = await handler(event, mockContext)

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('evermark')
    })

    it('should return 400 if token_id not provided', async () => {
      const event: HandlerEvent = {
        httpMethod: 'PUT',
        headers: {
          'content-type': 'application/json',
          'x-wallet-address': '0x1234567890123456789012345678901234567890',
        },
        body: JSON.stringify({ title: 'Test' }),
        path: '/api/evermarks',
        queryStringParameters: null,
        multiValueHeaders: {},
        multiValueQueryStringParameters: null,
        isBase64Encoded: false,
        rawUrl: '',
        rawQuery: '',
      }

      const response = await handler(event, mockContext)

      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('error', 'Token ID required')
    })
  })

  describe('DELETE requests', () => {
    it('should delete an evermark', async () => {
      const event: HandlerEvent = {
        httpMethod: 'DELETE',
        headers: {
          'x-wallet-address': '0x1234567890123456789012345678901234567890',
        },
        body: null,
        path: '/api/evermarks',
        queryStringParameters: {
          token_id: '1',
        },
        multiValueHeaders: {},
        multiValueQueryStringParameters: null,
        isBase64Encoded: false,
        rawUrl: '',
        rawQuery: '',
      }

      const response = await handler(event, mockContext)

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('message', 'Evermark deleted successfully')
    })

    it('should return 400 if token_id not provided', async () => {
      const event: HandlerEvent = {
        httpMethod: 'DELETE',
        headers: {
          'x-wallet-address': '0x1234567890123456789012345678901234567890',
        },
        body: null,
        path: '/api/evermarks',
        queryStringParameters: null,
        multiValueHeaders: {},
        multiValueQueryStringParameters: null,
        isBase64Encoded: false,
        rawUrl: '',
        rawQuery: '',
      }

      const response = await handler(event, mockContext)

      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('error', 'Token ID required')
    })
  })

  describe('Invalid methods', () => {
    it('should return 405 for unsupported methods', async () => {
      const event: HandlerEvent = {
        httpMethod: 'PATCH',
        headers: {},
        body: null,
        path: '/api/evermarks',
        queryStringParameters: null,
        multiValueHeaders: {},
        multiValueQueryStringParameters: null,
        isBase64Encoded: false,
        rawUrl: '',
        rawQuery: '',
      }

      const response = await handler(event, mockContext)

      expect(response.statusCode).toBe(405)
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('error', 'Method not allowed')
    })
  })
})