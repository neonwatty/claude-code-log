/**
 * Accessibility Service
 * Provides screen reader announcements and accessibility utilities
 */

export interface AccessibilityAnnouncement {
  message: string;
  priority: "polite" | "assertive";
  delay?: number;
}

export class AccessibilityService {
  private static instance: AccessibilityService | null = null;
  private announcer: HTMLElement | null = null;
  private announceQueue: AccessibilityAnnouncement[] = [];
  private isProcessingQueue = false;

  private constructor() {
    this.createAnnouncer();
  }

  public static getInstance(): AccessibilityService {
    if (!AccessibilityService.instance) {
      AccessibilityService.instance = new AccessibilityService();
    }
    return AccessibilityService.instance;
  }

  /**
   * Create the aria-live region for announcements
   */
  private createAnnouncer(): void {
    if (this.announcer) return;

    this.announcer = document.createElement("div");
    this.announcer.setAttribute("aria-live", "polite");
    this.announcer.setAttribute("aria-atomic", "true");
    this.announcer.className = "sr-only accessibility-announcer";

    // Hide the announcer visually but keep it accessible to screen readers
    this.announcer.style.cssText = `
      position: absolute !important;
      width: 1px !important;
      height: 1px !important;
      padding: 0 !important;
      margin: -1px !important;
      overflow: hidden !important;
      clip: rect(0, 0, 0, 0) !important;
      white-space: nowrap !important;
      border: 0 !important;
    `;

    document.body.appendChild(this.announcer);
  }

  /**
   * Announce a message to screen readers
   */
  public announce(
    message: string,
    priority: "polite" | "assertive" = "polite",
    delay = 100,
  ): void {
    if (!message.trim()) return;

    const announcement: AccessibilityAnnouncement = {
      message: message.trim(),
      priority,
      delay,
    };

    this.announceQueue.push(announcement);
    this.processQueue();
  }

  /**
   * Announce connection state changes with appropriate urgency
   */
  public announceConnectionState(state: string, details?: string): void {
    let message = `Connection status: ${state}`;
    if (details) {
      message += `. ${details}`;
    }

    // Use assertive for important state changes like errors
    const priority =
      state.toLowerCase().includes("error") ||
      state.toLowerCase().includes("disconnected")
        ? "assertive"
        : "polite";

    this.announce(message, priority);
  }

  /**
   * Announce toast notifications
   */
  public announceToast(title: string, message: string, type: string): void {
    const urgency = type === "error" ? "assertive" : "polite";
    this.announce(`${title}. ${message}`, urgency);
  }

  /**
   * Announce data loading states
   */
  public announceLoading(isLoading: boolean, context = "content"): void {
    const message = isLoading
      ? `Loading ${context}, please wait`
      : `${context} loaded successfully`;

    this.announce(message, "polite");
  }

  /**
   * Announce navigation changes
   */
  public announceNavigation(destination: string): void {
    this.announce(`Navigated to ${destination}`, "polite");
  }

  /**
   * Announce form validation errors
   */
  public announceValidationError(
    fieldName: string,
    errorMessage: string,
  ): void {
    this.announce(`Error in ${fieldName}: ${errorMessage}`, "assertive");
  }

  /**
   * Announce successful actions
   */
  public announceSuccess(action: string): void {
    this.announce(`${action} completed successfully`, "polite");
  }

