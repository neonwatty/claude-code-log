import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fixture, html } from '@open-wc/testing';
import { BranchVisualization } from '../BranchVisualization';
import { SessionBranchTree, SessionSummary } from '../../types/session-types';

// Mock WebSocket client
vi.mock('../../../services/websocket-branch-client');

// Mock data for testing
const mockRootSession: SessionSummary = {
  sessionId: 'root-session-123',
  title: 'Main Session',
  cwd: '/test/project',
  startTime: new Date('2024-01-01T10:00:00Z'),
  messageCount: 10,
  userMessageCount: 5,
  assistantMessageCount: 5,
  isActive: true,
  parentSessionId: null,
  branchPoint: null,
  branchTimestamp: null,
};

const mockBranchSession: SessionSummary = {
  sessionId: 'branch-session-456',
  title: 'Feature Branch',
  cwd: '/test/project',
  startTime: new Date('2024-01-01T11:00:00Z'),
  messageCount: 7,
  userMessageCount: 3,
  assistantMessageCount: 4,
  isActive: false,
  parentSessionId: 'root-session-123',
  branchPoint: 3,
  branchTimestamp: new Date('2024-01-01T11:00:00Z'),
  branchMetadata: {
    branchName: 'New Feature',
    branchReason: 'Adding authentication',
    originalMessage: 'Let me implement the login system'
  }
};

const mockBranchTree: SessionBranchTree = {
  rootSession: mockRootSession,
  branches: [{
    rootSession: mockBranchSession,
    branches: [],
    depth: 1
  }],
  depth: 0
};

const mockComplexBranchTree: SessionBranchTree = {
  rootSession: mockRootSession,
  branches: [
    {
      rootSession: mockBranchSession,
      branches: [{
        rootSession: {
          ...mockBranchSession,
          sessionId: 'nested-branch-789',
          title: 'Nested Branch',
          parentSessionId: 'branch-session-456',
          branchPoint: 2,
          branchMetadata: {
            branchName: 'Nested Feature',
            branchReason: 'Sub-implementation'
          }
        },
        branches: [],
        depth: 2
      }],
      depth: 1
    },
    {
      rootSession: {
        ...mockBranchSession,
        sessionId: 'second-branch-999',
        title: 'Second Branch',
        parentSessionId: 'root-session-123',
        branchPoint: 5,
        branchMetadata: {
          branchName: 'Bug Fix',
          branchReason: 'Fixing login issue'
        }
      },
      branches: [],
      depth: 1
    }
  ],
  depth: 0
};

