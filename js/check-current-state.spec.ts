import { test, expect } from '@playwright/test';

test('Check current state after router fix', async ({ page }) => {
  // Navigate to the application
  await page.goto('http://localhost:5174');

  // Take initial screenshot
  await page.screenshot({ 
    path: 'current-state-after-router-fix.png', 
    fullPage: true 
  });

  // Wait a moment for the application to load
  await page.waitForTimeout(2000);

  // Check for console errors - specifically router errors
  const logs: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error' || msg.type() === 'warn') {
      logs.push(`${msg.type()}: ${msg.text()}`);
    }
  });

  // Check for the specific router error we were trying to fix
  await page.waitForTimeout(3000);

  // Look for network requests to the backend API
  const networkRequests: string[] = [];
  page.on('request', request => {
    if (request.url().includes('localhost:3001')) {
      networkRequests.push(`${request.method()} ${request.url()}`);
    }
  });

  // Wait for potential API calls
  await page.waitForTimeout(3000);

  // Check if sessions are being displayed
  const sessionElements = await page.locator('[data-testid*="session"], .session-card, .session-item').count();

  // Check for loading states
  const loadingElements = await page.locator('.loading, [data-loading="true"], .spinner').count();

  // Check for error messages
  const errorElements = await page.locator('.error, [data-error], .error-message').count();

  // Log the results
  console.log('=== ROUTER FIX VERIFICATION ===');
  console.log('Console logs:', logs);
  console.log('Network requests to backend:', networkRequests);
  console.log('Session elements found:', sessionElements);
  console.log('Loading elements:', loadingElements);
  console.log('Error elements:', errorElements);

  // Check specifically for router loop errors
  const routerErrors = logs.filter(log => 
    log.includes('Route not found: /') || 
    log.includes('router') || 
    log.includes('infinite') ||
    log.includes('loop')
  );
  
  console.log('Router-related errors:', routerErrors);

  // Take final screenshot
  await page.screenshot({ 
    path: 'final-state-verification.png', 
    fullPage: true 
  });

  // Basic assertions
  expect(routerErrors.length).toBeLessThan(5); // Allow some initial router setup logs but not infinite loops
});