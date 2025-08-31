#!/usr/bin/env node

const puppeteer = require('puppeteer');

async function quickTest() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle2' });
    
    const cssVars = await page.evaluate(() => {
      const root = document.documentElement;
      const styles = getComputedStyle(root);
      
      const vars = {};
      let count = 0;
      
      // Check for key variables
      const testVars = [
        '--indigo-600', '--color-primary', '--color-code-bg', 
        '--color-background', '--font-family-sans',
        '--color-border-light', '--color-nav-text-active'
      ];
      
      testVars.forEach(varName => {
        const value = styles.getPropertyValue(varName).trim();
        vars[varName] = value || 'NOT FOUND';
        if (value) count++;
      });
      
      return { vars, count };
    });
    
    console.log('🎯 CSS Variables Test Results:');
    console.log(`Found ${cssVars.count} out of ${Object.keys(cssVars.vars).length} key variables`);
    Object.entries(cssVars.vars).forEach(([name, value]) => {
      const status = value === 'NOT FOUND' ? '❌' : '✅';
      console.log(`${status} ${name}: ${value}`);
    });
    
    if (cssVars.count >= 3) {
      console.log('\n🎉 CSS Variables are being loaded successfully!');
    } else {
      console.log('\n⚠️  CSS Variables are not fully loaded.');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
}

quickTest();