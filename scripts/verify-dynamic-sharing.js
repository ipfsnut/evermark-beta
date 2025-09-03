#!/usr/bin/env node

// scripts/verify-dynamic-sharing.js
// Verification script for dynamic sharing URLs and configuration

// Use console colors without chalk for ES module compatibility
const colors = {
  blue: (text) => `\x1b[34m${text}\x1b[0m`,
  green: (text) => `\x1b[32m${text}\x1b[0m`,
  yellow: (text) => `\x1b[33m${text}\x1b[0m`,
  red: (text) => `\x1b[31m${text}\x1b[0m`,
  cyan: (text) => `\x1b[36m${text}\x1b[0m`,
  gray: (text) => `\x1b[90m${text}\x1b[0m`
};

console.log(colors.blue('\n🔍 Verifying Dynamic Sharing Configuration\n'));

// Configuration to verify
const environments = {
  local: {
    name: 'Local Development',
    baseUrl: 'http://localhost:8888',
    expectedEndpoints: {
      dynamicOG: '/.netlify/functions/dynamic-og-image',
      frame: '/.netlify/functions/frame',
      shares: '/.netlify/functions/shares',
      leaderboard: '/.netlify/functions/leaderboard-data'
    }
  },
  staging: {
    name: 'Staging',
    baseUrl: 'https://staging.evermarks.net',
    expectedEndpoints: {
      dynamicOG: '/.netlify/functions/dynamic-og-image',
      frame: '/.netlify/functions/frame',
      shares: '/.netlify/functions/shares',
      leaderboard: '/.netlify/functions/leaderboard-data'
    }
  },
  production: {
    name: 'Production',
    baseUrl: 'https://evermarks.net',
    expectedEndpoints: {
      dynamicOG: '/.netlify/functions/dynamic-og-image',
      frame: '/.netlify/functions/frame',
      shares: '/.netlify/functions/shares',
      leaderboard: '/.netlify/functions/leaderboard-data'
    }
  }
};

// Social platform share URLs to verify
const socialPlatforms = {
  twitter: {
    name: 'Twitter/X',
    baseUrl: 'https://twitter.com/intent/tweet',
    params: ['text', 'url', 'hashtags']
  },
  farcaster: {
    name: 'Farcaster',
    baseUrl: 'https://farcaster.xyz/~/compose',
    params: ['text']
  },
  warpcast: {
    name: 'Warpcast',
    baseUrl: 'https://warpcast.com/~/compose',
    params: ['text']
  }
};

// Meta tag requirements
const metaTagRequirements = {
  openGraph: {
    required: ['og:title', 'og:description', 'og:image', 'og:url'],
    optional: ['og:type', 'og:site_name']
  },
  twitter: {
    required: ['twitter:card'],
    optional: ['twitter:title', 'twitter:description', 'twitter:image']
  },
  farcaster: {
    required: ['fc:miniapp', 'fc:miniapp:image'],
    optional: ['fc:miniapp:button:1', 'fc:miniapp:button:1:action', 'fc:miniapp:button:1:target']
  }
};

// Image specifications
const imageSpecs = {
  farcaster: {
    minWidth: 600,
    maxWidth: 3000,
    minHeight: 400,
    maxHeight: 2000,
    aspectRatio: 1.5, // 3:2
    maxSizeMB: 10
  },
  twitter: {
    minWidth: 300,
    maxWidth: 4096,
    minHeight: 157,
    maxHeight: 4096,
    aspectRatio: 2, // 2:1 for summary_large_image
    maxSizeMB: 5
  }
};

function verifyURLStructure(env, envConfig) {
  console.log(colors.yellow(`\n📍 ${envConfig.name} Environment:`));
  console.log(`Base URL: ${colors.cyan(envConfig.baseUrl)}`);
  
  let passed = 0;
  let failed = 0;
  
  Object.entries(envConfig.expectedEndpoints).forEach(([name, endpoint]) => {
    const fullUrl = `${envConfig.baseUrl}${endpoint}`;
    
    try {
      const url = new URL(fullUrl);
      
      // Check protocol
      if (env === 'production' && url.protocol !== 'https:') {
        console.log(colors.red(`  ❌ ${name}: Must use HTTPS in production`));
        failed++;
      } else {
        console.log(colors.green(`  ✅ ${name}: ${fullUrl}`));
        passed++;
      }
    } catch (error) {
      console.log(colors.red(`  ❌ ${name}: Invalid URL - ${fullUrl}`));
      failed++;
    }
  });
  
  return { passed, failed };
}

