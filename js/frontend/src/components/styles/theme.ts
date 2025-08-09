import { css, CSSResult } from 'lit';

/**
 * Theme tokens and styling patterns for session view components
 */

/**
 * CSS Custom Properties for theming
 */
export const themeTokens = css`
  :host {
    /* Color Tokens */
    --color-primary: #0066cc;
    --color-primary-hover: #0052a3;
    --color-primary-active: #004080;
    --color-primary-disabled: #b3d9ff;

    --color-secondary: #6c757d;
    --color-secondary-hover: #5a6268;
    --color-secondary-active: #495057;

    --color-success: #28a745;
    --color-success-hover: #218838;
    --color-success-light: #d4edda;

    --color-warning: #ffc107;
    --color-warning-hover: #e0a800;
    --color-warning-light: #fff3cd;

    --color-error: #dc3545;
    --color-error-hover: #c82333;
    --color-error-light: #f8d7da;

    --color-info: #17a2b8;
    --color-info-hover: #138496;
    --color-info-light: #d1ecf1;

    /* Background Colors */
    --color-background: #ffffff;
    --color-background-secondary: #f8f9fa;
    --color-background-tertiary: #e9ecef;
    --color-background-overlay: rgba(0, 0, 0, 0.5);

    /* Text Colors */
    --color-text-primary: #212529;
    --color-text-secondary: #6c757d;
    --color-text-muted: #999999;
    --color-text-inverse: #ffffff;

    /* Border Colors */
    --color-border: #dee2e6;
    --color-border-light: #e9ecef;
    --color-border-dark: #adb5bd;
    --color-border-focus: var(--color-primary);

    /* Shadow Tokens */
    --shadow-sm: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.075);
    --shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.15);
    --shadow-lg: 0 1rem 3rem rgba(0, 0, 0, 0.175);
    --shadow-focus: 0 0 0 0.2rem rgba(0, 102, 204, 0.25);

    /* Spacing Tokens */
    --space-xs: 0.25rem;
    --space-sm: 0.5rem;
    --space-md: 1rem;
    --space-lg: 1.5rem;
    --space-xl: 2rem;
    --space-xxl: 3rem;

    /* Typography Tokens */
    --font-family-primary: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
    --font-family-mono: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, monospace;

    --font-size-xs: 0.75rem;
    --font-size-sm: 0.875rem;
    --font-size-base: 1rem;
    --font-size-lg: 1.125rem;
    --font-size-xl: 1.25rem;
    --font-size-xxl: 1.5rem;

    --font-weight-normal: 400;
    --font-weight-medium: 500;
    --font-weight-semibold: 600;
    --font-weight-bold: 700;

    --line-height-tight: 1.2;
    --line-height-base: 1.5;
    --line-height-relaxed: 1.8;

    /* Border Radius Tokens */
    --border-radius-sm: 0.25rem;
    --border-radius: 0.375rem;
    --border-radius-lg: 0.5rem;
    --border-radius-xl: 0.75rem;
    --border-radius-full: 9999px;

    /* Transition Tokens */
    --transition-fast: 150ms ease-in-out;
    --transition-base: 200ms ease-in-out;
    --transition-slow: 300ms ease-in-out;

    /* Z-Index Tokens */
    --z-dropdown: 1000;
    --z-sticky: 1020;
    --z-fixed: 1030;
    --z-modal-backdrop: 1040;
    --z-modal: 1050;
    --z-popover: 1060;
    --z-tooltip: 1070;
  }

  /* Dark Theme Overrides */
  :host([dark-theme]) {
    --color-background: #1a1a1a;
    --color-background-secondary: #2d2d2d;
    --color-background-tertiary: #404040;
    --color-background-overlay: rgba(0, 0, 0, 0.8);

    --color-text-primary: #ffffff;
    --color-text-secondary: #b3b3b3;
    --color-text-muted: #808080;

    --color-border: #404040;
    --color-border-light: #333333;
    --color-border-dark: #666666;

    --color-primary: #4da6ff;
    --color-primary-hover: #66b3ff;
    --color-primary-active: #80c0ff;
  }

  /* High Contrast Theme */
  :host([high-contrast]) {
    --color-background: #ffffff;
    --color-text-primary: #000000;
    --color-border: #000000;
    --color-primary: #0000ff;
    --color-error: #ff0000;
    --color-success: #008000;
    --color-warning: #ff8c00;
  }

  /* Reduced Motion */
  @media (prefers-reduced-motion: reduce) {
    :host {
      --transition-fast: 0ms;
      --transition-base: 0ms;
      --transition-slow: 0ms;
    }
  }
`;

