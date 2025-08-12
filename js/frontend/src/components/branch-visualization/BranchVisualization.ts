import { html, css, CSSResultGroup, TemplateResult, svg, SVGTemplateResult } from 'lit';
import { customElement, property, state, query } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { styleMap } from 'lit/directives/style-map.js';
import { BaseComponent } from '../base/BaseComponent';
import { baseStyles } from '../styles/theme';
import { 
  SessionSummary,
  SessionBranchTree,
  ComponentEvents
} from '../types/session-types';
import { AriaRoles, AriaAttributes, generateId } from '../utils/accessibility';
import WebSocketBranchClient, { BranchNotificationData } from '../../services/websocket-branch-client';

/**
 * Interactive branch tree visualization component using SVG.
 * Displays session branches as a tree structure with navigation capabilities.
 */
@customElement('branch-visualization')
export class BranchVisualization extends BaseComponent {
  static styles: CSSResultGroup = [
    baseStyles,
    css`
      :host {
        display: block;
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius);
        background: var(--color-background);
        overflow: hidden;
      }

      .visualization-header {
        background: var(--color-background-secondary);
        border-bottom: 1px solid var(--color-border-light);
        padding: var(--space-md);
      }

      .header-title {
        font-weight: var(--font-weight-medium);
        color: var(--color-text-primary);
        margin: 0 0 var(--space-xs) 0;
        font-size: var(--font-size-md);
      }

      .header-subtitle {
        color: var(--color-text-muted);
        font-size: var(--font-size-sm);
        margin: 0;
      }

      .visualization-container {
        position: relative;
        width: 100%;
        height: 400px;
        overflow: auto;
        background: var(--color-background);
      }

      .tree-svg {
        display: block;
        width: 100%;
        min-height: 400px;
        background: var(--color-background);
      }

      .session-node {
        cursor: pointer;
        transition: all var(--transition-fast);
      }

      .session-node:hover .node-circle {
        r: 12;
        stroke-width: 3;
      }

      .session-node:focus {
        outline: 2px solid var(--color-focus);
        outline-offset: 2px;
      }

      .session-node.current {
        filter: drop-shadow(0 0 8px var(--color-primary));
      }

      .session-node.current .node-circle {
        stroke: var(--color-primary);
        stroke-width: 3;
      }

      .node-circle {
        r: 8;
        stroke: var(--color-border);
        stroke-width: 2;
        transition: all var(--transition-fast);
      }

      .node-circle.root {
        fill: var(--color-primary);
      }

      .node-circle.branch {
        fill: var(--color-secondary);
      }

      .node-circle.active {
        fill: var(--color-success);
      }

      .node-circle.inactive {
        fill: var(--color-muted);
      }

      .node-label {
        font-size: var(--font-size-sm);
        fill: var(--color-text-primary);
        text-anchor: middle;
        dominant-baseline: central;
        pointer-events: none;
      }

      .node-metadata {
        font-size: var(--font-size-xs);
        fill: var(--color-text-muted);
        text-anchor: middle;
        dominant-baseline: central;
        pointer-events: none;
      }

      .branch-line {
        stroke: var(--color-border);
        stroke-width: 2;
        fill: none;
        transition: stroke var(--transition-fast);
      }

      .branch-line.highlighted {
        stroke: var(--color-primary);
        stroke-width: 3;
      }

      .branch-point {
        fill: var(--color-warning);
        stroke: var(--color-warning-dark);
        stroke-width: 1;
        r: 3;
      }

      .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 300px;
        color: var(--color-text-muted);
        text-align: center;
        padding: var(--space-lg);
      }

      .empty-state-icon {
        width: 48px;
        height: 48px;
        opacity: 0.5;
        margin-bottom: var(--space-md);
      }

      .empty-state-title {
        font-weight: var(--font-weight-medium);
        margin-bottom: var(--space-sm);
        color: var(--color-text-secondary);
      }

      .empty-state-description {
        max-width: 300px;
        line-height: 1.5;
      }

      .tooltip {
        position: absolute;
        background: var(--color-background-tooltip);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius);
        padding: var(--space-sm);
        font-size: var(--font-size-sm);
        color: var(--color-text-primary);
        box-shadow: var(--shadow-md);
        pointer-events: none;
        z-index: 10;
        max-width: 200px;
        opacity: 0;
        transition: opacity var(--transition-fast);
      }

      .tooltip.visible {
        opacity: 1;
      }

      .controls {
        position: absolute;
        top: var(--space-sm);
        right: var(--space-sm);
        display: flex;
        gap: var(--space-xs);
      }

      .control-button {
        background: var(--color-background-secondary);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius);
        padding: var(--space-xs);
        cursor: pointer;
        transition: all var(--transition-fast);
        color: var(--color-text-primary);
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
      }

      .control-button:hover {
        background: var(--color-background-hover);
        border-color: var(--color-border-hover);
      }

      .control-button:focus {
        outline: 2px solid var(--color-focus);
        outline-offset: 1px;
      }

      .websocket-status {
        position: absolute;
        bottom: var(--space-sm);
        left: var(--space-sm);
        font-size: var(--font-size-xs);
        color: var(--color-text-muted);
        display: flex;
        align-items: center;
        gap: var(--space-xs);
      }

      .status-indicator {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--color-muted);
      }

      .status-indicator.connected {
        background: var(--color-success);
      }

      .status-indicator.disconnected {
        background: var(--color-error);
      }

      /* Animation for real-time updates */
      @keyframes nodeUpdate {
        0% { transform: scale(1); }
        50% { transform: scale(1.2); }
        100% { transform: scale(1); }
      }

      .node-updated {
        animation: nodeUpdate 0.6s ease-out;
      }

      /* Accessibility improvements */
      .session-node:focus-visible {
        outline: 3px solid var(--color-focus);
        outline-offset: 3px;
      }

      /* High contrast mode support */
      @media (prefers-contrast: high) {
        .node-circle {
          stroke-width: 3;
        }
        
        .branch-line {
          stroke-width: 3;
        }
      }

      /* Reduced motion support */
      @media (prefers-reduced-motion: reduce) {
        .session-node,
        .node-circle,
        .branch-line,
        .tooltip {
          transition: none;
        }
        
        .node-updated {
          animation: none;
        }
      }
    `
  ];

