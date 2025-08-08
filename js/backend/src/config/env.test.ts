import { describe, it, expect } from 'vitest';

describe('Environment Configuration', () => {
  it('should load configuration with current environment variables', async () => {
    // Test with the current environment (whatever NODE_ENV is set to)
    const { config } = await import('./env');

    expect(config).toBeDefined();
    expect(typeof config.port).toBe('number');
    expect(typeof config.nodeEnv).toBe('string');
    expect(typeof config.corsOrigin).toBe('string');
    expect(typeof config.logLevel).toBe('string');
    expect(config.port).toBeGreaterThan(0);
    expect(['development', 'test', 'production'].includes(config.nodeEnv)).toBe(true);
  });

  it('should have optional JWT configuration', async () => {
    const { config } = await import('./env');

    expect(config.jwt).toBeDefined();
    expect(typeof config.jwt?.secret === 'string' || config.jwt?.secret === undefined).toBe(true);
    expect(typeof config.jwt?.expiresIn === 'string' || config.jwt?.expiresIn === undefined).toBe(true);
  });

  it('should have optional database configuration', async () => {
    const { config } = await import('./env');

    expect(config.database).toBeDefined();
    expect(typeof config.database?.url === 'string' || config.database?.url === undefined).toBe(true);
  });

  it('should export default config', async () => {
    const defaultConfig = await import('./env');

    expect(defaultConfig.default).toBeDefined();
    expect(defaultConfig.default).toEqual(defaultConfig.config);
  });

  it('should have sensible defaults', async () => {
    const { config } = await import('./env');

    // These should always have values due to defaults
    expect(config.port).toBe(parseInt(process.env.PORT || '3000', 10));
    expect(config.nodeEnv).toBe(process.env.NODE_ENV || 'development');
    expect(config.corsOrigin).toBe(process.env.CORS_ORIGIN || 'http://localhost:5173');
    expect(config.logLevel).toBe(process.env.LOG_LEVEL || 'info');
  });
});