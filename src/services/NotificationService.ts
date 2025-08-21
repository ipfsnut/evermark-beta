// src/services/NotificationService.ts
// Service for triggering notifications based on app events

export interface NotificationTriggerData {
  type: 'share' | 'vote';
  evermarkId: string;
  userAddress?: string;
  metadata?: {
    platform?: string;
    voteAmount?: string;
    voterAddress?: string;
    sharerAddress?: string;
  };
}

export class NotificationService {
  private static addNotificationCallback: ((notification: {
    type: string;
    title: string;
    message?: string;
    evermarkId?: string;
    userAddress?: string;
    metadata?: Record<string, unknown>;
  }) => void) | null = null;

  /**
   * Set the callback function for adding notifications
   */
  static setAddNotificationCallback(callback: (notification: {
    type: string;
    title: string;
    message?: string;
    evermarkId?: string;
    userAddress?: string;
    metadata?: Record<string, unknown>;
  }) => void) {
    this.addNotificationCallback = callback;
  }

  /**
   * Trigger a share notification
   */
  static triggerShareNotification(data: {
    evermarkId: string;
    sharerAddress: string;
    platform: string;
    evermarkTitle?: string;
    evermarkOwner?: string;
  }) {
    if (!this.addNotificationCallback) return;

    // Only notify if the sharer is different from the owner
    if (data.sharerAddress === data.evermarkOwner) return;

    this.addNotificationCallback({
      type: 'share',
      title: 'Your Evermark was shared!',
      message: `Someone shared "${data.evermarkTitle || `Evermark #${data.evermarkId}`}" on ${data.platform}`,
      evermarkId: data.evermarkId,
      userAddress: data.sharerAddress,
      metadata: {
        platform: data.platform,
        sharerAddress: data.sharerAddress
      }
    });
  }

  /**
   * Trigger a vote notification
   */
  static triggerVoteNotification(data: {
    evermarkId: string;
    voterAddress: string;
    voteAmount: string;
    evermarkTitle?: string;
    evermarkOwner?: string;
  }) {
    if (!this.addNotificationCallback) return;

    // Only notify if the voter is different from the owner
    if (data.voterAddress === data.evermarkOwner) return;

    this.addNotificationCallback({
      type: 'vote',
      title: 'Your Evermark received votes!',
      message: `Someone voted ${data.voteAmount} wEMARK for "${data.evermarkTitle || `Evermark #${data.evermarkId}`}"`,
      evermarkId: data.evermarkId,
      userAddress: data.voterAddress,
      metadata: {
        voteAmount: data.voteAmount,
        voterAddress: data.voterAddress
      }
    });
  }

  /**
   * Trigger notification when share is recorded via API
   */
  static async onShareRecorded(shareData: {
    token_id: number;
    platform: string;
    user_address: string;
  }) {
    try {
      // Fetch evermark details to get title and owner
      const evermarkResponse = await fetch(`/.netlify/functions/evermarks?token_id=${shareData.token_id}`);
      if (evermarkResponse.ok) {
        const evermarkData = await evermarkResponse.json();
        
        this.triggerShareNotification({
          evermarkId: shareData.token_id.toString(),
          sharerAddress: shareData.user_address,
          platform: shareData.platform,
          evermarkTitle: evermarkData.title,
          evermarkOwner: evermarkData.author
        });
      }
    } catch (error) {
      console.error('Failed to trigger share notification:', error);
    }
  }

  /**
   * Monitor voting events from blockchain
   */
  static startVotingEventListener() {
    // This would typically use a blockchain event listener
    // For now, we'll create a placeholder that could be called when votes are cast
    console.log('🔔 Voting event listener started');
  }

  /**
   * Called when a vote is cast (to be integrated with voting system)
   */
  static async onVoteCast(voteData: {
    evermarkId: string;
    voterAddress: string;
    voteAmount: bigint;
  }) {
    try {
      // Format the vote amount for display
      const formattedAmount = (Number(voteData.voteAmount) / Math.pow(10, 18)).toLocaleString();

      // Fetch evermark details to get title and owner
      const evermarkResponse = await fetch(`/.netlify/functions/evermarks?token_id=${voteData.evermarkId}`);
      if (evermarkResponse.ok) {
        const evermarkData = await evermarkResponse.json();
        
        this.triggerVoteNotification({
          evermarkId: voteData.evermarkId,
          voterAddress: voteData.voterAddress,
          voteAmount: formattedAmount,
          evermarkTitle: evermarkData.title,
          evermarkOwner: evermarkData.author
        });
      }
    } catch (error) {
      console.error('Failed to trigger vote notification:', error);
    }
  }

  /**
   * Initialize the notification service
   */
  static initialize(addNotificationCallback: (notification: {
    type: string;
    title: string;
    message?: string;
    evermarkId?: string;
    userAddress?: string;
    metadata?: Record<string, unknown>;
  }) => void) {
    this.setAddNotificationCallback(addNotificationCallback);
    this.startVotingEventListener();
    
    console.log('🔔 Notification service initialized');
  }

  /**
   * Test notifications (for development)
   */
  static triggerTestNotifications() {
    if (!this.addNotificationCallback) return;

    // Test share notification
    setTimeout(() => {
      this.triggerShareNotification({
        evermarkId: '123',
        sharerAddress: '0x742d35Cc6634C0532925a3b8D0c46BD5bB8D2D2D',
        platform: 'Twitter',
        evermarkTitle: 'The Future of Decentralized Content',
        evermarkOwner: '0x1234567890123456789012345678901234567890'
      });
    }, 2000);

    // Test vote notification
    setTimeout(() => {
      this.triggerVoteNotification({
        evermarkId: '456',
        voterAddress: '0x742d35Cc6634C0532925a3b8D0c46BD5bB8D2D2D',
        voteAmount: '100',
        evermarkTitle: 'Understanding Web3 Governance',
        evermarkOwner: '0x1234567890123456789012345678901234567890'
      });
    }, 4000);
  }
}