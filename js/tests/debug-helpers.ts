import { Page, BrowserContext, expect } from '@playwright/test';
import fs from 'fs/promises';
import path from 'path';

/**
 * Advanced Debug Helpers for Claude Code Log Testing
 * 
 * Comprehensive debugging utilities for manual testing and troubleshooting:
 * - Visual comparison testing
 * - Performance monitoring
 * - Network request analysis
 * - Component state inspection
 * - Interactive debugging tools
 */

export class DebugHelpers {
  private screenshotCounter = 0;
  private networkLogs: NetworkRequest[] = [];
  private performanceMetrics: PerformanceMetric[] = [];

  constructor(private page: Page, private context: BrowserContext) {
    this.setupNetworkLogging();
    this.setupPerformanceMonitoring();
  }

  /**
   * Visual Testing & Screenshots
   */
  async takeVisualComparisonShot(testName: string, element?: string) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `visual-${testName}-${timestamp}.png`;
    
    const options = {
      path: `test-results/visual-comparisons/${filename}`,
      fullPage: !element,
      clip: element ? await this.getElementBoundingBox(element) : undefined
    };

    await fs.mkdir('test-results/visual-comparisons', { recursive: true });
    await this.page.screenshot(options);
    
    console.log(`📸 Visual comparison screenshot: ${filename}`);
    return filename;
  }

  async takeProgressiveScreenshots(testName: string, steps: string[], actionCallback: () => Promise<void>) {
    console.log(`📷 Starting progressive screenshot sequence: ${testName}`);
    
    for (let i = 0; i < steps.length; i++) {
      await this.takeVisualComparisonShot(`${testName}-step-${i + 1}-${steps[i]}`);
      
      if (i < steps.length - 1) {
        await actionCallback();
        await this.page.waitForTimeout(1000); // Wait for state changes
      }
    }
    
    console.log(`✅ Progressive screenshots completed for: ${testName}`);
  }

  private async getElementBoundingBox(selector: string) {
    return await this.page.locator(selector).boundingBox();
  }

  /**
   * Network Analysis
   */
  private setupNetworkLogging() {
    this.page.on('request', request => {
      this.networkLogs.push({
        type: 'request',
        method: request.method(),
        url: request.url(),
        timestamp: Date.now(),
        headers: request.headers(),
        postData: request.postData()
      });
    });

    this.page.on('response', response => {
      this.networkLogs.push({
        type: 'response',
        status: response.status(),
        statusText: response.statusText(),
        url: response.url(),
        timestamp: Date.now(),
        headers: response.headers()
      });
    });
  }

  async analyzeNetworkActivity(testName: string) {
    const analysis = {
      totalRequests: this.networkLogs.filter(log => log.type === 'request').length,
      failedRequests: this.networkLogs.filter(log => log.type === 'response' && log.status >= 400).length,
      apiCalls: this.networkLogs.filter(log => log.url?.includes('/api/')).length,
      staticAssets: this.networkLogs.filter(log => 
        log.url?.match(/\.(js|css|png|jpg|svg|ico|woff|woff2)$/)
      ).length,
      avgResponseTime: 0,
      slowRequests: [] as NetworkRequest[]
    };

    // Calculate response times for requests with matching responses
    const requests = this.networkLogs.filter(log => log.type === 'request');
    const responses = this.networkLogs.filter(log => log.type === 'response');
    
    let totalResponseTime = 0;
    let responseCount = 0;

    for (const request of requests) {
      const matchingResponse = responses.find(res => 
        res.url === request.url && res.timestamp > request.timestamp
      );
      
      if (matchingResponse) {
        const responseTime = matchingResponse.timestamp - request.timestamp;
        totalResponseTime += responseTime;
        responseCount++;
        
        if (responseTime > 2000) { // Slow requests > 2 seconds
          analysis.slowRequests.push({
            ...request,
            responseTime
          });
        }
      }
    }

    analysis.avgResponseTime = responseCount > 0 ? totalResponseTime / responseCount : 0;

    await this.saveNetworkAnalysis(testName, analysis);
    return analysis;
  }

  private async saveNetworkAnalysis(testName: string, analysis: any) {
    const filename = `network-analysis-${testName}-${Date.now()}.json`;
    const filepath = path.join('test-results/network-analysis', filename);
    
    await fs.mkdir('test-results/network-analysis', { recursive: true });
    await fs.writeFile(filepath, JSON.stringify(analysis, null, 2));
    
    console.log(`🌐 Network analysis saved: ${filepath}`);
    console.log(`📊 Analysis summary:`, {
      totalRequests: analysis.totalRequests,
      failedRequests: analysis.failedRequests,
      avgResponseTime: `${analysis.avgResponseTime.toFixed(2)}ms`,
      slowRequests: analysis.slowRequests.length
    });
  }

  /**
   * Performance Monitoring
   */
  private setupPerformanceMonitoring() {
    this.page.on('load', async () => {
      const metrics = await this.page.evaluate(() => {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        return {
          domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
          loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
          firstPaint: performance.getEntriesByName('first-paint')[0]?.startTime || 0,
          firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0,
          largestContentfulPaint: 0, // Would need observer
        };
      });

      this.performanceMetrics.push({
        timestamp: Date.now(),
        testName: 'page-load',
        ...metrics
      });
    });
  }

  async measureInteractionPerformance(actionName: string, action: () => Promise<void>) {
    const startTime = Date.now();
    
    await action();
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    this.performanceMetrics.push({
      timestamp: startTime,
      testName: actionName,
      duration,
      type: 'interaction'
    });

    console.log(`⚡ ${actionName} completed in ${duration}ms`);
    return duration;
  }

  async getPerformanceReport(testName: string) {
    const report = {
      testName,
      timestamp: new Date().toISOString(),
      metrics: this.performanceMetrics,
      summary: {
        totalInteractions: this.performanceMetrics.filter(m => m.type === 'interaction').length,
        avgInteractionTime: 0,
        slowestInteraction: null as PerformanceMetric | null,
        pageLoadMetrics: this.performanceMetrics.filter(m => m.testName === 'page-load')
      }
    };

    const interactions = report.metrics.filter(m => m.type === 'interaction');
    if (interactions.length > 0) {
      report.summary.avgInteractionTime = interactions.reduce((sum, m) => sum + (m.duration || 0), 0) / interactions.length;
      report.summary.slowestInteraction = interactions.reduce((slowest, current) => 
        (current.duration || 0) > (slowest?.duration || 0) ? current : slowest
      );
    }

    await this.savePerformanceReport(testName, report);
    return report;
  }

  private async savePerformanceReport(testName: string, report: any) {
    const filename = `performance-${testName}-${Date.now()}.json`;
    const filepath = path.join('test-results/performance', filename);
    
    await fs.mkdir('test-results/performance', { recursive: true });
    await fs.writeFile(filepath, JSON.stringify(report, null, 2));
    
    console.log(`📈 Performance report saved: ${filepath}`);
  }

  /**
   * Component State Inspection
   */
  async inspectLitComponent(tagName: string) {
    const componentState = await this.page.evaluate((tag) => {
      const element = document.querySelector(tag) as any;
      if (!element) return null;

      return {
        tagName: element.tagName,
        connected: element.isConnected,
        hasUpdated: element.hasUpdated || false,
        properties: Object.getOwnPropertyNames(element).reduce((props: any, prop) => {
          try {
            const value = element[prop];
            if (typeof value !== 'function' && prop !== 'shadowRoot') {
              props[prop] = value;
            }
          } catch (e) {
            // Some properties may not be accessible
          }
          return props;
        }, {}),
        shadowDom: element.shadowRoot ? {
          hasChildren: element.shadowRoot.children.length > 0,
          innerHTML: element.shadowRoot.innerHTML.substring(0, 500) // Truncated for readability
        } : null
      };
    }, tagName);

    console.log(`🔍 Component inspection for ${tagName}:`, componentState);
    return componentState;
  }

  async getAllComponentStates() {
    const components = ['app-main', 'connection-status', 'toast-notifications'];
    const states: { [key: string]: any } = {};

    for (const component of components) {
      states[component] = await this.inspectLitComponent(component);
    }

    await this.saveComponentStates(states);
    return states;
  }

  private async saveComponentStates(states: any) {
    const filename = `component-states-${Date.now()}.json`;
    const filepath = path.join('test-results/component-states', filename);
    
    await fs.mkdir('test-results/component-states', { recursive: true });
    
    // Create a circular reference-safe replacer
    const seen = new WeakSet();
    const safeStates = JSON.stringify(states, (key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) return '[Circular Reference]';
        seen.add(value);
      }
      // Skip Lit internal properties that cause circular refs
      if (key.startsWith('_$') || key.startsWith('__')) return '[Internal Property]';
      return value;
    }, 2);
    
    await fs.writeFile(filepath, safeStates);
    
    console.log(`🧩 Component states saved: ${filepath}`);
  }

  /**
   * Interactive Debugging Tools
   */
  async enableInteractiveMode() {
    console.log('🎮 Enabling interactive debugging mode...');
    
    await this.page.addInitScript(() => {
      (window as any).testDebug = {
        // Expose debugging functions to browser console
        takeScreenshot: () => console.log('Screenshot function available'),
        inspectElement: (selector: string) => {
          const element = document.querySelector(selector);
          console.log('Element inspection:', element);
          return element;
        },
        getAppState: () => {
          const app = document.querySelector('app-main') as any;
          return app ? {
            users: app.users,
            logs: app.logs,
            connectionState: app.connectionState,
            statistics: app.connectionStatistics
          } : 'App not found';
        },
        triggerEvent: (selector: string, eventType: string) => {
          const element = document.querySelector(selector);
          if (element) {
            element.dispatchEvent(new Event(eventType, { bubbles: true }));
          }
        }
      };
    });

    console.log('✅ Interactive mode enabled. Use browser console: window.testDebug');
  }

  async pauseForInspection(message?: string) {
    if (message) {
      console.log(`⏸️  ${message}`);
    }
    
    // Add a visual indicator on the page
    await this.page.addStyleTag({
      content: `
        .debug-pause-indicator {
          position: fixed;
          top: 20px;
          right: 20px;
          background: #ff6b35;
          color: white;
          padding: 10px 15px;
          border-radius: 5px;
          font-family: monospace;
          z-index: 10000;
          box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        }
      `
    });

    await this.page.evaluate(() => {
      const indicator = document.createElement('div');
      indicator.className = 'debug-pause-indicator';
      indicator.textContent = '🐛 DEBUG MODE - Test Paused';
      document.body.appendChild(indicator);
    });

    if (process.env.HEADED === 'true' || process.env.DEBUG === 'true') {
      await this.page.pause();
    } else {
      console.log('💡 Run with HEADED=true or DEBUG=true to enable pause functionality');
    }
  }

  /**
   * Comprehensive Test Report Generation
   */
  async generateComprehensiveReport(testName: string) {
    console.log('📋 Generating comprehensive test report...');
    
    const report = {
      testName,
      timestamp: new Date().toISOString(),
      environment: {
        userAgent: await this.page.evaluate(() => navigator.userAgent),
        viewport: await this.page.viewportSize(),
        url: this.page.url()
      },
      networkAnalysis: await this.analyzeNetworkActivity(testName),
      performanceReport: await this.getPerformanceReport(testName),
      componentStates: await this.getAllComponentStates(),
      screenshots: await this.takeVisualComparisonShot(`${testName}-final`)
    };

    const reportPath = path.join('test-results/comprehensive-reports', `${testName}-report-${Date.now()}.json`);
    await fs.mkdir('test-results/comprehensive-reports', { recursive: true });
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

    console.log(`📊 Comprehensive report generated: ${reportPath}`);
    return report;
  }

  /**
   * Cleanup
   */
  reset() {
    this.screenshotCounter = 0;
    this.networkLogs = [];
    this.performanceMetrics = [];
  }
}

// Type definitions
interface NetworkRequest {
  type: 'request' | 'response';
  method?: string;
  status?: number;
  statusText?: string;
  url?: string;
  timestamp: number;
  headers?: { [key: string]: string };
  postData?: string | null;
  responseTime?: number;
}

interface PerformanceMetric {
  timestamp: number;
  testName: string;
  duration?: number;
  type?: string;
  domContentLoaded?: number;
  loadComplete?: number;
  firstPaint?: number;
  firstContentfulPaint?: number;
  largestContentfulPaint?: number;
}

// Factory function
export function createDebugHelpers(page: Page, context: BrowserContext): DebugHelpers {
  return new DebugHelpers(page, context);
}