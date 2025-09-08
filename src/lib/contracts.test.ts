import { describe, it, expect, vi, beforeEach } from 'vitest'
import { 
  getEmarkTokenContract,
  getWEMARKContract,
  getEvermarkNFTContract,
  getEvermarkVotingContract,
  getNFTStakingContract,
  getEvermarkRewardsContract,
  getFeeCollectorContract,
  CONTRACTS,
  CHAIN
} from './contracts'
import * as thirdweb from 'thirdweb'

// Mock thirdweb functions
vi.mock('thirdweb', () => ({
  getContract: vi.fn()
}))

// Mock thirdweb client and chain
vi.mock('./thirdweb', () => ({
  client: { clientId: 'test-client' },
  chain: { id: 8453, name: 'Base' }
}))

// Mock environment variables
const originalEnv = process.env

describe('contracts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Reset environment variables
    process.env = { ...originalEnv }
    
    // Set default test environment variables
    process.env.VITE_EMARK_ADDRESS = '0xf87F3ebbF8CaCF321C2a4027bb66Df639a6f4B07'
    process.env.VITE_WEMARK_ADDRESS = '0xDf756488A3A27352ED1Be38A94f6621A6CE2Ce15'
    process.env.VITE_EVERMARK_NFT_ADDRESS = '0x504a0BDC3aea29237a6f8E53D0ECDA8e4c9009F2'
    process.env.VITE_EVERMARK_VOTING_ADDRESS = '0x5089FE55368E40c8990214Ca99bd2214b34A179D'
    process.env.VITE_NFT_STAKING_ADDRESS = '0x95f9aaDb35E74aba92DAAFfe1Ae74Cb467149210'
    process.env.VITE_EVERMARK_REWARDS_ADDRESS = '0x88E5C57FFC8De966eD789ebd5A8E3B290Ed2B55C'
    process.env.VITE_FEE_COLLECTOR_ADDRESS = '0xaab93405679576ec743fDAA57AA603D949850604'
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('CONTRACTS constant', () => {
    it('should export correct contract addresses', () => {
      expect(CONTRACTS.EMARK_TOKEN).toBe('0xf87F3ebbF8CaCF321C2a4027bb66Df639a6f4B07')
      expect(CONTRACTS.WEMARK).toBe('0xDf756488A3A27352ED1Be38A94f6621A6CE2Ce15')
      expect(CONTRACTS.EVERMARK_NFT).toBe('0x504a0BDC3aea29237a6f8E53D0ECDA8e4c9009F2')
      expect(CONTRACTS.EVERMARK_VOTING).toBe('0x5089FE55368E40c8990214Ca99bd2214b34A179D')
      expect(CONTRACTS.NFT_STAKING).toBe('0x95f9aaDb35E74aba92DAAFfe1Ae74Cb467149210')
      expect(CONTRACTS.EVERMARK_REWARDS).toBe('0x88E5C57FFC8De966eD789ebd5A8E3B290Ed2B55C')
      expect(CONTRACTS.FEE_COLLECTOR).toBe('0xaab93405679576ec743fDAA57AA603D949850604')
    })

    it('should use fallback addresses when env vars not set', () => {
      // Clear environment variables
      delete process.env.VITE_EMARK_ADDRESS
      delete process.env.VITE_WEMARK_ADDRESS
      
      // Re-import to get new values
      vi.doUnmock('./contracts')
      const { CONTRACTS: newContracts } = require('./contracts')
      
      expect(newContracts.EMARK_TOKEN).toBe('0xf87F3ebbF8CaCF321C2a4027bb66Df639a6f4B07')
      expect(newContracts.WEMARK).toBe('0xDf756488A3A27352ED1Be38A94f6621A6CE2Ce15')
    })
  })

  describe('CHAIN export', () => {
    it('should export the chain from thirdweb module', () => {
      expect(CHAIN).toEqual({ id: 8453, name: 'Base' })
    })
  })

  describe('getEmarkTokenContract', () => {
    it('should create and return EMARK token contract instance', () => {
      const mockContract = { address: CONTRACTS.EMARK_TOKEN, abi: expect.any(Array) }
      vi.mocked(thirdweb.getContract).mockReturnValue(mockContract as any)

      const contract = getEmarkTokenContract()

      expect(thirdweb.getContract).toHaveBeenCalledWith({
        client: { clientId: 'test-client' },
        chain: { id: 8453, name: 'Base' },
        address: CONTRACTS.EMARK_TOKEN,
        abi: expect.any(Array)
      })
      expect(contract).toBe(mockContract)
    })

    it('should return same instance on subsequent calls (singleton)', () => {
      const mockContract = { address: CONTRACTS.EMARK_TOKEN }
      vi.mocked(thirdweb.getContract).mockReturnValue(mockContract as any)

      const contract1 = getEmarkTokenContract()
      const contract2 = getEmarkTokenContract()

      expect(contract1).toBe(contract2)
      expect(thirdweb.getContract).toHaveBeenCalledTimes(1)
    })

    it('should throw error when EMARK_TOKEN address not configured', () => {
      // Mock empty address
      const originalAddress = CONTRACTS.EMARK_TOKEN
      ;(CONTRACTS as any).EMARK_TOKEN = undefined

      expect(() => getEmarkTokenContract()).toThrow('EMARK_TOKEN address not configured')

      // Restore
      ;(CONTRACTS as any).EMARK_TOKEN = originalAddress
    })
  })

  describe('getWEMARKContract', () => {
    it('should create and return WEMARK contract instance', () => {
      const mockContract = { address: CONTRACTS.WEMARK }
      vi.mocked(thirdweb.getContract).mockReturnValue(mockContract as any)

      const contract = getWEMARKContract()

      expect(thirdweb.getContract).toHaveBeenCalledWith({
        client: { clientId: 'test-client' },
        chain: { id: 8453, name: 'Base' },
        address: CONTRACTS.WEMARK,
        abi: expect.any(Array)
      })
      expect(contract).toBe(mockContract)
    })

    it('should return same instance on subsequent calls', () => {
      const mockContract = { address: CONTRACTS.WEMARK }
      vi.mocked(thirdweb.getContract).mockReturnValue(mockContract as any)

      const contract1 = getWEMARKContract()
      const contract2 = getWEMARKContract()

      expect(contract1).toBe(contract2)
      expect(thirdweb.getContract).toHaveBeenCalledTimes(1)
    })

    it('should throw error when WEMARK address not configured', () => {
      const originalAddress = CONTRACTS.WEMARK
      ;(CONTRACTS as any).WEMARK = undefined

      expect(() => getWEMARKContract()).toThrow('WEMARK address not configured')

      ;(CONTRACTS as any).WEMARK = originalAddress
    })
  })

  describe('getEvermarkNFTContract', () => {
    it('should create and return Evermark NFT contract instance', () => {
      const mockContract = { address: CONTRACTS.EVERMARK_NFT }
      vi.mocked(thirdweb.getContract).mockReturnValue(mockContract as any)

      const contract = getEvermarkNFTContract()

      expect(thirdweb.getContract).toHaveBeenCalledWith({
        client: { clientId: 'test-client' },
        chain: { id: 8453, name: 'Base' },
        address: CONTRACTS.EVERMARK_NFT,
        abi: expect.any(Array)
      })
      expect(contract).toBe(mockContract)
    })

    it('should throw error when EVERMARK_NFT address not configured', () => {
      const originalAddress = CONTRACTS.EVERMARK_NFT
      ;(CONTRACTS as any).EVERMARK_NFT = undefined

      expect(() => getEvermarkNFTContract()).toThrow('EVERMARK_NFT address not configured')

      ;(CONTRACTS as any).EVERMARK_NFT = originalAddress
    })
  })

  describe('getEvermarkVotingContract', () => {
    it('should create and return Evermark Voting contract instance', () => {
      const mockContract = { address: CONTRACTS.EVERMARK_VOTING }
      vi.mocked(thirdweb.getContract).mockReturnValue(mockContract as any)

      const contract = getEvermarkVotingContract()

      expect(thirdweb.getContract).toHaveBeenCalledWith({
        client: { clientId: 'test-client' },
        chain: { id: 8453, name: 'Base' },
        address: CONTRACTS.EVERMARK_VOTING,
        abi: expect.any(Array)
      })
      expect(contract).toBe(mockContract)
    })

    it('should throw error when EVERMARK_VOTING address not configured', () => {
      const originalAddress = CONTRACTS.EVERMARK_VOTING
      ;(CONTRACTS as any).EVERMARK_VOTING = undefined

      expect(() => getEvermarkVotingContract()).toThrow('EVERMARK_VOTING address not configured')

      ;(CONTRACTS as any).EVERMARK_VOTING = originalAddress
    })
  })

  describe('getNFTStakingContract', () => {
    it('should create and return NFT Staking contract instance', () => {
      const mockContract = { address: CONTRACTS.NFT_STAKING }
      vi.mocked(thirdweb.getContract).mockReturnValue(mockContract as any)

      const contract = getNFTStakingContract()

      expect(thirdweb.getContract).toHaveBeenCalledWith({
        client: { clientId: 'test-client' },
        chain: { id: 8453, name: 'Base' },
        address: CONTRACTS.NFT_STAKING,
        abi: expect.any(Array)
      })
      expect(contract).toBe(mockContract)
    })

    it('should throw error when NFT_STAKING address not configured', () => {
      const originalAddress = CONTRACTS.NFT_STAKING
      ;(CONTRACTS as any).NFT_STAKING = undefined

      expect(() => getNFTStakingContract()).toThrow('NFT_STAKING address not configured')

      ;(CONTRACTS as any).NFT_STAKING = originalAddress
    })
  })

  describe('getEvermarkRewardsContract', () => {
    it('should create and return Evermark Rewards contract instance', () => {
      const mockContract = { address: CONTRACTS.EVERMARK_REWARDS }
      vi.mocked(thirdweb.getContract).mockReturnValue(mockContract as any)

      const contract = getEvermarkRewardsContract()

      expect(thirdweb.getContract).toHaveBeenCalledWith({
        client: { clientId: 'test-client' },
        chain: { id: 8453, name: 'Base' },
        address: CONTRACTS.EVERMARK_REWARDS,
        abi: expect.any(Array)
      })
      expect(contract).toBe(mockContract)
    })

    it('should throw error when EVERMARK_REWARDS address not configured', () => {
      const originalAddress = CONTRACTS.EVERMARK_REWARDS
      ;(CONTRACTS as any).EVERMARK_REWARDS = undefined

      expect(() => getEvermarkRewardsContract()).toThrow('EVERMARK_REWARDS address not configured')

      ;(CONTRACTS as any).EVERMARK_REWARDS = originalAddress
    })
  })

  describe('getFeeCollectorContract', () => {
    it('should create and return Fee Collector contract instance', () => {
      const mockContract = { address: CONTRACTS.FEE_COLLECTOR }
      vi.mocked(thirdweb.getContract).mockReturnValue(mockContract as any)

      const contract = getFeeCollectorContract()

      expect(thirdweb.getContract).toHaveBeenCalledWith({
        client: { clientId: 'test-client' },
        chain: { id: 8453, name: 'Base' },
        address: CONTRACTS.FEE_COLLECTOR,
        abi: expect.any(Array)
      })
      expect(contract).toBe(mockContract)
    })

    it('should throw error when FEE_COLLECTOR address not configured', () => {
      const originalAddress = CONTRACTS.FEE_COLLECTOR
      ;(CONTRACTS as any).FEE_COLLECTOR = undefined

      expect(() => getFeeCollectorContract()).toThrow('FEE_COLLECTOR address not configured')

      ;(CONTRACTS as any).FEE_COLLECTOR = originalAddress
    })
  })

  describe('singleton behavior', () => {
    it('should create each contract only once across multiple getters', () => {
      const mockContract = { address: 'test' }
      vi.mocked(thirdweb.getContract).mockReturnValue(mockContract as any)

      // Call multiple times
      getEmarkTokenContract()
      getEmarkTokenContract()
      getWEMARKContract()
      getWEMARKContract()
      getEvermarkNFTContract()

      // Should only create each contract once
      expect(vi.mocked(thirdweb.getContract)).toHaveBeenCalledTimes(3)
    })

    it('should maintain separate instances for different contracts', () => {
      const mockEmarkContract = { address: CONTRACTS.EMARK_TOKEN, type: 'emark' }
      const mockWEmarkContract = { address: CONTRACTS.WEMARK, type: 'wemark' }

      vi.mocked(thirdweb.getContract)
        .mockReturnValueOnce(mockEmarkContract as any)
        .mockReturnValueOnce(mockWEmarkContract as any)

      const emarkContract = getEmarkTokenContract()
      const wemarkContract = getWEMARKContract()

      expect(emarkContract).not.toBe(wemarkContract)
      expect(emarkContract).toBe(mockEmarkContract)
      expect(wemarkContract).toBe(mockWEmarkContract)
    })
  })

  describe('error handling', () => {
    it('should handle thirdweb getContract failures', () => {
      vi.mocked(thirdweb.getContract).mockImplementation(() => {
        throw new Error('Failed to create contract')
      })

      expect(() => getEmarkTokenContract()).toThrow('Failed to create contract')
    })

    it('should validate address format', () => {
      // Test with invalid address format
      const originalAddress = CONTRACTS.EMARK_TOKEN
      ;(CONTRACTS as any).EMARK_TOKEN = 'invalid-address'

      // Should still try to create contract (validation happens in thirdweb)
      vi.mocked(thirdweb.getContract).mockReturnValue({} as any)
      
      expect(() => getEmarkTokenContract()).not.toThrow()

      ;(CONTRACTS as any).EMARK_TOKEN = originalAddress
    })
  })

  describe('ABI imports', () => {
    it('should use correct ABIs for each contract', () => {
      vi.mocked(thirdweb.getContract).mockReturnValue({} as any)

      getEmarkTokenContract()
      getWEMARKContract()
      getEvermarkNFTContract()
      getEvermarkVotingContract()

      const calls = vi.mocked(thirdweb.getContract).mock.calls

      // Each call should have an ABI
      calls.forEach(call => {
        expect(call[0].abi).toBeDefined()
        expect(Array.isArray(call[0].abi)).toBe(true)
      })
    })
  })
})