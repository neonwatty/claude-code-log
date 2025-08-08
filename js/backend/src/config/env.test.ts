import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('Environment Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  it('should load development configuration by default', async () => {
    process.env.NODE_ENV = 'development';
    
    // Clear module cache to reload config
    delete require.cache[require.resolve('./env')];
    const { config } = await import('./env');

    expect(config.nodeEnv).toBe('development');
    expect(config.port).toBe(3000);
    expect(config.corsOrigin).toBe('http://localhost:5173');
    expect(config.logLevel).toBe('debug');
  });

  it('should load test configuration', async () => {
    process.env.NODE_ENV = 'test';
    
    delete require.cache[require.resolve('./env')];
    const { config } = await import('./env');

    expect(config.nodeEnv).toBe('test');
    expect(config.port).toBe(3001);
    expect(config.logLevel).toBe('warn');
  });

  it('should throw error for missing required production variables', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.JWT_SECRET;
    delete process.env.DATABASE_URL;
    
    delete require.cache[require.resolve('./env')];
    
    expect(() => require('./env')).toThrow('JWT_SECRET is required in production environment');
  });

  it('should accept production variables when provided', async () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'production-secret';
    process.env.DATABASE_URL = 'postgresql://prod:pass@localhost:5432/prod_db';
    process.env.PORT = '8080';
    
    delete require.cache[require.resolve('./env')];
    const { config } = await import('./env');

    expect(config.nodeEnv).toBe('production');
    expect(config.port).toBe(8080);
    expect(config.jwt?.secret).toBe('production-secret');
    expect(config.database?.url).toBe('postgresql://prod:pass@localhost:5432/prod_db');
  });
});