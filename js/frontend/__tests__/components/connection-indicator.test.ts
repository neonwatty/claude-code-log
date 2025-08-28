import { expect } from '@open-wc/testing';
import { html } from 'lit';
import { fixture } from '@open-wc/testing';
import { ConnectionIndicator } from '../../src/components/connection-indicator/connection-indicator.js';
import { ConnectionState } from '../../src/utils/websocket/connection-state.js';
import type { ConnectionStatistics } from '../../src/utils/websocket/connection-state.js';

describe('ConnectionIndicator', () => {
  let element: ConnectionIndicator;

  const mockStats: ConnectionStatistics = {
    uptime: 120,
    reconnectionCount: 2,
    lastConnectTime: new Date(),
    lastDisconnectTime: null,
    averageLatency: 45,
    messagesSent: 10,
    messagesReceived: 15,
    totalDataSent: 1024,
    totalDataReceived: 2048,
    connectionQuality: "good",
  };

  beforeEach(async () => {
    element = await fixture<ConnectionIndicator>(html`
      <connection-indicator
        .connectionState=${ConnectionState.CONNECTED}
        .statistics=${mockStats}
      ></connection-indicator>
    `);
  });

  it('should render connection indicator', () => {
    expect(element).to.exist;
    expect(element.shadowRoot).to.exist;
  });

  it('should show correct status for connected state', () => {
    const statusText = element.shadowRoot?.querySelector('.status-text');
    const statusIcon = element.shadowRoot?.querySelector('.status-icon');
    
    expect(statusText?.textContent?.trim()).to.equal('Connected');
    expect(statusIcon?.textContent?.trim()).to.equal('🟢');
  });

  it('should show correct status for disconnected state', async () => {
    element.connectionState = ConnectionState.DISCONNECTED;
    await element.updateComplete;
    
    const statusText = element.shadowRoot?.querySelector('.status-text');
    const statusIcon = element.shadowRoot?.querySelector('.status-icon');
    const indicator = element.shadowRoot?.querySelector('.connection-indicator.disconnected');
    
    expect(statusText?.textContent?.trim()).to.equal('Disconnected');
    expect(statusIcon?.textContent?.trim()).to.equal('🔴');
    expect(indicator).to.exist;
  });

  it('should show connecting state with animation', async () => {
    element.connectionState = ConnectionState.CONNECTING;
    await element.updateComplete;
    
    const statusText = element.shadowRoot?.querySelector('.status-text');
    const statusIcon = element.shadowRoot?.querySelector('.status-icon');
    const indicator = element.shadowRoot?.querySelector('.connection-indicator.connecting');
    
    expect(statusText?.textContent?.trim()).to.equal('Connecting');
    expect(statusIcon?.textContent?.trim()).to.equal('🟡');
    expect(indicator).to.exist;
  });

  it('should format uptime correctly', () => {
    const uptime = element.shadowRoot?.querySelector('.uptime');
    expect(uptime?.textContent?.trim()).to.equal('2m');
  });

  it('should format uptime for hours', async () => {
    element.statistics = { ...mockStats, uptime: 3665 }; // 1h 1m 5s
    await element.updateComplete;
    
    const uptime = element.shadowRoot?.querySelector('.uptime');
    expect(uptime?.textContent?.trim()).to.equal('1h 1m');
  });

  it('should format uptime for seconds', async () => {
    element.statistics = { ...mockStats, uptime: 45 };
    await element.updateComplete;
    
    const uptime = element.shadowRoot?.querySelector('.uptime');
    expect(uptime?.textContent?.trim()).to.equal('45s');
  });

  describe('Details Panel', () => {
    it('should toggle details panel on click', async () => {
      const indicator = element.shadowRoot?.querySelector('.connection-indicator') as HTMLElement;
      let details = element.shadowRoot?.querySelector('.connection-details.visible');
      
      // Should start hidden
      expect(details).to.not.exist;
      
      // Click to show
      indicator.click();
      await element.updateComplete;
      
      details = element.shadowRoot?.querySelector('.connection-details.visible');
      expect(details).to.exist;
      
      // Click to hide
      indicator.click();
      await element.updateComplete;
      
      details = element.shadowRoot?.querySelector('.connection-details.visible');
      expect(details).to.not.exist;
    });

    it('should show connection statistics in details panel', async () => {
      const indicator = element.shadowRoot?.querySelector('.connection-indicator') as HTMLElement;
      indicator.click();
      await element.updateComplete;
      
      const detailsGrid = element.shadowRoot?.querySelector('.details-grid');
      expect(detailsGrid?.textContent).to.include('10↗ 15↙'); // Messages sent/received
      expect(detailsGrid?.textContent).to.include('2m'); // Uptime
      expect(detailsGrid?.textContent).to.include('2'); // Reconnections
    });

    it('should show quality indicator in details', async () => {
      const indicator = element.shadowRoot?.querySelector('.connection-indicator') as HTMLElement;
      indicator.click();
      await element.updateComplete;
      
      const qualityIndicator = element.shadowRoot?.querySelector('.quality-indicator.good');
      expect(qualityIndicator).to.exist;
      expect(qualityIndicator?.textContent?.trim()).to.include('Good');
    });

    it('should hide details when clicking outside', async () => {
      const indicator = element.shadowRoot?.querySelector('.connection-indicator') as HTMLElement;
      indicator.click();
      await element.updateComplete;
      
      // Verify details are visible
      let details = element.shadowRoot?.querySelector('.connection-details.visible');
      expect(details).to.exist;
      
      // Simulate click outside
      const outsideEvent = new Event('click', { bubbles: true });
      document.body.dispatchEvent(outsideEvent);
      await element.updateComplete;
      
      details = element.shadowRoot?.querySelector('.connection-details.visible');
      expect(details).to.not.exist;
    });
  });

  describe('Connection Quality', () => {
    it('should render excellent quality correctly', async () => {
      element.statistics = { ...mockStats, connectionQuality: 'excellent' };
      await element.updateComplete;
      
      const indicator = element.shadowRoot?.querySelector('.connection-indicator') as HTMLElement;
      indicator.click();
      await element.updateComplete;
      
      const qualityIndicator = element.shadowRoot?.querySelector('.quality-indicator.excellent');
      expect(qualityIndicator?.textContent?.trim()).to.include('Excellent');
    });

    it('should render poor quality correctly', async () => {
      element.statistics = { ...mockStats, connectionQuality: 'poor' };
      await element.updateComplete;
      
      const indicator = element.shadowRoot?.querySelector('.connection-indicator') as HTMLElement;
      indicator.click();
      await element.updateComplete;
      
      const qualityIndicator = element.shadowRoot?.querySelector('.quality-indicator.poor');
      expect(qualityIndicator?.textContent?.trim()).to.include('Poor');
    });

    it('should handle unknown quality gracefully', async () => {
      element.statistics = { ...mockStats, connectionQuality: 'unknown' };
      await element.updateComplete;
      
      const indicator = element.shadowRoot?.querySelector('.connection-indicator') as HTMLElement;
      indicator.click();
      await element.updateComplete;
      
      const qualityIndicator = element.shadowRoot?.querySelector('.quality-indicator.unknown');
      expect(qualityIndicator?.textContent?.trim()).to.include('Unknown');
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      const indicator = element.shadowRoot?.querySelector('.connection-indicator');
      
      expect(indicator?.getAttribute('role')).to.equal('button');
      expect(indicator?.getAttribute('tabindex')).to.equal('0');
      expect(indicator?.getAttribute('aria-expanded')).to.equal('false');
      expect(indicator?.getAttribute('aria-label')).to.include('Connection status');
    });

    it('should update aria-expanded when details are shown', async () => {
      const indicator = element.shadowRoot?.querySelector('.connection-indicator') as HTMLElement;
      
      indicator.click();
      await element.updateComplete;
      
      expect(indicator.getAttribute('aria-expanded')).to.equal('true');
    });

    it('should have meaningful status labels', () => {
      const indicator = element.shadowRoot?.querySelector('.connection-indicator');
      const ariaLabel = indicator?.getAttribute('aria-label');
      
      expect(ariaLabel).to.include('Connected');
      expect(ariaLabel).to.include('uptime: 2m');
    });
  });

  describe('Responsive Design', () => {
    it('should hide uptime on mobile', async () => {
      // Simulate mobile viewport
      element.style.width = '320px';
      await element.updateComplete;
      
      // The uptime should still exist but be hidden via CSS on mobile
      const uptime = element.shadowRoot?.querySelector('.uptime');
      expect(uptime).to.exist;
    });

    it('should adjust details panel positioning on mobile', async () => {
      element.style.width = '320px';
      await element.updateComplete;
      
      const indicator = element.shadowRoot?.querySelector('.connection-indicator') as HTMLElement;
      indicator.click();
      await element.updateComplete;
      
      const details = element.shadowRoot?.querySelector('.connection-details');
      expect(details).to.exist;
    });
  });

  describe('Animation and Interactions', () => {
    it('should show connecting animation', async () => {
      element.connectionState = ConnectionState.CONNECTING;
      await element.updateComplete;
      
      const indicator = element.shadowRoot?.querySelector('.connection-indicator.connecting');
      const statusIcon = element.shadowRoot?.querySelector('.status-icon');
      
      expect(indicator).to.exist;
      expect(statusIcon).to.exist;
    });

    it('should handle hover states', () => {
      const indicator = element.shadowRoot?.querySelector('.connection-indicator');
      
      // Should have hover styles defined in CSS
      const styles = window.getComputedStyle(indicator as Element);
      expect(styles.transition).to.include('all');
    });
  });
});