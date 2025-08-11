/**
 * Test utilities for responsive layout components
 */

import { fixture, html, expect, oneEvent, waitUntil } from '@open-wc/testing';
import { MockResizeObserver, setupBrowserAPIMocks } from '../../__tests__/test-setup.js';
import type { ResponsiveLayout, BreakpointKey } from '../ResponsiveLayout.js';
import type { ResponsiveNav } from '../ResponsiveNav.js';
import type { SessionSummary } from '../../types/session-types.js';

/**
 * Mock viewport dimensions for testing
 */
export interface MockViewport {
  width: number;
  height: number;
  breakpoint: BreakpointKey;
}

/**
 * Standard breakpoint test cases
 */
export const BREAKPOINT_TEST_CASES: MockViewport[] = [
  { width: 320, height: 568, breakpoint: 'mobile' }, // iPhone SE
  { width: 375, height: 812, breakpoint: 'mobile' }, // iPhone X
  { width: 640, height: 1024, breakpoint: 'sm' }, // Small tablet
  { width: 768, height: 1024, breakpoint: 'md' }, // iPad
  { width: 1024, height: 768, breakpoint: 'lg' }, // Desktop small
  { width: 1280, height: 800, breakpoint: 'xl' }, // Desktop large
  { width: 1920, height: 1080, breakpoint: 'xl' }, // Desktop FHD
];

/**
 * Mock ResizeObserver instance for responsive testing
 */
export class ResponsiveMockResizeObserver extends MockResizeObserver {
  /**
   * Simulate viewport resize and trigger breakpoint change
   */
  mockViewportResize(element: Element, viewport: MockViewport): void {
    // Mock window dimensions
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: viewport.width,
    });
    
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: viewport.height,
    });

    // Mock element dimensions to match viewport
    this.mockResize(element, {
      width: viewport.width,
      height: viewport.height,
    });
  }

  /**
   * Test breakpoint transitions by simulating multiple viewport changes
   */
  async mockBreakpointTransition(
    element: Element,
    fromViewport: MockViewport,
    toViewport: MockViewport,
    delay: number = 0
  ): Promise<void> {
    this.mockViewportResize(element, fromViewport);
    
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    this.mockViewportResize(element, toViewport);
  }
}

/**
 * Create a ResponsiveLayout element for testing
 */
export async function createResponsiveLayout(
  props: Partial<ResponsiveLayout> = {}
): Promise<ResponsiveLayout> {
  // Mock mobile viewport by default for consistent tests
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: 375, // Mobile width
  });
  
  Object.defineProperty(window, 'innerHeight', {
    writable: true,
    configurable: true,
    value: 812,
  });

  const defaultProps = {
    debug: true,
    hasSidebar: true,
    ...props,
  };

  const template = html`
    <responsive-layout 
      ?debug="${defaultProps.debug}"
      ?has-sidebar="${defaultProps.hasSidebar}"
      layout-template="${defaultProps.layoutTemplate || 'default'}"
    >
      <div slot="header">Test Header</div>
      <div slot="sidebar">Test Sidebar</div>
      <div>Test Content</div>
      <div slot="footer">Test Footer</div>
    </responsive-layout>
  `;

  const element = await fixture<ResponsiveLayout>(template);
  
  // Apply any additional properties
  Object.assign(element, props);
  await element.updateComplete;
  
  return element;
}

/**
 * Create a ResponsiveNav element for testing
 */
export async function createResponsiveNav(
  props: Partial<ResponsiveNav> = {}
): Promise<ResponsiveNav> {
  const defaultProps = {
    brand: 'Test Brand',
    brandHref: '/',
    items: [
      { label: 'Home', href: '/', active: true },
      { label: 'About', href: '/about' },
      { label: 'Contact', href: '/contact' },
    ],
    ...props,
  };

  const template = html`
    <responsive-nav 
      brand="${defaultProps.brand}"
      brand-href="${defaultProps.brandHref}"
      .items="${defaultProps.items}"
    >
    </responsive-nav>
  `;

  const element = await fixture<ResponsiveNav>(template);
  await element.updateComplete;
  
  return element;
}

/**
 * Generate sample session data for testing
 */
export function createSampleSessions(count: number = 5): SessionSummary[] {
  const sessions: SessionSummary[] = [];
  const now = new Date();
  
  for (let i = 0; i < count; i++) {
    const startTime = new Date(now.getTime() - (i + 1) * 60 * 60 * 1000); // Hours ago
    const isActive = i === 0; // First session is active
    
    sessions.push({
      sessionId: `test-session-${String(i + 1).padStart(3, '0')}`,
      title: `Test Session ${i + 1}`,
      startTime,
      endTime: isActive ? undefined : new Date(startTime.getTime() + 45 * 60 * 1000), // 45 min duration
      isActive,
      cwd: `/test/project-${i + 1}`,
      summary: `Test session ${i + 1} summary for testing responsive components`,
      tags: [`tag-${i + 1}`, 'test', i % 2 === 0 ? 'even' : 'odd'],
    });
  }
  
  return sessions;
}

/**
 * Wait for breakpoint change event or verify current breakpoint
 */
