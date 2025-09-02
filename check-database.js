// Check current database state for tokens 1-18
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function checkDatabase() {
  console.log('🔍 Checking current database state...\n');
  
  try {
    // Get all evermarks ordered by token_id
    const { data: evermarks, error } = await supabase
      .from('beta_evermarks')
      .select('token_id, title, author, content_type, created_at, tx_hash, source_url')
      .order('token_id', { ascending: true });
    
    if (error) {
      console.error('❌ Database query failed:', error);
      return;
    }
    
    console.log(`📊 Found ${evermarks.length} evermarks in database:\n`);
    
    // Display existing tokens
    evermarks.forEach(evermark => {
      console.log(`✅ Token ${evermark.token_id}: "${evermark.title}" by ${evermark.author} (${evermark.content_type})`);
    });
    
    // Check for missing tokens 1-18
    console.log('\n🔍 Checking for missing tokens 1-18:\n');
    
    const existingTokenIds = new Set(evermarks.map(e => e.token_id));
    const missing = [];
    
    for (let i = 1; i <= 18; i++) {
      if (!existingTokenIds.has(i)) {
        missing.push(i);
        console.log(`❌ Missing Token ${i}`);
      }
    }
    
    if (missing.length === 0) {
      console.log('✅ No missing tokens found!');
    } else {
      console.log(`\n📋 Summary: ${missing.length} missing tokens: [${missing.join(', ')}]`);
    }
    
    // Check database schema by looking at one record
    if (evermarks.length > 0) {
      console.log('\n🗄️ Checking database schema...');
      
      const { data: fullRecord, error: schemaError } = await supabase
        .from('beta_evermarks')
        .select('*')
        .eq('token_id', evermarks[0].token_id)
        .single();
      
      if (schemaError) {
        console.error('❌ Schema check failed:', schemaError);
      } else {
        console.log('\n📋 Available database columns:');
        Object.keys(fullRecord).forEach(column => {
          console.log(`  - ${column}: ${typeof fullRecord[column]} ${fullRecord[column] === null ? '(NULL)' : ''}`);
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Database check failed:', error);
  }
}

checkDatabase();