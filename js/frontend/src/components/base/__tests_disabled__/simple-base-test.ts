/**
 * Simple test to verify BaseComponent architecture without testing framework
 */
import { LitElement } from 'lit';
import { BaseComponent } from '../BaseComponent';

// Extend BaseComponent to test its functionality
class TestBaseComponent extends BaseComponent {
  // Make protected methods public for testing
  public testSetLoading(loading: boolean) {
    this.setLoading(loading);
  }

  public testSetError(error: string | Error | null) {
    this.setError(error);
  }

  public testEmitEvent(name: string, detail?: any) {
    return this.emitEvent(name, detail);
  }

  public testFormatDate(date: Date) {
    return this.formatDate(date);
  }

  public testSanitizeHTML(html: string) {
    return this.sanitizeHTML(html);
  }

  public testDebounce<T extends (...args: any[]) => any>(func: T, delay: number) {
    return this.debounce(func, delay);
  }

  render() {
    return `<div>test</div>`;
  }
}

// Simple test runner
function test(description: string, testFn: () => void | boolean) {
  try {
    const result = testFn();
    if (result === false) {
      throw new Error('Test returned false');
    }
    console.log(`✓ ${description}`);
    return true;
  } catch (error) {
    console.error(`✗ ${description}: ${error instanceof Error ? error.message : error}`);
    return false;
  }
}

function runTests() {
  console.log('Running BaseComponent tests...\n');
  
  const component = new TestBaseComponent();
  let passed = 0;
  let total = 0;

  // Test 1: Basic properties
  total++;
  if (test('should have default properties', () => {
    return component.role === 'region' && 
           component.darkTheme === false;
  })) passed++;

  // Test 2: Loading state management
  total++;
  if (test('should set loading state', () => {
    component.testSetLoading(true);
    return (component as any).loading === true && (component as any).error === null;
  })) passed++;

  // Test 3: Error state management
  total++;
  if (test('should set error state', () => {
    component.testSetError('Test error');
    return (component as any).error === 'Test error' && (component as any).loading === false;
  })) passed++;

  // Test 4: Error from Error object
  total++;
  if (test('should set error from Error object', () => {
    const error = new Error('Error object message');
    component.testSetError(error);
    return (component as any).error === 'Error object message';
  })) passed++;

  // Test 5: Date formatting
  total++;
  if (test('should format dates correctly', () => {
    const date = new Date('2023-01-15T10:30:00Z');
    const formatted = component.testFormatDate(date);
    return typeof formatted === 'string' && 
           formatted.includes('2023') && 
           formatted.includes('Jan') && 
           formatted.includes('15');
  })) passed++;

  // Test 6: HTML sanitization
  total++;
  if (test('should sanitize HTML content', () => {
    const html = '<script>alert("xss")</script><p>Safe content</p>';
    const sanitized = component.testSanitizeHTML(html);
    return sanitized === '&lt;script&gt;alert("xss")&lt;/script&gt;&lt;p&gt;Safe content&lt;/p&gt;';
  })) passed++;

  // Test 7: Extends LitElement
  total++;
  if (test('should extend LitElement', () => {
    return component instanceof LitElement && component instanceof BaseComponent;
  })) passed++;

  // Test 8: Has static baseStyles property
  total++;
  if (test('should have baseStyles property', () => {
    return Array.isArray(BaseComponent.baseStyles);
  })) passed++;

  // Test 9: Debounce function creation
  total++;
  if (test('should create debounced function', () => {
    let callCount = 0;
    const debouncedFn = component.testDebounce(() => callCount++, 10);
    return typeof debouncedFn === 'function';
  })) passed++;

  // Test 10: Event emission
  total++;
  if (test('should emit custom events', () => {
    let eventFired = false;
    component.addEventListener('test-event', () => {
      eventFired = true;
    });
    component.testEmitEvent('test-event', { test: 'data' });
    return eventFired;
  })) passed++;

  console.log(`\nTest Results: ${passed}/${total} tests passed`);
  return passed === total;
}

// Run tests if this file is executed directly
if (typeof module !== 'undefined' && require.main === module) {
  runTests();
}

export { runTests, TestBaseComponent };