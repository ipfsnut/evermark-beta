#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function checkViewCounts() {
  console.log('🔍 Checking view counts in beta_evermarks table...\n');

  try {
    // Get all evermarks with their view counts
    const { data, error } = await supabase
      .from('beta_evermarks')
      .select('token_id, title, view_count')
      .order('token_id', { ascending: true });

    if (error) {
      console.error('❌ Error fetching evermarks:', error.message);
      return;
    }

    if (!data || data.length === 0) {
      console.log('No evermarks found in the database.');
      return;
    }

    // Analyze view counts
    let totalEvermarks = data.length;
    let nullCounts = 0;
    let zeroCounts = 0;
    let positiveCounts = 0;
    let maxViewCount = 0;
    let totalViews = 0;

    data.forEach(evermark => {
      if (evermark.view_count === null || evermark.view_count === undefined) {
        nullCounts++;
      } else if (evermark.view_count === 0) {
        zeroCounts++;
      } else {
        positiveCounts++;
        totalViews += evermark.view_count;
        if (evermark.view_count > maxViewCount) {
          maxViewCount = evermark.view_count;
        }
      }
    });

    // Display results
    console.log('📊 View Count Analysis:');
    console.log('------------------------');
    console.log(`Total Evermarks: ${totalEvermarks}`);
    console.log(`NULL view counts: ${nullCounts}`);
    console.log(`Zero view counts: ${zeroCounts}`);
    console.log(`Positive view counts: ${positiveCounts}`);
    console.log(`Maximum view count: ${maxViewCount}`);
    console.log(`Total views across all evermarks: ${totalViews}`);
    console.log(`Average views (positive only): ${positiveCounts > 0 ? (totalViews / positiveCounts).toFixed(2) : 0}`);
    
    // Show a sample of evermarks
    console.log('\n📋 Sample of evermarks (first 10):');
    console.log('-----------------------------------');
    data.slice(0, 10).forEach(evermark => {
      console.log(`Token #${evermark.token_id}: "${evermark.title}" - Views: ${evermark.view_count ?? 'NULL'}`);
    });

    // Fix NULL view counts if any exist
    if (nullCounts > 0) {
      console.log(`\n⚠️  Found ${nullCounts} evermarks with NULL view counts.`);
      console.log('Would you like to set them to 0? (Run with --fix flag to apply)');
      
      if (process.argv.includes('--fix')) {
        console.log('🔧 Fixing NULL view counts...');
        
        const { error: updateError } = await supabase
          .from('beta_evermarks')
          .update({ view_count: 0 })
          .is('view_count', null);
        
        if (updateError) {
          console.error('❌ Error updating NULL view counts:', updateError.message);
        } else {
          console.log('✅ Successfully set all NULL view counts to 0');
        }
      }
    }

    // Test the increment function
    console.log('\n🧪 Testing increment_view_count function...');
    const testTokenId = data[0]?.token_id;
    if (testTokenId) {
      const { error: rpcError } = await supabase.rpc('increment_view_count', {
        p_token_id: testTokenId
      });

      if (rpcError) {
        console.error('❌ RPC function test failed:', rpcError.message);
        console.log('The increment_view_count database function may not be installed.');
      } else {
        console.log(`✅ Successfully incremented view count for token #${testTokenId}`);
        
        // Verify the increment
        const { data: updatedData } = await supabase
          .from('beta_evermarks')
          .select('view_count')
          .eq('token_id', testTokenId)
          .single();
        
        if (updatedData) {
          console.log(`   New view count: ${updatedData.view_count}`);
        }
      }
    }

  } catch (err) {
    console.error('❌ Unexpected error:', err);
  }
}

// Run the check
checkViewCounts();