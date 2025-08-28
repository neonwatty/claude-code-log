import { Page, expect } from '@playwright/test';
import fs from 'fs/promises';
import path from 'path';

/**
 * Test Utilities for Claude Code Log E2E Tests
 * 
 * Helper functions for common testing operations:
 * - API testing helpers
 * - UI interaction helpers  
 * - Data validation helpers
 * - Debug utilities
 */

export class TestUtils {
  constructor(private page: Page) {}

  /**
   * API Testing Helpers
   */
  async apiGet(endpoint: string) {
    const response = await this.page.request.get(`http://localhost:3002${endpoint}`);
    return {
      status: response.status(),
      data: await response.json(),
      headers: response.headers()
    };
  }

  async apiPost(endpoint: string, data: any) {
    const response = await this.page.request.post(`http://localhost:3002${endpoint}`, {
      data: JSON.stringify(data),
      headers: { 'Content-Type': 'application/json' }
    });
    return {
      status: response.status(),
      data: await response.json(),
      headers: response.headers()
    };
  }

  /**
   * Wait for the application to be fully loaded
   */
  async waitForAppReady() {
    await this.page.waitForSelector('app-main', { state: 'attached' });
    await this.page.waitForSelector('.app-header', { state: 'visible' });
    
    // Wait for any initial loading to complete
    await this.page.waitForFunction(() => {
      const app = document.querySelector('app-main');
      return app && !app.querySelector('.loading');
    });
  }

  /**
   * WebSocket Testing Helpers
   */
  async waitForWebSocketConnection() {
    // Wait for connection status to show "Connected"
    await this.page.waitForSelector('connection-status', { state: 'visible' });
    
    // Check that we're not in a disconnected state
    const connectionButton = this.page.locator('.connection-button').first();
    await expect(connectionButton).toContainText('Disconnect');
  }

  async triggerWebSocketReconnection() {
    const reconnectButton = this.page.locator('.connection-button').last();
    await reconnectButton.click();
    await this.waitForWebSocketConnection();
  }

  /**
   * Session Management Helpers
   */
  async navigateToSessions() {
    // Navigate to sessions view (when that navigation is implemented)
    // For now, sessions are loaded automatically
    await this.waitForAppReady();
  }

  async selectSession(sessionId: string) {
    // Look for session in the UI and click it
    await this.page.locator(`[data-session-id="${sessionId}"]`).click();
  }

  /**
   * Data Validation Helpers
   */
  async validateApiResponse(response: any, expectedStructure: any) {
    expect(response.data).toHaveProperty('success');
    expect(response.data).toHaveProperty('timestamp');
    
    if (expectedStructure.data) {
      expect(response.data).toHaveProperty('data');
      
      // Validate nested data structure
      for (const [key, value] of Object.entries(expectedStructure.data)) {
        expect(response.data.data).toHaveProperty(key);
        if (typeof value === 'string') {
          expect(typeof response.data.data[key]).toBe(value);
        }
      }
    }
  }

  async validateSessionData(session: any) {
    expect(session).toHaveProperty('id');
    expect(session).toHaveProperty('entries');
    expect(session).toHaveProperty('firstTimestamp');
    expect(session).toHaveProperty('lastTimestamp');
    expect(session).toHaveProperty('cwd');
    expect(session).toHaveProperty('totalUsage');
    
    // Validate entries structure
    expect(Array.isArray(session.entries)).toBe(true);
    if (session.entries.length > 0) {
      const entry = session.entries[0];
      expect(entry).toHaveProperty('sessionId');
      expect(entry).toHaveProperty('timestamp');
      expect(entry).toHaveProperty('type');
      expect(entry).toHaveProperty('message');
    }
  }

