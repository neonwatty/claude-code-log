import * as dotenv from 'dotenv';
import path from 'path';

// Load environment-specific .env file
const envFile = process.env.NODE_ENV ? `.env.${process.env.NODE_ENV}` : '.env';
const envPath = path.resolve(process.cwd(), envFile);

dotenv.config({ path: envPath });

// Fallback to .env if environment-specific file doesn't exist
if (process.env.NODE_ENV) {
  dotenv.config({ path: path.resolve(process.cwd(), '.env') });
}

export interface Config {
  port: number;
  nodeEnv: string;
  corsOrigin: string | string[];
  logLevel: string;
  database?: {
    url?: string;
  };
  jwt?: {
    secret?: string;
    expiresIn?: string;
  };
  fileMonitoring?: {
    enabled?: boolean;
    watchPaths?: string[];
    debounceMs?: number;
  };
}

function getEnvVar(name: string, defaultValue?: string): string {
  const value = process.env[name];
  if (value === undefined && defaultValue === undefined) {
    throw new Error(`Required environment variable ${name} is not set`);
  }
  return value || defaultValue!;
}

function getOptionalEnvVar(name: string): string | undefined {
  return process.env[name];
}

export const config: Config = {
  port: parseInt(getEnvVar('PORT', '3000'), 10),
  nodeEnv: getEnvVar('NODE_ENV', 'development'),
  corsOrigin: getEnvVar('CORS_ORIGIN', 'http://localhost:5173,http://localhost:5177').split(','),
  logLevel: getEnvVar('LOG_LEVEL', 'info'),
  database: {
    url: getOptionalEnvVar('DATABASE_URL'),
  },
  jwt: {
    secret: getOptionalEnvVar('JWT_SECRET'),
    expiresIn: getOptionalEnvVar('JWT_EXPIRES_IN'),
  },
  fileMonitoring: {
    enabled: getOptionalEnvVar('FILE_MONITORING_ENABLED') === 'true',
    watchPaths: getOptionalEnvVar('FILE_MONITORING_PATHS')?.split(',').map(p => p.trim()) || [],
    debounceMs: parseInt(getOptionalEnvVar('FILE_MONITORING_DEBOUNCE') || '300', 10),
  },
};

// Validate critical production environment variables
if (config.nodeEnv === 'production') {
  if (!config.jwt?.secret) {
    throw new Error('JWT_SECRET is required in production environment');
  }
  if (!config.database?.url) {
    throw new Error('DATABASE_URL is required in production environment');
  }
}

export default config;