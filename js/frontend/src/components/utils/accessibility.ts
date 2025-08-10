/**
 * Accessibility utilities for Lit components
 * Provides WCAG 2.1 Level AA compliant patterns and helpers
 */

/**
 * ARIA attributes and roles commonly used in session components
 */
export const AriaRoles = {
  // Navigation and structure
  MAIN: 'main',
  NAVIGATION: 'navigation',
  BANNER: 'banner',
  CONTENTINFO: 'contentinfo',
  REGION: 'region',
  ARTICLE: 'article',
  
  // Lists and items
  LIST: 'list',
  LISTBOX: 'listbox',
  LISTITEM: 'listitem',
  OPTION: 'option',
  GROUP: 'group',
  
  // Interactive elements
  BUTTON: 'button',
  LINK: 'link',
  TAB: 'tab',
  TABLIST: 'tablist',
  TABPANEL: 'tabpanel',
  MENU: 'menu',
  MENUITEM: 'menuitem',
  MENUBAR: 'menubar',
  
  // Form elements
  TEXTBOX: 'textbox',
  SEARCHBOX: 'searchbox',
  COMBOBOX: 'combobox',
  CHECKBOX: 'checkbox',
  RADIO: 'radio',
  RADIOGROUP: 'radiogroup',
  
  // Status and feedback
  STATUS: 'status',
  ALERT: 'alert',
  ALERTDIALOG: 'alertdialog',
  LOG: 'log',
  PROGRESSBAR: 'progressbar',
  
  // Content
  DOCUMENT: 'document',
  APPLICATION: 'application',
  DIALOG: 'dialog',
  TOOLTIP: 'tooltip',
  
  // Data display
  TABLE: 'table',
  ROW: 'row',
  CELL: 'cell',
  COLUMNHEADER: 'columnheader',
  ROWHEADER: 'rowheader',
  GRID: 'grid',
  GRIDCELL: 'gridcell'
} as const;

/**
 * ARIA states and properties
 */
export const AriaAttributes = {
  // States
  EXPANDED: 'aria-expanded',
  SELECTED: 'aria-selected',
  CHECKED: 'aria-checked',
  PRESSED: 'aria-pressed',
  HIDDEN: 'aria-hidden',
  DISABLED: 'aria-disabled',
  CURRENT: 'aria-current',
  
  // Properties
  LABEL: 'aria-label',
  LABELLEDBY: 'aria-labelledby',
  DESCRIBEDBY: 'aria-describedby',
  LIVE: 'aria-live',
  ATOMIC: 'aria-atomic',
  RELEVANT: 'aria-relevant',
  
  // Relationships
  OWNS: 'aria-owns',
  CONTROLS: 'aria-controls',
  ACTIVEDESCENDANT: 'aria-activedescendant',
  FLOWTO: 'aria-flowto',
  
  // Values
  VALUEMIN: 'aria-valuemin',
  VALUEMAX: 'aria-valuemax',
  VALUENOW: 'aria-valuenow',
  VALUETEXT: 'aria-valuetext',
  
  // Form
  REQUIRED: 'aria-required',
  INVALID: 'aria-invalid',
  READONLY: 'aria-readonly',
  
  // Grid/table
  COLCOUNT: 'aria-colcount',
  ROWCOUNT: 'aria-rowcount',
  COLINDEX: 'aria-colindex',
  ROWINDEX: 'aria-rowindex',
  COLSPAN: 'aria-colspan',
  ROWSPAN: 'aria-rowspan',
  
  // Navigation
  POSINSET: 'aria-posinset',
  SETSIZE: 'aria-setsize',
  LEVEL: 'aria-level'
} as const;

/**
 * Live region politeness levels
 */
export const LiveRegionPoliteness = {
  OFF: 'off',
  POLITE: 'polite',
  ASSERTIVE: 'assertive'
} as const;

/**
 * Keyboard navigation key codes and helpers
 */
