/**
 * README Book Metadata Extraction Service
 * 
 * Handles metadata extraction for PageDAO README books and other NFT books
 * Supports OpenSea marketplace URLs and direct contract queries
 */

import type { ReadmeBookData } from '../types';

export interface ReadmeMetadata {
  bookTitle: string;
  bookAuthor: string;
  description?: string;
  image?: string;
  confidence: 'high' | 'medium' | 'low';
  extractionMethod: string;
  readmeData: ReadmeBookData;
  // IPFS content
  ipfsContent?: {
    hash: string;
    contentType: 'pdf' | 'html' | 'epub' | 'text';
    size?: number;
    gateway: string;
  };
}

export class ReadmeService {
  /**
   * Known README book contract addresses and their networks
   */
  private static readonly README_CONTRACTS = new Map([
    // PageDAO contract on Polygon
    ['0x931204fb8cea7f7068995dce924f0d76d571df99', {
      name: 'PageDAO README Books',
      network: 'polygon',
      standard: 'ERC1155'
    }]
  ]);

  /**
   * IPFS gateways for content retrieval
   */
  private static readonly IPFS_GATEWAYS = [
    'https://ipfs.io/ipfs/',
    'https://gateway.pinata.cloud/ipfs/',
    'https://cloudflare-ipfs.com/ipfs/',
    'https://dweb.link/ipfs/'
  ];

  /**
   * Detect if URL is a README book
   */
  static isReadmeBook(url: string): boolean {
    const readmePatterns = [
      // OpenSea README books (both URL formats)
      /opensea\.io\/(assets|item)\/matic\/0x931204fb8cea7f7068995dce924f0d76d571df99/i,
      // NFT Book Bazaar
      /nftbookbazaar\.com/i,
      // PageDAO mint site
      /mint\.nftbookbazaar\.com/i,
      // Direct contract references
      /0x931204fb8cea7f7068995dce924f0d76d571df99/i
    ];

    return readmePatterns.some(pattern => pattern.test(url));
  }

  /**
   * Extract contract address and token ID from URL
   */
  static parseReadmeUrl(url: string): { contract?: string; tokenId?: string; platform?: string } {
    // OpenSea patterns: 
    // - opensea.io/assets/matic/[contract]/[tokenId]
    // - opensea.io/item/matic/[contract]/[tokenId]
    const openseaPatterns = [
      /opensea\.io\/assets\/matic\/([0-9a-fA-Fx]+)\/(\d+)/,
      /opensea\.io\/item\/matic\/([0-9a-fA-Fx]+)\/(\d+)/
    ];
    
    for (const pattern of openseaPatterns) {
      const match = url.match(pattern);
      if (match) {
        return {
          contract: match[1].toLowerCase(),
          tokenId: match[2],
          platform: 'opensea'
        };
      }
    }

    // NFT Book Bazaar pattern - would need their URL structure
    if (url.includes('nftbookbazaar.com')) {
      return { platform: 'nftbookbazaar' };
    }

    return {};
  }

