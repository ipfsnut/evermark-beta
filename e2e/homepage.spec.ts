import { test, expect } from '@playwright/test'

test.describe('Homepage', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('should display the main title', async ({ page }) => {
    await expect(page).toHaveTitle(/Evermark/)
    
    // Check for main heading
    const heading = page.getByRole('heading', { level: 1 })
    await expect(heading).toBeVisible()
  })

  test('should have navigation elements', async ({ page }) => {
    // Check for main navigation
    const nav = page.getByRole('navigation')
    await expect(nav).toBeVisible()
    
    // Check for important links
    await expect(page.getByText(/Evermarks/i)).toBeVisible()
    await expect(page.getByText(/Leaderboard/i)).toBeVisible()
  })

  test('should display connect wallet button when not connected', async ({ page }) => {
    const connectButton = page.getByRole('button', { name: /connect/i })
    await expect(connectButton).toBeVisible()
  })

  test('should show evermarks grid', async ({ page }) => {
    // Wait for content to load
    await page.waitForSelector('[data-testid="evermarks-grid"]', { 
      timeout: 10000,
      state: 'visible' 
    })
    
    const evermarksGrid = page.locator('[data-testid="evermarks-grid"]')
    await expect(evermarksGrid).toBeVisible()
  })

  test('should navigate to leaderboard page', async ({ page }) => {
    await page.click('text=/Leaderboard/i')
    await expect(page).toHaveURL(/.*leaderboard/)
    
    // Verify leaderboard content loaded
    const leaderboardTitle = page.getByRole('heading', { name: /leaderboard/i })
    await expect(leaderboardTitle).toBeVisible()
  })

  test('should handle mobile menu toggle', async ({ page, isMobile }) => {
    if (isMobile) {
      // Look for hamburger menu
      const menuButton = page.getByRole('button', { name: /menu/i })
      await expect(menuButton).toBeVisible()
      
      // Click to open
      await menuButton.click()
      
      // Check mobile menu is visible
      const mobileMenu = page.locator('[data-testid="mobile-menu"]')
      await expect(mobileMenu).toBeVisible()
    }
  })

  test('should display footer with links', async ({ page }) => {
    const footer = page.getByRole('contentinfo')
    await expect(footer).toBeVisible()
    
    // Check for social links or important footer content
    await expect(footer.getByText(/2024/)).toBeVisible()
  })
})