/**
 * Common component patterns
 */
export const commonStyles = css`
  /* Reset and Base Styles */
  * {
    box-sizing: border-box;
  }

  /* Typography Styles */
  .text-xs { font-size: var(--font-size-xs); }
  .text-sm { font-size: var(--font-size-sm); }
  .text-base { font-size: var(--font-size-base); }
  .text-lg { font-size: var(--font-size-lg); }
  .text-xl { font-size: var(--font-size-xl); }
  .text-xxl { font-size: var(--font-size-xxl); }

  .font-normal { font-weight: var(--font-weight-normal); }
  .font-medium { font-weight: var(--font-weight-medium); }
  .font-semibold { font-weight: var(--font-weight-semibold); }
  .font-bold { font-weight: var(--font-weight-bold); }

  .font-mono { font-family: var(--font-family-mono); }

  .text-primary { color: var(--color-text-primary); }
  .text-secondary { color: var(--color-text-secondary); }
  .text-muted { color: var(--color-text-muted); }
  .text-error { color: var(--color-error); }
  .text-success { color: var(--color-success); }
  .text-warning { color: var(--color-warning); }
  .text-info { color: var(--color-info); }

  /* Layout Utilities */
  .flex { display: flex; }
  .inline-flex { display: inline-flex; }
  .block { display: block; }
  .inline-block { display: inline-block; }
  .hidden { display: none; }

  .flex-col { flex-direction: column; }
  .flex-row { flex-direction: row; }
  .items-center { align-items: center; }
  .items-start { align-items: flex-start; }
  .items-end { align-items: flex-end; }
  .justify-center { justify-content: center; }
  .justify-between { justify-content: space-between; }
  .justify-start { justify-content: flex-start; }
  .justify-end { justify-content: flex-end; }

  .flex-1 { flex: 1; }
  .flex-grow { flex-grow: 1; }
  .flex-shrink-0 { flex-shrink: 0; }

  .gap-xs { gap: var(--space-xs); }
  .gap-sm { gap: var(--space-sm); }
  .gap-md { gap: var(--space-md); }
  .gap-lg { gap: var(--space-lg); }
  .gap-xl { gap: var(--space-xl); }

  /* Spacing Utilities */
  .p-xs { padding: var(--space-xs); }
  .p-sm { padding: var(--space-sm); }
  .p-md { padding: var(--space-md); }
  .p-lg { padding: var(--space-lg); }
  .p-xl { padding: var(--space-xl); }

  .px-xs { padding-left: var(--space-xs); padding-right: var(--space-xs); }
  .px-sm { padding-left: var(--space-sm); padding-right: var(--space-sm); }
  .px-md { padding-left: var(--space-md); padding-right: var(--space-md); }
  .px-lg { padding-left: var(--space-lg); padding-right: var(--space-lg); }
  .px-xl { padding-left: var(--space-xl); padding-right: var(--space-xl); }

  .py-xs { padding-top: var(--space-xs); padding-bottom: var(--space-xs); }
  .py-sm { padding-top: var(--space-sm); padding-bottom: var(--space-sm); }
  .py-md { padding-top: var(--space-md); padding-bottom: var(--space-md); }
  .py-lg { padding-top: var(--space-lg); padding-bottom: var(--space-lg); }
  .py-xl { padding-top: var(--space-xl); padding-bottom: var(--space-xl); }

  .m-xs { margin: var(--space-xs); }
  .m-sm { margin: var(--space-sm); }
  .m-md { margin: var(--space-md); }
  .m-lg { margin: var(--space-lg); }
  .m-xl { margin: var(--space-xl); }

  .mx-auto { margin-left: auto; margin-right: auto; }
  .my-auto { margin-top: auto; margin-bottom: auto; }

  /* Border Utilities */
  .border { border: 1px solid var(--color-border); }
  .border-light { border: 1px solid var(--color-border-light); }
  .border-dark { border: 1px solid var(--color-border-dark); }

  .border-t { border-top: 1px solid var(--color-border); }
  .border-b { border-bottom: 1px solid var(--color-border); }
  .border-l { border-left: 1px solid var(--color-border); }
  .border-r { border-right: 1px solid var(--color-border); }

  .rounded-sm { border-radius: var(--border-radius-sm); }
  .rounded { border-radius: var(--border-radius); }
  .rounded-lg { border-radius: var(--border-radius-lg); }
  .rounded-xl { border-radius: var(--border-radius-xl); }
  .rounded-full { border-radius: var(--border-radius-full); }

  /* Background Utilities */
  .bg-primary { background-color: var(--color-background); }
  .bg-secondary { background-color: var(--color-background-secondary); }
  .bg-tertiary { background-color: var(--color-background-tertiary); }

  .bg-success-light { background-color: var(--color-success-light); }
  .bg-warning-light { background-color: var(--color-warning-light); }
  .bg-error-light { background-color: var(--color-error-light); }
  .bg-info-light { background-color: var(--color-info-light); }

  /* Shadow Utilities */
  .shadow-sm { box-shadow: var(--shadow-sm); }
  .shadow { box-shadow: var(--shadow); }
  .shadow-lg { box-shadow: var(--shadow-lg); }

  /* Interaction States */
  .interactive {
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .interactive:hover {
    transform: translateY(-1px);
    box-shadow: var(--shadow);
  }

  .interactive:active {
    transform: translateY(0);
  }

  .interactive:focus-visible {
    outline: none;
    box-shadow: var(--shadow-focus);
  }

  .disabled {
    opacity: 0.5;
    pointer-events: none;
    cursor: not-allowed;
  }

  /* Loading States */
  .loading {
    position: relative;
    pointer-events: none;
  }

  .loading::before {
    content: '';
    position: absolute;
    inset: 0;
    background: var(--color-background-overlay);
    border-radius: inherit;
    z-index: 1;
  }

  .loading::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: 20px;
    height: 20px;
    margin: -10px 0 0 -10px;
    border: 2px solid var(--color-border);
    border-top-color: var(--color-primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    z-index: 2;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* Error States */
  .error-state {
    border-color: var(--color-error);
    background-color: var(--color-error-light);
  }

  .error-message {
    color: var(--color-error);
    font-size: var(--font-size-sm);
    margin-top: var(--space-xs);
  }

  /* Success States */
  .success-state {
    border-color: var(--color-success);
    background-color: var(--color-success-light);
  }

  /* Scrollbar Styling */
  ::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  ::-webkit-scrollbar-track {
    background: var(--color-background-secondary);
    border-radius: var(--border-radius);
  }

  ::-webkit-scrollbar-thumb {
    background: var(--color-border-dark);
    border-radius: var(--border-radius);
  }

  ::-webkit-scrollbar-thumb:hover {
    background: var(--color-text-secondary);
  }

  /* Screen Reader Only */
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
`;