  // Component properties
  @property({ type: Object })
  branchTree: SessionBranchTree | null = null;

  @property({ type: String })
  currentSessionId: string | null = null;

  @property({ type: String })
  rootSessionId: string | null = null;

  @property({ type: Boolean, attribute: 'enable-websocket' })
  enableWebSocket = false;

  @property({ type: String, attribute: 'websocket-url' })
  websocketUrl = 'ws://localhost:3001';

  @property({ type: String, attribute: 'api-url' })
  apiUrl = 'http://localhost:3001/api';

  @property({ type: Boolean, attribute: 'auto-layout' })
  autoLayout = true;

  @property({ type: Number })
  nodeSize = 16;

  @property({ type: Number })
  levelSpacing = 120;

  @property({ type: Number })
  nodeSpacing = 60;

  // Internal state
  @state()
  private layoutData: TreeLayoutData | null = null;

  @state()
  private hoveredNode: string | null = null;

  @state()
  private tooltipData: TooltipData | null = null;

  @state()
  private websocketConnected = false;

  @state()
  private svgWidth = 800;

  @state()
  private svgHeight = 400;

  // Element references
  @query('.tree-svg')
  private svgElement!: SVGElement;

  @query('.tooltip')
  private tooltipElement!: HTMLElement;

  // WebSocket client
  private webSocketClient: WebSocketBranchClient | null = null;
  private componentId = generateId('branch-vis');

  // Layout calculation methods
  private calculateLayout(): TreeLayoutData | null {
    if (!this.branchTree?.rootSession?.sessionId) {
      return null;
    }

    const layout: TreeLayoutData = {
      nodes: new Map(),
      edges: [],
      bounds: { width: 0, height: 0 }
    };

    // Calculate positions using a tree layout algorithm
    this.layoutTreeRecursive(this.branchTree, layout, 0, 0, 0);

    // Calculate SVG bounds
    const positions = Array.from(layout.nodes.values());
    if (positions.length > 0) {
      const minX = Math.min(...positions.map(p => p.x));
      const maxX = Math.max(...positions.map(p => p.x));
      const minY = Math.min(...positions.map(p => p.y));
      const maxY = Math.max(...positions.map(p => p.y));

      layout.bounds = {
        width: Math.max(800, maxX - minX + this.levelSpacing * 2),
        height: Math.max(400, maxY - minY + this.nodeSpacing * 2)
      };

      // Adjust positions to be within bounds
      const offsetX = Math.max(this.levelSpacing, -minX + this.levelSpacing);
      const offsetY = Math.max(this.nodeSpacing, -minY + this.nodeSpacing);

      for (const position of positions) {
        position.x += offsetX;
        position.y += offsetY;
      }
    }

    return layout;
  }

