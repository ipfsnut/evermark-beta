import { describe, it, expect } from 'vitest'
import { 
  AppError, 
  APIError, 
  ValidationError, 
  BlockchainError, 
  handleError, 
  isNetworkError,
  type ValidationFieldError,
  type ValidationResult
} from './errors'

describe('AppError', () => {
  it('should create basic AppError', () => {
    const error = new AppError('Test error')
    expect(error).toBeInstanceOf(Error)
    expect(error).toBeInstanceOf(AppError)
    expect(error.name).toBe('AppError')
    expect(error.message).toBe('Test error')
    expect(error.code).toBeUndefined()
    expect(error.context).toBeUndefined()
  })

  it('should create AppError with code', () => {
    const error = new AppError('Test error', 'TEST_CODE')
    expect(error.code).toBe('TEST_CODE')
  })

  it('should create AppError with context', () => {
    const context = { userId: '123', action: 'test' }
    const error = new AppError('Test error', 'TEST_CODE', context)
    expect(error.context).toEqual(context)
  })

  it('should maintain Error interface', () => {
    const error = new AppError('Test error')
    expect(error.toString()).toContain('Test error')
    expect(error.stack).toBeDefined()
  })
})

describe('APIError', () => {
  it('should create basic APIError', () => {
    const error = new APIError('API error')
    expect(error).toBeInstanceOf(AppError)
    expect(error).toBeInstanceOf(APIError)
    expect(error.name).toBe('APIError')
    expect(error.message).toBe('API error')
    expect(error.status).toBeUndefined()
  })

  it('should create APIError with status', () => {
    const error = new APIError('API error', 404)
    expect(error.status).toBe(404)
  })

  it('should create APIError with all parameters', () => {
    const context = { endpoint: '/api/test' }
    const error = new APIError('API error', 500, 'INTERNAL_ERROR', context)
    expect(error.status).toBe(500)
    expect(error.code).toBe('INTERNAL_ERROR')
    expect(error.context).toEqual(context)
  })

  it('should inherit from AppError', () => {
    const error = new APIError('API error', 400, 'BAD_REQUEST')
    expect(error.code).toBe('BAD_REQUEST')
    expect(error.name).toBe('APIError')
  })
})

describe('ValidationError', () => {
  it('should create basic ValidationError', () => {
    const error = new ValidationError('Validation failed')
    expect(error).toBeInstanceOf(AppError)
    expect(error).toBeInstanceOf(ValidationError)
    expect(error.name).toBe('ValidationError')
    expect(error.message).toBe('Validation failed')
    expect(error.code).toBe('VALIDATION_ERROR')
    expect(error.field).toBeUndefined()
  })

  it('should create ValidationError with field', () => {
    const error = new ValidationError('Invalid email', 'email')
    expect(error.field).toBe('email')
  })

  it('should create ValidationError with context', () => {
    const context = { value: 'invalid-email', pattern: 'email' }
    const error = new ValidationError('Invalid email', 'email', context)
    expect(error.field).toBe('email')
    expect(error.context).toEqual(context)
    expect(error.code).toBe('VALIDATION_ERROR')
  })
})

describe('BlockchainError', () => {
  it('should create basic BlockchainError', () => {
    const error = new BlockchainError('Transaction failed')
    expect(error).toBeInstanceOf(AppError)
    expect(error).toBeInstanceOf(BlockchainError)
    expect(error.name).toBe('BlockchainError')
    expect(error.message).toBe('Transaction failed')
    expect(error.code).toBe('BLOCKCHAIN_ERROR')
    expect(error.txHash).toBeUndefined()
  })

  it('should create BlockchainError with transaction hash', () => {
    const txHash = '0x1234567890abcdef'
    const error = new BlockchainError('Transaction failed', txHash)
    expect(error.txHash).toBe(txHash)
  })

  it('should create BlockchainError with context', () => {
    const context = { gasUsed: 21000, blockNumber: 12345 }
    const error = new BlockchainError('Transaction failed', '0x123', context)
    expect(error.txHash).toBe('0x123')
    expect(error.context).toEqual(context)
    expect(error.code).toBe('BLOCKCHAIN_ERROR')
  })
})

