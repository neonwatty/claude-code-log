# Component Library

This document provides comprehensive information about the Claude Code Log frontend component library built with Lit web components.

## Component Architecture

All components inherit from `BaseComponent` which provides:

- **Error handling**: Built-in error state management
- **Loading states**: Async operation loading indicators
- **Event handling**: Standardized custom event emission
- **Theming**: Dark mode and design system integration
- **Utilities**: Common formatting and helper methods

## Component Categories

### 📋 Base Components

#### BaseComponent
Abstract base class for all application components.

**Features:**
- Error and loading state management
- Custom event emission
- Theme support
- Common utility methods

**Usage:**
```typescript
import { BaseComponent } from "./base/base-component.js";

@customElement("my-component")
export class MyComponent extends BaseComponent {
  // Component implementation
}
```

### 🎯 Onboarding Components

#### WelcomeScreen
Full-screen welcome and introduction component for first-time users.

**Properties:**
- `visible: boolean` - Controls visibility
- `userName?: string` - Optional personalization

**Events:**
- `onboarding-complete` - User completed onboarding
- `onboarding-skipped` - User skipped onboarding

**Usage:**
```html
<welcome-screen 
  .visible=${true}
  userName="John"
  @onboarding-complete=${this.handleComplete}
></welcome-screen>
```

#### QuickStartGuide
Step-by-step guidance widget for user onboarding.

**Properties:**
- `visible: boolean` - Controls visibility

**Methods:**
- `completeStep(stepId: string)` - Mark step as completed
- `show()` - Show the guide
- `hide()` - Hide the guide

**Events:**
- `step-action` - User triggered step action
- `guide-closed` - Guide was closed
- `guide-reset` - Guide was reset

**Usage:**
```html
<quick-start-guide
  .visible=${true}
  @step-action=${this.handleStepAction}
></quick-start-guide>
```

### 📊 Analytics Components

#### AnalyticsDashboard
Comprehensive analytics overview with charts and metrics.

#### TokenUsageChart
Interactive token usage visualization component.

#### UsageInsightsDashboard
Advanced analytics and insights display.

### 📝 Session Components

#### SessionList
Display list of Claude conversation sessions.

#### SessionDetail
Detailed view of individual session.

#### SessionContinuation
Component for continuing/extending sessions.

### 💬 Message Components

#### MessageCard
Individual message display component.

### 🔍 Filter Components

#### FilterBar
Session filtering and search interface.

### ⏰ Timeline Components

#### Timeline
Chronological session timeline view.

### 🔄 Export Components

#### ExportDialog
Data export interface with format options.

### 🔗 Connection Components

#### ConnectionStatus
WebSocket connection status indicator.

### 📢 Notification Components

#### ToastNotifications
Non-intrusive notification system.

## Styling System

### CSS Custom Properties

Components use a comprehensive design system with CSS custom properties:

```css
/* Colors */
--color-primary: #007acc;
--color-secondary: #5c6bc0;
--color-accent: #ff6b35;

/* Typography */
--font-family-mono: 'SF Mono', Monaco, monospace;
--font-size-sm: 0.875rem;
--font-size-base: 1rem;
--font-size-lg: 1.125rem;

/* Spacing */
--spacing-xs: 0.25rem;
--spacing-sm: 0.5rem;
--spacing-md: 1rem;
--spacing-lg: 1.5rem;

/* Borders & Shadows */
--border-radius-sm: 0.25rem;
--border-radius-md: 0.5rem;
--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
```

### Theme Support

All components support light and dark themes:

```html
<my-component dark-mode></my-component>
```

### Responsive Design

Components are built mobile-first with responsive breakpoints:

- **Mobile**: < 768px
- **Tablet**: 768px - 1024px  
- **Desktop**: > 1024px

## Event System

### Custom Events

Components emit typed custom events:

```typescript
// Event emission in component
this.emitEvent("session-selected", { sessionId: "123" });

// Event handling in parent
<session-list @session-selected=${this.handleSelection}></session-list>
```

### Event Types

Common event patterns:

- **Selection events**: `*-selected`
- **Action events**: `*-action`
- **State change events**: `*-changed`
- **Lifecycle events**: `*-loaded`, `*-error`

## Accessibility

### ARIA Support

All components include proper ARIA attributes:

- **Roles**: `button`, `dialog`, `list`, `listitem`
- **Properties**: `aria-label`, `aria-describedby`
- **States**: `aria-expanded`, `aria-selected`

### Keyboard Navigation

Components support standard keyboard interactions:

- **Tab**: Navigate between focusable elements
- **Enter/Space**: Activate buttons and links
- **Arrow keys**: Navigate lists and menus
- **Escape**: Close dialogs and menus

### Screen Reader Support

- Semantic HTML structure
- Descriptive text alternatives
- Live region announcements
- Focus management

## Testing

### Unit Testing

Components are tested using Vitest with jsdom:

```typescript
import { fixture, expect } from "@open-wc/testing";
import "./my-component.js";

describe("MyComponent", () => {
  it("should render correctly", async () => {
    const element = await fixture("<my-component></my-component>");
    expect(element).to.exist;
  });
});
```

### Integration Testing

WebSocket and API integration testing:

```typescript
it("should handle WebSocket messages", async () => {
  const component = await fixture("<session-list></session-list>");
  const mockMessage = { type: "session_update", data: {...} };
  
  component.handleWebSocketMessage(mockMessage);
  
  expect(component.sessions).to.have.length(1);
});
```

## Performance

### Optimization Strategies

- **Lazy loading**: Components load on demand
- **Virtual scrolling**: Large lists use virtual scrolling
- **Debounced updates**: Input handling is debounced
- **Memoization**: Expensive calculations are cached

### Bundle Analysis

Component bundle sizes are monitored:

```bash
npm run build:analyze
```

## Development Guidelines

### Creating New Components

1. Extend `BaseComponent`
2. Follow naming conventions
3. Include comprehensive types
4. Add proper documentation
5. Write unit tests
6. Test accessibility

### Code Style

```typescript
@customElement("my-component")
export class MyComponent extends BaseComponent {
  @property({ type: String })
  title = "";

  @state()
  private data: DataType[] = [];

  static override styles = [
    ...BaseComponent.styles,
    css`
      :host {
        display: block;
      }
    `,
  ];

  override render(): TemplateResult {
    return html`
      <div class="container">
        <h2>${this.title}</h2>
        ${this.renderContent()}
      </div>
    `;
  }

  private renderContent(): TemplateResult {
    return html`<!-- component content -->`;
  }
}
```

## Migration Guide

### From Other Frameworks

Guidelines for migrating components from React, Vue, or other frameworks to Lit:

- Property/attribute handling differences
- Event system changes
- Lifecycle method mapping
- State management patterns

## Browser Support

Components support modern browsers:

- **Chrome**: Latest 2 versions
- **Firefox**: Latest 2 versions
- **Safari**: Latest 2 versions
- **Edge**: Latest 2 versions

Legacy browser support available with polyfills.