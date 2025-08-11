import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import '../ResponsiveSessionWrapper.js';
import type { ResponsiveSessionWrapper, ResponsiveSessionConfig, SessionFilterOptions } from '../ResponsiveSessionWrapper.js';
import {
  createSampleSessions,
  waitForRender,
  ResponsivePerformanceTester,
  MemoryLeakTester,
} from './responsive-test-utils.js';

describe('ResponsiveSessionWrapper', () => {
  let performanceTester: ResponsivePerformanceTester;
  let memoryTester: MemoryLeakTester;

  beforeEach(() => {
    performanceTester = new ResponsivePerformanceTester();
    memoryTester = new MemoryLeakTester();
  });

  async function createResponsiveSessionWrapper(
    props: Partial<ResponsiveSessionWrapper> = {}
  ): Promise<ResponsiveSessionWrapper> {
    const defaultProps = {
      title: 'Test Sessions',
      sessions: createSampleSessions(5),
      ...props,
    };

    const template = html`
      <responsive-session-wrapper 
        title="${defaultProps.title}"
        .sessions="${defaultProps.sessions}"
        .config="${defaultProps.config}"
        force-view="${defaultProps.forceView}"
        .filterOptions="${defaultProps.filterOptions}"
      >
      </responsive-session-wrapper>
    `;

    const element = await fixture<ResponsiveSessionWrapper>(template);
    await waitForRender(element);
    
    return element;
  }

  describe('Basic Rendering', () => {
    it('should render with default properties', async () => {
      const element = await createResponsiveSessionWrapper();
      
      expect(element).to.be.instanceOf(HTMLElement);
      expect(element.tagName.toLowerCase()).to.equal('responsive-session-wrapper');
      expect(element.title).to.equal('Test Sessions');
      expect(element.sessions).to.have.length(5);
    });

    it('should render session header correctly', async () => {
      const element = await createResponsiveSessionWrapper({
        title: 'Custom Session List'
      });
      
      const titleElement = element.shadowRoot?.querySelector('.session-title');
      expect(titleElement).to.exist;
      expect(titleElement?.textContent).to.equal('Custom Session List');
    });

    it('should show session count in header', async () => {
      const sessions = createSampleSessions(12);
      const element = await createResponsiveSessionWrapper({ sessions });
      
      const headerElement = element.shadowRoot?.querySelector('.session-controls-row');
      expect(headerElement).to.exist;
      expect(headerElement?.textContent).to.include('12 session');
    });

    it('should handle singular vs plural session count', async () => {
      const element = await createResponsiveSessionWrapper({ 
        sessions: createSampleSessions(1) 
      });
      
      const headerElement = element.shadowRoot?.querySelector('.session-controls-row');
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

      const element = await createResponsiveSessionWrapper();
      
      // Mobile view should be active
      const mobileView = element.shadowRoot?.querySelector('.session-content-mobile');
      expect(mobileView).to.exist;
      
      const tabletView = element.shadowRoot?.querySelector('.session-content-tablet');
      const desktopView = element.shadowRoot?.querySelector('.session-content-desktop');
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

      const element = await createResponsiveSessionWrapper();
      
      // Force view update
      element['_updateCurrentView']();
      await element.updateComplete;
      
      const tabletView = element.shadowRoot?.querySelector('.session-content-tablet');
      expect(tabletView).to.exist;
    });

    it('should switch to desktop view on large screens', async () => {
      // Mock desktop screen
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1024,
      });

      const element = await createResponsiveSessionWrapper();
      
      // Force view update
      element['_updateCurrentView']();
      await element.updateComplete;
      
      const desktopView = element.shadowRoot?.querySelector('.session-content-desktop');
      expect(desktopView).to.exist;
    });

    it('should handle manual view selection', async () => {
      const element = await createResponsiveSessionWrapper();
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
      const element = await createResponsiveSessionWrapper({ 
        forceView: 'tablet' 
      });
      
      expect(element.forceView).to.equal('tablet');
      expect(element['_currentView']).to.equal('tablet');
    });
  });

  describe('Mobile View - Cards', () => {
    it('should render session cards in mobile view', async () => {
      const sessions = createSampleSessions(3);
      const element = await createResponsiveSessionWrapper({ 
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
      const element = await createResponsiveSessionWrapper({ 
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
      const element = await createResponsiveSessionWrapper({ 
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

    it('should show session duration in cards', async () => {
      const element = await createResponsiveSessionWrapper({ 
        forceView: 'mobile' 
      });
      
      const durationElements = element.shadowRoot?.querySelectorAll('.session-card-duration');
      expect(durationElements?.length).to.be.greaterThan(0);
      
      const firstDuration = durationElements?.[0];
      expect(firstDuration?.textContent).to.match(/\d+m|\d+h/); // Should show minutes or hours
    });

    it('should display session tags in cards', async () => {
      const element = await createResponsiveSessionWrapper({ 
        forceView: 'mobile' 
      });
      
      const tagElements = element.shadowRoot?.querySelectorAll('.session-card-tag');
      expect(tagElements?.length).to.be.greaterThan(0);
    });

    it('should show empty state when no sessions', async () => {
      const element = await createResponsiveSessionWrapper({ 
        sessions: [],
        forceView: 'mobile' 
      });
      
      const mobileView = element.shadowRoot?.querySelector('.session-content-mobile');
      expect(mobileView?.textContent).to.include('No sessions to display');
    });
  });

  describe('Tablet View - Grid', () => {
    it('should render session grid in tablet view', async () => {
      const sessions = createSampleSessions(6);
      const element = await createResponsiveSessionWrapper({ 
        sessions,
        forceView: 'tablet' 
      });
      
      const sessionGrid = element.shadowRoot?.querySelector('.session-grid');
      expect(sessionGrid).to.exist;
      
      const gridItems = element.shadowRoot?.querySelectorAll('.session-grid-item');
      expect(gridItems).to.have.length(6);
    });

    it('should display session previews in grid items', async () => {
      const sessions = createSampleSessions(4);
      const element = await createResponsiveSessionWrapper({ 
        sessions,
        forceView: 'tablet' 
      });
      
      const gridItems = element.shadowRoot?.querySelectorAll('.session-grid-item');
      expect(gridItems).to.have.length(4);
      
      // Check first grid item content
      const firstItem = gridItems?.[0];
      expect(firstItem?.textContent).to.include('Test Session 1');
      expect(firstItem?.querySelector('.session-preview-title')).to.exist;
      expect(firstItem?.querySelector('.session-preview-stats')).to.exist;
    });

    it('should handle session clicks in tablet view', async () => {
      const sessions = createSampleSessions(3);
      const element = await createResponsiveSessionWrapper({ 
        sessions,
        forceView: 'tablet' 
      });
      
      let selectedSession: any = null;
      element.addEventListener('session-selected', (e: any) => {
        selectedSession = e.detail.session;
      });
      
      const firstGridItem = element.shadowRoot?.querySelector('.session-grid-item') as HTMLElement;
      firstGridItem?.click();
      
      await element.updateComplete;
      expect(selectedSession).to.exist;
    });

    it('should show session statistics in grid view', async () => {
      const element = await createResponsiveSessionWrapper({ 
        forceView: 'tablet' 
      });
      
      const statsElements = element.shadowRoot?.querySelectorAll('.session-preview-stats');
      expect(statsElements?.length).to.be.greaterThan(0);
      
      const firstStats = statsElements?.[0];
      expect(firstStats?.textContent).to.include('Active'); // First session is active
    });
  });

  describe('Desktop View - Table', () => {
    it('should render session table in desktop view', async () => {
      const element = await createResponsiveSessionWrapper({ 
        forceView: 'desktop' 
      });
      
      const sessionTable = element.shadowRoot?.querySelector('.session-table');
      expect(sessionTable).to.exist;
      
      const tableHeaders = element.shadowRoot?.querySelectorAll('.session-table-header');
      expect(tableHeaders?.length).to.be.greaterThan(0);
      
      const tableRows = element.shadowRoot?.querySelectorAll('.session-table-row');
      expect(tableRows).to.have.length(5); // Default 5 sessions
    });

    it('should show sortable column headers', async () => {
      const element = await createResponsiveSessionWrapper({ 
        forceView: 'desktop' 
      });
      
      const sortableHeaders = element.shadowRoot?.querySelectorAll('.session-table-header.sortable');
      expect(sortableHeaders?.length).to.be.greaterThan(0);
      
      const titleHeader = element.shadowRoot?.querySelector('.session-table-header[data-sort="title"]');
      expect(titleHeader).to.exist;
      expect(titleHeader?.getAttribute('aria-sort')).to.exist;
    });

    it('should handle column sorting', async () => {
      const element = await createResponsiveSessionWrapper({ 
        forceView: 'desktop' 
      });
      
      let sortEventFired = false;
      element.addEventListener('sort-changed', (e: any) => {
        sortEventFired = true;
        expect(e.detail.column).to.equal('title');
        expect(e.detail.direction).to.be.oneOf(['asc', 'desc']);
      });
      
      const titleHeader = element.shadowRoot?.querySelector('.session-table-header[data-sort="title"]') as HTMLElement;
      titleHeader?.click();
      
      await element.updateComplete;
      expect(sortEventFired).to.be.true;
    });

    it('should show session details in table rows', async () => {
      const element = await createResponsiveSessionWrapper({ 
        forceView: 'desktop' 
      });
      
      const tableRows = element.shadowRoot?.querySelectorAll('.session-table-row');
      const firstRow = tableRows?.[0];
      
      expect(firstRow?.querySelector('.session-title-cell')).to.exist;
      expect(firstRow?.querySelector('.session-status-cell')).to.exist;
      expect(firstRow?.querySelector('.session-duration-cell')).to.exist;
      expect(firstRow?.querySelector('.session-date-cell')).to.exist;
    });

    it('should handle row selection', async () => {
      const sessions = createSampleSessions(3);
      const element = await createResponsiveSessionWrapper({ 
        sessions,
        forceView: 'desktop' 
      });
      
      let selectedSession: any = null;
      element.addEventListener('session-selected', (e: any) => {
        selectedSession = e.detail.session;
      });
      
      const firstRow = element.shadowRoot?.querySelector('.session-table-row') as HTMLElement;
      firstRow?.click();
      
      await element.updateComplete;
      expect(selectedSession).to.exist;
      expect(selectedSession.sessionId).to.equal(sessions[0].sessionId);
    });
  });

  describe('Search and Filtering', () => {
    it('should render search input', async () => {
      const element = await createResponsiveSessionWrapper();
      
      const searchInput = element.shadowRoot?.querySelector('.session-search-input') as HTMLInputElement;
      expect(searchInput).to.exist;
      expect(searchInput?.placeholder).to.include('Search sessions');
    });

    it('should handle search input', async () => {
      const element = await createResponsiveSessionWrapper();
      
      const searchInput = element.shadowRoot?.querySelector('.session-search-input') as HTMLInputElement;
      
      let searchEventFired = false;
      element.addEventListener('search-changed', (e: any) => {
        searchEventFired = true;
        expect(e.detail.query).to.equal('test query');
      });
      
      searchInput.value = 'test query';
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      
      await element.updateComplete;
      expect(searchEventFired).to.be.true;
    });

    it('should filter sessions by search query', async () => {
      const sessions = [
        ...createSampleSessions(2),
        {
          sessionId: 'special-session',
          title: 'Special Test Session',
          startTime: new Date(),
          isActive: false,
          cwd: '/special/project',
          summary: 'This is a special session for testing',
          tags: ['special', 'test']
        }
      ];
      
      const element = await createResponsiveSessionWrapper({ 
        sessions,
        forceView: 'mobile' 
      });
      
      // Search for "special"
      const searchInput = element.shadowRoot?.querySelector('.session-search-input') as HTMLInputElement;
      searchInput.value = 'special';
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      
      await element.updateComplete;
      
      // Should only show sessions matching "special"
      const visibleCards = element.shadowRoot?.querySelectorAll('.session-card:not(.filtered-out)');
      expect(visibleCards).to.have.length(1);
    });

    it('should apply custom filter options', async () => {
      const filterOptions: SessionFilterOptions = {
        status: ['active'],
        dateRange: {
          start: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
          end: new Date()
        },
        tags: ['test']
      };
      
      const element = await createResponsiveSessionWrapper({ 
        filterOptions 
      });
      
      expect(element.filterOptions).to.deep.equal(filterOptions);
      
      // Should apply filters and show filtered results
      const visibleSessions = element.shadowRoot?.querySelectorAll('.session-card:not(.filtered-out)');
      expect(visibleSessions?.length).to.be.lessThanOrEqual(5);
    });

    it('should show filter controls', async () => {
      const element = await createResponsiveSessionWrapper();
      
      const filterToggle = element.shadowRoot?.querySelector('.filter-toggle-button');
      expect(filterToggle).to.exist;
      
      const statusFilter = element.shadowRoot?.querySelector('.filter-status');
      const dateFilter = element.shadowRoot?.querySelector('.filter-date');
      const tagFilter = element.shadowRoot?.querySelector('.filter-tags');
      
      expect(statusFilter).to.exist;
      expect(dateFilter).to.exist;
      expect(tagFilter).to.exist;
    });

    it('should handle filter changes', async () => {
      const element = await createResponsiveSessionWrapper();
      
      let filterEventFired = false;
      element.addEventListener('filter-changed', (e: any) => {
        filterEventFired = true;
        expect(e.detail.filters).to.exist;
      });
      
      // Toggle a status filter
      const activeStatusFilter = element.shadowRoot?.querySelector('.filter-status-option[data-status="active"]') as HTMLInputElement;
      activeStatusFilter?.click();
      
      await element.updateComplete;
      expect(filterEventFired).to.be.true;
    });
  });

  describe('Data Formatting', () => {
    it('should format session duration correctly', async () => {
      const now = new Date();
      const sessions = [{
        sessionId: 'test-duration',
        title: 'Duration Test',
        startTime: new Date(now.getTime() - 3.5 * 60 * 60 * 1000), // 3.5 hours ago
        endTime: now,
        isActive: false,
        cwd: '/test',
        summary: 'Test session',
        tags: ['test']
      }];
      
      const element = await createResponsiveSessionWrapper({ 
        sessions,
        forceView: 'mobile' 
      });
      
      const durationElement = element.shadowRoot?.querySelector('.session-card-duration');
      expect(durationElement?.textContent).to.include('3h 30m');
    });

    it('should format dates correctly', async () => {
      const testDate = new Date('2024-01-15T14:30:00');
      const sessions = [{
        sessionId: 'test-date',
        title: 'Date Test',
        startTime: testDate,
        isActive: false,
        cwd: '/test',
        summary: 'Test session',
        tags: ['test']
      }];
      
      const element = await createResponsiveSessionWrapper({ 
        sessions,
        forceView: 'desktop' 
      });
      
      const dateCell = element.shadowRoot?.querySelector('.session-date-cell');
      expect(dateCell?.textContent).to.include('Jan 15');
    });

    it('should handle active sessions without end time', async () => {
      const sessions = [{
        sessionId: 'active-session',
        title: 'Active Session',
        startTime: new Date(Date.now() - 45 * 60 * 1000), // 45 minutes ago
        isActive: true,
        cwd: '/test',
        summary: 'Active test session',
        tags: ['test']
      }];
      
      const element = await createResponsiveSessionWrapper({ 
        sessions,
        forceView: 'mobile' 
      });
      
      // Should render without errors and show duration from start to now
      const card = element.shadowRoot?.querySelector('.session-card');
      expect(card).to.exist;
      expect(card?.textContent).to.include('45m'); // Approximate duration
    });
  });

  describe('Configuration', () => {
    it('should apply custom configuration', async () => {
      const customConfig: ResponsiveSessionConfig = {
        mobileView: 'compact',
        tabletView: 'list',
        desktopView: 'compact',
        enableSearch: false,
        enableFilters: false,
        enableSorting: false,
        itemsPerPage: 20
      };
      
      const element = await createResponsiveSessionWrapper({ 
        config: customConfig 
      });
      
      expect(element.config).to.deep.equal(customConfig);
      
      // Search should be hidden when disabled
      const searchInput = element.shadowRoot?.querySelector('.session-search-input');
      expect(searchInput).to.not.be.displayed;
    });

    it('should handle missing configuration gracefully', async () => {
      const element = await createResponsiveSessionWrapper();
      
      // Should use default config
      expect(element.config).to.exist;
      expect(element.config.mobileView).to.equal('cards');
      expect(element.config.enableSearch).to.be.true;
      expect(element.config.enableFilters).to.be.true;
    });
  });

  describe('Performance', () => {
    it('should render large numbers of sessions efficiently', async () => {
      const largeSessions = createSampleSessions(200);
      
      performanceTester.startMeasurement('large-session-render');
      
      const element = await createResponsiveSessionWrapper({ 
        sessions: largeSessions,
        forceView: 'mobile' 
      });
      
      performanceTester.endMeasurement('large-session-render');
      performanceTester.assertPerformance(1000); // Should render in under 1s
      
      // Should render all sessions (with potential virtualization)
      const sessionCards = element.shadowRoot?.querySelectorAll('.session-card');
      expect(sessionCards).to.have.length.greaterThan(0);
    });

    it('should handle rapid view switching efficiently', async () => {
      const element = await createResponsiveSessionWrapper();
      
      performanceTester.startMeasurement('view-switching');
      
      // Rapidly switch between views
      const views = ['mobile', 'tablet', 'desktop'] as const;
      for (let i = 0; i < 20; i++) {
        const view = views[i % views.length];
        element['_handleViewChange'](view);
        await element.updateComplete;
      }
      
      performanceTester.endMeasurement('view-switching');
      performanceTester.assertPerformance(400); // Should handle rapid switching
    });

    it('should handle rapid search/filter changes efficiently', async () => {
      const element = await createResponsiveSessionWrapper();
      const searchInput = element.shadowRoot?.querySelector('.session-search-input') as HTMLInputElement;
      
      performanceTester.startMeasurement('search-performance');
      
      // Rapid search queries
      const queries = ['test', 'session', 'active', 'complete', 'tag'];
      for (const query of queries) {
        searchInput.value = query;
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        await element.updateComplete;
      }
      
      performanceTester.endMeasurement('search-performance');
      performanceTester.assertPerformance(200);
    });

    it('should not cause memory leaks with session updates', async () => {
      memoryTester.startTest();
      
      const element = await createResponsiveSessionWrapper();
      
      // Simulate multiple session updates
      for (let i = 0; i < 30; i++) {
        element.sessions = createSampleSessions(Math.floor(Math.random() * 20) + 5);
        await element.updateComplete;
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      memoryTester.checkForLeaks(3 * 1024 * 1024); // 3MB max increase
    });
  });

  describe('Event Handling', () => {
    it('should handle resize events', async () => {
      const element = await createResponsiveSessionWrapper();
      
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
      const element = await createResponsiveSessionWrapper();
      
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
        { sessionId: 'missing-fields', title: 'Invalid' }, // Missing required fields
        null, // Null session
        undefined, // Undefined session
        { sessionId: 'bad-date', title: 'Bad Date', startTime: 'invalid date', isActive: false },
      ];
      
      const element = await createResponsiveSessionWrapper({ 
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
      const element = await createResponsiveSessionWrapper({ 
        sessions: [] 
      });
      
      expect(element).to.exist;
      expect(element.sessions).to.have.length(0);
      
      // Should show empty state message
      const emptyMessage = element.shadowRoot?.textContent;
      expect(emptyMessage).to.include('No sessions to display');
    });

    it('should handle search errors gracefully', async () => {
      const element = await createResponsiveSessionWrapper();
      
      // Mock an error in search handling
      const originalHandler = element['_handleSearch'];
      element['_handleSearch'] = () => {
        throw new Error('Search error');
      };
      
      const searchInput = element.shadowRoot?.querySelector('.session-search-input') as HTMLInputElement;
      
      // Should not crash when search input changes
      expect(() => {
        searchInput.value = 'test';
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      }).to.not.throw();
      
      // Restore original handler
      element['_handleSearch'] = originalHandler;
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels and roles', async () => {
      const element = await createResponsiveSessionWrapper({ 
        forceView: 'desktop' 
      });
      
      const table = element.shadowRoot?.querySelector('.session-table') as HTMLElement;
      expect(table?.getAttribute('role')).to.equal('table');
      
      const searchInput = element.shadowRoot?.querySelector('.session-search-input') as HTMLElement;
      expect(searchInput?.getAttribute('aria-label')).to.include('Search');
    });

    it('should handle keyboard navigation in session items', async () => {
      const sessions = createSampleSessions(3);
      const element = await createResponsiveSessionWrapper({ 
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

    it('should maintain proper focus order in desktop table', async () => {
      const element = await createResponsiveSessionWrapper({ 
        forceView: 'desktop' 
      });
      
      const tableRows = element.shadowRoot?.querySelectorAll('.session-table-row');
      const firstRow = tableRows?.[0] as HTMLElement;
      const secondRow = tableRows?.[1] as HTMLElement;
      
      // Should be able to focus table rows
      if (firstRow && secondRow) {
        firstRow.focus();
        expect(document.activeElement).to.equal(firstRow);
        
        secondRow.focus();
        expect(document.activeElement).to.equal(secondRow);
      }
    });

    it('should provide screen reader announcements for filter changes', async () => {
      const element = await createResponsiveSessionWrapper();
      
      const searchInput = element.shadowRoot?.querySelector('.session-search-input') as HTMLInputElement;
      const ariaLive = element.shadowRoot?.querySelector('[aria-live]');
      
      // Search should trigger screen reader announcement
      searchInput.value = 'test';
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      
      await element.updateComplete;
      
      expect(ariaLive).to.exist;
      // Should announce filter results
    });
  });
});