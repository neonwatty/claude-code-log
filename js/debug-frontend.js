const { chromium } = require('playwright');

(async () => {
  console.log('🎭 Starting Playwright to debug frontend...');
  
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  // Listen for console messages from the page
  page.on('console', msg => {
    console.log(`🖥️  BROWSER: ${msg.text()}`);
  });
  
  // Listen for errors
  page.on('pageerror', err => {
    console.error(`❌ PAGE ERROR: ${err.message}`);
  });
  
  console.log('📍 Navigating to http://localhost:5173/...');
  await page.goto('http://localhost:5173/');
  
  // Wait a bit for the page to load
  await page.waitForTimeout(3000);
  
  console.log('📷 Taking screenshot...');
  await page.screenshot({ path: 'frontend-debug.png', fullPage: true });
  
  // Check if debug panel is visible
  const debugPanel = await page.locator('div:has-text("Debug Info:")').first();
  if (await debugPanel.isVisible()) {
    const debugText = await debugPanel.textContent();
    console.log('🔍 Debug Panel Content:', debugText);
  } else {
    console.log('❌ Debug panel not found');
  }
  
  // Check if app-main element exists
  const appMain = await page.locator('app-main').first();
  if (await appMain.isVisible()) {
    console.log('✅ app-main element is visible');
  } else {
    console.log('❌ app-main element not found or not visible');
  }
  
  // Try to click the manual load data button
  try {
    const loadButton = await page.locator('button:has-text("Manual Load Data")').first();
    if (await loadButton.isVisible()) {
      console.log('🖱️ Clicking Manual Load Data button...');
      await loadButton.click();
      await page.waitForTimeout(2000);
      
      // Check debug info again
      const updatedDebugText = await debugPanel.textContent();
      console.log('🔄 Updated Debug Panel Content:', updatedDebugText);
    }
  } catch (error) {
    console.log('❌ Could not click load button:', error.message);
  }
  
  console.log('📷 Taking final screenshot...');
  await page.screenshot({ path: 'frontend-debug-final.png', fullPage: true });
  
  await browser.close();
  console.log('🎭 Playwright debugging complete!');
})();