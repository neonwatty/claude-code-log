/**
 * Focus management service for coordinating focus across components
 * Provides keyboard navigation patterns and focus trapping for modal components
 */

import { FocusManager, KeyboardKeys, announce } from './accessibility';

export interface FocusableRegion {
  id: string;
  element: Element;
  priority: number;
}

export interface FocusOptions {
  skipAnnouncement?: boolean;
  preventScroll?: boolean;
  focusVisible?: boolean;
}

/**
 * Global focus management service
 */
export class GlobalFocusManager {
  private static instance: GlobalFocusManager;
  private focusableRegions = new Map<string, FocusableRegion>();
  private currentModalStack: string[] = [];
  private lastFocusedElement: HTMLElement | null = null;

  private constructor() {
    this.setupGlobalListeners();
  }

  static getInstance(): GlobalFocusManager {
    if (!GlobalFocusManager.instance) {
      GlobalFocusManager.instance = new GlobalFocusManager();
    }
    return GlobalFocusManager.instance;
  }

  /**
   * Register a focusable region for global navigation
   */
  registerRegion(region: FocusableRegion): void {
    this.focusableRegions.set(region.id, region);
  }

  /**
   * Unregister a focusable region
   */
  unregisterRegion(regionId: string): void {
    this.focusableRegions.delete(regionId);
  }

  /**
   * Push a modal onto the focus stack
   */
  pushModal(regionId: string): void {
    // Store the currently focused element before entering modal
    this.lastFocusedElement = document.activeElement as HTMLElement;
    
    this.currentModalStack.push(regionId);
    
    // Focus the modal container
    const region = this.focusableRegions.get(regionId);
    if (region) {
      FocusManager.focusFirst(region.element);
    }
  }

  /**
   * Pop a modal from the focus stack
   */
  popModal(regionId?: string): void {
    if (regionId) {
      const index = this.currentModalStack.indexOf(regionId);
      if (index !== -1) {
        this.currentModalStack.splice(index, 1);
      }
    } else {
      this.currentModalStack.pop();
    }

    // Restore focus to the previous element if no more modals
    if (this.currentModalStack.length === 0 && this.lastFocusedElement) {
      this.lastFocusedElement.focus();
      this.lastFocusedElement = null;
    }
  }

  /**
   * Check if we're currently in a modal
   */
  isInModal(): boolean {
    return this.currentModalStack.length > 0;
  }

  /**
   * Get the current modal region ID
   */
  getCurrentModal(): string | null {
    return this.currentModalStack.length > 0 
      ? this.currentModalStack[this.currentModalStack.length - 1]
      : null;
  }

  /**
   * Focus an element with announcement and options
   */
  focusElement(
    element: HTMLElement, 
    announcement?: string, 
    options: FocusOptions = {}
  ): void {
    const { skipAnnouncement = false, preventScroll = false, focusVisible = false } = options;

    // Set focus
    element.focus({ preventScroll });

    // Add focus-visible class for better styling
    if (focusVisible) {
      element.classList.add('focus-visible');
      // Remove after a delay to allow natural focus management
      setTimeout(() => element.classList.remove('focus-visible'), 100);
    }

    // Announce to screen readers
    if (!skipAnnouncement && announcement) {
      announce(announcement, 'polite');
    }
  }

  /**
   * Navigate between regions using keyboard shortcuts
   */
  navigateToRegion(direction: 'next' | 'previous' | 'first' | 'last'): boolean {
    if (this.isInModal()) {
      return false; // Don't allow region navigation within modals
    }

    const regions = Array.from(this.focusableRegions.values())
      .sort((a, b) => a.priority - b.priority);

    if (regions.length === 0) return false;

    const currentElement = document.activeElement as HTMLElement;
    let currentRegionIndex = -1;

    // Find which region currently has focus
    for (let i = 0; i < regions.length; i++) {
      if (regions[i].element.contains(currentElement)) {
        currentRegionIndex = i;
        break;
      }
    }

    let targetIndex: number;

    switch (direction) {
      case 'next':
        targetIndex = currentRegionIndex === -1 
          ? 0 
          : (currentRegionIndex + 1) % regions.length;
        break;
      case 'previous':
        targetIndex = currentRegionIndex === -1 
          ? regions.length - 1 
          : (currentRegionIndex - 1 + regions.length) % regions.length;
        break;
      case 'first':
        targetIndex = 0;
        break;
      case 'last':
        targetIndex = regions.length - 1;
        break;
      default:
        return false;
    }

    const targetRegion = regions[targetIndex];
    if (targetRegion) {
      FocusManager.focusFirst(targetRegion.element);
      announce(`Navigated to ${targetRegion.id}`, 'polite');
      return true;
    }

    return false;
  }

  /**
   * Handle global keyboard shortcuts
   */
  private setupGlobalListeners(): void {
    document.addEventListener('keydown', (event: KeyboardEvent) => {
      // Skip if typing in an input
      if (this.isTypingContext(event.target as Element)) {
        return;
      }

      const currentModal = this.getCurrentModal();
      if (currentModal) {
        this.handleModalKeydown(event, currentModal);
      } else {
        this.handleGlobalKeydown(event);
      }
    });

    // Handle focus trapping for modals
    document.addEventListener('focusin', (event: FocusEvent) => {
      const currentModal = this.getCurrentModal();
      if (!currentModal) return;

      const modalRegion = this.focusableRegions.get(currentModal);
      if (!modalRegion) return;

      const focusedElement = event.target as Element;
      
      // If focus moved outside the modal, bring it back
      if (!modalRegion.element.contains(focusedElement)) {
        event.preventDefault();
        FocusManager.focusFirst(modalRegion.element);
      }
    });
  }

