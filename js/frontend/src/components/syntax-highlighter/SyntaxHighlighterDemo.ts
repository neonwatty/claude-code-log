import { html, css, CSSResultGroup } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { BaseComponent } from '../base/BaseComponent';
import { baseStyles } from '../styles/theme';
import { SyntaxTheme, LanguageDetection } from './SyntaxHighlighter';
import './SyntaxHighlighter';

/**
 * Comprehensive demo component for SyntaxHighlighter showcasing all supported languages and features
 */
@customElement('syntax-highlighter-demo')
export class SyntaxHighlighterDemo extends BaseComponent {
  static styles: CSSResultGroup = [
    baseStyles,
    css`
      :host {
        display: block;
        padding: var(--space-lg);
        max-width: 1400px;
        margin: 0 auto;
      }

      .demo-container {
        display: flex;
        flex-direction: column;
        gap: var(--space-lg);
      }

      .demo-section {
        background: var(--color-background);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius);
        overflow: hidden;
      }

      .demo-header {
        background: var(--color-background-secondary);
        padding: var(--space-md);
        border-bottom: 1px solid var(--color-border);
      }

      .demo-title {
        font-size: var(--font-size-lg);
        font-weight: var(--font-weight-semibold);
        margin: 0;
        color: var(--color-text-primary);
      }

      .demo-description {
        font-size: var(--font-size-sm);
        color: var(--color-text-secondary);
        margin-top: var(--space-xs);
      }

      .demo-content {
        padding: var(--space-md);
      }

      .controls {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-md);
        margin-bottom: var(--space-lg);
        padding: var(--space-md);
        background: var(--color-background-secondary);
        border-radius: var(--border-radius);
        border: 1px solid var(--color-border);
      }

      .control-group {
        display: flex;
        flex-direction: column;
        gap: var(--space-xs);
      }

      .control-label {
        font-size: var(--font-size-xs);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      .control-buttons {
        display: flex;
        gap: var(--space-xs);
        flex-wrap: wrap;
      }

      .control-button {
        background: var(--color-primary);
        color: var(--color-text-inverse);
        border: none;
        padding: var(--space-xs) var(--space-sm);
        border-radius: var(--border-radius);
        cursor: pointer;
        font-size: var(--font-size-sm);
        transition: all var(--transition-fast);
      }

      .control-button:hover {
        background: var(--color-primary-dark);
      }

      .control-button.active {
        background: var(--color-success);
      }

      .control-button.secondary {
        background: var(--color-background-tertiary);
        color: var(--color-text-primary);
        border: 1px solid var(--color-border);
      }

      .control-button.secondary:hover {
        background: var(--color-background-secondary);
      }

      .language-grid {
        display: grid;
        grid-template-columns: 1fr;
        gap: var(--space-md);
      }

      @media (min-width: 1024px) {
        .language-grid.two-columns {
          grid-template-columns: 1fr 1fr;
        }
      }

      .language-section {
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius);
        overflow: hidden;
      }

      .language-header {
        background: var(--color-background-tertiary);
        padding: var(--space-sm) var(--space-md);
        font-size: var(--font-size-sm);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-secondary);
        border-bottom: 1px solid var(--color-border);
      }

      .features-demo {
        display: grid;
        grid-template-columns: 1fr;
        gap: var(--space-md);
        margin-top: var(--space-md);
      }

      @media (min-width: 768px) {
        .features-demo {
          grid-template-columns: 1fr 1fr;
        }
      }

      .feature-item {
        background: var(--color-background);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius);
        padding: var(--space-md);
      }

      .feature-title {
        font-size: var(--font-size-md);
        font-weight: var(--font-weight-semibold);
        margin: 0 0 var(--space-sm) 0;
        color: var(--color-text-primary);
      }

      .feature-description {
        font-size: var(--font-size-sm);
        color: var(--color-text-secondary);
        margin-bottom: var(--space-md);
      }

      .performance-info {
        background: var(--color-info-light);
        border: 1px solid var(--color-info);
        border-radius: var(--border-radius);
        padding: var(--space-sm);
        margin-bottom: var(--space-md);
        font-size: var(--font-size-sm);
        color: var(--color-info-dark);
      }

      .stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
        gap: var(--space-sm);
        margin-top: var(--space-md);
      }

      .stat-item {
        background: var(--color-background-tertiary);
        border-radius: var(--border-radius);
        padding: var(--space-sm);
        text-align: center;
        border: 1px solid var(--color-border);
      }

      .stat-value {
        font-size: var(--font-size-lg);
        font-weight: var(--font-weight-bold);
        color: var(--color-primary);
      }

      .stat-label {
        font-size: var(--font-size-xs);
        color: var(--color-text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
    `,
  ];

