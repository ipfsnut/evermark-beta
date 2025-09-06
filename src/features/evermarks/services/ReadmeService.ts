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
      
      if (!result.success) {
        throw new Error(`Server returned error: ${result.error}`);
      }

      const data = result.data;
      
      // Extract book-specific metadata from OpenSea attributes
      const attributes = data.traits || [];
      const getAttributeValue = (traitType: string) => {
        const attr = attributes.find((a: any) => 
          a.trait_type?.toLowerCase() === traitType.toLowerCase()
        );
        return attr?.value;
      };

      const readmeData: ReadmeBookData = {
        bookTitle: data.name || 'Untitled Book',
        bookAuthor: getAttributeValue('Author') || data.creator?.user?.username || 'Unknown Author',
        polygonContract: contract,
        polygonTokenId: tokenId,
        bookDescription: data.description,
        isbn: getAttributeValue('ISBN'),
        publicationDate: getAttributeValue('Publication Date'),
        chapterNumber: getAttributeValue('Chapter') ? parseInt(getAttributeValue('Chapter')) : undefined,
        totalChapters: getAttributeValue('Total Chapters') ? parseInt(getAttributeValue('Total Chapters')) : undefined,
        genre: getAttributeValue('Genre'),
        language: getAttributeValue('Language'),
        publisher: getAttributeValue('Publisher') || 'PageDAO',
        pageCount: getAttributeValue('Pages') ? parseInt(getAttributeValue('Pages')) : undefined,
        tokenGated: getAttributeValue('Token Gated') === 'true',
        marketplaceUrl: data.permalink,
        currentOwner: data.owner?.address,
        mintDate: data.asset_contract?.created_date,
        royaltyPercentage: data.asset_contract?.seller_fee_basis_points ? 
          data.asset_contract.seller_fee_basis_points / 100 : undefined
      };

      // Try to extract IPFS hash from token URI or image
      const ipfsHash = this.extractIPFSHash(data.token_uri, data.image_url);
      if (ipfsHash) {
        readmeData.ipfsHash = ipfsHash;
      }

      // Fetch IPFS content metadata if we have a hash
      let ipfsContent;
      if (ipfsHash) {
        ipfsContent = await this.fetchIPFSMetadata(ipfsHash);
      }

      return {
        bookTitle: readmeData.bookTitle,
        bookAuthor: readmeData.bookAuthor,
        description: data.description,
        image: data.image_url,
        confidence: 'high',
        extractionMethod: 'opensea_api',
        readmeData,
        ipfsContent: ipfsContent ? {
          hash: ipfsHash!,
          ...ipfsContent
        } : undefined
      };

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