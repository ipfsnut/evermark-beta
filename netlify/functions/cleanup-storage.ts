import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase with secret key for storage access
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

export const handler: Handler = async (event, context) => {
  console.log('🧹 Storage cleanup started');

  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const action = body.action || 'list'; // list, delete, or deleteRange

    if (action === 'list') {
      // List all files in the evermark-images bucket
      const { data: files, error } = await supabase.storage
        .from('evermark-images')
        .list('evermarks', {
          limit: 100,
          offset: 0
        });

      if (error) {
        throw new Error(`Failed to list files: ${error.message}`);
      }

      console.log(`📁 Found ${files?.length || 0} files in storage`);
      
      // Sort files by name to get them in order
      const sortedFiles = (files || []).sort((a, b) => {
        const numA = parseInt(a.name.replace('.jpg', ''));
        const numB = parseInt(b.name.replace('.jpg', ''));
        return numA - numB;
      });

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          action: 'list',
          totalFiles: sortedFiles.length,
          files: sortedFiles.map((file, index) => ({
            index: index + 1,
            name: file.name,
            size: file.metadata?.size,
            lastModified: file.updated_at
          }))
        })
      };
    }

    if (action === 'clearUrls') {
      const tokenIds = body.tokenIds as number[] || [];
      
      if (tokenIds.length === 0) {
        throw new Error('No tokenIds provided');
      }

      console.log(`🔄 Clearing supabase_image_url for tokens: ${tokenIds.join(', ')}`);

      let updated = 0;
      let errors: string[] = [];

      for (const tokenId of tokenIds) {
        try {
          const { error: updateError } = await supabase
            .from('beta_evermarks')
            .update({ 
              supabase_image_url: null,
              updated_at: new Date().toISOString()
            })
            .eq('token_id', tokenId);

          if (updateError) {
            errors.push(`Token ${tokenId}: ${updateError.message}`);
          } else {
            updated++;
            console.log(`✅ Cleared URL for token ${tokenId}`);
          }
        } catch (error) {
          errors.push(`Token ${tokenId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          action: 'clearUrls',
          updated,
          errors,
          totalRequested: tokenIds.length
        })
      };
    }

    if (action === 'deleteRange') {
      const startIndex = body.startIndex || 1;
      const endIndex = body.endIndex || 44;

      console.log(`🗑️ Deleting files from index ${startIndex} to ${endIndex}`);

      // First, list files to get their names
      const { data: files, error: listError } = await supabase.storage
        .from('evermark-images')
        .list('evermarks', {
          limit: 100,
          offset: 0
        });

      if (listError) {
        throw new Error(`Failed to list files: ${listError.message}`);
      }

      // Sort files by name
      const sortedFiles = (files || []).sort((a, b) => {
        const numA = parseInt(a.name.replace('.jpg', ''));
        const numB = parseInt(b.name.replace('.jpg', ''));
        return numA - numB;
      });

      // Get files to delete (convert 1-based index to 0-based)
      const filesToDelete = sortedFiles.slice(startIndex - 1, endIndex);
      
      console.log(`🎯 Targeting ${filesToDelete.length} files for deletion`);

      let deleted = 0;
      let errors: string[] = [];

      for (const file of filesToDelete) {
        try {
          const { error: deleteError } = await supabase.storage
            .from('evermark-images')
            .remove([`evermarks/${file.name}`]);

          if (deleteError) {
            errors.push(`${file.name}: ${deleteError.message}`);
          } else {
            deleted++;
            console.log(`✅ Deleted ${file.name}`);
          }
        } catch (error) {
          errors.push(`${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          action: 'deleteRange',
          deleted,
          errors: errors.slice(0, 10), // Limit error list
          totalRequested: filesToDelete.length
        })
      };
    }

    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: 'Invalid action. Use "list", "clearUrls", or "deleteRange"'
      })
    };

  } catch (error) {
    console.error('❌ Storage cleanup failed:', error);
    
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};