// src/features/evermarks/hooks/useEvermarkCreation_updated.ts
// Updated evermark creation hook with ArDrive and season support
// This replaces the existing useEvermarkCreation.ts file

import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useWalletAccount, useThirdwebAccount } from '@/hooks/core/useWalletAccount';
import { useWallet } from '@/providers/WalletProvider';
import { useContextualTransactions } from '@/hooks/core/useContextualTransactions';
import { useNotifications } from '@/hooks/useNotifications';
import { PointsService } from '@/features/points/services/PointsService';
import type { Account } from 'thirdweb/wallets';

import {
  type CreateEvermarkInput,
  type CreateEvermarkResult
} from '../types';

import { ContextualBlockchainService } from '../services/ContextualBlockchainService';
import { type DuplicateCheckResponse } from '@/utils/contentIdentifiers';

// NEW IMPORTS
import { storageService } from '@/services/StorageService';
import { seasonOracle } from '@/services/SeasonOracle';
import { FEATURES } from '@/config/features';

/**
 * Hook for handling evermark creation with unified storage and season management
 * Updated to support both IPFS and ArDrive backends with automatic season tracking
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
      
      // Perform the blockchain-first creation with new storage system
      const result = await createEvermarkWithUnifiedStorage(
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
        await queryClient.invalidateQueries({ queryKey: ['season'] });
        
        // Award points for creating evermark
        try {
          await PointsService.awardPoints(
            account.address, 
            'create_evermark', 
            result.tokenId, 
            result.txHash
          );
          console.log('✅ Awarded 10 points for evermark creation');
        } catch (pointsError) {
          console.warn('⚠️ Failed to award points for evermark creation:', pointsError);
        }
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

  // Check for duplicate and create if none found
  const checkAndCreateEvermark = useCallback(async (input: CreateEvermarkInput) => {
    if (input.metadata?.sourceUrl) {
      const duplicate = await checkForDuplicate(input.metadata.sourceUrl);
      if (duplicate.exists) {
        setDuplicateCheck(duplicate);
        setShowDuplicateModal(true);
        return null;
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
 * Updated evermark creation logic with unified storage and season tracking
 */
