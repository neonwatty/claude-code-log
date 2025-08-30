const { chromium } = require('playwright');

(async () => {
  console.log('🚀 Starting browser check...');
  
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  // Set up console logging
  const logs = [];
  page.on('console', msg => {
    const logEntry = `${msg.type()}: ${msg.text()}`;
    console.log(`Console: ${logEntry}`);
    logs.push(logEntry);
  });

  // Set up network request logging
  const networkRequests = [];
  page.on('request', request => {
    if (request.url().includes('localhost:3001')) {
      const requestInfo = `${request.method()} ${request.url()}`;
      console.log(`Network: ${requestInfo}`);
      networkRequests.push(requestInfo);
    }
  });

  console.log('📍 Navigating to http://localhost:5174...');
  await page.goto('http://localhost:5174');
  
  console.log('📸 Taking initial screenshot...');
  await page.screenshot({ path: 'current-state-check.png', fullPage: true });

  console.log('⏳ Waiting 5 seconds for application to load...');
  await page.waitForTimeout(5000);

  // Check for session elements
  const sessionCount = await page.locator('[data-testid*="session"], .session-card, .session-item, .session').count();
  console.log(`📊 Session elements found: ${sessionCount}`);

  // Check for loading elements
  const loadingCount = await page.locator('.loading, [data-loading="true"], .spinner').count();
  console.log(`⌛ Loading elements: ${loadingCount}`);

  // Check for error elements
  const errorCount = await page.locator('.error, [data-error], .error-message').count();
  console.log(`❌ Error elements: ${errorCount}`);

  // Filter for router-specific issues
  const routerErrors = logs.filter(log => 
    log.includes('Route not found: /') || 
    log.includes('router') || 
    log.includes('infinite') ||
    log.includes('loop')
  );

  console.log('\n=== VERIFICATION RESULTS ===');
  console.log('Router-related errors:', routerErrors.length);
  if (routerErrors.length > 0) {
    console.log('Router errors:', routerErrors);
  }
  console.log('Network requests to backend:', networkRequests.length);
  if (networkRequests.length > 0) {
    console.log('Backend requests:', networkRequests);
  }
  console.log('Total console messages:', logs.length);
  console.log('Session elements visible:', sessionCount);

  console.log('\n📸 Taking final screenshot...');
  await page.screenshot({ path: 'final-state-after-testing.png', fullPage: true });

  // Check if router infinite loop is resolved
  const hasInfiniteLoop = routerErrors.some(error => 
    error.includes('Route not found: /') && logs.filter(log => log.includes('Route not found: /')).length > 10
  );

  console.log(`\n🔄 Infinite router loop resolved: ${!hasInfiniteLoop ? '✅ YES' : '❌ NO'}`);
  console.log(`🌐 Backend API requests: ${networkRequests.length > 0 ? '✅ YES' : '❌ NO'}`);
  console.log(`📄 Sessions loaded: ${sessionCount > 0 ? '✅ YES' : '❌ NO'}`);

  await browser.close();
  console.log('✅ Browser check complete!');
})();