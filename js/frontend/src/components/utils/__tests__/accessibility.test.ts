import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fixture, html } from '@open-wc/testing';
import { 
  AriaRoles, 
  AriaAttributes, 
  KeyboardKeys, 
  FocusManager, 
  ListNavigation,
  LiveAnnouncer, 
  A11yTesting,
  A11yConfig,
  generateId,
  announce 
} from '../accessibility';

describe('Accessibility Utilities', () => {
  describe('AriaRoles', () => {
    it('should define standard ARIA roles', () => {
      expect(AriaRoles.MAIN).toBe('main');
      expect(AriaRoles.NAVIGATION).toBe('navigation');
      expect(AriaRoles.BUTTON).toBe('button');
      expect(AriaRoles.LIST).toBe('list');
      expect(AriaRoles.LISTITEM).toBe('listitem');
      expect(AriaRoles.STATUS).toBe('status');
      expect(AriaRoles.ALERT).toBe('alert');
    });
  });

  describe('AriaAttributes', () => {
    it('should define standard ARIA attributes', () => {
      expect(AriaAttributes.EXPANDED).toBe('aria-expanded');
      expect(AriaAttributes.LABEL).toBe('aria-label');
      expect(AriaAttributes.LABELLEDBY).toBe('aria-labelledby');
      expect(AriaAttributes.DESCRIBEDBY).toBe('aria-describedby');
      expect(AriaAttributes.HIDDEN).toBe('aria-hidden');
      expect(AriaAttributes.LIVE).toBe('aria-live');
    });
  });

  describe('KeyboardKeys', () => {
    it('should define standard keyboard keys', () => {
      expect(KeyboardKeys.ENTER).toBe('Enter');
      expect(KeyboardKeys.SPACE).toBe(' ');
      expect(KeyboardKeys.ESCAPE).toBe('Escape');
      expect(KeyboardKeys.ARROW_UP).toBe('ArrowUp');
      expect(KeyboardKeys.ARROW_DOWN).toBe('ArrowDown');
      expect(KeyboardKeys.TAB).toBe('Tab');
    });
  });

  describe('FocusManager', () => {
    let testContainer: HTMLDivElement;

    beforeEach(() => {
      testContainer = document.createElement('div');
      testContainer.innerHTML = `
        <button id="btn1">Button 1</button>
        <input id="input1" type="text" />
        <a href="#" id="link1">Link 1</a>
        <button disabled id="btn2">Disabled Button</button>
        <div tabindex="0" id="div1">Focusable Div</div>
      `;
      document.body.appendChild(testContainer);
    });

    afterEach(() => {
      document.body.removeChild(testContainer);
    });

    it('should get focusable elements', () => {
      const elements = FocusManager.getFocusableElements(testContainer);
      expect(elements).toHaveLength(4); // button, input, link, focusable div (disabled button excluded)
      expect(elements.map(el => el.id)).toEqual(['btn1', 'input1', 'link1', 'div1']);
    });

    it('should focus first element', () => {
      const success = FocusManager.focusFirst(testContainer);
      expect(success).toBe(true);
      expect(document.activeElement?.id).toBe('btn1');
    });

    it('should focus last element', () => {
      const success = FocusManager.focusLast(testContainer);
      expect(success).toBe(true);
      expect(document.activeElement?.id).toBe('div1');
    });

    it('should get next focusable element', () => {
      const button1 = testContainer.querySelector('#btn1') as HTMLElement;
      const next = FocusManager.getNext(testContainer, button1);
      expect(next?.id).toBe('input1');
    });

    it('should wrap to first when getting next from last', () => {
      const div1 = testContainer.querySelector('#div1') as HTMLElement;
      const next = FocusManager.getNext(testContainer, div1);
      expect(next?.id).toBe('btn1');
    });

    it('should get previous focusable element', () => {
      const input1 = testContainer.querySelector('#input1') as HTMLElement;
      const prev = FocusManager.getPrevious(testContainer, input1);
      expect(prev?.id).toBe('btn1');
    });

    it('should trap focus within container', () => {
      const mockEvent = {
        key: 'Tab',
        shiftKey: false,
        preventDefault: vi.fn()
      } as unknown as KeyboardEvent;

      // Focus last element
      const div1 = testContainer.querySelector('#div1') as HTMLElement;
      div1.focus();

      const trapped = FocusManager.trapFocus(testContainer, mockEvent);
      expect(trapped).toBe(true);
      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(document.activeElement?.id).toBe('btn1'); // Should wrap to first
    });
  });

  describe('ListNavigation', () => {
    let testContainer: HTMLDivElement;
    let items: HTMLElement[];

    beforeEach(() => {
      testContainer = document.createElement('div');
      testContainer.innerHTML = `
        <button id="item1">Item 1</button>
        <button id="item2">Item 2</button>
        <button id="item3">Item 3</button>
      `;
      document.body.appendChild(testContainer);
      items = Array.from(testContainer.querySelectorAll('button'));
    });

    afterEach(() => {
      document.body.removeChild(testContainer);
    });

    it('should navigate down with arrow keys', () => {
      const mockEvent = {
        key: 'ArrowDown',
        preventDefault: vi.fn()
      } as unknown as KeyboardEvent;

      items[0].focus();
      const handled = ListNavigation.handleArrowKeys(mockEvent, testContainer, items[0]);
      
      expect(handled).toBe(true);
      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(document.activeElement?.id).toBe('item2');
    });

    it('should wrap to first when navigating down from last', () => {
      const mockEvent = {
        key: 'ArrowDown',
        preventDefault: vi.fn()
      } as unknown as KeyboardEvent;

      items[2].focus();
      const handled = ListNavigation.handleArrowKeys(mockEvent, testContainer, items[2], { wrap: true });
      
      expect(handled).toBe(true);
      expect(document.activeElement?.id).toBe('item1');
    });

    it('should navigate up with arrow keys', () => {
      const mockEvent = {
        key: 'ArrowUp',
        preventDefault: vi.fn()
      } as unknown as KeyboardEvent;

      items[1].focus();
      const handled = ListNavigation.handleArrowKeys(mockEvent, testContainer, items[1]);
      
      expect(handled).toBe(true);
      expect(document.activeElement?.id).toBe('item1');
    });

    it('should navigate to first with Home key', () => {
      const mockEvent = {
        key: 'Home',
        preventDefault: vi.fn()
      } as unknown as KeyboardEvent;

      items[1].focus();
      const handled = ListNavigation.handleArrowKeys(mockEvent, testContainer, items[1]);
      
      expect(handled).toBe(true);
      expect(document.activeElement?.id).toBe('item1');
    });

    it('should navigate to last with End key', () => {
      const mockEvent = {
        key: 'End',
        preventDefault: vi.fn()
      } as unknown as KeyboardEvent;

      items[0].focus();
      const handled = ListNavigation.handleArrowKeys(mockEvent, testContainer, items[0]);
      
      expect(handled).toBe(true);
      expect(document.activeElement?.id).toBe('item3');
    });
  });

  describe('LiveAnnouncer', () => {
    beforeEach(() => {
      // Clean up any existing live regions
      const existing = document.querySelectorAll('[id*="live-announcer"]');
      existing.forEach(el => el.remove());
    });

    it('should create live region elements', () => {
      const announcer = LiveAnnouncer.getInstance();
      
      // Check that elements were created
      const politeElement = document.getElementById('live-announcer-polite');
      const assertiveElement = document.getElementById('live-announcer-assertive');
      
      expect(politeElement).not.toBeNull();
      expect(assertiveElement).not.toBeNull();
      expect(politeElement?.getAttribute('aria-live')).toBe('polite');
      expect(assertiveElement?.getAttribute('aria-live')).toBe('assertive');
    });

    it('should announce messages', async () => {
      const announcer = LiveAnnouncer.getInstance();
      const politeElement = document.getElementById('live-announcer-polite');
      
      announcer.announce('Test message', 'polite');
      
      // Wait for the timeout to set the message
      await new Promise(resolve => setTimeout(resolve, 20));
      
      expect(politeElement?.textContent).toBe('Test message');
    });

    it('should clear messages', async () => {
      const announcer = LiveAnnouncer.getInstance();
      
      announcer.announce('Test message', 'polite');
      await new Promise(resolve => setTimeout(resolve, 20));
      
      announcer.clear();
      
      const politeElement = document.getElementById('live-announcer-polite');
      const assertiveElement = document.getElementById('live-announcer-assertive');
      
      expect(politeElement?.textContent).toBe('');
      expect(assertiveElement?.textContent).toBe('');
    });
  });

  describe('A11yTesting', () => {
    it('should detect buttons without accessible names', () => {
      const button = document.createElement('button');
      const issues = A11yTesting.checkElement(button);
      expect(issues).toContain('Button missing accessible name (aria-label, aria-labelledby, or text content)');
    });

    it('should not flag buttons with text content', () => {
      const button = document.createElement('button');
      button.textContent = 'Click me';
      const issues = A11yTesting.checkElement(button);
      expect(issues).not.toContain('Button missing accessible name (aria-label, aria-labelledby, or text content)');
    });

    it('should not flag buttons with aria-label', () => {
      const button = document.createElement('button');
      button.setAttribute('aria-label', 'Close dialog');
      const issues = A11yTesting.checkElement(button);
      expect(issues).not.toContain('Button missing accessible name (aria-label, aria-labelledby, or text content)');
    });

    it('should detect images without alt text', () => {
      const img = document.createElement('img');
      img.src = 'test.jpg';
      const issues = A11yTesting.checkElement(img);
      expect(issues).toContain('Image missing alt text or aria-label');
    });

    it('should not flag images with alt text', () => {
      const img = document.createElement('img');
      img.src = 'test.jpg';
      img.alt = 'A test image';
      const issues = A11yTesting.checkElement(img);
      expect(issues).not.toContain('Image missing alt text or aria-label');
    });
  });

  describe('A11yConfig', () => {
    it('should define configuration constants', () => {
      expect(A11yConfig.MIN_COLOR_CONTRAST).toBe(4.5);
      expect(A11yConfig.MIN_TOUCH_TARGET).toBe('44px');
      expect(A11yConfig.LABELS.CLOSE).toBe('Close');
      expect(A11yConfig.LABELS.EXPAND).toBe('Expand');
      expect(A11yConfig.LABELS.LOADING).toBe('Loading');
    });
  });

  describe('generateId', () => {
    it('should generate unique IDs', () => {
      const id1 = generateId('test');
      const id2 = generateId('test');
      
      expect(id1).toMatch(/^test-\w{9}$/);
      expect(id2).toMatch(/^test-\w{9}$/);
      expect(id1).not.toBe(id2);
    });

    it('should use default prefix if none provided', () => {
      const id = generateId();
      expect(id).toMatch(/^a11y-\w{9}$/);
    });
  });

  describe('announce', () => {
    it('should use LiveAnnouncer', async () => {
      const spy = vi.spyOn(LiveAnnouncer.getInstance(), 'announce');
      
      announce('Test message', 'assertive');
      
      expect(spy).toHaveBeenCalledWith('Test message', 'assertive');
      spy.mockRestore();
    });
  });
});