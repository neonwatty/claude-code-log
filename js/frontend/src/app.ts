import { LitElement, html, css } from 'lit';
import { User, LogEntry } from '@shared/types';

export class AppMain extends LitElement {
  users: User[] = [];
  logs: LogEntry[] = [];

  static styles = css`
    :host {
      display: block;
      padding: 16px;
      font-family: Arial, sans-serif;
    }
    
    h1 {
      color: #333;
    }
  `;

  render() {
    return html`
      <h1>Claude Code Log</h1>
      <p>Users: ${this.users.length}</p>
      <p>Log entries: ${this.logs.length}</p>
    `;
  }
}

// Simple test to verify shared types import works
const testUser: User = {
  id: '1',
  name: 'Test User',
  email: 'test@example.com',
  createdAt: new Date().toISOString()
};

console.log('Test user:', testUser);