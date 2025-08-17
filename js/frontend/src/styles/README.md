# Style System Documentation

This document describes the CSS style system for the Lit web components, which has been ported from the Python templates to maintain visual consistency.

## Overview

The style system is organized into two main categories:
- **Shared styles** (`shared/`): Common design tokens, typography, layout utilities, and patterns
- **Component styles** (`components/`): Component-specific styling that extends the shared system

## Architecture

### Shared Styles (`/shared/`)

#### `variables.css`
Contains all CSS custom properties (CSS variables) that define the design system:

- **Colors**: Primary, secondary, message types, backgrounds, borders, shadows
- **Typography**: Font families, sizes, weights, line heights
- **Spacing**: Consistent spacing scale based on 8px grid
- **Layout**: Border radius, z-index scale, transitions
- **Neumorphic Design**: Shadow and border combinations for depth effect

#### `typography.css`
Typography styles and classes:

- **Headings**: `.heading-primary`, `.heading-secondary`, etc.
- **Body text**: `.text-body`, `.text-small`, `.text-xsmall`
- **Code**: `.code-inline`, `.code-block`
- **Metadata**: `.timestamp`, `.metadata`
- **Links**: `.link-base`, `.session-link`

#### `layout.css`
Layout utilities and common patterns:

- **Cards**: `.card-base`, `.card-message`, `.card-session-header`
- **Flexbox**: `.flex`, `.flex-center`, `.flex-between`
- **Grid**: `.grid`, `.grid-cols-*`, `.grid-auto-fit`
- **Spacing**: Margin and padding utilities (`.m-*`, `.p-*`)
- **Positioning**: `.relative`, `.absolute`, `.fixed`, `.sticky`

#### `utilities.css`
Common utility classes and interactive patterns:

- **Buttons**: `.btn-base`, `.btn-primary`, `.filter-toggle`
- **States**: `.loading`, `.selected`, `.highlighted`
- **Message types**: Border and background utilities for different message types
- **Animations**: Fade and slide animations
- **Responsive**: Mobile-specific utilities

### Component Styles (`/components/`)

Each component has its own CSS file with styles specific to that component:

- `session-list.css` - SessionList component styling
- `session-detail.css` - SessionDetail component styling  
- `message-card.css` - MessageCard component styling
- `filter-bar.css` - FilterBar component styling
- `timeline.css` - Timeline component styling

## Usage in Components

### Basic Usage

```typescript
import { LitElement, css } from 'lit';
import { baseStyles } from '../../styles/shared/index.js';

export class MyComponent extends LitElement {
  static styles = [
    baseStyles, // Includes variables and typography
    css`
      :host {
        display: block;
      }
      
      /* Component-specific styles */
      .my-element {
        background: var(--color-surface);
        padding: var(--spacing-md);
        border-radius: var(--border-radius-md);
      }
    `
  ];
}
```

### Advanced Usage

```typescript
import { LitElement, css } from 'lit';
import { sharedStyles } from '../../styles/shared/index.js';
import { sessionListStyles } from '../../styles/components/index.js';

export class MyComponent extends LitElement {
  static styles = [
    sharedStyles, // All shared styles
    sessionListStyles, // Component-specific styles
    css`
      /* Additional component styles */
    `
  ];
}
```

### Selective Imports

```typescript
import { variables, typography, utilities } from '../../styles/shared/index.js';

export class MyComponent extends LitElement {
  static styles = [
    variables,
    typography,
    utilities,
    // Skip layout if not needed
  ];
}
```

## Design Tokens

### Color System

The color system uses semantic naming and supports both light and dark modes:

```css
/* Primary colors */
--color-primary: #2196f3;
--color-secondary: #9c27b0;

/* Message type colors */
--color-message-user: #2196f3;
--color-message-assistant: #9c27b0;
--color-message-tool-use: #e91e63;
--color-message-tool-result: #4caf50;

/* Surface colors for neumorphic design */
--color-surface: #ffffff66;
--color-surface-hover: #ffffff99;
--color-surface-active: #ffffffaa;
```

### Typography Scale