  /**
   * Debug Utilities
   */
  async takeDebugScreenshot(name: string) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `debug-${name}-${timestamp}.png`;
    await this.page.screenshot({ 
      path: `test-results/debug-screenshots/${filename}`,
      fullPage: true 
    });
    console.log(`📸 Debug screenshot taken: ${filename}`);
  }

  async logPageErrors() {
    // Set up error logging
    this.page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('❌ Page Error:', msg.text());
      }
    });

    this.page.on('pageerror', error => {
      console.log('💥 Page Exception:', error.message);
    });
  }

  async logNetworkActivity() {
    this.page.on('request', request => {
      console.log('🌐 Request:', request.method(), request.url());
    });

    this.page.on('response', response => {
      console.log('📬 Response:', response.status(), response.url());
    });
  }

  /**
   * Load test fixture data into the application
   */
  async loadTestFixtures() {
    const fixturesPath = path.join(__dirname, 'fixtures');
    
    // Copy test fixtures to a location where the app can find them
    const testSessionPath = path.join(fixturesPath, 'test-session.jsonl');
    const appTestPath = path.join(process.cwd(), 'test-session-fixture.jsonl');
    
    try {
      await fs.copyFile(testSessionPath, appTestPath);
      console.log('📋 Test fixtures loaded into application');
    } catch (error) {
      console.log('⚠️  Could not load test fixtures:', error);
    }
  }

  /**
   * Clean up test fixtures
   */
  async cleanupTestFixtures() {
    const testFixturePaths = [
      path.join(process.cwd(), 'test-session-fixture.jsonl'),
      path.join(process.cwd(), 'multi-session-fixture.jsonl')
    ];

    for (const filePath of testFixturePaths) {
      try {
        await fs.unlink(filePath);
      } catch (error) {
        // File might not exist, ignore error
      }
    }
  }

  /**
   * Wait for element with better error messaging
   */
  async waitForElement(selector: string, timeout = 10000) {
    try {
      await this.page.waitForSelector(selector, { timeout });
    } catch (error) {
      await this.takeDebugScreenshot(`element-not-found-${selector.replace(/[^a-zA-Z0-9]/g, '-')}`);
      throw new Error(`Element not found: ${selector}. Debug screenshot taken.`);
    }
  }

  /**
   * Interact with Lit components safely
   */
  async waitForLitComponent(tagName: string) {
    await this.page.waitForFunction((tag) => {
      const element = document.querySelector(tag);
      return element && element.shadowRoot;
    }, tagName);
  }

  /**
   * Extract statistics from the dashboard
   */
  async getDashboardStats() {
    // First wait for app-main to exist and have shadowRoot
    await this.page.waitForFunction(() => {
      const appMain = document.querySelector('app-main');
      return appMain && (appMain as any).shadowRoot;
    }, { timeout: 15000 });
    
    // Then wait for stats to be rendered in shadow root
    await this.page.waitForFunction(() => {
      const appMain = document.querySelector('app-main');
      if (!appMain || !(appMain as any).shadowRoot) return false;
      const statItems = (appMain as any).shadowRoot.querySelectorAll('.stat-item');
      return statItems.length >= 5; // Expect at least 5 stats based on screenshot
    }, { timeout: 10000 });
    
    const stats = await this.page.evaluate(() => {
      const appMain = document.querySelector('app-main');
      if (!appMain || !(appMain as any).shadowRoot) return [];
      
      const statItems = Array.from((appMain as any).shadowRoot.querySelectorAll('.stat-item'));
      return statItems.map(item => ({
        value: item.querySelector('.stat-value')?.textContent?.trim(),
        label: item.querySelector('.stat-label')?.textContent?.trim()
      }));
    });
    
    return stats;
  }

  /**
   * Check WebSocket message activity
   */
  async monitorWebSocketMessages(duration = 5000) {
    const messages: any[] = [];
    
    // Intercept WebSocket frames if possible
    this.page.on('websocket', ws => {
      ws.on('framesent', event => messages.push({ type: 'sent', data: event.payload }));
      ws.on('framereceived', event => messages.push({ type: 'received', data: event.payload }));
    });
    
    await this.page.waitForTimeout(duration);
    return messages;
  }
}

/**
 * Global test configuration and constants
 */
export const TEST_CONFIG = {
  API_BASE: 'http://localhost:3002',
  APP_BASE: 'http://localhost:5173',
  DEFAULT_TIMEOUT: 30000,
  
  // Test data constants
  TEST_SESSION_ID: '550e8400-e29b-41d4-a716-446655440000',
  TEST_PROJECT_PATH: '/Users/test/claude-code-log'
};

/**
 * Create test utilities instance
 */
export function createTestUtils(page: Page): TestUtils {
  return new TestUtils(page);
}