  /**
   * Process the announcement queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.announceQueue.length === 0) return;

    this.isProcessingQueue = true;

    while (this.announceQueue.length > 0) {
      const announcement = this.announceQueue.shift()!;
      await this.makeAnnouncement(announcement);
    }

    this.isProcessingQueue = false;
  }

  /**
   * Make a single announcement
   */
  private async makeAnnouncement(
    announcement: AccessibilityAnnouncement,
  ): Promise<void> {
    if (!this.announcer) return;

    // Update the aria-live priority if needed
    if (this.announcer.getAttribute("aria-live") !== announcement.priority) {
      this.announcer.setAttribute("aria-live", announcement.priority);
    }

    // Clear previous content
    this.announcer.textContent = "";

    // Wait for a brief moment to ensure screen readers notice the change
    if (announcement.delay) {
      await new Promise((resolve) => setTimeout(resolve, announcement.delay));
    }

    // Set the new message
    this.announcer.textContent = announcement.message;

    // Wait a bit before processing the next announcement
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  /**
   * Clear all pending announcements
   */
  public clearQueue(): void {
    this.announceQueue = [];
  }

  /**
   * Get the number of pending announcements
   */
  public getQueueLength(): number {
    return this.announceQueue.length;
  }

  /**
   * Check if screen reader announcements are supported
   */
  public isSupported(): boolean {
    return !!this.announcer;
  }

  /**
   * Destroy the accessibility service
   */
  public destroy(): void {
    if (this.announcer && this.announcer.parentNode) {
      this.announcer.parentNode.removeChild(this.announcer);
      this.announcer = null;
    }

    this.clearQueue();
    AccessibilityService.instance = null;
  }
}

// Export singleton getter for convenience
export function getAccessibilityService(): AccessibilityService {
  return AccessibilityService.getInstance();
}

// Utility functions for common accessibility patterns

/**
 * Add or update aria-describedby attribute
 */
export function setAriaDescribedBy(
  element: HTMLElement,
  descriptionId: string,
): void {
  const currentDescribedBy = element.getAttribute("aria-describedby");
  const describedByIds = currentDescribedBy
    ? currentDescribedBy.split(" ")
    : [];

  if (!describedByIds.includes(descriptionId)) {
    describedByIds.push(descriptionId);
    element.setAttribute("aria-describedby", describedByIds.join(" "));
  }
}

/**
 * Remove from aria-describedby attribute
 */
export function removeAriaDescribedBy(
  element: HTMLElement,
  descriptionId: string,
): void {
  const currentDescribedBy = element.getAttribute("aria-describedby");
  if (!currentDescribedBy) return;

  const describedByIds = currentDescribedBy
    .split(" ")
    .filter((id) => id !== descriptionId);

  if (describedByIds.length > 0) {
    element.setAttribute("aria-describedby", describedByIds.join(" "));
  } else {
    element.removeAttribute("aria-describedby");
  }
}

/**
 * Create a unique ID for accessibility purposes
 */
export function createAccessibilityId(prefix = "a11y"): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Set focus with announcement
 */
export function setFocusWithAnnouncement(
  element: HTMLElement,
  announcement?: string,
): void {
  element.focus();

  if (announcement) {
    getAccessibilityService().announce(announcement, "polite", 200);
  }
}

/**
 * WCAG 2.1 AA Enhancement Features
 */

/**
 * Color contrast checker utility
 */
export function checkColorContrast(
  foreground: string,
  background: string,
  level: 'AA' | 'AAA' = 'AA'
): { ratio: number; passes: boolean } {
  const getLuminance = (rgb: { r: number; g: number; b: number }) => {
    const sRGB = Object.values(rgb).map(c => {
      c = c / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * sRGB[0] + 0.7152 * sRGB[1] + 0.0722 * sRGB[2];
  };

  const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  };

  const fgRgb = hexToRgb(foreground);
  const bgRgb = hexToRgb(background);

  if (!fgRgb || !bgRgb) {
    return { ratio: 0, passes: false };
  }

  const fgLum = getLuminance(fgRgb);
  const bgLum = getLuminance(bgRgb);
  
  const ratio = (Math.max(fgLum, bgLum) + 0.05) / (Math.min(fgLum, bgLum) + 0.05);
  const threshold = level === 'AAA' ? 7 : 4.5;
  
  return { ratio: Math.round(ratio * 100) / 100, passes: ratio >= threshold };
}

/**
 * Enhanced keyboard trap management
 */
export class KeyboardTrapManager {
  private static activeTraps = new Set<HTMLElement>();
  private static handlers = new Map<HTMLElement, (e: KeyboardEvent) => void>();

  static createTrap(container: HTMLElement): void {
    if (this.activeTraps.has(container)) {
      return;
    }

    const focusableElements = this.getFocusableElements(container);
    if (focusableElements.length === 0) {
      console.warn('No focusable elements found in container');
      return;
    }

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        if (e.shiftKey) {
          // Shift + Tab
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          // Tab
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      } else if (e.key === 'Escape') {
        this.releaseTrap(container);
        getAccessibilityService().announce('Dialog closed', 'polite');
      }
    };

    container.addEventListener('keydown', handler);
    this.handlers.set(container, handler);
    this.activeTraps.add(container);
    
    // Focus first element
    firstElement.focus();
    getAccessibilityService().announce('Dialog opened', 'polite');
  }

  static releaseTrap(container: HTMLElement): void {
    const handler = this.handlers.get(container);
    if (handler) {
      container.removeEventListener('keydown', handler);
      this.handlers.delete(container);
    }
    this.activeTraps.delete(container);
  }

  static releaseAllTraps(): void {
    for (const container of this.activeTraps) {
      this.releaseTrap(container);
    }
  }

  private static getFocusableElements(container: HTMLElement): HTMLElement[] {
    const selector = [
      'button',
      '[href]',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
      '[contenteditable]'
    ].join(', ');

    return Array.from(container.querySelectorAll(selector))
      .filter(el => !this.isHidden(el as HTMLElement)) as HTMLElement[];
  }

  private static isHidden(element: HTMLElement): boolean {
    const style = window.getComputedStyle(element);
    return style.display === 'none' || 
           style.visibility === 'hidden' || 
           style.opacity === '0' ||
           element.hasAttribute('hidden') ||
           element.getAttribute('aria-hidden') === 'true';
  }
}

/**
 * Enhanced focus management with WCAG compliance
 */
export class FocusManager {
  private static focusHistory: HTMLElement[] = [];
  private static maxHistorySize = 10;

