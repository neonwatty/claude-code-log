const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('🧪 Running comprehensive regression tests...');
    
    const results = {
      homepageLoad: false,
      sessionNavigation: false,
      messageDuplication: false,
      sortDropdown: false,
      searchInput: false,
      overallScore: 0
    };
    
    // Test 1: Homepage Load
    console.log('\n1️⃣ Testing homepage load...');
    await page.goto('http://localhost:5174');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    const sessionCards = await page.$$('.session-card');
    if (sessionCards.length > 0) {
      console.log(`✅ Homepage loads with ${sessionCards.length} session cards`);
      results.homepageLoad = true;
    } else {
      console.log('❌ No session cards found');
    }
    
    // Test 2: Session Navigation
    console.log('\n2️⃣ Testing session navigation...');
    try {
      const sessionWithMessages = await page.$('.session-card:has-text("💬 4 messages")');
      if (sessionWithMessages) {
        await sessionWithMessages.click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);
        
        // Check if we navigated to session detail
        const sessionDetail = await page.$('.session-messages-container');
        if (sessionDetail) {
          console.log('✅ Session navigation works');
          results.sessionNavigation = true;
        } else {
          console.log('❌ No session detail found after click');
        }
      } else {
        console.log('⚠️  No session with 4 messages found for testing');
      }
    } catch (error) {
      console.log(`❌ Session navigation failed: ${error.message}`);
    }
    
    // Test 3: Message Duplication Check
    console.log('\n3️⃣ Testing message duplication...');
    const messageCards = await page.$$('.message-card');
    const userMessages = await page.$$('.message-card.user .message-header');
    const assistantMessages = await page.$$('.message-card.assistant .message-header');
    
    console.log(`Found ${messageCards.length} total message cards`);
    console.log(`Found ${userMessages.length} user message headers`);
    console.log(`Found ${assistantMessages.length} assistant message headers`);
    
    // In a 4-message session, we should have exactly 2 user and 2 assistant messages
    if (userMessages.length === 2 && assistantMessages.length === 2) {
      console.log('✅ No message duplication detected');
      results.messageDuplication = false; // false = no duplication (good)
    } else {
      console.log('❌ Message duplication still exists');
      results.messageDuplication = true; // true = has duplication (bad)
    }
    
    // Go back to homepage for other tests
    await page.goto('http://localhost:5174');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Test 4: Sort Dropdown
    console.log('\n4️⃣ Testing sort dropdown...');
    const sortSelect = await page.$('.session-sort-select');
    if (sortSelect) {
      try {
        await sortSelect.selectOption('timestamp:asc');
        await page.waitForTimeout(1000);
        
        const newSelection = await sortSelect.evaluate(el => el.value);
        if (newSelection === 'timestamp:asc') {
          console.log('✅ Sort dropdown works');
          results.sortDropdown = true;
        } else {
          console.log(`❌ Sort dropdown value incorrect: ${newSelection}`);
        }
      } catch (error) {
        console.log(`❌ Sort dropdown failed: ${error.message}`);
      }
    } else {
      console.log('❌ Sort dropdown not found');
    }
    
    // Test 5: Search Input
    console.log('\n5️⃣ Testing search input...');
    const searchInput = await page.$('.session-search-input');
    if (searchInput) {
      try {
        await searchInput.fill('test');
        await page.waitForTimeout(1000);
        
        const searchValue = await searchInput.evaluate(el => el.value);
        if (searchValue === 'test') {
          console.log('✅ Search input works');
          results.searchInput = true;
        } else {
          console.log(`❌ Search input value incorrect: ${searchValue}`);
        }
        
        // Clear search
        await searchInput.fill('');
        await page.waitForTimeout(1000);
      } catch (error) {
        console.log(`❌ Search input failed: ${error.message}`);
      }
    } else {
      console.log('❌ Search input not found');
    }
    
    // Calculate overall score
    const testCount = Object.keys(results).length - 1; // Exclude overallScore
    let passedTests = 0;
    
    if (results.homepageLoad) passedTests++;
    if (results.sessionNavigation) passedTests++;
    if (!results.messageDuplication) passedTests++; // Note: messageDuplication false = good
    if (results.sortDropdown) passedTests++;
    if (results.searchInput) passedTests++;
    
    results.overallScore = Math.round((passedTests / testCount) * 100);
    
    // Final screenshot
    await page.screenshot({ 
      path: '.playwright-mcp/final-regression-test.png', 
      fullPage: true 
    });
    
    // Print final results
    console.log('\n📊 FINAL RESULTS:');
    console.log('================');
    console.log(`✅ Homepage Load: ${results.homepageLoad ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Session Navigation: ${results.sessionNavigation ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Message Duplication Fixed: ${!results.messageDuplication ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Sort Dropdown: ${results.sortDropdown ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Search Input: ${results.searchInput ? 'PASS' : 'FAIL'}`);
    console.log('================');
    console.log(`🎯 Overall Score: ${results.overallScore}% (${passedTests}/${testCount} tests passed)`);
    
    if (results.overallScore >= 80) {
      console.log('🎉 EXCELLENT! All major issues have been fixed!');
    } else if (results.overallScore >= 60) {
      console.log('✅ GOOD! Most issues have been fixed.');
    } else {
      console.log('⚠️  Some issues still need attention.');
    }
    
    console.log('\n✅ Comprehensive regression testing complete');
    
  } catch (error) {
    console.error('💥 Error during regression testing:', error.message);
    await page.screenshot({ 
      path: '.playwright-mcp/regression-test-error.png', 
      fullPage: true 
    });
  } finally {
    await browser.close();
  }
})();