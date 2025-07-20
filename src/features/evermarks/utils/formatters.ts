import { formatDistanceToNow, format, parseISO } from 'date-fns';
import type { Evermark } from '../types';

export class EvermarkFormatter {
  /**
   * Format view count for display
   */
  static formatViewCount(count: number): string {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    } else if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  }

  /**
   * Format vote count for display
   */
  static formatVoteCount(count: number): string {
    return this.formatViewCount(count);
  }

  /**
   * Format content type for display
   */
  static formatContentType(contentType: Evermark['contentType']): string {
    const mapping = {
      'Cast': 'Farcaster Cast',
      'DOI': 'Academic Paper',
      'ISBN': 'Book',
      'URL': 'Web Content',
      'Custom': 'Custom Content'
    };
    return mapping[contentType] || contentType;
  }

  /**
   * Format date for display
   */
  static formatDate(date: string | Date): string {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    return format(dateObj, 'MMM d, yyyy');
  }

  /**
   * Format relative time
   */
  static formatRelativeTime(date: string | Date): string {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    return formatDistanceToNow(dateObj, { addSuffix: true });
  }

  /**
   * Format file size
   */
  static formatFileSize(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Format token ID for display
   */
  static formatTokenId(tokenId: number): string {
    return `#${tokenId.toString().padStart(4, '0')}`;
  }

  /**
   * Format IPFS hash for display
   */
  static formatIPFSHash(hash: string): string {
    if (hash.length <= 20) return hash;
    return `${hash.slice(0, 10)}...${hash.slice(-10)}`;
  }

  /**
   * Format wallet address for display
   */
  static formatAddress(address: string): string {
    if (address.length <= 20) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  /**
   * Format URL for display
   */
  static formatUrl(url: string, maxLength = 50): string {
    if (url.length <= maxLength) return url;
    
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname;
      const path = urlObj.pathname + urlObj.search;
      
      if (domain.length + path.length <= maxLength) {
        return `${domain}${path}`;
      }
      
      return `${domain}${path.slice(0, maxLength - domain.length - 3)}...`;
    } catch {
      return url.slice(0, maxLength - 3) + '...';
    }
  }

  /**
   * Format tags for display
   */
  static formatTags(tags: string[], maxDisplay = 3): { displayed: string[]; remaining: number } {
    const displayed = tags.slice(0, maxDisplay);
    const remaining = Math.max(0, tags.length - maxDisplay);
    return { displayed, remaining };
  }

  /**
   * Format evermark title for sharing
   */
  static formatShareTitle(title: string): string {
    const maxLength = 60;
    if (title.length <= maxLength) return title;
    return title.slice(0, maxLength - 3) + '...';
  }

  /**
   * Format evermark description for sharing
   */
  static formatShareDescription(description: string): string {
    const maxLength = 160;
    if (description.length <= maxLength) return description;
    return description.slice(0, maxLength - 3) + '...';
  }

  /**
   * Format duration in milliseconds to human readable
   */
  static formatDuration(milliseconds: number): string {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  /**
   * Format percentage
   */
  static formatPercentage(value: number, decimals = 1): string {
    return `${value.toFixed(decimals)}%`;
  }

  /**
   * Format currency amount
   */
  static formatCurrency(amount: number, currency = 'USD'): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  }
}