/**
 * Button component styles
 */
export const buttonStyles = css`
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-xs);
    padding: var(--space-sm) var(--space-md);
    font-family: var(--font-family-primary);
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-medium);
    line-height: var(--line-height-tight);
    border: 1px solid transparent;
    border-radius: var(--border-radius);
    cursor: pointer;
    transition: all var(--transition-fast);
    text-decoration: none;
    white-space: nowrap;
  }

  .btn:focus-visible {
    outline: none;
    box-shadow: var(--shadow-focus);
  }

  .btn:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }

  /* Button Variants */
  .btn-primary {
    background-color: var(--color-primary);
    border-color: var(--color-primary);
    color: var(--color-text-inverse);
  }

  .btn-primary:hover:not(:disabled) {
    background-color: var(--color-primary-hover);
    border-color: var(--color-primary-hover);
  }

  .btn-primary:active:not(:disabled) {
    background-color: var(--color-primary-active);
    border-color: var(--color-primary-active);
  }

  .btn-secondary {
    background-color: transparent;
    border-color: var(--color-border);
    color: var(--color-text-primary);
  }

  .btn-secondary:hover:not(:disabled) {
    background-color: var(--color-background-secondary);
    border-color: var(--color-border-dark);
  }

  .btn-ghost {
    background-color: transparent;
    border-color: transparent;
    color: var(--color-text-primary);
  }

  .btn-ghost:hover:not(:disabled) {
    background-color: var(--color-background-secondary);
  }

  /* Button Sizes */
  .btn-sm {
    padding: var(--space-xs) var(--space-sm);
    font-size: var(--font-size-sm);
  }

  .btn-lg {
    padding: var(--space-md) var(--space-lg);
    font-size: var(--font-size-lg);
  }

  /* Icon Buttons */
  .btn-icon {
    padding: var(--space-sm);
    width: auto;
    height: auto;
    aspect-ratio: 1;
  }
`;

