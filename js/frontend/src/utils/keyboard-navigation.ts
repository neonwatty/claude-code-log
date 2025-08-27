/**
 * Keyboard Navigation Utilities
 * Provides WCAG-compliant keyboard navigation helpers
 */

export interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  metaKey?: boolean;
  handler: (event: KeyboardEvent) => void;
  description: string;
  global?: boolean;
}

export interface NavigableElement {
  element: HTMLElement;
  group?: string;
  priority?: number;
}

export class KeyboardNavigationManager {
  private static instance: KeyboardNavigationManager | null = null;
  private shortcuts = new Map<string, KeyboardShortcut>();
  private navigableElements = new Map<string, NavigableElement[]>();
  private currentGroup: string | null = null;
  private currentIndex = -1;
  private isListening = false;

  private constructor() {
    this.setupDefaultShortcuts();
  }

  public static getInstance(): KeyboardNavigationManager {
    if (!KeyboardNavigationManager.instance) {
      KeyboardNavigationManager.instance = new KeyboardNavigationManager();
    }
    return KeyboardNavigationManager.instance;
  }

  /**
   * Register a keyboard shortcut
   */
  public registerShortcut(shortcut: KeyboardShortcut): void {
    const key = this.getShortcutKey(shortcut);
    this.shortcuts.set(key, shortcut);
    
    if (!this.isListening) {
      this.startListening();
    }
  }

  /**
   * Unregister a keyboard shortcut
   */
  public unregisterShortcut(key: string, modifiers?: {
    ctrlKey?: boolean;
    altKey?: boolean;
    shiftKey?: boolean;
    metaKey?: boolean;
  }): void {
    const shortcutKey = this.buildShortcutKey(key, modifiers);
    this.shortcuts.delete(shortcutKey);
  }

  /**
   * Register navigable elements in a group
   */
  public registerNavigableGroup(
    groupName: string,
    elements: (HTMLElement | NavigableElement)[]
  ): void {
    const navigableElements = elements.map(el => 
      'element' in el 
        ? el 
        : { element: el, group: groupName }
    ).sort((a, b) => (a.priority || 0) - (b.priority || 0));

    this.navigableElements.set(groupName, navigableElements);
  }

  /**
   * Set the currently active navigation group
   */
  public setActiveGroup(groupName: string | null): void {
    this.currentGroup = groupName;
    this.currentIndex = -1;

    if (groupName && this.navigableElements.has(groupName)) {
      // Focus first element in group
      const elements = this.navigableElements.get(groupName)!;
      if (elements.length > 0) {
        this.currentIndex = 0;
        elements[0].element.focus();
      }
    }
  }

  /**
   * Navigate to next element in current group
   */
  public navigateNext(): boolean {
    if (!this.currentGroup || !this.navigableElements.has(this.currentGroup)) {
      return false;
    }

    const elements = this.navigableElements.get(this.currentGroup)!;
    if (elements.length === 0) return false;

    this.currentIndex = (this.currentIndex + 1) % elements.length;
    elements[this.currentIndex].element.focus();
    return true;
  }

  /**
   * Navigate to previous element in current group
   */
  public navigatePrevious(): boolean {
    if (!this.currentGroup || !this.navigableElements.has(this.currentGroup)) {
      return false;
    }

    const elements = this.navigableElements.get(this.currentGroup)!;
    if (elements.length === 0) return false;

    this.currentIndex = this.currentIndex <= 0 
      ? elements.length - 1 
      : this.currentIndex - 1;
    
    elements[this.currentIndex].element.focus();
    return true;
  }

  /**
   * Navigate to first element in current group
   */
  public navigateFirst(): boolean {
    if (!this.currentGroup || !this.navigableElements.has(this.currentGroup)) {
      return false;
    }

    const elements = this.navigableElements.get(this.currentGroup)!;
    if (elements.length === 0) return false;

    this.currentIndex = 0;
    elements[0].element.focus();
    return true;
  }

