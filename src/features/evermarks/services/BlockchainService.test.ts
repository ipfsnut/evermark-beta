import { describe, it, expect, vi, beforeEach } from 'vitest'
import EvermarkBlockchainService from './BlockchainService'
import * as thirdweb from 'thirdweb'

vi.mock('thirdweb', () => ({
  getContract: vi.fn(),
  prepareContractCall: vi.fn(),
  sendTransaction: vi.fn(),
  waitForReceipt: vi.fn(),
  readContract: vi.fn(),
  getRpcClient: vi.fn(() => ({
    getBalance: vi.fn(() => Promise.resolve({ value: BigInt(2000000000000000000) })), // 2 ETH
  })),
}))

vi.mock('@/lib/thirdweb', () => ({
  client: { clientId: 'test' },
}))

vi.mock('@/lib/contracts', () => ({
  CONTRACTS: {
    EVERMARK_NFT: '0x504a0BDC3aea29237a6f8E53D0ECDA8e4c9009F2',
  },
  getEvermarkNFTContract: vi.fn(() => ({
    address: '0x504a0BDC3aea29237a6f8E53D0ECDA8e4c9009F2',
    chain: { id: 8453 },
    abi: [],
  })),
}))

describe('EvermarkBlockchainService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Set environment variables to match .env.local - ALL DEPLOYED CONTRACTS
    process.env.VITE_EVERMARK_NFT_ADDRESS = '0x504a0BDC3aea29237a6f8E53D0ECDA8e4c9009F2'
    process.env.VITE_EVERMARK_VOTING_ADDRESS = '0x5089FE55368E40c8990214Ca99bd2214b34A179D'
    process.env.VITE_EVERMARK_REWARDS_ADDRESS = '0x88E5C57FFC8De966eD789ebd5A8E3B290Ed2B55C'
    process.env.VITE_EMARK_ADDRESS = '0xf87F3ebbF8CaCF321C2a4027bb66Df639a6f4B07'
    process.env.VITE_WEMARK_ADDRESS = '0xDf756488A3A27352ED1Be38A94f6621A6CE2Ce15'
    process.env.VITE_NFT_STAKING_ADDRESS = '0x95f9aaDb35E74aba92DAAFfe1Ae74Cb467149210'
    process.env.VITE_MARKETPLACE_ADDRESS = '0x56b178A3AA23d323Ae9d8E85Bd633f2F5Ff98FAD'
    process.env.VITE_FEE_COLLECTOR_ADDRESS = '0xaab93405679576ec743fDAA57AA603D949850604'
    process.env.VITE_CHAIN_ID = '8453'
    process.env.VITE_THIRDWEB_CLIENT_ID = '0b1d7a7c085408bf3cfe4ccccd24c08e'
  })

  describe('getMintingFee', () => {
    it('should fetch minting fee from contract', async () => {
      vi.mocked(thirdweb.readContract).mockResolvedValue(BigInt(1000000000000000)) // 0.001 ETH

      const result = await EvermarkBlockchainService.getMintingFee()

      expect(result).toBe(BigInt(1000000000000000))
      expect(thirdweb.readContract).toHaveBeenCalled()
    })

    it('should handle contract read errors', async () => {
      vi.mocked(thirdweb.readContract).mockRejectedValue(new Error('Network error'))

      await expect(EvermarkBlockchainService.getMintingFee()).rejects.toThrow('Network error')
    })
  })

  describe('getTotalSupply', () => {
    it('should fetch total supply from contract', async () => {
      vi.mocked(thirdweb.readContract).mockResolvedValue(BigInt(100))

      const result = await EvermarkBlockchainService.getTotalSupply()

      expect(result).toBe(100)
      expect(thirdweb.readContract).toHaveBeenCalled()
    })
  })

  describe('getIsPaused', () => {
    it('should check if contract is paused', async () => {
      vi.mocked(thirdweb.readContract).mockResolvedValue(false)

      const result = await EvermarkBlockchainService.getIsPaused()

      expect(result).toBe(false)
      expect(thirdweb.readContract).toHaveBeenCalled()
    })
  })

  describe('mintEvermark', () => {
    it('should validate account address format', async () => {
      const mockAccount = { address: '0xUser' } as any // Invalid address format

      const result = await EvermarkBlockchainService.mintEvermark(
        mockAccount,
        'ipfs://metadata',
        'Test Title',
        'Test Creator'
      )

      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid account address provided')
    })

    it('should mint evermark successfully with valid account', async () => {
      const mockAccount = { address: '0x1234567890123456789012345678901234567890' } as any
      const mockTxHash = '0xTxHash'
      const mockReceipt = { 
        transactionHash: '0xTxHash',
        status: 'success',
        logs: [{ 
          topics: ['0x123'],
          data: '0x0000000000000000000000000000000000000000000000000000000000000001'
        }]
      }

      // Mock fee check
      vi.mocked(thirdweb.readContract).mockResolvedValueOnce(BigInt(1000000000000000))
      
      // Mock transaction
      vi.mocked(thirdweb.prepareContractCall).mockResolvedValue({} as any)
      vi.mocked(thirdweb.sendTransaction).mockResolvedValue(mockTxHash)
      vi.mocked(thirdweb.waitForReceipt).mockResolvedValue(mockReceipt as any)

      const result = await EvermarkBlockchainService.mintEvermark(
        mockAccount,
        'ipfs://metadata',
        'Test Title',
        '0x1234567890123456789012345678901234567890' // Valid creator address
      )

      expect(result.success).toBe(true)
      expect(result.txHash).toBe(mockTxHash)
    })
  })

  describe('getReferralPercentage', () => {
    it('should fetch referral percentage from contract', async () => {
      // Contract actually returns the raw value
      const contractValue = BigInt(1000000000000000)
      vi.mocked(thirdweb.readContract).mockResolvedValue(contractValue)

      const result = await EvermarkBlockchainService.getReferralPercentage()

      // Convert the bigint to number and expect that
      expect(result).toBe(Number(contractValue))
      expect(thirdweb.readContract).toHaveBeenCalled()
    })
  })

  describe('canAffordMint', () => {
    it('should return false for invalid account address', async () => {
      const mockAccount = { 
        address: '0xUser', // Invalid format
        balance: BigInt(2000000000000000000) // 2 ETH
      } as any

      const result = await EvermarkBlockchainService.canAffordMint(
        mockAccount,
        BigInt(1000000000000000) // 0.001 ETH fee
      )

      expect(result).toBe(false) // Invalid address should return false
    })

    it('should return false for insufficient balance', async () => {
      const mockAccount = { 
        address: '0x1234567890123456789012345678901234567890',
        balance: BigInt(500000000000000) // 0.0005 ETH
      } as any

      const result = await EvermarkBlockchainService.canAffordMint(
        mockAccount,
        BigInt(1000000000000000) // 0.001 ETH fee
      )

      expect(result).toBe(false)
    })
  })

  describe('getPendingReferralPayment', () => {
    it('should fetch pending referral payment', async () => {
      const address = '0x1234567890123456789012345678901234567890'
      const contractReturnValue = BigInt(1000000000000000000) // What the contract actually returns

      vi.mocked(thirdweb.readContract).mockResolvedValue(contractReturnValue)

      const result = await EvermarkBlockchainService.getPendingReferralPayment(address)

      expect(result).toBe(contractReturnValue) // Expect the actual contract return value
      expect(thirdweb.readContract).toHaveBeenCalled()
    })
  })

  describe('claimReferralPayment', () => {
    it('should claim pending referral payment', async () => {
      const mockAccount = { address: '0x1234567890123456789012345678901234567890' } as any
      const mockTxHash = '0xTxHash'
      const mockReceipt = { 
        transactionHash: '0xTxHash',
        status: 'success'
      }

      vi.mocked(thirdweb.prepareContractCall).mockResolvedValue({} as any)
      vi.mocked(thirdweb.sendTransaction).mockResolvedValue(mockTxHash)
      vi.mocked(thirdweb.waitForReceipt).mockResolvedValue(mockReceipt as any)

      const result = await EvermarkBlockchainService.claimReferralPayment(mockAccount)

      expect(result.success).toBe(true)
      expect(result.txHash).toBe(mockTxHash)
    })

    it('should handle claim transaction success', async () => {
      const mockAccount = { address: '0x1234567890123456789012345678901234567890' } as any
      const mockTxHash = '0xTxHash'
      const mockReceipt = { 
        transactionHash: '0xTxHash',
        status: 'success'
      }

      // Mock successful transaction
      vi.mocked(thirdweb.prepareContractCall).mockResolvedValue({} as any)
      vi.mocked(thirdweb.sendTransaction).mockResolvedValue(mockTxHash)
      vi.mocked(thirdweb.waitForReceipt).mockResolvedValue(mockReceipt as any)

      const result = await EvermarkBlockchainService.claimReferralPayment(mockAccount)

      expect(result.success).toBe(true)
      expect(result.txHash).toBe(mockTxHash)
    })
  })
})