  private layoutTreeRecursive(
    tree: SessionBranchTree, 
    layout: TreeLayoutData, 
    level: number, 
    parentX: number, 
    parentY: number
  ): number {
    if (!tree?.rootSession?.sessionId) {
      return parentY;
    }
    const sessionId = tree.rootSession.sessionId;
    const x = level * this.levelSpacing;
    
    // Calculate Y position based on siblings
    const childCount = tree.branches.length;
    const startY = parentY - ((childCount - 1) * this.nodeSpacing) / 2;

    layout.nodes.set(sessionId, {
      x,
      y: level === 0 ? 0 : startY,
      session: tree.rootSession,
      depth: level,
      isRoot: level === 0,
      children: tree.branches.map(branch => branch.rootSession.sessionId)
    });

    // Add edge from parent if not root
    if (level > 0) {
      layout.edges.push({
        from: { x: parentX, y: parentY },
        to: { x, y: startY },
        parentSession: sessionId,
        branchPoint: tree.rootSession.branchPoint || 0
      });
    }

    // Layout children
    let currentY = startY;
    for (const branch of tree.branches) {
      currentY = this.layoutTreeRecursive(
        branch,
        layout,
        level + 1,
        x,
        currentY
      );
      currentY += this.nodeSpacing;
    }

    return currentY;
  }

  // WebSocket integration
  private initializeWebSocket(): void {
    if (!this.enableWebSocket || this.webSocketClient) {
      return;
    }

    try {
      this.webSocketClient = new WebSocketBranchClient(this.websocketUrl);
      
      this.webSocketClient.onBranchCreated((data: BranchNotificationData) => {
        this.handleBranchNotification('branch-created', data);
      });

      this.webSocketClient.onBranchTreeUpdated((data: BranchNotificationData) => {
        this.handleBranchNotification('branch-tree-updated', data);
      });

      this.webSocketClient.onError((error) => {
        console.warn('WebSocket error in branch visualization:', error);
        this.websocketConnected = false;
      });

      // Connect and join session if we have a root session
      if (this.rootSessionId) {
        this.webSocketClient.connect('branch-viz-user', this.rootSessionId);
        this.websocketConnected = true;
      }
    } catch (error) {
      console.error('Failed to initialize WebSocket client:', error);
      this.websocketConnected = false;
    }
  }

  private handleBranchNotification(type: string, data: BranchNotificationData): void {
    // Trigger re-layout and update
    this.dispatchEvent(new CustomEvent('branch-tree-updated', {
      detail: {
        type,
        data,
        timestamp: new Date()
      },
      bubbles: true
    }));

    // Update layout
    if (this.autoLayout) {
      this.updateLayout();
    }

    // Animate the updated node
    this.animateNodeUpdate(data.branchSession.id);
  }

  private animateNodeUpdate(sessionId: string): void {
    const nodeElement = this.shadowRoot?.querySelector(`.session-node[data-session-id="${sessionId}"]`);
    if (nodeElement) {
      nodeElement.classList.add('node-updated');
      setTimeout(() => {
        nodeElement.classList.remove('node-updated');
      }, 600);
    }
  }

  // Event handlers
  private handleNodeClick(sessionId: string, session: SessionSummary): void {
    this.dispatchEvent(new CustomEvent('session-navigate', {
      detail: {
        fromSessionId: this.currentSessionId,
        toSessionId: sessionId,
        session
      },
      bubbles: true
    }));
  }

  private handleNodeMouseEnter(event: MouseEvent, sessionId: string, session: SessionSummary): void {
    this.hoveredNode = sessionId;
    
    const target = event.target as SVGElement;
    const rect = target.getBoundingClientRect();
    const containerRect = this.getBoundingClientRect();
    
    this.tooltipData = {
      session,
      x: rect.left - containerRect.left + rect.width / 2,
      y: rect.top - containerRect.top - 10
    };
  }

  private handleNodeMouseLeave(): void {
    this.hoveredNode = null;
    this.tooltipData = null;
  }

