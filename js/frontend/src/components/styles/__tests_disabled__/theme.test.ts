import { assert } from '@open-wc/testing';
import { fixture, html } from '@open-wc/testing';
import { LitElement, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import {
  themeTokens,
  commonStyles,
  buttonStyles,
  formStyles,
  cardStyles,
  baseStyles,
} from '../theme';

@customElement('test-theme-component')
class TestThemeComponent extends LitElement {
  static styles = [baseStyles];

  render() {
    return html`
      <div class="themed-content">
        <button class="btn btn-primary">Primary Button</button>
        <button class="btn btn-secondary">Secondary Button</button>
        <input class="form-input" type="text" placeholder="Test input" />
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Card Title</h3>
          </div>
          <div class="card-body">
            <p>Card content</p>
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'test-theme-component': TestThemeComponent;
  }
}

describe('Theme System', () => {
  let element: TestThemeComponent;

  beforeEach(async () => {
    element = await fixture(html`<test-theme-component></test-theme-component>`);
  });

  describe('CSS Custom Properties', () => {
    it('should define color tokens', () => {
      const styles = getComputedStyle(element);
      
      // Test primary colors
      const primaryColor = styles.getPropertyValue('--color-primary').trim();
      assert.isNotEmpty(primaryColor);
      
      // Test background colors
      const backgroundColor = styles.getPropertyValue('--color-background').trim();
      assert.isNotEmpty(backgroundColor);
      
      // Test text colors
      const textColor = styles.getPropertyValue('--color-text-primary').trim();
      assert.isNotEmpty(textColor);
    });

    it('should define spacing tokens', () => {
      const styles = getComputedStyle(element);
      
      const spaceSm = styles.getPropertyValue('--space-sm').trim();
      const spaceMd = styles.getPropertyValue('--space-md').trim();
      const spaceLg = styles.getPropertyValue('--space-lg').trim();
      
      assert.isNotEmpty(spaceSm);
      assert.isNotEmpty(spaceMd);
      assert.isNotEmpty(spaceLg);
    });

    it('should define typography tokens', () => {
      const styles = getComputedStyle(element);
      
      const fontFamily = styles.getPropertyValue('--font-family-primary').trim();
      const fontMono = styles.getPropertyValue('--font-family-mono').trim();
      const fontSize = styles.getPropertyValue('--font-size-base').trim();
      
      assert.isNotEmpty(fontFamily);
      assert.isNotEmpty(fontMono);
      assert.isNotEmpty(fontSize);
    });

    it('should define border and shadow tokens', () => {
      const styles = getComputedStyle(element);
      
      const borderRadius = styles.getPropertyValue('--border-radius').trim();
      const shadow = styles.getPropertyValue('--shadow').trim();
      const borderColor = styles.getPropertyValue('--color-border').trim();
      
      assert.isNotEmpty(borderRadius);
      assert.isNotEmpty(shadow);
      assert.isNotEmpty(borderColor);
    });
  });

  describe('Dark Theme', () => {
    it('should apply dark theme tokens when attribute is set', async () => {
      element.setAttribute('dark-theme', '');
      await element.updateComplete;
      
      const styles = getComputedStyle(element);
      const backgroundColor = styles.getPropertyValue('--color-background').trim();
      
      // Dark theme should have a dark background
      assert.include(backgroundColor, '#1a1a1a');
    });

    it('should override text colors in dark theme', async () => {
      element.setAttribute('dark-theme', '');
      await element.updateComplete;
      
      const styles = getComputedStyle(element);
      const textColor = styles.getPropertyValue('--color-text-primary').trim();
      
      // Dark theme should have light text
      assert.include(textColor, '#ffffff');
    });
  });

  describe('High Contrast Theme', () => {
    it('should apply high contrast colors when attribute is set', async () => {
      element.setAttribute('high-contrast', '');
      await element.updateComplete;
      
      const styles = getComputedStyle(element);
      const primaryColor = styles.getPropertyValue('--color-primary').trim();
      const errorColor = styles.getPropertyValue('--color-error').trim();
      
      // High contrast should use more vivid colors
      assert.include(primaryColor, '#0000ff');
      assert.include(errorColor, '#ff0000');
    });
  });

  describe('Button Styles', () => {
    it('should style primary buttons correctly', () => {
      const primaryButton = element.shadowRoot?.querySelector('.btn-primary') as HTMLElement;
      assert.exists(primaryButton);
      
      const styles = getComputedStyle(primaryButton);
      const backgroundColor = styles.getPropertyValue('background-color');
      const color = styles.getPropertyValue('color');
      
      assert.isNotEmpty(backgroundColor);
      assert.isNotEmpty(color);
    });

    it('should style secondary buttons correctly', () => {
      const secondaryButton = element.shadowRoot?.querySelector('.btn-secondary') as HTMLElement;
      assert.exists(secondaryButton);
      
      const styles = getComputedStyle(secondaryButton);
      const borderStyle = styles.getPropertyValue('border-style');
      
      assert.equal(borderStyle, 'solid');
    });

    it('should apply button size modifiers', async () => {
      // Add a small button to test size modifiers
      const smallButton = document.createElement('button');
      smallButton.className = 'btn btn-sm';
      smallButton.textContent = 'Small Button';
      
      element.shadowRoot?.appendChild(smallButton);
      await element.updateComplete;
      
      const styles = getComputedStyle(smallButton);
      const fontSize = styles.getPropertyValue('font-size');
      
      assert.isNotEmpty(fontSize);
    });
  });

  describe('Form Styles', () => {
    it('should style form inputs correctly', () => {
      const input = element.shadowRoot?.querySelector('.form-input') as HTMLInputElement;
      assert.exists(input);
      
      const styles = getComputedStyle(input);
      const borderStyle = styles.getPropertyValue('border-style');
      const padding = styles.getPropertyValue('padding');
      
      assert.equal(borderStyle, 'solid');
      assert.isNotEmpty(padding);
    });

    it('should handle focus states on form elements', () => {
      const input = element.shadowRoot?.querySelector('.form-input') as HTMLInputElement;
      assert.exists(input);
      
      // Simulate focus (actual focus handling would be tested in e2e tests)
      input.focus();
      
      // Test that the element can receive focus
      assert.equal(document.activeElement, input);
    });
  });

  describe('Card Styles', () => {
    it('should style card components correctly', () => {
      const card = element.shadowRoot?.querySelector('.card') as HTMLElement;
      const cardHeader = element.shadowRoot?.querySelector('.card-header') as HTMLElement;
      const cardBody = element.shadowRoot?.querySelector('.card-body') as HTMLElement;
      
      assert.exists(card);
      assert.exists(cardHeader);
      assert.exists(cardBody);
      
      const cardStyles = getComputedStyle(card);
      const borderStyle = cardStyles.getPropertyValue('border-style');
      const borderRadius = cardStyles.getPropertyValue('border-radius');
      
      assert.equal(borderStyle, 'solid');
      assert.isNotEmpty(borderRadius);
    });
  });

  describe('Utility Classes', () => {
    it('should provide layout utilities', () => {
      // Test that utility classes can be applied
      const testDiv = document.createElement('div');
      testDiv.className = 'flex items-center justify-between p-md';
      
      element.shadowRoot?.appendChild(testDiv);
      
      const styles = getComputedStyle(testDiv);
      const display = styles.getPropertyValue('display');
      const alignItems = styles.getPropertyValue('align-items');
      const justifyContent = styles.getPropertyValue('justify-content');
      
      assert.equal(display, 'flex');
      assert.equal(alignItems, 'center');
      assert.equal(justifyContent, 'space-between');
    });

    it('should provide typography utilities', () => {
      const testSpan = document.createElement('span');
      testSpan.className = 'text-lg font-bold text-primary';
      
      element.shadowRoot?.appendChild(testSpan);
      
      const styles = getComputedStyle(testSpan);
      const fontWeight = styles.getPropertyValue('font-weight');
      
      assert.isNotEmpty(fontWeight);
    });

    it('should provide spacing utilities', () => {
      const testDiv = document.createElement('div');
      testDiv.className = 'p-lg m-md';
      
      element.shadowRoot?.appendChild(testDiv);
      
      const styles = getComputedStyle(testDiv);
      const padding = styles.getPropertyValue('padding');
      const margin = styles.getPropertyValue('margin');
      
      assert.isNotEmpty(padding);
      assert.isNotEmpty(margin);
    });
  });

  describe('Accessibility', () => {
    it('should respect reduced motion preference', () => {
      // Mock reduced motion preference
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: (query: string) => ({
          matches: query.includes('prefers-reduced-motion: reduce'),
          media: query,
          onchange: null,
          addListener: () => {},
          removeListener: () => {},
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => {},
        }),
      });
      
      const styles = getComputedStyle(element);
      const transitionFast = styles.getPropertyValue('--transition-fast').trim();
      
      // With reduced motion, transitions should be disabled or minimal
      assert.isString(transitionFast);
    });

    it('should provide screen reader only utility', () => {
      const srOnlyElement = document.createElement('span');
      srOnlyElement.className = 'sr-only';
      srOnlyElement.textContent = 'Screen reader only text';
      
      element.shadowRoot?.appendChild(srOnlyElement);
      
      const styles = getComputedStyle(srOnlyElement);
      const position = styles.getPropertyValue('position');
      const width = styles.getPropertyValue('width');
      
      assert.equal(position, 'absolute');
      assert.equal(width, '1px');
    });
  });

  describe('Interactive States', () => {
    it('should provide interactive class with hover effects', () => {
      const interactiveElement = document.createElement('div');
      interactiveElement.className = 'interactive';
      
      element.shadowRoot?.appendChild(interactiveElement);
      
      const styles = getComputedStyle(interactiveElement);
      const cursor = styles.getPropertyValue('cursor');
      const transition = styles.getPropertyValue('transition');
      
      assert.equal(cursor, 'pointer');
      assert.isNotEmpty(transition);
    });

    it('should provide loading state styling', () => {
      const loadingElement = document.createElement('div');
      loadingElement.className = 'loading';
      
      element.shadowRoot?.appendChild(loadingElement);
      
      const styles = getComputedStyle(loadingElement);
      const pointerEvents = styles.getPropertyValue('pointer-events');
      
      assert.equal(pointerEvents, 'none');
    });

    it('should provide disabled state styling', () => {
      const disabledElement = document.createElement('button');
      disabledElement.className = 'disabled';
      
      element.shadowRoot?.appendChild(disabledElement);
      
      const styles = getComputedStyle(disabledElement);
      const opacity = styles.getPropertyValue('opacity');
      const cursor = styles.getPropertyValue('cursor');
      
      assert.equal(opacity, '0.5');
      assert.equal(cursor, 'not-allowed');
    });
  });

  describe('CSS Structure Validation', () => {
    it('should include all base styles', () => {
      assert.isDefined(themeTokens);
      assert.isDefined(commonStyles);
      assert.isDefined(buttonStyles);
      assert.isDefined(formStyles);
      assert.isDefined(cardStyles);
      assert.isDefined(baseStyles);
    });

    it('should combine styles properly', () => {
      // Test that baseStyles includes all component styles
      const baseStylesString = baseStyles.toString();
      
      assert.isString(baseStylesString);
      assert.isNotEmpty(baseStylesString);
    });
  });
});