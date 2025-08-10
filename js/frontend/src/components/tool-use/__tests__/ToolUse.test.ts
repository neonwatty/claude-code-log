import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { fixture, html, expect as expectLit } from '@open-wc/testing';
import { ToolUse } from '../ToolUse';
import type { ToolUseDisplay, ToolStatus } from '../ToolUse';
import { createReliableFixture } from '../../../test-setup';

// Mock shared types
type ToolUseContent = {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, any>;
};

type ToolResultContent = {
  type: 'tool_result';
  tool_use_id: string;
  content: string | Record<string, any>;
  is_error?: boolean;
};

describe('ToolUse', () => {
  let element: ToolUse;

  beforeEach(async () => {
    // Ensure custom element is registered before creating fixtures
    if (!globalThis.customElements?.get('tool-use')) {
      globalThis.customElements?.define('tool-use', ToolUse);
    }
    
    element = await createReliableFixture<ToolUse>(
      html`<tool-use></tool-use>`,
      {
        compact: false,
        collapsible: true,
        defaultCollapsed: false
      }
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('should render with default properties', () => {
      expect(element).to.exist;
      expect(element.collapsible).to.be.true;
      expect(element.defaultCollapsed).to.be.false;
      expect(element.compact).to.be.false;
    });

    it('should render empty state when no toolDisplay provided', async () => {
      await element.updateComplete;
      
      const container = element.shadowRoot?.querySelector('.tool-container');
      expect(container).to.not.exist;
    });

    it('should render tool use information', async () => {
      const toolDisplay: ToolUseDisplay = {
        toolUse: {
          type: 'tool_use',
          id: 'tool-1',
          name: 'Write',
          input: { file_path: 'test.js', content: 'console.log("test");' }
        },
        status: 'success',
        showDetails: true
      };

      element.toolDisplay = toolDisplay;
      await element.updateComplete;

      const container = element.shadowRoot?.querySelector('.tool-container');
      expect(container).to.exist;
      
      const toolName = element.shadowRoot?.querySelector('.tool-name');
      expect(toolName?.textContent).to.equal('Write');
    });
  });

  describe('Tool Status Display', () => {
    it('should display pending status', async () => {
      const toolDisplay: ToolUseDisplay = {
        toolUse: {
          type: 'tool_use',
          id: 'tool-1',
          name: 'Test',
          input: {}
        },
        status: 'pending',
        showDetails: true
      };

      element.toolDisplay = toolDisplay;
      await element.updateComplete;

      const status = element.shadowRoot?.querySelector('.tool-status');
      expect(status?.textContent).to.include('pending');
      
      const statusIcon = element.shadowRoot?.querySelector('.status-icon');
      expect(statusIcon?.textContent).to.equal('⏳');
    });

    it('should display executing status', async () => {
      const toolDisplay: ToolUseDisplay = {
        toolUse: {
          type: 'tool_use',
          id: 'tool-1',
          name: 'Test',
          input: {}
        },
        status: 'executing',
        showDetails: true
      };

      element.toolDisplay = toolDisplay;
      await element.updateComplete;

      const statusIcon = element.shadowRoot?.querySelector('.status-icon');
      expect(statusIcon?.textContent).to.equal('⚡');
    });

    it('should display success status', async () => {
      const toolDisplay: ToolUseDisplay = {
        toolUse: {
          type: 'tool_use',
          id: 'tool-1',
          name: 'Test',
          input: {}
        },
        status: 'success',
        showDetails: true
      };

      element.toolDisplay = toolDisplay;
      await element.updateComplete;

      const statusIcon = element.shadowRoot?.querySelector('.status-icon');
      expect(statusIcon?.textContent).to.equal('✅');
    });

    it('should display error status', async () => {
      const toolDisplay: ToolUseDisplay = {
        toolUse: {
          type: 'tool_use',
          id: 'tool-1',
          name: 'Test',
          input: {}
        },
        status: 'error',
        showDetails: true
      };

      element.toolDisplay = toolDisplay;
      await element.updateComplete;

      const statusIcon = element.shadowRoot?.querySelector('.status-icon');
      expect(statusIcon?.textContent).to.equal('❌');
    });

    it('should display timeout status', async () => {
      const toolDisplay: ToolUseDisplay = {
        toolUse: {
          type: 'tool_use',
          id: 'tool-1',
          name: 'Test',
          input: {}
        },
        status: 'timeout',
        showDetails: true
      };

      element.toolDisplay = toolDisplay;
      await element.updateComplete;

      const statusIcon = element.shadowRoot?.querySelector('.status-icon');
      expect(statusIcon?.textContent).to.equal('⏰');
    });
  });

  describe('Tool Parameters Display', () => {
    it('should display tool parameters when showDetails is true', async () => {
      const toolDisplay: ToolUseDisplay = {
        toolUse: {
          type: 'tool_use',
          id: 'tool-1',
          name: 'Write',
          input: {
            file_path: '/path/to/file.js',
            content: 'console.log("Hello, World!");'
          }
        },
        status: 'success',
        showDetails: true
      };

      element.toolDisplay = toolDisplay;
      await element.updateComplete;

      const paramsSection = element.shadowRoot?.querySelector('.params-content');
      expect(paramsSection).to.exist;
      
      const paramsText = paramsSection?.textContent || '';
      expect(paramsText).to.include('file_path');
      expect(paramsText).to.include('/path/to/file.js');
    });

    it('should hide tool parameters when showDetails is false', async () => {
      const toolDisplay: ToolUseDisplay = {
        toolUse: {
          type: 'tool_use',
          id: 'tool-1',
          name: 'Write',
          input: { file_path: '/path/to/file.js' }
        },
        status: 'success',
        showDetails: false
      };

      element.toolDisplay = toolDisplay;
      await element.updateComplete;

      const paramsSection = element.shadowRoot?.querySelector('.tool-section .section-content');
      expect(paramsSection?.classList.contains('collapsed')).to.be.true;
    });

    it('should format JSON parameters properly', async () => {
      const complexInput = {
        nested: {
          array: [1, 2, 3],
          object: { key: 'value' }
        },
        string: 'test',
        number: 42,
        boolean: true
      };

      const toolDisplay: ToolUseDisplay = {
        toolUse: {
          type: 'tool_use',
          id: 'tool-1',
          name: 'Complex',
          input: complexInput
        },
        status: 'success',
        showDetails: true
      };

      element.toolDisplay = toolDisplay;
      await element.updateComplete;

      const paramsContent = element.shadowRoot?.querySelector('.params-content pre');
      const jsonText = paramsContent?.textContent || '';
      
      // Should be formatted JSON
      expect(jsonText).to.include('nested');
      expect(jsonText).to.include('array');
      expect(jsonText).to.include('"key": "value"');
    });
  });

  describe('Tool Results Display', () => {
    it('should display successful tool result', async () => {
      const toolDisplay: ToolUseDisplay = {
        toolUse: {
          type: 'tool_use',
          id: 'tool-1',
          name: 'Write',
          input: { file_path: 'test.js' }
        },
        result: {
          type: 'tool_result',
          tool_use_id: 'tool-1',
          content: 'File created successfully',
          is_error: false
        },
        status: 'success',
        showDetails: true,
        showResult: true
      };

      element.toolDisplay = toolDisplay;
      await element.updateComplete;

      const resultSection = element.shadowRoot?.querySelector('.result-display');
      expect(resultSection).to.exist;
      expect(resultSection?.classList.contains('success')).to.be.true;
      
      const resultContent = element.shadowRoot?.querySelector('.result-content pre');
      expect(resultContent?.textContent).to.include('File created successfully');
    });

    it('should display error tool result', async () => {
      const toolDisplay: ToolUseDisplay = {
        toolUse: {
          type: 'tool_use',
          id: 'tool-1',
          name: 'Read',
          input: { file_path: 'nonexistent.js' }
        },
        result: {
          type: 'tool_result',
          tool_use_id: 'tool-1',
          content: 'Error: File not found',
          is_error: true
        },
        status: 'error',
        showDetails: true,
        showResult: true
      };

      element.toolDisplay = toolDisplay;
      await element.updateComplete;

      const resultSection = element.shadowRoot?.querySelector('.result-display');
      expect(resultSection).to.exist;
      expect(resultSection?.classList.contains('error')).to.be.true;
      
      const resultHeader = element.shadowRoot?.querySelector('.result-header');
      expect(resultHeader?.classList.contains('error')).to.be.true;
    });

    it('should format complex result objects as JSON', async () => {
      const complexResult = {
        status: 'completed',
        data: [{ id: 1, name: 'item1' }, { id: 2, name: 'item2' }],
        metadata: { count: 2, timestamp: '2023-01-01' }
      };

      const toolDisplay: ToolUseDisplay = {
        toolUse: {
          type: 'tool_use',
          id: 'tool-1',
          name: 'Query',
          input: { query: 'SELECT * FROM items' }
        },
        result: {
          type: 'tool_result',
          tool_use_id: 'tool-1',
          content: complexResult,
          is_error: false
        },
        status: 'success',
        showDetails: true,
        showResult: true
      };

      element.toolDisplay = toolDisplay;
      await element.updateComplete;

      const resultContent = element.shadowRoot?.querySelector('.result-content pre');
      const resultText = resultContent?.textContent || '';
      
      // Should be formatted JSON
      expect(resultText).to.include('status');
      expect(resultText).to.include('completed');
      expect(resultText).to.include('data');
    });

    it('should hide result when showResult is false', async () => {
      const toolDisplay: ToolUseDisplay = {
        toolUse: {
          type: 'tool_use',
          id: 'tool-1',
          name: 'Test',
          input: {}
        },
        result: {
          type: 'tool_result',
          tool_use_id: 'tool-1',
          content: 'Result',
          is_error: false
        },
        status: 'success',
        showDetails: true,
        showResult: false
      };

      element.toolDisplay = toolDisplay;
      await element.updateComplete;

      const resultSection = element.shadowRoot?.querySelector('.tool-section:last-child .section-content');
      expect(resultSection?.classList.contains('collapsed')).to.be.true;
    });
  });

  describe('Timing Information', () => {
    it('should display execution time when duration is provided', async () => {
      const toolDisplay: ToolUseDisplay = {
        toolUse: {
          type: 'tool_use',
          id: 'tool-1',
          name: 'Test',
          input: {}
        },
        status: 'success',
        duration: 1500,
        showDetails: true
      };

      element.toolDisplay = toolDisplay;
      await element.updateComplete;

      const timing = element.shadowRoot?.querySelector('.timing-info');
      expect(timing).to.exist;
      expect(timing?.textContent).to.include('1.5s');
    });

    it('should display start and end times when provided', async () => {
      const startTime = new Date('2023-01-01T12:00:00Z');
      const endTime = new Date('2023-01-01T12:00:02Z');

      const toolDisplay: ToolUseDisplay = {
        toolUse: {
          type: 'tool_use',
          id: 'tool-1',
          name: 'Test',
          input: {}
        },
        status: 'success',
        startTime,
        endTime,
        duration: 2000,
        showDetails: true
      };

      element.toolDisplay = toolDisplay;
      await element.updateComplete;

      const timing = element.shadowRoot?.querySelector('.timing-info');
      expect(timing).to.exist;
      expect(timing?.textContent).to.include('12:00:00');
    });

    it('should format durations appropriately', async () => {
      // Test milliseconds
      const toolDisplay1: ToolUseDisplay = {
        toolUse: { type: 'tool_use', id: '1', name: 'Test', input: {} },
        status: 'success',
        duration: 500,
        showDetails: true
      };

      element.toolDisplay = toolDisplay1;
      await element.updateComplete;

      let timing = element.shadowRoot?.querySelector('.timing-info');
      expect(timing?.textContent).to.include('500ms');

      // Test seconds
      const toolDisplay2: ToolUseDisplay = {
        toolUse: { type: 'tool_use', id: '2', name: 'Test', input: {} },
        status: 'success',
        duration: 2500,
        showDetails: true
      };

      element.toolDisplay = toolDisplay2;
      await element.updateComplete;

      timing = element.shadowRoot?.querySelector('.timing-info');
      expect(timing?.textContent).to.include('2.5s');
    });
  });

  describe('Collapsible Behavior', () => {
    it('should expand sections by default when not defaultCollapsed', async () => {
      const toolDisplay: ToolUseDisplay = {
        toolUse: {
          type: 'tool_use',
          id: 'tool-1',
          name: 'Test',
          input: { param: 'value' }
        },
        status: 'success',
        showDetails: true
      };

      element.toolDisplay = toolDisplay;
      element.defaultCollapsed = false;
      await element.updateComplete;

      const sectionContent = element.shadowRoot?.querySelector('.tool-section .section-content');
      expect(sectionContent?.classList.contains('collapsed')).to.be.false;
    });

    it('should collapse sections by default when defaultCollapsed is true', async () => {
      const toolDisplay: ToolUseDisplay = {
        toolUse: {
          type: 'tool_use',
          id: 'tool-1',
          name: 'Test',
          input: { param: 'value' }
        },
        status: 'success',
        showDetails: true
      };

      element.toolDisplay = toolDisplay;
      element.defaultCollapsed = true;
      await element.updateComplete;

      const sectionContent = element.shadowRoot?.querySelector('.tool-section .section-content');
      expect(sectionContent?.classList.contains('collapsed')).to.be.true;
    });

    it('should toggle section when header is clicked', async () => {
      const toolDisplay: ToolUseDisplay = {
        toolUse: {
          type: 'tool_use',
          id: 'tool-1',
          name: 'Test',
          input: { param: 'value' }
        },
        status: 'success',
        showDetails: true
      };

      element.toolDisplay = toolDisplay;
      element.collapsible = true;
      await element.updateComplete;

      const sectionHeader = element.shadowRoot?.querySelector('.section-header') as HTMLElement;
      const initialCollapsed = element.shadowRoot?.querySelector('.section-content')?.classList.contains('collapsed');
      
      sectionHeader?.click();
      await element.updateComplete;
      
      const afterClickCollapsed = element.shadowRoot?.querySelector('.section-content')?.classList.contains('collapsed');
      expect(afterClickCollapsed).to.not.equal(initialCollapsed);
    });

    it('should not be clickable when collapsible is false', async () => {
      const toolDisplay: ToolUseDisplay = {
        toolUse: {
          type: 'tool_use',
          id: 'tool-1',
          name: 'Test',
          input: {}
        },
        status: 'success',
        showDetails: true
      };

      element.toolDisplay = toolDisplay;
      element.collapsible = false;
      await element.updateComplete;

      const header = element.shadowRoot?.querySelector('.tool-header');
      expect(header?.classList.contains('non-interactive')).to.be.true;
    });
  });

  describe('Compact Mode', () => {
    it('should apply compact styling', async () => {
      const toolDisplay: ToolUseDisplay = {
        toolUse: {
          type: 'tool_use',
          id: 'tool-1',
          name: 'Test',
          input: {}
        },
        status: 'success',
        showDetails: true
      };

      element.toolDisplay = toolDisplay;
      element.compact = true;
      await element.updateComplete;

      const container = element.shadowRoot?.querySelector('.tool-container');
      expect(container?.classList.contains('compact')).to.be.true;
    });

    it('should hide detailed information in compact mode', async () => {
      const toolDisplay: ToolUseDisplay = {
        toolUse: {
          type: 'tool_use',
          id: 'tool-1',
          name: 'Test',
          input: { complex: 'parameters' }
        },
        status: 'success',
        duration: 1000,
        showDetails: true
      };

      element.toolDisplay = toolDisplay;
      element.compact = true;
      await element.updateComplete;

      // In compact mode, detailed sections should be more condensed
      const container = element.shadowRoot?.querySelector('.tool-container.compact');
      expect(container).to.exist;
    });
  });

  describe('Error Handling', () => {
    it('should handle missing tool use gracefully', async () => {
      const toolDisplay = {
        status: 'error' as ToolStatus,
        showDetails: true
      };

      element.toolDisplay = toolDisplay as any;
      
      // Should not throw
      await expect(element.updateComplete).to.not.be.rejected;
    });

    it('should handle malformed tool input', async () => {
      const toolDisplay: ToolUseDisplay = {
        toolUse: {
          type: 'tool_use',
          id: 'tool-1',
          name: 'Test',
          input: null as any // Invalid input
        },
        status: 'error',
        showDetails: true
      };

      element.toolDisplay = toolDisplay;
      
      // Should render without crashing
      await expect(element.updateComplete).to.not.be.rejected;
      
      const container = element.shadowRoot?.querySelector('.tool-container');
      expect(container).to.exist;
    });

    it('should handle circular references in parameters', async () => {
      const circularObj: any = { name: 'test' };
      circularObj.self = circularObj;

      const toolDisplay: ToolUseDisplay = {
        toolUse: {
          type: 'tool_use',
          id: 'tool-1',
          name: 'Test',
          input: circularObj
        },
        status: 'error',
        showDetails: true
      };

      element.toolDisplay = toolDisplay;
      
      // Should handle JSON.stringify error gracefully
      await expect(element.updateComplete).to.not.be.rejected;
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes for collapsible sections', async () => {
      const toolDisplay: ToolUseDisplay = {
        toolUse: {
          type: 'tool_use',
          id: 'tool-1',
          name: 'Test',
          input: {}
        },
        status: 'success',
        showDetails: true
      };

      element.toolDisplay = toolDisplay;
      element.collapsible = true;
      await element.updateComplete;

      const sectionHeader = element.shadowRoot?.querySelector('.section-header');
      expect(sectionHeader).to.have.attribute('role', 'button');
      expect(sectionHeader).to.have.attribute('aria-expanded');
    });

    it('should provide proper status information for screen readers', async () => {
      const toolDisplay: ToolUseDisplay = {
        toolUse: {
          type: 'tool_use',
          id: 'tool-1',
          name: 'Test',
          input: {}
        },
        status: 'error',
        showDetails: true
      };

      element.toolDisplay = toolDisplay;
      await element.updateComplete;

      const statusElement = element.shadowRoot?.querySelector('.tool-status');
      expect(statusElement).to.exist;
      expect(statusElement?.textContent).to.include('error');
    });
  });
});