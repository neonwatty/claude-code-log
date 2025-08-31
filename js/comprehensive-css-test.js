#!/usr/bin/env node

const puppeteer = require('puppeteer');

async function comprehensiveTest() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle2' });
    
    const results = await page.evaluate(() => {
      const root = document.documentElement;
      const styles = getComputedStyle(root);
      
      // Get ALL CSS custom properties
      const allVars = {};
      for (let i = 0; i < styles.length; i++) {
        const prop = styles[i];
        if (prop.startsWith('--')) {
          allVars[prop] = styles.getPropertyValue(prop).trim();
        }
      }
      
      // Check specific problematic ones
      const problemVars = ['--color-background', '--color-code-bg'];
      const problemResults = {};
      
      problemVars.forEach(varName => {
        const direct = styles.getPropertyValue(varName).trim();
        problemResults[varName] = {
          direct,
          computed: getComputedStyle(root).getPropertyValue(varName).trim(),
          exists: varName in allVars
        };
      });
      
      // Check what colors are actually being applied
      const appMain = document.querySelector('app-main');
      const actualStyles = appMain ? {
        backgroundColor: getComputedStyle(appMain).backgroundColor,
        color: getComputedStyle(appMain).color
      } : null;
      
      // Filter for indigo and color-related variables
      const indigoVars = Object.keys(allVars).filter(k => k.includes('indigo'));
      const colorVars = Object.keys(allVars).filter(k => k.includes('color'));
      
      return {
        totalVars: Object.keys(allVars).length,
        indigoVars: indigoVars.length,
        colorVars: colorVars.length,
        problemResults,
        actualStyles,
        sampleIndigoVars: indigoVars.slice(0, 5).reduce((acc, key) => {
          acc[key] = allVars[key];
          return acc;
        }, {}),
        sampleColorVars: colorVars.slice(0, 8).reduce((acc, key) => {
          acc[key] = allVars[key];
          return acc;
        }, {})
      };
    });
    
    console.log('🎯 Comprehensive CSS Variables Analysis');
    console.log('=======================================');
    console.log(`Total CSS Variables: ${results.totalVars}`);
    console.log(`Indigo Variables: ${results.indigoVars}`);
    console.log(`Color Variables: ${results.colorVars}`);
    
    console.log('\n🔍 Problem Variables Analysis:');
    Object.entries(results.problemResults).forEach(([name, data]) => {
      console.log(`${name}:`);
      console.log(`  Direct: "${data.direct}"`);
      console.log(`  Computed: "${data.computed}"`);
      console.log(`  Exists: ${data.exists}`);
    });
    
    console.log('\n🎨 Actual Applied Styles:');
    if (results.actualStyles) {
      console.log(`app-main background: ${results.actualStyles.backgroundColor}`);
      console.log(`app-main color: ${results.actualStyles.color}`);
    }
    
    console.log('\n🟣 Sample Indigo Variables:');
    Object.entries(results.sampleIndigoVars).forEach(([name, value]) => {
      console.log(`  ${name}: ${value}`);
    });
    
    console.log('\n🎨 Sample Color Variables:');
    Object.entries(results.sampleColorVars).forEach(([name, value]) => {
      console.log(`  ${name}: ${value}`);
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
}

comprehensiveTest();