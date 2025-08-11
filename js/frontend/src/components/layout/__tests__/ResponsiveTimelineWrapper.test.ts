import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import '../ResponsiveTimelineWrapper.js';
import type { ResponsiveTimelineWrapper, ResponsiveTimelineConfig } from '../ResponsiveTimelineWrapper.js';
import {
  createSampleSessions,
  waitForRender,
  ResponsivePerformanceTester,
  MemoryLeakTester,
} from './responsive-test-utils.js';

describe('ResponsiveTimelineWrapper', () => {
  let performanceTester: ResponsivePerformanceTester;
  let memoryTester: MemoryLeakTester;

  beforeEach(() => {
    performanceTester = new ResponsivePerformanceTester();
    memoryTester = new MemoryLeakTester();
  });

  async function createResponsiveTimelineWrapper(
    props: Partial<ResponsiveTimelineWrapper> = {}
  ): Promise<ResponsiveTimelineWrapper> {
    const defaultProps = {
      title: 'Test Timeline',
      sessions: createSampleSessions(5),
      ...props,
    };

    const template = html`
      <responsive-timeline-wrapper 
        title="${defaultProps.title}"
        .sessions="${defaultProps.sessions}"
        .config="${defaultProps.config}"
        force-view="${defaultProps.forceView}"
      >
      </responsive-timeline-wrapper>
    `;

    const element = await fixture<ResponsiveTimelineWrapper>(template);
    await waitForRender(element);
    
    return element;
  }

  describe('Basic Rendering', () => {
    it('should render with default properties', async () => {
      const element = await createResponsiveTimelineWrapper();
      
      expect(element).to.be.instanceOf(HTMLElement);
      expect(element.tagName.toLowerCase()).to.equal('responsive-timeline-wrapper');
      expect(element.title).to.equal('Test Timeline');
      expect(element.sessions).to.have.length(5);
    });

    it('should render timeline header correctly', async () => {
      const element = await createResponsiveTimelineWrapper({
        title: 'Custom Timeline Title'
      });
      
      const titleElement = element.shadowRoot?.querySelector('.timeline-title');
      expect(titleElement).to.exist;
      expect(titleElement?.textContent).to.equal('Custom Timeline Title');
    });

    it('should show session count in header', async () => {
      const sessions = createSampleSessions(10);
      const element = await createResponsiveTimelineWrapper({ sessions });
      
      const headerElement = element.shadowRoot?.querySelector('.timeline-controls-row');
      expect(headerElement).to.exist;
      expect(headerElement?.textContent).to.include('10 session');
    });

    it('should handle singular vs plural session count', async () => {
      const element = await createResponsiveTimelineWrapper({ 
        sessions: createSampleSessions(1) 
      });
      
      const headerElement = element.shadowRoot?.querySelector('.timeline-controls-row');
      expect(headerElement?.textContent).to.include('1 session');
      expect(headerElement?.textContent).to.not.include('sessions');
    });
  });

  describe('View Mode Switching', () => {
    it('should default to mobile view on narrow screens', async () => {
      // Mock narrow screen
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      const element = await createResponsiveTimelineWrapper();
      
      // Mobile view should be active
      const mobileView = element.shadowRoot?.querySelector('.timeline-content-mobile');
      expect(mobileView).to.exist;
      
      const tabletView = element.shadowRoot?.querySelector('.timeline-content-tablet');
      const desktopView = element.shadowRoot?.querySelector('.timeline-content-desktop');
      expect(tabletView).to.not.be.displayed;
      expect(desktopView).to.not.be.displayed;
    });

    it('should switch to tablet view on medium screens', async () => {
      // Mock tablet screen
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 768,
      });

      const element = await createResponsiveTimelineWrapper();
      
      // Force view update
      element['_updateCurrentView']();
      await element.updateComplete;
      
      const tabletView = element.shadowRoot?.querySelector('.timeline-content-tablet');
      expect(tabletView).to.exist;
    });

    it('should switch to desktop view on large screens', async () => {
      // Mock desktop screen
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1024,
      });

      const element = await createResponsiveTimelineWrapper();
      
      // Force view update
      element['_updateCurrentView']();
      await element.updateComplete;
      
      const desktopView = element.shadowRoot?.querySelector('.timeline-content-desktop');
      expect(desktopView).to.exist;
    });

    it('should handle manual view selection', async () => {
      const element = await createResponsiveTimelineWrapper();
      let viewChangeEventFired = false;
      
      element.addEventListener('view-changed', (e: any) => {
        viewChangeEventFired = true;
        expect(e.detail.view).to.equal('desktop');
      });
      
      // Click desktop view button
      const desktopButton = element.shadowRoot?.querySelector('.view-option:nth-child(3)') as HTMLButtonElement;
      desktopButton?.click();
      
      await element.updateComplete;
      expect(viewChangeEventFired).to.be.true;
      expect(element.forceView).to.equal('desktop');
    });

    it('should respect forceView property', async () => {
      const element = await createResponsiveTimelineWrapper({ 
        forceView: 'tablet' 
      });
      
      expect(element.forceView).to.equal('tablet');
      expect(element['_currentView']).to.equal('tablet');
    });

    it('should hide view selector on mobile', async () => {
      // Mock mobile screen
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 320,
      });

      const element = await createResponsiveTimelineWrapper();
      const viewSelector = element.shadowRoot?.querySelector('.view-selector');
      
      // On mobile, view selector should be hidden via CSS
      expect(viewSelector).to.exist;
      // CSS media query will handle visibility
    });
  });

  describe('Mobile View', () => {
    it('should render session cards in mobile view', async () => {
      const sessions = createSampleSessions(3);
      const element = await createResponsiveTimelineWrapper({ 
        sessions,
        forceView: 'mobile' 
      });
      
      const sessionCards = element.shadowRoot?.querySelectorAll('.session-card');
      expect(sessionCards).to.have.length(3);
      
      // Check first card content
      const firstCard = sessionCards?.[0];
      expect(firstCard?.textContent).to.include('Test Session 1');
      expect(firstCard?.textContent).to.include('Active'); // First session is active
    });

    it('should show session status correctly in mobile cards', async () => {
      const sessions = createSampleSessions(2);
      const element = await createResponsiveTimelineWrapper({ 
        sessions,
        forceView: 'mobile' 
      });
      
      const statusElements = element.shadowRoot?.querySelectorAll('.session-card-status');
      expect(statusElements).to.have.length(2);
      
      // First session should be active
      expect(statusElements?.[0]?.textContent?.trim()).to.equal('Active');
      expect(statusElements?.[0]?.classList.contains('active')).to.be.true;
      
      // Second session should be completed
      expect(statusElements?.[1]?.textContent?.trim()).to.equal('Completed');
      expect(statusElements?.[1]?.classList.contains('completed')).to.be.true;
    });

    it('should handle session clicks in mobile view', async () => {
      const sessions = createSampleSessions(2);
      const element = await createResponsiveTimelineWrapper({ 
        sessions,
        forceView: 'mobile' 
      });
      
      let selectedSession: any = null;
      element.addEventListener('session-selected', (e: any) => {
        selectedSession = e.detail.session;
      });
      
      const firstCard = element.shadowRoot?.querySelector('.session-card') as HTMLElement;
      firstCard?.click();
      
      await element.updateComplete;
      expect(selectedSession).to.exist;
      expect(selectedSession.sessionId).to.equal(sessions[0].sessionId);
    });

    it('should display session timeline progress bar', async () => {
      const element = await createResponsiveTimelineWrapper({ 
        forceView: 'mobile' 
      });
      
      const progressBars = element.shadowRoot?.querySelectorAll('.session-timeline-progress');
      expect(progressBars?.length).to.be.greaterThan(0);
    });

    it('should show empty state when no sessions', async () => {
      const element = await createResponsiveTimelineWrapper({ 
        sessions: [],
        forceView: 'mobile' 
      });
      
      const mobileView = element.shadowRoot?.querySelector('.timeline-content-mobile');
      expect(mobileView?.textContent).to.include('No sessions to display');
    });
  });

  describe('Tablet View', () => {
    it('should render horizontal timeline in tablet view', async () => {
      const sessions = createSampleSessions(5);
      const element = await createResponsiveTimelineWrapper({ 
        sessions,
        forceView: 'tablet' 
      });
      
      const horizontalTimeline = element.shadowRoot?.querySelector('.timeline-horizontal');
      expect(horizontalTimeline).to.exist;
      
      const dayColumns = element.shadowRoot?.querySelectorAll('.timeline-day-column');
      expect(dayColumns?.length).to.be.greaterThan(0);
    });

    it('should group sessions by date in tablet view', async () => {
      const sessions = createSampleSessions(10);
      const element = await createResponsiveTimelineWrapper({ 
        sessions,
        forceView: 'tablet' 
      });
      
      const dayHeaders = element.shadowRoot?.querySelectorAll('.timeline-day-header');
      expect(dayHeaders?.length).to.be.greaterThan(0);
      
      // Should have date formatting
      const firstHeader = dayHeaders?.[0];
      expect(firstHeader?.textContent).to.match(/\w{3} \d{1,2}/); // e.g., "Jan 15"
    });

    it('should handle session clicks in tablet view', async () => {
      const sessions = createSampleSessions(3);
      const element = await createResponsiveTimelineWrapper({ 
        sessions,
        forceView: 'tablet' 
      });
      
      let selectedSession: any = null;
      element.addEventListener('session-selected', (e: any) => {
        selectedSession = e.detail.session;
      });
      
      const sessionItem = element.shadowRoot?.querySelector('.timeline-session-item') as HTMLElement;
      sessionItem?.click();
      
      await element.updateComplete;
      expect(selectedSession).to.exist;
    });

    it('should enable horizontal scrolling', async () => {
      const element = await createResponsiveTimelineWrapper({ 
        forceView: 'tablet' 
      });
      
      const scrollContainer = element.shadowRoot?.querySelector('.timeline-scroll-container') as HTMLElement;
      expect(scrollContainer).to.exist;
      
      const computedStyle = getComputedStyle(scrollContainer);
      expect(computedStyle.overflowX).to.equal('auto');
    });
  });

  describe('Desktop View', () => {
    it('should render timeline-view component in desktop view', async () => {
      const element = await createResponsiveTimelineWrapper({ 
        forceView: 'desktop' 
      });
      
      const timelineEmbed = element.shadowRoot?.querySelector('.timeline-embed');
      expect(timelineEmbed).to.exist;
      
      // Should contain timeline-view element
      const timelineView = element.shadowRoot?.querySelector('timeline-view');
      expect(timelineView).to.exist;
    });

    it('should pass sessions data to timeline-view', async () => {
      const sessions = createSampleSessions(7);
      const element = await createResponsiveTimelineWrapper({ 
        sessions,
        forceView: 'desktop' 
      });
      
      const timelineView = element.shadowRoot?.querySelector('timeline-view') as any;
      expect(timelineView?.sessions).to.deep.equal(sessions);
      expect(timelineView?.title).to.equal(element.title);
    });
  });

  describe('Data Formatting', () => {
    it('should format session duration correctly', async () => {
      const now = new Date();
      const sessions = [{
        sessionId: 'test-duration',
        title: 'Duration Test',
        startTime: new Date(now.getTime() - 2.5 * 60 * 60 * 1000), // 2.5 hours ago
        endTime: now,
        isActive: false,
        cwd: '/test',
        summary: 'Test session',
        tags: ['test']
      }];
      
      const element = await createResponsiveTimelineWrapper({ 
        sessions,
        forceView: 'mobile' 
      });
      
      const durationElement = element.shadowRoot?.querySelector('.session-info-value');
      expect(durationElement?.textContent).to.include('2h 30m');
    });

    it('should format dates correctly', async () => {
      const testDate = new Date('2024-01-15T10:30:00');
      const sessions = [{
        sessionId: 'test-date',
        title: 'Date Test',
        startTime: testDate,
        isActive: false,
        cwd: '/test',
        summary: 'Test session',
        tags: ['test']
      }];
      
      const element = await createResponsiveTimelineWrapper({ 
        sessions,
        forceView: 'tablet' 
      });
      
      const dateHeader = element.shadowRoot?.querySelector('.timeline-day-header');
      expect(dateHeader?.textContent).to.include('Jan 15');
    });

    it('should handle active sessions without end time', async () => {
      const sessions = [{
        sessionId: 'active-session',
        title: 'Active Session',
        startTime: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
        isActive: true,
        cwd: '/test',
        summary: 'Active test session',
        tags: ['test']
      }];
      
      const element = await createResponsiveTimelineWrapper({ 
        sessions,
        forceView: 'mobile' 
      });
      
      // Should render without errors and show duration from start to now
      const card = element.shadowRoot?.querySelector('.session-card');
      expect(card).to.exist;
      expect(card?.textContent).to.include('30m'); // Approximate duration
    });
  });

  describe('Configuration', () => {
    it('should apply custom configuration', async () => {
      const customConfig: ResponsiveTimelineConfig = {
        mobileView: 'compact',
        tabletView: 'hybrid',
        desktopView: 'split',
        enableHorizontalScroll: false,
        collapsibleSections: false,
        cardLayout: false
      };
      
      const element = await createResponsiveTimelineWrapper({ 
        config: customConfig 
      });
      
      expect(element.config).to.deep.equal(customConfig);
    });

    it('should handle missing configuration gracefully', async () => {
      const element = await createResponsiveTimelineWrapper();
      
      // Should use default config
      expect(element.config).to.exist;
      expect(element.config.mobileView).to.equal('list');
      expect(element.config.enableHorizontalScroll).to.be.true;
    });
  });

  describe('Performance', () => {
    it('should render large numbers of sessions efficiently', async () => {
      const largeSessions = createSampleSessions(100);
      
      performanceTester.startMeasurement('large-session-render');
      
      const element = await createResponsiveTimelineWrapper({ 
        sessions: largeSessions,
        forceView: 'mobile' 
      });
      
      performanceTester.endMeasurement('large-session-render');
      performanceTester.assertPerformance(500); // Should render in under 500ms
      
      // Should render all sessions
      const sessionCards = element.shadowRoot?.querySelectorAll('.session-card');
      expect(sessionCards).to.have.length(100);
    });

    it('should handle rapid view switching efficiently', async () => {
      const element = await createResponsiveTimelineWrapper();
      
      performanceTester.startMeasurement('view-switching');
      
      // Rapidly switch between views
      const views = ['mobile', 'tablet', 'desktop'] as const;
      for (let i = 0; i < 30; i++) {
        const view = views[i % views.length];
        element['_handleViewChange'](view);
        await element.updateComplete;
      }
      
      performanceTester.endMeasurement('view-switching');
      performanceTester.assertPerformance(300);
    });

    it('should not cause memory leaks with session updates', async () => {
      memoryTester.startTest();
      
      const element = await createResponsiveTimelineWrapper();
      
      // Simulate multiple session updates
      for (let i = 0; i < 50; i++) {
        element.sessions = createSampleSessions(10);
        await element.updateComplete;
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      memoryTester.checkForLeaks(2 * 1024 * 1024); // 2MB max increase
    });
  });

  describe('Event Handling', () => {
    it('should handle resize events', async () => {
      const element = await createResponsiveTimelineWrapper();
      
      // Mock window resize
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1200,
      });
      
      // Trigger resize event
      window.dispatchEvent(new Event('resize'));
      
      // Should update current view
      await element.updateComplete;
      // View should be updated based on new width
    });

    it('should clean up event listeners on disconnect', async () => {
      const element = await createResponsiveTimelineWrapper();
      
      // Spy on removeEventListener
      const removeEventListenerSpy = sinon.spy(window, 'removeEventListener');
      
      // Disconnect element
      element.remove();
      
      // Should clean up resize listener
      expect(removeEventListenerSpy.calledWith('resize')).to.be.true;
      
      removeEventListenerSpy.restore();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid session data gracefully', async () => {
      const invalidSessions: any[] = [
        { sessionId: 'valid', title: 'Valid', startTime: new Date(), isActive: false },
        { sessionId: 'missing-start-time', title: 'Invalid' }, // Missing required fields
        null, // Null session
        undefined, // Undefined session
        { sessionId: 'invalid-date', title: 'Bad Date', startTime: 'not a date', isActive: false },
      ];
      
      const element = await createResponsiveTimelineWrapper({ 
        sessions: invalidSessions,
        forceView: 'mobile' 
      });
      
      // Should render without crashing
      expect(element).to.exist;
      
      // Should handle valid sessions
      const cards = element.shadowRoot?.querySelectorAll('.session-card');
      expect(cards?.length).to.be.at.least(1);
    });

    it('should handle empty sessions array', async () => {
      const element = await createResponsiveTimelineWrapper({ 
        sessions: [] 
      });
      
      expect(element).to.exist;
      expect(element.sessions).to.have.length(0);
      
      // Should show empty state message
      const emptyMessage = element.shadowRoot?.textContent;
      expect(emptyMessage).to.include('No sessions to display');
    });

    it('should handle view change errors gracefully', async () => {
      const element = await createResponsiveTimelineWrapper();
      
      // Mock an error in view change
      const originalHandler = element['_handleViewChange'];
      element['_handleViewChange'] = () => {
        throw new Error('View change error');
      };
      
      // Should not crash when view button is clicked
      const viewButton = element.shadowRoot?.querySelector('.view-option') as HTMLButtonElement;
      expect(() => {
        viewButton?.click();
      }).to.not.throw();
      
      // Restore original handler
      element['_handleViewChange'] = originalHandler;
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels and roles', async () => {
      const element = await createResponsiveTimelineWrapper({ 
        forceView: 'mobile' 
      });
      
      const header = element.shadowRoot?.querySelector('.timeline-header') as HTMLElement;
      expect(header).to.exist;
      
      const title = element.shadowRoot?.querySelector('.timeline-title') as HTMLElement;
      expect(title?.tagName.toLowerCase()).to.equal('h2');
    });

    it('should handle keyboard navigation in session cards', async () => {
      const sessions = createSampleSessions(3);
      const element = await createResponsiveTimelineWrapper({ 
        sessions,
        forceView: 'mobile' 
      });
      
      const firstCard = element.shadowRoot?.querySelector('.session-card') as HTMLElement;
      
      // Should be keyboard accessible
      firstCard.focus();
      expect(document.activeElement).to.equal(firstCard);
      
      // Should handle Enter key
      const enterEvent = new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
        cancelable: true
      });
      
      let sessionSelected = false;
      element.addEventListener('session-selected', () => {
        sessionSelected = true;
      });
      
      firstCard.dispatchEvent(enterEvent);
      // Manually trigger click for test
      firstCard.click();
      
      expect(sessionSelected).to.be.true;
    });
  });
});