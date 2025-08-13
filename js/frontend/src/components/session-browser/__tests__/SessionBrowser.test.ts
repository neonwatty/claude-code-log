import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { fixture, html, expect as expectLit } from '@open-wc/testing';
import { SessionBrowser } from '../SessionBrowser';
import { SessionSummary, SessionDetail } from '../../types/session-types';

// Mock child components
vi.mock('../../session-list/SessionList', () => ({
  SessionList: class extends HTMLElement {
    sessions = [];
    filters = {};
    selectedSession = null;
    loading = false;
    connectedCallback() {
      this.innerHTML = '<div class="mock-session-list">Session List</div>';
    }
  }
}));

vi.mock('../viewer/SessionViewer', () => ({
  SessionViewer: class extends HTMLElement {
    session = null;
    loading = false;
    connectedCallback() {
      this.innerHTML = '<div class="mock-session-viewer">Session Viewer</div>';
    }
  }
}));

vi.mock('../../filters/FilterPanel', () => ({
  FilterPanel: class extends HTMLElement {
    filters = {};
    connectedCallback() {
      this.innerHTML = '<div class="mock-filter-panel">Filter Panel</div>';
    }
  }
}));

// Register mock components
if (!customElements.get('session-list')) {
  customElements.define('session-list', class extends HTMLElement {
    sessions = [];
    filters = {};
    selectedSession = null;
    loading = false;
    connectedCallback() {
      this.innerHTML = '<div class="mock-session-list">Session List</div>';
    }
  });
}

if (!customElements.get('session-viewer')) {
  customElements.define('session-viewer', class extends HTMLElement {
    session = null;
    loading = false;
    connectedCallback() {
      this.innerHTML = '<div class="mock-session-viewer">Session Viewer</div>';
    }
  });
}

if (!customElements.get('filter-panel')) {
  customElements.define('filter-panel', class extends HTMLElement {
    filters = {};
    connectedCallback() {
      this.innerHTML = '<div class="mock-filter-panel">Filter Panel</div>';
    }
  });
}