  private handleNodeKeyDown(event: KeyboardEvent, sessionId: string, session: SessionSummary): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.handleNodeClick(sessionId, session);
    }
  }

  // Control handlers
  private handleZoomIn(): void {
    this.svgWidth *= 1.2;
    this.svgHeight *= 1.2;
  }

  private handleZoomOut(): void {
    this.svgWidth *= 0.8;
    this.svgHeight *= 0.8;
  }

  private handleResetZoom(): void {
    this.svgWidth = 800;
    this.svgHeight = 400;
    this.updateLayout();
  }

  private updateLayout(): void {
    this.layoutData = this.calculateLayout();
    if (this.layoutData) {
      this.svgWidth = this.layoutData.bounds.width;
      this.svgHeight = this.layoutData.bounds.height;
    }
  }

  // Lifecycle methods
  connectedCallback(): void {
    super.connectedCallback();
    this.updateLayout();
    this.initializeWebSocket();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this.webSocketClient) {
      this.webSocketClient.disconnect();
      this.webSocketClient = null;
    }
  }

  willUpdate(changedProperties: Map<string, any>): void {
    super.willUpdate(changedProperties);

    if (changedProperties.has('branchTree')) {
      this.updateLayout();
    }

    if (changedProperties.has('rootSessionId') && this.webSocketClient && this.rootSessionId) {
      this.webSocketClient.joinSession(this.rootSessionId);
    }
  }

  // Render methods
  private renderEmptyState(): TemplateResult {
    return html`
      <div class="empty-state">
        <svg class="empty-state-icon" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
        </svg>
        <div class="empty-state-title">No Branch Tree Available</div>
        <div class="empty-state-description">
          Load a session with branches to view the branch tree visualization.
        </div>
      </div>
    `;
  }

  private renderTreeVisualization(): TemplateResult {
    if (!this.layoutData) {
      return this.renderEmptyState();
    }

    return html`
      <div class="visualization-container">
        ${this.renderSVG()}
        ${this.renderControls()}
        ${this.renderTooltip()}
        ${this.renderWebSocketStatus()}
      </div>
    `;
  }

  private renderSVG(): TemplateResult {
    if (!this.layoutData) {
      return html``;
    }

    return html`
      <svg 
        class="tree-svg"
        width="${this.svgWidth}"
        height="${this.svgHeight}"
        viewBox="0 0 ${this.svgWidth} ${this.svgHeight}"
        role="img"
        aria-label="Session branch tree visualization"
      >
        <defs>
          <marker id="arrowhead" markerWidth="10" markerHeight="7" 
                  refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="var(--color-border)" />
          </marker>
        </defs>
        
        <!-- Render edges -->
        ${this.layoutData.edges.map(edge => this.renderEdge(edge))}
        
        <!-- Render nodes -->
        ${Array.from(this.layoutData.nodes.entries()).map(([sessionId, node]) => 
          this.renderNode(sessionId, node)
        )}
      </svg>
    `;
  }

  private renderEdge(edge: TreeEdge): SVGTemplateResult {
    const isHighlighted = this.hoveredNode && 
      (this.layoutData?.nodes.get(this.hoveredNode)?.children.length || 0) > 0;

    return svg`
      <line
        class=${classMap({
          'branch-line': true,
          'highlighted': !!isHighlighted
        })}
        x1="${edge.from.x}"
        y1="${edge.from.y}"
        x2="${edge.to.x}"
        y2="${edge.to.y}"
        marker-end="url(#arrowhead)"
      />
      <!-- Branch point indicator -->
      <circle
        class="branch-point"
        cx="${edge.from.x + (edge.to.x - edge.from.x) * 0.1}"
        cy="${edge.from.y + (edge.to.y - edge.from.y) * 0.1}"
        r="3"
        title="Branch point ${edge.branchPoint}"
      />
    `;
  }

  private renderNode(sessionId: string, node: TreeNodeData): SVGTemplateResult {
    const isCurrent = sessionId === this.currentSessionId;
    const isHovered = sessionId === this.hoveredNode;
    const session = node.session;

    const nodeClass = classMap({
      'session-node': true,
      'current': isCurrent,
      'hovered': isHovered
    });

    const circleClass = classMap({
      'node-circle': true,
      'root': node.isRoot,
      'branch': !node.isRoot,
      'active': session.isActive,
      'inactive': !session.isActive
    });

    return svg`
      <g 
        class="${nodeClass}"
        data-session-id="${sessionId}"
        tabindex="0"
        role="button"
        aria-label="Session ${session.title || sessionId}: ${session.messageCount} messages"
        @click="${() => this.handleNodeClick(sessionId, session)}"
        @mouseenter="${(e: MouseEvent) => this.handleNodeMouseEnter(e, sessionId, session)}"
        @mouseleave="${() => this.handleNodeMouseLeave()}"
        @keydown="${(e: KeyboardEvent) => this.handleNodeKeyDown(e, sessionId, session)}"
      >
        <circle
          class="${circleClass}"
          cx="${node.x}"
          cy="${node.y}"
        />
        <text
          class="node-label"
          x="${node.x}"
          y="${node.y - 20}"
        >
          ${session.branchMetadata?.branchName || `Session ${sessionId.slice(0, 8)}`}
        </text>
        <text
          class="node-metadata"
          x="${node.x}"
          y="${node.y + 25}"
        >
          ${session.messageCount} msgs
        </text>
      </g>
    `;
  }

  private renderControls(): TemplateResult {
    return html`
      <div class="controls">
        <button
          class="control-button"
          title="Zoom In"
          aria-label="Zoom in"
          @click="${this.handleZoomIn}"
        >
          +
        </button>
        <button
          class="control-button"
          title="Zoom Out"
          aria-label="Zoom out"
          @click="${this.handleZoomOut}"
        >
          −
        </button>
        <button
          class="control-button"
          title="Reset Zoom"
          aria-label="Reset zoom"
          @click="${this.handleResetZoom}"
        >
          ⌂
        </button>
      </div>
    `;
  }

  private renderTooltip(): TemplateResult {
    if (!this.tooltipData) {
      return html`<div class="tooltip"></div>`;
    }

    const { session, x, y } = this.tooltipData;
    const tooltipStyle = {
      left: `${x}px`,
      top: `${y}px`,
      transform: 'translateX(-50%) translateY(-100%)'
    };

    return html`
      <div 
        class="tooltip visible"
        style=${styleMap(tooltipStyle)}
      >
        <div><strong>${session.branchMetadata?.branchName || session.sessionId}</strong></div>
        <div>Messages: ${session.messageCount}</div>
        ${session.branchMetadata?.branchReason ? html`
          <div>Reason: ${session.branchMetadata.branchReason}</div>
        ` : ''}
        <div>Status: ${session.isActive ? 'Active' : 'Inactive'}</div>
        ${session.branchTimestamp ? html`
          <div>Created: ${new Date(session.branchTimestamp).toLocaleString()}</div>
        ` : ''}
      </div>
    `;
  }

  private renderWebSocketStatus(): TemplateResult {
    if (!this.enableWebSocket) {
      return html``;
    }

    return html`
      <div class="websocket-status">
        <div class="status-indicator ${this.websocketConnected ? 'connected' : 'disconnected'}"></div>
        <span>${this.websocketConnected ? 'Live updates' : 'Disconnected'}</span>
      </div>
    `;
  }

  render(): TemplateResult {
    return html`
      <div class="visualization-header">
        <h2 class="header-title">Session Branch Tree</h2>
        <p class="header-subtitle">
          ${this.branchTree ? 
            `${this.countTotalSessions(this.branchTree)} sessions in tree` : 
            'No branch data available'
          }
        </p>
      </div>

      ${this.branchTree ? this.renderTreeVisualization() : this.renderEmptyState()}
    `;
  }

  // Utility methods
  private countTotalSessions(tree: SessionBranchTree): number {
    return 1 + tree.branches.reduce((count, branch) => count + this.countTotalSessions(branch), 0);
  }
}

// Type definitions for internal use
interface TreeLayoutData {
  nodes: Map<string, TreeNodeData>;
  edges: TreeEdge[];
  bounds: { width: number; height: number };
}

interface TreeNodeData {
  x: number;
  y: number;
  session: SessionSummary;
  depth: number;
  isRoot: boolean;
  children: string[];
}

interface TreeEdge {
  from: { x: number; y: number };
  to: { x: number; y: number };
  parentSession: string;
  branchPoint: number;
}

interface TooltipData {
  session: SessionSummary;
  x: number;
  y: number;
}

declare global {
  interface HTMLElementTagNameMap {
    'branch-visualization': BranchVisualization;
  }
}