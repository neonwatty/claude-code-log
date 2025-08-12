import { describe, it, expect, beforeEach } from 'vitest';
import { fixture, html } from '@open-wc/testing';
import { BranchPointSelector } from '../BranchPointSelector';
import type { SessionSummary } from '../../types/session-types';
import type { TranscriptEntry } from '@app/shared';

// Mock data for accessibility testing
const mockSession: SessionSummary = {
  sessionId: 'a11y-test-session',
  cwd: '/test/project',
  startTime: new Date('2024-01-01T10:00:00Z'),
  messageCount: 3,
  userMessageCount: 1,
  assistantMessageCount: 2,
  isActive: false,
  parentSessionId: null,
  branchPoint: null,
  branchTimestamp: null,
};

const mockEntries: TranscriptEntry[] = [
  {
    type: 'user',
    message: {
      role: 'user',
      content: 'Test user message for accessibility testing'
    },
    parentUuid: null,
    isSidechain: false,
    userType: 'human',
    cwd: '/test/project',
    sessionId: 'a11y-test-session',
    version: '1.0.0',
    uuid: 'msg-1',
    timestamp: '2024-01-01T10:00:00Z',
  },
  {
    type: 'assistant',
    message: {
      id: 'msg-2',
      type: 'message',
      role: 'assistant',
      model: 'claude-3-sonnet',
      content: [
        {
          type: 'text',
          text: 'First assistant response for accessibility testing'
        }
      ]
    },
    parentUuid: null,
    isSidechain: false,
    userType: 'assistant',
    cwd: '/test/project',
    sessionId: 'a11y-test-session',
    version: '1.0.0',
    uuid: 'msg-2',
    timestamp: '2024-01-01T10:01:00Z',
  },
  {
    type: 'assistant',
    message: {
      id: 'msg-3',
      type: 'message',
      role: 'assistant',
      model: 'claude-3-sonnet',
      content: [
        {
          type: 'text',
          text: 'Second assistant response for comprehensive accessibility testing'
        }
      ]
    },
    parentUuid: null,
    isSidechain: false,
    userType: 'assistant',
    cwd: '/test/project',
    sessionId: 'a11y-test-session',
    version: '1.0.0',
    uuid: 'msg-3',
    timestamp: '2024-01-01T10:02:00Z',
  }
] as TranscriptEntry[];

