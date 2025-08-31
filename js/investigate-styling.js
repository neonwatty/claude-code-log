const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function investigateAppStyling() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  
  const page = await context.newPage();
  
  // Create screenshots directory
  const screenshotsDir = path.join(__dirname, '..', 'styling-investigation');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }
  
  console.log('Starting styling investigation...');
  
  try {
    // 1. Visit the main application
    console.log('1. Navigating to main application...');
    await page.goto('http://localhost:5176/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    // Take initial screenshot
    await page.screenshot({ 
      path: path.join(screenshotsDir, '01-homepage-initial.png'),
      fullPage: true 
    });
    
    // Extract current color scheme from CSS
    console.log('2. Analyzing current color scheme...');
    const colorScheme = await page.evaluate(() => {
      const computedStyles = {};
      const elements = document.querySelectorAll('*');
      const colors = new Set();
      const backgroundColors = new Set();
      
      elements.forEach(el => {
        const style = window.getComputedStyle(el);
        const color = style.color;
        const bgColor = style.backgroundColor;
        
        if (color && color !== 'rgba(0, 0, 0, 0)' && color !== 'rgb(0, 0, 0)') {
          colors.add(color);
        }
        if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'rgb(255, 255, 255)') {
          backgroundColors.add(bgColor);
        }
      });
      
      // Get CSS custom properties
      const rootStyles = window.getComputedStyle(document.documentElement);
      const cssVars = {};
      for (let i = 0; i < rootStyles.length; i++) {
        const prop = rootStyles[i];
        if (prop.startsWith('--')) {
          cssVars[prop] = rootStyles.getPropertyValue(prop);
        }
      }
      
      return {
        textColors: Array.from(colors).slice(0, 20), // Limit output
        backgroundColors: Array.from(backgroundColors).slice(0, 20),
        cssVariables: cssVars
      };
    });
    
    console.log('Current color scheme:', JSON.stringify(colorScheme, null, 2));
    
    // 3. Check for navigation elements and take screenshots
    console.log('3. Checking navigation and main sections...');
    
    // Look for navigation links or buttons
    const navElements = await page.$$('nav a, [role="navigation"] a, button[data-route], a[href]');
    console.log(`Found ${navElements.length} navigation elements`);
    
    // Take screenshot of navigation area
    if (navElements.length > 0) {
      await page.screenshot({ 
        path: path.join(screenshotsDir, '02-navigation-area.png'),
        clip: { x: 0, y: 0, width: 1920, height: 400 }
      });
    }
    
    // 4. Look for sessions-related content
    console.log('4. Looking for sessions content...');
    
    // Try different selectors to find sessions
    const sessionSelectors = [
      'session-list',
      '[data-component="session-list"]',
      '.session-list',
      '.sessions',
      'session-card',
      '.session-card',
      '[data-testid*="session"]',
      'a[href*="session"]'
    ];
    
    let sessionsFound = false;
    for (const selector of sessionSelectors) {
      const elements = await page.$$(selector);
      if (elements.length > 0) {
        console.log(`Found sessions using selector: ${selector} (${elements.length} elements)`);
        sessionsFound = true;
        
        // Take screenshot of sessions area
        await page.screenshot({ 
          path: path.join(screenshotsDir, `03-sessions-${selector.replace(/[^a-z0-9]/gi, '-')}.png`),
          fullPage: true 
        });
        break;
      }
    }
    
    if (!sessionsFound) {
      console.log('No sessions found with standard selectors, checking for any clickable elements...');
      const clickableElements = await page.$$('button, a, [onclick], [data-click]');
      console.log(`Found ${clickableElements.length} clickable elements`);
      
      // Try clicking elements to navigate
      for (let i = 0; i < Math.min(clickableElements.length, 5); i++) {
        try {
          const element = clickableElements[i];
          const text = await element.textContent();
          const tagName = await element.evaluate(el => el.tagName);
          console.log(`Element ${i}: ${tagName} - "${text}"`);
          
          if (text && (text.toLowerCase().includes('session') || text.toLowerCase().includes('log'))) {
            console.log(`Clicking potentially relevant element: "${text}"`);
            await element.click();
            await page.waitForTimeout(1000);
            
            await page.screenshot({ 
              path: path.join(screenshotsDir, `04-after-click-${i}-${text.replace(/[^a-z0-9]/gi, '-').substring(0, 20)}.png`),
              fullPage: true 
            });
          }
        } catch (e) {
          console.log(`Error clicking element ${i}:`, e.message);
        }
      }
    }
    
    // 5. Look for code blocks and styling issues
    console.log('5. Looking for code blocks and syntax highlighting...');
    
    const codeSelectors = [
      'pre',
      'code',
      '.code-block',
      '.hljs',
      '.syntax-highlight',
      '[class*="code"]',
      '[class*="highlight"]'
    ];
    
    let codeFound = false;
    for (const selector of codeSelectors) {
      const elements = await page.$$(selector);
      if (elements.length > 0) {
        console.log(`Found code elements using selector: ${selector} (${elements.length} elements)`);
        codeFound = true;
        
        // Take screenshot focusing on code areas
        await page.screenshot({ 
          path: path.join(screenshotsDir, `05-code-${selector.replace(/[^a-z0-9]/gi, '-')}.png`),
          fullPage: true 
        });
        
        // Analyze code styling
        const codeStyles = await page.evaluate((sel) => {
          const elements = document.querySelectorAll(sel);
          return Array.from(elements).slice(0, 5).map(el => {
            const style = window.getComputedStyle(el);
            return {
              selector: sel,
              backgroundColor: style.backgroundColor,
              color: style.color,
              fontFamily: style.fontFamily,
              fontSize: style.fontSize,
              textContent: el.textContent.substring(0, 100) + '...'
            };
          });
        }, selector);
        
        console.log(`Code styling for ${selector}:`, JSON.stringify(codeStyles, null, 2));
      }
    }
    
    if (!codeFound) {
      console.log('No code blocks found with standard selectors');
    }
    
    // 6. Check for analytics/dashboard elements
    console.log('6. Looking for analytics and dashboard elements...');
    
    const analyticsSelectors = [
      'analytics-dashboard',
      '.analytics',
      '.dashboard',
      '.statistics',
      '.metrics',
      'chart',
      '.chart',
      'canvas',
      'svg'
    ];
    
    for (const selector of analyticsSelectors) {
      const elements = await page.$$(selector);
      if (elements.length > 0) {
        console.log(`Found analytics elements using selector: ${selector} (${elements.length} elements)`);
        
        await page.screenshot({ 
          path: path.join(screenshotsDir, `06-analytics-${selector.replace(/[^a-z0-9]/gi, '-')}.png`),
          fullPage: true 
        });
      }
    }
    
    // 7. Check for dark/light theme indicators
    console.log('7. Checking for theme indicators...');
    
    const themeInfo = await page.evaluate(() => {
      const body = document.body;
      const html = document.documentElement;
      const classList = [...body.classList, ...html.classList];
      
      return {
        bodyClasses: Array.from(body.classList),
        htmlClasses: Array.from(html.classList),
        dataTheme: body.dataset.theme || html.dataset.theme,
        hasThemeAttribute: body.hasAttribute('data-theme') || html.hasAttribute('data-theme'),
        possibleThemeClasses: classList.filter(cls => 
          cls.includes('dark') || cls.includes('light') || cls.includes('theme')
        )
      };
    });
    
    console.log('Theme information:', JSON.stringify(themeInfo, null, 2));
    
    // 8. Take final comprehensive screenshots
    console.log('8. Taking final comprehensive screenshots...');
    
    // Full page
    await page.screenshot({ 
      path: path.join(screenshotsDir, '08-final-full-page.png'),
      fullPage: true 
    });
    
    // Viewport only
    await page.screenshot({ 
      path: path.join(screenshotsDir, '08-final-viewport.png')
    });
    
    // 9. Generate HTML report
    console.log('9. Generating investigation report...');
    
    const reportHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Claude Code Log - Styling Investigation Report</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            line-height: 1.6;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background: #f5f5f5;
        }
        .section {
            background: white;
            padding: 20px;
            margin: 20px 0;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .color-swatch {
            display: inline-block;
            width: 30px;
            height: 30px;
            margin: 5px;
            border: 1px solid #ccc;
            vertical-align: middle;
        }
        pre {
            background: #f8f8f8;
            padding: 15px;
            border-radius: 4px;
            overflow-x: auto;
        }
        img {
            max-width: 100%;
            height: auto;
            border: 1px solid #ddd;
            border-radius: 4px;
            margin: 10px 0;
        }
        .screenshot-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
        }
    </style>
