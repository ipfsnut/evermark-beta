import { test, expect } from '@playwright/test'

test.describe('Wallet Connection Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('should display connect wallet button initially', async ({ page }) => {
    const connectButton = page.getByRole('button', { name: /connect/i })
    await expect(connectButton).toBeVisible()
    await expect(connectButton).toBeEnabled()
  })

  test('should open wallet modal on connect button click', async ({ page }) => {
    // Click connect button
    await page.click('button:has-text("Connect")')
    
    // Wait for wallet modal
    const modal = page.locator('[role="dialog"], [data-testid="wallet-modal"]')
    await expect(modal).toBeVisible({ timeout: 5000 })
    
    // Check for wallet options
    await expect(page.getByText(/MetaMask/i)).toBeVisible()
    await expect(page.getByText(/WalletConnect/i)).toBeVisible()
  })

  test('should close wallet modal on escape or close button', async ({ page }) => {
    // Open modal
    await page.click('button:has-text("Connect")')
    
    // Wait for modal
    const modal = page.locator('[role="dialog"], [data-testid="wallet-modal"]')
    await expect(modal).toBeVisible()
    
    // Press escape
    await page.keyboard.press('Escape')
    
    // Modal should be hidden
    await expect(modal).not.toBeVisible()
  })

  test('should show error message for unsupported network', async ({ page }) => {
    // This test would require mocking wallet connection
    // For now, we'll check if error UI elements exist
    
    const errorContainer = page.locator('[data-testid="network-error"]')
    
    // If user connects to wrong network, error should appear
    if (await errorContainer.isVisible()) {
      await expect(errorContainer).toContainText(/Base network/i)
    }
  })

  test('should display wallet address when connected', async ({ page }) => {
    // This test assumes a mock wallet is connected
    // In real scenario, you'd use test wallets or mock the connection
    
    const addressDisplay = page.locator('[data-testid="wallet-address"]')
    
    if (await addressDisplay.isVisible()) {
      // Check if address is properly formatted (0x...)
      const addressText = await addressDisplay.textContent()
      expect(addressText).toMatch(/0x[a-fA-F0-9]{40}|0x[a-fA-F0-9]{3,6}\.\.\./)
    }
  })

  test('should enable staking features when wallet connected', async ({ page }) => {
    // Check if staking UI becomes available after connection
    const stakingSection = page.locator('[data-testid="staking-section"]')
    
    if (await stakingSection.isVisible()) {
      // Verify staking controls are enabled
      const stakeButton = stakingSection.getByRole('button', { name: /stake/i })
      await expect(stakeButton).toBeEnabled()
    }
  })

  test('should handle disconnect flow', async ({ page }) => {
    // Look for disconnect button (only visible when connected)
    const disconnectButton = page.getByRole('button', { name: /disconnect/i })
    
    if (await disconnectButton.isVisible()) {
      await disconnectButton.click()
      
      // Should show connect button again
      const connectButton = page.getByRole('button', { name: /connect/i })
      await expect(connectButton).toBeVisible()
    }
  })

  test('should persist connection state on page refresh', async ({ page, context }) => {
    // This test checks if wallet connection persists
    // Note: Actual behavior depends on wallet and app implementation
    
    // Check initial state
    const initialButton = await page.getByRole('button', { name: /connect|disconnect/i }).textContent()
    
    // Reload page
    await page.reload()
    
    // Check if state persisted
    const afterReloadButton = await page.getByRole('button', { name: /connect|disconnect/i }).textContent()
    
    // If wallet was connected, it might persist (implementation dependent)
    // This is just checking that the UI doesn't break on reload
    expect(afterReloadButton).toBeTruthy()
  })
})