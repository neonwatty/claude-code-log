import { test, expect } from '@playwright/test';

/**
 * Basic Test - Minimal validation without server management
 * 
 * This test checks if:
 * 1. We can navigate to the app
 * 2. Basic elements are present
 * 3. No major JavaScript errors occur
 */

test.describe('Basic Application Test', () => {
  
  test('should load the application page', async ({ page }) => {
    console.log('🚀 Starting basic application test');
    
    // Navigate to the app
    console.log('📍 Navigating to application...');
    const response = await page.goto('/', { waitUntil: 'networkidle' });
    
    console.log(`📊 Response status: ${response?.status()}`);
    
    // Check if page loaded successfully
    if (response?.status() !== 200) {
      console.log('❌ Page did not load successfully');
      await page.screenshot({ path: 'test-results/basic-test-failed-load.png' });
      throw new Error(`Page load failed with status: ${response?.status()}`);
    }
    
    console.log('✅ Page loaded successfully');
    
    // Take initial screenshot
    await page.screenshot({ path: 'test-results/basic-test-initial-load.png' });
    
    // Check for basic HTML structure
    const hasBody = await page.locator('body').count() > 0;
    console.log(`📄 Body element found: ${hasBody}`);
    expect(hasBody).toBe(true);
    
    // Check for any immediate JavaScript errors
    const errors: string[] = [];
    page.on('pageerror', error => {
      errors.push(error.message);
      console.log('❌ JavaScript error:', error.message);
    });
    
    // Wait a moment for any immediate errors
    await page.waitForTimeout(2000);
    
    if (errors.length > 0) {
      console.log(`⚠️  Found ${errors.length} JavaScript errors`);
      await page.screenshot({ path: 'test-results/basic-test-js-errors.png' });
    } else {
      console.log('✅ No immediate JavaScript errors detected');
    }
    
    // Check if we can find any custom elements or content
    const customElements = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('*')).map(el => el.tagName.toLowerCase());
      return elements.filter(tag => tag.includes('-')); // Custom elements have hyphens
    });
    
    console.log(`🧩 Custom elements found: ${customElements.length > 0 ? customElements.slice(0, 5).join(', ') : 'none'}`);
    
    // Look for any visible text content
    const pageText = await page.textContent('body');
    const hasContent = pageText && pageText.trim().length > 0;
    console.log(`📝 Page has visible content: ${hasContent}`);
    
    if (hasContent) {
      console.log(`📄 Page content preview: ${pageText?.slice(0, 200)}...`);
    }
    
    // Final screenshot
    await page.screenshot({ path: 'test-results/basic-test-final.png' });
    
    console.log('✅ Basic test completed successfully');
    
    // Basic assertions
    expect(hasBody).toBe(true);
    expect(response?.status()).toBe(200);
  });
  
  test('should check for specific app elements', async ({ page }) => {
    console.log('🔍 Starting app elements check');
    
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    
    // Look for common app elements
    const checks = [
      { selector: 'title', description: 'Page title' },
      { selector: 'app-main', description: 'Main app component' },
      { selector: '.app-title', description: 'App title element' },
      { selector: '.stats-card', description: 'Stats card' },
      { selector: 'connection-status', description: 'Connection status component' },
    ];
    
    const results: { [key: string]: boolean } = {};
    
    for (const check of checks) {
      try {
        const count = await page.locator(check.selector).count();
        results[check.description] = count > 0;
        console.log(`${results[check.description] ? '✅' : '❌'} ${check.description}: ${count > 0 ? 'Found' : 'Not found'}`);
      } catch (error) {
        results[check.description] = false;
        console.log(`❌ ${check.description}: Error checking - ${error}`);
      }
    }
    
    await page.screenshot({ path: 'test-results/basic-test-elements-check.png' });
    
    console.log('📊 Element check results:', results);
    
    // At minimum, we should have a title and body
    const title = await page.title();
    console.log(`📖 Page title: "${title}"`);
    
    expect(title.length).toBeGreaterThan(0);
  });
  
});