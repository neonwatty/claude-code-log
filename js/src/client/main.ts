import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('claude-code-log-app')
export class ClaudeCodeLogApp extends LitElement {
  @property()
  title = 'Claude Code Log - TypeScript';

  static styles = css`
    :host {
      display: block;
      min-height: 100vh;
      background-color: #f5f5f5;
    }

    .app-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
    }

    .header {
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      margin-bottom: 20px;
    }

    .title {
      margin: 0;
      color: #333;
      font-size: 2rem;
      font-weight: 600;
    }

    .subtitle {
      margin: 10px 0 0 0;
      color: #666;
      font-size: 1rem;
    }

    .content {
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    .status {
      color: #28a745;
      font-weight: 500;
    }
  `;

  render() {
    return html`
      <div class="app-container">
        <div class="header">
          <h1 class="title">${this.title}</h1>
          <p class="subtitle">
            TypeScript full-stack application for converting Claude Code transcript JSONL files
          </p>
        </div>

        <div class="content">
          <p class="status">✅ Project structure initialized successfully!</p>
          <p>
            This is the TypeScript version of the Claude Code Log application. The project structure
            has been set up with:
          </p>
          <ul>
            <li>Express.js backend with TypeScript</li>
            <li>Lit frontend with Vite build system</li>
            <li>Shared TypeScript interfaces and utilities</li>
            <li>Development tooling (ESLint, Prettier, Jest)</li>
            <li>WebSocket support for real-time updates</li>
          </ul>
          <p>Next steps: Configure the backend Express.js server and frontend Lit components.</p>
        </div>
      </div>
    `;
  }
}

// Initialize the app
const app = document.getElementById('app');
if (app) {
  app.innerHTML = '<claude-code-log-app></claude-code-log-app>';
}
