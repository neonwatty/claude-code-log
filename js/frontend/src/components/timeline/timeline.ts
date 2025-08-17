import { LitElement, html, css, TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { BaseComponent } from '../base/base-component.js';
import { ZodSession, ZodTranscriptEntry } from '../../../shared/dist/src/schemas/index.js';

/**
 * Timeline data structures
 */
export interface TimelineItem {
  id: string;
  timestamp: Date;
  messageType: string;
  content: string;
  sessionId: string;
  messageIndex: number;
}

export interface TimelineGroup {
  id: string;
  label: string;
  visible: boolean;
  color: string;
  icon: string;
}

export interface TimelineRange {
  start: Date;
  end: Date;
}

export interface TimelineTooltipData {
  item: TimelineItem;
  x: number;
  y: number;
}

/**
 * Timeline component for temporal navigation through sessions and messages
 * 
 * Provides an interactive SVG-based timeline visualization similar to vis-timeline
 * but built natively with Lit for better integration with the component system.
 */
@customElement('timeline-component')
export class Timeline extends BaseComponent {
  @property({ type: Array })
  sessions: ZodSession[] = [];

  @property({ type: Object })
  visibleRange: TimelineRange | null = null;

  @property({ type: Array })
  visibleMessageTypes: string[] = ['user', 'assistant', 'tool_use', 'tool_result', 'thinking', 'system'];

  @property({ type: Boolean })
  showTooltips: boolean = true;

  @property({ type: Boolean })
  allowZoom: boolean = true;

  @property({ type: Boolean })
  allowPan: boolean = true;

  @property({ type: Number })
  height: number = 200;

  @state()
  private timelineItems: TimelineItem[] = [];

  @state()
  private groups: TimelineGroup[] = [];

  @state()
  private currentRange: TimelineRange | null = null;

  @state()
  private zoomLevel: number = 1;

  @state()
  private panOffset: number = 0;

  @state()
  private tooltip: TimelineTooltipData | null = null;

  @state()
  private isResizing: boolean = false;

  @state()
  private isDragging: boolean = false;

  @state()
  private dragStart: { x: number; y: number } | null = null;

  // Timeline configuration
  private readonly MESSAGE_TYPE_CONFIG = {
    user: { label: '🤷 User', color: '#2196f3', icon: '🤷' },
    assistant: { label: '🤖 Assistant', color: '#9c27b0', icon: '🤖' },
    tool_use: { label: '🛠️ Tool Use', color: '#ffc107', icon: '🛠️' },
    tool_result: { label: '🧰 Tool Result', color: '#4caf50', icon: '🧰' },
    thinking: { label: '💭 Thinking', color: '#e91e63', icon: '💭' },
    system: { label: '⚙️ System', color: '#ff8707', icon: '⚙️' },
    image: { label: '🖼️ Image', color: '#00bcd4', icon: '🖼️' },
    sidechain: { label: '🔗 Sub-assistant', color: '#9e9e9e', icon: '🔗' }
  };

  private readonly TIMELINE_MARGINS = {
    top: 40,
    right: 20,
    bottom: 40,
    left: 60
  };

  private svgElement: SVGElement | null = null;
  private resizeObserver: ResizeObserver | null = null;

  connectedCallback() {
    super.connectedCallback();
    this.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });
    this.addEventListener('mousedown', this.handleMouseDown.bind(this));
    this.addEventListener('mousemove', this.handleMouseMove.bind(this));
    this.addEventListener('mouseup', this.handleMouseUp.bind(this));
    this.addEventListener('mouseleave', this.handleMouseLeave.bind(this));
    
    // Set up resize observer
    this.resizeObserver = new ResizeObserver(() => {
      this.requestUpdate();
    });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener('wheel', this.handleWheel.bind(this));
    this.removeEventListener('mousedown', this.handleMouseDown.bind(this));
    this.removeEventListener('mousemove', this.handleMouseMove.bind(this));
    this.removeEventListener('mouseup', this.handleMouseUp.bind(this));
    this.removeEventListener('mouseleave', this.handleMouseLeave.bind(this));
    
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
  }

  updated(changedProperties: Map<string, any>) {
    super.updated(changedProperties);
    
    if (changedProperties.has('sessions') || changedProperties.has('visibleMessageTypes')) {
      this.rebuildTimelineData();
    }

    if (changedProperties.has('sessions') && this.sessions.length > 0 && !this.currentRange) {
      this.autoFitTimeRange();
    }

    // Set up resize observer for SVG element
    if (this.svgElement && this.resizeObserver) {
      this.resizeObserver.observe(this.svgElement);
    }
  }

  private rebuildTimelineData(): void {
    const items: TimelineItem[] = [];
    const groupSet = new Set<string>();

    this.sessions.forEach(session => {
      session.transcript.forEach((entry, index) => {
        const messageType = this.getMessageType(entry);
        
        if (!this.visibleMessageTypes.includes(messageType)) {
          return;
        }

        const item: TimelineItem = {
          id: `${session.sessionId}-${index}`,
          timestamp: new Date(entry.timestamp),
          messageType,
          content: this.getMessageContent(entry),
          sessionId: session.sessionId,
          messageIndex: index
        };

        items.push(item);
        groupSet.add(messageType);
      });
    });

    // Sort by timestamp
    items.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    // Create groups
    const groups: TimelineGroup[] = Array.from(groupSet).map(type => {
      const config = this.MESSAGE_TYPE_CONFIG[type] || this.MESSAGE_TYPE_CONFIG.system;
      return {
        id: type,
        label: config.label,
        visible: this.visibleMessageTypes.includes(type),
        color: config.color,
        icon: config.icon
      };
    });

    this.timelineItems = items;
    this.groups = groups;
  }

  private getMessageType(entry: ZodTranscriptEntry): string {
    switch (entry.type) {
      case 'user':
        return 'user';
      case 'assistant':
        return 'assistant';
      case 'tool_use':
        return 'tool_use';
      case 'tool_result':
        return 'tool_result';
      case 'thinking':
        return 'thinking';
      default:
        return 'system';
    }
  }

  private getMessageContent(entry: ZodTranscriptEntry): string {
    if (entry.type === 'user' || entry.type === 'assistant') {
      const textContent = entry.content
        .filter(item => item.type === 'text')
        .map(item => item.text)
        .join(' ');
      return textContent.length > 100 ? textContent.substring(0, 100) + '...' : textContent;
    } else if (entry.type === 'tool_use') {
      return `${entry.name}: ${entry.input ? JSON.stringify(entry.input).substring(0, 50) + '...' : ''}`;
    } else if (entry.type === 'tool_result') {
      const content = typeof entry.content === 'string' ? entry.content : JSON.stringify(entry.content);
      return content.length > 100 ? content.substring(0, 100) + '...' : content;
    } else if (entry.type === 'thinking') {
      return entry.content.length > 100 ? entry.content.substring(0, 100) + '...' : entry.content;
    }
    return 'System message';
  }

  private autoFitTimeRange(): void {
    if (this.timelineItems.length === 0) return;

    const timestamps = this.timelineItems.map(item => item.timestamp.getTime());
    const minTime = Math.min(...timestamps);
    const maxTime = Math.max(...timestamps);
    
    // Add 10% padding on each side
    const padding = (maxTime - minTime) * 0.1;
    
    this.currentRange = {
      start: new Date(minTime - padding),
      end: new Date(maxTime + padding)
    };
  }

  private getTimelineWidth(): number {
    return this.offsetWidth - this.TIMELINE_MARGINS.left - this.TIMELINE_MARGINS.right;
  }

  private getTimelineHeight(): number {
    return this.height - this.TIMELINE_MARGINS.top - this.TIMELINE_MARGINS.bottom;
  }

  private timeToX(timestamp: Date): number {
    if (!this.currentRange) return 0;
    
    const rangeStart = this.currentRange.start.getTime();
    const rangeEnd = this.currentRange.end.getTime();
    const timelineWidth = this.getTimelineWidth();
    
    const ratio = (timestamp.getTime() - rangeStart) / (rangeEnd - rangeStart);
    return ratio * timelineWidth + this.panOffset;
  }

  private yForGroup(groupId: string): number {
    const groupIndex = this.groups.findIndex(g => g.id === groupId);
    const timelineHeight = this.getTimelineHeight();
    const groupHeight = timelineHeight / this.groups.length;
    return groupIndex * groupHeight + groupHeight / 2;
  }

  private handleWheel(event: WheelEvent): void {
    if (!this.allowZoom) return;
    
    event.preventDefault();
    
    const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
    this.zoomLevel = Math.max(0.1, Math.min(10, this.zoomLevel * zoomFactor));
    
    this.requestUpdate();
  }

  private handleMouseDown(event: MouseEvent): void {
    if (!this.allowPan) return;
    
    this.isDragging = true;
    this.dragStart = { x: event.clientX, y: event.clientY };
  }

  private handleMouseMove(event: MouseEvent): void {
    if (this.isDragging && this.dragStart && this.allowPan) {
      const deltaX = event.clientX - this.dragStart.x;
      this.panOffset += deltaX;
      this.dragStart = { x: event.clientX, y: event.clientY };
      this.requestUpdate();
    }

    // Update tooltip
    if (this.showTooltips) {
      this.updateTooltip(event);
    }
  }

  private handleMouseUp(): void {
    this.isDragging = false;
    this.dragStart = null;
  }

  private handleMouseLeave(): void {
    this.isDragging = false;
    this.dragStart = null;
    this.tooltip = null;
  }

  private updateTooltip(event: MouseEvent): void {
    const rect = this.getBoundingClientRect();
    const x = event.clientX - rect.left - this.TIMELINE_MARGINS.left;
    const y = event.clientY - rect.top - this.TIMELINE_MARGINS.top;
    
    // Find nearest timeline item
    const tolerance = 10;
    let nearestItem: TimelineItem | null = null;
    let nearestDistance = Infinity;
    
    this.timelineItems.forEach(item => {
      const itemX = this.timeToX(item.timestamp);
      const itemY = this.yForGroup(item.messageType);
      
      const distance = Math.sqrt(Math.pow(x - itemX, 2) + Math.pow(y - itemY, 2));
      
      if (distance < tolerance && distance < nearestDistance) {
        nearestDistance = distance;
        nearestItem = item;
      }
    });
    
    if (nearestItem) {
      this.tooltip = {
        item: nearestItem,
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
      };
    } else {
      this.tooltip = null;
    }
  }

  private handleItemClick(item: TimelineItem): void {
    // Emit event for navigation
    const event = new CustomEvent('timeline-item-click', {
      detail: {
        sessionId: item.sessionId,
        messageIndex: item.messageIndex,
        timestamp: item.timestamp
      },
      bubbles: true,
      composed: true
    });
    this.dispatchEvent(event);
  }

  private renderTimeAxis(): TemplateResult {
    if (!this.currentRange) return html``;
    
    const timelineWidth = this.getTimelineWidth();
    const timelineHeight = this.getTimelineHeight();
    
    // Generate time ticks
    const ticks: { time: Date; x: number; label: string }[] = [];
    const rangeMs = this.currentRange.end.getTime() - this.currentRange.start.getTime();
    
    // Determine tick interval based on range
    let tickInterval: number;
    if (rangeMs < 60 * 1000) { // Less than 1 minute
      tickInterval = 10 * 1000; // 10 seconds
    } else if (rangeMs < 60 * 60 * 1000) { // Less than 1 hour
      tickInterval = 5 * 60 * 1000; // 5 minutes
    } else if (rangeMs < 24 * 60 * 60 * 1000) { // Less than 1 day
      tickInterval = 60 * 60 * 1000; // 1 hour
    } else {
      tickInterval = 24 * 60 * 60 * 1000; // 1 day
    }
    
    const startTick = Math.ceil(this.currentRange.start.getTime() / tickInterval) * tickInterval;
    
    for (let time = startTick; time <= this.currentRange.end.getTime(); time += tickInterval) {
      const date = new Date(time);
      const x = this.timeToX(date);
      
      if (x >= 0 && x <= timelineWidth) {
        ticks.push({
          time: date,
          x,
          label: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
      }
    }
    
    return html`
      <!-- Time axis line -->
      <line
        x1="0"
        y1="${timelineHeight}"
        x2="${timelineWidth}"
        y2="${timelineHeight}"
        stroke="var(--color-border-dark)"
        stroke-width="1"
      />
      
      <!-- Time ticks and labels -->
      ${ticks.map(tick => html`
        <g>
          <line
            x1="${tick.x}"
            y1="${timelineHeight}"
            x2="${tick.x}"
            y2="${timelineHeight + 5}"
            stroke="var(--color-border-dark)"
            stroke-width="1"
          />
          <text
            x="${tick.x}"
            y="${timelineHeight + 18}"
            text-anchor="middle"
            font-size="11"
            fill="var(--color-text-muted)"
            font-family="var(--font-family-mono)"
          >
            ${tick.label}
          </text>
        </g>
      `)}
    `;
  }

  private renderGroupLabels(): TemplateResult {
    const timelineHeight = this.getTimelineHeight();
    const groupHeight = timelineHeight / this.groups.length;
    
    return html`
      ${this.groups.map((group, index) => {
        const y = index * groupHeight + groupHeight / 2;
        return html`
          <g>
            <!-- Group background -->
            <rect
              x="-60"
              y="${index * groupHeight}"
              width="55"
              height="${groupHeight}"
              fill="${group.visible ? 'var(--color-surface)' : 'var(--color-surface-disabled)'}"
              stroke="var(--color-border-light)"
              stroke-width="0.5"
            />
            
            <!-- Group label -->
            <text
              x="-32"
              y="${y + 4}"
              text-anchor="middle"
              font-size="10"
              fill="${group.visible ? 'var(--color-text)' : 'var(--color-text-muted)'}"
              font-family="var(--font-family-mono)"
              font-weight="500"
            >
              ${group.icon}
            </text>
          </g>
        `;
      })}
    `;
  }

  private renderTimelineItems(): TemplateResult {
    const timelineHeight = this.getTimelineHeight();
    const groupHeight = timelineHeight / this.groups.length;
    
    return html`
      ${this.timelineItems.map(item => {
        const x = this.timeToX(item.timestamp);
        const y = this.yForGroup(item.messageType);
        const group = this.groups.find(g => g.id === item.messageType);
        
        if (!group?.visible) return html``;
        
        return html`
          <circle
            cx="${x}"
            cy="${y}"
            r="4"
            fill="${group.color}"
            stroke="white"
            stroke-width="1"
            style="cursor: pointer; transition: r 0.2s ease;"
            @click="${() => this.handleItemClick(item)}"
            @mouseenter="${(e: Event) => (e.target as SVGElement).setAttribute('r', '6')}"
            @mouseleave="${(e: Event) => (e.target as SVGElement).setAttribute('r', '4')}"
          />
        `;
      })}
    `;
  }

  private renderTooltip(): TemplateResult {
    if (!this.tooltip) return html``;
    
    const { item, x, y } = this.tooltip;
    const group = this.groups.find(g => g.id === item.messageType);
    
    return html`
      <div
        class="timeline-tooltip"
        style="
          position: absolute;
          left: ${x + 10}px;
          top: ${y - 10}px;
          background: var(--color-surface);
          border: 1px solid var(--color-border-dark);
          border-radius: var(--border-radius-sm);
          padding: var(--spacing-sm);
          font-size: 0.85em;
          font-family: var(--font-family-mono);
          box-shadow: var(--shadow-md);
          z-index: 1000;
          max-width: 300px;
          word-wrap: break-word;
        "
      >
        <div style="font-weight: 600; margin-bottom: 4px; color: ${group?.color};">
          ${group?.icon} ${group?.label}
        </div>
        <div style="font-size: 0.8em; color: var(--color-text-muted); margin-bottom: 4px;">
          ${item.timestamp.toLocaleString()}
        </div>
        <div style="color: var(--color-text);">
          ${item.content}
        </div>
      </div>
    `;
  }

  render(): TemplateResult {
    const timelineWidth = this.getTimelineWidth();
    const timelineHeight = this.getTimelineHeight();
    
    return html`
      <div class="timeline-container" style="position: relative;">
        <svg
          class="timeline-svg"
          width="100%"
          height="${this.height}"
          style="border: 1px solid var(--color-border-light); background: var(--color-surface);"
          @ref="${(el: SVGElement) => this.svgElement = el}"
        >
          <!-- Main timeline area -->
          <g transform="translate(${this.TIMELINE_MARGINS.left}, ${this.TIMELINE_MARGINS.top})">
            <!-- Group labels -->
            ${this.renderGroupLabels()}
            
            <!-- Timeline items -->
            ${this.renderTimelineItems()}
            
            <!-- Time axis -->
            ${this.renderTimeAxis()}
          </g>
        </svg>
        
        <!-- Tooltip -->
        ${this.renderTooltip()}
      </div>
    `;
  }

  static styles = css`
    :host {
      display: block;
      width: 100%;
      font-family: var(--font-family-mono);
    }

    .timeline-container {
      width: 100%;
      background: var(--color-surface);
      border-radius: var(--border-radius-md);
      overflow: hidden;
    }

    .timeline-svg {
      display: block;
      width: 100%;
    }

    .timeline-tooltip {
      pointer-events: none;
    }

    /* Custom scrollbar for horizontal scrolling */
    :host::-webkit-scrollbar {
      height: 8px;
    }

    :host::-webkit-scrollbar-track {
      background: var(--color-surface);
    }

    :host::-webkit-scrollbar-thumb {
      background: var(--color-border-dark);
      border-radius: 4px;
    }

    :host::-webkit-scrollbar-thumb:hover {
      background: var(--color-text-muted);
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'timeline-component': Timeline;
  }
}