const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });
  const page = await context.newPage();

  // Capture console messages
  const consoleMessages = [];
  page.on('console', msg => {
    consoleMessages.push({
      type: msg.type(),
      text: msg.text(),
      location: msg.location()
    });
  });

  // Capture network failures
  const networkFailures = [];
  page.on('requestfailed', request => {
    networkFailures.push({
      url: request.url(),
      failure: request.failure()?.errorText || 'Unknown error'
    });
  });

  try {
    console.log('Navigating to http://localhost:5174...');
    await page.goto('http://localhost:5174', { 
      waitUntil: 'networkidle',
      timeout: 10000 
    });

    // Wait a bit for any dynamic content to load
    await page.waitForTimeout(3000);

    // Take screenshot
    const screenshotPath = path.join(__dirname, 'session-investigation-screenshot.png');
    await page.screenshot({ 
      path: screenshotPath, 
      fullPage: true 
    });
    console.log(`Screenshot saved to: ${screenshotPath}`);

    // Get page title and URL
    const title = await page.title();
    const url = page.url();
    console.log(`Page title: ${title}`);
    console.log(`Current URL: ${url}`);

    // Check for session list elements
    const sessionElements = await page.$$('[data-testid*="session"], .session-card, .session-item, .session-list');
    console.log(`Found ${sessionElements.length} potential session elements`);

    // Check for loading indicators
    const loadingElements = await page.$$('.loading, [data-loading="true"], .spinner');
    console.log(`Found ${loadingElements.length} loading indicators`);

    // Check for error messages
    const errorElements = await page.$$('.error, .error-message, [role="alert"]');
    console.log(`Found ${errorElements.length} error elements`);

    // Get the main content area
    const bodyText = await page.textContent('body');
    const hasEmptyState = bodyText.includes('No sessions') || bodyText.includes('empty') || bodyText.includes('no data');
    console.log(`Page appears to show empty state: ${hasEmptyState}`);

    // Check for network requests to session endpoints
    const requests = [];
    page.on('request', request => {
      if (request.url().includes('session') || request.url().includes('api')) {
        requests.push(request.url());
      }
    });

    // Wait a bit more to capture any async requests
    await page.waitForTimeout(2000);

    console.log('\n=== CONSOLE MESSAGES ===');
    consoleMessages.forEach(msg => {
      console.log(`[${msg.type.toUpperCase()}] ${msg.text}`);
      if (msg.location) {
        console.log(`  at ${msg.location.url}:${msg.location.lineNumber}:${msg.location.columnNumber}`);
      }
    });

    console.log('\n=== NETWORK FAILURES ===');
    networkFailures.forEach(failure => {
      console.log(`FAILED: ${failure.url} - ${failure.failure}`);
    });

    console.log('\n=== SESSION-RELATED REQUESTS ===');
    requests.forEach(url => {
      console.log(`REQUEST: ${url}`);
    });

    // Try to find specific elements that should contain sessions
    const specificSelectors = [
      'session-list',
      'session-card', 
      '.sessions',
      '[data-component="session-list"]',
      'app-component session-list',
      'main session-list'
    ];

    console.log('\n=== ELEMENT SEARCH ===');
    for (const selector of specificSelectors) {
      const elements = await page.$$(selector);
      console.log(`${selector}: ${elements.length} elements found`);
    }

  } catch (error) {
    console.error('Error during investigation:', error.message);
    
    // Still try to take a screenshot if possible
    try {
      const errorScreenshotPath = path.join(__dirname, 'error-screenshot.png');
      await page.screenshot({ path: errorScreenshotPath });
      console.log(`Error screenshot saved to: ${errorScreenshotPath}`);
    } catch (screenshotError) {
      console.error('Could not take error screenshot:', screenshotError.message);
    }
  }

  await browser.close();
})();