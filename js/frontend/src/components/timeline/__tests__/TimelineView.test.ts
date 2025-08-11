import { html } from 'lit';
import { fixture, expect, oneEvent } from '@open-wc/testing';
import { TimelineView } from '../TimelineView';
import { SessionSummary } from '../../types/session-types';

// Mock GSTC since it requires DOM and complex initialization
const mockGSTC = {
  api: {
    fromArray: (data: any[]) => ({ data }),
    stateFromConfig: (config: any) => ({ config }),
    plugins: {
      TimelinePointer: { Plugin: () => ({}) },
      Selection: { Plugin: () => ({}) },
      ItemResizing: { Plugin: () => ({}) },
      ItemMovement: { Plugin: () => ({}) },
    },
  },
};

// Mock GSTC globally
(globalThis as any).GSTC = mockGSTC;

describe('TimelineView', () => {
  let element: TimelineView;
  let sampleSessions: SessionSummary[];

  beforeEach(async () => {
    // Create sample session data
    sampleSessions = [
      {
        sessionId: 'session-1',
        title: 'Test Session 1',
        cwd: '/test/project',
        startTime: new Date('2024-01-01T10:00:00Z'),
        endTime: new Date('2024-01-01T12:00:00Z'),
        messageCount: 10,
        userMessageCount: 5,
        assistantMessageCount: 5,
        duration: 2 * 60 * 60 * 1000, // 2 hours
        isActive: false,
        tags: ['testing', 'development'],
        summary: 'Test session summary',
        tokenUsage: {
          inputTokens: 1000,
          outputTokens: 1500,
          totalTokens: 2500,
        },
      },
      {
        sessionId: 'session-2',
        title: 'Test Session 2',
        cwd: '/test/another-project',
        startTime: new Date('2024-01-02T14:00:00Z'),
        messageCount: 5,
        userMessageCount: 3,
        assistantMessageCount: 2,
        isActive: true,
        tags: ['active'],
        tokenUsage: {
          inputTokens: 500,
          outputTokens: 800,
          totalTokens: 1300,
        },
      },
    ];

    element = await fixture(html`<timeline-view></timeline-view>`);
  });

  describe('Rendering', () => {
    it('should render the timeline container', () => {
      const container = element.shadowRoot!.querySelector('.timeline-container');
      expect(container).to.exist;
    });

    it('should render the header with title and controls', () => {
      const header = element.shadowRoot!.querySelector('.timeline-header');
      expect(header).to.exist;

      const title = element.shadowRoot!.querySelector('.timeline-title');
      expect(title).to.exist;
      expect(title!.textContent).to.include('Session Timeline');

      const controls = element.shadowRoot!.querySelector('.timeline-controls');
      expect(controls).to.exist;
    });

    it('should render zoom controls', () => {
      const zoomControls = element.shadowRoot!.querySelector('.zoom-controls');
      expect(zoomControls).to.exist;

      const zoomButtons = element.shadowRoot!.querySelectorAll('.zoom-button');
      expect(zoomButtons).to.have.length(2); // zoom in and zoom out

      const zoomLevel = element.shadowRoot!.querySelector('.zoom-level');
      expect(zoomLevel).to.exist;
    });

    it('should render filter controls', () => {
      const filterControls = element.shadowRoot!.querySelector('.filter-controls');
      expect(filterControls).to.exist;

      const filterInputs = element.shadowRoot!.querySelectorAll('.filter-input');
      expect(filterInputs).to.have.length(2); // start and end date
    });

    it('should show empty state when no sessions', async () => {
      element.sessions = [];
      await element.updateComplete;

      const emptyState = element.shadowRoot!.querySelector('.empty-state');
      expect(emptyState).to.exist;
      expect(emptyState!.textContent).to.include('No sessions to display');
    });

    it('should show loading state when loading', async () => {
      element.loading = true;
      await element.updateComplete;

      const loadingState = element.shadowRoot!.querySelector('.loading-state');
      expect(loadingState).to.exist;
      expect(loadingState!.textContent).to.include('Loading timeline');
    });

    it('should show error state when error occurs', async () => {
      element.error = 'Test error message';
      await element.updateComplete;

      const errorState = element.shadowRoot!.querySelector('.error-state');
      expect(errorState).to.exist;
      expect(errorState!.textContent).to.include('Test error message');
    });

    it('should render GSTC container when sessions are available', async () => {
      element.sessions = sampleSessions;
      await element.updateComplete;

      const gstcContainer = element.shadowRoot!.querySelector('.gstc-container');
      expect(gstcContainer).to.exist;
    });
  });

  describe('Properties', () => {
    it('should have default property values', () => {
      expect(element.sessions).to.deep.equal([]);
      expect(element.filter).to.deep.equal({});
      expect(element.title).to.equal('Session Timeline');
      expect(element.realTime).to.be.true;
      expect(element.showTooltips).to.be.true;
      expect(element.zoomLevel).to.equal('days');
    });

    it('should update when sessions property changes', async () => {
      element.sessions = sampleSessions;
      await element.updateComplete;

      expect(element.sessions).to.have.length(2);
    });

    it('should update title when title property changes', async () => {
      element.title = 'Custom Timeline Title';
      await element.updateComplete;

      const title = element.shadowRoot!.querySelector('.timeline-title');
      expect(title!.textContent).to.equal('Custom Timeline Title');
    });

    it('should update zoom level when zoomLevel property changes', async () => {
      element.zoomLevel = 'hours';
      await element.updateComplete;

      const zoomLevel = element.shadowRoot!.querySelector('.zoom-level');
      expect(zoomLevel!.textContent).to.equal('hours');
    });
  });

  describe('Data Transformation', () => {
    beforeEach(async () => {
      element.sessions = sampleSessions;
      await element.updateComplete;
    });

    it('should transform sessions into timeline data', () => {
      // Access private method for testing
      const transformedData = (element as any).timelineData;
      
      expect(transformedData).to.exist;
      expect(transformedData.rows).to.have.length.greaterThan(0);
      expect(transformedData.items).to.have.length(2); // 2 sessions
      expect(transformedData.columns).to.have.length.greaterThan(0);
    });

    it('should group sessions by working directory', () => {
      const transformedData = (element as any).timelineData;
      
      // Should have rows for different working directories
      expect(transformedData.rows).to.have.length(2); // 2 different cwds
      expect(transformedData.rows[0].label).to.be.oneOf(['project', 'another-project']);
    });

    it('should create timeline items for each session', () => {
      const transformedData = (element as any).timelineData;
      
      expect(transformedData.items).to.have.length(2);
      
      const item1 = transformedData.items.find((item: any) => item.sessionId === 'session-1');
      expect(item1).to.exist;
      expect(item1.time.start).to.equal(sampleSessions[0].startTime.getTime());
      expect(item1.time.end).to.equal(sampleSessions[0].endTime!.getTime());
      
      const item2 = transformedData.items.find((item: any) => item.sessionId === 'session-2');
      expect(item2).to.exist;
      expect(item2.time.start).to.equal(sampleSessions[1].startTime.getTime());
    });

    it('should apply correct colors based on session status', () => {
      const getSessionColor = (element as any).getSessionColor.bind(element);
      
      expect(getSessionColor(sampleSessions[0])).to.equal('#007bff'); // completed session
      expect(getSessionColor(sampleSessions[1])).to.equal('#28a745'); // active session
    });
  });

  describe('Filtering', () => {
    beforeEach(async () => {
      element.sessions = sampleSessions;
      await element.updateComplete;
    });

    it('should filter sessions by date range', () => {
      element.filter = {
        dateRange: {
          start: new Date('2024-01-01T00:00:00Z'),
          end: new Date('2024-01-01T23:59:59Z'),
        },
      };
      
      const filteredSessions = (element as any).getFilteredSessions();
      expect(filteredSessions).to.have.length(1);
      expect(filteredSessions[0].sessionId).to.equal('session-1');
    });

    it('should filter sessions by session IDs', () => {
      element.filter = {
        sessionIds: ['session-2'],
      };
      
      const filteredSessions = (element as any).getFilteredSessions();
      expect(filteredSessions).to.have.length(1);
      expect(filteredSessions[0].sessionId).to.equal('session-2');
    });

    it('should filter sessions by working directories', () => {
      element.filter = {
        workingDirectories: ['/test/project'],
      };
      
      const filteredSessions = (element as any).getFilteredSessions();
      expect(filteredSessions).to.have.length(1);
      expect(filteredSessions[0].sessionId).to.equal('session-1');
    });
  });

  describe('Events', () => {
    it('should emit filter-changed event when filter changes', async () => {
      const listener = oneEvent(element, 'filter-changed');
      
      const startDateInput = element.shadowRoot!.querySelector('input[type="date"]') as HTMLInputElement;
      startDateInput.value = '2024-01-01';
      startDateInput.dispatchEvent(new Event('change'));
      
      const event = await listener;
      expect(event).to.exist;
      expect(event.detail.filter.dateRange).to.exist;
    });

    it('should emit timeline-exported event when export is clicked', async () => {
      const listener = oneEvent(element, 'timeline-exported');
      
      const exportButton = element.shadowRoot!.querySelector('[title="Export timeline"]') as HTMLButtonElement;
      exportButton.click();
      
      const event = await listener;
      expect(event).to.exist;
      expect(event.detail.data).to.exist;
    });

    it('should emit retry-load-requested event when retry is clicked', async () => {
      element.error = 'Test error';
      await element.updateComplete;
      
      const listener = oneEvent(element, 'retry-load-requested');
      
      const retryButton = element.shadowRoot!.querySelector('.control-button') as HTMLButtonElement;
      retryButton.click();
      
      const event = await listener;
      expect(event).to.exist;
    });
  });

  describe('Zoom Controls', () => {
    it('should change zoom level when zoom in is clicked', async () => {
      element.zoomLevel = 'days';
      
      const zoomInButton = element.shadowRoot!.querySelectorAll('.zoom-button')[1] as HTMLButtonElement;
      zoomInButton.click();
      
      await element.updateComplete;
      expect(element.zoomLevel).to.equal('hours');
    });

    it('should change zoom level when zoom out is clicked', async () => {
      element.zoomLevel = 'days';
      
      const zoomOutButton = element.shadowRoot!.querySelectorAll('.zoom-button')[0] as HTMLButtonElement;
      zoomOutButton.click();
      
      await element.updateComplete;
      expect(element.zoomLevel).to.equal('weeks');
    });

    it('should not zoom in beyond hours', async () => {
      element.zoomLevel = 'hours';
      
      const zoomInButton = element.shadowRoot!.querySelectorAll('.zoom-button')[1] as HTMLButtonElement;
      zoomInButton.click();
      
      await element.updateComplete;
      expect(element.zoomLevel).to.equal('hours');
    });

    it('should not zoom out beyond months', async () => {
      element.zoomLevel = 'months';
      
      const zoomOutButton = element.shadowRoot!.querySelectorAll('.zoom-button')[0] as HTMLButtonElement;
      zoomOutButton.click();
      
      await element.updateComplete;
      expect(element.zoomLevel).to.equal('months');
    });
  });

  describe('Real-time Updates', () => {
    beforeEach(async () => {
      element.sessions = sampleSessions;
      await element.updateComplete;
    });

    it('should add a session via addSession method', () => {
      const newSession: SessionSummary = {
        sessionId: 'session-3',
        title: 'New Session',
        cwd: '/test/new-project',
        startTime: new Date(),
        messageCount: 1,
        userMessageCount: 1,
        assistantMessageCount: 0,
        isActive: true,
        tokenUsage: {
          inputTokens: 100,
          outputTokens: 0,
          totalTokens: 100,
        },
      };

      element.addSession(newSession);
      expect(element.sessions).to.have.length(3);
      expect(element.sessions[2].sessionId).to.equal('session-3');
    });

    it('should update a session via updateSession method', () => {
      element.updateSession('session-1', { messageCount: 15 });
      
      const updatedSession = element.sessions.find(s => s.sessionId === 'session-1');
      expect(updatedSession).to.exist;
      expect(updatedSession!.messageCount).to.equal(15);
    });

    it('should remove a session via removeSession method', () => {
      element.removeSession('session-1');
      expect(element.sessions).to.have.length(1);
      expect(element.sessions.find(s => s.sessionId === 'session-1')).to.not.exist;
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      const container = element.shadowRoot!.querySelector('.timeline-container');
      expect(container).to.exist;
    });

    it('should have keyboard accessible controls', () => {
      const buttons = element.shadowRoot!.querySelectorAll('button');
      buttons.forEach(button => {
        expect(button.getAttribute('tabindex')).to.not.equal('-1');
      });
    });

    it('should have proper labels for form controls', () => {
      const dateInputs = element.shadowRoot!.querySelectorAll('input[type="date"]');
      dateInputs.forEach(input => {
        expect(input.getAttribute('placeholder')).to.exist;
      });
    });
  });
});