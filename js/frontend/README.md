# Frontend

Lit-based frontend application for Claude Code Log.

## Structure

```
frontend/
├── src/
│   ├── app.ts              # Main application entry point
│   ├── index.html          # HTML template
│   ├── components/         # Reusable Lit components
│   ├── views/              # Page-level components/views
│   ├── services/           # Frontend services (API calls, etc.)
│   └── styles/             # CSS and styling files
├── tsconfig.json           # TypeScript configuration
├── vite.config.ts          # Vite configuration (deprecated, use root)
└── dist/                   # Built output
```

## Features

- Lit web components for modern, reactive UI
- TypeScript for type safety
- Vite for fast development and building
- Hot module replacement (HMR) for Lit components
- Shared types with backend via `@shared`

## Usage

```bash
# Development (from root)
npm run dev:frontend

# Build (from root)
npm run build:frontend
```

## Component Development

Components should follow Lit conventions:

```typescript
import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("my-component")
export class MyComponent extends LitElement {
  @property() text = "";

  static styles = css`
    :host {
      display: block;
    }
  `;

  render() {
    return html`<p>${this.text}</p>`;
  }
}
```

## Importing Shared Types

```typescript
import { ISession, ITranscriptEntry } from "@shared";
```
