import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  GlobalFocusManager,
  useFocusManagement,
  SkipLinkManager,
  FocusableRegion 
} from '../focus-management';

describe('Focus Management System', () => {
  let focusManager: GlobalFocusManager;
  let testContainer1: HTMLDivElement;
  let testContainer2: HTMLDivElement;

  beforeEach(() => {
    focusManager = GlobalFocusManager.getInstance();
    
    // Create test containers
    testContainer1 = document.createElement('div');
    testContainer1.id = 'region1';
    testContainer1.innerHTML = '<button>Button 1</button><input type="text" />';
    document.body.appendChild(testContainer1);

    testContainer2 = document.createElement('div');
    testContainer2.id = 'region2';  
    testContainer2.innerHTML = '<button>Button 2</button><a href="#">Link</a>';
    document.body.appendChild(testContainer2);
  });

  afterEach(() => {
    // Clean up
    focusManager.unregisterRegion('region1');
    focusManager.unregisterRegion('region2');
    focusManager.unregisterRegion('modal1');
    
    document.body.removeChild(testContainer1);
    document.body.removeChild(testContainer2);
  });

  describe('GlobalFocusManager', () => {
    it('should register and unregister regions', () => {
      const region: FocusableRegion = {
        id: 'region1',
        element: testContainer1,
        priority: 1
      };

      focusManager.registerRegion(region);
      // We can't directly test the private map, but we can test navigation
      expect(() => focusManager.navigateToRegion('next')).not.toThrow();

      focusManager.unregisterRegion('region1');
      expect(() => focusManager.navigateToRegion('next')).not.toThrow();
    });

    it('should handle modal stack', () => {
      const region: FocusableRegion = {
        id: 'modal1',
        element: testContainer1,
        priority: 1
      };

      focusManager.registerRegion(region);
      
      expect(focusManager.isInModal()).toBe(false);
      expect(focusManager.getCurrentModal()).toBe(null);

      focusManager.pushModal('modal1');
      
      expect(focusManager.isInModal()).toBe(true);
      expect(focusManager.getCurrentModal()).toBe('modal1');

      focusManager.popModal('modal1');
      
      expect(focusManager.isInModal()).toBe(false);
      expect(focusManager.getCurrentModal()).toBe(null);
    });

    it('should navigate between regions', () => {
      const region1: FocusableRegion = {
        id: 'region1',
        element: testContainer1,
        priority: 1
      };

      const region2: FocusableRegion = {
        id: 'region2', 
        element: testContainer2,
        priority: 2
      };

      focusManager.registerRegion(region1);
      focusManager.registerRegion(region2);

      const success = focusManager.navigateToRegion('first');
      expect(success).toBe(true);
      
      // Should focus first focusable element in first region
      expect(document.activeElement?.tagName).toBe('BUTTON');
      expect(document.activeElement?.textContent).toBe('Button 1');
    });

    it('should not allow region navigation while in modal', () => {
      const region: FocusableRegion = {
        id: 'modal1',
        element: testContainer1,
        priority: 1
      };

      focusManager.registerRegion(region);
      focusManager.pushModal('modal1');

      const success = focusManager.navigateToRegion('next');
      expect(success).toBe(false);
    });

    it('should focus element with options', () => {
      const button = testContainer1.querySelector('button') as HTMLElement;
      const spy = vi.spyOn(button, 'focus');

      focusManager.focusElement(button, 'Test announcement', {
        preventScroll: true,
        focusVisible: true
      });

      expect(spy).toHaveBeenCalledWith({ preventScroll: true });
      expect(button.classList.contains('focus-visible')).toBe(true);

      // Focus-visible should be removed after timeout
      setTimeout(() => {
        expect(button.classList.contains('focus-visible')).toBe(false);
      }, 200);

      spy.mockRestore();
    });
  });

  describe('useFocusManagement hook', () => {
    it('should return focus management interface', () => {
      const hook = useFocusManagement('test-region', testContainer1, 1);

      expect(hook).toHaveProperty('register');
      expect(hook).toHaveProperty('unregister');
      expect(hook).toHaveProperty('pushModal');
      expect(hook).toHaveProperty('popModal');

      expect(typeof hook.register).toBe('function');
      expect(typeof hook.unregister).toBe('function');
      expect(typeof hook.pushModal).toBe('function');
      expect(typeof hook.popModal).toBe('function');
    });

    it('should register and unregister through hook', () => {
      const hook = useFocusManagement('test-region', testContainer1, 1);

      expect(() => hook.register()).not.toThrow();
      expect(() => hook.unregister()).not.toThrow();
    });

    it('should handle modal operations through hook', () => {
      const hook = useFocusManagement('test-modal', testContainer1, 1);

      hook.register();
      
      expect(() => hook.pushModal()).not.toThrow();
      expect(focusManager.getCurrentModal()).toBe('test-modal');
      
      expect(() => hook.popModal()).not.toThrow();
      expect(focusManager.getCurrentModal()).toBe(null);
    });
  });

  describe('SkipLinkManager', () => {
    let skipManager: SkipLinkManager;

    beforeEach(() => {
      skipManager = SkipLinkManager.getInstance();
      // Clean up any existing skip links
      const existing = document.querySelector('.skip-links');
      if (existing) {
        existing.remove();
      }
    });

    afterEach(() => {
      skipManager.unregisterTarget('test-target');
      const skipLinks = document.querySelector('.skip-links');
      if (skipLinks) {
        skipLinks.remove();
      }
    });

    it('should register and create skip links', () => {
      const targetElement = testContainer1;
      targetElement.id = 'test-target';

      skipManager.registerTarget('test-target', targetElement, 'Skip to test content');

      const skipLinksContainer = document.querySelector('.skip-links');
      expect(skipLinksContainer).not.toBeNull();

      const skipLink = skipLinksContainer?.querySelector('a[href="#test-target"]');
      expect(skipLink).not.toBeNull();
      expect(skipLink?.textContent).toBe('Skip to test content');
    });

    it('should handle skip link interactions', () => {
      const targetElement = testContainer1;
      targetElement.id = 'test-target';

      skipManager.registerTarget('test-target', targetElement, 'Skip to test content');

      const skipLink = document.querySelector('a[href="#test-target"]') as HTMLElement;
      expect(skipLink).not.toBeNull();

      // Test focus behavior
      skipLink.focus();
      expect(skipLink.style.position).toBe('static');

      skipLink.blur();
      expect(skipLink.style.position).toBe('absolute');
    });

    it('should handle skip link click', () => {
      const targetElement = testContainer1;
      targetElement.id = 'test-target';
      const focusSpy = vi.spyOn(targetElement, 'focus');
      const scrollSpy = vi.spyOn(targetElement, 'scrollIntoView');

      skipManager.registerTarget('test-target', targetElement, 'Skip to test content');

      const skipLink = document.querySelector('a[href="#test-target"]') as HTMLElement;
      
      // Simulate click
      const clickEvent = new MouseEvent('click', { bubbles: true });
      skipLink.dispatchEvent(clickEvent);

      expect(focusSpy).toHaveBeenCalled();
      expect(scrollSpy).toHaveBeenCalledWith({ behavior: 'smooth' });

      focusSpy.mockRestore();
      scrollSpy.mockRestore();
    });

    it('should unregister skip links', () => {
      const targetElement = testContainer1;
      targetElement.id = 'test-target';

      skipManager.registerTarget('test-target', targetElement, 'Skip to test content');

      let skipLink = document.querySelector('a[href="#test-target"]');
      expect(skipLink).not.toBeNull();

      skipManager.unregisterTarget('test-target');

      skipLink = document.querySelector('a[href="#test-target"]');
      expect(skipLink).toBeNull();
    });
  });

  describe('Keyboard Event Handling', () => {
    let eventSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      eventSpy = vi.spyOn(document, 'addEventListener');
    });

    afterEach(() => {
      eventSpy.mockRestore();
    });

    it('should set up global keyboard listeners', () => {
      // Create a new instance to trigger constructor
      new (GlobalFocusManager as any)();

      expect(eventSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
      expect(eventSpy).toHaveBeenCalledWith('focusin', expect.any(Function));
    });
  });
});