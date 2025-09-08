// scripts/set-initial-view-counts.js
// Quick script to add some initial view counts for testing

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const EVERMARKS_TABLE = 'beta_evermarks';

async function setInitialViewCounts() {
  try {
    console.log('🚀 Setting initial view counts for testing...');
    
    // First, check if view_count column exists
    const { data: evermarks, error } = await supabase
      .from(EVERMARKS_TABLE)
      .select('token_id, title')
      .limit(10);
      
    if (error) {
      console.error('❌ Error fetching evermarks:', error);
      return;
    }
    
    console.log(`📊 Found ${evermarks.length} evermarks to update`);
    
    // Set random view counts between 1-50 for each evermark
    for (const evermark of evermarks) {
      const randomViews = Math.floor(Math.random() * 50) + 1;
      
      const { error: updateError } = await supabase
        .from(EVERMARKS_TABLE)
        .update({ 
          view_count: randomViews,
          updated_at: new Date().toISOString()
        })
        .eq('token_id', evermark.token_id);
        
      if (updateError) {
        console.error(`❌ Error updating token ${evermark.token_id}:`, updateError);
      } else {
        console.log(`✅ Set ${randomViews} views for "${evermark.title.substring(0, 30)}..."`);
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log('🎉 Initial view counts set successfully!');
    
  } catch (error) {
    console.error('💥 Script failed:', error);
  }
}

setInitialViewCounts();