import { expect } from '@open-wc/testing';
import { html } from 'lit';
import { fixture } from '@open-wc/testing';
import { SessionCard } from '../../src/components/session-card/session-card.js';
import type { SessionData } from '../../src/components/session-card/session-card.js';

describe('SessionCard', () => {
  let element: SessionCard;

  const mockSessionData: SessionData = {
    id: 'test-session-123',
    name: 'Test Session',
    startTime: '2025-08-27T10:00:00Z',
    endTime: '2025-08-27T10:30:00Z',
    messageCount: 5,
    tokenUsage: {
      input: 100,
      output: 200,
      cacheRead: 50
    },
    preview: 'This is a test session with some content that should be displayed in the preview section.',
    workingDirectory: '/Users/test/project'
  };

  beforeEach(async () => {
    element = await fixture<SessionCard>(html`
      <session-card
        .session=${mockSessionData}
        .isSelected=${false}
        .searchTerm=${''}
      ></session-card>
    `);
  });

  it('should render session card', () => {
    expect(element).to.exist;
    expect(element.shadowRoot).to.exist;
  });

  it('should display session information correctly', () => {
    const sessionId = element.shadowRoot?.querySelector('.session-id');
    const sessionName = element.shadowRoot?.querySelector('.session-name');
    const messageCountBadge = element.shadowRoot?.querySelector('.badge.message-count');
    
    expect(sessionId?.textContent?.trim()).to.equal('test-session-123');
    expect(sessionName?.textContent?.trim()).to.equal('Test Session');
    expect(messageCountBadge?.textContent?.trim()).to.include('5 messages');
  });

  it('should display token usage correctly', () => {
    const tokenBadge = element.shadowRoot?.querySelector('.badge.token-usage');
    expect(tokenBadge?.textContent?.trim()).to.include('100→200');
  });

  it('should show cache stats when available', () => {
    const cacheBadge = element.shadowRoot?.querySelector('.badge.cache-stats');
    expect(cacheBadge?.textContent?.trim()).to.include('Cache: 50');
  });

  it('should display working directory', () => {
    const workingDir = element.shadowRoot?.querySelector('.working-directory');
    expect(workingDir?.textContent?.trim()).to.include('/Users/test/project');
  });

  it('should truncate long previews', async () => {
    const longPreview = 'A'.repeat(200);
    element.session = { ...mockSessionData, preview: longPreview };
    await element.updateComplete;
    
    const preview = element.shadowRoot?.querySelector('.session-preview.truncated');
    const readMoreBtn = element.shadowRoot?.querySelector('.read-more-btn');
    
    expect(preview).to.exist;
    expect(readMoreBtn).to.exist;
  });

  it('should highlight search terms', async () => {
    element.searchTerm = 'test';
    await element.updateComplete;
    
    const sessionId = element.shadowRoot?.querySelector('.session-id');
    expect(sessionId?.innerHTML).to.include('<mark>test</mark>');
  });

  it('should emit session-selected event when clicked', async () => {
    let eventFired = false;
    let eventDetail: any = null;

    element.addEventListener('session-selected', (e: Event) => {
      eventFired = true;
      eventDetail = (e as CustomEvent).detail;
    });

    const card = element.shadowRoot?.querySelector('.session-card') as HTMLElement;
    card.click();

    await element.updateComplete;
    
    expect(eventFired).to.be.true;
    expect(eventDetail.sessionId).to.equal('test-session-123');
  });

  it('should handle keyboard navigation', async () => {
    let eventFired = false;
    element.addEventListener('session-selected', () => { eventFired = true; });

    const card = element.shadowRoot?.querySelector('.session-card') as HTMLElement;
    
    // Test Enter key
    const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });
    card.dispatchEvent(enterEvent);
    
    await element.updateComplete;
    expect(eventFired).to.be.true;
  });

  it('should show selected state correctly', async () => {
    element.isSelected = true;
    await element.updateComplete;
    
    const card = element.shadowRoot?.querySelector('.session-card.selected');
    expect(card).to.exist;
  });

  it('should handle sessions without optional data', async () => {
    const minimalSession: SessionData = {
      id: 'minimal-session',
      startTime: '2025-08-27T10:00:00Z',
      endTime: '2025-08-27T10:05:00Z',
      messageCount: 1
    };

    element.session = minimalSession;
    await element.updateComplete;

    const sessionName = element.shadowRoot?.querySelector('.session-name');
    const tokenBadge = element.shadowRoot?.querySelector('.badge.token-usage');
    const workingDir = element.shadowRoot?.querySelector('.working-directory');
    
    expect(sessionName).to.not.exist;
    expect(tokenBadge).to.not.exist;
    expect(workingDir).to.not.exist;
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      const card = element.shadowRoot?.querySelector('.session-card');
      
      expect(card?.getAttribute('role')).to.equal('button');
      expect(card?.getAttribute('tabindex')).to.equal('0');
      expect(card?.getAttribute('aria-label')).to.include('Session test-session-123');
    });

    it('should support focus management', () => {
      const card = element.shadowRoot?.querySelector('.session-card') as HTMLElement;
      card.focus();
      
      expect(document.activeElement).to.equal(element);
    });
  });

  describe('Responsive Design', () => {
    it('should adapt to mobile viewport', async () => {
      element.style.width = '320px';
      await element.updateComplete;
      
      const card = element.shadowRoot?.querySelector('.session-card');
      const computedStyle = window.getComputedStyle(card as Element);
      
      // Should still be visible and properly styled
      expect(computedStyle.display).to.not.equal('none');
    });
  });

  describe('Preview Handling', () => {
    it('should emit preview-expand-requested event for read more', async () => {
      const longPreview = 'A'.repeat(200);
      element.session = { ...mockSessionData, preview: longPreview };
      await element.updateComplete;

      let eventFired = false;
      let eventDetail: any = null;

      element.addEventListener('preview-expand-requested', (e: Event) => {
        eventFired = true;
        eventDetail = (e as CustomEvent).detail;
      });

      const readMoreBtn = element.shadowRoot?.querySelector('.read-more-btn') as HTMLElement;
      readMoreBtn.click();

      expect(eventFired).to.be.true;
      expect(eventDetail.sessionId).to.equal('test-session-123');
      expect(eventDetail.fullPreview).to.equal(longPreview);
    });

    it('should prevent card click when read more is clicked', async () => {
      const longPreview = 'A'.repeat(200);
      element.session = { ...mockSessionData, preview: longPreview };
      await element.updateComplete;

      let cardEventFired = false;
      let previewEventFired = false;

      element.addEventListener('session-selected', () => { cardEventFired = true; });
      element.addEventListener('preview-expand-requested', () => { previewEventFired = true; });

      const readMoreBtn = element.shadowRoot?.querySelector('.read-more-btn') as HTMLElement;
      readMoreBtn.click();

      // Only preview event should fire, not card selection
      expect(previewEventFired).to.be.true;
      expect(cardEventFired).to.be.false;
    });
  });

  describe('Token Usage Formatting', () => {
    it('should format basic token usage', () => {
      const formatted = element.shadowRoot?.querySelector('.badge.token-usage')?.getAttribute('title');
      expect(formatted).to.include('Input: 100 | Output: 200');
    });

    it('should include cache information when available', async () => {
      element.session = {
        ...mockSessionData,
        tokenUsage: {
          input: 100,
          output: 200,
          cacheCreation: 75,
          cacheRead: 50
        }
      };
      await element.updateComplete;
      
      const formatted = element.shadowRoot?.querySelector('.badge.token-usage')?.getAttribute('title');
      expect(formatted).to.include('Cache Creation: 75');
      expect(formatted).to.include('Cache Read: 50');
    });
  });
});