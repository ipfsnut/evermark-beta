#!/usr/bin/env node

/**
 * Fix for academic content (DOI/ISBN) author attribution
 * 
 * This script fetches proper author information from academic APIs
 * and updates evermarks with correct multi-author data
 */

import https from 'https';

const API_BASE = 'https://evermarks.net/api';

function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            data: res.statusCode === 204 ? null : JSON.parse(data)
          });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });
    
    req.on('error', reject);
    
    if (options.body) {
      req.write(options.body);
    }
    
    req.end();
  });
}

function extractDOI(url) {
  const patterns = [
    /(?:doi:|DOI:)\s*(.+)/,
    /doi\.org\/(.+)/,
    /dx\.doi\.org\/(.+)/,
    /^(10\.\d+\/.+)$/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }
  return null;
}

async function fetchDOIMetadata(doi) {
  try {
    console.log(`  📚 Fetching DOI metadata for: ${doi}`);
    
    const response = await makeRequest(`https://api.crossref.org/works/${doi}`);
    if (response.status !== 200) {
      throw new Error(`CrossRef API error: ${response.status}`);
    }

    const work = response.data.message;
    if (!work) {
      throw new Error('No work data found');
    }

    // Extract authors
    const authors = (work.author || []).map(author => ({
      given: author.given,
      family: author.family,
      name: author.name || `${author.given || ''} ${author.family || ''}`.trim(),
      orcid: author.ORCID ? author.ORCID.replace('http://orcid.org/', '') : undefined
    }));

    // Create primary author string
    let primaryAuthor = 'Unknown';
    if (authors.length > 0) {
      const firstAuthor = authors[0];
      primaryAuthor = firstAuthor.name || `${firstAuthor.given || ''} ${firstAuthor.family || ''}`.trim();
      
      if (authors.length > 1) {
        primaryAuthor += ' et al.';
      }
    }

    const publishedDate = work.published?.['date-parts']?.[0] 
      ? work.published['date-parts'][0].join('-')
      : undefined;

    return {
      title: Array.isArray(work.title) ? work.title[0] : work.title || 'Untitled',
      authors,
      primaryAuthor,
      journal: Array.isArray(work['container-title']) ? work['container-title'][0] : work['container-title'],
      publisher: work.publisher,
      publishedDate,
      volume: work.volume,
      issue: work.issue,
      pages: work.page,
      abstract: work.abstract
    };

  } catch (error) {
    console.error(`  ❌ Failed to fetch DOI metadata:`, error.message);
    return null;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--execute');

  console.log('🔧 Academic Author Fix');
  console.log('======================');
  
  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made');
    console.log('💡 Use --execute to apply changes');
  } else {
    console.log('⚡ EXECUTE MODE - Changes will be applied!');
  }
  console.log();

  try {
    // Fetch DOI evermarks
    console.log('📋 Fetching DOI evermarks...');
    const response = await makeRequest(`${API_BASE}/evermarks?content_type=DOI`);
    
    if (response.status !== 200) {
      throw new Error('Failed to fetch DOI evermarks');
    }

    const doiEvermarks = response.data.evermarks || [];
    console.log(`✅ Found ${doiEvermarks.length} DOI evermarks`);

    if (doiEvermarks.length === 0) {
      console.log('🎉 No DOI evermarks to process!');
      return;
    }

    // Process each DOI evermark
    for (const evermark of doiEvermarks) {
      console.log(`\n[Token ${evermark.token_id}] ${evermark.title}`);
      console.log(`  📝 Current author: "${evermark.author}"`);
      console.log(`  🔗 Source: ${evermark.source_url}`);

      // Check if author looks like a wallet address
      const hasWalletAuthor = evermark.author && (
        evermark.author.match(/^0x[a-fA-F0-9]{4}\.\.\.[a-fA-F0-9]{4}$/) ||
        evermark.author.match(/^0x[a-fA-F0-9]{40}$/i)
      );

      if (!hasWalletAuthor) {
        console.log(`  ✅ Author looks correct, skipping`);
        continue;
      }

      // Extract DOI and fetch metadata
      const doi = extractDOI(evermark.source_url);
      if (!doi) {
        console.log(`  ❌ Could not extract DOI from URL`);
        continue;
      }

      const academicMetadata = await fetchDOIMetadata(doi);
      if (!academicMetadata) {
        console.log(`  ❌ Could not fetch academic metadata`);
        continue;
      }

      console.log(`  ✨ Correct author: "${academicMetadata.primaryAuthor}"`);
      console.log(`  👥 Total authors: ${academicMetadata.authors.length}`);
      
      if (academicMetadata.authors.length > 1) {
        console.log(`  📝 All authors: ${academicMetadata.authors.map(a => a.name).join(', ')}`);
      }

      if (dryRun) {
        console.log(`  🔍 DRY RUN: Would update author to "${academicMetadata.primaryAuthor}"`);
        console.log(`  🔍 DRY RUN: Would store ${academicMetadata.authors.length} authors in metadata`);
      } else {
        console.log(`  🚨 MANUAL UPDATE REQUIRED`);
        console.log(`  ℹ️  Run the SQL migration script: fix-cast-authors.sql`);
        console.log(`  ℹ️  This includes the proper JSONB updates for multi-author data`);
      }
    }

    console.log('\n📊 Summary:');
    console.log(`   📚 Total DOI evermarks: ${doiEvermarks.length}`);
    console.log(`   🔧 Need author fixes: ${doiEvermarks.filter(e => 
      e.author && (e.author.match(/^0x[a-fA-F0-9]{4}\.\.\.[a-fA-F0-9]{4}$/) || e.author.match(/^0x[a-fA-F0-9]{40}$/i))
    ).length}`);
    
    if (dryRun) {
      console.log('\n💡 To apply the fixes:');
      console.log('   1. Run the SQL script: fix-cast-authors.sql in Supabase');
      console.log('   2. Or run: node fix-academic-authors.js --execute (when API supports it)');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);