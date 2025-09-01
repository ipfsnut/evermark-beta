import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useWalletAccount, useThirdwebAccount } from '@/hooks/core/useWalletAccount';
import { useWallet } from '@/providers/WalletProvider';
import { useContextualTransactions } from '@/hooks/core/useContextualTransactions';
import { useNotifications } from '@/hooks/useNotifications';
import type { Account } from 'thirdweb/wallets';

import {
  type CreateEvermarkInput,
  type CreateEvermarkResult
} from '../types';

import { ContextualBlockchainService } from '../services/ContextualBlockchainService';
import { pinataService } from '@/services/PinataService';
import { type DuplicateCheckResponse } from '@/utils/contentIdentifiers';

/**
 * Hook for handling evermark creation with blockchain-first approach
 * Extracted from useEvermarkState for better separation of concerns
 */
export function useEvermarkCreation() {
  const account = useWalletAccount();
  const thirdwebAccount = useThirdwebAccount();
  const { context } = useWallet();
  const { sendTransaction } = useContextualTransactions();
  const queryClient = useQueryClient();
  const { success, error: showError } = useNotifications();

  // Creation progress state
  const [createProgress, setCreateProgress] = useState(0);
  const [createStep, setCreateStep] = useState('');
  
  // Duplicate check state
  const [duplicateCheck, setDuplicateCheck] = useState<DuplicateCheckResponse | null>(null);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);

  // Create evermark mutation
  const createMutation = useMutation({
    mutationFn: async (input: CreateEvermarkInput) => {
      if (!account) {
        throw new Error('No wallet connected. Please connect your wallet to create an Evermark.');
      }
      
      const accountForTransactions = thirdwebAccount || account;
      if (!accountForTransactions) {
        throw new Error('No wallet account available for blockchain transactions.');
      }

      setCreateProgress(0);
      setCreateStep('Validating inputs...');
      
      // Perform the blockchain-first creation
      const result = await createEvermarkWithBlockchain(
        input, 
        accountForTransactions, 
        sendTransaction,
        (progress: number, step: string) => {
          setCreateProgress(progress);
          setCreateStep(step);
        }
      );
      
      if (result.success) {
        setCreateProgress(100);
        setCreateStep('Evermark created successfully!');
        
        // Show success notification
        success(
          'Evermark Created!', 
          `Your evermark "${input.metadata?.title}" has been successfully created and minted on the blockchain.`,
          {
            duration: 6000,
            actions: result.txHash ? [{
              label: 'View Transaction',
              onClick: () => window.open(`https://basescan.org/tx/${result.txHash}`, '_blank')
            }] : undefined
          }
        );
        
        // Invalidate queries to refetch data
        await queryClient.invalidateQueries({ queryKey: ['evermarks'] });
      } else {
        throw new Error(result.message || 'Evermark creation failed');
      }
      
      return result;
    },
    onSuccess: () => {
      // Reset creation state after a delay
      setTimeout(() => {
        setCreateProgress(0);
        setCreateStep('');
      }, 2000);
    },
    onError: (error) => {
      console.error('Create evermark error:', error);
      setCreateStep('Creation failed');
      
      // Show error notification
      showError(
        'Evermark Creation Failed',
        error instanceof Error ? error.message : 'An unexpected error occurred during evermark creation.',
        { duration: 8000 }
      );
    }
  });

  const createEvermark = useCallback(async (input: CreateEvermarkInput) => {
    return createMutation.mutateAsync(input);
  }, [createMutation]);

  const clearCreateError = useCallback(() => {
    createMutation.reset();
  }, [createMutation]);
  
  // Check for duplicate content
  const checkForDuplicate = useCallback(async (sourceUrl: string): Promise<DuplicateCheckResponse> => {
    try {
      const response = await fetch(`/.netlify/functions/evermarks?check_duplicate=true&source_url=${encodeURIComponent(sourceUrl)}`);
      if (!response.ok) {
        throw new Error('Duplicate check failed');
      }
      const duplicateResult: DuplicateCheckResponse = await response.json();
      return duplicateResult;
    } catch (error) {
      console.warn('Duplicate check failed:', error);
      // Return "no duplicate" if check fails
      return {
        exists: false,
        confidence: 'low',
        duplicateType: 'normalized_url',
        message: 'Unable to check for duplicates'
      };
    }
  }, []);

  // Check for duplicates before creation
  const checkAndCreateEvermark = useCallback(async (input: CreateEvermarkInput, { skipDuplicateCheck = false } = {}) => {
    const sourceUrl = input.metadata?.sourceUrl || input.metadata?.url || input.metadata?.castUrl;
    
    if (!skipDuplicateCheck && sourceUrl) {
      const duplicateResult = await checkForDuplicate(sourceUrl);
      
      if (duplicateResult.exists) {
        setDuplicateCheck(duplicateResult);
        
        // For exact matches, force user to acknowledge the duplicate
        if (duplicateResult.confidence === 'exact') {
          setShowDuplicateModal(true);
          throw new Error(`${duplicateResult.message}. Please vote on the existing evermark instead.`);
        } 
        // For high confidence, show modal but allow override
        else if (duplicateResult.confidence === 'high') {
          setShowDuplicateModal(true);
          throw new Error(`${duplicateResult.message}. You can choose to proceed or vote on the existing evermark.`);
        }
        // For medium/low confidence, just log and proceed
        else {
          console.log('📋 Potential duplicate detected:', duplicateResult.message);
        }
      }
    }
    
    return createMutation.mutateAsync(input);
  }, [checkForDuplicate, createMutation]);
  
  // Reset duplicate state
  const clearDuplicateState = useCallback(() => {
    setDuplicateCheck(null);
    setShowDuplicateModal(false);
  }, []);

  return {
    createEvermark,
    checkAndCreateEvermark,
    isCreating: createMutation.isPending,
    createError: createMutation.error instanceof Error 
      ? createMutation.error.message 
      : createMutation.error ? 'Failed to create evermark' : null,
    createProgress,
    createStep,
    clearCreateError,
    // Duplicate check state
    duplicateCheck,
    showDuplicateModal,
    checkForDuplicate,
    clearDuplicateState
  };
}