function verifySocialPlatforms() {
  console.log(colors.yellow('\n🔗 Social Platform URLs:'));
  
  let passed = 0;
  let failed = 0;
  
  Object.entries(socialPlatforms).forEach(([key, platform]) => {
    try {
      const url = new URL(platform.baseUrl);
      
      if (url.protocol !== 'https:') {
        console.log(colors.red(`  ❌ ${platform.name}: Must use HTTPS`));
        failed++;
      } else {
        console.log(colors.green(`  ✅ ${platform.name}: ${platform.baseUrl}`));
        passed++;
      }
      
      // Check if params can be added
      const testUrl = new URL(platform.baseUrl);
      platform.params.forEach(param => {
        testUrl.searchParams.set(param, 'test');
      });
      
    } catch (error) {
      console.log(colors.red(`  ❌ ${platform.name}: Invalid URL structure`));
      failed++;
    }
  });
  
  return { passed, failed };
}

function verifyMetaTagStructure() {
  console.log(colors.yellow('\n🏷️  Meta Tag Requirements:'));
  
  let totalRequired = 0;
  let totalOptional = 0;
  
  Object.entries(metaTagRequirements).forEach(([platform, tags]) => {
    console.log(`\n  ${colors.cyan(platform.toUpperCase())}:`);
    console.log(`    Required: ${colors.green(tags.required.join(', '))}`);
    console.log(`    Optional: ${colors.gray(tags.optional.join(', '))}`);
    
    totalRequired += tags.required.length;
    totalOptional += tags.optional.length;
  });
  
  console.log(colors.blue(`\n  Total: ${totalRequired} required, ${totalOptional} optional tags`));
  
  return { required: totalRequired, optional: totalOptional };
}

function verifyImageSpecifications() {
  console.log(colors.yellow('\n🖼️  Image Specifications:'));
  
  Object.entries(imageSpecs).forEach(([platform, specs]) => {
    console.log(`\n  ${colors.cyan(platform.toUpperCase())}:`);
    console.log(`    Dimensions: ${specs.minWidth}-${specs.maxWidth} × ${specs.minHeight}-${specs.maxHeight}px`);
    console.log(`    Aspect Ratio: ${specs.aspectRatio}:1`);
    console.log(`    Max Size: ${specs.maxSizeMB}MB`);
  });
}

function generateTestURLs() {
  console.log(colors.yellow('\n🧪 Test URLs for Verification:'));
  
  const testContent = {
    title: 'Test Evermark Title',
    description: 'Test description for sharing',
    evermarkId: '123'
  };
  
  console.log('\n  Production Share URLs:');
  const prodBase = environments.production.baseUrl;
  
  // Dynamic OG endpoint
  console.log(`    ${colors.cyan('Dynamic OG')}: ${prodBase}/.netlify/functions/dynamic-og-image`);
  
  // Frame endpoint for specific evermark
  console.log(`    ${colors.cyan('Frame')}: ${prodBase}/.netlify/functions/frame/${testContent.evermarkId}`);
  
  // Twitter share
  const twitterText = encodeURIComponent(`Check out "${testContent.title}" on Evermark! ${prodBase}`);
  console.log(`    ${colors.cyan('Twitter')}: https://twitter.com/intent/tweet?text=${twitterText}`);
  
  // Farcaster share
  const farcasterText = encodeURIComponent(`Check out "${testContent.title}" on Evermark!\n\n${prodBase}/.netlify/functions/dynamic-og-image`);
  console.log(`    ${colors.cyan('Farcaster')}: https://farcaster.xyz/~/compose?text=${farcasterText}`);
}

function runVerification() {
  let totalPassed = 0;
  let totalFailed = 0;
  
  // Verify each environment
  Object.entries(environments).forEach(([env, config]) => {
    const result = verifyURLStructure(env, config);
    totalPassed += result.passed;
    totalFailed += result.failed;
  });
  
  // Verify social platforms
  const socialResult = verifySocialPlatforms();
  totalPassed += socialResult.passed;
  totalFailed += socialResult.failed;
  
  // Verify meta tags
  const metaResult = verifyMetaTagStructure();
  
  // Verify image specs
  verifyImageSpecifications();
  
  // Generate test URLs
  generateTestURLs();
  
  // Summary
  console.log(colors.blue('\n' + '='.repeat(50)));
  console.log(colors.blue('📊 Verification Summary:'));
  console.log(colors.green(`  ✅ Passed: ${totalPassed} checks`));
  if (totalFailed > 0) {
    console.log(colors.red(`  ❌ Failed: ${totalFailed} checks`));
  }
  console.log(colors.blue('='.repeat(50) + '\n'));
  
  if (totalFailed > 0) {
    console.log(colors.red('⚠️  Some checks failed. Please review the configuration.\n'));
    process.exit(1);
  } else {
    console.log(colors.green('✨ All checks passed! Dynamic sharing is ready for deployment.\n'));
  }
}

// Run verification
runVerification();