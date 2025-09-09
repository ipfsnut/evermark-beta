#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function runMigration() {
  console.log('🚀 Running view_count column migration...\n');

  try {
    // Read the migration file
    const migrationPath = path.resolve(__dirname, '..', 'database/migrations/add_view_count_column.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Migration SQL loaded. Executing...\n');

    // Execute the migration
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: migrationSQL
    });

    if (error) {
      console.error('❌ Migration failed:', error.message);
      
      // Try executing parts of the migration manually
      console.log('🔧 Trying manual approach...\n');
      
      // Check if column exists
      const { data: columnCheck } = await supabase
        .from('information_schema.columns')
        .select('column_name')
        .eq('table_name', 'beta_evermarks')
        .eq('column_name', 'view_count');
      
      if (!columnCheck || columnCheck.length === 0) {
        console.log('Adding view_count column...');
        // Add the column manually
        const { error: addColumnError } = await supabase.rpc('exec_sql', {
          sql: 'ALTER TABLE beta_evermarks ADD COLUMN view_count INTEGER DEFAULT 0;'
        });
        
        if (addColumnError) {
          console.error('❌ Failed to add column:', addColumnError.message);
        } else {
          console.log('✅ view_count column added successfully');
        }
      }
      
      return;
    }

    console.log('✅ Migration executed successfully!');
    
    // Verify the column was created
    const { data: verifyData, error: verifyError } = await supabase
      .from('beta_evermarks')
      .select('view_count')
      .limit(1);
      
    if (verifyError) {
      console.error('❌ Verification failed:', verifyError.message);
    } else {
      console.log('✅ view_count column verified and working');
      
      // Set initial view counts to 0 for existing records
      const { error: updateError } = await supabase
        .from('beta_evermarks')
        .update({ view_count: 0 })
        .is('view_count', null);
        
      if (updateError) {
        console.log('⚠️  Could not update NULL view counts:', updateError.message);
      } else {
        console.log('✅ Set all NULL view counts to 0');
      }
    }

  } catch (err) {
    console.error('❌ Unexpected error:', err);
  }
}

// Run the migration
runMigration();