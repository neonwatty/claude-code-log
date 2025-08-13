import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { fixture, html, expect as expectLit, nextFrame, oneEvent } from '@open-wc/testing';
import { SessionBrowser } from '../SessionBrowser';
import { SessionSummary, SessionDetail } from '../../types/session-types';

// Mock WebSocket for real-time updates
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  url = '';
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      this.onopen?.(new Event('open'));
    }, 10);
  }

  send(data: string) {
    // Mock sending data
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.(new CloseEvent('close'));
  }

  // Helper method to simulate receiving messages
  simulateMessage(data: any) {
    if (this.readyState === MockWebSocket.OPEN) {
      this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(data) }));
    }
  }
}

// Mock child components with event handling
class MockSessionList extends HTMLElement {
  sessions: SessionSummary[] = [];
  filters = {};
  selectedSession: string | null = null;
  loading = false;

  connectedCallback() {
    this.innerHTML = `
      <div class="mock-session-list">
        <div class="session-items">${this.renderSessions()}</div>
      </div>
    `;
    this.attachEventListeners();
  }

  private renderSessions() {
    return this.sessions.map((session, index) => 
      `<div class="session-item" data-session-id="${session.sessionId}">${session.title}</div>`
    ).join('');
  }

  private attachEventListeners() {
    this.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('session-item')) {
        const sessionId = target.dataset.sessionId;
        const session = this.sessions.find(s => s.sessionId === sessionId);
        if (session) {
          this.dispatchEvent(new CustomEvent('session-selected', {
            detail: { sessionId, session },
            bubbles: true
          }));
        }
      }
    });
  }

  updateSessions(sessions: SessionSummary[]) {
    this.sessions = sessions;
    this.innerHTML = `
      <div class="mock-session-list">
        <div class="session-items">${this.renderSessions()}</div>
      </div>
    `;
    this.attachEventListeners();
  }
}

class MockSessionViewer extends HTMLElement {
  session: SessionDetail | null = null;
  loading = false;

  connectedCallback() {
    this.innerHTML = `
      <div class="mock-session-viewer">
        ${this.session ? `Session: ${this.session.title}` : 'No session selected'}
        <button class="create-branch">Create Branch</button>
      </div>
    `;
    this.attachEventListeners();
  }

  private attachEventListeners() {
    const branchButton = this.querySelector('.create-branch');
    branchButton?.addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('branch-requested', {
        detail: {
          sessionId: this.session?.sessionId,
          branchPoint: 1,
          message: { role: 'assistant', content: 'Test message' }
        },
        bubbles: true
      }));
    });
  }

  setSession(session: SessionDetail | null) {
    this.session = session;
    this.innerHTML = `
      <div class="mock-session-viewer">
        ${this.session ? `Session: ${this.session.title}` : 'No session selected'}
        <button class="create-branch">Create Branch</button>
      </div>
    `;
    this.attachEventListeners();
  }
}

class MockFilterPanel extends HTMLElement {
  filters = {};

  connectedCallback() {
    this.innerHTML = `
      <div class="mock-filter-panel">
        <input type="text" class="search-input" placeholder="Search sessions...">
        <select class="tag-filter">
          <option value="">All Tags</option>
          <option value="test">Test</option>
          <option value="active">Active</option>
        </select>
        <button class="clear-filters">Clear Filters</button>
      </div>
    `;
    this.attachEventListeners();
  }

  private attachEventListeners() {
    const searchInput = this.querySelector('.search-input') as HTMLInputElement;
    const tagFilter = this.querySelector('.tag-filter') as HTMLSelectElement;
    const clearButton = this.querySelector('.clear-filters');

    searchInput?.addEventListener('input', () => {
      this.updateFilters();
    });

    tagFilter?.addEventListener('change', () => {
      this.updateFilters();
    });

    clearButton?.addEventListener('click', () => {
      searchInput.value = '';
      tagFilter.value = '';
      this.updateFilters();
    });
  }

