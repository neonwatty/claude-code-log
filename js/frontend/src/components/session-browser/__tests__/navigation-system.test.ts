import { expect } from '@esm-bundle/chai';
import { fixture, html, nextFrame } from '@open-wc/testing';
import { stub, SinonStub } from 'sinon';
import '../session-management-actions';
import '../session-router';
import '../session-state-manager';
import '../loading-states';
import '../accessibility-enhancements';
import { SessionManagementActions } from '../session-management-actions';
import { SessionRouter } from '../session-router';
import { SessionStateManager, sessionStateManager } from '../session-state-manager';
import { LoadingState, ErrorBoundary } from '../loading-states';
import { KeyboardNavigationHelp } from '../accessibility-enhancements';
import { SessionSummary } from '../../types/session-types';

describe('Navigation System Tests', () => {
  // Mock data
  const mockSessions: SessionSummary[] = [
    {
      sessionId: 'session-1',
      title: 'Test Session 1',
      cwd: '/test/path/1',
      startTime: new Date('2024-01-01T10:00:00Z'),
      messageCount: 5,
      userMessageCount: 2,
      assistantMessageCount: 3,
      isActive: true,
      tags: ['test'],
      summary: 'Test session 1',
      tokenUsage: { inputTokens: 100, outputTokens: 200, totalTokens: 300 },
    },
    {
      sessionId: 'session-2', 
      title: 'Test Session 2',
      cwd: '/test/path/2',
      startTime: new Date('2024-01-01T09:00:00Z'),
      endTime: new Date('2024-01-01T09:30:00Z'),
      messageCount: 10,
      userMessageCount: 5,
      assistantMessageCount: 5,
      duration: 1800000,
      isActive: false,
      tags: ['test'],
      summary: 'Test session 2',
      tokenUsage: { inputTokens: 200, outputTokens: 400, totalTokens: 600 },
    },
  ];

  describe('SessionManagementActions', () => {
    let element: SessionManagementActions;

    beforeEach(async () => {
      element = await fixture(html`
        <session-management-actions
          .sessions=${mockSessions}
          .selectedSessions=${[mockSessions[0]]}
        ></session-management-actions>
      `);
      await element.updateComplete;
    });

    it('should render action buttons', async () => {
      expect(element).to.exist;
      expect(element.sessions).to.deep.equal(mockSessions);
      expect(element.selectedSessions).to.deep.equal([mockSessions[0]]);
    });

    it('should handle bulk selection mode toggle', async () => {
      let eventFired = false;
      element.addEventListener('bulk-mode-toggled', () => {
        eventFired = true;
      });

      element.bulkSelectionMode = false;
      (element as any).toggleBulkMode();
      await element.updateComplete;

      expect(element.bulkSelectionMode).to.equal(true);
      expect(eventFired).to.equal(true);
    });

    it('should show bulk actions when sessions are selected', async () => {
      element.bulkSelectionMode = true;
      element.selectedSessions = mockSessions;
      await element.updateComplete;

      const bulkActions = element.shadowRoot?.querySelector('.bulk-actions:not(.hidden)');
      expect(bulkActions).to.exist;
    });

    it('should hide bulk actions when no sessions selected', async () => {
      element.bulkSelectionMode = true;
      element.selectedSessions = [];
      await element.updateComplete;

      const bulkActions = element.shadowRoot?.querySelector('.bulk-actions.hidden');
      expect(bulkActions).to.exist;
    });

    it('should emit export event for selected sessions', async () => {
      let exportEvent: any = null;
      element.addEventListener('sessions-export-requested', (e: any) => {
        exportEvent = e.detail;
      });

      (element as any).exportSessions();

      expect(exportEvent).to.exist;
      expect(exportEvent.sessionIds).to.deep.equal(['session-1']);
    });

    it('should show confirmation dialog for delete operations', async () => {
      element.selectedSessions = mockSessions;
      await element.updateComplete;

      (element as any).deleteSessions();
      await element.updateComplete;

      expect((element as any).showConfirmDialog).to.equal(true);
      expect((element as any).confirmDialogConfig?.isDangerous).to.equal(true);
    });

    it('should update progress during operations', () => {
      element.updateProgress(50);
      expect((element as any).operationProgress).to.equal(50);

      element.setOperationInProgress(true);
      expect((element as any).operationInProgress).to.equal(true);

      element.setOperationInProgress(false);
      expect((element as any).operationInProgress).to.equal(false);
      expect((element as any).operationProgress).to.equal(0);
    });
  });

  describe('SessionRouter', () => {
    let element: SessionRouter;

    beforeEach(async () => {
      element = await fixture(html`
        <session-router
          .sessions=${mockSessions}
          basePath="/test-sessions"
        ></session-router>
      `);
      await element.updateComplete;
      await nextFrame();
    });

    it('should render router container', () => {
      expect(element).to.exist;
      const container = element.shadowRoot?.querySelector('.router-container');
      expect(container).to.exist;
    });

    it('should have correct base path', () => {
      expect(element.basePath).to.equal('/test-sessions');
    });

    it('should build correct session URLs', () => {
      const url = element.buildSessionUrl('session-1');
      expect(url).to.equal('/test-sessions/session/session-1');

      const urlWithMessage = element.buildSessionUrl('session-1', { messageIndex: 5 });
      expect(urlWithMessage).to.equal('/test-sessions/session/session-1/message/5');

      const urlWithBranch = element.buildSessionUrl('session-1', { branchId: 'branch-1' });
      expect(urlWithBranch).to.equal('/test-sessions/session/session-1/branch/branch-1');

      const urlWithAction = element.buildSessionUrl('session-1', { action: 'edit' });
      expect(urlWithAction).to.equal('/test-sessions/session/session-1/edit');
    });

    it('should parse route parameters correctly', () => {
      const params1 = (element as any).parsePathParams('/test-sessions/session/session-1');
      expect(params1.sessionId).to.equal('session-1');

      const params2 = (element as any).parsePathParams('/test-sessions/session/session-1/message/3');
      expect(params2.sessionId).to.equal('session-1');
      expect(params2.messageIndex).to.equal('3');

      const params3 = (element as any).parsePathParams('/test-sessions/session/session-1/edit');
      expect(params3.sessionId).to.equal('session-1');
      expect(params3.action).to.equal('edit');
    });

    it('should emit navigation events', async () => {
      let routeEvent: any = null;
      element.addEventListener('route-changed', (e: any) => {
        routeEvent = e.detail;
      });

      await (element as any).handleRoute({ sessionId: 'session-1', messageIndex: '2' });

      expect(routeEvent).to.exist;
      expect(routeEvent.params.sessionId).to.equal('session-1');
      expect(routeEvent.params.messageIndex).to.equal('2');
    });
  });

  describe('SessionStateManager', () => {
    let stateManager: SessionStateManager;

    beforeEach(() => {
      stateManager = SessionStateManager.getInstance();
      stateManager.resetState();
    });

    it('should maintain singleton instance', () => {
      const instance1 = SessionStateManager.getInstance();
      const instance2 = SessionStateManager.getInstance();
      expect(instance1).to.equal(instance2);
    });

    it('should have initial state', () => {
      const state = stateManager.getState();
      expect(state.currentSessionId).to.be.null;
      expect(state.selectedSessionIds.size).to.equal(0);
      expect(state.viewMode).to.equal('list');
      expect(state.isLoading).to.equal(false);
    });

    it('should update state correctly', () => {
      stateManager.updateState({ 
        currentSessionId: 'session-1',
        isLoading: true 
      });

      const state = stateManager.getState();
      expect(state.currentSessionId).to.equal('session-1');
      expect(state.isLoading).to.equal(true);
    });

    it('should manage session selection', () => {
      stateManager.selectSession('session-1');
      expect(stateManager.getStateValue('currentSessionId')).to.equal('session-1');

      stateManager.addToSelection('session-2');
      expect(stateManager.isSelected('session-2')).to.equal(true);

      stateManager.toggleSelection('session-2');
      expect(stateManager.isSelected('session-2')).to.equal(false);

      stateManager.selectMultiple(['session-1', 'session-2']);
      const state = stateManager.getState();
      expect(state.selectedSessionIds.has('session-1')).to.equal(true);
      expect(state.selectedSessionIds.has('session-2')).to.equal(true);

      stateManager.clearSelection();
      expect(stateManager.getState().selectedSessionIds.size).to.equal(0);
    });

    it('should handle view state changes', () => {
      stateManager.toggleViewMode();
      expect(stateManager.getStateValue('viewMode')).to.equal('grid');

      stateManager.toggleSortOrder();
      expect(stateManager.getStateValue('sortOrder')).to.equal('asc');

      stateManager.setFilter('test filter');
      // Filter is debounced, so we need to wait
      setTimeout(() => {
        expect(stateManager.getStateValue('filterText')).to.equal('test filter');
      }, 400);
    });

    it('should handle error state', () => {
      const error = new Error('Test error');
      stateManager.setError(error);
      expect(stateManager.getStateValue('error')).to.equal('Test error');

      stateManager.clearError();
      expect(stateManager.getStateValue('error')).to.be.null;
    });

    it('should notify listeners of changes', async () => {
      let notifiedState: any = null;
      let notifiedKey: any = null;

      const unsubscribe = stateManager.subscribe((state, key) => {
        notifiedState = state;
        notifiedKey = key;
      });

      stateManager.setState('currentSessionId', 'session-1');

      expect(notifiedState.currentSessionId).to.equal('session-1');
      expect(notifiedKey).to.equal('currentSessionId');

      unsubscribe();
    });

    it('should update from route parameters', () => {
      stateManager.updateFromRoute({
        sessionId: 'session-2',
        messageIndex: '5'
      });

      const state = stateManager.getState();
      expect(state.currentSessionId).to.equal('session-2');
      expect(state.currentMessageIndex).to.equal(5);
      expect(state.routeParams.sessionId).to.equal('session-2');
      expect(state.routeParams.messageIndex).to.equal('5');
    });
  });

  describe('LoadingState', () => {
    let element: LoadingState;

    beforeEach(async () => {
      element = await fixture(html`
        <loading-state
          message="Loading sessions..."
          details="Fetching session data from server"
          progress="75"
        ></loading-state>
      `);
      await element.updateComplete;
    });

    it('should render loading message', () => {
      expect(element).to.exist;
      const message = element.shadowRoot?.querySelector('.loading-message');
      expect(message?.textContent).to.contain('Loading sessions...');
    });

    it('should show progress bar with correct value', () => {
      const progressBar = element.shadowRoot?.querySelector('.progress-bar') as HTMLElement;
      expect(progressBar?.style.width).to.equal('75%');
    });

    it('should show indeterminate progress when no value provided', async () => {
      element.progress = undefined;
      await element.updateComplete;

      const progressBar = element.shadowRoot?.querySelector('.progress-bar');
      expect(progressBar?.classList.contains('progress-indeterminate')).to.equal(true);
    });

    it('should show details when provided', () => {
      const details = element.shadowRoot?.querySelector('.loading-details');
      expect(details?.textContent).to.contain('Fetching session data from server');
    });
  });

  describe('ErrorBoundary', () => {
    let element: ErrorBoundary;

    beforeEach(async () => {
      element = await fixture(html`
        <error-boundary
          title="Test Error"
          message="Something went wrong during testing"
          error="Error: Network timeout"
          showRetry
          showReload
        ></error-boundary>
      `);
      await element.updateComplete;
    });

    it('should render error information', () => {
      expect(element).to.exist;
      
      const title = element.shadowRoot?.querySelector('.error-title');
      expect(title?.textContent).to.equal('Test Error');

      const message = element.shadowRoot?.querySelector('.error-message');
      expect(message?.textContent).to.equal('Something went wrong during testing');
    });

    it('should show/hide error details', async () => {
      element.showDetails = false;
      await element.updateComplete;

      let details = element.shadowRoot?.querySelector('.error-details');
      expect(details).to.not.exist;

      element.showDetails = true;
      await element.updateComplete;

      details = element.shadowRoot?.querySelector('.error-details');
      expect(details).to.exist;
      expect(details?.textContent).to.contain('Error: Network timeout');
    });

    it('should emit retry event', async () => {
      let retryEventFired = false;
      element.addEventListener('error-retry', () => {
        retryEventFired = true;
      });

      (element as any).handleRetry();
      expect(retryEventFired).to.equal(true);
    });

    it('should show correct action buttons', () => {
      const retryButton = element.shadowRoot?.querySelector('.error-button:not(.secondary)');
      expect(retryButton?.textContent).to.contain('Try Again');

      const reloadButton = element.shadowRoot?.querySelector('.error-button.secondary');
      expect(reloadButton?.textContent).to.contain('Reload Page');
    });
  });

  describe('KeyboardNavigationHelp', () => {
    let element: KeyboardNavigationHelp;

    beforeEach(async () => {
      element = await fixture(html`
        <keyboard-navigation-help></keyboard-navigation-help>
      `);
      await element.updateComplete;
    });

    it('should be hidden by default', () => {
      expect(element.visible).to.equal(false);
      const container = element.shadowRoot?.querySelector('.help-container');
      expect(container).to.not.exist;
    });

    it('should show when activated', async () => {
      element.show();
      await element.updateComplete;

      expect(element.visible).to.equal(true);
      const container = element.shadowRoot?.querySelector('.help-container');
      expect(container).to.exist;
    });

    it('should display keyboard shortcuts', async () => {
      element.show();
      await element.updateComplete;

      const sections = element.shadowRoot?.querySelectorAll('.shortcut-section');
      expect(sections?.length).to.be.greaterThan(0);

      const shortcuts = element.shadowRoot?.querySelectorAll('.shortcut-item');
      expect(shortcuts?.length).to.be.greaterThan(0);
    });

    it('should close on escape key', async () => {
      element.show();
      await element.updateComplete;

      const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' });
      document.dispatchEvent(escapeEvent);

      expect(element.visible).to.equal(false);
    });

    it('should show on ? key press', async () => {
      const questionEvent = new KeyboardEvent('keydown', { key: '?' });
      document.dispatchEvent(questionEvent);

      expect(element.visible).to.equal(true);
    });
  });

  describe('Integration Tests', () => {
    let managementActions: SessionManagementActions;
    let router: SessionRouter;
    let stateManager: SessionStateManager;

    beforeEach(async () => {
      stateManager = SessionStateManager.getInstance();
      stateManager.resetState();

      managementActions = await fixture(html`
        <session-management-actions
          .sessions=${mockSessions}
        ></session-management-actions>
      `);

      router = await fixture(html`
        <session-router
          .sessions=${mockSessions}
        ></session-router>
      `);

      await Promise.all([managementActions.updateComplete, router.updateComplete]);
    });

    it('should coordinate state between components', () => {
      // Select a session via state manager
      stateManager.selectSession('session-1');
      
      // Update management actions with new selection
      managementActions.selectedSessions = [mockSessions[0]];
      
      expect(stateManager.getStateValue('currentSessionId')).to.equal('session-1');
      expect(managementActions.selectedSessions[0].sessionId).to.equal('session-1');
    });

    it('should handle navigation flow', () => {
      // Navigate to session via router
      router.navigateToSession('session-2', { messageIndex: 3 });
      
      // Update state to reflect navigation
      stateManager.updateFromRoute({
        sessionId: 'session-2',
        messageIndex: '3'
      });

      const state = stateManager.getState();
      expect(state.currentSessionId).to.equal('session-2');
      expect(state.currentMessageIndex).to.equal(3);
    });

    it('should handle bulk operations workflow', async () => {
      // Enable bulk mode
      stateManager.setState('bulkSelectionMode', true);
      managementActions.bulkSelectionMode = true;
      
      // Select multiple sessions
      stateManager.selectMultiple(['session-1', 'session-2']);
      managementActions.selectedSessions = mockSessions;
      
      await managementActions.updateComplete;

      // Check that bulk actions are visible
      const bulkActions = managementActions.shadowRoot?.querySelector('.bulk-actions:not(.hidden)');
      expect(bulkActions).to.exist;
    });
  });

  afterEach(() => {
    // Clean up any global state
    sessionStateManager.resetState();
  });
});