export const KeyboardKeys = {
  ENTER: 'Enter',
  SPACE: ' ',
  ARROW_UP: 'ArrowUp',
  ARROW_DOWN: 'ArrowDown',
  ARROW_LEFT: 'ArrowLeft',
  ARROW_RIGHT: 'ArrowRight',
  TAB: 'Tab',
  ESCAPE: 'Escape',
  HOME: 'Home',
  END: 'End',
  PAGE_UP: 'PageUp',
  PAGE_DOWN: 'PageDown',
  DELETE: 'Delete',
  BACKSPACE: 'Backspace'
} as const;

/**
 * Focus management utilities
 */
export class FocusManager {
  /**
   * Get all focusable elements within a container
   */
  static getFocusableElements(container: Element | ShadowRoot): HTMLElement[] {
    const selector = [
      'button:not([disabled])',
      '[href]:not([disabled])', 
      'input:not([disabled]):not([type="hidden"])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"]):not([disabled])',
      '[contenteditable="true"]:not([disabled])'
    ].join(', ');
    
    return Array.from(container.querySelectorAll(selector)) as HTMLElement[];
  }
  
  /**
   * Focus the first focusable element in a container
   */
  static focusFirst(container: Element | ShadowRoot): boolean {
    const elements = this.getFocusableElements(container);
    if (elements.length > 0) {
      elements[0].focus();
      return true;
    }
    return false;
  }
  
  /**
   * Focus the last focusable element in a container
   */
  static focusLast(container: Element | ShadowRoot): boolean {
    const elements = this.getFocusableElements(container);
    if (elements.length > 0) {
      elements[elements.length - 1].focus();
      return true;
    }
    return false;
  }
  
  /**
   * Get the next focusable element after the current one
   */
  static getNext(container: Element | ShadowRoot, current: HTMLElement): HTMLElement | null {
    const elements = this.getFocusableElements(container);
    const currentIndex = elements.indexOf(current);
    
    if (currentIndex === -1 || currentIndex === elements.length - 1) {
      return elements[0] || null; // Wrap to first
    }
    
    return elements[currentIndex + 1] || null;
  }
  
  /**
   * Get the previous focusable element before the current one
   */
  static getPrevious(container: Element | ShadowRoot, current: HTMLElement): HTMLElement | null {
    const elements = this.getFocusableElements(container);
    const currentIndex = elements.indexOf(current);
    
    if (currentIndex <= 0) {
      return elements[elements.length - 1] || null; // Wrap to last
    }
    
    return elements[currentIndex - 1] || null;
  }
  
  /**
   * Trap focus within a container (for modal dialogs, etc.)
   */
  static trapFocus(container: Element | ShadowRoot, event: KeyboardEvent): boolean {
    if (event.key !== KeyboardKeys.TAB) return false;
    
    const elements = this.getFocusableElements(container);
    if (elements.length === 0) return false;
    
    const firstElement = elements[0];
    const lastElement = elements[elements.length - 1];
    const activeElement = container.ownerDocument?.activeElement as HTMLElement;
    
    if (event.shiftKey) {
      // Shift+Tab: moving backwards
      if (activeElement === firstElement || !elements.includes(activeElement)) {
        lastElement.focus();
        event.preventDefault();
        return true;
      }
    } else {
      // Tab: moving forwards
      if (activeElement === lastElement || !elements.includes(activeElement)) {
        firstElement.focus();
        event.preventDefault();
        return true;
      }
    }
    
    return false;
  }
}

/**
 * Keyboard navigation helpers for lists and grids
 */