export async function waitForBreakpointChange(
  element: ResponsiveLayout,
  expectedBreakpoint: BreakpointKey,
  timeout: number = 1000
): Promise<CustomEvent | null> {
  // If already at expected breakpoint, return null (no event needed)
  if (element.breakpoint === expectedBreakpoint) {
    return null;
  }

  // Otherwise wait for the event
  try {
    const event = await oneEvent(element, 'breakpoint-change', { timeout });
    expect(event.detail.breakpoint).to.equal(expectedBreakpoint);
    return event;
  } catch (error) {
    // If timeout, check if we're now at the expected breakpoint
    if (element.breakpoint === expectedBreakpoint) {
      return null; // Success, just no event caught
    }
    throw error; // Re-throw timeout error
  }
}

/**
 * Test helper to simulate keyboard navigation
 */
export function simulateKeyPress(
  element: HTMLElement,
  key: string,
  options: KeyboardEventInit = {}
): void {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...options,
  });
  
  element.dispatchEvent(event);
}

/**
 * Test helper to simulate mobile menu interactions
 */
export class MobileMenuTester {
  constructor(private nav: ResponsiveNav) {}

  /**
   * Get hamburger toggle button
   */
  getToggleButton(): HTMLButtonElement | null {
    return this.nav.shadowRoot?.querySelector('.nav-toggle') as HTMLButtonElement;
  }

  /**
   * Get mobile menu element
   */
  getMobileMenu(): HTMLElement | null {
    return this.nav.shadowRoot?.querySelector('.nav-menu-mobile') as HTMLElement;
  }

  /**
   * Get close button
   */
  getCloseButton(): HTMLButtonElement | null {
    return this.nav.shadowRoot?.querySelector('.nav-close') as HTMLButtonElement;
  }

  /**
   * Check if mobile menu is open
   */
  isMenuOpen(): boolean {
    const menu = this.getMobileMenu();
    return menu?.classList.contains('open') || false;
  }

  /**
   * Toggle mobile menu
   */
  async toggleMenu(): Promise<void> {
    const button = this.getToggleButton();
    expect(button).to.exist;
    
    button?.click();
    await this.nav.updateComplete;
  }

  /**
   * Close mobile menu
   */
  async closeMenu(): Promise<void> {
    const button = this.getCloseButton();
    expect(button).to.exist;
    
    button?.click();
    await this.nav.updateComplete;
  }

  /**
   * Test keyboard navigation in mobile menu
   */
  async testKeyboardNavigation(): Promise<void> {
    // Open menu
    await this.toggleMenu();
    expect(this.isMenuOpen()).to.be.true;

    // Test Escape key closes menu
    simulateKeyPress(this.nav, 'Escape');
    await this.nav.updateComplete;
    expect(this.isMenuOpen()).to.be.false;
  }
}

/**
 * Set up responsive layout testing environment
 */
export function setupResponsiveTestEnvironment(): ResponsiveMockResizeObserver {
  setupBrowserAPIMocks();
  
  const mockResizeObserver = new ResponsiveMockResizeObserver(() => {});
  
  // Replace global ResizeObserver with our enhanced mock
  global.ResizeObserver = class {
    constructor(callback: ResizeObserverCallback) {
      return new ResponsiveMockResizeObserver(callback);
    }
  } as any;

  return mockResizeObserver;
}

/**
 * Assert element has expected CSS classes for breakpoint
 */
export function assertBreakpointClasses(
  element: HTMLElement,
  breakpoint: BreakpointKey
): void {
  const breakpointAttr = element.getAttribute('breakpoint');
  expect(breakpointAttr).to.equal(breakpoint);
}

/**
 * Assert layout template is applied correctly
 */
export function assertLayoutTemplate(
  element: ResponsiveLayout,
  template: string
): void {
  const templateAttr = element.getAttribute('layout-template');
  expect(templateAttr).to.equal(template);
  
  const container = element.shadowRoot?.querySelector('.responsive-container');
  expect(container).to.exist;
  
  if (template !== 'default') {
    expect(container?.classList.contains(`layout-template-${template}`)).to.be.true;
  }
}

/**
 * Wait for element to be rendered and stable
 */
export async function waitForRender(element: HTMLElement): Promise<void> {
  await element.updateComplete;
  
  // Wait for any additional render cycles
  await new Promise(resolve => setTimeout(resolve, 0));
  
  if (element.updateComplete) {
    await element.updateComplete;
  }
}

/**
 * Performance testing utilities
 */
export class ResponsivePerformanceTester {
  private startTime: number = 0;
  private measurements: Array<{ name: string; duration: number }> = [];

  startMeasurement(name: string): void {
    this.startTime = performance.now();
  }

  endMeasurement(name: string): number {
    const duration = performance.now() - this.startTime;
    this.measurements.push({ name, duration });
    return duration;
  }

  getMeasurements(): Array<{ name: string; duration: number }> {
    return [...this.measurements];
  }

  reset(): void {
    this.measurements = [];
  }

  assertPerformance(maxDuration: number): void {
    const lastMeasurement = this.measurements[this.measurements.length - 1];
    expect(lastMeasurement).to.exist;
    expect(lastMeasurement.duration).to.be.lessThan(maxDuration);
  }
}

/**
 * Memory leak testing utilities
 */
export class MemoryLeakTester {
  private initialMemory: number = 0;

  startTest(): void {
    if (performance.memory) {
      this.initialMemory = performance.memory.usedJSHeapSize;
    }
  }

  checkForLeaks(maxIncrease: number = 1024 * 1024): void { // 1MB default
    if (performance.memory) {
      const currentMemory = performance.memory.usedJSHeapSize;
      const increase = currentMemory - this.initialMemory;
      expect(increase).to.be.lessThan(maxIncrease);
    }
  }
}