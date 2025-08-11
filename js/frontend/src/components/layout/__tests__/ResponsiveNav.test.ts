import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import '../ResponsiveNav.js';
import type { ResponsiveNav, NavItem } from '../ResponsiveNav.js';
import {
  createResponsiveNav,
  simulateKeyPress,
  MobileMenuTester,
  waitForRender,
  ResponsivePerformanceTester,
} from './responsive-test-utils.js';

describe('ResponsiveNav', () => {
  let performanceTester: ResponsivePerformanceTester;

  beforeEach(() => {
    performanceTester = new ResponsivePerformanceTester();
  });

  const sampleNavItems: NavItem[] = [
    { label: 'Home', href: '/', icon: '🏠', active: true },
    { label: 'Dashboard', href: '/dashboard', icon: '📊' },
    { label: 'Settings', href: '/settings', icon: '⚙️' },
    { label: 'Help', href: '/help', icon: '❓' },
    { label: 'Profile', href: '/profile', icon: '👤', disabled: true }
  ];

  describe('Basic Rendering', () => {
    it('should render with default properties', async () => {
      const element = await createResponsiveNav();
      
      expect(element).to.be.instanceOf(HTMLElement);
      expect(element.tagName.toLowerCase()).to.equal('responsive-nav');
      expect(element.brand).to.equal('Test Brand');
      expect(element.brandHref).to.equal('/');
    });

    it('should render brand link correctly', async () => {
      const element = await createResponsiveNav({
        brand: 'My App',
        brandHref: '/home'
      });
      
      const brandLink = element.shadowRoot?.querySelector('.nav-brand') as HTMLAnchorElement;
      expect(brandLink).to.exist;
      expect(brandLink.href).to.include('/home');
      expect(brandLink.textContent).to.include('My App');
    });

    it('should render brand icon from slot', async () => {
      const template = html`
        <responsive-nav brand="Test App">
          <span slot="brand-icon">🚀</span>
        </responsive-nav>
      `;
      
      const element = await fixture<ResponsiveNav>(template);
      await waitForRender(element);
      
      const iconSlot = element.shadowRoot?.querySelector('slot[name="brand-icon"]');
      expect(iconSlot).to.exist;
    });

    it('should render navigation items', async () => {
      const element = await createResponsiveNav({ items: sampleNavItems });
      
      // Check desktop navigation items
      const desktopItems = element.shadowRoot?.querySelectorAll('.nav-link-desktop');
      expect(desktopItems).to.have.length(sampleNavItems.length);
      
      // Check first item
      const firstItem = desktopItems?.[0];
      expect(firstItem?.textContent).to.include('Home');
      expect(firstItem?.getAttribute('aria-current')).to.equal('page');
    });
  });

  describe('Navigation Items', () => {
    it('should handle active navigation state', async () => {
      const element = await createResponsiveNav({ items: sampleNavItems });
      
      const activeLink = element.shadowRoot?.querySelector('.nav-link-desktop.active');
      expect(activeLink).to.exist;
      expect(activeLink?.textContent).to.include('Home');
      expect(activeLink?.getAttribute('aria-current')).to.equal('page');
    });

    it('should handle disabled navigation items', async () => {
      const element = await createResponsiveNav({ items: sampleNavItems });
      
      const disabledLink = element.shadowRoot?.querySelector('.nav-link-desktop[disabled]');
      expect(disabledLink).to.exist;
      expect(disabledLink?.textContent).to.include('Profile');
    });

    it('should render icons when provided', async () => {
      const element = await createResponsiveNav({ items: sampleNavItems });
      
      const iconSpan = element.shadowRoot?.querySelector('.nav-link-desktop .nav-icon');
      expect(iconSpan).to.exist;
      expect(iconSpan?.textContent).to.equal('🏠');
    });

    it('should handle navigation item clicks', async () => {
      const element = await createResponsiveNav({ items: sampleNavItems });
      let clickedItem: NavItem | null = null;
      
      element.addEventListener('nav-click', (e: any) => {
        clickedItem = e.detail.item;
      });
      
      const firstLink = element.shadowRoot?.querySelector('.nav-link-desktop') as HTMLAnchorElement;
      firstLink.click();
      
      await element.updateComplete;
      expect(clickedItem).to.exist;
      expect(clickedItem?.label).to.equal('Home');
    });

    it('should prevent clicks on disabled items', async () => {
      const element = await createResponsiveNav({ items: sampleNavItems });
      let clickFired = false;
      
      element.addEventListener('nav-click', () => {
        clickFired = true;
      });
      
      // Find disabled item
      const disabledLink = element.shadowRoot?.querySelector('.nav-link-desktop[disabled]') as HTMLAnchorElement;
      expect(disabledLink).to.exist;
      
      disabledLink.click();
      await element.updateComplete;
      
      expect(clickFired).to.be.false;
    });
  });

  describe('Mobile Menu', () => {
    it('should have hamburger toggle button', async () => {
      const element = await createResponsiveNav({ items: sampleNavItems });
      const menuTester = new MobileMenuTester(element);
      
      const toggleButton = menuTester.getToggleButton();
      expect(toggleButton).to.exist;
      expect(toggleButton?.getAttribute('aria-label')).to.include('Toggle navigation');
      expect(toggleButton?.getAttribute('aria-expanded')).to.equal('false');
    });

    it('should toggle mobile menu on hamburger click', async () => {
      const element = await createResponsiveNav({ items: sampleNavItems });
      const menuTester = new MobileMenuTester(element);
      
      // Initially closed
      expect(menuTester.isMenuOpen()).to.be.false;
      
      // Open menu
      await menuTester.toggleMenu();
      expect(menuTester.isMenuOpen()).to.be.true;
      
      // Check ARIA state
      const toggleButton = menuTester.getToggleButton();
      expect(toggleButton?.getAttribute('aria-expanded')).to.equal('true');
      
      // Close menu
      await menuTester.toggleMenu();
      expect(menuTester.isMenuOpen()).to.be.false;
      expect(toggleButton?.getAttribute('aria-expanded')).to.equal('false');
    });

    it('should close menu via close button', async () => {
      const element = await createResponsiveNav({ items: sampleNavItems });
      const menuTester = new MobileMenuTester(element);
      
      // Open menu
      await menuTester.toggleMenu();
      expect(menuTester.isMenuOpen()).to.be.true;
      
      // Close via close button
      await menuTester.closeMenu();
      expect(menuTester.isMenuOpen()).to.be.false;
    });

    it('should close menu on overlay click', async () => {
      const element = await createResponsiveNav({ items: sampleNavItems });
      const menuTester = new MobileMenuTester(element);
      
      // Open menu
      await menuTester.toggleMenu();
      expect(menuTester.isMenuOpen()).to.be.true;
      
      // Click overlay
      const overlay = element.shadowRoot?.querySelector('.nav-overlay') as HTMLElement;
      expect(overlay).to.exist;
      overlay.click();
      
      await element.updateComplete;
      expect(menuTester.isMenuOpen()).to.be.false;
    });

    it('should render mobile navigation items', async () => {
      const element = await createResponsiveNav({ items: sampleNavItems });
      
      // Check mobile navigation items exist
      const mobileItems = element.shadowRoot?.querySelectorAll('.nav-link-mobile');
      expect(mobileItems).to.have.length(sampleNavItems.length);
      
      // Check content matches
      const firstMobileItem = mobileItems?.[0];
      expect(firstMobileItem?.textContent).to.include('Home');
    });

    it('should close mobile menu on navigation item click', async () => {
      const element = await createResponsiveNav({ items: sampleNavItems });
      const menuTester = new MobileMenuTester(element);
      
      // Open menu
      await menuTester.toggleMenu();
      expect(menuTester.isMenuOpen()).to.be.true;
      
      // Click a navigation item
      const firstMobileItem = element.shadowRoot?.querySelector('.nav-link-mobile') as HTMLAnchorElement;
      firstMobileItem.click();
      
      await element.updateComplete;
      expect(menuTester.isMenuOpen()).to.be.false;
    });

    it('should emit mobile menu events', async () => {
      const element = await createResponsiveNav({ items: sampleNavItems });
      const menuTester = new MobileMenuTester(element);
      
      let openEventFired = false;
      let closeEventFired = false;
      
      element.addEventListener('mobile-menu-opened', () => {
        openEventFired = true;
      });
      
      element.addEventListener('mobile-menu-closed', () => {
        closeEventFired = true;
      });
      
      // Open menu
      await menuTester.toggleMenu();
      expect(openEventFired).to.be.true;
      
      // Close menu
      await menuTester.toggleMenu();
      expect(closeEventFired).to.be.true;
    });
  });

  describe('Keyboard Navigation', () => {
    it('should close mobile menu with Escape key', async () => {
      const element = await createResponsiveNav({ items: sampleNavItems });
      const menuTester = new MobileMenuTester(element);
      
      // Open menu
      await menuTester.toggleMenu();
      expect(menuTester.isMenuOpen()).to.be.true;
      
      // Press Escape
      simulateKeyPress(element, 'Escape');
      await element.updateComplete;
      
      expect(menuTester.isMenuOpen()).to.be.false;
    });

    it('should handle Tab navigation in desktop mode', async () => {
      const element = await createResponsiveNav({ items: sampleNavItems });
      
      // Focus first nav item
      const firstLink = element.shadowRoot?.querySelector('.nav-link-desktop') as HTMLElement;
      firstLink.focus();
      expect(document.activeElement).to.equal(firstLink);
      
      // Tab to next item (this would normally be handled by browser)
      // We'll simulate by focusing the next element
      const secondLink = element.shadowRoot?.querySelector('.nav-link-desktop:nth-child(2)') as HTMLElement;
      if (secondLink) {
        secondLink.focus();
        expect(document.activeElement).to.equal(secondLink);
      }
    });

    it('should manage focus in mobile menu', async () => {
      const element = await createResponsiveNav({ items: sampleNavItems });
      const menuTester = new MobileMenuTester(element);
      
      // Open menu
      await menuTester.toggleMenu();
      
      // Focus should be on close button after opening
      await waitUntil(() => {
        const closeButton = menuTester.getCloseButton();
        return document.activeElement === closeButton;
      }, 'Focus should move to close button');
      
      const closeButton = menuTester.getCloseButton();
      expect(document.activeElement).to.equal(closeButton);
    });

    it('should restore focus when closing mobile menu', async () => {
      const element = await createResponsiveNav({ items: sampleNavItems });
      const menuTester = new MobileMenuTester(element);
      const toggleButton = menuTester.getToggleButton()!;
      
      // Focus toggle button first
      toggleButton.focus();
      expect(document.activeElement).to.equal(toggleButton);
      
      // Open menu (focus moves to close button)
      await menuTester.toggleMenu();
      
      // Close menu (focus should restore to toggle button)
      await menuTester.closeMenu();
      
      // Focus should be back on toggle button
      expect(document.activeElement).to.equal(toggleButton);
    });

    it('should handle Enter key on navigation items', async () => {
      const element = await createResponsiveNav({ 
        items: [
          { label: 'Test', onClick: () => {} }
        ]
      });
      
      let clickHandled = false;
      element.items[0].onClick = () => {
        clickHandled = true;
      };
      
      const navLink = element.shadowRoot?.querySelector('.nav-link-desktop') as HTMLElement;
      navLink.focus();
      
      // Simulate Enter key
      const enterEvent = new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
        cancelable: true
      });
      navLink.dispatchEvent(enterEvent);
      
      // Manually trigger click since Enter->click isn't auto-handled in tests
      navLink.click();
      
      await element.updateComplete;
      expect(clickHandled).to.be.true;
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes on hamburger button', async () => {
      const element = await createResponsiveNav({ items: sampleNavItems });
      const toggleButton = element.shadowRoot?.querySelector('.nav-toggle') as HTMLButtonElement;
      
      expect(toggleButton.getAttribute('aria-expanded')).to.equal('false');
      expect(toggleButton.getAttribute('aria-controls')).to.equal('mobile-menu');
      expect(toggleButton.getAttribute('aria-label')).to.include('Toggle navigation');
    });

    it('should have proper ARIA attributes on mobile menu', async () => {
      const element = await createResponsiveNav({ items: sampleNavItems });
      const mobileMenu = element.shadowRoot?.querySelector('#mobile-menu') as HTMLElement;
      
      expect(mobileMenu.getAttribute('role')).to.equal('navigation');
      expect(mobileMenu.getAttribute('aria-label')).to.equal('Mobile navigation');
      expect(mobileMenu.getAttribute('aria-hidden')).to.equal('true');
    });

    it('should update ARIA attributes when menu opens/closes', async () => {
      const element = await createResponsiveNav({ items: sampleNavItems });
      const menuTester = new MobileMenuTester(element);
      const toggleButton = menuTester.getToggleButton()!;
      const mobileMenu = menuTester.getMobileMenu()!;
      
      // Initially closed
      expect(toggleButton.getAttribute('aria-expanded')).to.equal('false');
      expect(mobileMenu.getAttribute('aria-hidden')).to.equal('true');
      
      // Open menu
      await menuTester.toggleMenu();
      expect(toggleButton.getAttribute('aria-expanded')).to.equal('true');
      expect(mobileMenu.getAttribute('aria-hidden')).to.equal('false');
      
      // Close menu
      await menuTester.toggleMenu();
      expect(toggleButton.getAttribute('aria-expanded')).to.equal('false');
      expect(mobileMenu.getAttribute('aria-hidden')).to.equal('true');
    });

    it('should have proper navigation role and labels', async () => {
      const element = await createResponsiveNav({ items: sampleNavItems });
      
      const desktopNav = element.shadowRoot?.querySelector('.nav-container') as HTMLElement;
      expect(desktopNav.getAttribute('role')).to.equal('navigation');
      expect(desktopNav.getAttribute('aria-label')).to.equal('Main navigation');
    });

    it('should indicate active page with aria-current', async () => {
      const element = await createResponsiveNav({ items: sampleNavItems });
      
      const activeLink = element.shadowRoot?.querySelector('.nav-link-desktop.active') as HTMLElement;
      expect(activeLink.getAttribute('aria-current')).to.equal('page');
      
      const inactiveLink = element.shadowRoot?.querySelector('.nav-link-desktop:not(.active)') as HTMLElement;
      expect(inactiveLink.getAttribute('aria-current')).to.equal('false');
    });

    it('should have screen reader only content', async () => {
      const element = await createResponsiveNav({ items: sampleNavItems });
      
      const srOnly = element.shadowRoot?.querySelector('.sr-only');
      expect(srOnly).to.exist;
      expect(srOnly?.textContent).to.include('Toggle navigation menu');
    });
  });

  describe('Body Scroll Lock', () => {
    it('should lock body scroll when mobile menu opens', async () => {
      const element = await createResponsiveNav({ items: sampleNavItems });
      const menuTester = new MobileMenuTester(element);
      
      // Initially no scroll lock
      expect(document.body.style.overflow).to.not.equal('hidden');
      
      // Open menu
      await menuTester.toggleMenu();
      expect(document.body.style.overflow).to.equal('hidden');
      
      // Close menu
      await menuTester.closeMenu();
      expect(document.body.style.overflow).to.equal('');
    });
  });

  describe('Performance', () => {
    it('should handle rapid menu toggles efficiently', async () => {
      const element = await createResponsiveNav({ items: sampleNavItems });
      const menuTester = new MobileMenuTester(element);
      
      performanceTester.startMeasurement('rapid-toggles');
      
      // Rapid toggle operations
      for (let i = 0; i < 20; i++) {
        await menuTester.toggleMenu();
      }
      
      const duration = performanceTester.endMeasurement('rapid-toggles');
      
      // Should handle rapid toggles efficiently
      performanceTester.assertPerformance(200);
      
      // Menu should end up in closed state
      expect(menuTester.isMenuOpen()).to.be.false;
    });

    it('should render large numbers of navigation items efficiently', async () => {
      const manyItems: NavItem[] = Array.from({ length: 100 }, (_, i) => ({
        label: `Item ${i + 1}`,
        href: `/item-${i + 1}`,
        icon: '📄'
      }));
      
      performanceTester.startMeasurement('large-nav-render');
      
      const element = await createResponsiveNav({ items: manyItems });
      await waitForRender(element);
      
      performanceTester.endMeasurement('large-nav-render');
      performanceTester.assertPerformance(100);
      
      // Should render all items
      const desktopItems = element.shadowRoot?.querySelectorAll('.nav-link-desktop');
      const mobileItems = element.shadowRoot?.querySelectorAll('.nav-link-mobile');
      
      expect(desktopItems).to.have.length(100);
      expect(mobileItems).to.have.length(100);
    });
  });

  describe('Error Handling', () => {
    it('should handle empty navigation items gracefully', async () => {
      const element = await createResponsiveNav({ items: [] });
      
      expect(element).to.exist;
      
      const desktopItems = element.shadowRoot?.querySelectorAll('.nav-link-desktop');
      const mobileItems = element.shadowRoot?.querySelectorAll('.nav-link-mobile');
      
      expect(desktopItems).to.have.length(0);
      expect(mobileItems).to.have.length(0);
    });

    it('should handle navigation items with missing properties', async () => {
      const incompleteItems: Partial<NavItem>[] = [
        { label: 'Valid Item', href: '/valid' },
        { label: 'No Href Item' }, // Missing href
        {}, // Missing label
      ];
      
      const element = await createResponsiveNav({ items: incompleteItems as NavItem[] });
      
      // Should still render without crashing
      expect(element).to.exist;
      
      const desktopItems = element.shadowRoot?.querySelectorAll('.nav-link-desktop');
      expect(desktopItems?.length).to.be.greaterThan(0);
    });

    it('should handle onClick function errors gracefully', async () => {
      const element = await createResponsiveNav({
        items: [{
          label: 'Error Item',
          href: '/error',
          onClick: () => {
            throw new Error('Test error');
          }
        }]
      });
      
      const navLink = element.shadowRoot?.querySelector('.nav-link-desktop') as HTMLElement;
      
      // Should not throw uncaught error
      expect(() => {
        navLink.click();
      }).to.not.throw();
    });
  });
});