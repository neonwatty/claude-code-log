import { expect } from '@open-wc/testing';
import { html } from 'lit';
import { fixture } from '@open-wc/testing';
import { StatisticsDashboard } from '../../src/components/statistics-dashboard/statistics-dashboard.js';
import type { ConnectionStatistics } from '../../src/utils/websocket/connection-state.js';

describe('StatisticsDashboard', () => {
  let element: StatisticsDashboard;

  const mockConnectionStats: ConnectionStatistics = {
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
    element = await fixture<StatisticsDashboard>(html`
      <statistics-dashboard
        .userCount=${3}
        .logEntryCount=${87}
        .isDarkMode=${false}
        .connectionStats=${mockConnectionStats}
      ></statistics-dashboard>
    `);
  });

  it('should render statistics dashboard', () => {
    expect(element).to.exist;
    expect(element.shadowRoot).to.exist;
  });

  it('should display correct user count', () => {
    const userStat = element.shadowRoot?.querySelector('#stat-users');
    expect(userStat?.textContent?.trim()).to.equal('3');
  });

  it('should display correct log entry count', () => {
    const entryStat = element.shadowRoot?.querySelector('#stat-entries');
    expect(entryStat?.textContent?.trim()).to.equal('87');
  });

  it('should show light mode theme correctly', () => {
    const themeStat = element.shadowRoot?.querySelector('#stat-theme');
    expect(themeStat?.textContent?.trim()).to.equal('Light');
  });

  it('should show dark mode theme when enabled', async () => {
    element.isDarkMode = true;
    await element.updateComplete;
    
    const themeStat = element.shadowRoot?.querySelector('#stat-theme');
    expect(themeStat?.textContent?.trim()).to.equal('Dark');
  });

  it('should display connection statistics correctly', () => {
    const sentStat = element.shadowRoot?.querySelector('#stat-messages-sent');
    const receivedStat = element.shadowRoot?.querySelector('#stat-messages-received');
    const reconnectStat = element.shadowRoot?.querySelector('#stat-reconnections');

    expect(sentStat?.textContent?.trim()).to.equal('10');
    expect(receivedStat?.textContent?.trim()).to.equal('15');
    expect(reconnectStat?.textContent?.trim()).to.equal('2');
  });

  it('should show connection quality indicator when quality is known', () => {
    const qualityElement = element.shadowRoot?.querySelector('.connection-quality.good');
    expect(qualityElement).to.exist;
    expect(qualityElement?.textContent?.trim()).to.include('Good Connection Quality');
  });

  it('should hide connection quality when unknown', async () => {
    element.connectionStats = { ...mockConnectionStats, connectionQuality: 'unknown' };
    await element.updateComplete;
    
    const qualityElement = element.shadowRoot?.querySelector('.connection-quality');
    expect(qualityElement).to.not.exist;
  });

  it('should have proper accessibility attributes', () => {
    const statCards = element.shadowRoot?.querySelectorAll('.stat-card');
    statCards?.forEach(card => {
      expect(card.getAttribute('role')).to.equal('article');
      expect(card.getAttribute('aria-label')).to.exist;
      expect(card.getAttribute('tabindex')).to.equal('0');
    });
  });

  it('should apply correct CSS classes for card types', () => {
    const primaryCard = element.shadowRoot?.querySelector('.stat-card.primary');
    const secondaryCard = element.shadowRoot?.querySelector('.stat-card.secondary');
    const successCard = element.shadowRoot?.querySelector('.stat-card.success');
    
    expect(primaryCard).to.exist;
    expect(secondaryCard).to.exist;
    expect(successCard).to.exist;
  });

  it('should handle responsive layout classes', async () => {
    // Test that the component can be resized
    element.style.width = '300px';
    await element.updateComplete;
    
    const statsGrid = element.shadowRoot?.querySelector('.stats-grid');
    expect(window.getComputedStyle(statsGrid as Element).display).to.equal('grid');
  });

  it('should update stat values with animation', () => {
    element.updateStatValue('users', 5);
    
    const userStat = element.shadowRoot?.querySelector('#stat-users');
    expect(userStat?.textContent?.trim()).to.equal('5');
    expect(userStat?.classList.contains('updated')).to.be.true;
    
    // Animation class should be removed after timeout
    setTimeout(() => {
      expect(userStat?.classList.contains('updated')).to.be.false;
    }, 600);
  });

  describe('Quality Indicators', () => {
    it('should render excellent quality correctly', async () => {
      element.connectionStats = { ...mockConnectionStats, connectionQuality: 'excellent' };
      await element.updateComplete;
      
      const qualityElement = element.shadowRoot?.querySelector('.connection-quality.excellent');
      expect(qualityElement?.textContent?.trim()).to.include('Excellent');
    });

    it('should render poor quality correctly', async () => {
      element.connectionStats = { ...mockConnectionStats, connectionQuality: 'poor' };
      await element.updateComplete;
      
      const qualityElement = element.shadowRoot?.querySelector('.connection-quality.poor');
      expect(qualityElement?.textContent?.trim()).to.include('Poor');
    });
  });

  describe('Accessibility', () => {
    it('should have proper focus management', () => {
      const cards = element.shadowRoot?.querySelectorAll('.stat-card[tabindex="0"]');
      expect(cards?.length).to.be.greaterThan(0);
    });

    it('should have descriptive aria-labels', () => {
      const userCard = element.shadowRoot?.querySelector('[aria-label*="Active Users"]');
      expect(userCard).to.exist;
      expect(userCard?.getAttribute('aria-label')).to.include('3');
    });
  });
});