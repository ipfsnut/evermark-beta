// src/hooks/core/useContextualTransactions.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useContextualTransactions } from './useContextualTransactions';

// Mock the dependencies
vi.mock('@/providers/WalletProvider', () => ({
  useWallet: vi.fn()
}));

vi.mock('./useWalletAccount', () => ({
  useWalletAccount: vi.fn(),
  useThirdwebAccount: vi.fn()
}));

vi.mock('thirdweb/react', () => ({
  useSendTransaction: vi.fn()
}));

vi.mock('./useFarcasterTransactions', () => ({
  useFarcasterTransactions: vi.fn()
}));

vi.mock('thirdweb', () => ({
  prepareContractCall: vi.fn(),
  waitForReceipt: vi.fn()
}));

vi.mock('@/lib/thirdweb', () => ({
  client: {}
}));

vi.mock('thirdweb/chains', () => ({
  base: { id: 8453 }
}));

describe('useContextualTransactions', () => {
  let mockUseWallet: any;
  let mockUseWalletAccount: any;
  let mockUseThirdwebAccount: any;
  let mockUseSendTransaction: any;
  let mockUseFarcasterTransactions: any;
  let mockPrepareContractCall: any;
  let mockWaitForReceipt: any;

  beforeEach(async () => {
    mockUseWallet = vi.mocked((await import('@/providers/WalletProvider')).useWallet);
    mockUseWalletAccount = vi.mocked((await import('./useWalletAccount')).useWalletAccount);
    mockUseThirdwebAccount = vi.mocked((await import('./useWalletAccount')).useThirdwebAccount);
    mockUseSendTransaction = vi.mocked((await import('thirdweb/react')).useSendTransaction);
    mockUseFarcasterTransactions = vi.mocked((await import('./useFarcasterTransactions')).useFarcasterTransactions);
    mockPrepareContractCall = vi.mocked((await import('thirdweb')).prepareContractCall);
    mockWaitForReceipt = vi.mocked((await import('thirdweb')).waitForReceipt);
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Farcaster Context', () => {
    beforeEach(() => {
      mockUseWallet.mockReturnValue({
        context: 'farcaster',
        address: '0x1234567890123456789012345678901234567890',
        isConnected: true,
        connect: vi.fn(),
        disconnect: vi.fn(),
        connectionSource: 'miniapp-wagmi'
      });

      mockUseWalletAccount.mockReturnValue({
        address: '0x1234567890123456789012345678901234567890',
        isConnected: true
      });
    });

    it('should use Farcaster transaction hook in Farcaster context', () => {
      const mockFarcasterTx = {
        sendTransaction: vi.fn(),
        isTransactionSupported: vi.fn(() => true),
        getTransactionCapabilities: vi.fn(() => ({
          canSendTransaction: true,
          context: 'farcaster',
          hasWagmiSupport: false,
          accountAddress: '0x1234567890123456789012345678901234567890'
        })),
        context: 'farcaster'
      };

      mockUseFarcasterTransactions.mockReturnValue(mockFarcasterTx);

      const { result } = renderHook(() => useContextualTransactions());

      expect(mockUseFarcasterTransactions).toHaveBeenCalled();
      expect(result.current.context).toBe('farcaster');
    });

    it('should send transaction through Farcaster hook', async () => {
      const mockSendTransaction = vi.fn().mockResolvedValue({
        transactionHash: '0xabcdef123456789',
        blockNumber: 12345
      });

      const mockFarcasterTx = {
        sendTransaction: mockSendTransaction,
        isTransactionSupported: vi.fn(() => true),
        getTransactionCapabilities: vi.fn(() => ({
          canSendTransaction: true,
          context: 'farcaster',
          hasWagmiSupport: false,
          accountAddress: '0x1234567890123456789012345678901234567890'
        })),
        context: 'farcaster'
      };

      mockUseFarcasterTransactions.mockReturnValue(mockFarcasterTx);

      const { result } = renderHook(() => useContextualTransactions());

      const mockTransaction = {
        contract: {
          address: '0x0987654321098765432109876543210987654321',
          abi: [{ name: 'mint', type: 'function' }]
        },
        method: 'function mint(address to, uint256 amount)',
        params: ['0x1111111111111111111111111111111111111111', 100],
        value: BigInt(0)
      };

      await act(async () => {
        const txResult = await result.current.sendTransaction(mockTransaction);
        expect(txResult).toEqual({
          transactionHash: '0xabcdef123456789',
          blockNumber: 12345
        });
      });

      expect(mockSendTransaction).toHaveBeenCalledWith(mockTransaction);
    });

    it('should handle Farcaster transaction errors properly', async () => {
      const mockSendTransaction = vi.fn().mockRejectedValue(
        new Error('Transaction failed in Farcaster context: User rejected request')
      );

      const mockFarcasterTx = {
        sendTransaction: mockSendTransaction,
        isTransactionSupported: vi.fn(() => true),
        getTransactionCapabilities: vi.fn(() => ({
          canSendTransaction: true,
          context: 'farcaster',
          hasWagmiSupport: false,
          accountAddress: '0x1234567890123456789012345678901234567890'
        })),
        context: 'farcaster'
      };

      mockUseFarcasterTransactions.mockReturnValue(mockFarcasterTx);

      const { result } = renderHook(() => useContextualTransactions());

      const mockTransaction = {
        contract: {
          address: '0x0987654321098765432109876543210987654321',
          abi: [{ name: 'mint', type: 'function' }]
        },
        method: 'function mint(address to, uint256 amount)',
        params: ['0x1111111111111111111111111111111111111111', 100],
        value: BigInt(0)
      };

      await act(async () => {
        await expect(result.current.sendTransaction(mockTransaction)).rejects.toThrow(
          'Transaction failed in Farcaster context: User rejected request'
        );
      });
    });

    it('should return correct transaction capabilities for Farcaster context', () => {
      const mockGetTransactionCapabilities = vi.fn(() => ({
        canSendTransaction: true,
        context: 'farcaster',
        hasWagmiSupport: false,
        accountAddress: '0x1234567890123456789012345678901234567890'
      }));

      const mockFarcasterTx = {
        sendTransaction: vi.fn(),
        isTransactionSupported: vi.fn(() => true),
        getTransactionCapabilities: mockGetTransactionCapabilities,
        context: 'farcaster'
      };

      mockUseFarcasterTransactions.mockReturnValue(mockFarcasterTx);

      const { result } = renderHook(() => useContextualTransactions());

      const capabilities = result.current.getTransactionCapabilities();

      expect(capabilities).toEqual({
        canSendTransaction: true,
        context: 'farcaster',
        hasWagmiSupport: false,
        accountAddress: '0x1234567890123456789012345678901234567890'
      });

      expect(mockGetTransactionCapabilities).toHaveBeenCalled();
    });
  });

  describe('Browser Context', () => {
    beforeEach(() => {
      mockUseWallet.mockReturnValue({
        context: 'browser',
        address: '0x1234567890123456789012345678901234567890',
        isConnected: true,
        connect: vi.fn(),
        disconnect: vi.fn(),
        connectionSource: 'thirdweb'
      });

      mockUseWalletAccount.mockReturnValue({
        address: '0x1234567890123456789012345678901234567890',
        isConnected: true
      });

      mockUseThirdwebAccount.mockReturnValue({
        address: '0x1234567890123456789012345678901234567890'
      });

      mockUseSendTransaction.mockReturnValue({
        mutateAsync: vi.fn()
      });
    });

    it('should use Thirdweb transaction system in browser context', async () => {
      const mockThirdwebSendTx = vi.fn().mockResolvedValue({
        transactionHash: '0xthirdweb123456789'
      });

      mockUseSendTransaction.mockReturnValue({
        mutateAsync: mockThirdwebSendTx
      });

      mockPrepareContractCall.mockReturnValue({
        prepared: true
      });

      mockWaitForReceipt.mockResolvedValue({
        blockNumber: BigInt(12345)
      });

      // Mock Farcaster hook to return null functions since we're in browser context
      const mockFarcasterTx = {
        sendTransaction: vi.fn(),
        isTransactionSupported: vi.fn(() => false),
        getTransactionCapabilities: vi.fn(() => ({
          canSendTransaction: false,
          context: 'farcaster',
          hasWagmiSupport: false,
          accountAddress: null
        })),
        context: 'farcaster'
      };

      mockUseFarcasterTransactions.mockReturnValue(mockFarcasterTx);

      const { result } = renderHook(() => useContextualTransactions());

      const mockTransaction = {
        contract: {
          address: '0x0987654321098765432109876543210987654321',
          abi: [{ name: 'mint', type: 'function' }]
        },
        method: 'function mint(address to, uint256 amount)',
        params: ['0x1111111111111111111111111111111111111111', 100],
        value: BigInt(0)
      };

      await act(async () => {
        const txResult = await result.current.sendTransaction(mockTransaction);
        expect(txResult).toEqual({
          transactionHash: '0xthirdweb123456789'
        });
      });

      expect(mockThirdwebSendTx).toHaveBeenCalled();
      expect(mockPrepareContractCall).toHaveBeenCalled();
      expect(mockWaitForReceipt).toHaveBeenCalled();
    });

    it('should handle browser transaction errors properly', async () => {
      const mockThirdwebSendTx = vi.fn().mockRejectedValue(
        new Error('User rejected transaction')
      );

      mockUseSendTransaction.mockReturnValue({
        mutateAsync: mockThirdwebSendTx
      });

      mockPrepareContractCall.mockReturnValue({
        prepared: true
      });

      // Mock Farcaster hook to return null functions since we're in browser context
      const mockFarcasterTx = {
        sendTransaction: vi.fn(),
        isTransactionSupported: vi.fn(() => false),
        getTransactionCapabilities: vi.fn(() => ({
          canSendTransaction: false,
          context: 'farcaster',
          hasWagmiSupport: false,
          accountAddress: null
        })),
        context: 'farcaster'
      };

      mockUseFarcasterTransactions.mockReturnValue(mockFarcasterTx);

      const { result } = renderHook(() => useContextualTransactions());

      const mockTransaction = {
        contract: {
          address: '0x0987654321098765432109876543210987654321',
          abi: [{ name: 'mint', type: 'function' }]
        },
        method: 'function mint(address to, uint256 amount)',
        params: ['0x1111111111111111111111111111111111111111', 100],
        value: BigInt(0)
      };

      await act(async () => {
        await expect(result.current.sendTransaction(mockTransaction)).rejects.toThrow(
          'User rejected transaction'
        );
      });
    });
  });

  describe('Hook Integration', () => {
    it('should always call useFarcasterTransactions hook (no conditional calls)', () => {
      // Test browser context - hook should still be called
      mockUseWallet.mockReturnValue({
        context: 'browser',
        address: '0x1234567890123456789012345678901234567890',
        isConnected: true,
        connect: vi.fn(),
        disconnect: vi.fn(),
        connectionSource: 'thirdweb'
      });

      mockUseWalletAccount.mockReturnValue({
        address: '0x1234567890123456789012345678901234567890',
        isConnected: true
      });

      mockUseFarcasterTransactions.mockReturnValue({
        sendTransaction: vi.fn(),
        isTransactionSupported: vi.fn(() => false),
        getTransactionCapabilities: vi.fn(() => ({
          canSendTransaction: false,
          context: 'farcaster',
          hasWagmiSupport: false,
          accountAddress: null
        })),
        context: 'farcaster'
      });

      renderHook(() => useContextualTransactions());

      // Verify that Farcaster hook is called even in browser context (avoiding conditional hook calls)
      expect(mockUseFarcasterTransactions).toHaveBeenCalled();
    });
  });
});