  /**
   * Fetch metadata from OpenSea API via server-side function
   */
  static async fetchOpenSeaMetadata(contract: string, tokenId: string): Promise<ReadmeMetadata | null> {
    try {
      console.log(`🔍 Fetching README metadata via server for ${contract}/${tokenId}`);
      
      // Use our Netlify function to avoid CORS and API key issues
      const response = await fetch(`/.netlify/functions/readme-metadata?contract=${contract}&tokenId=${tokenId}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Server metadata fetch failed: ${response.status} - ${errorText}`);
        throw new Error(`Server metadata fetch failed: ${response.status}`);
      }

      const result = await response.json();
      console.log('📚 Server metadata response:', result);
      console.log('📚 Full server response structure:', JSON.stringify(result, null, 2));
      
      if (!result.success) {
        console.error('❌ Server returned error:', result.error);
        throw new Error(`Server returned error: ${result.error}`);
      }

      const data = result.data;
      console.log('📚 Extracted data from server:', JSON.stringify(data, null, 2));
      
      // OpenSea v2 API returns data nested in a "nft" object
      const nftData = data.nft || data;
      
      // Extract book-specific metadata from OpenSea attributes
      const attributes = nftData.traits || nftData.attributes || [];
      console.log('📋 Found attributes:', JSON.stringify(attributes, null, 2));
      
      const getAttributeValue = (traitType: string) => {
        const attr = attributes.find((a: any) => 
          a.trait_type?.toLowerCase() === traitType.toLowerCase() ||
          a.trait_type === traitType
        );
        console.log(`🔍 Looking for "${traitType}":`, attr);
        return attr?.value;
      };

      console.log('📝 Raw NFT data fields:', {
        name: nftData.name,
        description: nftData.description,
        creator: nftData.creator,
        collection: nftData.collection,
        image_url: nftData.image_url,
        image: nftData.image,
        token_uri: nftData.token_uri,
        display_image_url: nftData.display_image_url,
        display_animation_url: nftData.display_animation_url,
        allKeys: Object.keys(nftData)
      });

      // Extract essential fields with proper error handling
      const bookTitle = nftData.name || nftData.title;
      const bookAuthor = getAttributeValue('Author(s)') || getAttributeValue('Author') || nftData.creator?.user?.username || nftData.creator?.username;
      
      if (!bookTitle) {
        throw new Error('Could not extract book title from OpenSea metadata');
      }
      
      if (!bookAuthor) {
        throw new Error('Could not extract book author from OpenSea metadata');
      }

      const readmeData: ReadmeBookData = {
        bookTitle,
        bookAuthor,
        polygonContract: contract,
        polygonTokenId: tokenId,
        bookDescription: nftData.description,
        isbn: getAttributeValue('ISBN'),
        publicationDate: getAttributeValue('Publication Date'),
        chapterNumber: getAttributeValue('Chapter') ? parseInt(getAttributeValue('Chapter')) : undefined,
        totalChapters: getAttributeValue('Total Chapters') ? parseInt(getAttributeValue('Total Chapters')) : undefined,
        genre: getAttributeValue('Genre'),
        language: getAttributeValue('Language'),
        publisher: getAttributeValue('Publisher') || 'PageDAO',
        pageCount: getAttributeValue('Pages') ? parseInt(getAttributeValue('Pages')) : undefined,
        tokenGated: getAttributeValue('Token Gated') === 'true',
        marketplaceUrl: nftData.permalink,
        currentOwner: nftData.owner?.address,
        mintDate: nftData.asset_contract?.created_date,
        royaltyPercentage: nftData.asset_contract?.seller_fee_basis_points ? 
          nftData.asset_contract.seller_fee_basis_points / 100 : undefined
      };

      // Try to extract IPFS hash from various sources
      const bookContentHash = this.extractIPFSHash(nftData.animation_url, nftData.display_animation_url);
      const metadataHash = this.extractIPFSHash(nftData.metadata_url);
      const imageHash = this.extractIPFSHash(nftData.token_uri, nftData.image_url);
      
      console.log('📦 IPFS hashes found:', {
        bookContent: bookContentHash,
        metadata: metadataHash, 
        directImage: imageHash
      });

      // Set book content IPFS hash (this is the actual book file)
      if (bookContentHash) {
        readmeData.ipfsHash = bookContentHash;
        console.log('📖 Book content IPFS hash set:', bookContentHash);
      }

      // Try to fetch cover image from IPFS metadata
      let ipfsImageUrl = null;
      if (metadataHash) {
        try {
          console.log('🔍 Fetching NFT metadata from IPFS:', metadataHash);
          const metadataContent = await this.fetchIPFSContent(metadataHash);
          if (metadataContent && typeof metadataContent.content === 'string') {
            const metadata = JSON.parse(metadataContent.content);
            console.log('📋 IPFS metadata:', metadata);
            
            if (metadata.image) {
              const coverImageHash = this.extractIPFSHash(metadata.image);
              if (coverImageHash) {
                ipfsImageUrl = `https://ipfs.io/ipfs/${coverImageHash}`;
                console.log('🖼️ Found IPFS cover image:', ipfsImageUrl);
              }
            }
          }
        } catch (error) {
          console.warn('⚠️ Could not fetch IPFS metadata:', error);
        }
      }

      // Fetch IPFS content metadata if we have a book content hash
      let ipfsContent;
      if (bookContentHash) {
        ipfsContent = await this.fetchIPFSMetadata(bookContentHash);
      }

      // Prefer IPFS image over OpenSea CDN
      const openSeaImageUrl = nftData.image_url || nftData.display_image_url || nftData.image;
      const finalImageUrl = ipfsImageUrl || openSeaImageUrl;
      
      console.log('🖼️ Image URL selection:', {
        ipfs: ipfsImageUrl,
        opensea: openSeaImageUrl,
        final: finalImageUrl
      });
      
      const finalResult = {
        bookTitle: readmeData.bookTitle,
        bookAuthor: readmeData.bookAuthor,
        description: nftData.description,
        image: finalImageUrl,
        confidence: 'high' as const,
        extractionMethod: 'opensea_api',
        readmeData,
        ipfsContent: ipfsContent ? {
          hash: bookContentHash!,
          ...ipfsContent
        } : undefined
      };

      console.log('🎯 Final README metadata result:', JSON.stringify(finalResult, null, 2));
      console.log('📊 Image source used:', ipfsImageUrl ? 'IPFS' : 'OpenSea CDN');
      return finalResult;

    } catch (error) {
      console.error('OpenSea metadata extraction failed:', error);
      throw error; // Re-throw to let caller handle the error
    }
  }

  /**
   * Fetch metadata directly from Polygon contract
   * TODO: Implement actual contract metadata fetching when we have RPC access
   */
  static async fetchContractMetadata(contract: string, tokenId: string): Promise<ReadmeMetadata | null> {
    // This would require a Polygon RPC endpoint or web3 provider
    // For now, we don't have this implemented, so throw an error
    throw new Error('Direct contract metadata fetching not yet implemented');
  }

  /**
   * Main metadata extraction function
   */
  static async fetchReadmeMetadata(url: string): Promise<ReadmeMetadata | null> {
    try {
      console.log(`📚 Fetching README book metadata for: ${url}`);

      if (!this.isReadmeBook(url)) {
        return null;
      }

      const urlInfo = this.parseReadmeUrl(url);

      // Try OpenSea if we have contract and token ID
      if (urlInfo.contract && urlInfo.tokenId) {
        return await this.fetchOpenSeaMetadata(urlInfo.contract, urlInfo.tokenId);
      }

      throw new Error('Could not extract contract address and token ID from URL');

    } catch (error) {
      console.error('README metadata extraction failed:', error);
      return null;
    }
  }

  /**
   * Fetch IPFS content metadata and determine type
   */
  static async fetchIPFSMetadata(ipfsHash: string): Promise<{ 
    contentType: 'pdf' | 'html' | 'epub' | 'text'; 
    size?: number; 
    gateway: string 
  } | null> {
    for (const gateway of this.IPFS_GATEWAYS) {
      try {
        const url = `${gateway}${ipfsHash}`;
        const response = await fetch(url, { method: 'HEAD' });
        
        if (response.ok) {
          const contentType = response.headers.get('content-type') || '';
          const contentLength = response.headers.get('content-length');
          
          let type: 'pdf' | 'html' | 'epub' | 'text' = 'text';
          
          if (contentType.includes('pdf')) {
            type = 'pdf';
          } else if (contentType.includes('html')) {
            type = 'html';
          } else if (contentType.includes('epub')) {
            type = 'epub';
          }
          
          return {
            contentType: type,
            size: contentLength ? parseInt(contentLength) : undefined,
            gateway: url
          };
        }
      } catch (error) {
        console.warn(`Failed to fetch from gateway ${gateway}:`, error);
        continue;
      }
    }
    
    return null;
  }

  /**
   * Fetch actual IPFS content for rendering
   */
  static async fetchIPFSContent(ipfsHash: string): Promise<{
    content: string | ArrayBuffer;
    contentType: string;
    gateway: string;
  } | null> {
    for (const gateway of this.IPFS_GATEWAYS) {
      try {
        const url = `${gateway}${ipfsHash}`;
        const response = await fetch(url);
        
        if (response.ok) {
          const contentType = response.headers.get('content-type') || 'text/plain';
          
          // For text/html content, return as string
          if (contentType.includes('text') || contentType.includes('html')) {
            const content = await response.text();
            return { content, contentType, gateway: url };
          }
          
          // For binary content (PDF, epub), return as ArrayBuffer
          const content = await response.arrayBuffer();
          return { content, contentType, gateway: url };
        }
      } catch (error) {
        console.warn(`Failed to fetch content from gateway ${gateway}:`, error);
        continue;
      }
    }
    
    return null;
  }

  /**
   * Extract IPFS hash from various sources
   */
  static extractIPFSHash(tokenUri?: string, imageUrl?: string): string | null {
    const sources = [tokenUri, imageUrl].filter(Boolean);
    
    for (const source of sources) {
      if (source) {
        // Match IPFS hash patterns
        const ipfsMatch = source.match(/(?:ipfs:\/\/|\/ipfs\/)([a-zA-Z0-9]{46,})/);
        if (ipfsMatch) {
          return ipfsMatch[1];
        }
      }
    }
    
    return null;
  }

  /**
   * Detect README content type from URL
   */
  static detectContentType(url: string): 'README' | null {
    return this.isReadmeBook(url) ? 'README' : null;
  }

  /**
   * Generate Evermark title for README book
   */
  static generateEvermarkTitle(readmeData: ReadmeBookData): string {
    const { bookTitle, bookAuthor, chapterNumber } = readmeData;
    
    if (chapterNumber) {
      return `${bookTitle} - Chapter ${chapterNumber} by ${bookAuthor}`;
    }
    
    return `${bookTitle} by ${bookAuthor}`;
  }

  /**
   * Generate Evermark description for README book
   */
  static generateEvermarkDescription(readmeData: ReadmeBookData): string {
    const { bookTitle, bookAuthor, bookDescription, genre, publisher } = readmeData;
    
    let description = `Preserved README book: "${bookTitle}" by ${bookAuthor}`;
    
    if (genre) {
      description += ` (${genre})`;
    }
    
    if (publisher && publisher !== 'PageDAO') {
      description += `. Published by ${publisher}`;
    }
    
    if (bookDescription) {
      description += `\n\n${bookDescription}`;
    }
    
    description += '\n\nThis NFT book is permanently preserved on-chain via Evermarks.';
    
    return description;
  }
}