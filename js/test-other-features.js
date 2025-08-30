const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('🧪 Testing other key features...');
    
    await page.goto('http://localhost:5174');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    console.log('🔍 Testing filters and search functionality...');
    
    // Test session search
    const searchInput = await page.$('.session-search-input');
    if (searchInput) {
      console.log('✅ Session search input found');
      await searchInput.fill('test');
      await page.waitForTimeout(1000);
      
      const visibleSessions = await page.$$eval('.session-card:not([style*="display: none"])', els => els.length);
      console.log(`Search results: ${visibleSessions} sessions visible after search`);
      
      // Clear search
      await searchInput.fill('');
      await page.waitForTimeout(1000);
    } else {
      console.log('⚠️  Session search input not found');
    }
    
    // Test sort dropdown
    const sortSelect = await page.$('.session-sort-select');
    if (sortSelect) {
      console.log('✅ Sort dropdown found');
      await sortSelect.selectOption('oldest');
      await page.waitForTimeout(1000);
      console.log('Changed sort to oldest first');
      
      await sortSelect.selectOption('latest');
      await page.waitForTimeout(1000);
      console.log('Changed sort back to latest first');
    } else {
      console.log('⚠️  Sort dropdown not found');
    }
    
    console.log('📊 Testing statistics dashboard...');
    
    // Check if statistics are displayed correctly
    const stats = await page.$$eval('.stat-card', elements => 
      elements.map(el => ({
        value: el.querySelector('[id^="stat-"]')?.textContent?.trim(),
        label: el.textContent?.match(/(?:Active Users|Log Entries|Sent|Received|Reconnects)/)?.[0],
        classes: el.className
      }))
    );
    
    console.log('Statistics found:');
    stats.forEach(stat => {
      console.log(`  ${stat.label}: ${stat.value} (${stat.classes})`);
    });
    
    console.log('🌓 Testing theme switching...');
    
    // Look for theme controls
    const themeElements = await page.$$eval('*', elements => 
      elements.filter(el => 
        el.textContent?.toLowerCase().includes('light') ||
        el.textContent?.toLowerCase().includes('dark') ||
        el.textContent?.toLowerCase().includes('theme') ||
        el.className?.toLowerCase().includes('theme')
      ).map(el => ({
        tag: el.tagName,
        text: el.textContent?.trim().substring(0, 100),
        classes: el.className,
        id: el.id
      }))
    );
    
    if (themeElements.length > 0) {
      console.log('Theme elements found:');
      themeElements.forEach(el => {
        console.log(`  ${el.tag}: "${el.text}" (${el.classes})`);
      });
    } else {
      console.log('⚠️  No theme switching elements found');
    }
    
    console.log('🔌 Testing WebSocket connection controls...');
    
    // Test connection controls
    const connectionControls = await page.$$eval('button', elements => 
      elements.filter(el => 
        el.textContent?.toLowerCase().includes('disconnect') ||
        el.textContent?.toLowerCase().includes('reconnect') ||
        el.textContent?.toLowerCase().includes('connect')
      ).map(el => ({
        text: el.textContent?.trim(),
        disabled: el.disabled,
        classes: el.className
      }))
    );
    
    if (connectionControls.length > 0) {
      console.log('Connection controls found:');
      connectionControls.forEach(control => {
        console.log(`  "${control.text}" (disabled: ${control.disabled}, classes: ${control.classes})`);
      });
      
      // Try testing disconnect/reconnect
      const disconnectBtn = await page.$('button:has-text("Disconnect")');
      if (disconnectBtn) {
        console.log('🔌 Testing disconnect...');
        await disconnectBtn.click();
        await page.waitForTimeout(2000);
        
        const reconnectBtn = await page.$('button:has-text("Reconnect")');
        if (reconnectBtn) {
          console.log('🔌 Testing reconnect...');
          await reconnectBtn.click();
          await page.waitForTimeout(2000);
        }
      }
    } else {
      console.log('⚠️  No connection controls found');
    }
    
    console.log('📱 Testing responsive design...');
    
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(1000);
    await page.screenshot({ 
      path: '.playwright-mcp/mobile-view-test.png', 
      fullPage: true 
    });
    console.log('📱 Mobile view screenshot taken');
    
    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(1000);
    await page.screenshot({ 
      path: '.playwright-mcp/tablet-view-test.png', 
      fullPage: true 
    });
    console.log('📱 Tablet view screenshot taken');
    
    // Back to desktop
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForTimeout(1000);
    
    console.log('⚠️  Testing error conditions...');
    
    // Test what happens if we navigate to a non-existent page
    try {
      await page.goto('http://localhost:5174/nonexistent');
      await page.waitForLoadState('networkidle');
      
      const errorContent = await page.$eval('body', el => el.textContent);
      if (errorContent.includes('404') || errorContent.includes('Not Found') || errorContent.includes('error')) {
        console.log('✅ 404 handling works');
      } else {
        console.log('⚠️  No clear 404 handling found');
      }
    } catch (error) {
      console.log('⚠️  Error testing 404 page:', error.message);
    }
    
    // Go back to main page
    await page.goto('http://localhost:5174');
    await page.waitForLoadState('networkidle');
    
    console.log('🎭 Testing interaction edge cases...');
    
    // Test rapid clicking
    const sessionCards = await page.$$('.session-card');
    if (sessionCards.length > 0) {
      console.log('Testing rapid session clicks...');
      for (let i = 0; i < Math.min(3, sessionCards.length); i++) {
        try {
          await sessionCards[i].click();
          await page.waitForTimeout(100); // Very short wait
        } catch (error) {
          console.log(`Rapid click ${i} failed: ${error.message}`);
        }
      }
      await page.waitForTimeout(2000);
    }
    
    // Final screenshot
    await page.screenshot({ 
      path: '.playwright-mcp/final-feature-test.png', 
      fullPage: true 
    });
    
    console.log('✅ Other features testing complete');
    
  } catch (error) {
    console.error('💥 Error during feature testing:', error.message);
    await page.screenshot({ 
      path: '.playwright-mcp/feature-test-error.png', 
      fullPage: true 
    });
  } finally {
    await browser.close();
  }
})();