describe('BranchVisualization', () => {
  let element: BranchVisualization;

  beforeEach(async () => {
    element = await fixture(html`
      <branch-visualization
        .branchTree=${mockBranchTree}
        .currentSessionId=${'root-session-123'}
        .rootSessionId=${'root-session-123'}
      ></branch-visualization>
    `);
  });

  describe('Component Initialization', () => {
    it('should create element', () => {
      expect(element).toBeInstanceOf(BranchVisualization);
    });

    it('should have correct tag name', () => {
      expect(element.tagName.toLowerCase()).toBe('branch-visualization');
    });

    it('should be accessible', () => {
      expect(element).to.exist;
      expect(element.getAttribute('role')).toBe('region');
    });
  });

  describe('Property Handling', () => {
    it('should accept branchTree property', () => {
      expect(element.branchTree).toEqual(mockBranchTree);
    });

    it('should accept currentSessionId property', () => {
      expect(element.currentSessionId).toBe('root-session-123');
    });

    it('should accept rootSessionId property', () => {
      expect(element.rootSessionId).toBe('root-session-123');
    });

    it('should have default configuration properties', () => {
      expect(element.enableWebSocket).toBe(false);
      expect(element.autoLayout).toBe(true);
      expect(element.nodeSize).toBe(16);
      expect(element.levelSpacing).toBe(120);
      expect(element.nodeSpacing).toBe(60);
    });
  });

  describe('Rendering', () => {
    it('should render header', () => {
      const header = element.shadowRoot?.querySelector('.visualization-header');
      expect(header).to.exist;
      
      const title = header?.querySelector('.header-title');
      expect(title?.textContent).toBe('Session Branch Tree');
    });

    it('should render SVG visualization', () => {
      const svg = element.shadowRoot?.querySelector('.tree-svg');
      expect(svg).to.exist;
      expect(svg?.getAttribute('role')).toBe('img');
    });

    it('should render session nodes', async () => {
      await element.updateComplete;
      
      const nodes = element.shadowRoot?.querySelectorAll('.session-node');
      expect(nodes).to.have.length(2); // Root + 1 branch
    });

    it('should render branch edges', async () => {
      await element.updateComplete;
      
      const edges = element.shadowRoot?.querySelectorAll('.branch-line');
      expect(edges).to.have.length(1); // One edge from root to branch
    });

    it('should render controls', () => {
      const controls = element.shadowRoot?.querySelector('.controls');
      expect(controls).to.exist;
      
      const buttons = controls?.querySelectorAll('.control-button');
      expect(buttons).to.have.length(3); // Zoom in, out, reset
    });
  });

  describe('Empty States', () => {
    it('should handle null branch tree', async () => {
      const emptyElement = await fixture(html`
        <branch-visualization .branchTree=${null}></branch-visualization>
      `);

      const emptyState = emptyElement.shadowRoot?.querySelector('.empty-state');
      expect(emptyState).to.exist;
      expect(emptyState?.textContent).toContain('No Branch Tree Available');
    });

    it('should handle empty branches', async () => {
      const singleNodeTree: SessionBranchTree = {
        rootSession: mockRootSession,
        branches: [],
        depth: 0
      };

      const singleNodeElement = await fixture(html`
        <branch-visualization .branchTree=${singleNodeTree}></branch-visualization>
      `);

      await singleNodeElement.updateComplete;
      
      const nodes = singleNodeElement.shadowRoot?.querySelectorAll('.session-node');
      expect(nodes).to.have.length(1); // Only root node
      
      const edges = singleNodeElement.shadowRoot?.querySelectorAll('.branch-line');
      expect(edges).to.have.length(0); // No edges
    });
  });

  describe('Interaction Handling', () => {
    it('should emit session-navigate event on node click', async () => {
      let eventFired = false;
      let eventDetail: any = null;

      element.addEventListener('session-navigate', ((event: CustomEvent) => {
        eventFired = true;
        eventDetail = event.detail;
      }) as EventListener);

      await element.updateComplete;
      
      const firstNode = element.shadowRoot?.querySelector('.session-node') as SVGElement;
      expect(firstNode).to.exist;
      
      // Simulate click event on SVG element
      const clickEvent = new MouseEvent('click', { bubbles: true });
      firstNode.dispatchEvent(clickEvent);
      
      expect(eventFired).toBe(true);
      expect(eventDetail.toSessionId).toBe('root-session-123');
    });

    it('should handle keyboard navigation', async () => {
      let eventFired = false;
      
      element.addEventListener('session-navigate', (() => {
        eventFired = true;
      }) as EventListener);

      await element.updateComplete;
      
      const firstNode = element.shadowRoot?.querySelector('.session-node') as SVGElement;
      expect(firstNode).to.exist;
      
      // Simulate Enter key press
      const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });
      firstNode.dispatchEvent(enterEvent);
      
      expect(eventFired).toBe(true);
    });

    it('should handle Space key navigation', async () => {
      let eventFired = false;
      
      element.addEventListener('session-navigate', (() => {
        eventFired = true;
      }) as EventListener);

      await element.updateComplete;
      
      const firstNode = element.shadowRoot?.querySelector('.session-node') as SVGElement;
      expect(firstNode).to.exist;
      
      // Simulate Space key press
      const spaceEvent = new KeyboardEvent('keydown', { key: ' ' });
      firstNode.dispatchEvent(spaceEvent);
      
      expect(eventFired).toBe(true);
    });
  });

  describe('Layout Algorithm', () => {
    it('should calculate layout for simple tree', async () => {
      await element.updateComplete;
      
      const nodes = element.shadowRoot?.querySelectorAll('.session-node');
      expect(nodes).to.have.length(2);
      
      // Check that nodes have different positions
      const nodePositions = Array.from(nodes || []).map(node => ({
        x: parseFloat(node.querySelector('.node-circle')?.getAttribute('cx') || '0'),
        y: parseFloat(node.querySelector('.node-circle')?.getAttribute('cy') || '0')
      }));
      
      expect(nodePositions[0].x).not.toBe(nodePositions[1].x);
    });

    it('should handle complex tree layout', async () => {
      const complexElement = await fixture(html`
        <branch-visualization
          .branchTree=${mockComplexBranchTree}
          .currentSessionId=${'root-session-123'}
        ></branch-visualization>
      `);

      await complexElement.updateComplete;
      
      const nodes = complexElement.shadowRoot?.querySelectorAll('.session-node');
      expect(nodes).to.have.length(4); // Root + 2 branches + 1 nested
    });

    it('should calculate proper SVG dimensions', async () => {
      const complexElement = await fixture(html`
        <branch-visualization .branchTree=${mockComplexBranchTree}></branch-visualization>
      `);

      await complexElement.updateComplete;
      
      const svg = complexElement.shadowRoot?.querySelector('.tree-svg');
      const width = parseFloat(svg?.getAttribute('width') || '0');
      const height = parseFloat(svg?.getAttribute('height') || '0');
      
      expect(width).toBeGreaterThan(0);
      expect(height).toBeGreaterThan(0);
    });
  });

  describe('Hover Interactions', () => {
    it('should show tooltip on node hover', async () => {
      await element.updateComplete;
      
      const firstNode = element.shadowRoot?.querySelector('.session-node') as SVGElement;
      expect(firstNode).to.exist;
      
      // Simulate mouseenter
      const mouseEnterEvent = new MouseEvent('mouseenter', {
        bubbles: true,
        clientX: 100,
        clientY: 100
      });
      firstNode.dispatchEvent(mouseEnterEvent);
      
      await element.updateComplete;
      
      const tooltip = element.shadowRoot?.querySelector('.tooltip.visible');
      expect(tooltip).to.exist;
    });

    it('should hide tooltip on mouse leave', async () => {
      await element.updateComplete;
      
      const firstNode = element.shadowRoot?.querySelector('.session-node') as SVGElement;
      
      // Show tooltip first
      const mouseEnterEvent = new MouseEvent('mouseenter', {
        bubbles: true,
        clientX: 100,
        clientY: 100
      });
      firstNode.dispatchEvent(mouseEnterEvent);
      await element.updateComplete;
      
      // Hide tooltip
      const mouseLeaveEvent = new MouseEvent('mouseleave');
      firstNode.dispatchEvent(mouseLeaveEvent);
      await element.updateComplete;
      
      const tooltip = element.shadowRoot?.querySelector('.tooltip.visible');
      expect(tooltip).not.to.exist;
    });
  });

  describe('Control Functions', () => {
    it('should handle zoom in', async () => {
      await element.updateComplete;
      
      const svg = element.shadowRoot?.querySelector('.tree-svg');
      const initialWidth = parseFloat(svg?.getAttribute('width') || '800');
      
      const zoomInButton = element.shadowRoot?.querySelector('.control-button[title="Zoom In"]') as HTMLButtonElement;
      expect(zoomInButton).to.exist;
      
      zoomInButton.click();
      await element.updateComplete;
      
      const newWidth = parseFloat(svg?.getAttribute('width') || '800');
      expect(newWidth).toBeGreaterThan(initialWidth);
    });

    it('should handle zoom out', async () => {
      await element.updateComplete;
      
      const svg = element.shadowRoot?.querySelector('.tree-svg');
      const initialWidth = parseFloat(svg?.getAttribute('width') || '800');
      
      const zoomOutButton = element.shadowRoot?.querySelector('.control-button[title="Zoom Out"]') as HTMLButtonElement;
      expect(zoomOutButton).to.exist;
      
      zoomOutButton.click();
      await element.updateComplete;
      
      const newWidth = parseFloat(svg?.getAttribute('width') || '800');
      expect(newWidth).toBeLessThan(initialWidth);
    });

    it('should handle reset zoom', async () => {
      await element.updateComplete;
      
      // First zoom in
      const zoomInButton = element.shadowRoot?.querySelector('.control-button[title="Zoom In"]') as HTMLButtonElement;
      zoomInButton.click();
      await element.updateComplete;
      
      // Then reset
      const resetButton = element.shadowRoot?.querySelector('.control-button[title="Reset Zoom"]') as HTMLButtonElement;
      expect(resetButton).to.exist;
      
      resetButton.click();
      await element.updateComplete;
      
      const svg = element.shadowRoot?.querySelector('.tree-svg');
      const width = parseFloat(svg?.getAttribute('width') || '0');
      expect(width).toBeGreaterThanOrEqual(800);
    });
  });

  describe('Node Styling', () => {
    it('should apply current session styling', async () => {
      await element.updateComplete;
      
      const currentNode = element.shadowRoot?.querySelector('.session-node.current');
      expect(currentNode).to.exist;
    });

    it('should apply root node styling', async () => {
      await element.updateComplete;
      
      const rootNode = element.shadowRoot?.querySelector('.node-circle.root');
      expect(rootNode).to.exist;
    });

    it('should apply branch node styling', async () => {
      await element.updateComplete;
      
      const branchNode = element.shadowRoot?.querySelector('.node-circle.branch');
      expect(branchNode).to.exist;
    });

    it('should apply active/inactive styling based on session status', async () => {
      await element.updateComplete;
      
      const activeNode = element.shadowRoot?.querySelector('.node-circle.active');
      const inactiveNode = element.shadowRoot?.querySelector('.node-circle.inactive');
      
      expect(activeNode).to.exist; // Root session is active
      expect(inactiveNode).to.exist; // Branch session is inactive
    });
  });

  describe('Branch Point Indicators', () => {
    it('should render branch point indicators on edges', async () => {
      await element.updateComplete;
      
      const branchPoints = element.shadowRoot?.querySelectorAll('.branch-point');
      expect(branchPoints).to.have.length(1);
    });

    it('should have branch point tooltips', async () => {
      await element.updateComplete;
      
      const branchPoint = element.shadowRoot?.querySelector('.branch-point');
      expect(branchPoint?.getAttribute('title')).toContain('Branch point');
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', async () => {
      await element.updateComplete;
      
      const svg = element.shadowRoot?.querySelector('.tree-svg');
      expect(svg?.getAttribute('aria-label')).toBe('Session branch tree visualization');
      
      const nodes = element.shadowRoot?.querySelectorAll('.session-node');
      nodes?.forEach(node => {
        expect(node.getAttribute('role')).toBe('button');
        expect(node.getAttribute('aria-label')).toContain('Session');
      });
    });

    it('should be keyboard navigable', async () => {
      await element.updateComplete;
      
      const nodes = element.shadowRoot?.querySelectorAll('.session-node');
      nodes?.forEach(node => {
        expect(node.getAttribute('tabindex')).toBe('0');
      });
    });

    it('should have focus indicators', () => {
      const styles = element.constructor.styles?.[1]?.toString() || '';
      expect(styles).toContain('focus');
      expect(styles).toContain('outline');
    });
  });

  describe('Statistical Information', () => {
    it('should display session count in header', async () => {
      await element.updateComplete;
      
      const subtitle = element.shadowRoot?.querySelector('.header-subtitle');
      expect(subtitle?.textContent).toContain('2 sessions in tree');
    });

    it('should calculate total sessions correctly for complex trees', async () => {
      const complexElement = await fixture(html`
        <branch-visualization .branchTree=${mockComplexBranchTree}></branch-visualization>
      `);

      await complexElement.updateComplete;
      
      const subtitle = complexElement.shadowRoot?.querySelector('.header-subtitle');
      expect(subtitle?.textContent).toContain('4 sessions in tree');
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed branch tree data gracefully', async () => {
      const malformedTree = {
        rootSession: null,
        branches: [],
        depth: 0
      } as any;

      const errorElement = await fixture(html`
        <branch-visualization .branchTree=${malformedTree}></branch-visualization>
      `);

      await errorElement.updateComplete;

      // Should render empty state instead of crashing
      const emptyState = errorElement.shadowRoot?.querySelector('.empty-state');
      expect(emptyState).to.exist;
    });

    it('should handle missing session data gracefully', async () => {
      const incompleteTree = {
        rootSession: {
          sessionId: 'test',
          // Missing other required fields
        },
        branches: [],
        depth: 0
      } as any;

      const errorElement = await fixture(html`
        <branch-visualization .branchTree=${incompleteTree}></branch-visualization>
      `);

      // Should not crash
      expect(errorElement).to.exist;
    });
  });
});

// Test the component can be imported and used
describe('BranchVisualization Import', () => {
  it('should be importable', () => {
    expect(BranchVisualization).toBeDefined();
  });

  it('should be a custom element', () => {
    expect(customElements.get('branch-visualization')).toBeDefined();
  });
});