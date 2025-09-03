import { describe, it, expect, vi, beforeEach } from 'vitest'
import { handler } from './auth-wallet'
import type { HandlerEvent, HandlerContext } from '@netlify/functions'
import jwt from 'jsonwebtoken'

// Mock jsonwebtoken
vi.mock('jsonwebtoken', () => ({
  default: {
    sign: vi.fn(() => 'mock-jwt-token'),
    verify: vi.fn(() => ({ wallet: '0x1234567890123456789012345678901234567890' })),
  },
}))

// Mock Supabase
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnThis(),
      data: {
        wallet_address: '0x1234567890123456789012345678901234567890',
        nonce: 'test-nonce',
      },
      error: null,
    })),
  })),
}))

describe('Auth Wallet Handler', () => {
  const mockContext = {} as HandlerContext
  
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.JWT_SECRET = 'test-secret-key'
    process.env.SUPABASE_URL = 'https://test.supabase.co'
    process.env.SUPABASE_ANON_KEY = 'test-anon-key'
  })

  describe('OPTIONS requests', () => {
    it('should handle CORS preflight', async () => {
      const event: HandlerEvent = {
        httpMethod: 'OPTIONS',
        headers: {},
        body: null,
        path: '/api/auth-wallet',
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
    })
  })

  describe('POST requests - Wallet Authentication', () => {
    it('should authenticate wallet with valid signature', async () => {
      const authRequest = {
        wallet: '0x1234567890123456789012345678901234567890',
        signature: '0xvalidsignature',
        message: 'Sign this message to authenticate',
        nonce: 'test-nonce',
      }

      const event: HandlerEvent = {
        httpMethod: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify(authRequest),
        path: '/api/auth-wallet',
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
      expect(body).toHaveProperty('token')
      expect(body).toHaveProperty('wallet', authRequest.wallet.toLowerCase())
      expect(vi.mocked(jwt.sign)).toHaveBeenCalled()
    })

    it('should return 400 for missing wallet address', async () => {
      const event: HandlerEvent = {
        httpMethod: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          signature: '0xsignature',
          message: 'message',
        }),
        path: '/api/auth-wallet',
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

    it('should return 400 for invalid wallet address format', async () => {
      const event: HandlerEvent = {
        httpMethod: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          wallet: 'invalid-address',
          signature: '0xsignature',
          message: 'message',
          nonce: 'nonce',
        }),
        path: '/api/auth-wallet',
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
      expect(body.error).toContain('Invalid wallet address')
    })

    it('should return 400 for missing signature', async () => {
      const event: HandlerEvent = {
        httpMethod: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          wallet: '0x1234567890123456789012345678901234567890',
          message: 'message',
          nonce: 'nonce',
        }),
        path: '/api/auth-wallet',
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

    it('should handle JWT signing errors', async () => {
      vi.mocked(jwt.sign).mockImplementationOnce(() => {
        throw new Error('JWT signing failed')
      })

      const event: HandlerEvent = {
        httpMethod: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          wallet: '0x1234567890123456789012345678901234567890',
          signature: '0xsignature',
          message: 'message',
          nonce: 'nonce',
        }),
        path: '/api/auth-wallet',
        queryStringParameters: null,
        multiValueHeaders: {},
        multiValueQueryStringParameters: null,
        isBase64Encoded: false,
        rawUrl: '',
        rawQuery: '',
      }

      const response = await handler(event, mockContext)

      expect(response.statusCode).toBe(500)
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('error', 'Internal server error')
    })
  })

  describe('GET requests - Token Verification', () => {
    it('should verify valid JWT token', async () => {
      const event: HandlerEvent = {
        httpMethod: 'GET',
        headers: {
          authorization: 'Bearer mock-jwt-token',
        },
        body: null,
        path: '/api/auth-wallet',
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
      expect(body).toHaveProperty('valid', true)
      expect(body).toHaveProperty('wallet')
    })

    it('should return 401 for missing authorization header', async () => {
      const event: HandlerEvent = {
        httpMethod: 'GET',
        headers: {},
        body: null,
        path: '/api/auth-wallet',
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
      expect(body).toHaveProperty('error', 'No authorization token provided')
    })

    it('should return 401 for invalid token format', async () => {
      const event: HandlerEvent = {
        httpMethod: 'GET',
        headers: {
          authorization: 'InvalidFormat',
        },
        body: null,
        path: '/api/auth-wallet',
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
      expect(body).toHaveProperty('error')
    })

    it('should return 401 for expired token', async () => {
      vi.mocked(jwt.verify).mockImplementationOnce(() => {
        throw new Error('jwt expired')
      })

      const event: HandlerEvent = {
        httpMethod: 'GET',
        headers: {
          authorization: 'Bearer expired-token',
        },
        body: null,
        path: '/api/auth-wallet',
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
      expect(body).toHaveProperty('error')
    })
  })

  describe('Invalid methods', () => {
    it('should return 405 for unsupported methods', async () => {
      const event: HandlerEvent = {
        httpMethod: 'DELETE',
        headers: {},
        body: null,
        path: '/api/auth-wallet',
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