</head>
<body>
    <h1>Claude Code Log - Styling Investigation Report</h1>
    <p>Generated: ${new Date().toISOString()}</p>
    
    <div class="section">
        <h2>Current Color Scheme Analysis</h2>
        <h3>Text Colors</h3>
        <div>
            ${colorScheme.textColors.map(color => `
                <div style="margin: 5px 0;">
                    <span class="color-swatch" style="background: ${color};"></span>
                    <code>${color}</code>
                </div>
            `).join('')}
        </div>
        
        <h3>Background Colors</h3>
        <div>
            ${colorScheme.backgroundColors.map(color => `
                <div style="margin: 5px 0;">
                    <span class="color-swatch" style="background: ${color};"></span>
                    <code>${color}</code>
                </div>
            `).join('')}
        </div>
        
        <h3>CSS Variables</h3>
        <pre>${JSON.stringify(colorScheme.cssVariables, null, 2)}</pre>
    </div>
    
    <div class="section">
        <h2>Theme Information</h2>
        <pre>${JSON.stringify(themeInfo, null, 2)}</pre>
    </div>
    
    <div class="section">
        <h2>Screenshots</h2>
        <div class="screenshot-grid">
            <!-- Screenshots will be manually linked -->
            <p>Screenshots have been saved to the styling-investigation directory.</p>
        </div>
    </div>
    
    <div class="section">
        <h2>Key Findings</h2>
        <ul>
            <li>Navigation elements found: ${navElements.length}</li>
            <li>Sessions content found: ${sessionsFound ? 'Yes' : 'No'}</li>
            <li>Code blocks found: ${codeFound ? 'Yes' : 'No'}</li>
            <li>Current theme classes: ${themeInfo.possibleThemeClasses.join(', ') || 'None detected'}</li>
        </ul>
    </div>
    
    <div class="section">
        <h2>Recommended Next Steps</h2>
        <ol>
            <li>Review all screenshots in the styling-investigation directory</li>
            <li>Identify specific code styling issues</li>
            <li>Plan indigo theme implementation based on current structure</li>
            <li>Address any black code block issues found</li>
        </ol>
    </div>
</body>
</html>`;
    
    fs.writeFileSync(path.join(screenshotsDir, 'investigation-report.html'), reportHtml);
    
    console.log(`Investigation complete! Check the ${screenshotsDir} directory for:
    - Screenshots of all major sections
    - investigation-report.html with detailed findings
    - Color scheme and theme analysis`);
    
  } catch (error) {
    console.error('Error during investigation:', error);
    await page.screenshot({ 
      path: path.join(screenshotsDir, 'error-screenshot.png'),
      fullPage: true 
    });
  } finally {
    await browser.close();
  }
}

// Run the investigation
investigateAppStyling().catch(console.error);