describe('handleError', () => {
  it('should return AppError unchanged', () => {
    const originalError = new AppError('Original error')
    const result = handleError(originalError)
    expect(result).toBe(originalError)
  })

  it('should return APIError unchanged', () => {
    const originalError = new APIError('API error', 404)
    const result = handleError(originalError)
    expect(result).toBe(originalError)
  })

  it('should convert Error to AppError', () => {
    const originalError = new Error('Regular error')
    const result = handleError(originalError)
    expect(result).toBeInstanceOf(AppError)
    expect(result.message).toBe('Regular error')
    expect(result.name).toBe('AppError')
  })

  it('should handle TypeError', () => {
    const originalError = new TypeError('Type error')
    const result = handleError(originalError)
    expect(result).toBeInstanceOf(AppError)
    expect(result.message).toBe('Type error')
  })

  it('should handle string errors', () => {
    const result = handleError('String error')
    expect(result).toBeInstanceOf(AppError)
    expect(result.message).toBe('An unknown error occurred')
  })

  it('should handle null errors', () => {
    const result = handleError(null)
    expect(result).toBeInstanceOf(AppError)
    expect(result.message).toBe('An unknown error occurred')
  })

  it('should handle undefined errors', () => {
    const result = handleError(undefined)
    expect(result).toBeInstanceOf(AppError)
    expect(result.message).toBe('An unknown error occurred')
  })

  it('should handle object errors', () => {
    const result = handleError({ message: 'Object error' })
    expect(result).toBeInstanceOf(AppError)
    expect(result.message).toBe('An unknown error occurred')
  })
})

describe('isNetworkError', () => {
  it('should detect network errors by message', () => {
    expect(isNetworkError(new Error('network request failed'))).toBe(true)
    expect(isNetworkError(new Error('fetch failed'))).toBe(true)
    expect(isNetworkError(new Error('timeout occurred'))).toBe(true)
    expect(isNetworkError(new Error('network error occurred'))).toBe(true)
  })

  it('should detect fetch errors', () => {
    expect(isNetworkError(new Error('Failed to fetch'))).toBe(true)
    expect(isNetworkError(new Error('fetch: network error'))).toBe(true)
  })

  it('should detect timeout errors', () => {
    expect(isNetworkError(new Error('request timeout'))).toBe(true)
    expect(isNetworkError(new Error('connection timeout'))).toBe(true)
  })

  it('should not detect non-network errors', () => {
    expect(isNetworkError(new Error('Validation error'))).toBe(false)
    expect(isNetworkError(new Error('Invalid input'))).toBe(false)
    expect(isNetworkError(new Error('Database error'))).toBe(false)
  })

  it('should handle non-Error inputs', () => {
    expect(isNetworkError('network error')).toBe(false)
    expect(isNetworkError(null)).toBe(false)
    expect(isNetworkError(undefined)).toBe(false)
    expect(isNetworkError({ message: 'network error' })).toBe(false)
  })

  it('should be case-sensitive (matches implementation)', () => {
    expect(isNetworkError(new Error('network error'))).toBe(true)
    expect(isNetworkError(new Error('Network Error'))).toBe(false) // case-sensitive
    expect(isNetworkError(new Error('fetch failed'))).toBe(true)
    expect(isNetworkError(new Error('timeout'))).toBe(true)
  })

  it('should handle Error subclasses', () => {
    expect(isNetworkError(new TypeError('network error'))).toBe(true)
    expect(isNetworkError(new ReferenceError('fetch failed'))).toBe(true)
  })
})

describe('ValidationFieldError interface', () => {
  it('should define the correct structure', () => {
    const error: ValidationFieldError = {
      field: 'email',
      message: 'Invalid email format'
    }
    expect(error.field).toBe('email')
    expect(error.message).toBe('Invalid email format')
  })
})

describe('ValidationResult interface', () => {
  it('should define the correct structure for valid result', () => {
    const result: ValidationResult = {
      isValid: true,
      errors: []
    }
    expect(result.isValid).toBe(true)
    expect(result.errors).toEqual([])
    expect(result.warnings).toBeUndefined()
  })

  it('should define the correct structure for invalid result', () => {
    const result: ValidationResult = {
      isValid: false,
      errors: [
        { field: 'email', message: 'Required' },
        { field: 'password', message: 'Too short' }
      ],
      warnings: [
        { field: 'name', message: 'Recommended' }
      ]
    }
    expect(result.isValid).toBe(false)
    expect(result.errors).toHaveLength(2)
    expect(result.warnings).toHaveLength(1)
  })

  it('should handle empty errors and warnings', () => {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    }
    expect(result.errors).toEqual([])
    expect(result.warnings).toEqual([])
  })
})

describe('Error inheritance and instanceof checks', () => {
  it('should maintain proper inheritance chain', () => {
    const apiError = new APIError('API error', 404)
    expect(apiError instanceof Error).toBe(true)
    expect(apiError instanceof AppError).toBe(true)
    expect(apiError instanceof APIError).toBe(true)
  })

  it('should work with try-catch blocks', () => {
    try {
      throw new ValidationError('Invalid input', 'field')
    } catch (error) {
      expect(error instanceof Error).toBe(true)
      expect(error instanceof AppError).toBe(true)
      expect(error instanceof ValidationError).toBe(true)
      if (error instanceof ValidationError) {
        expect(error.field).toBe('field')
      }
    }
  })

  it('should preserve stack traces', () => {
    const error = new BlockchainError('Transaction failed')
    expect(error.stack).toBeDefined()
    expect(error.stack).toContain('BlockchainError')
  })
})