/**
 * Core blockchain-first evermark creation logic
 * Extracted for reusability and testing
 */
async function createEvermarkWithBlockchain(
  input: CreateEvermarkInput,
  account: Account | { address: string; [key: string]: any },
  sendTransaction: (tx: {
    contract: any;
    method: string;
    params: any[];
    value?: bigint;
  }) => Promise<{ transactionHash: string }>,
  onProgress: (progress: number, step: string) => void
): Promise<CreateEvermarkResult> {
  try {
    onProgress(10, 'Validating inputs...');
    
    // Validate inputs
    if (!account?.address) {
      throw new Error('No wallet connected');
    }

    const accountAddress = account.address;

    if (!input.metadata?.title) {
      throw new Error('Title is required');
    }

    if (!input.image) {
      throw new Error('Image is required for evermark creation');
    }

    // Check configurations
    if (!pinataService.isConfigured()) {
      throw new Error('IPFS service not configured');
    }

    const { metadata } = input;
    
    // Fetch Farcaster cast metadata if this is a Cast evermark
    let castData;
    if (metadata.contentType === 'Cast' && metadata.sourceUrl) {
      try {
        onProgress(15, 'Fetching Farcaster cast metadata...');
        // Import FarcasterService here to avoid circular dependencies
        const { FarcasterService } = await import('../services/FarcasterService');
        castData = await FarcasterService.fetchCastMetadata(metadata.sourceUrl);
        console.log('✅ Cast metadata fetched:', castData);
      } catch (error) {
        console.warn('⚠️ Cast metadata fetch failed, continuing without cast data:', error);
        // Continue creation without cast data (graceful degradation)
      }
    }
    
    onProgress(20, 'Uploading image to IPFS...');
    
    // Upload image to IPFS
    const imageUploadResult = await pinataService.uploadImage(input.image);
    if (!imageUploadResult.success || !imageUploadResult.hash) {
      throw new Error(`Image upload failed: ${imageUploadResult.error}`);
    }
    
    onProgress(40, 'Creating metadata...');
    
    // Create NFT metadata
    const nftMetadata = {
      name: metadata.title,
      description: metadata.description ?? '',
      image: `ipfs://${imageUploadResult.hash}`,
      external_url: metadata.sourceUrl ?? metadata.url ?? metadata.castUrl,
      attributes: [
        {
          trait_type: 'Content Type',
          value: metadata.contentType ?? 'Custom'
        },
        {
          trait_type: 'Creator',
          value: metadata.author ?? accountAddress
        },
        {
          trait_type: 'Creation Date',
          value: new Date().toISOString(),
          display_type: 'date'
        },
        ...(metadata.tags || []).map(tag => ({
          trait_type: 'Tag',
          value: tag
        }))
      ],
      evermark: {
        version: '1.0',
        contentType: metadata.contentType || 'Custom',
        sourceUrl: metadata.sourceUrl || metadata.url || metadata.castUrl,
        tags: metadata.tags || [],
        customFields: metadata.customFields || [],
        doi: metadata.doi,
        isbn: metadata.isbn,
        journal: metadata.journal,
        publisher: metadata.publisher,
        publicationDate: metadata.publicationDate,
        volume: metadata.volume,
        issue: metadata.issue,
        pages: metadata.pages,
        // Add cast-specific data
        castData: castData,
        castUrl: metadata.sourceUrl || metadata.castUrl
      }
    };
    
    onProgress(50, 'Uploading metadata to IPFS...');
    
    // Upload metadata to IPFS
    const metadataUploadResult = await pinataService.uploadMetadata(nftMetadata);
    if (!metadataUploadResult.success || !metadataUploadResult.url) {
      throw new Error(`Metadata upload failed: ${metadataUploadResult.error}`);
    }
    
    onProgress(60, 'Checking referrer settings...');
    
    // Get user's account referrer setting
    let accountReferrer: string | undefined;
    
    try {
      const userSettingsResponse = await fetch('/api/user-settings', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Wallet-Address': accountAddress
        }
      });
      
      if (userSettingsResponse.ok) {
        const userSettings = await userSettingsResponse.json();
        accountReferrer = userSettings.settings?.referrer_address;
      }
    } catch {
      // Continue without referrer
    }

    const finalReferrer = input.referrer || accountReferrer;
    
    onProgress(70, 'Minting NFT on blockchain...');
    
    // Mint on blockchain
    const creatorAddress = accountAddress;
    const mintResult = await ContextualBlockchainService.mintEvermark(
      account,
      metadataUploadResult.url,
      metadata.title,
      creatorAddress,
      finalReferrer,
      sendTransaction
    );
    
    if (!mintResult.success) {
      throw new Error(`Blockchain minting failed: ${mintResult.error}`);
    }
    
    onProgress(85, 'Syncing to database...');
    
    // Sync to database
    if (mintResult.tokenId && mintResult.txHash) {
      try {
        const dbSyncResponse = await fetch('/api/evermarks', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Wallet-Address': accountAddress
          },
          body: JSON.stringify({
            token_id: parseInt(mintResult.tokenId),
            tx_hash: mintResult.txHash,
            title: metadata.title,
            description: metadata.description ?? '',
            content_type: metadata.contentType || 'Custom',
            source_url: metadata.sourceUrl || metadata.url || metadata.castUrl,
            token_uri: metadataUploadResult.url,
            author: metadata.author || accountAddress,
            metadata: JSON.stringify({
              // Include cast data in the format expected by generate-cast-image.ts
              ...(castData && {
                cast: {
                  text: castData.content,
                  author_username: castData.username,
                  author_display_name: castData.author,
                  author_pfp: castData.author_pfp, // Profile picture URL
                  author_fid: castData.author_fid, // Farcaster ID
                  likes: castData.engagement?.likes || 0,
                  recasts: castData.engagement?.recasts || 0,
                  replies: castData.engagement?.replies || 0,
                  timestamp: castData.timestamp,
                  hash: castData.castHash,
                  channel: castData.channel, // Channel name
                  embeds: castData.embeds || [] // Embed objects
                }
              }),
              tags: [
                ...(metadata.tags || []),
                ...(metadata.contentType === 'Cast' ? ['farcaster', 'cast'] : [])
              ],
              customFields: [
                ...(metadata.customFields || []),
                ...(castData ? [
                  { key: 'cast_author', value: castData.username || '' },
                  { key: 'cast_hash', value: castData.castHash || '' },
                  { key: 'cast_likes', value: String(castData.engagement?.likes || 0) },
                  { key: 'cast_recasts', value: String(castData.engagement?.recasts || 0) },
                  { key: 'cast_timestamp', value: castData.timestamp || '' }
                ] : [])
              ],
              doi: metadata.doi,
              isbn: metadata.isbn,
              journal: metadata.journal,
              publisher: metadata.publisher,
              publicationDate: metadata.publicationDate,
              volume: metadata.volume,
              issue: metadata.issue,
              pages: metadata.pages
            }),
            ipfs_image_hash: imageUploadResult.hash,
            referrer_address: finalReferrer || undefined
          })
        });
        
        if (dbSyncResponse.ok) {
          onProgress(95, 'Generating cast preview image...');
          
          // Generate cast preview image for Cast evermarks
          if (castData && mintResult.tokenId) {
            try {
              await fetch('/.netlify/functions/generate-cast-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token_id: parseInt(mintResult.tokenId) })
              });
            } catch (error) {
              console.warn('Cast image generation failed:', error);
              // Don't fail creation if image generation fails
            }
          }
          
          // Trigger general image caching
          try {
            await fetch('/.netlify/functions/cache-images', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                trigger: 'creation',
                tokenIds: [parseInt(mintResult.tokenId)]
              })
            });
          } catch {
            // Don't fail if caching fails
          }
        }
      } catch {
        // Don't fail if database sync fails
      }
    }
    
    onProgress(100, 'Complete!');
    
    return {
      success: true,
      txHash: mintResult.txHash,
      tokenId: mintResult.tokenId,
      metadataURI: metadataUploadResult.url,
      imageUrl: imageUploadResult.url,
      castData: castData || undefined,
      message: 'Evermark created successfully on blockchain!'
    };
    
  } catch (error) {
    console.error('Evermark creation failed:', error);
    
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to create evermark'
    };
  }
}