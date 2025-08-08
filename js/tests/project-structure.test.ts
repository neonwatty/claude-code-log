import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { resolve } from 'path';

const projectRoot = resolve(__dirname, '..');

describe('Project Structure Verification', () => {
  describe('Directory Structure', () => {
    it('should have all required top-level directories', () => {
      const requiredDirs = ['backend', 'frontend', 'shared'];
      
      requiredDirs.forEach(dir => {
        const dirPath = resolve(projectRoot, dir);
        expect(existsSync(dirPath), `Directory ${dir} should exist`).toBe(true);
      });
    });

    it('should have src and dist directories in each workspace', () => {
      const workspaces = ['backend', 'frontend', 'shared'];
      const subDirs = ['src', 'dist'];
      
      workspaces.forEach(workspace => {
        subDirs.forEach(subDir => {
          const path = resolve(projectRoot, workspace, subDir);
          expect(existsSync(path), `${workspace}/${subDir} should exist`).toBe(true);
        });
      });
    });
  });

  describe('Configuration Files', () => {
    it('should have root package.json with workspaces', () => {
      const packageJsonPath = resolve(projectRoot, 'package.json');
      expect(existsSync(packageJsonPath)).toBe(true);
      
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
      expect(packageJson.workspaces).toEqual(['backend', 'frontend', 'shared']);
      expect(packageJson.private).toBe(true);
    });

    it('should have package.json in each workspace', () => {
      const workspaces = [
        { name: 'backend', packageName: '@app/backend' },
        { name: 'frontend', packageName: '@app/frontend' },
        { name: 'shared', packageName: '@app/shared' }
      ];
      
      workspaces.forEach(({ name, packageName }) => {
        const packageJsonPath = resolve(projectRoot, name, 'package.json');
        expect(existsSync(packageJsonPath), `${name}/package.json should exist`).toBe(true);
        
        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
        expect(packageJson.name).toBe(packageName);
      });
    });

    it('should have TypeScript configuration files', () => {
      const tsconfigs = [
        'tsconfig.json',
        'backend/tsconfig.json',
        'frontend/tsconfig.json',
        'shared/tsconfig.json'
      ];
      
      tsconfigs.forEach(tsconfig => {
        const tsconfigPath = resolve(projectRoot, tsconfig);
        expect(existsSync(tsconfigPath), `${tsconfig} should exist`).toBe(true);
      });
    });

    it('should have proper TypeScript project references', () => {
      const rootTsconfig = JSON.parse(
        readFileSync(resolve(projectRoot, 'tsconfig.json'), 'utf-8')
      );
      
      expect(rootTsconfig.references).toContainEqual({ path: './shared' });
      expect(rootTsconfig.references).toContainEqual({ path: './backend' });
      expect(rootTsconfig.references).toContainEqual({ path: './frontend' });
    });

    it('should have Vitest configuration files', () => {
      const vitestConfigs = [
        'vitest.config.ts',
        'backend/vitest.config.ts',
        'frontend/vitest.config.ts',
        'shared/vitest.config.ts'
      ];
      
      vitestConfigs.forEach(config => {
        const configPath = resolve(projectRoot, config);
        expect(existsSync(configPath), `${config} should exist`).toBe(true);
      });
    });
  });

  describe('Source Files', () => {
    it('should have index.ts in each workspace src directory', () => {
      const workspaces = ['backend', 'frontend', 'shared'];
      
      workspaces.forEach(workspace => {
        const indexPath = resolve(projectRoot, workspace, 'src', 'index.ts');
        expect(existsSync(indexPath), `${workspace}/src/index.ts should exist`).toBe(true);
      });
    });

    it('should have test files for each workspace', () => {
      const testFiles = [
        'backend/src/index.test.ts',
        'frontend/src/index.test.ts',
        'shared/src/index.test.ts'
      ];
      
      testFiles.forEach(testFile => {
        const testPath = resolve(projectRoot, testFile);
        expect(existsSync(testPath), `${testFile} should exist`).toBe(true);
      });
    });

    it('should have frontend specific files', () => {
      expect(existsSync(resolve(projectRoot, 'frontend/index.html'))).toBe(true);
      expect(existsSync(resolve(projectRoot, 'frontend/vite.config.ts'))).toBe(true);
    });
  });

  describe('Dependencies', () => {
    it('should have correct dependencies in backend', () => {
      const packageJson = JSON.parse(
        readFileSync(resolve(projectRoot, 'backend/package.json'), 'utf-8')
      );
      
      expect(packageJson.dependencies).toHaveProperty('express');
      expect(packageJson.dependencies).toHaveProperty('cors');
      expect(packageJson.dependencies).toHaveProperty('@app/shared');
      expect(packageJson.devDependencies).toHaveProperty('typescript');
      expect(packageJson.devDependencies).toHaveProperty('vitest');
    });

    it('should have correct dependencies in frontend', () => {
      const packageJson = JSON.parse(
        readFileSync(resolve(projectRoot, 'frontend/package.json'), 'utf-8')
      );
      
      expect(packageJson.dependencies).toHaveProperty('lit');
      expect(packageJson.dependencies).toHaveProperty('@app/shared');
      expect(packageJson.devDependencies).toHaveProperty('vite');
      expect(packageJson.devDependencies).toHaveProperty('typescript');
      expect(packageJson.devDependencies).toHaveProperty('vitest');
    });
  });

  describe('Scripts', () => {
    it('should have all required scripts in root package.json', () => {
      const packageJson = JSON.parse(
        readFileSync(resolve(projectRoot, 'package.json'), 'utf-8')
      );
      
      const requiredScripts = ['dev', 'build', 'test', 'lint', 'typecheck'];
      requiredScripts.forEach(script => {
        expect(packageJson.scripts).toHaveProperty(script);
      });
    });

    it('should have test scripts in all workspaces', () => {
      const workspaces = ['backend', 'frontend', 'shared'];
      
      workspaces.forEach(workspace => {
        const packageJson = JSON.parse(
          readFileSync(resolve(projectRoot, workspace, 'package.json'), 'utf-8')
        );
        
        expect(packageJson.scripts).toHaveProperty('test');
        expect(packageJson.scripts).toHaveProperty('test:watch');
        expect(packageJson.scripts).toHaveProperty('test:coverage');
      });
    });
  });
});