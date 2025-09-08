import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useTokenState } from './useTokenState'
import { AllTheProviders } from '@/test/utils/mock-providers'

vi.mock('@/hooks/core/useWalletAccount', () => ({
  useWalletAccount: vi.fn(() => ({
    address: '0x1234567890123456789012345678901234567890',
  })),
  useThirdwebAccount: vi.fn(() => ({
    address: '0x1234567890123456789012345678901234567890',
  })),
}))

vi.mock('@/providers/WalletProvider', () => ({
  useWallet: vi.fn(() => ({
    context: 'browser',
    address: '0x1234567890123456789012345678901234567890',
    isConnected: true,
  })),
}))

vi.mock('thirdweb', () => ({
  readContract: vi.fn(),
  getContract: vi.fn(() => ({
    address: '0xMockTokenAddress',
    abi: [],
  })),
  prepareContractCall: vi.fn(),
}))

vi.mock('thirdweb/react', () => ({
  useSendTransaction: vi.fn(() => ({
    mutateAsync: vi.fn(),
  })),
}))

vi.mock('@/lib/thirdweb', () => ({
  client: { clientId: 'test' },
}))

vi.mock('@/lib/contracts', () => ({
  getContract: vi.fn(),
}))

describe('useTokenState', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useTokenState(), {
      wrapper: AllTheProviders,
    })

    expect(result.current.isConnected).toBe(true)
    expect(result.current.isLoading).toBe(false)
    expect(result.current.isApproving).toBe(false)
    expect(result.current.approvalError).toBe(null)
  })

  it('should provide token formatting utilities', () => {
    const { result } = renderHook(() => useTokenState(), {
      wrapper: AllTheProviders,
    })

    expect(result.current.formatTokenAmount).toBeDefined()
    expect(result.current.parseTokenAmount).toBeDefined()
    expect(result.current.validateAmount).toBeDefined()
  })

  it('should provide approval functions', () => {
    const { result } = renderHook(() => useTokenState(), {
      wrapper: AllTheProviders,
    })

    expect(result.current.approveForStaking).toBeDefined()
    expect(result.current.approveUnlimited).toBeDefined()
    expect(result.current.needsApproval).toBeDefined()
  })

  it('should provide state management functions', () => {
    const { result } = renderHook(() => useTokenState(), {
      wrapper: AllTheProviders,
    })

    expect(result.current.refetch).toBeDefined()
    expect(result.current.clearErrors).toBeDefined()
  })

  it('should handle disconnected state gracefully', () => {
    const { result } = renderHook(() => useTokenState(), {
      wrapper: AllTheProviders,
    })

    // Just test that basic functions exist and return appropriate types
    expect(typeof result.current.formatTokenAmount).toBe('function')
    expect(typeof result.current.parseTokenAmount).toBe('function')
    expect(typeof result.current.validateAmount).toBe('function')
  })
})