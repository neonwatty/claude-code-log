import { expect, fixture, html } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import '../ResponsiveLayout.js';
import type { ResponsiveLayout, BreakpointKey, LayoutTemplate } from '../ResponsiveLayout.js';
import {
  setupResponsiveTestEnvironment,
  createResponsiveLayout,
  ResponsiveMockResizeObserver,
  BREAKPOINT_TEST_CASES,
  waitForBreakpointChange,
  assertBreakpointClasses,
  assertLayoutTemplate,
  waitForRender,
  ResponsivePerformanceTester,
} from './responsive-test-utils.js';

describe('ResponsiveLayout', () => {
  let mockResizeObserver: ResponsiveMockResizeObserver;
  let performanceTester: ResponsivePerformanceTester;

  beforeEach(() => {
    mockResizeObserver = setupResponsiveTestEnvironment();
    performanceTester = new ResponsivePerformanceTester();
  });

  describe('Basic Rendering', () => {
    it('should render with default properties', async () => {
      const element = await createResponsiveLayout();
      
      expect(element).to.be.instanceOf(HTMLElement);
      expect(element.tagName.toLowerCase()).to.equal('responsive-layout');
      expect(element.breakpoint).to.equal('mobile');
      expect(element.layoutTemplate).to.equal('default');
      expect(element.hasSidebar).to.be.true;
      expect(element.debug).to.be.true;
    });

    it('should render all slot content correctly', async () => {
      const element = await createResponsiveLayout();
      const shadowRoot = element.shadowRoot!;
      
      // Check that slots are present
      const headerSlot = shadowRoot.querySelector('slot[name="header"]');
      const sidebarSlot = shadowRoot.querySelector('slot[name="sidebar"]');
      const defaultSlot = shadowRoot.querySelector('slot:not([name])');
      const footerSlot = shadowRoot.querySelector('slot[name="footer"]');
      
      expect(headerSlot).to.exist;
      expect(sidebarSlot).to.exist;
      expect(defaultSlot).to.exist;
      expect(footerSlot).to.exist;
    });

    it('should apply CSS custom properties correctly', async () => {
      const element = await createResponsiveLayout({
        layoutTemplate: 'grid',
        gridConfig: {
          columns: { mobile: 1, sm: 2, md: 3, lg: 4, xl: 5 },
          gap: '2rem',
          autoRows: 'minmax(150px, auto)'
        }
      });

      await waitForRender(element);
      
      // Check CSS custom properties are set
      expect(element.style.getPropertyValue('--grid-cols-mobile')).to.equal('1');
      expect(element.style.getPropertyValue('--grid-cols-sm')).to.equal('2');
      expect(element.style.getPropertyValue('--grid-cols-md')).to.equal('3');
      expect(element.style.getPropertyValue('--grid-cols-lg')).to.equal('4');
      expect(element.style.getPropertyValue('--grid-cols-xl')).to.equal('5');
      expect(element.style.getPropertyValue('--grid-gap')).to.equal('2rem');
      expect(element.style.getPropertyValue('--grid-auto-rows')).to.equal('minmax(150px, auto)');
    });
  });

  describe('Breakpoint Detection', () => {
    BREAKPOINT_TEST_CASES.forEach(({ width, height, breakpoint }) => {
      it(`should detect ${breakpoint} breakpoint at ${width}x${height}`, async () => {
        const element = await createResponsiveLayout();
        
        // Simulate viewport resize
        mockResizeObserver.mockViewportResize(element, { width, height, breakpoint });
        
        // Wait for breakpoint change
        await waitForBreakpointChange(element, breakpoint);
        
        // Verify breakpoint property and attribute
        expect(element.breakpoint).to.equal(breakpoint);
        assertBreakpointClasses(element, breakpoint);
      });
    });

    it('should emit breakpoint-change events with correct details', async () => {
      const element = await createResponsiveLayout();
      const viewport = BREAKPOINT_TEST_CASES[3]; // iPad size
      
      let eventFired = false;
      let eventDetail: any;
      
      element.addEventListener('breakpoint-change', (e: any) => {
        eventFired = true;
        eventDetail = e.detail;
      });
      
      mockResizeObserver.mockViewportResize(element, viewport);
      await element.updateComplete;
      
      expect(eventFired).to.be.true;
      expect(eventDetail).to.exist;
      expect(eventDetail.breakpoint).to.equal(viewport.breakpoint);
      expect(eventDetail.viewportWidth).to.equal(viewport.width);
      expect(eventDetail.oldBreakpoint).to.equal('mobile');
    });

    it('should handle rapid breakpoint changes efficiently', async () => {
      const element = await createResponsiveLayout();
      const viewport1 = BREAKPOINT_TEST_CASES[0]; // Mobile
      const viewport2 = BREAKPOINT_TEST_CASES[4]; // Desktop
      
      performanceTester.startMeasurement('breakpoint-transition');
      
      // Rapid breakpoint changes
      for (let i = 0; i < 10; i++) {
        const viewport = i % 2 === 0 ? viewport1 : viewport2;
        mockResizeObserver.mockViewportResize(element, viewport);
        await element.updateComplete;
      }
      
      const duration = performanceTester.endMeasurement('breakpoint-transition');
      
      // Should handle rapid changes in under 100ms
      performanceTester.assertPerformance(100);
      expect(element.breakpoint).to.equal(viewport2.breakpoint);
    });
  });

  describe('Layout Templates', () => {
    const layoutTemplates: LayoutTemplate[] = [
      'default',
      'grid',
      'flex', 
      'sidebar-left',
      'sidebar-right',
      'full-width'
    ];

    layoutTemplates.forEach(template => {
      it(`should apply ${template} layout template correctly`, async () => {
        const element = await createResponsiveLayout({ layoutTemplate: template });
        await waitForRender(element);
        
        assertLayoutTemplate(element, template);
        
        // Check for template-specific CSS classes
        const container = element.shadowRoot?.querySelector('.responsive-container');
        if (template !== 'default') {
          expect(container?.classList.contains(`layout-template-${template}`)).to.be.true;
        }
      });
    });

    it('should update layout template dynamically', async () => {
      const element = await createResponsiveLayout({ layoutTemplate: 'default' });
      await waitForRender(element);
      
      // Verify initial template
      assertLayoutTemplate(element, 'default');
      
      // Change template
      element.layoutTemplate = 'grid';
      await element.updateComplete;
      
      // Verify new template
      assertLayoutTemplate(element, 'grid');
    });

    it('should hide sidebar when hasSidebar is false', async () => {
      const element = await createResponsiveLayout({ hasSidebar: false });
      await waitForRender(element);
      
      expect(element.getAttribute('has-sidebar')).to.equal('false');
      
      const sidebar = element.shadowRoot?.querySelector('.responsive-sidebar');
      expect(sidebar).to.not.be.visible;
    });

    it('should show/hide sidebar dynamically', async () => {
      const element = await createResponsiveLayout({ hasSidebar: true });
      await waitForRender(element);
      
      // Initially visible
      let sidebar = element.shadowRoot?.querySelector('.responsive-sidebar');
      expect(sidebar).to.be.visible;
      
      // Hide sidebar
      element.hasSidebar = false;
      await element.updateComplete;
      
      expect(element.getAttribute('has-sidebar')).to.equal('false');
    });
  });

  describe('Grid Configuration', () => {
    it('should apply custom grid configuration', async () => {
      const customConfig = {
        columns: { mobile: 2, sm: 3, md: 4, lg: 5, xl: 6 },
        gap: '3rem',
        autoRows: 'minmax(200px, auto)'
      };
      
      const element = await createResponsiveLayout({
        layoutTemplate: 'grid',
        gridConfig: customConfig
      });
      
      await waitForRender(element);
      
      // Check all CSS custom properties
      expect(element.style.getPropertyValue('--grid-cols-mobile')).to.equal('2');
      expect(element.style.getPropertyValue('--grid-cols-sm')).to.equal('3');
      expect(element.style.getPropertyValue('--grid-cols-md')).to.equal('4');
      expect(element.style.getPropertyValue('--grid-cols-lg')).to.equal('5');
      expect(element.style.getPropertyValue('--grid-cols-xl')).to.equal('6');
      expect(element.style.getPropertyValue('--grid-gap')).to.equal('3rem');
      expect(element.style.getPropertyValue('--grid-auto-rows')).to.equal('minmax(200px, auto)');
    });

    it('should update grid configuration dynamically', async () => {
      const element = await createResponsiveLayout({ layoutTemplate: 'grid' });
      
      // Initial config
      expect(element.style.getPropertyValue('--grid-cols-mobile')).to.equal('1');
      
      // Update config
      element.gridConfig = {
        columns: { mobile: 3, sm: 4, md: 5, lg: 6, xl: 7 },
        gap: '4rem',
        autoRows: 'minmax(250px, auto)'
      };
      
      await element.updateComplete;
      
      // Check updated config
      expect(element.style.getPropertyValue('--grid-cols-mobile')).to.equal('3');
      expect(element.style.getPropertyValue('--grid-gap')).to.equal('4rem');
      expect(element.style.getPropertyValue('--grid-auto-rows')).to.equal('minmax(250px, auto)');
    });
  });

  describe('Debug Mode', () => {
    it('should show debug indicator when debug is enabled', async () => {
      const element = await createResponsiveLayout({ debug: true });
      await waitForRender(element);
      
      expect(element.debug).to.be.true;
      expect(element.hasAttribute('debug')).to.be.true;
      
      // Debug indicator should be visible via CSS ::before pseudo-element
      const styles = getComputedStyle(element, '::before');
      expect(styles.content).to.include(element.breakpoint);
    });

    it('should hide debug indicator when debug is disabled', async () => {
      const element = await createResponsiveLayout({ debug: false });
      await waitForRender(element);
      
      expect(element.debug).to.be.false;
      expect(element.hasAttribute('debug')).to.be.false;
    });
  });

  describe('Helper Methods', () => {
    it('should return current breakpoint information', async () => {
      const element = await createResponsiveLayout();
      const viewport = BREAKPOINT_TEST_CASES[2]; // Small tablet
      
      mockResizeObserver.mockViewportResize(element, viewport);
      await element.updateComplete;
      
      const breakpointInfo = element.getCurrentBreakpoint();
      expect(breakpointInfo).to.deep.include({
        key: viewport.breakpoint,
        viewportWidth: viewport.width,
      });
      expect(breakpointInfo.breakpoints).to.exist;
    });

    it('should correctly check isBreakpointAtLeast', async () => {
      const element = await createResponsiveLayout();
      const desktopViewport = BREAKPOINT_TEST_CASES[4]; // Desktop
      
      mockResizeObserver.mockViewportResize(element, desktopViewport);
      await element.updateComplete;
      
      expect(element.isBreakpointAtLeast('mobile')).to.be.true;
      expect(element.isBreakpointAtLeast('sm')).to.be.true;
      expect(element.isBreakpointAtLeast('md')).to.be.true;
      expect(element.isBreakpointAtLeast('lg')).to.be.true;
      expect(element.isBreakpointAtLeast('xl')).to.be.false; // lg < xl
    });

    it('should handle edge case breakpoint values', async () => {
      const element = await createResponsiveLayout();
      
      // Test exact breakpoint boundaries
      mockResizeObserver.mockViewportResize(element, { width: 640, height: 800, breakpoint: 'sm' });
      await element.updateComplete;
      expect(element.breakpoint).to.equal('sm');
      
      mockResizeObserver.mockViewportResize(element, { width: 639, height: 800, breakpoint: 'mobile' });
      await element.updateComplete;
      expect(element.breakpoint).to.equal('mobile');
    });
  });

  describe('Responsive Behavior Integration', () => {
    it('should coordinate layout changes with breakpoint changes', async () => {
      const element = await createResponsiveLayout({
        layoutTemplate: 'sidebar-left',
        hasSidebar: true
      });
      
      // Desktop: sidebar should be visible and positioned left
      const desktopViewport = BREAKPOINT_TEST_CASES[4];
      mockResizeObserver.mockViewportResize(element, desktopViewport);
      await element.updateComplete;
      
      const container = element.shadowRoot?.querySelector('.responsive-container');
      expect(container?.classList.contains('layout-template-sidebar-left')).to.be.true;
      
      // Mobile: layout should adapt
      const mobileViewport = BREAKPOINT_TEST_CASES[0];
      mockResizeObserver.mockViewportResize(element, mobileViewport);
      await element.updateComplete;
      
      expect(element.breakpoint).to.equal('mobile');
      // Layout template class should still be applied
      expect(container?.classList.contains('layout-template-sidebar-left')).to.be.true;
    });

    it('should handle rapid layout template changes', async () => {
      const element = await createResponsiveLayout();
      const templates: LayoutTemplate[] = ['default', 'grid', 'flex', 'sidebar-left'];
      
      performanceTester.startMeasurement('template-switching');
      
      for (const template of templates) {
        element.layoutTemplate = template;
        await element.updateComplete;
        assertLayoutTemplate(element, template);
      }
      
      performanceTester.endMeasurement('template-switching');
      performanceTester.assertPerformance(50); // Should be very fast
    });
  });

  describe('Error Handling', () => {
    it('should handle ResizeObserver failures gracefully', async () => {
      // Mock ResizeObserver to throw an error
      const originalResizeObserver = global.ResizeObserver;
      global.ResizeObserver = class {
        constructor() {
          throw new Error('ResizeObserver not supported');
        }
      } as any;
      
      // Component should still render and work
      const element = await createResponsiveLayout();
      expect(element).to.exist;
      expect(element.breakpoint).to.equal('mobile'); // Should fallback
      
      // Restore original
      global.ResizeObserver = originalResizeObserver;
    });

    it('should handle invalid breakpoint configuration gracefully', async () => {
      const element = await createResponsiveLayout({
        breakpoints: {
          sm: -100, // Invalid negative value
          md: 768,
          lg: 1024,
          xl: 1280
        }
      });
      
      // Should still work with fallback behavior
      expect(element).to.exist;
      expect(element.breakpoint).to.equal('mobile');
    });
  });

  describe('Accessibility', () => {
    it('should maintain focus during breakpoint changes', async () => {
      const element = await createResponsiveLayout();
      const button = document.createElement('button');
      button.textContent = 'Test Button';
      element.appendChild(button);
      
      await waitForRender(element);
      button.focus();
      expect(document.activeElement).to.equal(button);
      
      // Change breakpoint
      const viewport = BREAKPOINT_TEST_CASES[3];
      mockResizeObserver.mockViewportResize(element, viewport);
      await element.updateComplete;
      
      // Focus should be maintained
      expect(document.activeElement).to.equal(button);
    });

    it('should have proper ARIA attributes', async () => {
      const element = await createResponsiveLayout();
      await waitForRender(element);
      
      // Check for proper semantic structure
      const main = element.shadowRoot?.querySelector('main');
      const header = element.shadowRoot?.querySelector('header');
      const footer = element.shadowRoot?.querySelector('footer');
      const aside = element.shadowRoot?.querySelector('aside');
      
      expect(main).to.exist;
      expect(header).to.exist;
      expect(footer).to.exist;
      expect(aside).to.exist;
      
      // Should use semantic HTML elements for accessibility
      expect(main?.tagName.toLowerCase()).to.equal('main');
      expect(header?.tagName.toLowerCase()).to.equal('header');
      expect(footer?.tagName.toLowerCase()).to.equal('footer');
      expect(aside?.tagName.toLowerCase()).to.equal('aside');
    });
  });
});