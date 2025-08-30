const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('🔍 Testing session details and message duplication...');
    
    // Navigate to the app
    await page.goto('http://localhost:5174');
    await page.waitForLoadState('networkidle');
    
    console.log('📱 Looking for session cards...');
    
    // Wait for sessions to load
    await page.waitForSelector('.session-card', { timeout: 10000 });
    
    // Get all session cards
    const sessionCards = await page.$$('.session-card');
    console.log(`Found ${sessionCards.length} session cards`);
    
    if (sessionCards.length > 0) {
      // Click on the first session that has multiple messages
      console.log('🖱️  Looking for a session with multiple messages...');
      
      const sessionWithMessages = await page.$('.session-card:has-text("💬 4 messages"), .session-card:has-text("💬 8 messages"), .session-card:has-text("💬 11 messages")');
      
      if (sessionWithMessages) {
        console.log('Found session with multiple messages, clicking...');
        
        // Take screenshot before clicking
        await page.screenshot({ 
          path: '.playwright-mcp/before-session-click.png', 
          fullPage: true 
        });
        
        await sessionWithMessages.click();
        await page.waitForLoadState('networkidle');
        
        // Wait for session details to load
        await page.waitForTimeout(2000);
        
        console.log('📸 Taking screenshot after clicking session...');
        await page.screenshot({ 
          path: '.playwright-mcp/session-detail-view.png', 
          fullPage: true 
        });
        
        // Look for message elements
        console.log('🗨️  Analyzing messages in session detail...');
        const messages = await page.$$eval('[class*="message"], .message-card, [class*="chat"], [role="article"]', elements => 
          elements.map((el, index) => ({
            index,
            tag: el.tagName,
            classes: el.className,
            text: el.textContent?.trim().substring(0, 200),
            id: el.id,
            children: el.children.length
          }))
        );
        
        console.log(`Found ${messages.length} message-like elements:`);
        messages.forEach(msg => {
          console.log(`  ${msg.index}: ${msg.tag} (${msg.classes}) - "${msg.text}"`);
        });
        
        // Check for duplicate message content specifically
        const messageTexts = messages.map(m => m.text).filter(t => t && t.length > 20);
        const duplicates = messageTexts.filter((text, index, arr) => 
          text && arr.indexOf(text) !== index && arr.indexOf(text) !== arr.lastIndexOf(text)
        );
        
        if (duplicates.length > 0) {
          console.log('⚠️  FOUND DUPLICATE MESSAGES:');
          [...new Set(duplicates)].forEach(dup => {
            const count = messageTexts.filter(t => t === dup).length;
            console.log(`  "${dup.substring(0, 100)}..." (appears ${count} times)`);
          });
          
          // Take screenshot highlighting the duplication issue
          await page.screenshot({ 
            path: '.playwright-mcp/message-duplication-issue.png', 
            fullPage: true 
          });
        } else {
          console.log('✅ No duplicate message content found');
        }
        
        // Check DOM structure for potential rendering issues
        console.log('🔍 Checking DOM structure for rendering issues...');
        
        const domStructure = await page.evaluate(() => {
          // Look for elements that might contain messages
          const containers = document.querySelectorAll('.session-detail, .message-list, .conversation, [class*="message-container"]');
          return Array.from(containers).map(container => ({
            tag: container.tagName,
            className: container.className,
            childCount: container.children.length,
            textLength: container.textContent?.length || 0,
            innerHTML: container.innerHTML.substring(0, 500) // First 500 chars for analysis
          }));
        });
        
        domStructure.forEach(structure => {
          console.log(`DOM Container: ${structure.tag}.${structure.className} (${structure.childCount} children, ${structure.textLength} chars)`);
          console.log(`  HTML preview: ${structure.innerHTML.substring(0, 200)}...`);
        });
        
        // Check for WebSocket message handling
        console.log('🔌 Monitoring WebSocket activity...');
        
        const wsMessages = [];
        page.on('websocket', ws => {
          console.log(`WebSocket connected: ${ws.url()}`);
          ws.on('framereceived', event => {
            wsMessages.push(`Received: ${event.payload}`);
            console.log(`WS Received: ${event.payload.toString().substring(0, 100)}`);
          });
          ws.on('framesent', event => {
            wsMessages.push(`Sent: ${event.payload}`);
            console.log(`WS Sent: ${event.payload.toString().substring(0, 100)}`);
          });
        });
        
        // Wait to catch some WebSocket traffic
        await page.waitForTimeout(3000);
        
        // Try to navigate back and forth to see if messages duplicate
        console.log('🔄 Testing navigation to check for message duplication...');
        
        // Go back to main page
        await page.goBack();
        await page.waitForLoadState('networkidle');
        
        // Go forward again
        await page.goForward();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);
        
        // Check messages again after navigation
        const messagesAfterNav = await page.$$eval('[class*="message"], .message-card, [class*="chat"], [role="article"]', elements => 
          elements.map((el, index) => ({
            index,
            text: el.textContent?.trim().substring(0, 200)
          }))
        );
        
        const textsAfterNav = messagesAfterNav.map(m => m.text).filter(t => t && t.length > 20);
        const duplicatesAfterNav = textsAfterNav.filter((text, index, arr) => 
          text && arr.indexOf(text) !== index
        );
        
        if (duplicatesAfterNav.length > 0) {
          console.log('⚠️  DUPLICATION INCREASED AFTER NAVIGATION:');
          [...new Set(duplicatesAfterNav)].forEach(dup => {
            const count = textsAfterNav.filter(t => t === dup).length;
            console.log(`  "${dup.substring(0, 100)}..." (appears ${count} times after navigation)`);
          });
          
          await page.screenshot({ 
            path: '.playwright-mcp/duplication-after-navigation.png', 
            fullPage: true 
          });
        }
        
        console.log(`📊 WebSocket messages captured: ${wsMessages.length}`);
        
      } else {
        console.log('⚠️  No session with multiple messages found for detailed testing');
      }
    } else {
      console.log('❌ No session cards found');
    }
    
    console.log('✅ Session detail testing complete');
    
  } catch (error) {
    console.error('💥 Error during session testing:', error.message);
    await page.screenshot({ 
      path: '.playwright-mcp/session-test-error.png', 
      fullPage: true 
    });
  } finally {
    await browser.close();
  }
})();