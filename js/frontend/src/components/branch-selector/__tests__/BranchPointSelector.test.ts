import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fixture, html, expect as expectLit } from '@open-wc/testing';
import { BranchPointSelector } from '../BranchPointSelector';
import type { SessionSummary, BranchPoint } from '../../types/session-types';
import type { TranscriptEntry } from '@app/shared';

// Mock data for testing
const mockSession: SessionSummary = {
  sessionId: 'test-session-123',
  cwd: '/test/project',
  startTime: new Date('2024-01-01T10:00:00Z'),
  messageCount: 4,
  userMessageCount: 2,
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
      content: 'Hello, can you help me with a coding problem?'
    },
    parentUuid: null,
    isSidechain: false,
    userType: 'human',
    cwd: '/test/project',
    sessionId: 'test-session-123',
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
          text: 'Of course! I\'d be happy to help you with your coding problem. What specific issue are you working on?'
        }
      ]
    },
    parentUuid: null,
    isSidechain: false,
    userType: 'assistant',
    cwd: '/test/project',
    sessionId: 'test-session-123',
    version: '1.0.0',
    uuid: 'msg-2',
    timestamp: '2024-01-01T10:01:00Z',
  },
  {
    type: 'user',
    message: {
      role: 'user',
      content: 'I\'m working on a React component and having trouble with state management.'
    },
    parentUuid: null,
    isSidechain: false,
    userType: 'human',
    cwd: '/test/project',
    sessionId: 'test-session-123',
    version: '1.0.0',
    uuid: 'msg-3',
    timestamp: '2024-01-01T10:02:00Z',
  },
  {
    type: 'assistant',
    message: {
      id: 'msg-4',
      type: 'message',
      role: 'assistant',
      model: 'claude-3-sonnet',
      content: [
        {
          type: 'text',
          text: 'React state management can be tricky! Let me help you with that. There are several approaches we can take...'
        }
      ]
    },
    parentUuid: null,
    isSidechain: false,
    userType: 'assistant',
    cwd: '/test/project',
    sessionId: 'test-session-123',
    version: '1.0.0',
    uuid: 'msg-4',
    timestamp: '2024-01-01T10:03:00Z',
  }
] as TranscriptEntry[];

