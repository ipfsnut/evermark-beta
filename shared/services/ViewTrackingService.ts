// shared/services/ViewTrackingService.ts
import { createClient } from '@supabase/supabase-js';

// Get environment variables - works in both Vite and Node.js contexts
const SUPABASE_URL = (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL) || 
                     (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) || 
                     '';
const SUPABASE_ANON_KEY = (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_ANON_KEY) || 
                          (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) || 
                          '';

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

const EVERMARKS_TABLE = 'beta_evermarks';

export class ViewTrackingService {
  /**
   * Increment view count for an evermark (fire-and-forget)
   */
  static async incrementViewCount(tokenId: string | number): Promise<void> {
    try {
      const { error } = await supabase.rpc('increment_view_count', {
        p_token_id: parseInt(tokenId.toString())
      });
      
      if (error) {
        // Fallback to manual update if RPC function doesn't exist
        console.warn('RPC increment_view_count failed, using fallback:', error.message);
        await this.incrementViewCountFallback(tokenId);
      } else {
        console.log(`📊 Incremented view count for evermark ${tokenId}`);
      }
    } catch (err) {
      console.error('Failed to increment view count:', err);
      // Try fallback method
      await this.incrementViewCountFallback(tokenId);
    }
  }

  /**
   * Fallback method using manual update
   */
  private static async incrementViewCountFallback(tokenId: string | number): Promise<void> {
    try {
      // First get current count
      const { data, error: fetchError } = await supabase
        .from(EVERMARKS_TABLE)
        .select('view_count')
        .eq('token_id', parseInt(tokenId.toString()))
        .single();

      if (fetchError) {
        console.error('Failed to fetch current view count:', fetchError);
        return;
      }

      // Then increment
      const { error: updateError } = await supabase
        .from(EVERMARKS_TABLE)
        .update({ 
          view_count: (data?.view_count || 0) + 1,
          updated_at: new Date().toISOString()
        })
        .eq('token_id', parseInt(tokenId.toString()));

      if (updateError) {
        console.error('Failed to update view count:', updateError);
      } else {
        console.log(`📊 Incremented view count for evermark ${tokenId} (fallback)`);
      }
    } catch (err) {
      console.error('Fallback view count increment failed:', err);
    }
  }

  /**
   * Get view count for an evermark
   */
  static async getViewCount(tokenId: string | number): Promise<number> {
    try {
      const { data, error } = await supabase
        .from(EVERMARKS_TABLE)
        .select('view_count')
        .eq('token_id', parseInt(tokenId.toString()))
        .single();

      if (error) {
        console.error('Failed to fetch view count:', error);
        return 0;
      }

      return data?.view_count || 0;
    } catch (err) {
      console.error('Failed to get view count:', err);
      return 0;
    }
  }

  /**
   * Get view counts for multiple evermarks
   */
  static async getViewCounts(tokenIds: (string | number)[]): Promise<Map<string, number>> {
    const viewCounts = new Map<string, number>();
    
    try {
      const { data, error } = await supabase
        .from(EVERMARKS_TABLE)
        .select('token_id, view_count')
        .in('token_id', tokenIds.map(id => parseInt(id.toString())));

      if (error) {
        console.error('Failed to fetch view counts:', error);
        return viewCounts;
      }

      data?.forEach(record => {
        viewCounts.set(record.token_id.toString(), record.view_count || 0);
      });

      return viewCounts;
    } catch (err) {
      console.error('Failed to get view counts:', err);
      return viewCounts;
    }
  }
}