  private updateFilters() {
    const searchInput = this.querySelector('.search-input') as HTMLInputElement;
    const tagFilter = this.querySelector('.tag-filter') as HTMLSelectElement;
    
    const filters = {
      search: searchInput?.value || '',
      tags: tagFilter?.value ? [tagFilter.value] : []
    };

    this.dispatchEvent(new CustomEvent('filter-changed', {
      detail: { filters },
      bubbles: true
    }));
  }
}

// Register mock components
if (!customElements.get('session-list')) {
  customElements.define('session-list', MockSessionList);
}

if (!customElements.get('session-viewer')) {
  customElements.define('session-viewer', MockSessionViewer);
}

if (!customElements.get('filter-panel')) {
  customElements.define('filter-panel', MockFilterPanel);
}

describe('SessionBrowser Integration Tests', () => {
  let element: SessionBrowser;
  let mockSessions: SessionSummary[];
  let mockSessionDetail: SessionDetail;
  let mockWebSocket: MockWebSocket;

  beforeEach(async () => {
    // Mock WebSocket globally
    (global as any).WebSocket = MockWebSocket;

    // Create comprehensive mock data
    mockSessions = [
      {
        sessionId: 'session-1',
        title: 'JavaScript Tutorial Session',
        cwd: '/projects/js-tutorial',
        startTime: new Date('2024-01-01T10:00:00Z'),
        endTime: new Date('2024-01-01T11:30:00Z'),
        messageCount: 15,
        userMessageCount: 8,
        assistantMessageCount: 7,
        duration: 5400000,
        isActive: false,
        tags: ['javascript', 'tutorial'],
        summary: 'Learning JavaScript fundamentals with examples',
        tokenUsage: {
          inputTokens: 2000,
          outputTokens: 3000,
          totalTokens: 5000
        }
      },
      {
        sessionId: 'session-2',
        title: 'React Component Development',
        cwd: '/projects/react-app',
        startTime: new Date('2024-01-01T14:00:00Z'),
        messageCount: 25,
        userMessageCount: 12,
        assistantMessageCount: 13,
        isActive: true,
        tags: ['react', 'components'],
        summary: 'Building React components with hooks',
        tokenUsage: {
          inputTokens: 3500,
          outputTokens: 4500,
          totalTokens: 8000
        }
      },
      {
        sessionId: 'session-3',
        title: 'Bug Fix Session',
        cwd: '/projects/debug',
        startTime: new Date('2024-01-01T16:00:00Z'),
        endTime: new Date('2024-01-01T17:00:00Z'),
        messageCount: 8,
        userMessageCount: 4,
        assistantMessageCount: 4,
        duration: 3600000,
        isActive: false,
        tags: ['bug-fix', 'debugging'],
        summary: 'Debugging async function issues',
        tokenUsage: {
          inputTokens: 1200,
          outputTokens: 1800,
          totalTokens: 3000
        }
      }
    ];

    mockSessionDetail = {
      ...mockSessions[0],
      entries: [
        {
          role: 'user',
          content: 'Can you help me learn JavaScript?',
          timestamp: '2024-01-01T10:00:00Z',
          tokenCount: 100
        },
        {
          role: 'assistant',
          content: [
            {
              type: 'text',
              text: 'I\'d be happy to help you learn JavaScript! Let\'s start with variables:\n\n```javascript\nlet name = "JavaScript";\nconst version = 2024;\nvar isAwesome = true;\n```'
            }
          ],
          timestamp: '2024-01-01T10:01:00Z',
          tokenCount: 200,
          thinking: ['The user wants to learn JavaScript, I should start with fundamentals']
        }
      ],
      metadata: {
        version: '1.0.0',
        client: 'claude-code'
      },
      referencedFiles: [],
      toolsUsed: [],
      errors: []
    };

    element = await fixture(html`<session-browser></session-browser>`) as SessionBrowser;
  });

  afterEach(() => {
    vi.clearAllMocks();
    mockWebSocket?.close();
  });

  describe('Session List and Viewer Coordination', () => {
    it('should coordinate session selection between list and viewer', async () => {
      element.sessions = mockSessions;
      await element.updateComplete;
      await nextFrame();

      const sessionList = element.shadowRoot?.querySelector('session-list') as MockSessionList;
      const sessionViewer = element.shadowRoot?.querySelector('session-viewer') as MockSessionViewer;
      
      expect(sessionList).to.exist;
      expect(sessionViewer).to.exist;

      // Simulate clicking on a session in the list
      const sessionItem = sessionList.querySelector('.session-item[data-session-id="session-1"]') as HTMLElement;
      expect(sessionItem).to.exist;
      
      sessionItem.click();
      await nextFrame();

      // Should trigger session-selected event
      const sessionSelectedEvent = await oneEvent(element, 'session-selected');
      expect(sessionSelectedEvent.detail.sessionId).to.equal('session-1');
    });

    it('should load session details when session is selected', async () => {
      element.sessions = mockSessions;
      await element.updateComplete;

      const detailsRequestedSpy = vi.fn();
      element.addEventListener('session-details-requested', detailsRequestedSpy);

      // Simulate session selection
      const sessionSelectedEvent = new CustomEvent('session-selected', {
        detail: { sessionId: 'session-1', session: mockSessions[0] }
      });
      element.dispatchEvent(sessionSelectedEvent);

      expect(detailsRequestedSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: expect.objectContaining({
            sessionId: 'session-1'
          })
        })
      );
    });

    it('should update viewer when session details are loaded', async () => {
      element.sessions = mockSessions;
      element.selectedSession = mockSessionDetail;
      await element.updateComplete;

      const sessionViewer = element.shadowRoot?.querySelector('session-viewer') as MockSessionViewer;
      expect(sessionViewer.session).to.deep.equal(mockSessionDetail);
    });

    it('should handle multiple rapid session selections', async () => {
      element.sessions = mockSessions;
      await element.updateComplete;

      const sessionList = element.shadowRoot?.querySelector('session-list') as MockSessionList;
      
      // Rapidly select different sessions
      const session1Item = sessionList.querySelector('.session-item[data-session-id="session-1"]') as HTMLElement;
      const session2Item = sessionList.querySelector('.session-item[data-session-id="session-2"]') as HTMLElement;
      
      session1Item.click();
      await nextFrame();
      
      session2Item.click();
      await nextFrame();

      // Should handle the latest selection
      const latestEvent = await oneEvent(element, 'session-selected');
      expect(latestEvent.detail.sessionId).to.equal('session-2');
    });
  });

  describe('Filter Integration', () => {
    it('should filter sessions based on search input', async () => {
      element.sessions = mockSessions;
      await element.updateComplete;

      const filterPanel = element.shadowRoot?.querySelector('filter-panel') as MockFilterPanel;
      const searchInput = filterPanel.querySelector('.search-input') as HTMLInputElement;
      
      // Type in search input
      searchInput.value = 'JavaScript';
      searchInput.dispatchEvent(new Event('input'));
      
      await nextFrame();

      const filterChangedEvent = await oneEvent(element, 'filter-changed');
      expect(filterChangedEvent.detail.filters.search).to.equal('JavaScript');
    });

    it('should filter sessions by tags', async () => {
      element.sessions = mockSessions;
      await element.updateComplete;

      const filterPanel = element.shadowRoot?.querySelector('filter-panel') as MockFilterPanel;
      const tagFilter = filterPanel.querySelector('.tag-filter') as HTMLSelectElement;
      
      // Select a tag
      tagFilter.value = 'react';
      tagFilter.dispatchEvent(new Event('change'));
      
      await nextFrame();

      const filterChangedEvent = await oneEvent(element, 'filter-changed');
      expect(filterChangedEvent.detail.filters.tags).to.include('react');
    });

    it('should clear filters when clear button is clicked', async () => {
      element.sessions = mockSessions;
      await element.updateComplete;

      const filterPanel = element.shadowRoot?.querySelector('filter-panel') as MockFilterPanel;
      const searchInput = filterPanel.querySelector('.search-input') as HTMLInputElement;
      const clearButton = filterPanel.querySelector('.clear-filters') as HTMLButtonElement;
      
      // Set some filters first
      searchInput.value = 'test';
      searchInput.dispatchEvent(new Event('input'));
      await nextFrame();
      
      // Clear filters
      clearButton.click();
      await nextFrame();

      const filterChangedEvent = await oneEvent(element, 'filter-changed');
      expect(filterChangedEvent.detail.filters.search).to.equal('');
    });

    it('should apply combined filters (search + tags)', async () => {
      element.sessions = mockSessions;
      await element.updateComplete;

      const filterPanel = element.shadowRoot?.querySelector('filter-panel') as MockFilterPanel;
      const searchInput = filterPanel.querySelector('.search-input') as HTMLInputElement;
      const tagFilter = filterPanel.querySelector('.tag-filter') as HTMLSelectElement;
      
      // Apply both search and tag filters
      searchInput.value = 'React';
      tagFilter.value = 'react';
      
      searchInput.dispatchEvent(new Event('input'));
      await nextFrame();

      const filterChangedEvent = await oneEvent(element, 'filter-changed');
      expect(filterChangedEvent.detail.filters.search).to.equal('React');
      expect(filterChangedEvent.detail.filters.tags).to.include('react');
    });
  });

  describe('Real-time Updates Integration', () => {
    beforeEach(() => {
      element.realTimeUpdates = true;
    });

    it('should establish WebSocket connection for real-time updates', async () => {
      element.sessions = mockSessions;
      element.connectionStatus = 'connected';
      await element.updateComplete;

      const statusIndicator = element.shadowRoot?.querySelector('.status-indicator.connected');
      expect(statusIndicator).to.exist;
    });

    it('should handle incoming session updates via WebSocket', async () => {
      element.sessions = mockSessions;
      await element.updateComplete;

      // Simulate WebSocket connection
      mockWebSocket = new MockWebSocket('ws://localhost:3000/sessions');
      
      // Wait for connection
      await new Promise(resolve => setTimeout(resolve, 20));
      
      // Simulate receiving new session data
      mockWebSocket.simulateMessage({
        type: 'session_update',
        data: {
          sessionId: 'session-4',
          title: 'New Real-time Session',
          isActive: true
        }
      });

      // Should handle the update
      expect(mockWebSocket.readyState).to.equal(MockWebSocket.OPEN);
    });

    it('should handle WebSocket disconnection gracefully', async () => {
      element.connectionStatus = 'connected';
      await element.updateComplete;

      mockWebSocket = new MockWebSocket('ws://localhost:3000/sessions');
      await new Promise(resolve => setTimeout(resolve, 20));

      // Simulate disconnection
      mockWebSocket.close();
      
      element.connectionStatus = 'disconnected';
      await element.updateComplete;

      const statusIndicator = element.shadowRoot?.querySelector('.status-indicator.disconnected');
      expect(statusIndicator).to.exist;
    });

    it('should attempt to reconnect when connection is lost', async () => {
      element.connectionStatus = 'disconnected';
      await element.updateComplete;

      // Simulate reconnection attempt
      element.connectionStatus = 'reconnecting';
      await element.updateComplete;

      const statusIndicator = element.shadowRoot?.querySelector('.status-indicator.reconnecting');
      expect(statusIndicator).to.exist;

      // Simulate successful reconnection
      element.connectionStatus = 'connected';
      await element.updateComplete;

      const connectedIndicator = element.shadowRoot?.querySelector('.status-indicator.connected');
      expect(connectedIndicator).to.exist;
    });
  });

  describe('Layout Coordination', () => {
    it('should coordinate layout changes between components', async () => {
      element.sessions = mockSessions;
      element.selectedSession = mockSessionDetail;
      await element.updateComplete;

      const sessionList = element.shadowRoot?.querySelector('session-list');
      const sessionViewer = element.shadowRoot?.querySelector('session-viewer');
      const container = element.shadowRoot?.querySelector('.browser-container');
      
      // Test split layout (default)
      expect(container?.classList.contains('split')).to.be.true;
      expect(sessionList).to.be.visible;
      expect(sessionViewer).to.be.visible;

      // Switch to list-only layout
      const listOnlyButton = element.shadowRoot?.querySelector('[data-layout="list-only"]') as HTMLButtonElement;
      listOnlyButton.click();
      await element.updateComplete;

      expect(element.layout).to.equal('list-only');
      expect(container?.classList.contains('list-only')).to.be.true;

      // Switch to viewer-only layout
      const viewerOnlyButton = element.shadowRoot?.querySelector('[data-layout="viewer-only"]') as HTMLButtonElement;
      viewerOnlyButton.click();
      await element.updateComplete;

      expect(element.layout).to.equal('viewer-only');
      expect(container?.classList.contains('viewer-only')).to.be.true;
    });

    it('should handle layout switching with keyboard shortcuts', async () => {
      element.sessions = mockSessions;
      await element.updateComplete;

      // Test Ctrl+1 for split layout
      const splitShortcut = new KeyboardEvent('keydown', {
        key: '1',
        ctrlKey: true
      });
      element.dispatchEvent(splitShortcut);
      await element.updateComplete;

      expect(element.layout).to.equal('split');

      // Test Ctrl+2 for list-only layout
      const listShortcut = new KeyboardEvent('keydown', {
        key: '2',
        ctrlKey: true
      });
      element.dispatchEvent(listShortcut);
      await element.updateComplete;

      expect(element.layout).to.equal('list-only');
    });
  });

  describe('Branch Management Integration', () => {
    it('should handle branch creation requests from viewer', async () => {
      element.sessions = mockSessions;
      element.selectedSession = mockSessionDetail;
      await element.updateComplete;

      const branchRequestSpy = vi.fn();
      element.addEventListener('branch-requested', branchRequestSpy);

      const sessionViewer = element.shadowRoot?.querySelector('session-viewer') as MockSessionViewer;
      const createBranchButton = sessionViewer.querySelector('.create-branch') as HTMLButtonElement;
      
      createBranchButton.click();
      
      expect(branchRequestSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: expect.objectContaining({
            sessionId: mockSessionDetail.sessionId,
            branchPoint: 1
          })
        })
      );
    });

    it('should propagate branch events to parent components', async () => {
      element.sessions = mockSessions;
      element.selectedSession = mockSessionDetail;
      await element.updateComplete;

      const branchEventSpy = vi.fn();
      element.addEventListener('branch-requested', branchEventSpy);

      // Simulate branch request from deeply nested component
      const branchEvent = new CustomEvent('branch-requested', {
        detail: {
          sessionId: 'session-1',
          branchPoint: 2,
          message: { role: 'assistant', content: 'Branch from here' }
        },
        bubbles: true
      });

      const sessionViewer = element.shadowRoot?.querySelector('session-viewer');
      sessionViewer?.dispatchEvent(branchEvent);

      expect(branchEventSpy).toHaveBeenCalledOnce();
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle session loading errors gracefully', async () => {
      const errorEventSpy = vi.fn();
      element.addEventListener('error-occurred', errorEventSpy);

      // Simulate error during session loading
      const errorEvent = new CustomEvent('error-occurred', {
        detail: { error: 'Failed to load session details' },
        bubbles: true
      });
      
      element.dispatchEvent(errorEvent);

      expect(errorEventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: expect.objectContaining({
            error: 'Failed to load session details'
          })
        })
      );

      element.errorMessage = 'Failed to load session details';
      await element.updateComplete;

      const errorDisplay = element.shadowRoot?.querySelector('.error-message');
      expect(errorDisplay).to.exist;
    });

    it('should recover from errors and continue functioning', async () => {
      // Start with error state
      element.errorMessage = 'Test error';
      await element.updateComplete;

      expect(element.shadowRoot?.querySelector('.error-message')).to.exist;

      // Clear error and load sessions
      element.errorMessage = '';
      element.sessions = mockSessions;
      await element.updateComplete;

      const sessionList = element.shadowRoot?.querySelector('session-list') as MockSessionList;
      expect(sessionList.sessions).to.deep.equal(mockSessions);
      expect(element.shadowRoot?.querySelector('.error-message')).to.not.exist;
    });

    it('should handle network connectivity issues', async () => {
      element.realTimeUpdates = true;
      element.connectionStatus = 'connected';
      await element.updateComplete;

      // Simulate network issue
      element.connectionStatus = 'disconnected';
      await element.updateComplete;

      const statusIndicator = element.shadowRoot?.querySelector('.status-indicator.disconnected');
      expect(statusIndicator).to.exist;

      // Should attempt to reconnect
      element.connectionStatus = 'reconnecting';
      await element.updateComplete;

      const reconnectingIndicator = element.shadowRoot?.querySelector('.status-indicator.reconnecting');
      expect(reconnectingIndicator).to.exist;
    });
  });

  describe('Performance Integration', () => {
    it('should handle large numbers of sessions efficiently', async () => {
      const largeSessions = Array.from({ length: 1000 }, (_, i) => ({
        sessionId: `session-${i}`,
        title: `Session ${i + 1}`,
        cwd: `/project-${i}`,
        startTime: new Date(Date.now() + i * 1000),
        messageCount: Math.floor(Math.random() * 50) + 1,
        userMessageCount: Math.floor(Math.random() * 25),
        assistantMessageCount: Math.floor(Math.random() * 25),
        isActive: i < 5, // Only first 5 are active
        tags: [`tag-${i % 10}`],
        summary: `Summary for session ${i + 1}`,
        tokenUsage: {
          inputTokens: Math.floor(Math.random() * 1000),
          outputTokens: Math.floor(Math.random() * 1000),
          totalTokens: 0
        }
      }));

      // Calculate total tokens
      largeSessions.forEach(session => {
        session.tokenUsage.totalTokens = session.tokenUsage.inputTokens + session.tokenUsage.outputTokens;
      });

      const startTime = performance.now();
      element.sessions = largeSessions;
      await element.updateComplete;
      const endTime = performance.now();

      expect(endTime - startTime).to.be.lessThan(2000); // Should handle 1000 sessions in under 2 seconds

      const sessionList = element.shadowRoot?.querySelector('session-list') as MockSessionList;
      expect(sessionList.sessions).to.have.length(1000);
    });

    it('should maintain responsiveness during layout switches', async () => {
      element.sessions = mockSessions;
      element.selectedSession = mockSessionDetail;
      await element.updateComplete;

      const layoutSwitches = ['list-only', 'viewer-only', 'split'] as const;
      
      for (const layout of layoutSwitches) {
        const startTime = performance.now();
        
        const button = element.shadowRoot?.querySelector(`[data-layout="${layout}"]`) as HTMLButtonElement;
        button.click();
        await element.updateComplete;
        
        const endTime = performance.now();
        
        expect(endTime - startTime).to.be.lessThan(100); // Should switch layouts quickly
        expect(element.layout).to.equal(layout);
      }
    });
  });

  describe('Accessibility Integration', () => {
    it('should coordinate focus management between components', async () => {
      element.sessions = mockSessions;
      element.selectedSession = mockSessionDetail;
      await element.updateComplete;

      const sessionList = element.shadowRoot?.querySelector('session-list');
      const sessionViewer = element.shadowRoot?.querySelector('session-viewer');
      
      // Focus should be manageable between components
      expect(sessionList?.tabIndex).to.not.equal(-1);
      expect(sessionViewer?.tabIndex).to.not.equal(-1);
    });

    it('should announce important state changes to screen readers', async () => {
      element.sessions = mockSessions;
      await element.updateComplete;

      // Mock aria-live region
      const liveRegion = element.shadowRoot?.querySelector('[aria-live]');
      expect(liveRegion).to.exist;

      // Layout changes should be announced
      const listOnlyButton = element.shadowRoot?.querySelector('[data-layout="list-only"]') as HTMLButtonElement;
      listOnlyButton.click();
      await element.updateComplete;

      // Should have accessibility features
      expect(element.shadowRoot?.querySelector('[role="main"]')).to.exist;
    });

    it('should maintain keyboard navigation flow across components', async () => {
      element.sessions = mockSessions;
      element.selectedSession = mockSessionDetail;
      await element.updateComplete;

      // Tab navigation should work across the entire component
      const focusableElements = element.shadowRoot?.querySelectorAll(
        'button, [tabindex="0"], input, select'
      );
      
      expect(focusableElements?.length).to.be.greaterThan(0);
      
      // Each focusable element should be properly accessible
      focusableElements?.forEach(el => {
        expect(el.getAttribute('tabindex')).to.not.equal('-1');
      });
    });
  });
});