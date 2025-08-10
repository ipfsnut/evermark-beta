// src/services/WalletAuthService.ts
// Frontend service to integrate with your existing JWT auth functions

import type { Account } from 'thirdweb/wallets';

export interface AuthNonceResponse {
  nonce: string;
}

export interface AuthWalletResponse {
  success: boolean;
  session: {
    access_token: string;
    refresh_token: string;
    token_type: string;
    expires_in: number;
    expires_at: number;
    user: {
      id: string;
      email: string;
      wallet_address: string;
      display_name: string;
      [key: string]: any;
    };
  };
  user: {
    id: string;
    wallet_address: string;
    display_name: string;
    email: string;
    verified_signature: boolean;
    authenticated_at: string;
    session_method: string;
  };
}

export interface WalletAuthResult {
  success: boolean;
  session?: AuthWalletResponse['session'];
  user?: AuthWalletResponse['user'];
  error?: string;
}

export class WalletAuthService {
  private static readonly API_BASE = '/.netlify/functions';
  
  /**
   * Complete wallet authentication flow
   */
  static async authenticateWallet(account: Account): Promise<WalletAuthResult> {
    try {
      if (!account?.address) {
        return { success: false, error: 'No wallet address provided' };
      }

      console.log('🔐 Starting wallet authentication for:', account.address);

      // Step 1: Get nonce from your auth-nonce function
      const nonce = await this.getNonce(account.address);
      if (!nonce) {
        return { success: false, error: 'Failed to get authentication nonce' };
      }

      // Step 2: Create message for user to sign
      const message = this.createSignMessage(account.address, nonce);

      // Step 3: Request signature from wallet
      const signature = await this.requestSignature(account, message);
      if (!signature) {
        return { success: false, error: 'Signature was rejected or failed' };
      }

      // Step 4: Verify signature and get JWT session from your auth-wallet function
      const authResult = await this.verifySignature(account.address, message, signature, nonce);
      
      if (authResult.success) {
        console.log('✅ Wallet authentication successful!');
        return {
          success: true,
          session: authResult.session,
          user: authResult.user
        };
      } else {
        return { success: false, error: 'Signature verification failed' };
      }

    } catch (error) {
      console.error('❌ Wallet authentication failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication failed'
      };
    }
  }

  /**
   * Get nonce from your auth-nonce Netlify function
   */
  private static async getNonce(address: string): Promise<string | null> {
    try {
      const response = await fetch(`${this.API_BASE}/auth-nonce`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ address }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data: AuthNonceResponse = await response.json();
      console.log('✅ Nonce received for wallet authentication');
      return data.nonce;

    } catch (error) {
      console.error('❌ Failed to get nonce:', error);
      return null;
    }
  }

  /**
   * Create the message that user will sign
   */
  private static createSignMessage(address: string, nonce: string): string {
    const timestamp = new Date().toISOString();
    return `Authenticate with Evermark:
Wallet: ${address}
Nonce: ${nonce}
Time: ${timestamp}

By signing this message, you confirm ownership of this wallet and authorize access to Evermark.`;
  }

  /**
   * Request signature from user's wallet
   */
  private static async requestSignature(account: Account, message: string): Promise<string | null> {
    try {
      console.log('📝 Requesting wallet signature...');
      
      // Use the account's signMessage method
      const signature = await account.signMessage({ message });
      
      console.log('✅ Signature received from wallet');
      return signature;

    } catch (error) {
      console.error('❌ Signature request failed:', error);
      
      // Handle common user rejection cases
      if (error instanceof Error) {
        const message = error.message.toLowerCase();
        if (message.includes('rejected') || message.includes('denied') || message.includes('cancelled')) {
          console.log('ℹ️ User rejected signature request');
          return null;
        }
      }
      
      throw error;
    }
  }

  /**
   * Verify signature with your auth-wallet Netlify function
   */
  private static async verifySignature(
    address: string,
    message: string,
    signature: string,
    nonce: string
  ): Promise<AuthWalletResponse> {
    try {
      const response = await fetch(`${this.API_BASE}/auth-wallet`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          address,
          message,
          signature,
          nonce,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data: AuthWalletResponse = await response.json();
      console.log('✅ Signature verified and JWT session created');
      return data;

    } catch (error) {
      console.error('❌ Signature verification failed:', error);
      throw error;
    }
  }

  /**
   * Validate if session is still valid
   */
  static isSessionValid(session: AuthWalletResponse['session']): boolean {
    if (!session || !session.expires_at) {
      return false;
    }

    const now = Math.floor(Date.now() / 1000);
    return session.expires_at > now;
  }

  /**
   * Get user-friendly error message
   */
  static getErrorMessage(error: string): string {
    if (error.includes('rejected') || error.includes('denied')) {
      return 'Signature was rejected. Please try again and approve the signature request.';
    }
    
    if (error.includes('nonce')) {
      return 'Authentication expired. Please try again.';
    }
    
    if (error.includes('Invalid signature')) {
      return 'Signature verification failed. Please try again.';
    }
    
    if (error.includes('network') || error.includes('fetch')) {
      return 'Network error. Please check your connection and try again.';
    }
    
    return error || 'Authentication failed. Please try again.';
  }
}