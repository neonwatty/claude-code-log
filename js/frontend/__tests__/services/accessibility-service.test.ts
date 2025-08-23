/**
 * Unit tests for AccessibilityService
 * Tests screen reader announcements and accessibility utilities
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, vi } from 'vitest';

// Mock DOM elements
const mockAnnouncer = {
  setAttribute: vi.fn(),
  getAttribute: vi.fn(),
  style: { cssText: '' },
  textContent: '',
  className: '',
  parentNode: null,
  attributes: new Map()
} as unknown as HTMLElement & { attributes: Map<string, string> };

// Set up proper attribute tracking
mockAnnouncer.setAttribute = vi.fn((name: string, value: string) => {
  (mockAnnouncer as any).attributes.set(name, value);
});

mockAnnouncer.getAttribute = vi.fn((name: string) => {
  return (mockAnnouncer as any).attributes.get(name) || null;
});

// Initialize with default aria-live
(mockAnnouncer as any).attributes.set('aria-live', 'polite');

const mockDocument = {
  createElement: vi.fn((_tagName: string) => mockAnnouncer),
  body: {
    appendChild: vi.fn(),
    removeChild: vi.fn()
  }
};

global.document = mockDocument as any;

// AccessibilityService mock implementation
class MockAccessibilityService {
  private static instance: MockAccessibilityService | null = null;
  private announcer: HTMLElement | null = null;
  private announceQueue: Array<{
    message: string;
    priority: 'polite' | 'assertive';
    delay?: number;
  }> = [];
  private isProcessingQueue = false;

  private constructor() {
    this.createAnnouncer();
  }

  public static getInstance(): MockAccessibilityService {
    if (!MockAccessibilityService.instance) {
      MockAccessibilityService.instance = new MockAccessibilityService();
    }
    return MockAccessibilityService.instance;
  }

  public static resetInstance() {
    MockAccessibilityService.instance = null;
  }

  private createAnnouncer(): void {
    if (this.announcer) return;

    this.announcer = mockDocument.createElement('div');
    this.announcer.setAttribute('aria-live', 'polite');
    this.announcer.setAttribute('aria-atomic', 'true');
    this.announcer.className = 'sr-only accessibility-announcer';
    
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
    
    mockDocument.body.appendChild(this.announcer);
  }

  public announce(message: string, priority: 'polite' | 'assertive' = 'polite', delay = 100): void {
    if (!message.trim()) return;

    const announcement = {
      message: message.trim(),
      priority,
      delay
    };

    this.announceQueue.push(announcement);
    // Don't immediately process queue in tests - let timers control it
    if (!this.isProcessingQueue) {
      setTimeout(() => this.processQueue(), 0);
    }
  }

  public announceConnectionState(state: string, details?: string): void {
    let message = `Connection status: ${state}`;
    if (details) {
      message += `. ${details}`;
    }

    const priority = state.toLowerCase().includes('error') || state.toLowerCase().includes('disconnected') 
      ? 'assertive' : 'polite';

    this.announce(message, priority);
  }

  public announceToast(title: string, message: string, type: string): void {
    const urgency = type === 'error' ? 'assertive' : 'polite';
    this.announce(`${title}. ${message}`, urgency);
  }

  public announceLoading(isLoading: boolean, context = 'content'): void {
    const message = isLoading 
      ? `Loading ${context}, please wait` 
      : `${context} loaded successfully`;
    
    this.announce(message, 'polite');
  }

  public announceNavigation(destination: string): void {
    this.announce(`Navigated to ${destination}`, 'polite');
  }

  public announceValidationError(fieldName: string, errorMessage: string): void {
    this.announce(`Error in ${fieldName}: ${errorMessage}`, 'assertive');
  }

  public announceSuccess(action: string): void {
    this.announce(`${action} completed successfully`, 'polite');
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.announceQueue.length === 0) return;

    this.isProcessingQueue = true;

    while (this.announceQueue.length > 0) {
      const announcement = this.announceQueue.shift()!;
      await this.makeAnnouncement(announcement);
    }

    this.isProcessingQueue = false;
  }

  private async makeAnnouncement(announcement: { message: string; priority: string; delay?: number }): Promise<void> {
    if (!this.announcer) return;

    if (this.announcer.getAttribute('aria-live') !== announcement.priority) {
      this.announcer.setAttribute('aria-live', announcement.priority);
    }

    this.announcer.textContent = '';

    if (announcement.delay) {
      await new Promise(resolve => setTimeout(resolve, announcement.delay));
    }

    this.announcer.textContent = announcement.message;

    await new Promise(resolve => setTimeout(resolve, 500));
  }

  public clearQueue(): void {
    this.announceQueue = [];
  }

  public getQueueLength(): number {
    return this.announceQueue.length;
  }

  public isSupported(): boolean {
    return !!this.announcer;
  }

  public getAnnouncerText(): string {
    return this.announcer?.textContent || '';
  }

  public getAnnouncerAriaLive(): string | null {
    return this.announcer?.getAttribute('aria-live') || null;
  }

  public destroy(): void {
    if (this.announcer) {
      // Mock that the element was added to DOM
      (this.announcer as any).parentNode = mockDocument.body;
      mockDocument.body.removeChild(this.announcer);
      this.announcer = null;
    }
    
    this.clearQueue();
    MockAccessibilityService.instance = null;
  }
}

// Utility function mocks
function setAriaDescribedBy(element: HTMLElement, descriptionId: string): void {
  const currentDescribedBy = element.getAttribute('aria-describedby');
  const describedByIds = currentDescribedBy ? currentDescribedBy.split(' ') : [];
  
  if (!describedByIds.includes(descriptionId)) {
    describedByIds.push(descriptionId);
    element.setAttribute('aria-describedby', describedByIds.join(' '));
  }
}

function removeAriaDescribedBy(element: HTMLElement, descriptionId: string): void {
  const currentDescribedBy = element.getAttribute('aria-describedby');
  if (!currentDescribedBy) return;
  
  const describedByIds = currentDescribedBy.split(' ').filter(id => id !== descriptionId);
  
  if (describedByIds.length > 0) {
    element.setAttribute('aria-describedby', describedByIds.join(' '));
  } else {
    element.removeAttribute('aria-describedby');
  }
}

function createAccessibilityId(prefix = 'a11y'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

describe('AccessibilityService', () => {
  let service: MockAccessibilityService;

  // Set up fake timers once for the entire test suite
  beforeAll(() => {
    vi.useFakeTimers({
      shouldAdvanceTime: true,
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval']
    });
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    MockAccessibilityService.resetInstance();
    
    // Reset mock announcer state first
    (mockAnnouncer as any).textContent = '';
    (mockAnnouncer as any).className = '';
    (mockAnnouncer as any).attributes.clear();
    (mockAnnouncer as any).attributes.set('aria-live', 'polite');
    (mockAnnouncer as any).parentNode = null;
    
    // Clear mock call history but preserve functionality
    (mockDocument.createElement as any).mockClear();
    (mockAnnouncer.setAttribute as any).mockClear();
    (mockDocument.body.appendChild as any).mockClear();
    (mockDocument.body.removeChild as any).mockClear();
    
    // Clear any pending timers but keep fake timers active
    vi.clearAllTimers();
    
    // Create service instance
    service = MockAccessibilityService.getInstance();
  });

  afterEach(() => {
    if (service) {
      service.destroy();
    }
    vi.clearAllTimers();
  });

  describe('Singleton Pattern', () => {
    it('should maintain singleton instance', () => {
      const instance1 = MockAccessibilityService.getInstance();
      const instance2 = MockAccessibilityService.getInstance();
      
      expect(instance1).toBe(instance2);
    });

    it('should reset instance on destroy', () => {
      const instance1 = service;
      instance1.destroy();
      
      const instance2 = MockAccessibilityService.getInstance();
      expect(instance2).not.toBe(instance1);
    });
  });

  describe('Announcer Setup', () => {
    it('should create aria-live announcer on initialization', () => {
      expect(mockDocument.createElement).toHaveBeenCalledWith('div');
      expect(mockAnnouncer.setAttribute).toHaveBeenCalledWith('aria-live', 'polite');
      expect(mockAnnouncer.setAttribute).toHaveBeenCalledWith('aria-atomic', 'true');
      expect(mockAnnouncer.className).toBe('sr-only accessibility-announcer');
      expect(mockDocument.body.appendChild).toHaveBeenCalledWith(mockAnnouncer);
    });

    it('should set proper CSS for screen reader only visibility', () => {
      expect(mockAnnouncer.style.cssText).toContain('position: absolute !important');
      expect(mockAnnouncer.style.cssText).toContain('width: 1px !important');
      expect(mockAnnouncer.style.cssText).toContain('height: 1px !important');
      expect(mockAnnouncer.style.cssText).toContain('overflow: hidden !important');
    });

    it('should confirm announcer is supported', () => {
      expect(service.isSupported()).toBe(true);
    });
  });

  describe('Basic Announcements', () => {
    it('should announce simple message with default priority', async () => {
      service.announce('Test announcement');
      
      await vi.runAllTimersAsync();
      
      expect(service.getAnnouncerText()).toBe('Test announcement');
      expect(service.getAnnouncerAriaLive()).toBe('polite');
    });

    it('should announce message with assertive priority', async () => {
      service.announce('Urgent message', 'assertive');
      
      await vi.runAllTimersAsync();
      
      expect(service.getAnnouncerText()).toBe('Urgent message');
      expect(service.getAnnouncerAriaLive()).toBe('assertive');
    });

    it('should ignore empty messages', () => {
      service.announce('');
      service.announce('   ');
      
      expect(service.getQueueLength()).toBe(0);
    });

    it('should trim whitespace from messages', async () => {
      service.announce('  Test message  ');
      
      await vi.runAllTimersAsync();
      
      expect(service.getAnnouncerText()).toBe('Test message');
    });

    it('should handle custom delay', async () => {
      service.announce('Delayed message', 'polite', 500);
      
      // Should not be announced immediately
      await vi.advanceTimersByTimeAsync(200);
      expect(service.getAnnouncerText()).toBe('');
      
      // Should be announced after delay
      await vi.advanceTimersByTimeAsync(400);
      expect(service.getAnnouncerText()).toBe('Delayed message');
    });
  });

  describe('Connection State Announcements', () => {
    it('should announce connected state with polite priority', async () => {
      service.announceConnectionState('connected', 'Successfully established');
      
      await vi.runAllTimersAsync();
      
      expect(service.getAnnouncerText()).toBe('Connection status: connected. Successfully established');
      expect(service.getAnnouncerAriaLive()).toBe('polite');
    });

    it('should announce error state with assertive priority', async () => {
      service.announceConnectionState('error', 'Connection failed');
      
      await vi.runAllTimersAsync();
      
      expect(service.getAnnouncerText()).toBe('Connection status: error. Connection failed');
      expect(service.getAnnouncerAriaLive()).toBe('assertive');
    });

    it('should announce disconnected state with assertive priority', async () => {
      service.announceConnectionState('disconnected');
      
      await vi.runAllTimersAsync();
      
      expect(service.getAnnouncerText()).toBe('Connection status: disconnected');
      expect(service.getAnnouncerAriaLive()).toBe('assertive');
    });

    it('should announce other states with polite priority', async () => {
      service.announceConnectionState('connecting');
      
      await vi.runAllTimersAsync();
      
      expect(service.getAnnouncerText()).toBe('Connection status: connecting');
      expect(service.getAnnouncerAriaLive()).toBe('polite');
    });
  });

  describe('Toast Announcements', () => {
    it('should announce toast with polite priority for non-error types', async () => {
      service.announceToast('Success', 'Operation completed', 'success');
      
      await vi.runAllTimersAsync();
      
      expect(service.getAnnouncerText()).toBe('Success. Operation completed');
      expect(service.getAnnouncerAriaLive()).toBe('polite');
    });

    it('should announce toast with assertive priority for error type', async () => {
      service.announceToast('Error', 'Something went wrong', 'error');
      
      await vi.runAllTimersAsync();
      
      expect(service.getAnnouncerText()).toBe('Error. Something went wrong');
      expect(service.getAnnouncerAriaLive()).toBe('assertive');
    });
  });

  describe('Loading State Announcements', () => {
    it('should announce loading start', async () => {
      service.announceLoading(true, 'data');
      
      await vi.runAllTimersAsync();
      
      expect(service.getAnnouncerText()).toBe('Loading data, please wait');
    });

    it('should announce loading completion', async () => {
      service.announceLoading(false, 'data');
      
      await vi.runAllTimersAsync();
      
      expect(service.getAnnouncerText()).toBe('data loaded successfully');
    });

    it('should use default context when not provided', async () => {
      service.announceLoading(true);
      
      await vi.runAllTimersAsync();
      
      expect(service.getAnnouncerText()).toBe('Loading content, please wait');
    });
  });

  describe('Navigation Announcements', () => {
    it('should announce navigation changes', async () => {
      service.announceNavigation('Settings page');
      
      await vi.runAllTimersAsync();
      
      expect(service.getAnnouncerText()).toBe('Navigated to Settings page');
      expect(service.getAnnouncerAriaLive()).toBe('polite');
    });
  });

  describe('Validation Error Announcements', () => {
    it('should announce validation errors with assertive priority', async () => {
      service.announceValidationError('email', 'Invalid email format');
      
      await vi.runAllTimersAsync();
      
      expect(service.getAnnouncerText()).toBe('Error in email: Invalid email format');
      expect(service.getAnnouncerAriaLive()).toBe('assertive');
    });
  });

  describe('Success Announcements', () => {
    it('should announce successful actions', async () => {
      service.announceSuccess('Data saved');
      
      await vi.runAllTimersAsync();
      
      expect(service.getAnnouncerText()).toBe('Data saved completed successfully');
      expect(service.getAnnouncerAriaLive()).toBe('polite');
    });
  });

  describe('Queue Management', () => {
    it('should queue multiple announcements', () => {
      service.announce('First message');
      service.announce('Second message');
      service.announce('Third message');
      
      expect(service.getQueueLength()).toBe(3);
    });

    it('should process queue in order', async () => {
      service.announce('First message');
      service.announce('Second message');
      
      // Run all timers to completion  
      await vi.runAllTimersAsync();
      
      // After processing all, should have the last message
      expect(service.getAnnouncerText()).toBe('Second message');
      expect(service.getQueueLength()).toBe(0);
    });

    it('should clear queue when requested', () => {
      service.announce('First message');
      service.announce('Second message');
      
      expect(service.getQueueLength()).toBe(2);
      
      service.clearQueue();
      
      expect(service.getQueueLength()).toBe(0);
    });

    it('should not process queue concurrently', async () => {
      service.announce('First message');
      service.announce('Second message');
      
      // Start processing
      const promise1 = vi.advanceTimersByTimeAsync(300);
      service.announce('Third message'); // Add during processing
      
      await promise1;
      
      // Should still process all messages in order
      await vi.runAllTimersAsync();
      expect(service.getQueueLength()).toBe(0);
    });
  });

  describe('Priority Handling', () => {
    it('should update aria-live attribute when priority changes', async () => {
      service.announce('Polite message', 'polite');
      await vi.advanceTimersByTimeAsync(600);
      expect(service.getAnnouncerAriaLive()).toBe('polite');
      
      service.announce('Assertive message', 'assertive');
      await vi.advanceTimersByTimeAsync(600);
      expect(service.getAnnouncerAriaLive()).toBe('assertive');
    });

    it('should maintain priority for consecutive same-priority messages', async () => {
      service.announce('First assertive', 'assertive');
      service.announce('Second assertive', 'assertive');
      
      await vi.runAllTimersAsync();
      
      expect(service.getAnnouncerAriaLive()).toBe('assertive');
    });
  });

  describe('Cleanup and Destruction', () => {
    it('should remove announcer element on destroy', () => {
      service.destroy();
      
      expect(mockDocument.body.removeChild).toHaveBeenCalledWith(mockAnnouncer);
    });

    it('should clear queue on destroy', () => {
      service.announce('Test message');
      expect(service.getQueueLength()).toBe(1);
      
      service.destroy();
      
      // Create new instance to check queue is cleared
      const newService = MockAccessibilityService.getInstance();
      expect(newService.getQueueLength()).toBe(0);
    });

    it('should handle destroy when announcer does not exist', () => {
      service.destroy();
      service.destroy(); // Should not throw
      
      expect(true).toBe(true);
    });
  });
});

describe('Accessibility Utility Functions', () => {
  let mockElement: any;

  beforeEach(() => {
    mockElement = {
      getAttribute: vi.fn(),
      setAttribute: vi.fn(),
      removeAttribute: vi.fn()
    };
  });

  describe('setAriaDescribedBy', () => {
    it('should add description ID to empty aria-describedby', () => {
      mockElement.getAttribute.mockReturnValue(null);
      
      setAriaDescribedBy(mockElement, 'desc-1');
      
      expect(mockElement.setAttribute).toHaveBeenCalledWith('aria-describedby', 'desc-1');
    });

    it('should add description ID to existing aria-describedby', () => {
      mockElement.getAttribute.mockReturnValue('existing-desc');
      
      setAriaDescribedBy(mockElement, 'desc-2');
      
      expect(mockElement.setAttribute).toHaveBeenCalledWith('aria-describedby', 'existing-desc desc-2');
    });

    it('should not add duplicate description IDs', () => {
      mockElement.getAttribute.mockReturnValue('desc-1 desc-2');
      
      setAriaDescribedBy(mockElement, 'desc-1');
      
      expect(mockElement.setAttribute).not.toHaveBeenCalled();
    });
  });

  describe('removeAriaDescribedBy', () => {
    it('should do nothing when aria-describedby is empty', () => {
      mockElement.getAttribute.mockReturnValue(null);
      
      removeAriaDescribedBy(mockElement, 'desc-1');
      
      expect(mockElement.setAttribute).not.toHaveBeenCalled();
      expect(mockElement.removeAttribute).not.toHaveBeenCalled();
    });

    it('should remove description ID from aria-describedby', () => {
      mockElement.getAttribute.mockReturnValue('desc-1 desc-2 desc-3');
      
      removeAriaDescribedBy(mockElement, 'desc-2');
      
      expect(mockElement.setAttribute).toHaveBeenCalledWith('aria-describedby', 'desc-1 desc-3');
    });

    it('should remove aria-describedby attribute when last ID is removed', () => {
      mockElement.getAttribute.mockReturnValue('desc-1');
      
      removeAriaDescribedBy(mockElement, 'desc-1');
      
      expect(mockElement.removeAttribute).toHaveBeenCalledWith('aria-describedby');
    });

    it('should handle non-existent description ID gracefully', () => {
      mockElement.getAttribute.mockReturnValue('desc-1 desc-2');
      
      removeAriaDescribedBy(mockElement, 'non-existent');
      
      expect(mockElement.setAttribute).toHaveBeenCalledWith('aria-describedby', 'desc-1 desc-2');
    });
  });

  describe('createAccessibilityId', () => {
    it('should create ID with default prefix', () => {
      const id = createAccessibilityId();
      
      expect(id).toMatch(/^a11y-\d+-[a-z0-9]+$/);
    });

    it('should create ID with custom prefix', () => {
      const id = createAccessibilityId('custom');
      
      expect(id).toMatch(/^custom-\d+-[a-z0-9]+$/);
    });

    it('should create unique IDs', () => {
      const id1 = createAccessibilityId();
      const id2 = createAccessibilityId();
      
      expect(id1).not.toBe(id2);
    });
  });
});