  static setFocus(
    element: HTMLElement, 
    options: {
      preventScroll?: boolean;
      restorePrevious?: boolean;
      announcement?: string;
    } = {}
  ): void {
    const { preventScroll = false, restorePrevious = false, announcement } = options;

    // Store previous focus for restoration
    if (document.activeElement instanceof HTMLElement && document.activeElement !== element) {
      this.addToHistory(document.activeElement);
    }

    // Set focus
    if (preventScroll) {
      element.focus({ preventScroll: true });
    } else {
      element.focus();
    }

    // Announce focus change
    if (announcement) {
      getAccessibilityService().announce(announcement, 'polite');
    }

    // Auto-restore focus after delay if requested
    if (restorePrevious && this.focusHistory.length > 0) {
      setTimeout(() => {
        this.restorePreviousFocus();
      }, 3000);
    }
  }

  static restorePreviousFocus(): void {
    if (this.focusHistory.length > 0) {
      const previousElement = this.focusHistory.pop()!;
      if (document.body.contains(previousElement)) {
        previousElement.focus();
        getAccessibilityService().announce('Focus restored', 'polite');
      }
    }
  }

  static clearHistory(): void {
    this.focusHistory = [];
  }

  private static addToHistory(element: HTMLElement): void {
    // Remove duplicates
    this.focusHistory = this.focusHistory.filter(el => el !== element);
    
    // Add to end
    this.focusHistory.push(element);
    
    // Maintain size limit
    if (this.focusHistory.length > this.maxHistorySize) {
      this.focusHistory.shift();
    }
  }
}

/**
 * Skip link manager for navigation
 */
export class SkipLinkManager {
  private static skipLinks: Map<string, HTMLElement> = new Map();

  static addSkipLink(
    target: string,
    label: string,
    insertAfter?: HTMLElement
  ): HTMLElement {
    const skipLink = document.createElement('a');
    skipLink.href = `#${target}`;
    skipLink.textContent = label;
    skipLink.className = 'skip-link';
    skipLink.style.cssText = `
      position: absolute;
      top: -40px;
      left: 6px;
      background: #000;
      color: #fff;
      padding: 8px;
      text-decoration: none;
      z-index: 1000;
      border-radius: 0 0 4px 4px;
      transition: top 0.3s;
    `;

    // Show on focus
    skipLink.addEventListener('focus', () => {
      skipLink.style.top = '0';
    });

    skipLink.addEventListener('blur', () => {
      skipLink.style.top = '-40px';
    });

    // Handle click
    skipLink.addEventListener('click', (e) => {
      e.preventDefault();
      const targetElement = document.getElementById(target);
      if (targetElement) {
        FocusManager.setFocus(targetElement, {
          announcement: `Skipped to ${label}`
        });
      }
    });

    // Insert into DOM
    if (insertAfter) {
      insertAfter.insertAdjacentElement('afterend', skipLink);
    } else {
      document.body.insertBefore(skipLink, document.body.firstChild);
    }

    this.skipLinks.set(target, skipLink);
    return skipLink;
  }

