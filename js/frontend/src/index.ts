import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { ApiResponse } from '@app/shared';
// import './components/users';
import './components/message-display';
import './components/tool-use';
import './components/syntax-highlighter';

@customElement('app-root')
export class AppRoot extends LitElement {
  static styles = css`
    :host {
      display: block;
      padding: 16px;
      font-family:
        system-ui,
        -apple-system,
        sans-serif;
    }
    h1 {
      color: #333;
    }
    .nav {
      margin: 20px 0;
      border-bottom: 1px solid #ddd;
      padding-bottom: 10px;
    }
    .nav a {
      margin-right: 20px;
      color: #0066cc;
      text-decoration: none;
      padding: 8px 12px;
      border-radius: 4px;
    }
    .nav a:hover {
      background: #f0f0f0;
    }
    .nav a.active {
      background: #0066cc;
      color: white;
    }
    .status {
      margin-top: 20px;
      padding: 10px;
      background: #f0f0f0;
      border-radius: 4px;
    }
    .content {
      margin-top: 20px;
    }
  `;

  @property({ type: String })
  serverStatus = 'Checking...';

  @property({ type: String })
  currentRoute = 'home';

  async connectedCallback() {
    super.connectedCallback();
    await this.checkServerHealth();
    this.handleRouting();
    window.addEventListener('hashchange', () => this.handleRouting());
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('hashchange', () => this.handleRouting());
  }

  handleRouting() {
    const hash = window.location.hash.slice(1) || 'home';
    this.currentRoute = hash;
  }

  async checkServerHealth() {
    try {
      const response = await fetch('http://localhost:3000/api/health');
      const data: ApiResponse = await response.json();

      if (data.success) {
        this.serverStatus = `Server is ${data.data.status}`;
      } else {
        this.serverStatus = 'Server error';
      }
    } catch (error) {
      this.serverStatus = 'Cannot connect to server';
    }
  }

  renderContent() {
    switch (this.currentRoute) {
      case 'home':
        return html`
          <h2>Welcome to the Application</h2>
          <p>This is the home page of your TypeScript full-stack application.</p>
        `;
      case 'messages':
        return html`<message-display-demo></message-display-demo>`;
      case 'tools':
        return html`<tool-use-demo></tool-use-demo>`;
      case 'syntax':
        return html`<syntax-highlighter-demo></syntax-highlighter-demo>`;
      case 'about':
        return html`
          <h2>About</h2>
          <p>This is a TypeScript full-stack application built with Node.js, Express, and Lit.</p>
        `;
      default:
        return html`
          <h2>Page Not Found</h2>
          <p>The requested page could not be found.</p>
        `;
    }
  }

  render() {
    return html`
      <h1>TypeScript Full-Stack App</h1>
      
      <nav class="nav">
        <a href="#home" class="${this.currentRoute === 'home' ? 'active' : ''}">Home</a>
        <a href="#messages" class="${this.currentRoute === 'messages' ? 'active' : ''}">Messages</a>
        <a href="#tools" class="${this.currentRoute === 'tools' ? 'active' : ''}">Tools</a>
        <a href="#syntax" class="${this.currentRoute === 'syntax' ? 'active' : ''}">Syntax</a>
        <a href="#about" class="${this.currentRoute === 'about' ? 'active' : ''}">About</a>
      </nav>

      <div class="content">
        ${this.renderContent()}
      </div>

      <div class="status">Server Status: ${this.serverStatus}</div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'app-root': AppRoot;
  }
}
