// Marketplace types for Evermark NFT trading

export interface MarketplaceListing {
  listingId: string;
  tokenId: string;
  seller: string;
  price: string; // In ETH, as string to avoid precision issues
  currency: string; // Contract address of payment token
  startTime: number;
  endTime: number;
  isActive: boolean;
  listingType: 'direct' | 'auction';
}

export interface MarketplaceSale {
  saleId: string;
  listingId: string;
  tokenId: string;
  seller: string;
  buyer: string;
  price: string;
  currency: string;
  timestamp: number;
  transactionHash: string;
}

export interface MarketplaceStats {
  totalVolume: string;
  totalSales: number;
  averagePrice: string;
  floorPrice: string;
  activeListings: number;
}

export interface MarketplaceFilter {
  priceMin?: string;
  priceMax?: string;
  listingType?: 'direct' | 'auction' | 'all';
  sortBy?: 'price_asc' | 'price_desc' | 'newest' | 'oldest';
}

export type MarketplaceTab = 'browse' | 'my-listings' | 'my-purchases' | 'activity';