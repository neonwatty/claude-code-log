const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('📱 Starting app exploration...');
    
    // Navigate to the app
    console.log('🏠 Navigating to homepage...');
    await page.goto('http://localhost:5174');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // Take homepage screenshot
    await page.screenshot({ 
      path: '.playwright-mcp/homepage-full.png', 
      fullPage: true 
    });
    console.log('📸 Homepage screenshot saved');
    
    // Check for any console errors
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
        console.log('❌ Console error:', msg.text());
      }
    });
    
    // Check page title
    const title = await page.title();
    console.log('📄 Page title:', title);
    
    // Look for main navigation elements
    console.log('🧭 Checking navigation elements...');
    const navElements = await page.$$eval('[data-testid], [id], button, a', elements => 
      elements.map(el => ({
        tag: el.tagName,
        id: el.id,
        testId: el.getAttribute('data-testid'),
        text: el.textContent?.trim().substring(0, 50),
        classes: el.className
      })).filter(el => el.text || el.id || el.testId)
    );
    
    console.log('Found navigation elements:');
    navElements.forEach(el => {
      console.log(`  ${el.tag}: ${el.text} (id: ${el.id}, testId: ${el.testId})`);
    });
    
    // Look for session-related elements
    console.log('🗂️  Checking for session elements...');
    const sessionElements = await page.$$eval('*', elements => 
      elements.filter(el => 
        el.textContent?.toLowerCase().includes('session') ||
        el.className?.toLowerCase().includes('session') ||
        el.id?.toLowerCase().includes('session')
      ).map(el => ({
        tag: el.tagName,
        id: el.id,
        text: el.textContent?.trim().substring(0, 100),
        classes: el.className
      }))
    );
    
    if (sessionElements.length > 0) {
      console.log('Found session-related elements:');
      sessionElements.forEach(el => {
        console.log(`  ${el.tag}: "${el.text}" (classes: ${el.classes})`);
      });
    } else {
      console.log('⚠️  No session elements found on homepage');
    }
    
    // Check for any duplicate messages by looking for repeated content
    console.log('🔍 Checking for duplicate message content...');
    const allTextContent = await page.$$eval('*', elements => 
      elements.map(el => el.textContent?.trim())
        .filter(text => text && text.length > 10)
        .filter((text, index, arr) => arr.indexOf(text) !== index) // Find duplicates
    );
    
    if (allTextContent.length > 0) {
      console.log('⚠️  Found potential duplicate content:');
      [...new Set(allTextContent)].forEach(text => {
        console.log(`  Duplicate: "${text.substring(0, 100)}..."`);
      });
    } else {
      console.log('✅ No obvious duplicate content found on homepage');
    }
    
    // Try to find and click on session-related links/buttons
    console.log('🖱️  Looking for clickable session elements...');
    const clickableElements = await page.$$eval('button, a, [role="button"]', elements => 
      elements.filter(el => 
        el.textContent?.toLowerCase().includes('session') ||
        el.textContent?.toLowerCase().includes('log') ||
        el.textContent?.toLowerCase().includes('transcript')
      ).map(el => ({
        tag: el.tagName,
        text: el.textContent?.trim(),
        href: el.href,
        role: el.getAttribute('role')
      }))
    );
    
    if (clickableElements.length > 0) {
      console.log('Found clickable elements:');
      clickableElements.forEach(el => {
        console.log(`  ${el.tag}: "${el.text}" (href: ${el.href})`);
      });
      
      // Try clicking the first session-related element
      const firstElement = clickableElements[0];
      console.log(`🖱️  Clicking on: "${firstElement.text}"`);
      
      try {
        if (firstElement.tag === 'A' && firstElement.href) {
          await page.click(`a[href="${new URL(firstElement.href).pathname}"]`);
        } else {
          await page.click(`button:has-text("${firstElement.text.substring(0, 20)}")`);
        }
        
        await page.waitForLoadState('networkidle');
        await page.screenshot({ 
          path: '.playwright-mcp/after-first-click.png', 
          fullPage: true 
        });
        
        console.log('📸 Screenshot after clicking saved');
        
        // Check for messages/content after navigation
        console.log('🗨️  Checking for message content...');
        const messageElements = await page.$$eval('*', elements => 
          elements.filter(el => 
            el.textContent?.toLowerCase().includes('message') ||
            el.className?.toLowerCase().includes('message') ||
            el.className?.toLowerCase().includes('chat') ||
            el.className?.toLowerCase().includes('conversation')
          ).map(el => ({
            tag: el.tagName,
            text: el.textContent?.trim().substring(0, 200),
            classes: el.className
          }))
        );
        
        messageElements.forEach(el => {
          console.log(`  Message element: ${el.tag} - "${el.text}"`);
        });
        
      } catch (clickError) {
        console.log('⚠️  Could not click element:', clickError.message);
      }
    } else {
      console.log('⚠️  No clickable session elements found');
    }
    
    // Check for any network errors
    const networkErrors = [];
    page.on('requestfailed', request => {
      networkErrors.push(`${request.method()} ${request.url()} - ${request.failure().errorText}`);
    });
    
    // Wait a bit to catch any network errors
    await page.waitForTimeout(2000);
    
    if (networkErrors.length > 0) {
      console.log('🌐 Network errors found:');
      networkErrors.forEach(error => console.log(`  ${error}`));
    } else {
      console.log('✅ No network errors detected');
    }
    
    if (errors.length > 0) {
      console.log('📊 Summary of console errors:');
      errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
      
      // Take screenshot showing errors
      await page.screenshot({ 
        path: '.playwright-mcp/homepage-with-errors.png', 
        fullPage: true 
      });
    }
    
    console.log('✅ Homepage exploration complete');
    
  } catch (error) {
    console.error('💥 Error during exploration:', error.message);
    await page.screenshot({ 
      path: '.playwright-mcp/error-screenshot.png', 
      fullPage: true 
    });
  } finally {
    await browser.close();
  }
})();