  /**
   * Navigate to last element in current group
   */
  public navigateLast(): boolean {
    if (!this.currentGroup || !this.navigableElements.has(this.currentGroup)) {
      return false;
    }

    const elements = this.navigableElements.get(this.currentGroup)!;
    if (elements.length === 0) return false;

    this.currentIndex = elements.length - 1;
    elements[this.currentIndex].element.focus();
    return true;
  }

  /**
   * Get help text for all registered shortcuts
   */
  public getShortcutHelp(): string[] {
    return Array.from(this.shortcuts.values()).map(shortcut => {
      const modifiers = [];
      if (shortcut.ctrlKey) modifiers.push('Ctrl');
      if (shortcut.altKey) modifiers.push('Alt');
      if (shortcut.shiftKey) modifiers.push('Shift');
      if (shortcut.metaKey) modifiers.push('Cmd');
      
      const keyCombo = [...modifiers, shortcut.key].join(' + ');
      return `${keyCombo}: ${shortcut.description}`;
    });
  }

  /**
   * Create roving tabindex navigation for a group
   */
  public createRovingTabindex(
    container: HTMLElement,
    selector: string = '[role="menuitem"], button, [tabindex]:not([tabindex="-1"])'
  ): void {
    const elements = Array.from(container.querySelectorAll(selector)) as HTMLElement[];
    
    if (elements.length === 0) return;

    // Set up initial tabindex values
    elements.forEach((el, index) => {
      el.setAttribute('tabindex', index === 0 ? '0' : '-1');
    });

    // Handle arrow key navigation
    container.addEventListener('keydown', (e) => {
      if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
        return;
      }

      const currentElement = document.activeElement as HTMLElement;
      const currentIndex = elements.indexOf(currentElement);
      
      if (currentIndex === -1) return;

      e.preventDefault();
      let nextIndex: number;

      switch (e.key) {
        case 'ArrowUp':
        case 'ArrowLeft':
          nextIndex = currentIndex > 0 ? currentIndex - 1 : elements.length - 1;
          break;
        case 'ArrowDown':
        case 'ArrowRight':
          nextIndex = currentIndex < elements.length - 1 ? currentIndex + 1 : 0;
          break;
        case 'Home':
          nextIndex = 0;
          break;
        case 'End':
          nextIndex = elements.length - 1;
          break;
        default:
          return;
      }

      // Update tabindex values
      elements[currentIndex].setAttribute('tabindex', '-1');
      elements[nextIndex].setAttribute('tabindex', '0');
      elements[nextIndex].focus();
    });
  }

  /**
   * Setup default WCAG shortcuts
   */
  private setupDefaultShortcuts(): void {
    // Skip to main content
    this.registerShortcut({
      key: 'm',
      altKey: true,
      handler: () => {
        const main = document.querySelector('main, [role="main"], #main-content');
        if (main instanceof HTMLElement) {
          main.focus();
          main.scrollIntoView({ behavior: 'smooth' });
        }
      },
      description: 'Skip to main content',
      global: true,
    });

    // Skip to navigation
    this.registerShortcut({
      key: 'n',
      altKey: true,
      handler: () => {
        const nav = document.querySelector('nav, [role="navigation"], #navigation');
        if (nav instanceof HTMLElement) {
          nav.focus();
          nav.scrollIntoView({ behavior: 'smooth' });
        }
      },
      description: 'Skip to navigation',
      global: true,
    });

    // Help/Keyboard shortcuts
    this.registerShortcut({
      key: '?',
      shiftKey: true,
      handler: () => {
        this.showKeyboardHelp();
      },
      description: 'Show keyboard shortcuts help',
      global: true,
    });
  }

  /**
   * Start listening for keyboard events
   */
  private startListening(): void {
    if (this.isListening) return;

    document.addEventListener('keydown', this.handleKeyDown.bind(this));
    this.isListening = true;
  }

  /**
   * Handle keyboard events
   */
  private handleKeyDown(event: KeyboardEvent): void {
    // Don't process shortcuts when user is typing in input fields
    if (this.isInputElement(event.target as Element)) {
      return;
    }

    const shortcutKey = this.getShortcutKeyFromEvent(event);
    const shortcut = this.shortcuts.get(shortcutKey);

    if (shortcut) {
      event.preventDefault();
      shortcut.handler(event);
    }
  }

  /**
   * Check if element is an input element
   */
  private isInputElement(element: Element): boolean {
    if (!element) return false;
    
    const tagName = element.tagName.toLowerCase();
    return ['input', 'textarea', 'select'].includes(tagName) ||
           element.getAttribute('contenteditable') === 'true' ||
           element.getAttribute('role') === 'textbox';
  }

  /**
   * Generate shortcut key from shortcut config
   */
  private getShortcutKey(shortcut: KeyboardShortcut): string {
    return this.buildShortcutKey(shortcut.key, {
      ctrlKey: shortcut.ctrlKey,
      altKey: shortcut.altKey,
      shiftKey: shortcut.shiftKey,
      metaKey: shortcut.metaKey,
    });
  }

  /**
   * Generate shortcut key from keyboard event
   */
  private getShortcutKeyFromEvent(event: KeyboardEvent): string {
    return this.buildShortcutKey(event.key, {
      ctrlKey: event.ctrlKey,
      altKey: event.altKey,
      shiftKey: event.shiftKey,
      metaKey: event.metaKey,
    });
  }

  /**
   * Build shortcut key string
   */
  private buildShortcutKey(key: string, modifiers?: {
    ctrlKey?: boolean;
    altKey?: boolean;
    shiftKey?: boolean;
    metaKey?: boolean;
  }): string {
    const parts = [];
    
    if (modifiers?.ctrlKey) parts.push('ctrl');
    if (modifiers?.altKey) parts.push('alt');
    if (modifiers?.shiftKey) parts.push('shift');
    if (modifiers?.metaKey) parts.push('meta');
    
    parts.push(key.toLowerCase());
    
    return parts.join('+');
  }

  /**
   * Show keyboard help modal
   */
  private showKeyboardHelp(): void {
    const helpContent = this.getShortcutHelp().join('\n');
    
    // Simple implementation - could be enhanced with a proper modal
    const existing = document.getElementById('keyboard-help');
    if (existing) {
      existing.remove();
    }

    const modal = document.createElement('div');
    modal.id = 'keyboard-help';
    modal.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: white;
      border: 2px solid #333;
      padding: 20px;
      z-index: 10000;
      max-width: 500px;
      max-height: 80vh;
      overflow: auto;
      box-shadow: 0 4px 8px rgba(0,0,0,0.3);
    `;
    
    modal.innerHTML = `
      <h2>Keyboard Shortcuts</h2>
      <pre style="white-space: pre-wrap; font-family: monospace;">${helpContent}</pre>
      <button id="close-help" style="margin-top: 10px;">Close (Escape)</button>
    `;

    const closeModal = () => {
      modal.remove();
      document.removeEventListener('keydown', escapeHandler);
    };

    const escapeHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal();
    };

    modal.querySelector('#close-help')?.addEventListener('click', closeModal);
    document.addEventListener('keydown', escapeHandler);
    
    document.body.appendChild(modal);
    (modal.querySelector('#close-help') as HTMLElement)?.focus();
  }
}

// Convenience functions
export function getKeyboardNavigationManager(): KeyboardNavigationManager {
  return KeyboardNavigationManager.getInstance();
}

export function registerShortcut(shortcut: KeyboardShortcut): void {
  getKeyboardNavigationManager().registerShortcut(shortcut);
}

export function createRovingTabindex(container: HTMLElement, selector?: string): void {
  getKeyboardNavigationManager().createRovingTabindex(container, selector);
}

export function setActiveNavigationGroup(groupName: string | null): void {
  getKeyboardNavigationManager().setActiveGroup(groupName);
}