```css
/* Font families */
--font-family-mono: 'SF Mono', 'Monaco', 'Inconsolata', ...;
--font-family-sans: -apple-system, BlinkMacSystemFont, ...;

/* Font sizes */
--font-size-xs: 0.75em;
--font-size-sm: 0.8em;
--font-size-base: 0.85em;
--font-size-md: 0.9em;
--font-size-lg: 1em;
--font-size-xl: 1.2em;
--font-size-xxl: 1.8em;

/* Font weights */
--font-weight-normal: 400;
--font-weight-medium: 500;
--font-weight-semibold: 600;
--font-weight-bold: 700;
```

### Spacing Scale

Based on 8px grid system:

```css
--spacing-xs: 4px;   /* 0.5 units */
--spacing-sm: 8px;   /* 1 unit */
--spacing-md: 12px;  /* 1.5 units */
--spacing-lg: 16px;  /* 2 units */
--spacing-xl: 24px;  /* 3 units */
--spacing-xxl: 32px; /* 4 units */
```

## Neumorphic Design

The design system uses a neumorphic (soft UI) approach with:

- **Subtle shadows**: Light shadow from top-left, dark shadow from bottom-right
- **Transparent backgrounds**: Using alpha channel for layered effects
- **Soft borders**: Light borders on top/left, dark borders on bottom/right
- **Gentle animations**: Subtle hover effects with transforms

```css
/* Neumorphic card example */
.card-base {
  background-color: var(--color-surface);
  box-shadow: var(--shadow-neumorphic);
  border-left: var(--color-border-light) 1px solid;
  border-top: var(--color-border-light) 1px solid;
  border-bottom: var(--color-border-dark) 1px solid;
  border-right: var(--color-border-dark) 1px solid;
}

.card-base:hover {
  box-shadow: var(--shadow-neumorphic-hover);
  transform: var(--transform-hover);
}
```

## Responsive Design

The system includes responsive utilities and breakpoints:

- **Mobile-first**: Base styles target mobile devices
- **Breakpoint**: 768px for tablet/desktop adjustments
- **Utilities**: `.mobile-hidden`, `.desktop-hidden`, `.mobile-stack`

## Accessibility

The style system includes accessibility features:

- **High contrast support**: `@media (prefers-contrast: high)`
- **Reduced motion**: `@media (prefers-reduced-motion: reduce)`
- **Focus indicators**: `.focus-ring`, `.focus-visible`
- **Screen reader support**: `.sr-only`

## Dark Mode

Dark mode is supported through CSS custom properties:

```css
@media (prefers-color-scheme: dark) {
  :root {
    --color-background: /* dark gradient */;
    --color-surface: #33333366;
    --color-text: #e0e0e0;
    /* ... other dark mode overrides */
  }
}
```

## Migration from Python Templates

The styles have been carefully ported from the Python Jinja2 templates with these adaptations:

1. **CSS Custom Properties**: Global styles converted to CSS variables
2. **Component Encapsulation**: Styles adapted for Shadow DOM
3. **Modular Organization**: Split into logical, reusable modules
4. **TypeScript Integration**: Type-safe imports through Lit's CSS system
5. **Build System**: Integrated with Vite for optimal bundling

## Best Practices

1. **Use CSS Variables**: Always prefer CSS custom properties over hardcoded values
2. **Extend Base Styles**: Start with `baseStyles` or `sharedStyles` in components
3. **Semantic Classes**: Use semantic class names (`.message-header` vs `.blue-text`)
4. **Consistent Spacing**: Use the spacing scale variables
5. **Performance**: Import only the styles you need for better performance

## File Structure

```
styles/
├── shared/
│   ├── variables.css      # Design tokens and CSS custom properties
│   ├── typography.css     # Typography styles and utilities
│   ├── layout.css         # Layout utilities and common patterns
│   ├── utilities.css      # Utility classes and interactive patterns
│   └── index.ts          # Exports for shared styles
├── components/
│   ├── session-list.css   # SessionList component styles
│   ├── session-detail.css # SessionDetail component styles
│   ├── message-card.css   # MessageCard component styles
│   ├── filter-bar.css     # FilterBar component styles
│   ├── timeline.css       # Timeline component styles
│   └── index.ts          # Exports for component styles
└── README.md             # This documentation
```