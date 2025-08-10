/**
 * Comprehensive test setup for Lit components
 * This file configures the test environment for proper Lit component testing
 */

// Essential polyfills for Web Components in test environment
import '@webcomponents/scoped-custom-element-registry/scoped-custom-element-registry.min.js';

/**
 * Configure Lit testing environment
 */
export function setupLitTesting() {

  // Ensure custom elements registry is available
  if (!globalThis.customElements) {
    // Import and set up CustomElementRegistry polyfill
    const { CustomElementRegistry } = require('@webcomponents/custom-elements');
    globalThis.customElements = new CustomElementRegistry();
  }

  // Ensure CustomEvent is available
  if (!globalThis.CustomEvent) {
    globalThis.CustomEvent = globalThis.Event;
  }

  // Set up proper event handling for tests
  if (!globalThis.addEventListener) {
    globalThis.addEventListener = () => {};
    globalThis.removeEventListener = () => {};
    globalThis.dispatchEvent = () => true;
  }

  // Mock window.matchMedia for theme detection in SyntaxHighlighter
  if (!globalThis.window.matchMedia) {
    globalThis.window.matchMedia = (query: string) => ({
      matches: false, // Default to light theme
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => true,
    });
  }
}

/**
 * Enhanced component property initialization for test reliability
 * This ensures Lit decorators work correctly even if transformation fails
 */
export function ensureComponentProperties(element: any, defaultProperties: Record<string, any>) {
  // Check if properties are undefined (decorator failure) and set defaults
  for (const [key, value] of Object.entries(defaultProperties)) {
    if (element[key] === undefined) {
      element[key] = value;
    }
  }
  return element;
}

/**
 * Create a reliable fixture for Lit components
 * Bypasses @open-wc/testing for better Web Components support
 */
export async function createReliableFixture<T extends Element>(
  template: any,
  defaultProperties?: Record<string, any>
): Promise<T> {
  // Extract tag name from template - lit template has strings array
  let tagName: string;
  
  if (template.strings && template.strings.length > 0) {
    // Parse lit-html template
    const htmlString = template.strings.join('');
    const match = htmlString.match(/<([a-z-]+)/);
    if (!match) {
      throw new Error('Could not extract tag name from template');
    }
    tagName = match[1];
  } else {
    throw new Error('Invalid template format');
  }
  
  // Ensure custom element is registered (critical for Web Components)
  const registeredElement = globalThis.customElements?.get(tagName);
  if (!registeredElement) {
    throw new Error(`Custom element "${tagName}" is not registered. Make sure the component class is imported and decorated with @customElement.`);
  }
  
  // Create element directly and append to DOM
  const element = document.createElement(tagName) as T;
  document.body.appendChild(element);
  
  // Apply property fallbacks if needed
  if (defaultProperties) {
    ensureComponentProperties(element, defaultProperties);
  }
  
  // Trigger Lit lifecycle manually if needed
  if ('connectedCallback' in element && typeof element.connectedCallback === 'function') {
    element.connectedCallback();
  }
  
  // Wait for component to be fully initialized
  if ('updateComplete' in element && typeof element.updateComplete === 'object') {
    await element.updateComplete;
  }
  
  return element;
}

/**
 * Create a reliable fixture for Lit components (fallback using @open-wc/testing)
 */
export async function createOpenWCFixture<T extends Element>(
  template: any,
  defaultProperties?: Record<string, any>
): Promise<T> {
  const { fixture } = await import('@open-wc/testing');
  const element = await fixture(template) as T;
  
  // Ensure component is fully initialized
  if ('updateComplete' in element && typeof element.updateComplete === 'object') {
    await element.updateComplete;
  }
  
  // Apply property fallbacks if needed
  if (defaultProperties) {
    ensureComponentProperties(element, defaultProperties);
  }
  
  return element;
}

/**
 * Test utilities for common component testing patterns
 */
export const testUtils = {
  /**
   * Wait for component to be fully ready
   */
  async waitForComponent(element: any): Promise<void> {
    if ('updateComplete' in element) {
      await element.updateComplete;
    }
    // Additional wait for any async rendering
    await new Promise(resolve => setTimeout(resolve, 0));
  },

  /**
   * Trigger a property change and wait for update
   */
  async updateProperty(element: any, property: string, value: any): Promise<void> {
    element[property] = value;
    await this.waitForComponent(element);
  },

  /**
   * Get shadow root content safely
   */
  getShadowContent(element: Element, selector: string): Element | null {
    if (!element.shadowRoot) return null;
    return element.shadowRoot.querySelector(selector);
  },

  /**
   * Check if element has specific CSS class
   */
  hasClass(element: Element, className: string): boolean {
    return element.classList.contains(className);
  },

  /**
   * Simulate user interaction events
   */
  async click(element: Element): Promise<void> {
    const event = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
    });
    element.dispatchEvent(event);
    await new Promise(resolve => setTimeout(resolve, 0));
  },
};

// Run setup immediately when imported
setupLitTesting();

// Global test configuration
console.log('🧪 Lit testing environment configured');