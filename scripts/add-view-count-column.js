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

async function addViewCountColumn() {
  console.log('🔧 Adding view_count column to beta_evermarks table...\n');

  try {
    // First check if the column already exists by trying to select from it
    console.log('Checking if view_count column exists...');
    const { data, error: checkError } = await supabase
      .from('beta_evermarks')
      .select('view_count')
      .limit(1);

    if (!checkError) {
      console.log('✅ view_count column already exists!');
      console.log('Setting any NULL values to 0...');
      
      // Update any NULL values to 0
      const { error: updateError } = await supabase
        .from('beta_evermarks')
        .update({ view_count: 0 })
        .is('view_count', null);
        
      if (updateError) {
        console.log('⚠️  Note: Could not update NULL values:', updateError.message);
      } else {
        console.log('✅ All NULL view counts set to 0');
      }
      return;
    }

    if (checkError && checkError.message.includes('column') && checkError.message.includes('does not exist')) {
      console.log('❌ view_count column does not exist. Manual database migration required.');
      console.log('\nTo fix this issue, you need to run the following SQL commands in your Supabase SQL editor:');
      console.log('\n' + '='.repeat(60));
      console.log('-- Add view_count column to beta_evermarks table');
      console.log('ALTER TABLE beta_evermarks ADD COLUMN view_count INTEGER DEFAULT 0;');
      console.log('');
      console.log('-- Create index for better performance');
      console.log('CREATE INDEX IF NOT EXISTS idx_beta_evermarks_view_count ON beta_evermarks(view_count);');
      console.log('');
      console.log('-- Set existing records to have view_count = 0');
      console.log('UPDATE beta_evermarks SET view_count = 0 WHERE view_count IS NULL;');
      console.log('');
      console.log('-- Create increment function');
      console.log('CREATE OR REPLACE FUNCTION increment_view_count(p_token_id INTEGER)');
      console.log('RETURNS VOID AS $$');
      console.log('BEGIN');
      console.log('    UPDATE beta_evermarks');
      console.log('    SET');
      console.log('        view_count = COALESCE(view_count, 0) + 1,');
      console.log('        updated_at = NOW()');
      console.log('    WHERE token_id = p_token_id;');
      console.log('');
      console.log('    IF NOT FOUND THEN');
      console.log('        RAISE EXCEPTION \'Evermark with token_id % not found\', p_token_id;');
      console.log('    END IF;');
      console.log('END;');
      console.log('$$ LANGUAGE plpgsql;');
      console.log('='.repeat(60));
      console.log('\nAfter running these commands, view counts should work properly.');
    } else {
      console.error('❌ Unexpected error checking for column:', checkError?.message);
    }

  } catch (err) {
    console.error('❌ Unexpected error:', err);
  }
}

// Run the check
addViewCountColumn();