export class ListNavigation {
  /**
   * Handle arrow key navigation in a list
   */
  static handleArrowKeys(
    event: KeyboardEvent,
    container: Element | ShadowRoot,
    currentItem: HTMLElement,
    options: {
      vertical?: boolean;
      horizontal?: boolean;
      wrap?: boolean;
      home?: boolean;
      end?: boolean;
    } = { vertical: true, wrap: true, home: true, end: true }
  ): boolean {
    const { vertical = true, horizontal = false, wrap = true, home = true, end = true } = options;
    const elements = FocusManager.getFocusableElements(container);
    const currentIndex = elements.indexOf(currentItem);
    
    if (currentIndex === -1) return false;
    
    let targetIndex = currentIndex;
    let handled = false;
    
    switch (event.key) {
      case KeyboardKeys.ARROW_DOWN:
        if (vertical) {
          targetIndex = currentIndex + 1;
          if (targetIndex >= elements.length) {
            targetIndex = wrap ? 0 : elements.length - 1;
          }
          handled = true;
        }
        break;
        
      case KeyboardKeys.ARROW_UP:
        if (vertical) {
          targetIndex = currentIndex - 1;
          if (targetIndex < 0) {
            targetIndex = wrap ? elements.length - 1 : 0;
          }
          handled = true;
        }
        break;
        
      case KeyboardKeys.ARROW_RIGHT:
        if (horizontal) {
          targetIndex = currentIndex + 1;
          if (targetIndex >= elements.length) {
            targetIndex = wrap ? 0 : elements.length - 1;
          }
          handled = true;
        }
        break;
        
      case KeyboardKeys.ARROW_LEFT:
        if (horizontal) {
          targetIndex = currentIndex - 1;
          if (targetIndex < 0) {
            targetIndex = wrap ? elements.length - 1 : 0;
          }
          handled = true;
        }
        break;
        
      case KeyboardKeys.HOME:
        if (home) {
          targetIndex = 0;
          handled = true;
        }
        break;
        
      case KeyboardKeys.END:
        if (end) {
          targetIndex = elements.length - 1;
          handled = true;
        }
        break;
    }
    
    if (handled && targetIndex !== currentIndex) {
      elements[targetIndex]?.focus();
      event.preventDefault();
      return true;
    }
    
    return false;
  }
}

/**
 * Live region announcer for screen readers
 */
export class LiveAnnouncer {
  private static instance: LiveAnnouncer;
  private politeElement: HTMLElement;
  private assertiveElement: HTMLElement;
  
  private constructor() {
    // Create live region elements if they don't exist
    this.politeElement = document.getElementById('live-announcer-polite') as HTMLElement;
    this.assertiveElement = document.getElementById('live-announcer-assertive') as HTMLElement;
    
    if (!this.politeElement) {
      this.politeElement = document.createElement('div');
      this.politeElement.id = 'live-announcer-polite';
      this.politeElement.setAttribute('aria-live', 'polite');
      this.politeElement.setAttribute('aria-atomic', 'true');
      this.politeElement.style.position = 'absolute';
      this.politeElement.style.left = '-10000px';
      this.politeElement.style.width = '1px';
      this.politeElement.style.height = '1px';
      this.politeElement.style.overflow = 'hidden';
      document.body.appendChild(this.politeElement);
    }
    
    if (!this.assertiveElement) {
      this.assertiveElement = document.createElement('div');
      this.assertiveElement.id = 'live-announcer-assertive';
      this.assertiveElement.setAttribute('aria-live', 'assertive');
      this.assertiveElement.setAttribute('aria-atomic', 'true');
      this.assertiveElement.style.position = 'absolute';
      this.assertiveElement.style.left = '-10000px';
      this.assertiveElement.style.width = '1px';
      this.assertiveElement.style.height = '1px';
      this.assertiveElement.style.overflow = 'hidden';
      document.body.appendChild(this.assertiveElement);
    }
  }
  
  static getInstance(): LiveAnnouncer {
    if (!LiveAnnouncer.instance) {
      LiveAnnouncer.instance = new LiveAnnouncer();
    }
    return LiveAnnouncer.instance;
  }
  
  /**
   * Announce a message to screen readers
   */
  announce(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
    const element = priority === 'assertive' ? this.assertiveElement : this.politeElement;
    
    // Clear previous message
    element.textContent = '';
    
    // Set new message after a brief delay to ensure screen readers detect the change
    setTimeout(() => {
      element.textContent = message;
    }, 10);
  }
  
