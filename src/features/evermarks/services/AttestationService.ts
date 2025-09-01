import type { Evermark, FarcasterCastData } from '../types';

export interface AttestationDocument {
  evermarkId: string;
  title: string;
  author: string;
  contentType: string;
  sourceUrl: string;
  tokenId: number;
  creatorAddress: string;
  txHash: string;
  blockNumber?: number;
  createdAt: string;
  verificationStatus: 'verified' | 'unverified' | 'staked';
  verificationMethod: 'automatic' | 'manual' | 'staked';
  metadataUri: string;
  ipfsImageHash?: string;
  contentHash: string;
  networkInfo: {
    chainId: number;
    networkName: string;
    contractAddress: string;
  };
  preservedContent?: {
    text?: string;
    metadata?: Record<string, any>;
  };
  creatorNotes?: string;
  stakingInfo?: {
    isStaked: boolean;
    stakedAt?: string;
    stakeTxHash?: string;
    verificationRequestedAt?: string;
  };
}

export class AttestationService {
  /**
   * Generate authenticity attestation document data
   */
  static async generateAttestationData(evermark: Evermark): Promise<AttestationDocument> {
    // Calculate content hash from preserved data
    const contentHash = await this.calculateContentHash(evermark);
    
    // Get network info
    const networkInfo = {
      chainId: 8453, // Base
      networkName: 'Base',
      contractAddress: import.meta.env.VITE_EVERMARK_NFT_ADDRESS || '0x[contract]'
    };

    // Extract preserved content
    const preservedContent = this.extractPreservedContent(evermark);

    return {
      evermarkId: evermark.id,
      title: evermark.title,
      author: evermark.author,
      contentType: evermark.contentType,
      sourceUrl: evermark.sourceUrl || '',
      tokenId: evermark.tokenId,
      creatorAddress: evermark.creator,
      txHash: evermark.extendedMetadata?.txHash || '',
      blockNumber: evermark.extendedMetadata?.blockNumber,
      createdAt: evermark.createdAt,
      verificationStatus: evermark.verified ? 'verified' : 'unverified',
      verificationMethod: this.getVerificationMethod(evermark),
      metadataUri: evermark.metadataURI,
      ipfsImageHash: evermark.ipfsHash,
      contentHash,
      networkInfo,
      preservedContent
    };
  }

  /**
   * Extract preserved content for attestation
   */
  private static extractPreservedContent(evermark: Evermark): AttestationDocument['preservedContent'] {
    const content: any = {};

    // Extract cast content
    if (evermark.extendedMetadata?.castData) {
      const cast = evermark.extendedMetadata.castData;
      content.text = cast.content;
      content.metadata = {
        author: cast.author,
        username: cast.username,
        timestamp: cast.timestamp,
        engagement: cast.engagement,
        hash: cast.castHash
      };
    }

    // Extract tweet content
    if (evermark.extendedMetadata?.tweetData) {
      const tweet = evermark.extendedMetadata.tweetData;
      content.text = tweet.content;
      content.metadata = {
        author: tweet.author,
        username: tweet.username,
        timestamp: tweet.timestamp,
        preservedAt: tweet.preservedAt
      };
    }

    // Extract academic content
    if (evermark.extendedMetadata?.academic) {
      const academic = evermark.extendedMetadata.academic;
      content.metadata = {
        authors: academic.authors,
        journal: academic.journal,
        publishedDate: academic.publishedDate,
        abstract: academic.abstract
      };
    }

    return Object.keys(content).length > 0 ? content : undefined;
  }

  /**
   * Determine verification method used
   */
  private static getVerificationMethod(evermark: Evermark): AttestationDocument['verificationMethod'] {
    if (evermark.verified && evermark.contentType === 'Cast') {
      return 'automatic'; // Our auto-verification for casts
    }
    // TODO: Add logic for stake-based verification when implemented
    return evermark.verified ? 'manual' : 'automatic';
  }

  /**
   * Calculate hash of preserved content for integrity verification
   */
  private static async calculateContentHash(evermark: Evermark): Promise<string> {
    // Create deterministic string from evermark data
    const dataString = JSON.stringify({
      tokenId: evermark.tokenId,
      title: evermark.title,
      author: evermark.author,
      sourceUrl: evermark.sourceUrl,
      contentType: evermark.contentType,
      createdAt: evermark.createdAt,
      metadataURI: evermark.metadataURI,
      preservedContent: this.extractPreservedContent(evermark)
    });

    // Generate SHA-256 hash
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const encoder = new TextEncoder();
      const data = encoder.encode(dataString);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    // Fallback for environments without crypto.subtle
    return btoa(dataString).slice(0, 32);
  }

