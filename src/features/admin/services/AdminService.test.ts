import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AdminService } from './AdminService'
import type { SeasonStatusCheck, WizardStatus, WizardStep } from './AdminService'

// Mock fetch globally
global.fetch = vi.fn()

// Mock Supabase
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => Promise.resolve({ data: [], error: null })),
      insert: vi.fn(() => Promise.resolve({ data: [], error: null })),
      update: vi.fn(() => Promise.resolve({ data: [], error: null })),
      delete: vi.fn(() => Promise.resolve({ data: [], error: null }))
    }))
  }))
}))

describe('AdminService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('validateSeason', () => {
    it('should validate current season when no season number provided', async () => {
      const mockResponse: SeasonStatusCheck = {
        seasonNumber: 5,
        endTime: new Date('2024-01-31T23:59:59Z'),
        isEnded: true,
        totalVotes: BigInt(1000),
        totalVoters: 50,
        syncStatus: 'complete',
        discrepancies: [],
        canProceed: true,
        blockchainFinalized: false,
        databaseStored: false
      }

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      } as Response)

      const result = await AdminService.validateSeason()

      expect(fetch).toHaveBeenCalledWith('/.netlify/functions/admin-season-finalize?action=validate-season')
      expect(result).toEqual(mockResponse)
    })

    it('should validate specific season when season number provided', async () => {
      const mockResponse: SeasonStatusCheck = {
        seasonNumber: 3,
        endTime: new Date('2023-12-31T23:59:59Z'),
        isEnded: true,
        totalVotes: BigInt(750),
        totalVoters: 35,
        syncStatus: 'complete',
        discrepancies: [],
        canProceed: true,
        blockchainFinalized: true,
        databaseStored: true
      }

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      } as Response)

      const result = await AdminService.validateSeason(3)

      expect(fetch).toHaveBeenCalledWith('/.netlify/functions/admin-season-finalize?action=validate-season&season=3')
      expect(result).toEqual(mockResponse)
    })

    it('should handle validation errors', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 400
      } as Response)

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await expect(AdminService.validateSeason()).rejects.toThrow('Validation failed: 400')
      expect(consoleSpy).toHaveBeenCalledWith('Season validation failed:', expect.any(Error))
    })

    it('should handle network errors', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('Network error'))
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await expect(AdminService.validateSeason()).rejects.toThrow('Network error')
      expect(consoleSpy).toHaveBeenCalledWith('Season validation failed:', expect.any(Error))
    })

    it('should handle season with discrepancies', async () => {
      const mockResponse: SeasonStatusCheck = {
        seasonNumber: 4,
        endTime: new Date('2024-01-31T23:59:59Z'),
        isEnded: true,
        totalVotes: BigInt(800),
        totalVoters: 40,
        syncStatus: 'error',
        discrepancies: ['Vote count mismatch', 'Missing voter records'],
        canProceed: false,
        blockchainFinalized: false,
        databaseStored: false
      }

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      } as Response)

      const result = await AdminService.validateSeason(4)

      expect(result.canProceed).toBe(false)
      expect(result.discrepancies).toHaveLength(2)
      expect(result.syncStatus).toBe('error')
    })
  })

  describe('getWizardStatus', () => {
    it('should get wizard status for current season', async () => {
      const mockWizardStatus: WizardStatus = {
        steps: [
          {
            step: 1,
            name: 'Season Overview',
            status: 'completed'
          },
          {
            step: 2,
            name: 'Data Sync',
            status: 'in_progress',
            data: { progress: 75 }
          },
          {
            step: 3,
            name: 'Winner Selection',
            status: 'pending'
          }
        ],
        currentStep: 2,
        canStart: true,
        wizardId: 'wizard_123'
      }

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockWizardStatus)
      } as Response)

      const result = await AdminService.getWizardStatus()

      expect(fetch).toHaveBeenCalledWith('/.netlify/functions/admin-season-finalize?action=get-wizard-status')
      expect(result).toEqual(mockWizardStatus)
    })

    it('should get wizard status for specific season', async () => {
      const mockWizardStatus: WizardStatus = {
        steps: [
          {
            step: 1,
            name: 'Season Overview',
            status: 'completed'
          }
        ],
        currentStep: 1,
        canStart: false
      }

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockWizardStatus)
      } as Response)

      const result = await AdminService.getWizardStatus(2)

      expect(fetch).toHaveBeenCalledWith('/.netlify/functions/admin-season-finalize?action=get-wizard-status&season=2')
      expect(result).toEqual(mockWizardStatus)
    })

    it('should handle wizard status errors', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 500
      } as Response)

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await expect(AdminService.getWizardStatus()).rejects.toThrow('Failed to get wizard status: 500')
      expect(consoleSpy).toHaveBeenCalledWith('Failed to get wizard status:', expect.any(Error))
    })
  })

  describe('startWizard', () => {
    it('should start wizard for specified season', async () => {
      const mockResponse = {
        success: true,
        wizardId: 'wizard_456',
        steps: [
          {
            step: 1,
            name: 'Season Overview',
            status: 'in_progress' as const
          },
          {
            step: 2,
            name: 'Data Sync',
            status: 'pending' as const
          }
        ]
      }

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      } as Response)

      const result = await AdminService.startWizard(5)

      expect(fetch).toHaveBeenCalledWith('/.netlify/functions/admin-season-finalize?action=start-wizard&season=5')
      expect(result).toEqual(mockResponse)
      expect(result.success).toBe(true)
      expect(result.wizardId).toBe('wizard_456')
      expect(result.steps).toHaveLength(2)
    })

    it('should handle wizard start errors', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 403
      } as Response)

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await expect(AdminService.startWizard(5)).rejects.toThrow('Failed to start wizard: 403')
      expect(consoleSpy).toHaveBeenCalledWith('Failed to start wizard:', expect.any(Error))
    })
  })

  describe('resetWizard', () => {
    it('should reset wizard for specified season', async () => {
      const mockResponse = {
        success: true,
        message: 'Wizard reset successfully for season 4'
      }

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      } as Response)

      const result = await AdminService.resetWizard(4)

      expect(fetch).toHaveBeenCalledWith('/.netlify/functions/admin-season-finalize?action=reset-wizard&season=4')
      expect(result).toEqual(mockResponse)
      expect(result.success).toBe(true)
    })

    it('should handle wizard reset errors', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 404
      } as Response)

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await expect(AdminService.resetWizard(4)).rejects.toThrow('Failed to reset wizard: 404')
      expect(consoleSpy).toHaveBeenCalledWith('Failed to reset wizard:', expect.any(Error))
    })
  })

  describe('getFinalizableSeasons', () => {
    it('should get list of finalizable seasons', async () => {
      const mockResponse = {
        seasons: [3, 4, 5]
      }

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      } as Response)

      const result = await AdminService.getFinalizableSeasons()

      expect(fetch).toHaveBeenCalledWith('/.netlify/functions/season-finalization?action=detect-finalizations')
      expect(result).toEqual([3, 4, 5])
    })

    it('should handle empty finalizable seasons list', async () => {
      const mockResponse = {
        seasons: []
      }

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      } as Response)

      const result = await AdminService.getFinalizableSeasons()

      expect(result).toEqual([])
    })

    it('should handle errors when getting finalizable seasons', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 500
      } as Response)

      await expect(AdminService.getFinalizableSeasons()).rejects.toThrow()
    })
  })

  describe('error handling', () => {
    it('should handle malformed JSON responses', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.reject(new Error('Invalid JSON'))
      } as Response)

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await expect(AdminService.validateSeason()).rejects.toThrow('Invalid JSON')
      expect(consoleSpy).toHaveBeenCalled()
    })

    it('should handle fetch failures', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('Fetch failed'))
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await expect(AdminService.getWizardStatus()).rejects.toThrow('Fetch failed')
      expect(consoleSpy).toHaveBeenCalled()
    })
  })

  describe('wizard step management', () => {
    it('should handle wizard steps with errors', async () => {
      const mockWizardStatus: WizardStatus = {
        steps: [
          {
            step: 1,
            name: 'Season Overview',
            status: 'completed'
          },
          {
            step: 2,
            name: 'Data Sync',
            status: 'error',
            errors: ['Sync failed', 'Connection timeout']
          }
        ],
        currentStep: 2,
        canStart: false
      }

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockWizardStatus)
      } as Response)

      const result = await AdminService.getWizardStatus()

      expect(result.steps[1].status).toBe('error')
      expect(result.steps[1].errors).toContain('Sync failed')
      expect(result.canStart).toBe(false)
    })

    it('should handle wizard steps with data', async () => {
      const mockWizardStatus: WizardStatus = {
        steps: [
          {
            step: 1,
            name: 'Data Collection',
            status: 'in_progress',
            data: {
              totalEvermarks: 150,
              processedEvermarks: 75,
              progress: 50
            }
          }
        ],
        currentStep: 1,
        canStart: true
      }

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockWizardStatus)
      } as Response)

      const result = await AdminService.getWizardStatus()

      expect(result.steps[0].data).toEqual({
        totalEvermarks: 150,
        processedEvermarks: 75,
        progress: 50
      })
    })
  })

  describe('API endpoint construction', () => {
    it('should construct correct URLs for different actions', () => {
      // This tests the URL construction logic indirectly through the calls
      const baseUrl = '/.netlify/functions/admin-season-finalize'
      
      AdminService.validateSeason(5)
      expect(fetch).toHaveBeenCalledWith(`${baseUrl}?action=validate-season&season=5`)
      
      AdminService.getWizardStatus()
      expect(fetch).toHaveBeenCalledWith(`${baseUrl}?action=get-wizard-status`)
      
      AdminService.startWizard(3)
      expect(fetch).toHaveBeenCalledWith(`${baseUrl}?action=start-wizard&season=3`)
    })
  })
})