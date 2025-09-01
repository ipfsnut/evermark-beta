// Simple script to repair basic metadata for evermarks #6 and #7
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://bqzovgmaltmqzdiocnar.supabase.co',
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_ANON_KEY
);

async function repairBasicMetadata() {
  console.log('🔧 Repairing basic metadata for evermarks #6 and #7...');

  // Repair evermark #6 (DOI) - keep truncated address since no Farcaster/ENS
  const repair6 = await supabase
    .from('beta_evermarks')
    .update({
      author: '0x18A8...2A3c', // Proper truncated format
      metadata_json: JSON.stringify({
        tags: ['doi', 'academic'],
        customFields: [
          { key: 'content_type', value: 'DOI' },
          { key: 'doi', value: '10.1037/xge0001449' }
        ]
      }),
      updated_at: new Date().toISOString()
    })
    .eq('token_id', 6);

  // Repair evermark #7 (Twitter) - keep truncated address since no Farcaster/ENS
  const repair7 = await supabase
    .from('beta_evermarks')
    .update({
      author: '0x58e5...5AfA', // Proper truncated format
      metadata_json: JSON.stringify({
        tags: ['twitter', 'social'],
        customFields: [
          { key: 'content_type', value: 'URL' },
          { key: 'platform', value: 'Twitter/X' }
        ]
      }),
      updated_at: new Date().toISOString()
    })
    .eq('token_id', 7);

  console.log('✅ Repair results:');
  console.log('Evermark #6:', repair6.error || 'Success');
  console.log('Evermark #7:', repair7.error || 'Success');
}

repairBasicMetadata().catch(console.error);