describe('BranchPointSelector', () => {
  let element: BranchPointSelector;

  beforeEach(async () => {
    element = await fixture(html`
      <branch-point-selector
        .session=${mockSession}
        .entries=${mockEntries}
      ></branch-point-selector>
    `);
  });

  describe('Component Initialization', () => {
    it('should create element', () => {
      expect(element).toBeInstanceOf(BranchPointSelector);
    });

    it('should have correct tag name', () => {
      expect(element.tagName.toLowerCase()).toBe('branch-point-selector');
    });

    it('should be in the DOM', () => {
      expect(element).to.exist;
    });
  });

  describe('Property Handling', () => {
    it('should accept session property', () => {
      expect(element.session).toEqual(mockSession);
    });

    it('should accept entries property', () => {
      expect(element.entries).toEqual(mockEntries);
    });

    it('should have default display mode', () => {
      expect(element.displayMode).toBe('compact');
    });

    it('should have default validOnly setting', () => {
      expect(element.validOnly).toBe(true);
    });
  });

  describe('Rendering', () => {
    it('should render header', () => {
      const header = element.shadowRoot?.querySelector('.branch-selector-header');
      expect(header).to.exist;
      
      const title = header?.querySelector('.header-title');
      expect(title?.textContent).toContain('Select Branch Point');
    });

    it('should render messages container', () => {
      const container = element.shadowRoot?.querySelector('.messages-container');
      expect(container).to.exist;
    });

    it('should render message items for assistant messages', () => {
      const messageItems = element.shadowRoot?.querySelectorAll('.message-item.assistant.selectable');
      expect(messageItems).to.have.length(2); // Two assistant messages in mock data
    });

    it('should render message items for user messages (non-selectable)', () => {
      const messageItems = element.shadowRoot?.querySelectorAll('.message-item.user');
      expect(messageItems).to.have.length(2); // Two user messages in mock data
    });
  });

  describe('Branch Point Selection', () => {
    it('should identify valid branch points', () => {
      // The component should identify assistant messages as valid branch points
      const selectableItems = element.shadowRoot?.querySelectorAll('.message-item.selectable');
      expect(selectableItems).to.have.length(2);
    });

    it('should emit event when branch point is selected', async () => {
      let eventFired = false;
      let eventDetail: any = null;

      element.addEventListener('branch-point-selected', ((event: CustomEvent) => {
        eventFired = true;
        eventDetail = event.detail;
      }) as EventListener);

      // Click on first assistant message (index 1)
      const firstAssistantItem = element.shadowRoot?.querySelector('.message-item.selectable[data-message-index="1"]') as HTMLElement;
      expect(firstAssistantItem).to.exist;
      
      firstAssistantItem.click();

      await element.updateComplete;

      expect(eventFired).toBe(true);
      expect(eventDetail).toEqual({
        sessionId: mockSession.sessionId,
        branchPoint: expect.objectContaining({
          messageIndex: 1
        })
      });
    });

    it('should handle keyboard navigation', async () => {
      let eventFired = false;
      
      element.addEventListener('branch-point-selected', (() => {
        eventFired = true;
      }) as EventListener);

      const firstAssistantItem = element.shadowRoot?.querySelector('.message-item.selectable[data-message-index="1"]') as HTMLElement;
      expect(firstAssistantItem).to.exist;

      // Simulate Enter key press
      const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });
      firstAssistantItem.dispatchEvent(enterEvent);

      await element.updateComplete;

      expect(eventFired).toBe(true);
    });
  });

  describe('Empty States', () => {
    it('should handle empty entries', async () => {
      const emptyElement = await fixture(html`
        <branch-point-selector
          .session=${mockSession}
          .entries=${[]}
        ></branch-point-selector>
      `);

      const emptyState = emptyElement.shadowRoot?.querySelector('.empty-state');
      expect(emptyState).to.exist;
      expect(emptyState?.textContent).toContain('No Messages Available');
    });

    it('should handle missing session', async () => {
      const noSessionElement = await fixture(html`
        <branch-point-selector
          .entries=${mockEntries}
        ></branch-point-selector>
      `);

      const emptyState = noSessionElement.shadowRoot?.querySelector('.empty-state');
      expect(emptyState).to.exist;
      expect(emptyState?.textContent).toContain('No Messages Available');
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      const container = element.shadowRoot?.querySelector('.messages-container');
      expect(container?.getAttribute('role')).toBe('listbox');
      expect(container?.getAttribute('aria-label')).toBe('Available branch points');
    });

    it('should have focusable selectable items', () => {
      const selectableItems = element.shadowRoot?.querySelectorAll('.message-item.selectable');
      selectableItems.forEach(item => {
        expect(item.getAttribute('tabindex')).toBe('0');
        expect(item.getAttribute('role')).toBe('button');
      });
    });

    it('should have non-focusable non-selectable items', () => {
      const nonSelectableItems = element.shadowRoot?.querySelectorAll('.message-item:not(.selectable)');
      nonSelectableItems.forEach(item => {
        expect(item.getAttribute('tabindex')).toBe('-1');
      });
    });
  });

  describe('Display Modes', () => {
    it('should support different display modes', async () => {
      element.displayMode = 'detailed';
      await element.updateComplete;
      
      expect(element.displayMode).toBe('detailed');
    });

    it('should support validOnly setting', async () => {
      element.validOnly = false;
      await element.updateComplete;
      
      expect(element.validOnly).toBe(false);
      
      // Should now show all messages as selectable
      const selectableItems = element.shadowRoot?.querySelectorAll('.message-item.selectable');
      expect(selectableItems).to.have.length(4); // All messages should be selectable
    });
  });

  describe('Message Preview Extraction', () => {
    it('should extract text from user messages', () => {
      const messageItems = element.shadowRoot?.querySelectorAll('.message-item .message-preview');
      expect(messageItems?.[0]?.textContent).toContain('Hello, can you help me');
    });

    it('should extract text from assistant messages', () => {
      const assistantItems = element.shadowRoot?.querySelectorAll('.message-item.assistant .message-preview');
      expect(assistantItems?.[0]?.textContent).toContain('Of course! I\'d be happy to help');
    });
  });
});

// Test the component can be imported and used
describe('BranchPointSelector Import', () => {
  it('should be importable', () => {
    expect(BranchPointSelector).toBeDefined();
  });

  it('should be a custom element', () => {
    expect(customElements.get('branch-point-selector')).toBeDefined();
  });
});