  /**
   * Generate formatted attestation text
   */
  static formatAttestationText(data: AttestationDocument): string {
    const getVerificationSymbol = () => {
      switch (data.verificationStatus) {
        case 'verified': return '✓ VERIFIED';
        case 'staked': return '⚡ STAKED FOR VERIFICATION';
        default: return '○ UNVERIFIED';
      }
    };

    const getVerificationReason = () => {
      switch (data.verificationMethod) {
        case 'automatic': return '(Author created own content)';
        case 'staked': return '(Creator staked NFT for verification)';
        default: return `(${data.verificationMethod.toUpperCase()})`;
      }
    };

    const stakingSection = data.stakingInfo?.isStaked ? `

STAKING VERIFICATION
━━━━━━━━━━━━━━━━━━━━━━━━
Staked: ${data.stakingInfo.isStaked ? 'YES' : 'NO'}
${data.stakingInfo.stakedAt ? `Staked At: ${new Date(data.stakingInfo.stakedAt).toLocaleDateString()}` : ''}
${data.stakingInfo.stakeTxHash ? `Stake Transaction: ${data.stakingInfo.stakeTxHash}` : ''}
${data.stakingInfo.verificationRequestedAt ? `Verification Requested: ${new Date(data.stakingInfo.verificationRequestedAt).toLocaleDateString()}` : ''}` : '';

    const creatorNotesSection = data.creatorNotes ? `

CREATOR ATTESTATION NOTES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"${data.creatorNotes}"

— ${data.author}` : '';

    return `EVERMARK AUTHENTICITY ATTESTATION
═══════════════════════════════════════════════

CONTENT PRESERVATION CERTIFICATE

Title: "${data.title}"
Author: ${data.author}
Content Type: ${data.contentType}
Source: ${data.sourceUrl}

BLOCKCHAIN VERIFICATION
━━━━━━━━━━━━━━━━━━━━━━━━
Token ID: #${data.tokenId}
Contract: ${data.networkInfo.contractAddress}
Network: ${data.networkInfo.networkName} (Chain ID: ${data.networkInfo.chainId})
Transaction: ${data.txHash}
${data.blockNumber ? `Block: ${data.blockNumber}` : ''}
Created: ${new Date(data.createdAt).toLocaleDateString('en-US', { 
  year: 'numeric', 
  month: 'long', 
  day: 'numeric' 
})}

CREATOR VERIFICATION
━━━━━━━━━━━━━━━━━━━━
Creator: ${data.creatorAddress}
Status: ${getVerificationSymbol()} ${getVerificationReason()}
Method: ${data.verificationMethod}${stakingSection}${creatorNotesSection}

CONTENT PRESERVATION
━━━━━━━━━━━━━━━━━━━━━
IPFS Metadata: ${data.metadataUri}
${data.ipfsImageHash ? `Image Hash: ${data.ipfsImageHash}` : ''}
Content Hash: ${data.contentHash}
${data.preservedContent?.text ? `\nPreserved Text: "${data.preservedContent.text.slice(0, 100)}${data.preservedContent.text.length > 100 ? '...' : ''}"` : ''}

This document certifies that the above content has been
permanently preserved on the blockchain and IPFS network.
${data.creatorNotes ? '\nCreator notes included above attest to content authenticity.' : ''}

Generated by Evermark Protocol
https://evermarks.net/verify/${data.tokenId}
═══════════════════════════════════════════════`;
  }

  /**
   * Generate downloadable attestation document
   */
  static async generateAttestationDocument(evermark: Evermark): Promise<Blob> {
    const data = await this.generateAttestationData(evermark);
    const text = this.formatAttestationText(data);
    
    return new Blob([text], { type: 'text/plain' });
  }

  /**
   * Generate attestation document filename
   */
  static generateAttestationFilename(evermark: Evermark): string {
    const safeTitle = evermark.title
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .replace(/\s+/g, '-')
      .toLowerCase()
      .slice(0, 30);
    
    return `evermark-${evermark.tokenId}-${safeTitle}-attestation.txt`;
  }
}