import { test, expect } from '@playwright/test';
import { createTestUtils, TestUtils } from '../utils';
import { createDebugHelpers, DebugHelpers } from '../debug-helpers';

/**
 * Manual Testing & Debug Suite
 * 
 * This specialized test suite is designed for manual validation and debugging:
 * 
 * 🐛 Debug Features:
 *   - Interactive debugging sessions
 *   - Visual comparison testing
 *   - Performance monitoring
 *   - Network analysis
 *   - Component state inspection
 * 
 * 🔧 Manual Testing Tools:
 *   - Step-by-step visual validation
 *   - Pause points for manual inspection
 *   - Comprehensive reporting
 *   - Browser console utilities
 * 
 * 💡 Usage:
 *   Run with: npx playwright test debug-manual-testing.spec.ts --headed --debug
 *   Or with: DEBUG=true HEADED=true npm run test:e2e
 */

test.describe('🐛 Debug & Manual Testing Suite', () => {
  let utils: TestUtils;
  let debug: DebugHelpers;

  test.beforeEach(async ({ page, context }) => {
    utils = createTestUtils(page);
    debug = createDebugHelpers(page, context);
    
    // Enable all debugging features
    await utils.logPageErrors();
    await utils.logNetworkActivity();
    await debug.enableInteractiveMode();
    
    console.log('🚀 Debug session started - Manual testing mode active');
  });

  test.afterEach(async () => {
    // Generate comprehensive report after each test
    await debug.generateComprehensiveReport('manual-testing-session');
    debug.reset();
  });

  test('🎯 Interactive Application Validation', async ({ page }) => {
    console.log('🎮 Starting Interactive Application Validation');
    console.log('📝 This test provides manual validation points with visual feedback');
    
    // Step 1: Load and validate initial state
    await page.goto('/');
    await debug.takeVisualComparisonShot('step-1-initial-load');
    await debug.pauseForInspection('Step 1: Validate initial application load - check for any visual issues');
    
    await utils.waitForAppReady();
    
    // Step 2: Validate main UI elements
    await debug.takeVisualComparisonShot('step-2-ui-elements');
    await debug.pauseForInspection('Step 2: Validate main UI elements are present and properly styled');
    
    await expect(page.locator('.app-title')).toContainText('Claude Code Log');
    await expect(page.locator('.stats-card')).toBeVisible();
    
    // Step 3: Test connection status
    await debug.measureInteractionPerformance('connection-status-check', async () => {
      await expect(page.locator('connection-status')).toBeVisible();
      await expect(page.locator('.connection-button')).toHaveCount(2);
    });
    
    await debug.takeVisualComparisonShot('step-3-connection-status');
    await debug.pauseForInspection('Step 3: Validate connection status display and controls');
    
    // Step 4: Test connection interactions
    await debug.measureInteractionPerformance('connection-button-interaction', async () => {
      const connectButton = page.locator('.connection-button').first();
      await connectButton.click();
      await page.waitForTimeout(2000); // Wait for connection attempt
    });
    
    await debug.takeVisualComparisonShot('step-4-connection-interaction');
    await debug.pauseForInspection('Step 4: Validate connection button interaction and state changes');
    
    // Step 5: Test reconnection
    await debug.measureInteractionPerformance('reconnection-test', async () => {
      const reconnectButton = page.locator('.connection-button').last();
      await reconnectButton.click();
      await page.waitForTimeout(2000);
    });
    
    await debug.takeVisualComparisonShot('step-5-reconnection');
    await debug.pauseForInspection('Step 5: Validate reconnection functionality and UI feedback');
    
    // Step 6: Component state inspection
    const componentStates = await debug.getAllComponentStates();
    console.log('🧩 Current component states:', componentStates);
    
    await debug.takeVisualComparisonShot('step-6-final-state');
    await debug.pauseForInspection('Step 6: Final state validation - check component states and overall app health');
    
    console.log('✅ Interactive validation completed');
  });

  test('📊 Performance Analysis Session', async ({ page }) => {
    console.log('⚡ Starting Performance Analysis Session');
    
    // Measure initial load performance
    const loadStartTime = Date.now();
    await page.goto('/');
    await utils.waitForAppReady();
    const loadTime = Date.now() - loadStartTime;
    
    console.log(`📈 Initial load time: ${loadTime}ms`);
    await debug.takeVisualComparisonShot('performance-initial-load');
    
    // Test rapid interactions
    console.log('🔄 Testing rapid interactions...');
    const interactionTimes: number[] = [];
    
    for (let i = 0; i < 10; i++) {
      const duration = await debug.measureInteractionPerformance(
        `rapid-interaction-${i + 1}`,
        async () => {
          const reconnectButton = page.locator('.connection-button').last();
          await reconnectButton.click();
          await page.waitForTimeout(100);
        }
      );
      interactionTimes.push(duration);
    }
    
    const avgInteractionTime = interactionTimes.reduce((a, b) => a + b, 0) / interactionTimes.length;
    console.log(`⚡ Average interaction time: ${avgInteractionTime.toFixed(2)}ms`);
    
    await debug.takeVisualComparisonShot('performance-rapid-interactions');
    await debug.pauseForInspection(
      `Performance Analysis:\n` +
      `- Load time: ${loadTime}ms\n` +
      `- Avg interaction time: ${avgInteractionTime.toFixed(2)}ms\n` +
      `- Check for any UI lag or performance issues`
    );
    
    // Generate performance report
    const perfReport = await debug.getPerformanceReport('manual-performance-test');
    console.log('📊 Performance report generated');
  });

  test('🌐 Network Activity Analysis', async ({ page }) => {
    console.log('🌍 Starting Network Activity Analysis');
    
    // Clear network logs and start fresh
    debug.reset();
    
    // Load application and monitor network
    await page.goto('/');
    await utils.waitForAppReady();
    
    // Trigger various network activities
    await debug.measureInteractionPerformance('api-interaction-test', async () => {
      // Test API calls through UI interactions
      const reconnectButton = page.locator('.connection-button').last();
      await reconnectButton.click();
      await page.waitForTimeout(3000); // Allow time for any API calls
    });
    
    // Analyze network activity
    const networkAnalysis = await debug.analyzeNetworkActivity('manual-network-test');
    
    await debug.takeVisualComparisonShot('network-analysis-state');
    await debug.pauseForInspection(
      `Network Analysis Results:\n` +
      `- Total requests: ${networkAnalysis.totalRequests}\n` +
      `- Failed requests: ${networkAnalysis.failedRequests}\n` +
      `- API calls: ${networkAnalysis.apiCalls}\n` +
      `- Avg response time: ${networkAnalysis.avgResponseTime.toFixed(2)}ms\n` +
      `- Check network tab for any issues`
    );
    
    console.log('🌐 Network analysis completed');
  });

  test('🧩 Component Deep Dive', async ({ page }) => {
    console.log('🔍 Starting Component Deep Dive Analysis');
    
    await page.goto('/');
    await utils.waitForAppReady();
    
    // Inspect all major components
    const components = ['app-main', 'connection-status', 'toast-notifications'];
    
    for (const component of components) {
      console.log(`\n🧩 Inspecting component: ${component}`);
      
      const componentState = await debug.inspectLitComponent(component);
      
      if (componentState) {
        console.log(`✅ ${component} is connected:`, componentState.connected);
        console.log(`📊 ${component} has updated:`, componentState.hasUpdated);
        console.log(`🎨 ${component} has shadow DOM:`, !!componentState.shadowDom);
        
        await debug.takeVisualComparisonShot(`component-${component}`);
      } else {
        console.log(`❌ ${component} not found`);
      }
    }
    
    // Test component interactions
    await debug.pauseForInspection(
      'Component Analysis:\n' +
      '- Check component states in console output\n' +
      '- Verify all components are properly connected\n' +
      '- Test component interactions manually'
    );
    
    console.log('🧩 Component deep dive completed');
  });

  test('🎬 Progressive Visual Testing', async ({ page }) => {
    console.log('📸 Starting Progressive Visual Testing');
    
    const testSteps = [
      'initial-load',
      'after-ready-state',
      'connection-interaction',
      'reconnection-test',
      'final-state'
    ];
    
    let stepIndex = 0;
    
    await debug.takeProgressiveScreenshots(
      'full-workflow-visual-test',
      testSteps,
      async () => {
        switch (stepIndex) {
          case 0:
            await page.goto('/');
            break;
          case 1:
            await utils.waitForAppReady();
            break;
          case 2:
            const connectButton = page.locator('.connection-button').first();
            await connectButton.click();
            await page.waitForTimeout(1000);
            break;
          case 3:
            const reconnectButton = page.locator('.connection-button').last();
            await reconnectButton.click();
            await page.waitForTimeout(1000);
            break;
        }
        stepIndex++;
      }
    );
    
    await debug.pauseForInspection(
      'Progressive Visual Testing:\n' +
      '- Review all captured screenshots\n' +
      '- Check for visual regressions\n' +
      '- Validate UI state transitions'
    );
    
    console.log('📸 Progressive visual testing completed');
  });

  test('🚨 Error Handling & Recovery Testing', async ({ page }) => {
    console.log('🚨 Starting Error Handling & Recovery Testing');
    
    await page.goto('/');
    await utils.waitForAppReady();
    
    // Test various error scenarios
    await debug.takeVisualComparisonShot('error-test-initial');
    
    // Test navigation to non-existent route
    await debug.measureInteractionPerformance('error-navigation-test', async () => {
      await page.goto('/non-existent-route');
      await page.waitForTimeout(2000);
    });
    
    await debug.takeVisualComparisonShot('error-test-404');
    await debug.pauseForInspection('Error Test 1: Check how app handles invalid routes');
    
    // Return to main app
    await debug.measureInteractionPerformance('error-recovery-test', async () => {
      await page.goto('/');
      await utils.waitForAppReady();
    });
    
    await debug.takeVisualComparisonShot('error-test-recovery');
    await debug.pauseForInspection('Error Test 2: Validate app recovery from error state');
    
    // Test offline scenario
    await debug.measureInteractionPerformance('offline-test', async () => {
      await page.context().setOffline(true);
      await page.waitForTimeout(2000);
    });
    
    await debug.takeVisualComparisonShot('error-test-offline');
    await debug.pauseForInspection('Error Test 3: Check offline handling and user feedback');
    
    // Go back online
    await debug.measureInteractionPerformance('online-recovery-test', async () => {
      await page.context().setOffline(false);
      await page.waitForTimeout(2000);
    });
    
    await debug.takeVisualComparisonShot('error-test-online-recovery');
    await debug.pauseForInspection('Error Test 4: Validate online recovery and reconnection');
    
    console.log('🚨 Error handling testing completed');
  });

  test('🎮 Interactive Debug Console Session', async ({ page }) => {
    console.log('🎮 Starting Interactive Debug Console Session');
    
    await page.goto('/');
    await utils.waitForAppReady();
    
    // Set up comprehensive debugging environment
    await page.addInitScript(() => {
      (window as any).manualDebug = {
        // App state inspection
        getFullAppState: () => {
          const app = document.querySelector('app-main') as any;
          return {
            element: app,
            users: app?.users,
            logs: app?.logs,
            connectionState: app?.connectionState,
            statistics: app?.connectionStatistics,
            isLoading: app?.isLoading,
            error: app?.error,
            darkMode: app?.darkMode
          };
        },
        
        // Component testing
        testComponent: (selector: string) => {
          const element = document.querySelector(selector);
          if (!element) return { error: 'Component not found' };
          
          return {
            tagName: element.tagName,
            connected: element.isConnected,
            visible: !!(element as any).offsetParent,
            shadowRoot: !!(element as any).shadowRoot,
            properties: Object.getOwnPropertyNames(element).filter(prop => 
              !prop.startsWith('_') && typeof (element as any)[prop] !== 'function'
            ).reduce((obj: any, prop) => {
              obj[prop] = (element as any)[prop];
              return obj;
            }, {})
          };
        },
        
        // Event testing
        triggerEvent: (selector: string, eventType: string, detail?: any) => {
          const element = document.querySelector(selector);
          if (element) {
            const event = new CustomEvent(eventType, { 
              detail, 
              bubbles: true, 
              composed: true 
            });
            element.dispatchEvent(event);
            return { success: true, message: `Event ${eventType} triggered on ${selector}` };
          }
          return { success: false, message: `Element ${selector} not found` };
        },
        
        // Style testing
        getComputedStyles: (selector: string) => {
          const element = document.querySelector(selector);
          if (element) {
            const styles = window.getComputedStyle(element);
            return {
              display: styles.display,
              visibility: styles.visibility,
              opacity: styles.opacity,
              position: styles.position,
              width: styles.width,
              height: styles.height,
              backgroundColor: styles.backgroundColor,
              color: styles.color
            };
          }
          return { error: 'Element not found' };
        }
      };
      
      console.log('🎮 Manual debug utilities loaded!');
      console.log('📝 Available commands:');
      console.log('  - manualDebug.getFullAppState() - Get complete app state');
      console.log('  - manualDebug.testComponent(selector) - Test component');
      console.log('  - manualDebug.triggerEvent(selector, event) - Trigger events');
      console.log('  - manualDebug.getComputedStyles(selector) - Get element styles');
    });
    
    await debug.takeVisualComparisonShot('debug-console-ready');
    
    console.log('\n🎮 Interactive Debug Console Ready!');
    console.log('📖 Available browser console commands:');
    console.log('   window.manualDebug.getFullAppState()');
    console.log('   window.manualDebug.testComponent("app-main")');
    console.log('   window.manualDebug.triggerEvent(".connection-button", "click")');
    console.log('   window.manualDebug.getComputedStyles(".app-title")');
    console.log('\n💡 Browser DevTools are your friend! Check:');
    console.log('   - Elements tab for DOM inspection');
    console.log('   - Network tab for request monitoring');
    console.log('   - Console tab for debug commands');
    console.log('   - Application tab for storage/service workers');
    
    await debug.pauseForInspection(
      'Interactive Debug Session:\n' +
      '- Open browser DevTools (F12)\n' +
      '- Use console commands listed above\n' +
      '- Inspect application state manually\n' +
      '- Test various interactions\n' +
      '- Check for any issues or unexpected behavior'
    );
    
    // Generate final comprehensive report
    await debug.generateComprehensiveReport('interactive-debug-session');
    
    console.log('🎮 Interactive debug session completed');
  });
});