  private isTypingContext(element: Element): boolean {
    const typingElements = ['INPUT', 'TEXTAREA', 'SELECT'];
    return typingElements.includes(element?.tagName) || 
           element?.getAttribute('contenteditable') === 'true';
  }

  private handleModalKeydown(event: KeyboardEvent, modalId: string): void {
    const modalRegion = this.focusableRegions.get(modalId);
    if (!modalRegion) return;

    switch (event.key) {
      case KeyboardKeys.ESCAPE:
        // Let components handle their own escape logic
        // This is just for focus management
        this.popModal(modalId);
        event.preventDefault();
        break;

      case KeyboardKeys.TAB:
        // Trap focus within modal
        if (FocusManager.trapFocus(modalRegion.element, event)) {
          // Focus was trapped, event was handled
        }
        break;
    }
  }

  private handleGlobalKeydown(event: KeyboardEvent): void {
    // Global keyboard shortcuts
    const isCtrlOrCmd = event.ctrlKey || event.metaKey;

    switch (event.key) {
      case 'F6':
        // Standard Windows shortcut for region navigation
        this.navigateToRegion(event.shiftKey ? 'previous' : 'next');
        event.preventDefault();
        break;

      case 'r':
      case 'R':
        // Custom shortcut for region navigation (Ctrl+R)
        if (isCtrlOrCmd && event.shiftKey) {
          this.navigateToRegion('previous');
          event.preventDefault();
        } else if (isCtrlOrCmd) {
          this.navigateToRegion('next');
          event.preventDefault();
        }
        break;

      case KeyboardKeys.HOME:
        if (isCtrlOrCmd) {
          this.navigateToRegion('first');
          event.preventDefault();
        }
        break;

      case KeyboardKeys.END:
        if (isCtrlOrCmd) {
          this.navigateToRegion('last');
          event.preventDefault();
        }
        break;
    }
  }
}

/**
 * Hook for components to register themselves for focus management
 */
export function useFocusManagement(
  regionId: string, 
  element: Element, 
  priority: number = 0
): {
  register: () => void;
  unregister: () => void;
  pushModal: () => void;
  popModal: () => void;
} {
  const focusManager = GlobalFocusManager.getInstance();

  return {
    register: () => {
      focusManager.registerRegion({ id: regionId, element, priority });
    },
    unregister: () => {
      focusManager.unregisterRegion(regionId);
    },
    pushModal: () => {
      focusManager.pushModal(regionId);
    },
    popModal: () => {
      focusManager.popModal(regionId);
    }
  };
}

/**
 * Skip link component helper for creating accessible navigation shortcuts
 */
export class SkipLinkManager {
  private static instance: SkipLinkManager;
  private skipLinks: Map<string, { element: HTMLElement; label: string }> = new Map();

  private constructor() {}

  static getInstance(): SkipLinkManager {
    if (!SkipLinkManager.instance) {
      SkipLinkManager.instance = new SkipLinkManager();
    }
    return SkipLinkManager.instance;
  }

  /**
   * Register a skip link target
   */
  registerTarget(id: string, element: HTMLElement, label: string): void {
    this.skipLinks.set(id, { element, label });
    this.updateSkipLinks();
  }

  /**
   * Unregister a skip link target
   */
  unregisterTarget(id: string): void {
    this.skipLinks.delete(id);
    this.updateSkipLinks();
  }

  /**
   * Create or update skip links container
   */
  private updateSkipLinks(): void {
    let container = document.querySelector('.skip-links') as HTMLElement;
    
    if (!container) {
      container = document.createElement('div');
      container.className = 'skip-links';
      container.setAttribute('aria-label', 'Skip navigation links');
      
      // Style skip links
      Object.assign(container.style, {
        position: 'absolute',
        top: '0',
        left: '0',
        zIndex: '1000',
        display: 'flex',
        gap: '0.5rem',
        padding: '0.5rem'
      });

      document.body.prepend(container);
    }

    // Clear existing links
    container.innerHTML = '';

    // Add current skip links
    for (const [id, { element, label }] of this.skipLinks) {
      const link = document.createElement('a');
      link.href = `#${element.id || id}`;
      link.textContent = label;
      link.className = 'skip-link';
      
      // Style skip link
      Object.assign(link.style, {
        position: 'absolute',
        left: '-10000px',
        width: '1px',
        height: '1px',
        overflow: 'hidden',
        backgroundColor: 'var(--color-primary, #0066cc)',
        color: 'white',
        padding: '0.5rem 1rem',
        textDecoration: 'none',
        borderRadius: '0.25rem',
        fontSize: '0.875rem',
        fontWeight: '500',
        zIndex: '1001'
      });

      link.addEventListener('focus', () => {
        Object.assign(link.style, {
          position: 'static',
          left: 'auto',
          width: 'auto',
          height: 'auto',
          overflow: 'visible'
        });
      });

      link.addEventListener('blur', () => {
        Object.assign(link.style, {
          position: 'absolute',
          left: '-10000px',
          width: '1px',
          height: '1px',
          overflow: 'hidden'
        });
      });

      link.addEventListener('click', (event) => {
        event.preventDefault();
        element.focus();
        element.scrollIntoView({ behavior: 'smooth' });
      });

      container.appendChild(link);
    }
  }
}

// Export singleton instances for convenience
export const globalFocusManager = GlobalFocusManager.getInstance();
export const skipLinkManager = SkipLinkManager.getInstance();