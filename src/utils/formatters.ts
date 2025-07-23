import { formatDistanceToNow, format, parseISO } from 'date-fns';

export class Formatters {
  /**
   * Format view count for display
   */
  static formatCount(count: number): string {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    } else if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
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
   * Format token amount with proper decimals
   */
formatTokenAmount(amount: string | number): string {  
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(2)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(2)}K`;
    } else if (num >= 1) {
      return num.toFixed(2);
    } else {
      return num.toFixed(4);
    }
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
}