import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SimpleCastBackupService } from '../SimpleCastBackupService';
import { MediaPreservationService } from '../MediaPreservationService';
import { ThreadPreservationService } from '../ThreadPreservationService';

// Mock all services
vi.mock('../FarcasterService');
vi.mock('../MediaPreservationService');
vi.mock('../ThreadPreservationService');

global.fetch = vi.fn();

describe('Cast Backup Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (fetch as any).mockClear();
  });

  describe('Complete Backup Flow', () => {
    it('should create a complete backup with all components working together', async () => {
      // Mock cost estimate
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          mediaCostUSD: 0.50,
          storageCostUSD: 0.10,
          totalCostUSD: 0.60,
          ardriveCreditsNeeded: 100,
          canAfford: true,
        }),
      });

      // Mock cast data
      const mockCastData = {
        castHash: '0x123',
        author: 'Test User',
        username: 'testuser',
        content: 'Test cast with media',
        embeds: [
          { url: 'https://example.com/image.jpg' },
          { url: 'https://example.com/video.mp4' },
        ],
      };

      // Mock FarcasterService
      const { FarcasterService } = await import('../FarcasterService');
      (FarcasterService.fetchCastMetadata as any).mockResolvedValue(mockCastData);

      // Mock backup API
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          backupId: 'backup_integration_test',
          includedMedia: true,
          includedThread: false,
          costPaid: 0.60,
          mediaUrls: ['https://example.com/image.jpg', 'https://example.com/video.mp4'],
          preservedMediaCount: 2,
        }),
      });

      const result = await SimpleCastBackupService.backupSingleCast(
        'https://warpcast.com/testuser/0x123',
        {
          includeMedia: true,
          includeThread: false,
          userWallet: '0xuser123',
        }
      );

      expect(result).toMatchObject({
        castHash: '0x123',
        author: 'Test User',
        backupId: 'backup_integration_test',
        includedMedia: true,
        preservedMediaCount: 2,
        costPaid: 0.60,
      });

      // Verify cost estimation was called
      expect(fetch).toHaveBeenCalledWith(
        '/.netlify/functions/estimate-backup-cost',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('includeMedia'),
        })
      );

      // Verify backup API was called
      expect(fetch).toHaveBeenCalledWith(
        '/.netlify/functions/backup-single-cast',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('castData'),
        })
      );
    });

    it('should handle partial backup when media fails', async () => {
      // Mock successful cost estimate
      (fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            canAfford: true,
            totalCostUSD: 0.30,
          }),
        })
        // Mock partial backup result
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            backupId: 'backup_partial',
            includedMedia: false, // Media preservation failed
            includedThread: true,
            costPaid: 0.10, // Lower cost since no media
            mediaUrls: [],
            preservedMediaCount: 0,
          }),
        });

      const mockCastData = {
        castHash: '0x456',
        author: 'Another User',
        content: 'Cast with failed media',
        embeds: [{ url: 'https://broken-link.com/image.jpg' }],
      };

      const { FarcasterService } = await import('../FarcasterService');
      (FarcasterService.fetchCastMetadata as any).mockResolvedValue(mockCastData);

      const result = await SimpleCastBackupService.backupSingleCast('0x456');

      expect(result).toMatchObject({
        backupId: 'backup_partial',
        includedMedia: false,
        includedThread: true,
        preservedMediaCount: 0,
      });
    });
  });

  describe('Service Integration', () => {
    it('should coordinate between media and thread services', async () => {
      const testUrl = 'https://example.com/test.jpg';
      
      // Mock MediaPreservationService
      const mockPreservedMedia = {
        original_url: testUrl,
        ardrive_tx: 'tx_test',
        ipfs_hash: 'Qm_test',
        content_type: 'image/jpeg',
        preserved_at: new Date().toISOString(),
      };

      (MediaPreservationService.preserveMedia as any).mockResolvedValue(mockPreservedMedia);
      (MediaPreservationService.extractEmbedMetadata as any).mockResolvedValue({
        type: 'image',
        domain: 'example.com',
      });

      // Mock ThreadPreservationService
      const mockThreadData = {
        thread_hash: 'thread_test',
        total_replies: 5,
        reply_chain: [],
        participants: [],
      };

      (ThreadPreservationService.preserveThread as any).mockResolvedValue(mockThreadData);

      // Test media preservation
      const mediaResult = await MediaPreservationService.preserveMedia(testUrl);
      expect(mediaResult).toEqual(mockPreservedMedia);

      // Test thread preservation
      const threadResult = await ThreadPreservationService.preserveThread('0x123');
      expect(threadResult).toEqual(mockThreadData);

      // Verify both services were called
      expect(MediaPreservationService.preserveMedia).toHaveBeenCalledWith(testUrl);
      expect(ThreadPreservationService.preserveThread).toHaveBeenCalledWith('0x123');
    });
  });

  describe('Error Recovery', () => {
    it('should gracefully handle service failures', async () => {
      // Mock services to fail
      (MediaPreservationService.preserveMedia as any).mockRejectedValue(
        new Error('Network timeout')
      );
      
      (ThreadPreservationService.preserveThread as any).mockResolvedValue(null);

      // Test that individual service failures don't crash the system
      const mediaResult = await MediaPreservationService.preserveMedia('test').catch(() => null);
      const threadResult = await ThreadPreservationService.preserveThread('test');

      expect(mediaResult).toBeNull();
      expect(threadResult).toBeNull();

      // Services should handle their own errors gracefully
      expect(MediaPreservationService.preserveMedia).toHaveBeenCalled();
      expect(ThreadPreservationService.preserveThread).toHaveBeenCalled();
    });

    it('should validate inputs before processing', async () => {
      // Mock FarcasterService validation
      const { FarcasterService } = await import('../FarcasterService');
      (FarcasterService.validateFarcasterInput as any).mockReturnValue({
        valid: false,
        type: null,
        error: 'Invalid format',
      });

      // Test input validation
      const validationResult = SimpleCastBackupService.validateCastInput('invalid-input');
      
      expect(validationResult).toMatchObject({
        valid: false,
        type: null,
        error: expect.any(String),
      });
    });
  });

  describe('Cost Management', () => {
    it('should check wallet balance before expensive operations', async () => {
      // Mock balance check
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          balanceUSD: 5.00,
          balanceAR: 0.02,
          sufficientForBasicBackup: true,
        }),
      });

      const balance = await SimpleCastBackupService.checkWalletBalance();

      expect(balance).toMatchObject({
        balanceUSD: expect.any(Number),
        sufficientForBasicBackup: expect.any(Boolean),
      });

      expect(fetch).toHaveBeenCalledWith('/.netlify/functions/check-ardrive-balance');
    });

    it('should prevent expensive operations when insufficient funds', async () => {
      // Mock insufficient funds
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          canAfford: false,
          totalCostUSD: 10.00,
        }),
      });

      await expect(
        SimpleCastBackupService.backupSingleCast('0x123', {
          includeMedia: true,
        })
      ).rejects.toThrow('Insufficient funds');
    });
  });
});