async function createEvermarkWithUnifiedStorage(
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

    console.log('🔍 Validation - input.image:', input.image, 'type:', typeof input.image);
    console.log('🔍 Validation - contentType:', input.metadata?.contentType);
    console.log('🔍 Storage backend:', FEATURES.getStorageBackend());
    
    // Image is optional for Cast content type (since we can generate cast images)
    if (!input.image && input.metadata?.contentType !== 'Cast') {
      throw new Error('Image is required for evermark creation');
    }

    // Check storage service configuration
    if (!storageService.isConfigured()) {
      throw new Error('Storage service not configured');
    }

    // Get current season info
    onProgress(12, 'Getting current season...');
    const seasonState = await seasonOracle.getCurrentState();
    const currentSeason = seasonState.current;
    
    console.log('📅 Current season:', currentSeason.number, `(${currentSeason.year}-${currentSeason.week})`);

    const { metadata } = input;
    
    // Fetch metadata based on content type (unchanged logic)
    let castData;
    let academicMetadata;
    let tweetData;
    let webMetadata;
    
    if (metadata.contentType === 'Cast' && metadata.sourceUrl) {
      try {
        onProgress(15, 'Fetching Farcaster cast metadata...');
        const { FarcasterService } = await import('../services/FarcasterService');
        castData = await FarcasterService.fetchCastMetadata(metadata.sourceUrl);
        console.log('✅ Cast metadata fetched:', castData);
      } catch (error) {
        console.warn('⚠️ Cast metadata fetch failed, continuing without cast data:', error);
      }
    } else if (metadata.contentType === 'Tweet' && metadata.sourceUrl) {
      try {
        onProgress(15, 'Fetching tweet metadata...');
        const { TwitterService } = await import('../services/TwitterService');
        tweetData = await TwitterService.fetchTweetMetadata(metadata.sourceUrl);
        console.log('✅ Tweet metadata fetched:', tweetData);
      } catch (error) {
        console.warn('⚠️ Tweet metadata fetch failed, continuing without tweet data:', error);
      }
    } else if ((metadata.contentType === 'DOI' || metadata.contentType === 'ISBN') && metadata.sourceUrl) {
      try {
        onProgress(15, 'Fetching academic metadata...');
        const { MetadataService } = await import('../services/MetadataService');
        const result = await MetadataService.fetchContentMetadata(metadata.sourceUrl);
        if (result.metadata) {
          academicMetadata = result.metadata;
          console.log('✅ Academic metadata fetched:', academicMetadata);
        }
      } catch (error) {
        console.warn('⚠️ Academic metadata fetch failed, continuing without metadata:', error);
      }
    } else if (metadata.contentType === 'URL' && metadata.sourceUrl) {
      try {
        onProgress(15, 'Fetching web content metadata...');
        const { WebMetadataService } = await import('../services/WebMetadataService');
        webMetadata = await WebMetadataService.fetchWebContentMetadata(metadata.sourceUrl);
        console.log('✅ Web metadata fetched:', webMetadata);
      } catch (error) {
        console.warn('⚠️ Web metadata fetch failed, continuing without web data:', error);
      }
    }
    
    let imageUploadResult: any = null;
    
    if (input.image) {
      if (typeof input.image === 'string') {
        // Handle README book images - process via server-side function
        onProgress(20, 'Processing README book cover image...');
        
        try {
          const response = await fetch('/.netlify/functions/process-readme-image', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ imageUrl: input.image })
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => null);
            throw new Error(`Server image processing failed: ${response.status} - ${errorData?.error || 'Unknown error'}`);
          }

          const result = await response.json();
          if (!result.success) {
            throw new Error(`Image processing failed: ${result.error}`);
          }

          onProgress(25, 'Converting and uploading to storage...');

          // Convert base64 data URL to File
          const base64Data = result.dataUrl.split(',')[1];
          const imageBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
          const imageFile = new File([imageBuffer], 'readme-image.jpg', { type: 'image/jpeg' });

          // Upload using unified storage service
          imageUploadResult = await storageService.uploadImage(imageFile);
          
        } catch (error) {
          console.error('❌ README image processing failed:', error);
          throw new Error(`README image processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      } else {
        // Handle regular File uploads
        onProgress(20, 'Uploading image to storage...');
        
        try {
          imageUploadResult = await storageService.uploadImage(input.image);
        } catch (error) {
          console.error('❌ Image upload failed:', error);
          throw new Error(`Image upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      if (!imageUploadResult.success) {
        throw new Error(imageUploadResult.error || 'Image upload failed');
      }

      console.log('✅ Image uploaded successfully:', imageUploadResult);
    }

    // Build enhanced metadata with season and storage info
    onProgress(30, 'Building metadata...');
    
    const enhancedMetadata = {
      ...metadata,
      
      // Season information
      season: {
        number: currentSeason.number,
        year: currentSeason.year,
        week: currentSeason.week,
        phase: currentSeason.phase,
        timestamp: Date.now()
      },
      
      // Storage information
      storage: {
        backend: imageUploadResult?.backend || 'unknown',
        url: imageUploadResult?.url,
        ...(imageUploadResult?.hash && { ipfsHash: imageUploadResult.hash }),
        ...(imageUploadResult?.txId && { ardriveId: imageUploadResult.txId }),
        ...(imageUploadResult?.cost && { cost: imageUploadResult.cost }),
        uploadedAt: new Date().toISOString()
      },
      
      // Enhanced metadata from external services
      ...(castData && { castData }),
      ...(academicMetadata && { academicMetadata }),
      ...(tweetData && { tweetData }),
      ...(webMetadata && { webMetadata }),
      
      // Creator info
      creator: accountAddress,
      createdAt: new Date().toISOString(),
      
      // Image reference
      ...(imageUploadResult && {
        image: imageUploadResult.url,
        imageHash: imageUploadResult.hash,
        imageSize: imageUploadResult.size
      })
    };

    // Upload metadata using unified storage service
    onProgress(40, 'Uploading metadata...');
    
    let metadataUploadResult;
    try {
      metadataUploadResult = await storageService.uploadMetadata(enhancedMetadata);
    } catch (error) {
      console.error('❌ Metadata upload failed:', error);
      throw new Error(`Metadata upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    if (!metadataUploadResult.success) {
      throw new Error(metadataUploadResult.error || 'Metadata upload failed');
    }

    console.log('✅ Metadata uploaded successfully:', metadataUploadResult);

    // Prepare blockchain transaction
    onProgress(50, 'Preparing blockchain transaction...');
    
    const metadataUri = metadataUploadResult.url;
    const referrerAddress = accountAddress; // Remove referrer for now

    console.log('🔗 Minting NFT with metadata URI:', metadataUri);

    // Get contracts and mint NFT
    onProgress(60, 'Minting NFT on blockchain...');
    
    const contracts = await import('@/lib/contracts');
    const nftContract = contracts.getEvermarkNFTContract();

    // Use the correct mintEvermark parameters: (metadataURI, title, creator)
    const mintTx = await sendTransaction({
      contract: nftContract,
      method: "function mintEvermark(string metadataURI, string title, string creator) payable returns (uint256)",
      params: [metadataUri, metadata.title, accountAddress],
      value: BigInt("70000000000000") // 0.00007 ETH in wei
    });

    console.log('✅ NFT minted successfully. Transaction hash:', mintTx.transactionHash);

    onProgress(80, 'Saving to database...');

    // Save to database with enhanced data
    const evermarkData = {
      title: metadata.title,
      description: metadata.description || '',
      content_type: metadata.contentType || 'Custom Content',
      source_url: metadata.sourceUrl || null,
      creator_address: accountAddress,
      tx_hash: mintTx.transactionHash,
      token_id: 0, // Will be updated from blockchain events
      
      // Storage references - support both IPFS and ArDrive
      token_uri: metadataUri,
      ...(metadataUploadResult.hash && {
        ipfs_metadata_hash: metadataUploadResult.hash
      }),
      ...(metadataUploadResult.txId && {
        ardrive_metadata_tx: metadataUploadResult.txId,
        ardrive_tx_id: metadataUploadResult.txId
      }),
      storage_backend: metadataUploadResult.backend,
      
      // Image references
      ...(imageUploadResult && {
        ...(imageUploadResult.hash && {
          ipfs_image_hash: imageUploadResult.hash
        }),
        ...(imageUploadResult.txId && {
          ardrive_image_tx: imageUploadResult.txId
        }),
        ...(imageUploadResult.cost && {
          ardrive_cost_usd: imageUploadResult.cost
        })
      }),
      
      // Season tracking
      season_number: currentSeason.number,
      season_year: currentSeason.year,
      season_week: currentSeason.week,
      season_created_at: new Date().toISOString(),
      
      // Enhanced metadata
      metadata_json: JSON.stringify(enhancedMetadata),
      
      // Additional ArDrive info
      ...(metadataUploadResult.season && {
        ardrive_folder_path: seasonOracle.getSeasonFolderPath(seasonState.current)
      })
    };

    // Save to Supabase
    try {
      const saveResponse = await fetch('/.netlify/functions/evermarks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Wallet-Address': accountAddress // Add wallet address header
        },
        body: JSON.stringify(evermarkData)
      });

      if (!saveResponse.ok) {
        const errorData = await saveResponse.json().catch(() => null);
        throw new Error(`Database save failed: ${saveResponse.status} - ${errorData?.error || 'Unknown error'}`);
      }

      const saveResult = await saveResponse.json();
      console.log('✅ Evermark saved to database:', saveResult);

    } catch (error) {
      console.error('❌ Database save failed:', error);
      // Don't fail the whole process if database save fails
      console.warn('⚠️ Continuing despite database save failure');
    }

    onProgress(100, 'Evermark created successfully!');

    return {
      success: true,
      txHash: mintTx.transactionHash,
      tokenId: 'pending', // Will be extracted from transaction receipt
      metadataURI: metadataUri,
      imageUrl: imageUploadResult?.url,
      message: 'Evermark created successfully'
    };

  } catch (error) {
    console.error('❌ Evermark creation failed:', error);
    throw error;
  }
}

export default useEvermarkCreation;