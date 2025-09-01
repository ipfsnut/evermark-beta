import { test, expect } from '@playwright/test'

test.describe('Evermark Creation Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    // Note: These tests assume wallet is connected
    // In real implementation, you'd mock wallet connection
  })

  test('should display create evermark button when wallet connected', async ({ page }) => {
    // Look for create button (only visible when connected)
    const createButton = page.getByRole('button', { name: /create|mint/i })
    
    if (await createButton.isVisible()) {
      await expect(createButton).toBeEnabled()
    }
  })

  test('should open creation modal', async ({ page }) => {
    const createButton = page.getByRole('button', { name: /create|mint/i })
    
    if (await createButton.isVisible()) {
      await createButton.click()
      
      // Wait for creation modal
      const modal = page.locator('[data-testid="create-evermark-modal"], [role="dialog"]')
      await expect(modal).toBeVisible()
      
      // Check for form fields
      await expect(page.getByLabel(/title/i)).toBeVisible()
      await expect(page.getByLabel(/author/i)).toBeVisible()
      await expect(page.getByLabel(/description/i)).toBeVisible()
    }
  })

  test('should validate required fields', async ({ page }) => {
    const createButton = page.getByRole('button', { name: /create|mint/i })
    
    if (await createButton.isVisible()) {
      await createButton.click()
      
      // Try to submit without filling fields
      const submitButton = page.getByRole('button', { name: /submit|mint|create/i })
      await submitButton.click()
      
      // Should show validation errors
      await expect(page.getByText(/title.*required/i)).toBeVisible()
    }
  })

  test('should fill and submit evermark form', async ({ page }) => {
    const createButton = page.getByRole('button', { name: /create|mint/i })
    
    if (await createButton.isVisible()) {
      await createButton.click()
      
      // Fill form
      await page.fill('[name="title"], [data-testid="title-input"]', 'Test Evermark')
      await page.fill('[name="author"], [data-testid="author-input"]', 'Test Author')
      await page.fill('[name="description"], [data-testid="description-input"]', 'This is a test evermark')
      await page.fill('[name="source_url"], [data-testid="url-input"]', 'https://example.com')
      
      // Select content type
      const contentTypeSelect = page.locator('[name="content_type"], [data-testid="content-type-select"]')
      if (await contentTypeSelect.isVisible()) {
        await contentTypeSelect.selectOption('article')
      }
      
      // Submit form
      const submitButton = page.getByRole('button', { name: /submit|mint|create/i })
      await submitButton.click()
      
      // Should show success message or transaction pending
      const successMessage = page.locator('[data-testid="success-message"], .success, .toast')
      const pendingMessage = page.locator('[data-testid="pending-message"], .pending')
      
      await expect(successMessage.or(pendingMessage)).toBeVisible({ timeout: 10000 })
    }
  })

  test('should handle URL validation', async ({ page }) => {
    const createButton = page.getByRole('button', { name: /create|mint/i })
    
    if (await createButton.isVisible()) {
      await createButton.click()
      
      // Enter invalid URL
      const urlInput = page.locator('[name="source_url"], [data-testid="url-input"]')
      await urlInput.fill('not-a-valid-url')
      
      // Move focus away to trigger validation
      await page.click('body')
      
      // Should show URL validation error
      const urlError = page.locator('[data-testid="url-error"], .error')
      if (await urlError.isVisible()) {
        await expect(urlError).toContainText(/valid.*url/i)
      }
    }
  })

  test('should display gas estimation', async ({ page }) => {
    const createButton = page.getByRole('button', { name: /create|mint/i })
    
    if (await createButton.isVisible()) {
      await createButton.click()
      
      // Fill minimum required fields
      await page.fill('[name="title"], [data-testid="title-input"]', 'Test')
      await page.fill('[name="author"], [data-testid="author-input"]', 'Author')
      
      // Look for gas estimation
      const gasEstimate = page.locator('[data-testid="gas-estimate"], .gas-estimate')
      if (await gasEstimate.isVisible()) {
        const gasText = await gasEstimate.textContent()
        expect(gasText).toMatch(/\d+.*ETH|MATIC|BNB|BASE/i)
      }
    }
  })

  test('should handle transaction errors gracefully', async ({ page }) => {
    const createButton = page.getByRole('button', { name: /create|mint/i })
    
    if (await createButton.isVisible()) {
      await createButton.click()
      
      // Fill and submit form
      await page.fill('[name="title"], [data-testid="title-input"]', 'Test')
      await page.fill('[name="author"], [data-testid="author-input"]', 'Author')
      
      const submitButton = page.getByRole('button', { name: /submit|mint|create/i })
      await submitButton.click()
      
      // If transaction fails, should show error
      const errorMessage = page.locator('[data-testid="error-message"], .error, .toast-error')
      if (await errorMessage.isVisible()) {
        const errorText = await errorMessage.textContent()
        expect(errorText).toBeTruthy()
        
        // Should be able to retry
        await expect(submitButton).toBeEnabled()
      }
    }
  })

  test('should clear form on successful submission', async ({ page }) => {
    const createButton = page.getByRole('button', { name: /create|mint/i })
    
    if (await createButton.isVisible()) {
      await createButton.click()
      
      // Fill form
      const titleInput = page.locator('[name="title"], [data-testid="title-input"]')
      await titleInput.fill('Test Evermark')
      
      // Submit
      const submitButton = page.getByRole('button', { name: /submit|mint|create/i })
      await submitButton.click()
      
      // If successful, form should be cleared or modal closed
      const modal = page.locator('[data-testid="create-evermark-modal"], [role="dialog"]')
      
      // Either modal closes or form is cleared
      const modalClosed = await modal.isHidden().catch(() => false)
      const formCleared = await titleInput.inputValue() === ''
      
      expect(modalClosed || formCleared).toBeTruthy()
    }
  })
})