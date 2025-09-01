import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useActiveAccount } from 'thirdweb/react';
import type { Account } from 'thirdweb/wallets';

import {
  type Evermark,
  type EvermarkFilters,
  type EvermarkPagination,
  type EvermarkFeedOptions,
  type CreateEvermarkInput,
  type UseEvermarksResult,
  type EvermarkFeedResult,
  type CreateEvermarkResult
} from '../types';
// Production services for blockchain-first evermark creation
import { EvermarkBlockchainService } from '../services/BlockchainService';
import { pinataService } from '@/services/PinataService';

// Temporary service replacement until SDK issues are fixed
const TempEvermarkService = {
  getDefaultPagination: (): EvermarkPagination => ({
    page: 1,
    pageSize: 12,
    sortBy: 'created_at' as const,
    sortOrder: 'desc' as const
  }),
  getDefaultFilters: (): EvermarkFilters => ({
    search: '',
    contentType: undefined,
    verified: false,
    author: '',
    tags: [],
    dateRange: undefined
  }),
  fetchEvermarks: async (options: EvermarkFeedOptions): Promise<EvermarkFeedResult> => {
    try {
      
      // Simple API call to our evermarks endpoint
      // Use /api/ path which is redirected to /.netlify/functions/
      const response = await fetch('/api/evermarks', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Transform the response to match our expected format
      const totalCount = data.pagination?.total ?? data.total ?? 0;
      const pageSize = options.pageSize ?? 12;
      const currentPage = options.page ?? 1;
      
      // Transform database fields to frontend format
      const transformedEvermarks = (data.evermarks ?? []).map((item: unknown) => {
        const evermarkItem = item as Record<string, unknown>;
        // Parse metadata and extract required fields
        let tags: string[] = [];
        let title = '';
        let author = '';
        let description = '';
        
        try {
          if (evermarkItem.metadata) {
            const metadata = typeof evermarkItem.metadata === 'string' ? JSON.parse(evermarkItem.metadata as string) : evermarkItem.metadata as Record<string, unknown>;
            tags = (metadata.tags as string[]) ?? [];
            title = (metadata.title as string) ?? '';
            author = (metadata.author as string) ?? '';
            description = (metadata.description as string) ?? '';
          }
        } catch {
          // Failed to parse metadata, use defaults
        }
        
        return {
          ...evermarkItem,
          id: evermarkItem.token_id as string,
          tokenId: Number(evermarkItem.token_id as string),
          title: title || (evermarkItem.title as string) || 'Untitled',
          author: author || (evermarkItem.author as string) || 'Unknown',
          creator: (evermarkItem.owner as string) ?? (evermarkItem.author as string) ?? 'Unknown',
          description: description || (evermarkItem.description as string) || '',
          metadataURI: (evermarkItem.token_uri as string) || '',
          tags,
          verified: Boolean(evermarkItem.verified),
          creationTime: Date.parse((evermarkItem.created_at as string) ?? new Date().toISOString()),
          ipfsHash: evermarkItem.ipfs_image_hash as string,
          image: (evermarkItem.supabase_image_url as string) ?? (evermarkItem.ipfs_image_hash ? `ipfs://${evermarkItem.ipfs_image_hash}` : undefined),
          createdAt: (evermarkItem.created_at as string) ?? new Date().toISOString(),
          updatedAt: (evermarkItem.updated_at as string) ?? (evermarkItem.created_at as string) ?? new Date().toISOString(),
          contentType: (evermarkItem.content_type as Evermark['contentType']) || 'Custom',
          sourceUrl: evermarkItem.source_url as string,
          imageStatus: 'processed' as const,
          extendedMetadata: { 
            tags,
            castData: evermarkItem.cast_data as any
          }
        } as Evermark;
      });
      
      return {
        evermarks: transformedEvermarks,
        totalCount,
        page: currentPage,
        totalPages: Math.ceil(totalCount / pageSize),
        hasNextPage: currentPage * pageSize < totalCount,
        hasPreviousPage: currentPage > 1
      };
    } catch (error) {
      console.error('Failed to fetch evermarks:', error);
      // Return empty result on error
      return {
        evermarks: [],
        totalCount: 0,
        page: 1,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: false
      };
    }
  },
  fetchEvermark: async (id: string): Promise<Evermark | null> => {
    try {
      // Simple API call to get individual evermark
      const response = await fetch(`/api/evermarks?id=${id}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      return data.evermark ?? null;
    } catch (error) {
      console.error('Failed to fetch evermark:', error);
      return null;
    }
  },
  createEvermark: async (input: CreateEvermarkInput, account: Account): Promise<CreateEvermarkResult> => {
    try {
      console.log('🚀 Starting blockchain-first evermark creation...');
      
      // Step 1: Validate inputs
      if (!account?.address) {
        throw new Error('No wallet connected. Please connect your wallet to create an Evermark.');
      }

      // Ensure we have a proper address string
      const accountAddress = account.address;

      if (!input.metadata?.title) {
        throw new Error('Title is required');
      }

      if (!input.image) {
        throw new Error('Image is required for evermark creation');
      }

      // Check Pinata configuration
      if (!pinataService.isConfigured()) {
        throw new Error('IPFS service not configured. Please check Pinata credentials.');
      }

      // Check blockchain service configuration
      if (!EvermarkBlockchainService.isConfigured()) {
        throw new Error('Blockchain service not configured. Please check contract addresses.');
      }

      const { metadata } = input;
      
      console.log('📡 Step 1: Uploading image to IPFS...');
      
      // Step 1: Upload image to IPFS
      const imageUploadResult = await pinataService.uploadImage(input.image);
      if (!imageUploadResult.success || !imageUploadResult.hash) {
        throw new Error(`Image upload failed: ${imageUploadResult.error}`);
      }
      
      console.log('✅ Image uploaded to IPFS:', imageUploadResult.hash);
      
      console.log('📡 Step 2: Creating and uploading metadata...');
      
      // Step 2: Create NFT metadata
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
          // Type-specific fields
          doi: metadata.doi,
          isbn: metadata.isbn,
          journal: metadata.journal,
          publisher: metadata.publisher,
          publicationDate: metadata.publicationDate,
          volume: metadata.volume,
          issue: metadata.issue,
          pages: metadata.pages
        }
      };
      
      // Step 3: Upload metadata to IPFS
      console.log('📡 Step 3: Uploading metadata to IPFS...');
      
      const metadataUploadResult = await pinataService.uploadMetadata(nftMetadata);
      if (!metadataUploadResult.success || !metadataUploadResult.url) {
        throw new Error(`Metadata upload failed: ${metadataUploadResult.error}`);
      }
      
      console.log('✅ Metadata uploaded to IPFS:', metadataUploadResult.hash);
      
      // Step 4: Call blockchain minting
      console.log('📡 Step 4: Minting Evermark NFT on blockchain...');
      
      // Debug the creator parameter before passing to blockchain service
      // Step 4: Get user's account referrer setting
      console.log('👥 Step 4: Checking account referrer...');
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
          console.log('✅ Account referrer found:', accountReferrer || 'None set');
        }
      } catch {
        console.log('⚠️ Could not fetch account referrer, continuing without');
      }

      // Use manual referrer if provided, otherwise use account referrer
      const finalReferrer = input.referrer || accountReferrer;
      console.log('👥 Final referrer:', finalReferrer || 'None');

      // IMPORTANT: Always use the full accountAddress, never use metadata.author for blockchain calls
      // metadata.author might be a display name or truncated address
      const creatorAddress = accountAddress; // Always use full wallet address for blockchain
      console.log('🔍 Creator address debugging:', {
        metadataAuthor: metadata.author,
        accountAddress,
        finalCreatorAddress: creatorAddress,
        finalCreatorType: typeof creatorAddress,
        finalCreatorLength: creatorAddress?.length,
        note: 'Using accountAddress instead of metadata.author for blockchain calls'
      });

      const mintResult = await EvermarkBlockchainService.mintEvermark(
        account,
        metadataUploadResult.url,
        metadata.title,
        creatorAddress,
        finalReferrer
      );
      
      if (!mintResult.success) {
        throw new Error(`Blockchain minting failed: ${mintResult.error}`);
      }
      
      console.log('✅ Evermark minted successfully!');
      console.log('Transaction Hash:', mintResult.txHash);
      console.log('Token ID:', mintResult.tokenId);
      
      // Step 5: Sync to database after successful blockchain mint
      console.log('📡 Step 5: Syncing to database...');
      
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
                tags: metadata.tags || [],
                customFields: metadata.customFields || [],
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
              referrer_address: input.referrer || undefined
            })
          });
          
          if (dbSyncResponse.ok) {
            console.log('✅ Database sync completed');
            
            // Step 6: Trigger image caching immediately after successful database sync
            console.log('📡 Step 6: Triggering image caching...');
            try {
              const cachingResponse = await fetch('/.netlify/functions/cache-images', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  trigger: 'creation',
                  tokenIds: [parseInt(mintResult.tokenId)]
                })
              });
              
              if (cachingResponse.ok) {
                console.log('✅ Image caching triggered successfully');
              } else {
                console.warn('⚠️ Image caching trigger failed, but evermark created successfully');
              }
            } catch (cacheError) {
              console.warn('⚠️ Image caching trigger error:', cacheError);
              // Don't fail the whole operation if caching fails
            }
          } else {
            console.warn('⚠️ Database sync failed, but blockchain mint succeeded');
          }
        } catch (dbError) {
          console.warn('⚠️ Database sync error:', dbError);
          // Don't fail the whole operation if database sync fails
        }
      }
      
      return {
        success: true,
        txHash: mintResult.txHash,
        tokenId: mintResult.tokenId,
        metadataURI: metadataUploadResult.url,
        imageUrl: imageUploadResult.url,
        message: 'Evermark created successfully on blockchain!'
      };
      
    } catch (error) {
      console.error('❌ Evermark creation failed:', error);
      
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to create evermark'
      };
    }
  }
};

// Query keys for React Query
const QUERY_KEYS = {
  evermarks: (options: EvermarkFeedOptions) => ['evermarks', options],
  evermark: (id: string) => ['evermark', id],
  all: () => ['evermarks'] as const
} as const;

/**
 * Main state management hook for Evermarks feature
 * Handles data fetching, creation, pagination, and filtering
 */
export function useEvermarksState(): UseEvermarksResult {
  
  // Get the active account for blockchain operations
  const thirdwebAccount = useActiveAccount();
  
  // Local state for pagination and filtering
  const [pagination, setPaginationState] = useState<EvermarkPagination>(
    TempEvermarkService.getDefaultPagination()
  );
  const [filters, setFiltersState] = useState<EvermarkFilters>(
    TempEvermarkService.getDefaultFilters()
  );
  const [selectedEvermark, setSelectedEvermark] = useState<Evermark | null>(null);
  
  // Creation state
  const [createProgress, setCreateProgress] = useState(0);
  const [createStep, setCreateStep] = useState('');

  const queryClient = useQueryClient();

  // Build query options
  const queryOptions = useMemo<EvermarkFeedOptions>(() => ({
    ...pagination,
    filters
  }), [pagination, filters]);

  // Main evermarks query
  const {
    data: feedResult,
    isLoading,
    error: queryError,
    refetch
  } = useQuery({
    queryKey: QUERY_KEYS.evermarks(queryOptions),
    queryFn: () => {
      return TempEvermarkService.fetchEvermarks(queryOptions);
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000,   // 10 minutes
    retry: 2,
    enabled: true, // Explicitly enable the query
    refetchOnWindowFocus: false
  });

  // Create evermark mutation with blockchain-first approach
  const createMutation = useMutation({
    mutationFn: async (input: CreateEvermarkInput) => {
      // Check if we have an account before starting creation
      if (!thirdwebAccount) {
        throw new Error('No wallet connected. Please connect your wallet to create an Evermark.');
      }

      setCreateProgress(0);
      setCreateStep('Validating inputs...');
      
      // Call the blockchain-first creation service
      const result = await TempEvermarkService.createEvermark(input, thirdwebAccount!);
      
      if (result.success) {
        setCreateProgress(100);
        setCreateStep('Evermark created successfully!');
        
        // Invalidate queries to refetch data
        await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.all() });
      } else {
        // Throw error if service returns failure - this triggers React Query's onError
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
    }
  });

  // Actions
  const loadEvermarks = useCallback(async (options?: Partial<EvermarkFeedOptions>) => {
    if (options) {
      if (options.filters) {
        setFiltersState(prev => ({ ...prev, ...options.filters }));
      }
      if (options.page !== undefined || options.pageSize !== undefined || 
          options.sortBy !== undefined || options.sortOrder !== undefined) {
        setPaginationState(prev => ({ 
          ...prev, 
          page: options.page ?? prev.page,
          pageSize: options.pageSize ?? prev.pageSize,
          sortBy: options.sortBy ?? prev.sortBy,
          sortOrder: options.sortOrder ?? prev.sortOrder
        }));
      }
    }
    await refetch();
  }, [refetch]);

  const loadMore = useCallback(async () => {
    if (feedResult?.hasNextPage) {
      setPaginationState(prev => ({ ...prev, page: prev.page + 1 }));
    }
  }, [feedResult?.hasNextPage]);

  const refresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const loadEvermark = useCallback(async (id: string): Promise<Evermark | null> => {
    const result = await queryClient.fetchQuery({
      queryKey: QUERY_KEYS.evermark(id),
      queryFn: () => TempEvermarkService.fetchEvermark(id),
      staleTime: 5 * 60 * 1000
    });
    return result;
  }, [queryClient]);

  const selectEvermark = useCallback((evermark: Evermark | null) => {
    setSelectedEvermark(evermark);
  }, []);

  const createEvermark = useCallback(async (input: CreateEvermarkInput) => {
    return createMutation.mutateAsync(input);
  }, [createMutation]);

  const setFilters = useCallback((newFilters: Partial<EvermarkFilters>) => {
    setFiltersState(prev => ({ ...prev, ...newFilters }));
    // Reset to first page when filters change
    setPaginationState(prev => ({ ...prev, page: 1 }));
  }, []);

  const setPagination = useCallback((newPagination: Partial<EvermarkPagination>) => {
    setPaginationState(prev => ({ ...prev, ...newPagination }));
  }, []);

  const clearFilters = useCallback(() => {
    setFiltersState(TempEvermarkService.getDefaultFilters());
    setPaginationState(prev => ({ ...prev, page: 1 }));
  }, []);

  const clearErrors = useCallback(() => {
    // Clear query errors by refetching
    refetch();
  }, [refetch]);

  const clearCreateError = useCallback(() => {
    createMutation.reset();
  }, [createMutation]);

  // Computed properties
  const error = useMemo(() => {
    if (queryError) {
      return queryError instanceof Error ? queryError.message : 'Failed to load evermarks';
    }
    return null;
  }, [queryError]);

  const createError = useMemo(() => {
    if (createMutation.error) {
      return createMutation.error instanceof Error 
        ? createMutation.error.message 
        : 'Failed to create evermark';
    }
    return null;
  }, [createMutation.error]);

  const evermarks = feedResult?.evermarks || [];
  const totalCount = feedResult?.totalCount || 0;
  const totalPages = feedResult?.totalPages || 0;
  const hasNextPage = feedResult?.hasNextPage || false;
  const hasPreviousPage = feedResult?.hasPreviousPage || false;

  const isEmpty = evermarks.length === 0 && !isLoading;
  
  const isFiltered = useMemo(() => {
    const defaultFilters = TempEvermarkService.getDefaultFilters();
    return (
      filters.search !== defaultFilters.search ||
      filters.author !== defaultFilters.author ||
      filters.contentType !== defaultFilters.contentType ||
      filters.verified !== defaultFilters.verified ||
      (filters.tags && filters.tags.length > 0) ||
      filters.dateRange !== defaultFilters.dateRange
    );
  }, [filters]);

  return {
    // State
    evermarks,
    selectedEvermark,
    pagination,
    filters,
    totalCount,
    totalPages,
    
    // Loading states
    isLoading,
    isCreating: createMutation.isPending,
    isLoadingMore: false, // Could be enhanced with infinite query
    
    // Error states
    error,
    createError,
    
    // Creation progress
    createProgress,
    createStep,
    
    // Actions
    loadEvermarks,
    loadMore,
    refresh,
    loadEvermark,
    selectEvermark,
    createEvermark,
    setFilters,
    setPagination,
    clearFilters,
    clearErrors,
    clearCreateError,
    
    // Computed properties
    hasNextPage,
    hasPreviousPage,
    isEmpty,
    isFiltered
  };
}