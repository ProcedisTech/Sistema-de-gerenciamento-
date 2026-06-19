import { test, expect } from '@playwright/test';

test.describe('Procedi Login/Landing View', () => {
  test('should load the login page successfully', async ({ page }) => {
    // Mock the backend API checks to prevent connection failure screens
    await page.route('**/api/auth/me', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Unauthorized' }),
      });
    });

    // Navigate to the local Vite application server
    await page.goto('/');

    // Check that the title "Procedi" is visible
    await expect(page.locator('h1')).toContainText('Procedi');

    // Check that the system description is visible
    await expect(page.locator('text=Sistema de Gerenciamento Premium')).toBeVisible();

    // Check that the login button is available
    const loginBtn = page.locator('button:has-text("Entrar no Sistema")');
    await expect(loginBtn).toBeVisible();
  });
});
