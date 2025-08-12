import { describe, it, expect, beforeEach } from 'vitest';
import { fixture, html } from '@open-wc/testing';
import { BranchVisualization } from '../BranchVisualization';
import { SessionBranchTree, SessionSummary } from '../../types/session-types';

// Mock data for accessibility testing
const mockSession: SessionSummary = {
  sessionId: 'a11y-test-session',
  title: 'Accessibility Test Session',
  cwd: '/test/project',
  startTime: new Date('2024-01-01T10:00:00Z'),
  messageCount: 8,
  userMessageCount: 4,
  assistantMessageCount: 4,
  isActive: true,
  parentSessionId: null,
  branchPoint: null,
  branchTimestamp: null,
};

const mockBranchSession: SessionSummary = {
  sessionId: 'a11y-branch-session',
  title: 'Accessibility Branch',
  cwd: '/test/project',
  startTime: new Date('2024-01-01T11:00:00Z'),
  messageCount: 5,
  userMessageCount: 2,
  assistantMessageCount: 3,
  isActive: false,
  parentSessionId: 'a11y-test-session',
  branchPoint: 2,
  branchTimestamp: new Date('2024-01-01T11:00:00Z'),
  branchMetadata: {
    branchName: 'Accessibility Features',
    branchReason: 'Adding screen reader support',
    originalMessage: 'Let me implement accessibility features'
  }
};

const mockBranchTree: SessionBranchTree = {
  rootSession: mockSession,
  branches: [{
    rootSession: mockBranchSession,
    branches: [],
    depth: 1
  }],
  depth: 0
};