/**
 * Form component styles
 */
export const formStyles = css`
  .form-group {
    margin-bottom: var(--space-md);
  }

  .form-label {
    display: block;
    margin-bottom: var(--space-xs);
    font-weight: var(--font-weight-medium);
    color: var(--color-text-primary);
  }

  .form-input,
  .form-textarea,
  .form-select {
    width: 100%;
    padding: var(--space-sm) var(--space-md);
    font-family: var(--font-family-primary);
    font-size: var(--font-size-base);
    line-height: var(--line-height-base);
    border: 1px solid var(--color-border);
    border-radius: var(--border-radius);
    background-color: var(--color-background);
    color: var(--color-text-primary);
    transition: all var(--transition-fast);
  }

  .form-input:focus,
  .form-textarea:focus,
  .form-select:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: var(--shadow-focus);
  }

  .form-input:invalid,
  .form-textarea:invalid,
  .form-select:invalid {
    border-color: var(--color-error);
  }

  .form-textarea {
    resize: vertical;
    min-height: 100px;
  }

  .form-help {
    margin-top: var(--space-xs);
    font-size: var(--font-size-sm);
    color: var(--color-text-muted);
  }

  .form-error {
    margin-top: var(--space-xs);
    font-size: var(--font-size-sm);
    color: var(--color-error);
  }
`;

/**
 * Card component styles
 */
export const cardStyles = css`
  .card {
    background-color: var(--color-background);
    border: 1px solid var(--color-border);
    border-radius: var(--border-radius-lg);
    box-shadow: var(--shadow-sm);
    overflow: hidden;
  }

  .card-header {
    padding: var(--space-lg);
    border-bottom: 1px solid var(--color-border-light);
    background-color: var(--color-background-secondary);
  }

  .card-body {
    padding: var(--space-lg);
  }

  .card-footer {
    padding: var(--space-lg);
    border-top: 1px solid var(--color-border-light);
    background-color: var(--color-background-secondary);
  }

  .card-title {
    margin: 0 0 var(--space-sm) 0;
    font-size: var(--font-size-xl);
    font-weight: var(--font-weight-semibold);
    color: var(--color-text-primary);
  }

  .card-subtitle {
    margin: 0;
    font-size: var(--font-size-base);
    color: var(--color-text-secondary);
  }
`;

/**
 * Combined base styles for components
 */
export const baseStyles: CSSResult = css`
  ${themeTokens}
  ${commonStyles}
  ${buttonStyles}
  ${formStyles}
  ${cardStyles}
`;