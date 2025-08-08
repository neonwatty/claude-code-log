import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { ApiResponse, User } from '@app/shared';

@customElement('app-users')
export class AppUsers extends LitElement {
  static styles = css`
    :host {
      display: block;
    }
    .user-list {
      margin-top: 20px;
    }
    .user-item {
      padding: 12px;
      border: 1px solid #ddd;
      border-radius: 4px;
      margin-bottom: 8px;
      background: #fafafa;
    }
    .user-name {
      font-weight: bold;
      color: #333;
    }
    .user-email {
      color: #666;
      font-size: 0.9em;
    }
    .user-meta {
      color: #999;
      font-size: 0.8em;
      margin-top: 4px;
    }
    .loading {
      text-align: center;
      padding: 20px;
      color: #666;
    }
    .error {
      color: #d32f2f;
      padding: 12px;
      background: #ffebee;
      border-radius: 4px;
      margin-top: 10px;
    }
    .add-user-form {
      background: #f5f5f5;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 20px;
    }
    .form-group {
      margin-bottom: 15px;
    }
    .form-group label {
      display: block;
      margin-bottom: 5px;
      font-weight: bold;
    }
    .form-group input {
      width: 100%;
      padding: 8px;
      border: 1px solid #ddd;
      border-radius: 4px;
      box-sizing: border-box;
    }
    .btn {
      background: #0066cc;
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 4px;
      cursor: pointer;
    }
    .btn:hover {
      background: #0052a3;
    }
  `;

  @state()
  users: User[] = [];

  @state()
  loading = true;

  @state()
  error = '';

  @state()
  newUserName = '';

  @state()
  newUserEmail = '';

  async connectedCallback() {
    super.connectedCallback();
    await this.loadUsers();
  }

  async loadUsers() {
    try {
      this.loading = true;
      this.error = '';
      
      const response = await fetch('http://localhost:3000/api/users');
      const data: ApiResponse<User[]> = await response.json();

      if (data.success) {
        this.users = data.data;
      } else {
        this.error = 'Failed to load users';
      }
    } catch (error) {
      this.error = 'Cannot connect to server';
    } finally {
      this.loading = false;
    }
  }

  async handleAddUser(e: Event) {
    e.preventDefault();
    
    if (!this.newUserName.trim() || !this.newUserEmail.trim()) {
      this.error = 'Name and email are required';
      return;
    }

    try {
      const response = await fetch('http://localhost:3000/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: this.newUserName.trim(),
          email: this.newUserEmail.trim(),
        }),
      });

      const data: ApiResponse<User> = await response.json();

      if (data.success) {
        this.users = [...this.users, data.data];
        this.newUserName = '';
        this.newUserEmail = '';
        this.error = '';
      } else {
        this.error = 'Failed to create user';
      }
    } catch (error) {
      this.error = 'Cannot connect to server';
    }
  }

  render() {
    return html`
      <h2>Users Management</h2>

      <div class="add-user-form">
        <h3>Add New User</h3>
        <form @submit=${this.handleAddUser}>
          <div class="form-group">
            <label for="name">Name:</label>
            <input
              id="name"
              type="text"
              .value=${this.newUserName}
              @input=${(e: Event) => {
                this.newUserName = (e.target as HTMLInputElement).value;
              }}
              placeholder="Enter user name"
            />
          </div>
          <div class="form-group">
            <label for="email">Email:</label>
            <input
              id="email"
              type="email"
              .value=${this.newUserEmail}
              @input=${(e: Event) => {
                this.newUserEmail = (e.target as HTMLInputElement).value;
              }}
              placeholder="Enter user email"
            />
          </div>
          <button type="submit" class="btn">Add User</button>
        </form>
      </div>

      ${this.error ? html`<div class="error">${this.error}</div>` : ''}

      ${this.loading 
        ? html`<div class="loading">Loading users...</div>`
        : html`
          <div class="user-list">
            <h3>Current Users (${this.users.length})</h3>
            ${this.users.length === 0
              ? html`<p>No users found. Add some users to get started!</p>`
              : this.users.map(user => html`
                <div class="user-item">
                  <div class="user-name">${user.name}</div>
                  <div class="user-email">${user.email}</div>
                  <div class="user-meta">
                    ID: ${user.id} | Created: ${new Date(user.createdAt).toLocaleDateString()}
                  </div>
                </div>
              `)
            }
          </div>
        `
      }
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'app-users': AppUsers;
  }
}