describe('BranchVisualization Accessibility', () => {
  let element: BranchVisualization;

  beforeEach(async () => {
    element = await fixture(html`
      <branch-visualization
        .branchTree=${mockBranchTree}
        .currentSessionId=${'a11y-test-session'}
        aria-label="Branch tree visualization for accessibility testing"
      ></branch-visualization>
    `);
  });

  describe('ARIA Compliance', () => {
    it('should have proper role attributes', async () => {
      await element.updateComplete;
      
      expect(element.getAttribute('role')).toBe('region');
      
      const svg = element.shadowRoot?.querySelector('.tree-svg');
      expect(svg?.getAttribute('role')).toBe('img');
    });

    it('should have accessible SVG labels', async () => {
      await element.updateComplete;
      
      const svg = element.shadowRoot?.querySelector('.tree-svg');
      expect(svg?.getAttribute('aria-label')).toBe('Session branch tree visualization');
    });

    it('should have proper button roles for interactive nodes', async () => {
      await element.updateComplete;
      
      const sessionNodes = element.shadowRoot?.querySelectorAll('.session-node');
      sessionNodes?.forEach(node => {
        expect(node.getAttribute('role')).toBe('button');
        expect(node.getAttribute('aria-label')).toMatch(/^Session .+: \d+ messages$/);
      });
    });

    it('should have descriptive aria-labels for each session node', async () => {
      await element.updateComplete;
      
      const nodes = element.shadowRoot?.querySelectorAll('.session-node');
      expect(nodes).to.have.length(2);
      
      const firstNode = nodes?.[0];
      const ariaLabel = firstNode?.getAttribute('aria-label');
      expect(ariaLabel).toContain('Session');
      expect(ariaLabel).toContain('messages');
    });

    it('should use semantic SVG markup', async () => {
      await element.updateComplete;
      
      const svg = element.shadowRoot?.querySelector('.tree-svg');
      expect(svg?.tagName.toLowerCase()).toBe('svg');
      
      // Check for proper SVG structure
      const circles = svg?.querySelectorAll('circle');
      const lines = svg?.querySelectorAll('line');
      const text = svg?.querySelectorAll('text');
      
      expect(circles?.length).toBeGreaterThan(0);
      expect(text?.length).toBeGreaterThan(0);
    });
  });

  describe('Keyboard Navigation', () => {
    it('should have proper tabindex for keyboard navigation', async () => {
      await element.updateComplete;
      
      const sessionNodes = element.shadowRoot?.querySelectorAll('.session-node');
      sessionNodes?.forEach(node => {
        expect(node.getAttribute('tabindex')).toBe('0');
      });
    });

    it('should have keyboard accessible control buttons', () => {
      const controlButtons = element.shadowRoot?.querySelectorAll('.control-button');
      controlButtons?.forEach(button => {
        expect(button.getAttribute('tabindex')).not.toBe('-1');
        expect(button.getAttribute('aria-label')).toBeDefined();
      });
    });

    it('should respond to Enter key on session nodes', async () => {
      let eventFired = false;
      
      element.addEventListener('session-navigate', (() => {
        eventFired = true;
      }) as EventListener);

      await element.updateComplete;
      
      const firstNode = element.shadowRoot?.querySelector('.session-node') as SVGElement;
      expect(firstNode).to.exist;

      const enterEvent = new KeyboardEvent('keydown', { 
        key: 'Enter',
        bubbles: true,
        cancelable: true
      });
      firstNode.dispatchEvent(enterEvent);

      expect(eventFired).toBe(true);
    });

    it('should respond to Space key on session nodes', async () => {
      let eventFired = false;
      
      element.addEventListener('session-navigate', (() => {
        eventFired = true;
      }) as EventListener);

      await element.updateComplete;
      
      const firstNode = element.shadowRoot?.querySelector('.session-node') as SVGElement;
      expect(firstNode).to.exist;

      const spaceEvent = new KeyboardEvent('keydown', { 
        key: ' ',
        bubbles: true,
        cancelable: true
      });
      firstNode.dispatchEvent(spaceEvent);

      expect(eventFired).toBe(true);
    });

    it('should prevent default behavior for Space key to avoid scrolling', async () => {
      await element.updateComplete;
      
      const firstNode = element.shadowRoot?.querySelector('.session-node') as SVGElement;
      expect(firstNode).to.exist;

      let defaultPrevented = false;
      const spaceEvent = new KeyboardEvent('keydown', { 
        key: ' ',
        bubbles: true,
        cancelable: true
      });
      
      // Override preventDefault to track if it was called
      const originalPreventDefault = spaceEvent.preventDefault;
      spaceEvent.preventDefault = () => {
        defaultPrevented = true;
        originalPreventDefault.call(spaceEvent);
      };

      firstNode.dispatchEvent(spaceEvent);
      expect(defaultPrevented).toBe(true);
    });

    it('should handle keyboard navigation on control buttons', async () => {
      await element.updateComplete;
      
      const controlButtons = element.shadowRoot?.querySelectorAll('.control-button');
      expect(controlButtons?.length).toBe(3);
      
      controlButtons?.forEach(button => {
        expect(button.getAttribute('aria-label')).toBeDefined();
        expect(button.getAttribute('title')).toBeDefined();
      });
    });
  });

  describe('Focus Management', () => {
    it('should have visible focus indicators', () => {
      const cssText = element.constructor.styles?.[1]?.toString() || '';
      expect(cssText).toContain('focus');
      expect(cssText).toContain('outline');
    });

    it('should support focus-visible for modern browsers', () => {
      const cssText = element.constructor.styles?.[1]?.toString() || '';
      expect(cssText).toContain('focus-visible');
    });

    it('should have appropriate focus offset', () => {
      const cssText = element.constructor.styles?.[1]?.toString() || '';
      expect(cssText).toContain('outline-offset');
    });

    it('should handle focus on session nodes', async () => {
      await element.updateComplete;
      
      const firstNode = element.shadowRoot?.querySelector('.session-node') as HTMLElement;
      expect(firstNode).to.exist;
      
      firstNode.focus();
      expect(document.activeElement).toBe(element);
    });
  });

  describe('Screen Reader Support', () => {
    it('should provide meaningful text content for session labels', async () => {
      await element.updateComplete;
      
      const nodeLabels = element.shadowRoot?.querySelectorAll('.node-label');
      nodeLabels?.forEach(label => {
        expect(label.textContent?.trim().length).toBeGreaterThan(0);
      });
    });

    it('should provide metadata information', async () => {
      await element.updateComplete;
      
      const nodeMetadata = element.shadowRoot?.querySelectorAll('.node-metadata');
      nodeMetadata?.forEach(metadata => {
        expect(metadata.textContent).toMatch(/\d+\s+msgs/);
      });
    });

    it('should have descriptive tooltip content', async () => {
      await element.updateComplete;
      
      const firstNode = element.shadowRoot?.querySelector('.session-node') as SVGElement;
      
      // Simulate hover to show tooltip
      const mouseEnterEvent = new MouseEvent('mouseenter', {
        bubbles: true,
        clientX: 100,
        clientY: 100
      });
      firstNode.dispatchEvent(mouseEnterEvent);
      
      await element.updateComplete;
      
      const tooltip = element.shadowRoot?.querySelector('.tooltip.visible');
      expect(tooltip).to.exist;
      expect(tooltip?.textContent).toContain('Messages:');
      expect(tooltip?.textContent).toContain('Status:');
    });

    it('should announce session counts in header', async () => {
      await element.updateComplete;
      
      const subtitle = element.shadowRoot?.querySelector('.header-subtitle');
      expect(subtitle?.textContent).toContain('sessions in tree');
    });
  });

  describe('High Contrast Mode Support', () => {
    it('should have proper border styles for high contrast', () => {
      const cssText = element.constructor.styles?.[1]?.toString() || '';
      
      // Should have media query for high contrast mode
      expect(cssText).toContain('@media (prefers-contrast: high)');
      
      // Should increase border widths in high contrast mode
      expect(cssText).toContain('stroke-width: 3');
    });

    it('should use semantic color variables', () => {
      const cssText = element.constructor.styles?.[1]?.toString() || '';
      
      // Should use CSS custom properties for colors
      expect(cssText).toContain('var(--color-');
      expect(cssText).toContain('var(--color-primary)');
      expect(cssText).toContain('var(--color-border)');
    });
  });

  describe('Reduced Motion Support', () => {
    it('should respect reduced motion preferences', () => {
      const cssText = element.constructor.styles?.[1]?.toString() || '';
      
      // Should have media query for reduced motion
      expect(cssText).toContain('@media (prefers-reduced-motion: reduce)');
      
      // Should disable transitions and animations
      expect(cssText).toContain('transition: none');
      expect(cssText).toContain('animation: none');
    });

    it('should disable animations in reduced motion mode', () => {
      const cssText = element.constructor.styles?.[1]?.toString() || '';
      
      // The node update animation should be disabled
      expect(cssText).toMatch(/animation:\s*none/);
    });
  });

  describe('Color Accessibility', () => {
    it('should use semantic color system', () => {
      const cssText = element.constructor.styles?.[1]?.toString() || '';
      
      // Should use semantic color variables that provide good contrast
      expect(cssText).toContain('var(--color-text-primary)');
      expect(cssText).toContain('var(--color-text-muted)');
      expect(cssText).toContain('var(--color-background)');
      expect(cssText).toContain('var(--color-border)');
    });

    it('should differentiate session types by color', async () => {
      await element.updateComplete;
      
      const rootCircle = element.shadowRoot?.querySelector('.node-circle.root');
      const branchCircle = element.shadowRoot?.querySelector('.node-circle.branch');
      
      expect(rootCircle).to.exist;
      expect(branchCircle).to.exist;
      
      // Different classes ensure different styling
      expect(rootCircle?.classList.contains('root')).toBe(true);
      expect(branchCircle?.classList.contains('branch')).toBe(true);
    });

    it('should use appropriate colors for status indication', async () => {
      await element.updateComplete;
      
      const activeCircle = element.shadowRoot?.querySelector('.node-circle.active');
      const inactiveCircle = element.shadowRoot?.querySelector('.node-circle.inactive');
      
      expect(activeCircle).to.exist; // Root session is active
      expect(inactiveCircle).to.exist; // Branch session is inactive
    });
  });

  describe('Empty State Accessibility', () => {
    it('should provide accessible empty state', async () => {
      const emptyElement = await fixture(html`
        <branch-visualization .branchTree=${null}></branch-visualization>
      `);

      await emptyElement.updateComplete;
      
      const emptyState = emptyElement.shadowRoot?.querySelector('.empty-state');
      expect(emptyState).to.exist;
      
      const title = emptyState?.querySelector('.empty-state-title');
      const description = emptyState?.querySelector('.empty-state-description');
      
      expect(title?.textContent?.trim()).toBe('No Branch Tree Available');
      expect(description?.textContent?.trim()).toContain('Load a session');
    });

    it('should have appropriate empty state structure for screen readers', async () => {
      const emptyElement = await fixture(html`
        <branch-visualization .branchTree=${null}></branch-visualization>
      `);

      await emptyElement.updateComplete;
      
      const emptyState = emptyElement.shadowRoot?.querySelector('.empty-state');
      
      // Should have proper heading structure
      const title = emptyState?.querySelector('.empty-state-title');
      const description = emptyState?.querySelector('.empty-state-description');
      
      expect(title).to.exist;
      expect(description).to.exist;
      
      // Both should have meaningful text content
      expect(title?.textContent?.trim().length).toBeGreaterThan(0);
      expect(description?.textContent?.trim().length).toBeGreaterThan(0);
    });
  });

  describe('WebSocket Status Accessibility', () => {
    it('should provide accessible connection status when enabled', async () => {
      const wsElement = await fixture(html`
        <branch-visualization 
          .branchTree=${mockBranchTree}
          enable-websocket
        ></branch-visualization>
      `);

      await wsElement.updateComplete;
      
      const status = wsElement.shadowRoot?.querySelector('.websocket-status');
      expect(status).to.exist;
      
      const indicator = status?.querySelector('.status-indicator');
      const text = status?.textContent;
      
      expect(indicator).to.exist;
      expect(text).toMatch(/(Live updates|Disconnected)/);
    });

    it('should use appropriate colors for connection status', async () => {
      const wsElement = await fixture(html`
        <branch-visualization 
          .branchTree=${mockBranchTree}
          enable-websocket
        ></branch-visualization>
      `);

      await wsElement.updateComplete;
      
      const statusIndicator = wsElement.shadowRoot?.querySelector('.status-indicator');
      expect(statusIndicator).to.exist;
      
      // Should have connected or disconnected class
      const hasStatusClass = statusIndicator?.classList.contains('connected') || 
                            statusIndicator?.classList.contains('disconnected');
      expect(hasStatusClass).toBe(true);
    });
  });

  describe('Tooltip Accessibility', () => {
    it('should position tooltips appropriately', async () => {
      await element.updateComplete;
      
      const firstNode = element.shadowRoot?.querySelector('.session-node') as SVGElement;
      
      const mouseEnterEvent = new MouseEvent('mouseenter', {
        bubbles: true,
        clientX: 200,
        clientY: 150
      });
      firstNode.dispatchEvent(mouseEnterEvent);
      
      await element.updateComplete;
      
      const tooltip = element.shadowRoot?.querySelector('.tooltip.visible') as HTMLElement;
      expect(tooltip).to.exist;
      
      // Tooltip should be positioned and visible
      const styles = getComputedStyle(tooltip);
      expect(tooltip.style.left).toBeDefined();
      expect(tooltip.style.top).toBeDefined();
    });

    it('should have appropriate tooltip content structure', async () => {
      await element.updateComplete;
      
      const firstNode = element.shadowRoot?.querySelector('.session-node') as SVGElement;
      
      const mouseEnterEvent = new MouseEvent('mouseenter', {
        bubbles: true,
        clientX: 200,
        clientY: 150
      });
      firstNode.dispatchEvent(mouseEnterEvent);
      
      await element.updateComplete;
      
      const tooltip = element.shadowRoot?.querySelector('.tooltip.visible');
      expect(tooltip).to.exist;
      
      // Should contain structured information
      expect(tooltip?.textContent).toContain('Messages:');
      expect(tooltip?.textContent).toContain('Status:');
      expect(tooltip?.innerHTML).toContain('<strong>');
    });
  });

  describe('Interactive Element States', () => {
    it('should indicate current session visually and semantically', async () => {
      await element.updateComplete;
      
      const currentNode = element.shadowRoot?.querySelector('.session-node.current');
      expect(currentNode).to.exist;
      
      const ariaLabel = currentNode?.getAttribute('aria-label');
      expect(ariaLabel).toContain('Session');
    });

    it('should provide hover states for interactive elements', () => {
      const cssText = element.constructor.styles?.[1]?.toString() || '';
      
      // Should have hover states defined
      expect(cssText).toContain(':hover');
      expect(cssText).toContain('transition:');
    });

    it('should handle disabled states appropriately', () => {
      // Control buttons should handle disabled states
      const cssText = element.constructor.styles?.[1]?.toString() || '';
      expect(cssText).toContain(':disabled');
    });
  });
});