  /**
   * Clear all announcements
   */
  clear(): void {
    this.politeElement.textContent = '';
    this.assertiveElement.textContent = '';
  }
}

/**
 * Accessibility testing helpers for development
 */
export class A11yTesting {
  /**
   * Check if an element has proper accessibility attributes
   */
  static checkElement(element: Element): string[] {
    const issues: string[] = [];
    
    // Check for buttons without accessible names
    if (element.tagName === 'BUTTON' || element.getAttribute('role') === 'button') {
      if (!this.hasAccessibleName(element)) {
        issues.push('Button missing accessible name (aria-label, aria-labelledby, or text content)');
      }
    }
    
    // Check for links without accessible names
    if (element.tagName === 'A' || element.getAttribute('role') === 'link') {
      if (!this.hasAccessibleName(element)) {
        issues.push('Link missing accessible name');
      }
    }
    
    // Check for images without alt text
    if (element.tagName === 'IMG') {
      const img = element as HTMLImageElement;
      if (!img.alt && !element.hasAttribute('aria-label')) {
        issues.push('Image missing alt text or aria-label');
      }
    }
    
    // Check for interactive elements without keyboard access
    if (this.isInteractive(element) && !this.isKeyboardAccessible(element)) {
      issues.push('Interactive element not keyboard accessible');
    }
    
    return issues;
  }
  
  private static hasAccessibleName(element: Element): boolean {
    return !!(
      element.getAttribute('aria-label') ||
      element.getAttribute('aria-labelledby') ||
      element.textContent?.trim() ||
      (element as HTMLInputElement).value
    );
  }
  
  private static isInteractive(element: Element): boolean {
    const interactiveTags = ['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA'];
    const interactiveRoles = ['button', 'link', 'textbox', 'combobox', 'listbox', 'menu', 'menuitem'];
    
    return interactiveTags.includes(element.tagName) ||
           interactiveRoles.includes(element.getAttribute('role') || '') ||
           element.hasAttribute('onclick') ||
           element.hasAttribute('tabindex');
  }
  
  private static isKeyboardAccessible(element: Element): boolean {
    const tabindex = element.getAttribute('tabindex');
    return tabindex !== '-1' && (
      element.tagName === 'BUTTON' ||
      element.tagName === 'A' ||
      element.tagName === 'INPUT' ||
      element.tagName === 'SELECT' ||
      element.tagName === 'TEXTAREA' ||
      tabindex !== null
    );
  }
}

/**
 * Accessibility configuration constants
 */
export const A11yConfig = {
  FOCUS_RING_COLOR: 'var(--color-border-focus)',
  FOCUS_RING_WIDTH: '0.2rem',
  MIN_TOUCH_TARGET: '44px',
  MIN_COLOR_CONTRAST: 4.5, // WCAG AA standard
  ANIMATION_DURATION_LIMIT: 5000, // ms
  
  // Common ARIA label patterns
  LABELS: {
    CLOSE: 'Close',
    EXPAND: 'Expand',
    COLLAPSE: 'Collapse',
    LOADING: 'Loading',
    ERROR: 'Error',
    SUCCESS: 'Success',
    MENU: 'Menu',
    SEARCH: 'Search',
    FILTER: 'Filter',
    SORT: 'Sort',
    PREVIOUS: 'Previous',
    NEXT: 'Next',
    PAGE: 'Page',
    OF: 'of',
    SELECTED: 'Selected',
    REQUIRED: 'Required field',
    OPTIONAL: 'Optional field'
  }
} as const;

/**
 * Generate unique IDs for aria-labelledby and aria-describedby
 */
export function generateId(prefix: string = 'a11y'): string {
  return `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create an accessible announcement message
 */
export function announce(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
  LiveAnnouncer.getInstance().announce(message, priority);
}