  static removeSkipLink(target: string): void {
    const skipLink = this.skipLinks.get(target);
    if (skipLink && skipLink.parentNode) {
      skipLink.parentNode.removeChild(skipLink);
      this.skipLinks.delete(target);
    }
  }

  static removeAllSkipLinks(): void {
    for (const target of this.skipLinks.keys()) {
      this.removeSkipLink(target);
    }
  }
}

/**
 * ARIA live region enhancements
 */
export function createLiveRegion(
  priority: 'polite' | 'assertive' = 'polite',
  atomic = true
): HTMLElement {
  const region = document.createElement('div');
  region.setAttribute('aria-live', priority);
  region.setAttribute('aria-atomic', atomic.toString());
  region.className = 'sr-only live-region';
  region.style.cssText = `
    position: absolute !important;
    width: 1px !important;
    height: 1px !important;
    padding: 0 !important;
    margin: -1px !important;
    overflow: hidden !important;
    clip: rect(0, 0, 0, 0) !important;
    white-space: nowrap !important;
    border: 0 !important;
  `;
  
  document.body.appendChild(region);
  return region;
}

/**
 * Enhanced tooltip with WCAG compliance
 */
export function createAccessibleTooltip(
  trigger: HTMLElement,
  content: string,
  position: 'top' | 'bottom' | 'left' | 'right' = 'top'
): HTMLElement {
  const tooltipId = createAccessibilityId('tooltip');
  
  const tooltip = document.createElement('div');
  tooltip.id = tooltipId;
  tooltip.textContent = content;
  tooltip.role = 'tooltip';
  tooltip.className = `tooltip tooltip-${position}`;
  tooltip.style.cssText = `
    position: absolute;
    background: #333;
    color: #fff;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    z-index: 1000;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.2s;
  `;

  document.body.appendChild(tooltip);

  // Set up ARIA relationship
  trigger.setAttribute('aria-describedby', tooltipId);

  // Position tooltip
  const positionTooltip = () => {
    const triggerRect = trigger.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    
    switch (position) {
      case 'top':
        tooltip.style.left = `${triggerRect.left + (triggerRect.width - tooltipRect.width) / 2}px`;
        tooltip.style.top = `${triggerRect.top - tooltipRect.height - 4}px`;
        break;
      case 'bottom':
        tooltip.style.left = `${triggerRect.left + (triggerRect.width - tooltipRect.width) / 2}px`;
        tooltip.style.top = `${triggerRect.bottom + 4}px`;
        break;
      case 'left':
        tooltip.style.left = `${triggerRect.left - tooltipRect.width - 4}px`;
        tooltip.style.top = `${triggerRect.top + (triggerRect.height - tooltipRect.height) / 2}px`;
        break;
      case 'right':
        tooltip.style.left = `${triggerRect.right + 4}px`;
        tooltip.style.top = `${triggerRect.top + (triggerRect.height - tooltipRect.height) / 2}px`;
        break;
    }
  };

  // Show/hide handlers
  const showTooltip = () => {
    positionTooltip();
    tooltip.style.opacity = '1';
  };

  const hideTooltip = () => {
    tooltip.style.opacity = '0';
  };

  // Event listeners
  trigger.addEventListener('mouseenter', showTooltip);
  trigger.addEventListener('mouseleave', hideTooltip);
  trigger.addEventListener('focus', showTooltip);
  trigger.addEventListener('blur', hideTooltip);

  return tooltip;
}
