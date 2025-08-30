const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('🧐 Testing debug logging...');
    
    // Capture console logs
    const consoleLogs = [];
    page.on('console', msg => {
      if (msg.text().includes('🔧')) {
        consoleLogs.push(msg.text());
        console.log('DEBUG:', msg.text());
      }
    });
    
    // Navigate to the app
    await page.goto('http://localhost:5174');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    console.log('📱 Looking for session cards with debug logging...');
    
    // Wait for sessions to load
    await page.waitForSelector('.session-card', { timeout: 10000 });
    
    // Get the first session card that has multiple messages
    const sessionWithMessages = await page.$('.session-card:has-text("💬 4 messages")');
    
    if (sessionWithMessages) {
      console.log('🖱️  Clicking on session with 4 messages...');
      await sessionWithMessages.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);
      
      console.log('📊 Debug logs captured:');
      consoleLogs.forEach((log, index) => {
        console.log(`  ${index + 1}. ${log}`);
      });
      
      // Take screenshot showing the result
      await page.screenshot({ 
        path: '.playwright-mcp/debug-session-view.png', 
        fullPage: true 
      });
      
    } else {
      console.log('⚠️  No session with 4 messages found');
    }
    
    console.log(`✅ Debug logging test complete. Captured ${consoleLogs.length} debug messages.`);
    
  } catch (error) {
    console.error('💥 Error during debug testing:', error.message);
  } finally {
    await browser.close();
  }
})();