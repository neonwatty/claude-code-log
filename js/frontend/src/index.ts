import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { ApiResponse } from '@app/shared';

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
    .status {
      margin-top: 20px;
      padding: 10px;
      background: #f0f0f0;
      border-radius: 4px;
    }
  `;

  @property({ type: String })
  serverStatus = 'Checking...';

  async connectedCallback() {
    super.connectedCallback();
    await this.checkServerHealth();
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

  render() {
    return html`
      <h1>TypeScript Full-Stack App</h1>
      <div class="status">Server Status: ${this.serverStatus}</div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'app-root': AppRoot;
  }
}
