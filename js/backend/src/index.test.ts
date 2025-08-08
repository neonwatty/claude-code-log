import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import { resolve } from 'path';

const execAsync = promisify(exec);

describe('Backend TypeScript Compilation', () => {
  describe('Build Process', () => {
    it('should compile TypeScript without errors', async () => {
      const { stderr } = await execAsync('npm run build', {
        cwd: resolve(__dirname, '..')
      });
      
      expect(stderr).toBe('');
    }, 10000);

    it('should generate JavaScript output files', () => {
      const distPath = resolve(__dirname, '../dist/index.js');
      expect(existsSync(distPath)).toBe(true);
    });
  });

  describe('TypeScript Configuration', () => {
    it('should pass type checking', async () => {
      const { stderr } = await execAsync('npm run typecheck', {
        cwd: resolve(__dirname, '..')
      });
      
      expect(stderr).toBe('');
    }, 10000);

    it('should import shared module correctly in routes', () => {
      const healthPath = resolve(__dirname, 'routes/health.ts');
      const usersPath = resolve(__dirname, 'routes/users.ts');
      const { readFileSync } = require('fs');
      
      const healthContent = readFileSync(healthPath, 'utf-8');
      const usersContent = readFileSync(usersPath, 'utf-8');
      
      expect(healthContent).toContain("from '@app/shared'");
      expect(usersContent).toContain("from '@app/shared'");
    });
  });

  describe('Express Server Configuration', () => {
    it('should have proper middleware setup', async () => {
      const indexPath = resolve(__dirname, 'index.ts');
      const { readFileSync } = await import('fs');
      const content = readFileSync(indexPath, 'utf-8');
      
      expect(content).toContain('import express from');
      expect(content).toContain('app.use(cors');
      expect(content).toContain('app.use(express.json())');
      expect(content).toContain('app.use(express.urlencoded');
      expect(content).toContain('errorHandler');
      expect(content).toContain('notFoundHandler');
    });

    it('should have routing structure', () => {
      const routesPath = resolve(__dirname, 'routes/index.ts');
      expect(existsSync(routesPath)).toBe(true);
      
      const healthPath = resolve(__dirname, 'routes/health.ts');
      expect(existsSync(healthPath)).toBe(true);
      
      const usersPath = resolve(__dirname, 'routes/users.ts');
      expect(existsSync(usersPath)).toBe(true);
    });

    it('should have middleware functions', () => {
      const errorHandlerPath = resolve(__dirname, 'middleware/errorHandler.ts');
      expect(existsSync(errorHandlerPath)).toBe(true);
      
      const loggerPath = resolve(__dirname, 'middleware/logger.ts');
      expect(existsSync(loggerPath)).toBe(true);
      
      const validationPath = resolve(__dirname, 'middleware/validation.ts');
      expect(existsSync(validationPath)).toBe(true);
    });
  });
});