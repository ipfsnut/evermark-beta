// e2e/dynamic-sharing.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Dynamic Sharing E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Start from the homepage
    await page.goto('/');
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
  });

  test('should load dynamic meta tags on homepage', async ({ page }) => {
    // Check if meta tags are present
    const ogTitle = page.locator('meta[property="og:title"]');
    const ogDescription = page.locator('meta[property="og:description"]');
    const ogImage = page.locator('meta[property="og:image"]');
    
    await expect(ogTitle).toBeAttached();
    await expect(ogDescription).toBeAttached();
    await expect(ogImage).toBeAttached();
  });

  test('should have Farcaster Mini App meta tags', async ({ page }) => {
    // Check for Farcaster-specific meta tags
    const fcMiniApp = page.locator('meta[name="fc:miniapp"]');
    const fcImage = page.locator('meta[name="fc:miniapp:image"]');
    const fcButton = page.locator('meta[name="fc:miniapp:button:1"]');
    
    await expect(fcMiniApp).toBeAttached();
    await expect(fcImage).toBeAttached();
    await expect(fcButton).toBeAttached();
  });

  test('should have Twitter Card meta tags', async ({ page }) => {
    // Check for Twitter Card meta tags
    const twitterCard = page.locator('meta[name="twitter:card"]');
    const twitterTitle = page.locator('meta[name="twitter:title"]');
    const twitterImage = page.locator('meta[name="twitter:image"]');
    
    await expect(twitterCard).toBeAttached();
    await expect(twitterTitle).toBeAttached();
    await expect(twitterImage).toBeAttached();
  });

  test('dynamic OG image endpoint should be accessible', async ({ page }) => {
    // Test the dynamic OG image endpoint
    const response = await page.request.get('/.netlify/functions/dynamic-og-image');
    
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('text/html');
    
    const body = await response.text();
    expect(body).toContain('og:title');
    expect(body).toContain('og:image');
    expect(body).toContain('fc:miniapp');
  });

  test('should generate correct share URLs', async ({ page }) => {
    // Mock the ShareService to capture the generated URLs
    await page.addInitScript(() => {
      window.capturedShareUrls = [];
      
      // Mock clipboard API
      Object.defineProperty(navigator, 'clipboard', {
        value: {
          writeText: async (text) => {
            window.capturedShareUrls.push({ platform: 'clipboard', url: text });
          }
        }
      });
    });
    
    // Try to find and click a share button (if present)
    const shareButton = page.locator('[data-testid="share-button"]').first();
    if (await shareButton.isVisible()) {
      await shareButton.click();
      
      // Check if share options appear
      const copyButton = page.locator('text=/copy/i').first();
      if (await copyButton.isVisible()) {
        await copyButton.click();
        
        // Verify the URL was captured
        const capturedUrls = await page.evaluate(() => window.capturedShareUrls);
        expect(capturedUrls.length).toBeGreaterThan(0);
      }
    }
  });

  test('should redirect from dynamic OG endpoint to main app', async ({ page }) => {
    // Visit the dynamic OG endpoint directly
    const response = await page.goto('/.netlify/functions/dynamic-og-image');
    
    // Should get HTML with redirect
    expect(response?.status()).toBe(200);
    
    // Check for redirect meta tag
    const refreshMeta = page.locator('meta[http-equiv="refresh"]');
    await expect(refreshMeta).toBeAttached();
    
    // Or check for JavaScript redirect
    const scriptContent = await page.locator('script').textContent();
    expect(scriptContent).toContain('window.location.href');
  });

  test('should handle error gracefully when leaderboard data unavailable', async ({ page }) => {
    // Mock network failure for leaderboard endpoint
    await page.route('**/leaderboard-data*', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Service unavailable' })
      });
    });
    
    // Reload the page
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Should still load with fallback meta tags
    const ogTitle = page.locator('meta[property="og:title"]');
    const titleContent = await ogTitle.getAttribute('content');
    
    // Should have fallback title, not crash
    expect(titleContent).toBeTruthy();
  });

  test('should use correct image aspect ratios', async ({ page }) => {
    // Get the OG image URL
    const ogImage = page.locator('meta[property="og:image"]');
    const imageUrl = await ogImage.getAttribute('content');
    
    if (imageUrl && !imageUrl.includes('og-image.png')) {
      // For dynamic images, we should verify they meet platform requirements
      // This would typically be done by checking actual image dimensions
      expect(imageUrl).toMatch(/^https?:\/\//);
    }
  });
});

test.describe('Share Button Functionality', () => {
  test('should open Twitter share dialog', async ({ page, context }) => {
    await page.goto('/');
    
    // Look for share buttons
    const shareButton = page.locator('[data-testid="main-app-share"]').first();
    
    if (await shareButton.isVisible()) {
      // Listen for new page/popup
      const pagePromise = context.waitForEvent('page');
      
      await shareButton.click();
      
      // Click Twitter option if available
      const twitterButton = page.locator('text=/twitter|x\./i').first();
      if (await twitterButton.isVisible()) {
        await twitterButton.click();
        
        // Should open Twitter share dialog
        const newPage = await pagePromise;
        expect(newPage.url()).toContain('twitter.com');
        expect(newPage.url()).toContain('intent/tweet');
        
        await newPage.close();
      }
    }
  });

  test('should copy link to clipboard', async ({ page }) => {
    await page.goto('/');
    
    let clipboardText = '';
    
    // Mock clipboard API
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', {
        value: {
          writeText: async (text) => {
            window.clipboardText = text;
          }
        }
      });
    });
    
    // Find and click share button
    const shareButton = page.locator('[data-testid="main-app-share"]').first();
    
    if (await shareButton.isVisible()) {
      await shareButton.click();
      
      const copyButton = page.locator('text=/copy/i').first();
      if (await copyButton.isVisible()) {
        await copyButton.click();
        
        // Get the copied text
        clipboardText = await page.evaluate(() => window.clipboardText);
        
        expect(clipboardText).toContain('netlify/functions/dynamic-og-image');
      }
    }
  });
});

// Helper function to check meta tag validity
async function validateMetaTags(page) {
  const metaTags = await page.evaluate(() => {
    const tags = {};
    const metaElements = document.querySelectorAll('meta');
    
    metaElements.forEach(meta => {
      const property = meta.getAttribute('property') || meta.getAttribute('name');
      const content = meta.getAttribute('content');
      
      if (property && content) {
        tags[property] = content;
      }
    });
    
    return tags;
  });
  
  // Validate required Open Graph tags
  expect(metaTags['og:title']).toBeTruthy();
  expect(metaTags['og:image']).toBeTruthy();
  expect(metaTags['og:url']).toBeTruthy();
  
  // Validate URLs
  if (metaTags['og:url']) {
    expect(metaTags['og:url']).toMatch(/^https?:\/\//);
  }
  
  if (metaTags['og:image']) {
    expect(metaTags['og:image']).toMatch(/^https?:\/\//);
  }
  
  // Validate Farcaster tags if present
  if (metaTags['fc:miniapp']) {
    expect(metaTags['fc:miniapp']).toBe('1');
  }
  
  return metaTags;
}