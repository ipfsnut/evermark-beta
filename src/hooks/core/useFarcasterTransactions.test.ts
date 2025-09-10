// src/hooks/core/useFarcasterTransactions.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFarcasterTransactions } from './useFarcasterTransactions';

// Mock the dependencies
vi.mock('@/providers/WalletProvider', () => ({
  useWallet: vi.fn()
}));

vi.mock('viem', () => ({
  encodeFunctionData: vi.fn()
}));

vi.mock('thirdweb', () => ({
  waitForReceipt: vi.fn()
}));

vi.mock('@/lib/thirdweb', () => ({
  client: {}
}));

vi.mock('thirdweb/chains', () => ({
  base: { id: 8453 }
}));

// Mock Farcaster SDK
vi.mock('@farcaster/miniapp-sdk', () => ({
  sdk: {
    wallet: {
      getEthereumProvider: vi.fn()
    }
  }
}));

describe('useFarcasterTransactions', () => {
  let mockUseWallet: any;
  let mockEncodeFunctionData: any;
  let mockWaitForReceipt: any;

  beforeEach(async () => {
    // Suppress console.error during tests to avoid stderr output
    vi.spyOn(console, 'error').mockImplementation(() => {})
    
    mockUseWallet = vi.mocked((await import('@/providers/WalletProvider')).useWallet);
    mockEncodeFunctionData = vi.mocked((await import('viem')).encodeFunctionData);
    mockWaitForReceipt = vi.mocked((await import('thirdweb')).waitForReceipt);
  });

  // Mock dynamic import of SDK
  const mockSdk = {
    wallet: {
      getEthereumProvider: vi.fn()
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock dynamic import of Farcaster SDK
    vi.doMock('@farcaster/miniapp-sdk', () => ({
      sdk: mockSdk
    }));
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
    });

    it('should indicate transaction support in Farcaster context', () => {
      const { result } = renderHook(() => useFarcasterTransactions());

      expect(result.current.isTransactionSupported()).toBe(true);
      expect(result.current.context).toBe('farcaster');
    });

    it('should return correct capabilities in Farcaster context', () => {
      const { result } = renderHook(() => useFarcasterTransactions());

      const capabilities = result.current.getTransactionCapabilities();

      expect(capabilities).toEqual({
        canSendTransaction: true,
        context: 'farcaster',
        hasWagmiSupport: false, // We use SDK directly
        accountAddress: '0x1234567890123456789012345678901234567890'
      });
    });

    it('should send transaction successfully through Farcaster SDK', async () => {
      const mockEthProvider = {
        request: vi.fn().mockResolvedValue('0xabcdef123456789')
      };

      mockSdk.wallet.getEthereumProvider.mockResolvedValue(mockEthProvider);
      
      mockEncodeFunctionData.mockReturnValue('0x encodeddata123');
      
      mockWaitForReceipt.mockResolvedValue({
        blockNumber: BigInt(12345)
      });

      const { result } = renderHook(() => useFarcasterTransactions());

      const mockTransaction = {
        contract: {
          address: '0x0987654321098765432109876543210987654321',
          abi: [{ 
            name: 'mint', 
            type: 'function',
            inputs: [
              { name: 'to', type: 'address' },
              { name: 'amount', type: 'uint256' }
            ]
          }]
        },
        method: 'function mint(address to, uint256 amount)',
        params: ['0x1111111111111111111111111111111111111111', BigInt(100)],
        value: BigInt(0)
      };

      await act(async () => {
        const txResult = await result.current.sendTransaction(mockTransaction);
        
        expect(txResult).toEqual({
          transactionHash: '0xabcdef123456789',
          blockNumber: 12345
        });
      });

      // Verify SDK calls
      expect(mockSdk.wallet.getEthereumProvider).toHaveBeenCalled();
      
      expect(mockEncodeFunctionData).toHaveBeenCalledWith({
        abi: mockTransaction.contract.abi,
        functionName: 'mint',
        args: mockTransaction.params
      });

      expect(mockEthProvider.request).toHaveBeenCalledWith({
        method: 'eth_sendTransaction',
        params: [{
          to: '0x0987654321098765432109876543210987654321',
          data: '0x encodeddata123',
          value: '0x0',
          from: '0x1234567890123456789012345678901234567890'
        }]
      });

      expect(mockWaitForReceipt).toHaveBeenCalledWith({
        client: {},
        chain: { id: 8453 },
        transactionHash: '0xabcdef123456789'
      });
    });

    it('should handle transaction with value properly', async () => {
      const mockEthProvider = {
        request: vi.fn().mockResolvedValue('0xabcdef123456789')
      };

      mockSdk.wallet.getEthereumProvider.mockResolvedValue(mockEthProvider);
      mockEncodeFunctionData.mockReturnValue('0x encodeddata123');
      mockWaitForReceipt.mockResolvedValue({
        blockNumber: BigInt(12345)
      });

      const { result } = renderHook(() => useFarcasterTransactions());

      const mockTransaction = {
        contract: {
          address: '0x0987654321098765432109876543210987654321',
          abi: [{ name: 'payableFunction', type: 'function' }]
        },
        method: 'function payableFunction()',
        params: [],
        value: BigInt(1000000000000000000) // 1 ETH in wei
      };

      await act(async () => {
        await result.current.sendTransaction(mockTransaction);
      });

      expect(mockEthProvider.request).toHaveBeenCalledWith({
        method: 'eth_sendTransaction',
        params: [{
          to: '0x0987654321098765432109876543210987654321',
          data: '0x encodeddata123',
          value: '0xde0b6b3a7640000', // 1 ETH in hex
          from: '0x1234567890123456789012345678901234567890'
        }]
      });
    });

    it('should handle SDK provider not available error', async () => {
      mockSdk.wallet.getEthereumProvider.mockResolvedValue(null);

      const { result } = renderHook(() => useFarcasterTransactions());

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
          'Transaction failed in Farcaster context: Farcaster wallet provider not available'
        );
      });
    });

    it('should handle invalid function signature error', async () => {
      const { result } = renderHook(() => useFarcasterTransactions());

      const mockTransaction = {
        contract: {
          address: '0x0987654321098765432109876543210987654321',
          abi: [{ name: 'mint', type: 'function' }]
        },
        method: 'invalid signature', // Invalid function signature
        params: ['0x1111111111111111111111111111111111111111', 100],
        value: BigInt(0)
      };

      await act(async () => {
        await expect(result.current.sendTransaction(mockTransaction)).rejects.toThrow(
          'Transaction failed in Farcaster context: Invalid function signature: invalid signature'
        );
      });
    });

    it('should handle transaction rejection by user', async () => {
      const mockEthProvider = {
        request: vi.fn().mockRejectedValue(new Error('User rejected request'))
      };

      mockSdk.wallet.getEthereumProvider.mockResolvedValue(mockEthProvider);
      mockEncodeFunctionData.mockReturnValue('0x encodeddata123');

      const { result } = renderHook(() => useFarcasterTransactions());

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
  });

  describe('Non-Farcaster Context', () => {
    beforeEach(() => {
      mockUseWallet.mockReturnValue({
        context: 'browser',
        address: '0x1234567890123456789012345678901234567890',
        isConnected: true,
        connect: vi.fn(),
        disconnect: vi.fn(),
        connectionSource: 'thirdweb'
      });
    });

    it('should indicate no transaction support outside Farcaster context', () => {
      const { result } = renderHook(() => useFarcasterTransactions());

      expect(result.current.isTransactionSupported()).toBe(false);
    });

    it('should return correct capabilities outside Farcaster context', () => {
      const { result } = renderHook(() => useFarcasterTransactions());

      const capabilities = result.current.getTransactionCapabilities();

      expect(capabilities).toEqual({
        canSendTransaction: false,
        context: 'farcaster',
        hasWagmiSupport: false,
        accountAddress: '0x1234567890123456789012345678901234567890'
      });
    });

    it('should throw error when trying to send transaction outside Farcaster context', async () => {
      const { result } = renderHook(() => useFarcasterTransactions());

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
          'useFarcasterTransactions can only send transactions in Farcaster context'
        );
      });
    });

    it('should throw error when no wallet connected', async () => {
      mockUseWallet.mockReturnValue({
        context: 'farcaster',
        address: null, // No wallet connected
        isConnected: false,
        connect: vi.fn(),
        disconnect: vi.fn(),
        connectionSource: null
      });

      const { result } = renderHook(() => useFarcasterTransactions());

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
          'No wallet connected in Farcaster context'
        );
      });
    });
  });

  describe('Function Name Extraction', () => {
    beforeEach(() => {
      mockUseWallet.mockReturnValue({
        context: 'farcaster',
        address: '0x1234567890123456789012345678901234567890',
        isConnected: true,
        connect: vi.fn(),
        disconnect: vi.fn(),
        connectionSource: 'miniapp-wagmi'
      });
    });

    it('should extract function name from various signature formats', async () => {
      const mockEthProvider = {
        request: vi.fn().mockResolvedValue('0xabcdef123456789')
      };

      mockSdk.wallet.getEthereumProvider.mockResolvedValue(mockEthProvider);
      mockEncodeFunctionData.mockReturnValue('0x encodeddata123');
      mockWaitForReceipt.mockResolvedValue({
        blockNumber: BigInt(12345)
      });

      const { result } = renderHook(() => useFarcasterTransactions());

      // Test different function signature formats
      const testCases = [
        {
          signature: 'function mint(address to, uint256 amount)',
          expectedName: 'mint'
        },
        {
          signature: 'function transfer(address recipient, uint256 amount) external returns (bool)',
          expectedName: 'transfer'
        },
        {
          signature: 'function approve(address spender, uint256 amount) public returns (bool)',
          expectedName: 'approve'
        }
      ];

      for (const testCase of testCases) {
        mockEncodeFunctionData.mockClear();

        const mockTransaction = {
          contract: {
            address: '0x0987654321098765432109876543210987654321',
            abi: [{ name: testCase.expectedName, type: 'function' }]
          },
          method: testCase.signature,
          params: [],
          value: BigInt(0)
        };

        await act(async () => {
          await result.current.sendTransaction(mockTransaction);
        });

        expect(mockEncodeFunctionData).toHaveBeenCalledWith({
          abi: mockTransaction.contract.abi,
          functionName: testCase.expectedName,
          args: mockTransaction.params
        });
      }
    });
  });
});