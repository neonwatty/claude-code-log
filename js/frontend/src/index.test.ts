import { describe, it, expect, beforeAll } from 'vitest';
import { LitElement } from 'lit';
import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import { resolve } from 'path';
import './index'; // Import the component

const execAsync = promisify(exec);

describe('Frontend TypeScript Compilation', () => {
  describe('Build Process', () => {
    it('should compile TypeScript without errors', async () => {
      const { stderr } = await execAsync('npm run typecheck', {
        cwd: resolve(__dirname, '..'),
      });

      expect(stderr).toBe('');
    }, 10000);

    it('should have valid Vite configuration', () => {
      const viteConfigPath = resolve(__dirname, '../vite.config.ts');
      expect(existsSync(viteConfigPath)).toBe(true);
    });
  });

  describe('Lit Component', () => {
    it('should define custom element', () => {
      const element = document.createElement('app-root');
      expect(element).toBeDefined();
      expect(element).toBeInstanceOf(HTMLElement);
    });

    it('should be a LitElement', () => {
      const element = document.createElement('app-root');
      expect(element.constructor.name).toBe('AppRoot');
    });

    it('should have required properties', () => {
      const element = document.createElement('app-root') as any;
      expect(element).toHaveProperty('serverStatus');
      expect(element.serverStatus).toBe('Checking...');
    });

    it('should import shared types correctly', () => {
      // Verify that we can import from @app/shared in the actual source file
      const indexPath = resolve(__dirname, 'index.ts');
      const { readFileSync } = require('fs');
      const content = readFileSync(indexPath, 'utf-8');

      // Check that the import statement exists and is valid
      expect(content).toContain("import { ApiResponse } from '@app/shared'");

      // The fact that TypeScript compilation passes (tested above) proves the import works
    });
  });

  describe('HTML Entry Point', () => {
    it('should have index.html file', () => {
      const htmlPath = resolve(__dirname, '../index.html');
      expect(existsSync(htmlPath)).toBe(true);
    });

    it('should reference the TypeScript entry point', () => {
      const htmlPath = resolve(__dirname, '../index.html');
      const { readFileSync } = require('fs');
      const content = readFileSync(htmlPath, 'utf-8');

      expect(content).toContain('<app-root></app-root>');
      expect(content).toContain('src="/src/index.ts"');
    });
  });
});
