import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SimpleCastBackupService, type BackupCostEstimate, type SimpleCastBackup } from '../SimpleCastBackupService';
import { FarcasterService } from '../FarcasterService';

// Mock FarcasterService
vi.mock('../FarcasterService', () => ({
  FarcasterService: {
    validateFarcasterInput: vi.fn(),
    fetchCastMetadata: vi.fn(),
  },
}));

// Mock fetch
global.fetch = vi.fn();

const mockFetch = fetch as any;
const mockFarcasterService = FarcasterService as any;

describe('SimpleCastBackupService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getCostEstimate', () => {
    it('should return cost estimate for a cast with media', async () => {
      const mockEstimate: BackupCostEstimate = {
        mediaCostUSD: 0.50,
        storageCostUSD: 0.10,
        totalCostUSD: 0.60,
        ardriveCreditsNeeded: 100,
        canAfford: true,
        walletBalance: 1000,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockEstimate),
      });

      const result = await SimpleCastBackupService.getCostEstimate('0x123', {
        includeMedia: true,
        userWallet: '0xuser',
      });

      expect(result).toEqual(mockEstimate);
      expect(mockFetch).toHaveBeenCalledWith(
        '/.netlify/functions/estimate-backup-cost',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            castInput: '0x123',
            includeMedia: true,
            includeThread: false,
            userWallet: '0xuser',
          }),
        }
      );
    });

    it('should return zero cost estimate on error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await SimpleCastBackupService.getCostEstimate('0x123');

      expect(result).toEqual({
        mediaCostUSD: 0,
        storageCostUSD: 0,
        totalCostUSD: 0,
        ardriveCreditsNeeded: 0,
        canAfford: false,
      });
    });
  });

  describe('backupSingleCast', () => {
    const mockCastData = {
      castHash: '0x123',
      author: 'Test User',
      username: 'testuser',
      content: 'Test cast content',
      timestamp: '2024-01-01T00:00:00Z',
      engagement: { likes: 5, recasts: 2, replies: 1 },
      embeds: [{ url: 'https://example.com/image.jpg' }],
    };

    it('should backup a single cast successfully', async () => {
      const mockCostEstimate: BackupCostEstimate = {
        mediaCostUSD: 0.50,
        storageCostUSD: 0.10,
        totalCostUSD: 0.60,
        ardriveCreditsNeeded: 100,
        canAfford: true,
      };

      const mockBackupResult = {
        backupId: 'backup_123',
        includedMedia: true,
        includedThread: false,
        costPaid: 0.60,
        mediaUrls: ['https://example.com/image.jpg'],
        preservedMediaCount: 1,
      };

      // Mock cost estimate
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockCostEstimate),
        })
        // Mock cast metadata fetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockBackupResult),
        });

      mockFarcasterService.fetchCastMetadata.mockResolvedValue(mockCastData);

      const result = await SimpleCastBackupService.backupSingleCast('0x123', {
        includeMedia: true,
        userWallet: '0xuser',
      });

      expect(result).toMatchObject({
        ...mockCastData,
        backupId: 'backup_123',
        includedMedia: true,
        includedThread: false,
        costPaid: 0.60,
        mediaUrls: ['https://example.com/image.jpg'],
        preservedMediaCount: 1,
      });

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should throw error if insufficient funds', async () => {
      const mockCostEstimate: BackupCostEstimate = {
        mediaCostUSD: 5.00,
        storageCostUSD: 1.00,
        totalCostUSD: 6.00,
        ardriveCreditsNeeded: 1000,
        canAfford: false,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockCostEstimate),
      });

      await expect(
        SimpleCastBackupService.backupSingleCast('0x123', {
          includeMedia: true,
        })
      ).rejects.toThrow('Insufficient funds. Need $6.00 USD');
    });

    it('should throw error if cast metadata fetch fails', async () => {
      const mockCostEstimate: BackupCostEstimate = {
        mediaCostUSD: 0.50,
        storageCostUSD: 0.10,
        totalCostUSD: 0.60,
        ardriveCreditsNeeded: 100,
        canAfford: true,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockCostEstimate),
      });

      mockFarcasterService.fetchCastMetadata.mockResolvedValue(null);

      await expect(
        SimpleCastBackupService.backupSingleCast('0x123')
      ).rejects.toThrow('Failed to fetch cast metadata');
    });
  });

  describe('checkWalletBalance', () => {
    it('should return wallet balance information', async () => {
      const mockBalance = {
        balanceUSD: 10.50,
        balanceAR: 0.025,
        sufficientForBasicBackup: true,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockBalance),
      });

      const result = await SimpleCastBackupService.checkWalletBalance();

      expect(result).toEqual(mockBalance);
      expect(mockFetch).toHaveBeenCalledWith('/.netlify/functions/check-ardrive-balance');
    });

    it('should return zero balance on error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await SimpleCastBackupService.checkWalletBalance();

      expect(result).toEqual({
        balanceUSD: 0,
        balanceAR: 0,
        sufficientForBasicBackup: false,
      });
    });
  });

  describe('getBackup', () => {
    it('should retrieve backup by ID', async () => {
      const mockBackup: SimpleCastBackup = {
        castHash: '0x123',
        author: 'Test User',
        username: 'testuser',
        content: 'Test content',
        timestamp: '2024-01-01T00:00:00Z',
        engagement: { likes: 5, recasts: 2, replies: 1 },
        backupId: 'backup_123',
        backupDate: '2024-01-01T00:00:00Z',
        includedMedia: true,
        includedThread: false,
        costPaid: 0.60,
        mediaUrls: ['https://example.com/image.jpg'],
        preservedMediaCount: 1,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockBackup),
      });

      const result = await SimpleCastBackupService.getBackup('backup_123');

      expect(result).toEqual(mockBackup);
      expect(mockFetch).toHaveBeenCalledWith('/.netlify/functions/get-backup?id=backup_123');
    });

    it('should return null if backup not found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const result = await SimpleCastBackupService.getBackup('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('listUserBackups', () => {
    it('should list user backups', async () => {
      const mockBackups: SimpleCastBackup[] = [
        {
          castHash: '0x123',
          author: 'User1',
          username: 'user1',
          content: 'Content 1',
          timestamp: '2024-01-01T00:00:00Z',
          engagement: { likes: 5, recasts: 2, replies: 1 },
          backupId: 'backup_1',
          backupDate: '2024-01-01T00:00:00Z',
          includedMedia: true,
          includedThread: false,
          costPaid: 0.60,
          mediaUrls: [],
          preservedMediaCount: 0,
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ backups: mockBackups }),
      });

      const result = await SimpleCastBackupService.listUserBackups('0xuser');

      expect(result).toEqual(mockBackups);
      expect(mockFetch).toHaveBeenCalledWith('/.netlify/functions/list-backups?wallet=0xuser');
    });

    it('should return empty array on error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await SimpleCastBackupService.listUserBackups('0xuser');

      expect(result).toEqual([]);
    });
  });

  describe('validateCastInput', () => {
    it('should validate cast input using FarcasterService', () => {
      const mockValidation = {
        valid: true,
        type: 'hash' as const,
      };

      mockFarcasterService.validateFarcasterInput.mockReturnValue(mockValidation);

      const result = SimpleCastBackupService.validateCastInput('0x123');

      expect(result).toEqual(mockValidation);
      expect(mockFarcasterService.validateFarcasterInput).toHaveBeenCalledWith('0x123');
    });
  });

  describe('getMediaCount', () => {
    it('should count media items in cast', async () => {
      const mockCastData = {
        castHash: '0x123',
        embeds: [
          { url: 'https://example.com/image.jpg' },
          { url: 'https://example.com/video.mp4' },
          { url: 'https://example.com/link' }, // Not media
          { url: 'https://example.com/photo.png' },
        ],
      };

      mockFarcasterService.fetchCastMetadata.mockResolvedValue(mockCastData);

      const result = await SimpleCastBackupService.getMediaCount('0x123');

      expect(result).toBe(3); // jpg, mp4, png
    });

    it('should return 0 if no embeds', async () => {
      const mockCastData = {
        castHash: '0x123',
        embeds: [],
      };

      mockFarcasterService.fetchCastMetadata.mockResolvedValue(mockCastData);

      const result = await SimpleCastBackupService.getMediaCount('0x123');

      expect(result).toBe(0);
    });

    it('should return 0 on error', async () => {
      mockFarcasterService.fetchCastMetadata.mockRejectedValue(new Error('Fetch failed'));

      const result = await SimpleCastBackupService.getMediaCount('0x123');

      expect(result).toBe(0);
    });
  });
});