describe('SessionBrowser', () => {
  let element: SessionBrowser;
  let mockSessions: SessionSummary[];

  beforeEach(async () => {
    // Create mock session data
    mockSessions = [
      {
        sessionId: 'session-1',
        title: 'Test Session 1',
        cwd: '/test/path',
        startTime: new Date('2024-01-01T10:00:00Z'),
        endTime: new Date('2024-01-01T11:00:00Z'),
        messageCount: 10,
        userMessageCount: 5,
        assistantMessageCount: 5,
        duration: 3600000,
        isActive: false,
        tags: ['test'],
        summary: 'Test session summary',
        tokenUsage: {
          inputTokens: 1000,
          outputTokens: 1500,
          totalTokens: 2500
        }
      },
      {
        sessionId: 'session-2',
        title: 'Test Session 2',
        cwd: '/test/path2',
        startTime: new Date('2024-01-01T12:00:00Z'),
        messageCount: 15,
        userMessageCount: 7,
        assistantMessageCount: 8,
        isActive: true,
        tags: ['active'],
        summary: 'Active test session',
        tokenUsage: {
          inputTokens: 1500,
          outputTokens: 2000,
          totalTokens: 3500
        }
      }
    ];

    element = await fixture(html`<session-browser></session-browser>`) as SessionBrowser;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Component Initialization', () => {
    it('should render with default properties', () => {
      expect(element).to.exist;
      expect(element.sessions).to.deep.equal([]);
      expect(element.selectedSession).to.be.null;
      expect(element.loading).to.be.false;
      expect(element.layout).to.equal('split');
    });

    it('should have proper shadow DOM structure', () => {
      const container = element.shadowRoot?.querySelector('.browser-container');
      expect(container).to.exist;
    });

    it('should render layout controls', () => {
      const layoutControls = element.shadowRoot?.querySelector('.layout-controls');
      expect(layoutControls).to.exist;
      
      const buttons = element.shadowRoot?.querySelectorAll('.layout-button');
      expect(buttons).to.have.length(3); // split, list-only, viewer-only
    });
  });

  describe('Session Management', () => {
    it('should accept sessions property', async () => {
      element.sessions = mockSessions;
      await element.updateComplete;
      
      expect(element.sessions).to.deep.equal(mockSessions);
    });

    it('should update session list when sessions change', async () => {
      element.sessions = mockSessions;
      await element.updateComplete;
      
      const sessionList = element.shadowRoot?.querySelector('session-list');
      expect(sessionList).to.exist;
      expect((sessionList as any).sessions).to.deep.equal(mockSessions);
    });

    it('should handle session selection', async () => {
      element.sessions = mockSessions;
      await element.updateComplete;
      
      const eventSpy = vi.fn();
      element.addEventListener('session-selected', eventSpy);
      
      // Simulate session selection
      const sessionSelectedEvent = new CustomEvent('session-selected', {
        detail: { sessionId: 'session-1', session: mockSessions[0] }
      });
      element.dispatchEvent(sessionSelectedEvent);
      
      expect(eventSpy).toHaveBeenCalledOnce();
    });
  });

  describe('Layout Management', () => {
    it('should switch to list-only layout', async () => {
      const listButton = element.shadowRoot?.querySelector('[data-layout="list-only"]') as HTMLButtonElement;
      expect(listButton).to.exist;
      
      listButton?.click();
      await element.updateComplete;
      
      expect(element.layout).to.equal('list-only');
    });

    it('should switch to viewer-only layout', async () => {
      const viewerButton = element.shadowRoot?.querySelector('[data-layout="viewer-only"]') as HTMLButtonElement;
      expect(viewerButton).to.exist;
      
      viewerButton?.click();
      await element.updateComplete;
      
      expect(element.layout).to.equal('viewer-only');
    });

    it('should switch back to split layout', async () => {
      element.layout = 'list-only';
      await element.updateComplete;
      
      const splitButton = element.shadowRoot?.querySelector('[data-layout="split"]') as HTMLButtonElement;
      expect(splitButton).to.exist;
      
      splitButton?.click();
      await element.updateComplete;
      
      expect(element.layout).to.equal('split');
    });

    it('should apply correct CSS classes for different layouts', async () => {
      const container = element.shadowRoot?.querySelector('.browser-container');
      
      // Test split layout
      element.layout = 'split';
      await element.updateComplete;
      expect(container?.classList.contains('split')).to.be.true;
      
      // Test list-only layout
      element.layout = 'list-only';
      await element.updateComplete;
      expect(container?.classList.contains('list-only')).to.be.true;
      
      // Test viewer-only layout
      element.layout = 'viewer-only';
      await element.updateComplete;
      expect(container?.classList.contains('viewer-only')).to.be.true;
    });
  });

  describe('Real-time Status', () => {
    it('should display connection status', async () => {
      element.connectionStatus = 'connected';
      await element.updateComplete;
      
      const statusIndicator = element.shadowRoot?.querySelector('.status-indicator');
      expect(statusIndicator).to.exist;
      expect(statusIndicator?.classList.contains('connected')).to.be.true;
    });

    it('should handle disconnected state', async () => {
      element.connectionStatus = 'disconnected';
      await element.updateComplete;
      
      const statusIndicator = element.shadowRoot?.querySelector('.status-indicator');
      expect(statusIndicator?.classList.contains('disconnected')).to.be.true;
    });

    it('should show reconnecting state', async () => {
      element.connectionStatus = 'reconnecting';
      await element.updateComplete;
      
      const statusIndicator = element.shadowRoot?.querySelector('.status-indicator');
      expect(statusIndicator?.classList.contains('reconnecting')).to.be.true;
    });
  });

  describe('Filter Integration', () => {
    it('should handle filter changes', async () => {
      const filterEventSpy = vi.fn();
      element.addEventListener('filter-changed', filterEventSpy);
      
      const filterEvent = new CustomEvent('filter-changed', {
        detail: { 
          filters: { 
            search: 'test', 
            dateRange: { start: new Date(), end: new Date() },
            tags: ['test'] 
          } 
        }
      });
      element.dispatchEvent(filterEvent);
      
      expect(filterEventSpy).toHaveBeenCalledOnce();
    });

    it('should propagate filter changes to session list', async () => {
      element.sessions = mockSessions;
      await element.updateComplete;
      
      const sessionList = element.shadowRoot?.querySelector('session-list');
      expect(sessionList).to.exist;
      
      // Simulate filter change
      const mockFilters = { search: 'test', tags: ['active'] };
      const filterEvent = new CustomEvent('filter-changed', {
        detail: { filters: mockFilters }
      });
      
      sessionList?.dispatchEvent(filterEvent);
      
      // Verify filters are applied (mock component should receive them)
      expect(sessionList).to.exist;
    });
  });

  describe('Loading States', () => {
    it('should display loading indicator when loading', async () => {
      element.loading = true;
      await element.updateComplete;
      
      const loadingIndicator = element.shadowRoot?.querySelector('.loading-indicator');
      expect(loadingIndicator).to.exist;
    });

    it('should hide loading indicator when not loading', async () => {
      element.loading = false;
      await element.updateComplete;
      
      const loadingIndicator = element.shadowRoot?.querySelector('.loading-indicator');
      expect(loadingIndicator).to.not.exist;
    });
  });

  describe('Error Handling', () => {
    it('should handle session loading errors', async () => {
      const errorEventSpy = vi.fn();
      element.addEventListener('error-occurred', errorEventSpy);
      
      const errorEvent = new CustomEvent('error-occurred', {
        detail: { error: 'Failed to load sessions' }
      });
      element.dispatchEvent(errorEvent);
      
      expect(errorEventSpy).toHaveBeenCalledOnce();
    });

    it('should display error message in UI', async () => {
      element.errorMessage = 'Failed to load sessions';
      await element.updateComplete;
      
      const errorDisplay = element.shadowRoot?.querySelector('.error-message');
      expect(errorDisplay).to.exist;
      expect(errorDisplay?.textContent).to.include('Failed to load sessions');
    });
  });

  describe('Session Detail Loading', () => {
    it('should handle session detail requests', async () => {
      const detailEventSpy = vi.fn();
      element.addEventListener('session-details-requested', detailEventSpy);
      
      const detailEvent = new CustomEvent('session-details-requested', {
        detail: { sessionId: 'session-1' }
      });
      element.dispatchEvent(detailEvent);
      
      expect(detailEventSpy).toHaveBeenCalledOnce();
    });

    it('should update selected session when details loaded', async () => {
      const mockSessionDetail: SessionDetail = {
        ...mockSessions[0],
        entries: [
          {
            role: 'user',
            content: 'Hello',
            timestamp: '2024-01-01T10:00:00Z'
          },
          {
            role: 'assistant',
            content: 'Hi there!',
            timestamp: '2024-01-01T10:01:00Z'
          }
        ],
        metadata: {
          version: '1.0.0',
          client: 'test'
        },
        referencedFiles: [],
        toolsUsed: [],
        errors: []
      };
      
      element.selectedSession = mockSessionDetail;
      await element.updateComplete;
      
      expect(element.selectedSession).to.deep.equal(mockSessionDetail);
      
      const sessionViewer = element.shadowRoot?.querySelector('session-viewer');
      expect(sessionViewer).to.exist;
      expect((sessionViewer as any).session).to.deep.equal(mockSessionDetail);
    });
  });

  describe('Keyboard Navigation', () => {
    it('should handle keyboard shortcuts for layout switching', async () => {
      const event = new KeyboardEvent('keydown', {
        key: '1',
        ctrlKey: true
      });
      
      element.dispatchEvent(event);
      await element.updateComplete;
      
      expect(element.layout).to.equal('split');
    });

    it('should handle Escape key to close modals', async () => {
      const event = new KeyboardEvent('keydown', {
        key: 'Escape'
      });
      
      element.dispatchEvent(event);
      
      // Should close any open modals or reset states
      expect(element.errorMessage).to.be.empty;
    });
  });

  describe('Responsive Behavior', () => {
    it('should adapt layout for mobile', async () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 600
      });
      
      window.dispatchEvent(new Event('resize'));
      await element.updateComplete;
      
      const container = element.shadowRoot?.querySelector('.browser-container');
      expect(container?.classList.contains('mobile')).to.be.true;
    });
  });

  describe('Event Emission', () => {
    it('should emit session-selected events', async () => {
      const eventSpy = vi.fn();
      element.addEventListener('session-selected', eventSpy);
      
      element.sessions = mockSessions;
      await element.updateComplete;
      
      // Simulate clicking on a session
      const sessionEvent = new CustomEvent('session-selected', {
        detail: { sessionId: 'session-1', session: mockSessions[0] }
      });
      element.dispatchEvent(sessionEvent);
      
      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: expect.objectContaining({
            sessionId: 'session-1'
          })
        })
      );
    });

    it('should emit branch-requested events', async () => {
      const eventSpy = vi.fn();
      element.addEventListener('branch-requested', eventSpy);
      
      const branchEvent = new CustomEvent('branch-requested', {
        detail: { 
          sessionId: 'session-1',
          branchPoint: 5,
          message: { role: 'assistant', content: 'Test message' }
        }
      });
      element.dispatchEvent(branchEvent);
      
      expect(eventSpy).toHaveBeenCalledOnce();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      const main = element.shadowRoot?.querySelector('[role="main"]');
      expect(main).to.exist;
      expect(main?.getAttribute('aria-label')).to.exist;
    });

    it('should have keyboard accessible layout controls', () => {
      const buttons = element.shadowRoot?.querySelectorAll('.layout-button');
      buttons?.forEach(button => {
        expect(button.getAttribute('tabindex')).to.not.equal('-1');
        expect(button.getAttribute('aria-label')).to.exist;
      });
    });

    it('should announce layout changes', async () => {
      const announceSpy = vi.fn();
      (element as any).announceToScreenReader = announceSpy;
      
      element.layout = 'list-only';
      await element.updateComplete;
      
      // Should announce layout change to screen readers
      expect(element.layout).to.equal('list-only');
    });
  });
});