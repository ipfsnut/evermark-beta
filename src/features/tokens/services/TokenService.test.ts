import { describe, it, expect } from 'vitest'
import { TokenService } from './TokenService'
import { TOKEN_CONSTANTS } from '../types'

describe('TokenService', () => {
  describe('formatTokenAmount', () => {
    it('should format zero amount correctly', () => {
      expect(TokenService.formatTokenAmount(BigInt(0))).toBe('0')
    })

    it('should format small amounts correctly', () => {
      const amount = BigInt(100) * BigInt(10 ** 18)
      expect(TokenService.formatTokenAmount(amount)).toBe('100')
    })

    it('should format large amounts with commas', () => {
      const amount = BigInt(1234567) * BigInt(10 ** 18)
      expect(TokenService.formatTokenAmount(amount, 18)).toBe('1,234,567')
    })

    it('should use short format for very large numbers when decimals != 18', () => {
      const billion = BigInt(1000000000) * BigInt(10 ** 18)
      expect(TokenService.formatTokenAmount(billion, 6)).toBe('1.0B')
      
      const million = BigInt(1500000) * BigInt(10 ** 18)
      expect(TokenService.formatTokenAmount(million, 6)).toBe('1.5M')
      
      const thousand = BigInt(2500) * BigInt(10 ** 18)
      expect(TokenService.formatTokenAmount(thousand, 6)).toBe('2.5K')
    })

    it('should round down to whole numbers', () => {
      const amount = BigInt(1234567890123456789n) // Less than 1 full token
      expect(TokenService.formatTokenAmount(amount)).toBe('1')
    })
  })

  describe('parseTokenAmount', () => {
    it('should parse empty string to zero', () => {
      expect(TokenService.parseTokenAmount('')).toBe(BigInt(0))
      expect(TokenService.parseTokenAmount('  ')).toBe(BigInt(0))
    })

    it('should parse whole numbers correctly', () => {
      expect(TokenService.parseTokenAmount('100')).toBe(BigInt(100) * BigInt(10 ** 18))
      expect(TokenService.parseTokenAmount('1000000')).toBe(BigInt(1000000) * BigInt(10 ** 18))
    })

    it('should parse decimal numbers correctly', () => {
      expect(TokenService.parseTokenAmount('1.5')).toBe(BigInt(15) * BigInt(10 ** 17))
      expect(TokenService.parseTokenAmount('0.1')).toBe(BigInt(10 ** 17))
    })

    it('should handle numbers with commas', () => {
      expect(TokenService.parseTokenAmount('1,000')).toBe(BigInt(1000) * BigInt(10 ** 18))
      expect(TokenService.parseTokenAmount('1,234,567')).toBe(BigInt(1234567) * BigInt(10 ** 18))
    })
  })

  describe('validateTokenAmount', () => {
    it('should validate empty amount', () => {
      const result = TokenService.validateTokenAmount('')
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Amount is required')
    })

    it('should validate zero amount', () => {
      const result = TokenService.validateTokenAmount('0')
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Amount must be greater than zero')
    })

    it('should validate insufficient balance', () => {
      const maxAmount = BigInt(500) * BigInt(10 ** 18)
      const result = TokenService.validateTokenAmount('1000', maxAmount)
      expect(result.isValid).toBe(false)
      expect(result.errors[0]).toContain('exceeds available balance')
    })

    it('should validate valid amount', () => {
      const maxAmount = BigInt(1000) * BigInt(10 ** 18)
      const result = TokenService.validateTokenAmount('500', maxAmount)
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should warn about large amounts', () => {
      const maxAmount = BigInt(1000) * BigInt(10 ** 18)
      const result = TokenService.validateTokenAmount('600', maxAmount)
      expect(result.isValid).toBe(true)
      expect(result.warnings).toContain('You are using more than 50% of your balance')
    })
  })

  describe('calculateTokenBalance', () => {
    it('should calculate token balance info correctly', () => {
      const emarkBalance = BigInt(1000) * BigInt(10 ** 18)
      const allowance = BigInt(500) * BigInt(10 ** 18)
      
      const result = TokenService.calculateTokenBalance(emarkBalance, allowance)
      
      expect(result.emarkBalance).toBe(emarkBalance)
      expect(result.allowanceForStaking).toBe(allowance)
      expect(result.formattedBalance).toBe('1,000')
      expect(result.formattedAllowance).toBe('500')
      expect(result.hasBalance).toBe(true)
      expect(result.hasAllowance).toBe(true)
      expect(result.canStake).toBe(true)
    })

    it('should handle zero balances', () => {
      const result = TokenService.calculateTokenBalance(BigInt(0), BigInt(0))
      
      expect(result.hasBalance).toBe(false)
      expect(result.hasAllowance).toBe(false)
      expect(result.canStake).toBe(false)
    })
  })
})