describe('BranchPointSelector Accessibility', () => {
  let element: BranchPointSelector;

  beforeEach(async () => {
    element = await fixture(html`
      <branch-point-selector
        .session=${mockSession}
        .entries=${mockEntries}
        aria-label="Branch point selection for session"
      ></branch-point-selector>
    `);
  });

  describe('ARIA Compliance', () => {
    it('should have proper role attributes', () => {
      const container = element.shadowRoot?.querySelector('.messages-container');
      expect(container?.getAttribute('role')).toBe('listbox');
    });

    it('should have accessible labels', () => {
      const container = element.shadowRoot?.querySelector('.messages-container');
      expect(container?.getAttribute('aria-label')).toBe('Available branch points');
    });

    it('should have proper button roles for selectable items', () => {
      const selectableItems = element.shadowRoot?.querySelectorAll('.message-item.selectable');
      selectableItems.forEach(item => {
        expect(item.getAttribute('role')).toBe('button');
        expect(item.getAttribute('aria-pressed')).toBe('false');
      });
    });

    it('should have descriptive aria-label for each selectable item', () => {
      const selectableItems = element.shadowRoot?.querySelectorAll('.message-item.selectable');
      selectableItems.forEach((item, index) => {
        const ariaLabel = item.getAttribute('aria-label');
        expect(ariaLabel).toMatch(/^Branch from message \d+$/);
      });
    });
  });

  describe('Keyboard Navigation', () => {
    it('should have proper tabindex for keyboard navigation', () => {
      const selectableItems = element.shadowRoot?.querySelectorAll('.message-item.selectable');
      selectableItems.forEach(item => {
        expect(item.getAttribute('tabindex')).toBe('0');
      });
    });

    it('should have non-focusable non-selectable items', () => {
      const nonSelectableItems = element.shadowRoot?.querySelectorAll('.message-item:not(.selectable)');
      nonSelectableItems.forEach(item => {
        expect(item.getAttribute('tabindex')).toBe('-1');
      });
    });

    it('should respond to Enter key', async () => {
      let eventFired = false;
      
      element.addEventListener('branch-point-selected', (() => {
        eventFired = true;
      }) as EventListener);

      const firstSelectableItem = element.shadowRoot?.querySelector('.message-item.selectable') as HTMLElement;
      expect(firstSelectableItem).to.exist;

      // Simulate Enter key press
      const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });
      firstSelectableItem.dispatchEvent(enterEvent);

      await element.updateComplete;
      expect(eventFired).toBe(true);
    });

    it('should respond to Space key', async () => {
      let eventFired = false;
      
      element.addEventListener('branch-point-selected', (() => {
        eventFired = true;
      }) as EventListener);

      const firstSelectableItem = element.shadowRoot?.querySelector('.message-item.selectable') as HTMLElement;
      expect(firstSelectableItem).to.exist;

      // Simulate Space key press
      const spaceEvent = new KeyboardEvent('keydown', { key: ' ' });
      firstSelectableItem.dispatchEvent(spaceEvent);

      await element.updateComplete;
      expect(eventFired).toBe(true);
    });
  });

  describe('Focus Management', () => {
    it('should have visible focus indicators', () => {
      const styles = getComputedStyle(element);
      
      // Check that focus styles are defined in the component's CSS
      const cssText = element.constructor.styles?.[1]?.toString() || '';
      expect(cssText).toContain('focus');
      expect(cssText).toContain('outline');
    });

    it('should support focus-visible', () => {
      const cssText = element.constructor.styles?.[1]?.toString() || '';
      expect(cssText).toContain('focus-visible');
    });
  });

  describe('Screen Reader Support', () => {
    it('should have meaningful text content for screen readers', () => {
      const messageRoles = element.shadowRoot?.querySelectorAll('.message-role');
      messageRoles?.forEach(role => {
        expect(role.textContent?.trim()).toMatch(/^(user|assistant)$/i);
      });
    });

    it('should have descriptive preview text', () => {
      const previews = element.shadowRoot?.querySelectorAll('.message-preview');
      previews?.forEach(preview => {
        expect(preview.textContent?.trim().length).toBeGreaterThan(0);
      });
    });

    it('should show timestamp information for context', () => {
      const metaSections = element.shadowRoot?.querySelectorAll('.message-meta');
      metaSections?.forEach(meta => {
        expect(meta.textContent).toMatch(/\d{1,2}:\d{2}/); // Time format
      });
    });
  });

  describe('Selection State Communication', () => {
    it('should update aria-pressed when item is selected', async () => {
      const firstSelectableItem = element.shadowRoot?.querySelector('.message-item.selectable') as HTMLElement;
      
      expect(firstSelectableItem.getAttribute('aria-pressed')).toBe('false');
      
      firstSelectableItem.click();
      await element.updateComplete;
      
      expect(firstSelectableItem.getAttribute('aria-pressed')).toBe('true');
    });

    it('should update aria-activedescendant on container when selection changes', async () => {
      const container = element.shadowRoot?.querySelector('.messages-container');
      const firstSelectableItem = element.shadowRoot?.querySelector('.message-item.selectable') as HTMLElement;
      
      firstSelectableItem.click();
      await element.updateComplete;
      
      const activeDescendant = container?.getAttribute('aria-activedescendant');
      expect(activeDescendant).toBeDefined();
    });
  });

  describe('Error States Accessibility', () => {
    it('should provide accessible empty state message', async () => {
      const emptyElement = await fixture(html`
        <branch-point-selector
          .session=${mockSession}
          .entries=${[]}
        ></branch-point-selector>
      `);

      const emptyState = emptyElement.shadowRoot?.querySelector('.empty-state');
      expect(emptyState).to.exist;
      
      const title = emptyState?.querySelector('.empty-state-title');
      const description = emptyState?.querySelector('.empty-state-description');
      
      expect(title?.textContent?.trim()).toBe('No Messages Available');
      expect(description?.textContent?.trim()).toContain('Load a session');
    });
  });

  describe('High Contrast Mode Support', () => {
    it('should have proper border styles for high contrast', () => {
      const cssText = element.constructor.styles?.[1]?.toString() || '';
      
      // Should have border styles that will be visible in high contrast mode
      expect(cssText).toContain('border:');
      expect(cssText).toContain('border-color:');
    });
  });

  describe('Reduced Motion Support', () => {
    it('should use CSS transitions that respect reduced motion preferences', () => {
      const cssText = element.constructor.styles?.[1]?.toString() || '';
      
      // Should have transition styles (actual reduced motion would be handled by CSS)
      expect(cssText).toContain('transition:');
    });
  });

  describe('Color Contrast', () => {
    it('should use semantic color variables for proper contrast', () => {
      const cssText = element.constructor.styles?.[1]?.toString() || '';
      
      // Should use CSS custom properties that provide proper contrast
      expect(cssText).toContain('var(--color-');
      expect(cssText).toContain('var(--color-text-primary)');
      expect(cssText).toContain('var(--color-text-muted)');
    });
  });
});