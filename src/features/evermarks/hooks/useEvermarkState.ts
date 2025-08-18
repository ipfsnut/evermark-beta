import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useActiveAccount } from 'thirdweb/react';

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
      console.log('🔄 TempEvermarkService.fetchEvermarks called with options:', options);
      
      // Simple API call to our evermarks endpoint
      // Use /api/ path which is redirected to /.netlify/functions/
      const response = await fetch('/api/evermarks', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      console.log('📡 API response status:', response.status, response.statusText);
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Transform the response to match our expected format
      const totalCount = data.pagination?.total || data.total || 0;
      const pageSize = options.pageSize || 12;
      const currentPage = options.page || 1;
      
      // Transform database fields to frontend format
      const transformedEvermarks = (data.evermarks || []).map((item: any) => {
        // Parse tags from metadata if available
        let tags: string[] = [];
        try {
          if (item.metadata) {
            const metadata = typeof item.metadata === 'string' ? JSON.parse(item.metadata) : item.metadata;
            tags = metadata.tags || [];
          }
        } catch (e) {
          // Failed to parse metadata, use empty tags
        }
        
        return {
          ...item,
          id: item.token_id,
          tokenId: item.token_id, // Add tokenId for components
          tags: tags, // Ensure tags is always an array
          ipfsHash: item.ipfs_image_hash, // Map IPFS hash
          image: item.supabase_image_url || (item.ipfs_image_hash ? `ipfs://${item.ipfs_image_hash}` : undefined), // Prioritize Supabase cached images
          createdAt: item.created_at || new Date().toISOString(),
          updatedAt: item.updated_at || item.created_at || new Date().toISOString(),
          contentType: item.content_type,
          sourceUrl: item.source_url,
          tokenUri: item.token_uri,
          verificationStatus: item.verified ? 'verified' : 'unverified',
          creator: item.owner || item.author, // Add creator field
          extendedMetadata: { tags } // Add extendedMetadata for compatibility
        };
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
      return data.evermark || null;
    } catch (error) {
      console.error('Failed to fetch evermark:', error);
      return null;
    }
  },
  createEvermark: async (input: CreateEvermarkInput, account: any): Promise<CreateEvermarkResult> => {
    try {
      console.log('🚀 Starting blockchain-first evermark creation...');
      
      // Step 1: Validate inputs
      if (!account?.address) {
        throw new Error('No wallet connected. Please connect your wallet to create an Evermark.');
      }

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
        description: metadata.description || '',
        image: `ipfs://${imageUploadResult.hash}`,
        external_url: metadata.sourceUrl || metadata.url || metadata.castUrl,
        attributes: [
          {
            trait_type: 'Content Type',
            value: metadata.contentType || 'Custom'
          },
          {
            trait_type: 'Creator',
            value: metadata.author || `${account.address.slice(0, 6)}...${account.address.slice(-4)}`
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
      
      const mintResult = await EvermarkBlockchainService.mintEvermark(
        account,
        metadataUploadResult.url,
        metadata.title,
        metadata.author || `${account.address.slice(0, 6)}...${account.address.slice(-4)}`
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
              'X-Wallet-Address': account.address
            },
            body: JSON.stringify({
              token_id: parseInt(mintResult.tokenId),
              tx_hash: mintResult.txHash,
              title: metadata.title,
              description: metadata.description || '',
              content_type: metadata.contentType || 'Custom',
              source_url: metadata.sourceUrl || metadata.url || metadata.castUrl,
              token_uri: metadataUploadResult.url,
              author: metadata.author || `${account.address.slice(0, 6)}...${account.address.slice(-4)}`,
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
              ipfs_image_hash: imageUploadResult.hash
            })
          });
          
          if (dbSyncResponse.ok) {
            console.log('✅ Database sync completed');
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
  console.log('🎯 useEvermarksState hook called');
  
  // Get the active account for blockchain operations
  const account = useActiveAccount();
  
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
      console.log('🚀 React Query queryFn called with options:', queryOptions);
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
      if (!account) {
        throw new Error('No wallet connected. Please connect your wallet to create an Evermark.');
      }

      setCreateProgress(0);
      setCreateStep('Validating inputs...');
      
      // Call the blockchain-first creation service
      const result = await TempEvermarkService.createEvermark(input, account);
      
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