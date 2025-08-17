/**
 * Accessibility Service
 * Provides screen reader announcements and accessibility utilities
 */

export interface AccessibilityAnnouncement {
  message: string;
  priority: 'polite' | 'assertive';
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

    this.announcer = document.createElement('div');
    this.announcer.setAttribute('aria-live', 'polite');
    this.announcer.setAttribute('aria-atomic', 'true');
    this.announcer.className = 'sr-only accessibility-announcer';
    
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
  public announce(message: string, priority: 'polite' | 'assertive' = 'polite', delay = 100): void {
    if (!message.trim()) return;

    const announcement: AccessibilityAnnouncement = {
      message: message.trim(),
      priority,
      delay
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
    const priority = state.toLowerCase().includes('error') || state.toLowerCase().includes('disconnected') 
      ? 'assertive' : 'polite';

    this.announce(message, priority);
  }

  /**
   * Announce toast notifications
   */
  public announceToast(title: string, message: string, type: string): void {
    const urgency = type === 'error' ? 'assertive' : 'polite';
    this.announce(`${title}. ${message}`, urgency);
  }

  /**
   * Announce data loading states
   */
  public announceLoading(isLoading: boolean, context = 'content'): void {
    const message = isLoading 
      ? `Loading ${context}, please wait` 
      : `${context} loaded successfully`;
    
    this.announce(message, 'polite');
  }

  /**
   * Announce navigation changes
   */
  public announceNavigation(destination: string): void {
    this.announce(`Navigated to ${destination}`, 'polite');
  }

  /**
   * Announce form validation errors
   */
  public announceValidationError(fieldName: string, errorMessage: string): void {
    this.announce(`Error in ${fieldName}: ${errorMessage}`, 'assertive');
  }

  /**
   * Announce successful actions
   */
  public announceSuccess(action: string): void {
    this.announce(`${action} completed successfully`, 'polite');
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
  private async makeAnnouncement(announcement: AccessibilityAnnouncement): Promise<void> {
    if (!this.announcer) return;

    // Update the aria-live priority if needed
    if (this.announcer.getAttribute('aria-live') !== announcement.priority) {
      this.announcer.setAttribute('aria-live', announcement.priority);
    }

    // Clear previous content
    this.announcer.textContent = '';

    // Wait for a brief moment to ensure screen readers notice the change
    if (announcement.delay) {
      await new Promise(resolve => setTimeout(resolve, announcement.delay));
    }

    // Set the new message
    this.announcer.textContent = announcement.message;

    // Wait a bit before processing the next announcement
    await new Promise(resolve => setTimeout(resolve, 500));
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
export function setAriaDescribedBy(element: HTMLElement, descriptionId: string): void {
  const currentDescribedBy = element.getAttribute('aria-describedby');
  const describedByIds = currentDescribedBy ? currentDescribedBy.split(' ') : [];
  
  if (!describedByIds.includes(descriptionId)) {
    describedByIds.push(descriptionId);
    element.setAttribute('aria-describedby', describedByIds.join(' '));
  }
}

/**
 * Remove from aria-describedby attribute
 */
export function removeAriaDescribedBy(element: HTMLElement, descriptionId: string): void {
  const currentDescribedBy = element.getAttribute('aria-describedby');
  if (!currentDescribedBy) return;
  
  const describedByIds = currentDescribedBy.split(' ').filter(id => id !== descriptionId);
  
  if (describedByIds.length > 0) {
    element.setAttribute('aria-describedby', describedByIds.join(' '));
  } else {
    element.removeAttribute('aria-describedby');
  }
}

/**
 * Create a unique ID for accessibility purposes
 */
export function createAccessibilityId(prefix = 'a11y'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Set focus with announcement
 */
export function setFocusWithAnnouncement(element: HTMLElement, announcement?: string): void {
  element.focus();
  
  if (announcement) {
    getAccessibilityService().announce(announcement, 'polite', 200);
  }
}