  @state()
  private theme: SyntaxTheme = 'auto';

  @state()
  private showLineNumbers = true;

  @state()
  private showHeader = true;

  @state()
  private copyable = true;

  @state()
  private compact = false;

  @state()
  private detection: LanguageDetection = 'auto';

  @state()
  private twoColumns = true;

  render() {
    return html`
      <div class="demo-container">
        ${this.renderControls()}
        ${this.renderLanguageShowcase()}
        ${this.renderFeatureDemo()}
        ${this.renderPerformanceDemo()}
      </div>
    `;
  }

  private renderControls() {
    return html`
      <div class="controls">
        <div class="control-group">
          <div class="control-label">Theme</div>
          <div class="control-buttons">
            ${(['auto', 'light', 'dark'] as SyntaxTheme[]).map(t => html`
              <button 
                class="control-button ${this.theme === t ? 'active' : ''}"
                @click=${() => this.theme = t}
              >
                ${t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            `)}
          </div>
        </div>

        <div class="control-group">
          <div class="control-label">Detection</div>
          <div class="control-buttons">
            ${(['auto', 'manual'] as LanguageDetection[]).map(d => html`
              <button 
                class="control-button ${this.detection === d ? 'active' : ''}"
                @click=${() => this.detection = d}
              >
                ${d.charAt(0).toUpperCase() + d.slice(1)}
              </button>
            `)}
          </div>
        </div>

        <div class="control-group">
          <div class="control-label">Features</div>
          <div class="control-buttons">
            <button 
              class="control-button ${this.showLineNumbers ? 'active' : 'secondary'}"
              @click=${() => this.showLineNumbers = !this.showLineNumbers}
            >
              Line Numbers
            </button>
            <button 
              class="control-button ${this.showHeader ? 'active' : 'secondary'}"
              @click=${() => this.showHeader = !this.showHeader}
            >
              Header
            </button>
            <button 
              class="control-button ${this.copyable ? 'active' : 'secondary'}"
              @click=${() => this.copyable = !this.copyable}
            >
              Copy
            </button>
            <button 
              class="control-button ${this.compact ? 'active' : 'secondary'}"
              @click=${() => this.compact = !this.compact}
            >
              Compact
            </button>
          </div>
        </div>

        <div class="control-group">
          <div class="control-label">Layout</div>
          <div class="control-buttons">
            <button 
              class="control-button ${this.twoColumns ? 'active' : 'secondary'}"
              @click=${() => this.twoColumns = !this.twoColumns}
            >
              Two Columns
            </button>
          </div>
        </div>
      </div>
    `;
  }

  private renderLanguageShowcase() {
    const languages = [
      { 
        name: 'JavaScript',
        code: `// Modern JavaScript with ES6+ features
const apiClient = {
  baseURL: 'https://api.example.com',
  
  async fetchUser(id) {
    try {
      const response = await fetch(\`\${this.baseURL}/users/\${id}\`);
      const user = await response.json();
      return { ...user, lastUpdated: new Date() };
    } catch (error) {
      console.error('Failed to fetch user:', error);
      throw new Error(\`User \${id} not found\`);
    }
  },
  
  // Using array methods and destructuring
  processUsers: (users) => users
    .filter(({ active }) => active)
    .map(({ id, name, email }) => ({ id, name, email }))
    .sort((a, b) => a.name.localeCompare(b.name))
};

export default apiClient;`
      },
      {
        name: 'TypeScript', 
        code: `interface User {
  id: string;
  name: string;
  email: string;
  profile?: UserProfile;
}

interface UserProfile {
  avatar: string;
  bio: string;
  preferences: Record<string, unknown>;
}

class UserService<T extends User = User> {
  private cache = new Map<string, T>();
  
  constructor(private apiUrl: string) {}
  
  async getUser(id: string): Promise<T | null> {
    if (this.cache.has(id)) {
      return this.cache.get(id)!;
    }
    
    try {
      const response = await fetch(\`\${this.apiUrl}/users/\${id}\`);
      if (!response.ok) {
        throw new Error(\`HTTP \${response.status}\`);
      }
      
      const user = await response.json() as T;
      this.cache.set(id, user);
      return user;
    } catch (error) {
      console.error(\`Failed to fetch user \${id}:\`, error);
      return null;
    }
  }
  
  invalidateCache(id?: string): void {
    if (id) {
      this.cache.delete(id);
    } else {
      this.cache.clear();
    }
  }
}

export { UserService, type User, type UserProfile };`
      },
      {
        name: 'Python',
        code: `"""
Advanced Python example with modern features
"""
from typing import Dict, List, Optional, Protocol, TypeVar
from dataclasses import dataclass, field
from contextlib import asynccontextmanager
import asyncio
import json

T = TypeVar('T')

class Serializable(Protocol):
    def to_dict(self) -> Dict[str, any]: ...

@dataclass
class User:
    id: str
    name: str
    email: str
    tags: List[str] = field(default_factory=list)
    metadata: Dict[str, any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, any]:
        return {
            'id': self.id,
            'name': self.name,
            'email': self.email,
            'tags': self.tags,
            'metadata': self.metadata
        }

class UserRepository:
    def __init__(self, connection_pool):
        self.pool = connection_pool
        self._cache: Dict[str, User] = {}
    
    @asynccontextmanager
    async def get_connection(self):
        conn = await self.pool.acquire()
        try:
            yield conn
        finally:
            await self.pool.release(conn)
    
    async def find_user(self, user_id: str) -> Optional[User]:
        if user_id in self._cache:
            return self._cache[user_id]
        
        async with self.get_connection() as conn:
            result = await conn.fetchrow(
                "SELECT * FROM users WHERE id = $1", user_id
            )
            
            if result:
                user = User(**dict(result))
                self._cache[user_id] = user
                return user
        
        return None
    
    async def save_users(self, users: List[User]) -> None:
        async with self.get_connection() as conn:
            values = [user.to_dict() for user in users]
            await conn.executemany(
                """
                INSERT INTO users (id, name, email, tags, metadata)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (id) DO UPDATE SET
                    name = EXCLUDED.name,
                    email = EXCLUDED.email,
                    tags = EXCLUDED.tags,
                    metadata = EXCLUDED.metadata
                """,
                [(u['id'], u['name'], u['email'], 
                  json.dumps(u['tags']), json.dumps(u['metadata'])) 
                 for u in values]
            )
            
            # Update cache
            for user in users:
                self._cache[user.id] = user`
      },
      {
        name: 'Go',
        code: `package main

import (
    "context"
    "encoding/json"
    "fmt"
    "log"
    "net/http"
    "time"

    "github.com/gorilla/mux"
    "github.com/redis/go-redis/v9"
)

type User struct {
    ID       string            \`json:"id" db:"id"\`
    Name     string            \`json:"name" db:"name"\`
    Email    string            \`json:"email" db:"email"\`
    Metadata map[string]any    \`json:"metadata" db:"metadata"\`
    Created  time.Time         \`json:"created" db:"created_at"\`
}

type UserService struct {
    cache  *redis.Client
    db     *sql.DB
    logger *log.Logger
}

func NewUserService(cache *redis.Client, db *sql.DB) *UserService {
    return &UserService{
        cache:  cache,
        db:     db,
        logger: log.New(os.Stdout, "[UserService] ", log.LstdFlags),
    }
}

func (s *UserService) GetUser(ctx context.Context, id string) (*User, error) {
    cacheKey := fmt.Sprintf("user:%s", id)
    
    // Try cache first
    cached, err := s.cache.Get(ctx, cacheKey).Result()
    if err == nil {
        var user User
        if err := json.Unmarshal([]byte(cached), &user); err == nil {
            s.logger.Printf("Cache hit for user %s", id)
            return &user, nil
        }
    }
    
    // Fallback to database
    query := \`SELECT id, name, email, metadata, created_at 
             FROM users WHERE id = $1\`
    
    var user User
    var metadataBytes []byte
    
    err = s.db.QueryRowContext(ctx, query, id).Scan(
        &user.ID, &user.Name, &user.Email, 
        &metadataBytes, &user.Created,
    )
    
    if err != nil {
        return nil, fmt.Errorf("user not found: %w", err)
    }
    
    if len(metadataBytes) > 0 {
        if err := json.Unmarshal(metadataBytes, &user.Metadata); err != nil {
            s.logger.Printf("Failed to unmarshal metadata: %v", err)
        }
    }
    
    // Cache the result
    if userJSON, err := json.Marshal(user); err == nil {
        s.cache.Set(ctx, cacheKey, userJSON, 15*time.Minute)
    }
    
    return &user, nil
}

func (s *UserService) HandleGetUser(w http.ResponseWriter, r *http.Request) {
    vars := mux.Vars(r)
    userID := vars["id"]
    
    if userID == "" {
        http.Error(w, "User ID is required", http.StatusBadRequest)
        return
    }
    
    ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
    defer cancel()
    
    user, err := s.GetUser(ctx, userID)
    if err != nil {
        s.logger.Printf("Error fetching user %s: %v", userID, err)
        http.Error(w, "User not found", http.StatusNotFound)
        return
    }
    
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(user)
}`
      },
      {
        name: 'Rust',
        code: `use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub id: String,
    pub name: String,
    pub email: String,
    pub metadata: HashMap<String, serde_json::Value>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, thiserror::Error)]
pub enum UserError {
    #[error("User not found: {id}")]
    NotFound { id: String },
    #[error("Database error: {source}")]
    Database {
        #[from]
        source: sqlx::Error,
    },
    #[error("Cache error: {source}")]
    Cache {
        #[from]
        source: redis::RedisError,
    },
}

pub struct UserService {
    db: sqlx::PgPool,
    cache: Arc<RwLock<redis::Client>>,
    local_cache: Arc<RwLock<HashMap<String, (User, DateTime<Utc>)>>>,
}

impl UserService {
    pub fn new(db: sqlx::PgPool, cache: redis::Client) -> Self {
        Self {
            db,
            cache: Arc::new(RwLock::new(cache)),
            local_cache: Arc::new(RwLock::new(HashMap::new())),
        }
    }
    
    pub async fn get_user(&self, id: &str) -> Result<User, UserError> {
        // Check local cache first (fastest)
        {
            let cache = self.local_cache.read().await;
            if let Some((user, cached_at)) = cache.get(id) {
                if Utc::now().signed_duration_since(*cached_at).num_minutes() < 5 {
                    return Ok(user.clone());
                }
            }
        }
        
        // Check Redis cache
        let cache_key = format!("user:{}", id);
        let redis = self.cache.read().await;
        
        match redis.get::<_, String>(&cache_key).await {
            Ok(cached_user) => {
                if let Ok(user) = serde_json::from_str::<User>(&cached_user) {
                    // Update local cache
                    self.local_cache.write().await
                        .insert(id.to_string(), (user.clone(), Utc::now()));
                    return Ok(user);
                }
            }
            Err(redis::RedisError { kind: redis::ErrorKind::TypeError, .. }) => {
                // Key doesn't exist, continue to database
            }
            Err(e) => return Err(UserError::Cache { source: e }),
        }
        
        // Fetch from database
        let user = sqlx::query_as!(
            User,
            r#"
            SELECT id, name, email, metadata, created_at
            FROM users 
            WHERE id = $1
            "#,
            id
        )
        .fetch_optional(&self.db)
        .await?
        .ok_or_else(|| UserError::NotFound { id: id.to_string() })?;
        
        // Cache the result
        if let Ok(serialized) = serde_json::to_string(&user) {
            let _ = redis.set_ex(&cache_key, &serialized, 900).await;
        }
        
        // Update local cache
        self.local_cache.write().await
            .insert(id.to_string(), (user.clone(), Utc::now()));
        
        Ok(user)
    }
    
    pub async fn create_user(&self, mut user: User) -> Result<User, UserError> {
        user.created_at = Utc::now();
        
        let created_user = sqlx::query_as!(
            User,
            r#"
            INSERT INTO users (id, name, email, metadata, created_at)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, name, email, metadata, created_at
            "#,
            user.id,
            user.name,
            user.email,
            serde_json::to_value(&user.metadata).unwrap(),
            user.created_at
        )
        .fetch_one(&self.db)
        .await?;
        
        // Invalidate caches
        let cache_key = format!("user:{}", created_user.id);
        let redis = self.cache.read().await;
        let _ = redis.del(&cache_key).await;
        
        self.local_cache.write().await.remove(&created_user.id);
        
        Ok(created_user)
    }
}`
      },
      {
        name: 'JSON',
        code: `{
  "openapi": "3.0.0",
  "info": {
    "title": "User Management API",
    "version": "1.2.0",
    "description": "Comprehensive API for managing users with caching and real-time features"
  },
  "servers": [
    {
      "url": "https://api.example.com/v1",
      "description": "Production server"
    },
    {
      "url": "https://staging-api.example.com/v1", 
      "description": "Staging server"
    }
  ],
  "paths": {
    "/users/{id}": {
      "get": {
        "summary": "Get user by ID",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string",
              "pattern": "^[a-zA-Z0-9_-]+$"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "User found",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/User"
                }
              }
            }
          },
          "404": {
            "description": "User not found"
          }
        }
      }
    }
  },
  "components": {
    "schemas": {
      "User": {
        "type": "object",
        "required": ["id", "name", "email"],
        "properties": {
          "id": {
            "type": "string",
            "description": "Unique user identifier"
          },
          "name": {
            "type": "string",
            "minLength": 1,
            "maxLength": 100
          },
          "email": {
            "type": "string",
            "format": "email"
          },
          "profile": {
            "$ref": "#/components/schemas/UserProfile"
          },
          "metadata": {
            "type": "object",
            "additionalProperties": true
          },
          "createdAt": {
            "type": "string",
            "format": "date-time"
          }
        }
      },
      "UserProfile": {
        "type": "object",
        "properties": {
          "avatar": {
            "type": "string",
            "format": "uri"
          },
          "bio": {
            "type": "string",
            "maxLength": 500
          },
          "preferences": {
            "type": "object",
            "properties": {
              "theme": {
                "type": "string",
                "enum": ["light", "dark", "auto"]
              },
              "notifications": {
                "type": "boolean"
              },
              "language": {
                "type": "string",
                "pattern": "^[a-z]{2}-[A-Z]{2}$"
              }
            }
          }
        }
      }
    }
  }
}`
      },
      {
        name: 'SQL',
        code: `-- Comprehensive database schema with advanced features
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Users table with JSONB for flexible metadata
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE NULL,
    
    CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$')
);

-- User profiles with foreign key relationship
CREATE TABLE user_profiles (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    avatar_url TEXT,
    bio TEXT CHECK (LENGTH(bio) <= 500),
    preferences JSONB DEFAULT '{}',
    social_links JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User sessions for authentication tracking
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    user_agent TEXT,
    ip_address INET,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance optimization
CREATE INDEX idx_users_email_trgm ON users USING gin (email gin_trgm_ops);
CREATE INDEX idx_users_name_trgm ON users USING gin (name gin_trgm_ops);
CREATE INDEX idx_users_metadata_gin ON users USING gin (metadata);
CREATE INDEX idx_users_created_at ON users (created_at DESC);
CREATE INDEX idx_users_active ON users (id) WHERE deleted_at IS NULL;

CREATE INDEX idx_sessions_user_id ON user_sessions (user_id);
CREATE INDEX idx_sessions_expires_at ON user_sessions (expires_at);
CREATE INDEX idx_sessions_active ON user_sessions (user_id, expires_at) WHERE expires_at > NOW();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language plpgsql;

-- Triggers to automatically update timestamps
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at 
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- View for active users with profile information
CREATE VIEW active_users_with_profiles AS
SELECT 
    u.id,
    u.email,
    u.name,
    u.metadata,
    u.created_at,
    u.updated_at,
    p.avatar_url,
    p.bio,
    p.preferences,
    p.social_links,
    COUNT(s.id) FILTER (WHERE s.expires_at > NOW()) as active_sessions
FROM users u
LEFT JOIN user_profiles p ON u.id = p.user_id
LEFT JOIN user_sessions s ON u.id = s.user_id
WHERE u.deleted_at IS NULL
GROUP BY u.id, p.user_id, p.avatar_url, p.bio, p.preferences, p.social_links;

-- Function for fuzzy user search
CREATE OR REPLACE FUNCTION search_users(search_term TEXT, limit_count INT DEFAULT 10)
RETURNS TABLE(
    id UUID,
    email VARCHAR(255),
    name VARCHAR(100),
    similarity REAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.id,
        u.email,
        u.name,
        GREATEST(
            similarity(u.name, search_term),
            similarity(u.email, search_term)
        ) as similarity
    FROM users u
    WHERE 
        u.deleted_at IS NULL AND
        (
            u.name ILIKE '%' || search_term || '%' OR
            u.email ILIKE '%' || search_term || '%' OR
            similarity(u.name, search_term) > 0.3 OR
            similarity(u.email, search_term) > 0.3
        )
    ORDER BY similarity DESC, u.created_at DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Cleanup old sessions procedure
CREATE OR REPLACE PROCEDURE cleanup_expired_sessions()
LANGUAGE plpgsql
AS $$
DECLARE
    deleted_count INT;
BEGIN
    DELETE FROM user_sessions 
    WHERE expires_at < NOW() - INTERVAL '7 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Cleaned up % expired sessions', deleted_count;
END;
$$;`
      }
    ];

    return html`
      <div class="demo-section">
        <div class="demo-header">
          <h2 class="demo-title">Supported Languages</h2>
          <p class="demo-description">
            Comprehensive syntax highlighting for major programming languages
          </p>
        </div>
        <div class="demo-content">
          <div class="language-grid ${this.twoColumns ? 'two-columns' : ''}">
            ${languages.map(lang => html`
              <div class="language-section">
                <div class="language-header">${lang.name}</div>
                <syntax-highlighter
                  .code=${lang.code}
                  .language=${this.detection === 'manual' ? lang.name.toLowerCase() : ''}
                  .theme=${this.theme}
                  .lineNumbers=${this.showLineNumbers}
                  .showHeader=${this.showHeader}
                  .copyable=${this.copyable}
                  .compact=${this.compact}
                  .detection=${this.detection}
                  maxHeight="300px"
                ></syntax-highlighter>
              </div>
            `)}
          </div>
        </div>
      </div>
    `;
  }

  private renderFeatureDemo() {
    const features = [
      {
        title: 'Line Highlighting',
        description: 'Highlight specific lines to draw attention',
        code: `function calculateTotal(items) {
  let total = 0;
  for (const item of items) {
    total += item.price * item.quantity; // <- This line is highlighted
  }
  return total;
}`,
        highlightLines: [4]
      },
      {
        title: 'Theme Switching',
        description: 'Automatic theme detection with manual override',
        code: `:host([theme="dark"]) {
  --syntax-bg: #1e1e1e;
  --syntax-text: #d4d4d4;
  --syntax-comment: #6a9955;
  --syntax-keyword: #569cd6;
}`,
        theme: 'dark' as SyntaxTheme
      }
    ];

    return html`
      <div class="demo-section">
        <div class="demo-header">
          <h2 class="demo-title">Advanced Features</h2>
          <p class="demo-description">
            Specialized functionality for enhanced code display
          </p>
        </div>
        <div class="demo-content">
          <div class="features-demo">
            ${features.map(feature => html`
              <div class="feature-item">
                <h3 class="feature-title">${feature.title}</h3>
                <p class="feature-description">${feature.description}</p>
                <syntax-highlighter
                  .code=${feature.code}
                  .language=${'javascript'}
                  .theme=${feature.theme || this.theme}
                  .lineNumbers=${true}
                  .showHeader=${this.showHeader}
                  .copyable=${this.copyable}
                  .highlightLines=${feature.highlightLines || []}
                ></syntax-highlighter>
              </div>
            `)}
          </div>
        </div>
      </div>
    `;
  }

  private renderPerformanceDemo() {
    // Generate a large code sample for performance testing
    const largeCode = Array.from({ length: 100 }, (_, i) => 
      `function performanceTest${i}(data) {
  const processed = data.map(item => ({
    ...item,
    processed: true,
    timestamp: Date.now(),
    index: ${i}
  }));
  
  return processed.filter(item => item.active);
}`
    ).join('\n\n');

    const stats = [
      { value: '15+', label: 'Languages' },
      { value: '3', label: 'Themes' },
      { value: '<100ms', label: 'Render Time' },
      { value: '500+', label: 'Max Lines' }
    ];

    return html`
      <div class="demo-section">
        <div class="demo-header">
          <h2 class="demo-title">Performance & Large Content</h2>
          <p class="demo-description">
            Optimized rendering for large code blocks with performance metrics
          </p>
        </div>
        <div class="demo-content">
          <div class="performance-info">
            ⚡ Performance optimizations: Virtual scrolling for large content, selective language loading, 
            and efficient syntax highlighting with highlight.js core + ES6 modules.
          </div>
          
          <div class="stats-grid">
            ${stats.map(stat => html`
              <div class="stat-item">
                <div class="stat-value">${stat.value}</div>
                <div class="stat-label">${stat.label}</div>
              </div>
            `)}
          </div>
          
          <syntax-highlighter
            .code=${largeCode}
            language="javascript"
            .theme=${this.theme}
            .lineNumbers=${this.showLineNumbers}
            .showHeader=${this.showHeader}
            .copyable=${this.copyable}
            .compact=${this.compact}
            maxHeight="400px"
            .highlightLines=${[5, 15, 25]}
          ></syntax-highlighter>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'syntax-highlighter-demo': SyntaxHighlighterDemo;
  }
}