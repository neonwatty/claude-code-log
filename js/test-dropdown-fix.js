const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('🔧 Testing dropdown and form control fixes...');
    
    await page.goto('http://localhost:5174');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    console.log('🔍 Testing sort dropdown...');
    
    // Test sort dropdown
    const sortSelect = await page.$('.session-sort-select');
    if (sortSelect) {
      console.log('✅ Sort dropdown found');
      
      // Get current selection
      const currentSelection = await sortSelect.evaluate(el => el.value);
      console.log(`Current selection: ${currentSelection}`);
      
      // Get all available options
      const options = await sortSelect.evaluate(el => 
        Array.from(el.options).map(opt => ({
          value: opt.value,
          text: opt.text,
          selected: opt.selected
        }))
      );
      
      console.log('Available options:');
      options.forEach((opt, index) => {
        console.log(`  ${index + 1}. "${opt.text}" (value: ${opt.value}) ${opt.selected ? '[SELECTED]' : ''}`);
      });
      
      // Try different approaches to select options
      const testOptions = ['timestamp:asc', 'messageCount:desc'];
      
      for (const testOption of testOptions) {
        console.log(`🖱️  Trying to select: ${testOption}`);
        
        try {
          // Method 1: Use selectOption
          await sortSelect.selectOption(testOption);
          await page.waitForTimeout(1000);
          
          const newSelection = await sortSelect.evaluate(el => el.value);
          console.log(`✅ Successfully selected: ${newSelection}`);
          
        } catch (error) {
          console.log(`❌ Method 1 failed: ${error.message}`);
          
          // Method 2: Try click + type
          try {
            await sortSelect.click();
            await page.waitForTimeout(500);
            
            // Look for the option element and click it
            const optionSelector = `option[value="${testOption}"]`;
            const optionElement = await page.$(`select.session-sort-select ${optionSelector}`);
            if (optionElement) {
              await optionElement.click();
              await page.waitForTimeout(1000);
              
              const newSelection = await sortSelect.evaluate(el => el.value);
              console.log(`✅ Method 2 worked: ${newSelection}`);
            } else {
              console.log(`❌ Option not found: ${testOption}`);
            }
            
          } catch (error2) {
            console.log(`❌ Method 2 also failed: ${error2.message}`);
            
            // Method 3: Try JavaScript evaluation
            try {
              await sortSelect.evaluate((el, value) => {
                el.value = value;
                el.dispatchEvent(new Event('change', { bubbles: true }));
              }, testOption);
              
              await page.waitForTimeout(1000);
              const newSelection = await sortSelect.evaluate(el => el.value);
              console.log(`✅ Method 3 (JS) worked: ${newSelection}`);
              
            } catch (error3) {
              console.log(`❌ Method 3 failed: ${error3.message}`);
            }
          }
        }
      }
      
    } else {
      console.log('⚠️  Sort dropdown not found');
    }
    
    console.log('📝 Testing search input...');
    
    // Test search functionality
    const searchInput = await page.$('.session-search-input');
    if (searchInput) {
      console.log('✅ Search input found');
      
      try {
        await searchInput.fill('test');
        await page.waitForTimeout(1000);
        
        const searchValue = await searchInput.evaluate(el => el.value);
        console.log(`✅ Search input works: "${searchValue}"`);
        
        // Check if filtering worked
        const visibleSessions = await page.$$eval('.session-card', cards =>
          cards.filter(card => !card.style.display || card.style.display !== 'none').length
        );
        console.log(`Visible sessions after search: ${visibleSessions}`);
        
        // Clear search
        await searchInput.fill('');
        await page.waitForTimeout(1000);
        
      } catch (error) {
        console.log(`❌ Search input failed: ${error.message}`);
      }
    } else {
      console.log('⚠️  Search input not found');
    }
    
    // Take final screenshot
    await page.screenshot({ 
      path: '.playwright-mcp/form-controls-test.png', 
      fullPage: true 
    });
    
    console.log('✅ Form control testing complete');
    
  } catch (error) {
    console.error('💥 Error during form control testing:', error.message);
    await page.screenshot({ 
      path: '.playwright-mcp/form-control-error.png', 
      fullPage: true 
    });
  } finally {
    await browser.close();
  }
})();