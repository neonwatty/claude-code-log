import { fixture, assert, oneEvent } from '@open-wc/testing';
import { html } from 'lit';
import { BaseComponent } from '../BaseComponent';
import { customElement } from 'lit/decorators.js';

// Test implementation of BaseComponent
@customElement('test-base-component')
class TestBaseComponent extends BaseComponent {
  static styles = BaseComponent.baseStyles;

  render() {
    return html`
      <div>
        ${this.loading ? html`<div class="loading">Loading...</div>` : ''}
        ${this.error ? html`<div class="error">${this.error}</div>` : ''}
        <button id="test-button" @click=${this.handleTestClick}>Test Button</button>
        <input id="test-input" @keydown=${this.handleKeydown} />
      </div>
    `;
  }

  handleTestClick() {
    this.emitEvent('test-clicked', { message: 'Button clicked' });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'test-base-component': TestBaseComponent;
  }
}

describe('BaseComponent', () => {
  let element: TestBaseComponent;

  beforeEach(async () => {
    element = await fixture(html`<test-base-component></test-base-component>`);
  });

  describe('Basic Properties', () => {
    it('should have default properties', () => {
      assert.equal(element.role, 'region');
      assert.equal(element.darkTheme, false);
      assert.equal(element.loading, false);
      assert.equal(element.error, null);
    });

    it('should reflect role attribute', async () => {
      element.role = 'main';
      await element.updateComplete;
      assert.equal(element.getAttribute('role'), 'main');
    });

    it('should reflect dark-theme attribute', async () => {
      element.darkTheme = true;
      await element.updateComplete;
      assert.equal(element.getAttribute('dark-theme'), '');
    });
  });

  describe('State Management', () => {
    it('should set loading state', () => {
      element.setLoading(true);
      assert.equal(element.loading, true);
      assert.equal(element.error, null);
    });

    it('should set error state', () => {
      element.setError('Test error');
      assert.equal(element.error, 'Test error');
      assert.equal(element.loading, false);
    });

    it('should set error from Error object', () => {
      const error = new Error('Test error object');
      element.setError(error);
      assert.equal(element.error, 'Test error object');
    });

    it('should clear states', () => {
      element.setLoading(true);
      element.setError('Test error');
      element.clearStates();
      assert.equal(element.loading, false);
      assert.equal(element.error, null);
    });
  });

  describe('Event Emission', () => {
    it('should emit custom events', async () => {
      const listener = oneEvent(element, 'test-event');
      element.emitEvent('test-event', { data: 'test' });
      const event = await listener;
      
      assert.equal(event.type, 'test-event');
      assert.deepEqual(event.detail, { data: 'test' });
      assert.equal(event.bubbles, true);
      assert.equal(event.composed, true);
    });

    it('should emit events with custom options', async () => {
      const listener = oneEvent(element, 'test-event-custom');
      element.emitEvent('test-event-custom', { data: 'test' }, { 
        bubbles: false, 
        composed: false, 
        cancelable: true 
      });
      const event = await listener;
      
      assert.equal(event.bubbles, false);
      assert.equal(event.composed, false);
      assert.equal(event.cancelable, true);
    });
  });

  describe('Async Operations', () => {
    it('should handle successful async operations', async () => {
      const operation = async () => 'success';
      const result = await element.safeAsyncOperation(operation);
      
      assert.equal(result, 'success');
      assert.equal(element.loading, false);
      assert.equal(element.error, null);
    });

    it('should handle failed async operations', async () => {
      const operation = async () => {
        throw new Error('Operation failed');
      };
      const result = await element.safeAsyncOperation(operation);
      
      assert.equal(result, null);
      assert.equal(element.loading, false);
      assert.equal(element.error, 'Operation failed: Operation failed');
    });

    it('should handle failed async operations with custom error message', async () => {
      const operation = async () => {
        throw new Error('Network error');
      };
      const result = await element.safeAsyncOperation(operation, 'Custom error');
      
      assert.equal(result, null);
      assert.equal(element.error, 'Custom error: Network error');
    });
  });

  describe('Utility Functions', () => {
    it('should debounce function calls', (done) => {
      let callCount = 0;
      const debouncedFn = element.debounce(() => {
        callCount++;
        assert.equal(callCount, 1);
        done();
      }, 50);

      // Call multiple times quickly
      debouncedFn();
      debouncedFn();
      debouncedFn();
    });

    it('should throttle function calls', (done) => {
      let callCount = 0;
      const throttledFn = element.throttle(() => {
        callCount++;
      }, 50);

      // Call multiple times quickly
      throttledFn();
      throttledFn();
      throttledFn();

      setTimeout(() => {
        assert.equal(callCount, 1);
        done();
      }, 100);
    });

    it('should format dates correctly', () => {
      const date = new Date('2023-01-15T10:30:00Z');
      const formatted = element.formatDate(date);
      assert.include(formatted, '2023');
      assert.include(formatted, 'Jan');
      assert.include(formatted, '15');
    });

    it('should sanitize HTML content', () => {
      const html = '<script>alert("xss")</script><p>Safe content</p>';
      const sanitized = element.sanitizeHTML(html);
      assert.equal(sanitized, '&lt;script&gt;alert("xss")&lt;/script&gt;&lt;p&gt;Safe content&lt;/p&gt;');
    });
  });

  describe('Accessibility', () => {
    it('should update accessibility attributes on loading state change', async () => {
      element.setLoading(true);
      await element.updateComplete;
      assert.equal(element.getAttribute('aria-busy'), 'true');
    });

    it('should update accessibility attributes on error state change', async () => {
      element.setError('Test error');
      await element.updateComplete;
      assert.equal(element.getAttribute('aria-invalid'), 'true');
    });

    it('should remove aria-invalid when error is cleared', async () => {
      element.setError('Test error');
      await element.updateComplete;
      assert.equal(element.getAttribute('aria-invalid'), 'true');
      
      element.clearStates();
      await element.updateComplete;
      assert.equal(element.hasAttribute('aria-invalid'), false);
    });
  });

  describe('Keyboard Handling', () => {
    it('should handle keyboard events', async () => {
      const input = element.shadowRoot?.querySelector('#test-input') as HTMLInputElement;
      assert.exists(input);

      // Test Escape key
      const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' });
      input.dispatchEvent(escapeEvent);

      // Test Enter key
      const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });
      input.dispatchEvent(enterEvent);

      // Test Ctrl+Enter
      const ctrlEnterEvent = new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true });
      input.dispatchEvent(ctrlEnterEvent);
    });
  });

  describe('Lifecycle Hooks', () => {
    it('should call lifecycle methods', () => {
      let onConnectedCalled = false;
      let setupEventListenersCalled = false;

      class TestLifecycleComponent extends BaseComponent {
        protected onConnected() {
          onConnectedCalled = true;
        }

        protected setupEventListeners() {
          setupEventListenersCalled = true;
        }

        render() {
          return html`<div>Test</div>`;
        }
      }

      customElements.define('test-lifecycle-component', TestLifecycleComponent);
      const component = document.createElement('test-lifecycle-component');
      document.body.appendChild(component);

      assert.equal(onConnectedCalled, true);
      assert.equal(setupEventListenersCalled, true);

      document.body.removeChild(component);
    });
  });
});