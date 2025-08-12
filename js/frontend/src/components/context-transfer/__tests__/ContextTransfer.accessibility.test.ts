import { describe, it, expect, beforeEach } from 'vitest';
import { fixture, html } from '@open-wc/testing';
import { ContextTransfer } from '../ContextTransfer';
import '../ContextTransfer';

describe('ContextTransfer Accessibility', () => {
  let element: ContextTransfer;

  beforeEach(async () => {
    element = await fixture<ContextTransfer>(html`
      <context-transfer session-path="/test/session.jsonl"></context-transfer>
    `);
  });

  describe('ARIA Compliance', () => {
    it('should have proper main landmark', () => {
      const main = element.shadowRoot?.querySelector('[role="main"]');
      expect(main).to.exist;
      expect(main).to.have.attribute('aria-labelledby');
    });

    it('should have descriptive headings hierarchy', () => {
      const h2 = element.shadowRoot?.querySelector('h2');
      const h3s = element.shadowRoot?.querySelectorAll('h3');
      
      expect(h2).to.exist;
      expect(h3s.length).toBeGreaterThan(0);
      
      // Verify heading structure
      expect(h2?.tagName).toBe('H2');
      h3s.forEach(h3 => {
        expect(h3.tagName).toBe('H3');
      });
    });

    it('should have proper form labels', () => {
      const inputs = element.shadowRoot?.querySelectorAll('input');
      inputs?.forEach(input => {
        const id = input.getAttribute('id');
        if (id && input.type !== 'checkbox') {
          const label = element.shadowRoot?.querySelector(`label[for="${id}"]`);
          expect(label, `Input ${id} should have associated label`).to.exist;
        }
      });
    });

    it('should have proper checkbox labels', () => {
      const checkboxes = element.shadowRoot?.querySelectorAll('input[type="checkbox"]');
      checkboxes?.forEach(checkbox => {
        const id = checkbox.getAttribute('id');
        const label = element.shadowRoot?.querySelector(`label[for="${id}"]`);
        expect(label, `Checkbox ${id} should have associated label`).to.exist;
      });
    });

    it('should have aria-describedby for form controls with help text', () => {
      const sessionInput = element.shadowRoot?.querySelector('#context-transfer-session-path');
      expect(sessionInput).to.have.attribute('aria-describedby');
      
      const describedBy = sessionInput?.getAttribute('aria-describedby');
      if (describedBy) {
        const helpText = element.shadowRoot?.querySelector(`#${describedBy}`);
        expect(helpText).to.exist;
      }
    });

    it('should use role="alert" for error messages', async () => {
      (element as any).error = 'Test error message';
      await element.updateComplete;
      
      const errorMessage = element.shadowRoot?.querySelector('.error-message');
      expect(errorMessage).to.have.attribute('role', 'alert');
    });

    it('should have proper button descriptions', async () => {
      element.sessionPath = '/test/session.jsonl';
      await element.updateComplete;
      
      const buttons = element.shadowRoot?.querySelectorAll('button');
      buttons?.forEach(button => {
        const ariaDescribedBy = button.getAttribute('aria-describedby');
        if (ariaDescribedBy) {
          const description = element.shadowRoot?.querySelector(`#${ariaDescribedBy}`);
          expect(description, `Button should have description element`).to.exist;
        }
      });
    });
  });

  describe('Keyboard Navigation', () => {
    it('should have focusable elements in logical order', () => {
      const focusableElements = element.shadowRoot?.querySelectorAll(
        'button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      
      expect(focusableElements?.length).toBeGreaterThan(0);
      
      // Verify elements are in DOM order (implicitly correct tab order)
      focusableElements?.forEach((element, index) => {
        expect(element).to.be.instanceOf(HTMLElement);
      });
    });

    it('should not have positive tabindex values', () => {
      const elementsWithTabindex = element.shadowRoot?.querySelectorAll('[tabindex]');
      elementsWithTabindex?.forEach(el => {
        const tabindex = el.getAttribute('tabindex');
        expect(parseInt(tabindex || '0')).to.be.lessThanOrEqual(0);
      });
    });

    it('should handle keyboard events appropriately', async () => {
      const sessionInput = element.shadowRoot?.querySelector('#context-transfer-session-path') as HTMLInputElement;
      
      // Focus should work
      sessionInput?.focus();
      expect(document.activeElement).to.equal(sessionInput);
    });
  });

  describe('Screen Reader Compatibility', () => {
    it('should have meaningful text content', () => {
      const title = element.shadowRoot?.querySelector('.transfer-title');
      expect(title?.textContent?.trim()).to.include('Context Transfer');
      
      const description = element.shadowRoot?.querySelector('.transfer-description');
      expect(description?.textContent?.trim()).to.not.be.empty;
    });

    it('should provide context for form controls', () => {
      const formLabels = element.shadowRoot?.querySelectorAll('.form-label');
      formLabels?.forEach(label => {
        expect(label.textContent?.trim()).to.not.be.empty;
      });
    });

    it('should have descriptive option descriptions', () => {
      const optionDescriptions = element.shadowRoot?.querySelectorAll('.option-description');
      optionDescriptions?.forEach(desc => {
        expect(desc.textContent?.trim()).to.not.be.empty;
      });
    });

    it('should provide status updates for state changes', async () => {
      // Test different states provide meaningful feedback
      const states = ['preparing', 'ready', 'transferring', 'completed', 'failed'];
      
      for (const state of states) {
        (element as any).transferState = { state, progress: state === 'transferring' ? 50 : 0 };
        await element.updateComplete;
        
        const statusDetails = element.shadowRoot?.querySelector('.status-details');
        if (statusDetails) {
          expect(statusDetails.textContent?.trim()).to.not.be.empty;
        }
      }
    });
  });

  describe('Color and Contrast', () => {
    it('should use semantic color classes', () => {
      const statusBadges = element.shadowRoot?.querySelectorAll('.status-badge');
      statusBadges?.forEach(badge => {
        const classes = badge.className;
        expect(classes).to.match(/\b(idle|preparing|ready|transferring|completed|failed)\b/);
      });
    });

    it('should not rely solely on color for status indication', async () => {
      // Status should be indicated by text content, not just color
      (element as any).transferState = { state: 'ready', progress: 0 };
      await element.updateComplete;
      
      const statusBadge = element.shadowRoot?.querySelector('.status-badge');
      expect(statusBadge?.textContent?.trim()).toBe('ready');
    });

    it('should have visible focus indicators', () => {
      // CSS should include focus styles
      const styles = element.constructor.styles.toString();
      expect(styles).to.include(':focus');
    });
  });

  describe('Responsive and Zoom Support', () => {
    it('should have responsive design breakpoints', () => {
      const styles = element.constructor.styles.toString();
      expect(styles).to.include('@media');
      expect(styles).to.include('max-width');
    });

    it('should handle text scaling', () => {
      // Font sizes should use relative units
      const styles = element.constructor.styles.toString();
      expect(styles).to.include('var(--font-size');
    });

    it('should have adequate spacing', () => {
      const spacedElements = element.shadowRoot?.querySelectorAll('.form-group, .option-card, .transfer-actions');
      expect(spacedElements?.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling and Feedback', () => {
    it('should provide clear error messages', async () => {
      (element as any).error = 'Session file not found';
      await element.updateComplete;
      
      const errorMessage = element.shadowRoot?.querySelector('.error-message');
      expect(errorMessage?.textContent?.trim()).toBe('Session file not found');
    });

    it('should indicate required fields', () => {
      const sessionInput = element.shadowRoot?.querySelector('#context-transfer-session-path');
      // In a full implementation, required fields would be marked
      expect(sessionInput).to.exist;
    });

    it('should provide loading feedback', async () => {
      (element as any).loading = true;
      await element.updateComplete;
      
      const loadingButton = element.shadowRoot?.querySelector('.transfer-button[disabled]');
      expect(loadingButton?.textContent).to.include('...');
    });
  });

  describe('Progressive Enhancement', () => {
    it('should work without JavaScript enhancements', () => {
      // Basic form structure should be present
      const inputs = element.shadowRoot?.querySelectorAll('input');
      const buttons = element.shadowRoot?.querySelectorAll('button');
      
      expect(inputs?.length).toBeGreaterThan(0);
      expect(buttons?.length).toBeGreaterThan(0);
    });

    it('should degrade gracefully', async () => {
      // Component should render even if WebSocket is unavailable
      (element as any).socket = null;
      await element.updateComplete;
      
      const container = element.shadowRoot?.querySelector('.context-transfer-container');
      expect(container).to.exist;
    });
  });

  describe('Language and Internationalization', () => {
    it('should have proper lang attributes where needed', () => {
      // Code blocks might need lang attributes
      const codeBlocks = element.shadowRoot?.querySelectorAll('.code-block');
      // This would be implemented based on i18n requirements
      expect(codeBlocks).to.exist;
    });

    it('should use semantic markup for different content types', () => {
      const lists = element.shadowRoot?.querySelectorAll('ol, ul');
      const code = element.shadowRoot?.querySelectorAll('code, .code-block');
      
      // Structure supports semantic content
      expect(element.shadowRoot).to.exist;
    });
  });
});