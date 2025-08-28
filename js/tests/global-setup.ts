import { chromium, FullConfig } from '@playwright/test';
import fs from 'fs/promises';
import path from 'path';

/**
 * Global Setup for Playwright Tests
 * 
 * Runs once before all tests to:
 * - Create test data fixtures
 * - Verify server accessibility
 * - Set up authentication states if needed
 */
async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting Claude Code Log E2E Test Setup...');
  
  // Ensure test directories exist
  const testDataDir = path.join(__dirname, 'fixtures');
  await fs.mkdir(testDataDir, { recursive: true });
  
  // Create test JSONL fixtures
  await createTestFixtures(testDataDir);
  
  // Wait for servers to be ready
  await waitForServers();
  
  console.log('✅ Global setup completed successfully');
}

/**
 * Create test JSONL fixture files for testing
 */
async function createTestFixtures(fixturesDir: string) {
  console.log('📁 Creating test fixtures...');
  
  // Sample session entries for testing
  const testSessionId = '550e8400-e29b-41d4-a716-446655440000';
  const testEntries = [
    {
      sessionId: testSessionId,
      timestamp: new Date().toISOString(),
      type: 'user',
      cwd: '/Users/test/claude-code-log',
      message: {
        role: 'user',
        content: [{ type: 'text', text: 'Help me create a test for this application' }]
      }
    },
    {
      sessionId: testSessionId,
      timestamp: new Date(Date.now() + 1000).toISOString(),
      type: 'assistant', 
      cwd: '/Users/test/claude-code-log',
      message: {
        role: 'assistant',
        content: [{ type: 'text', text: "I'll help you create comprehensive tests for your application. Let me start by analyzing the codebase structure." }],
        usage: {
          input_tokens: 1250,
          output_tokens: 450,
          cache_read_input_tokens: 0,
          cache_creation_input_tokens: 0
        }
      }
    },
    {
      sessionId: testSessionId,
      timestamp: new Date(Date.now() + 2000).toISOString(),
      type: 'user',
      cwd: '/Users/test/claude-code-log',
      message: {
        role: 'user', 
        content: [{ type: 'text', text: 'What testing strategies do you recommend?' }]
      }
    },
    {
      sessionId: testSessionId,
      timestamp: new Date(Date.now() + 3000).toISOString(),
      type: 'assistant',
      cwd: '/Users/test/claude-code-log',
      message: {
        role: 'assistant',
        content: [{ type: 'text', text: 'For your application, I recommend a multi-layered testing approach:\n\n1. **Unit Tests** - Test individual components and functions\n2. **Integration Tests** - Test API endpoints and service interactions\n3. **E2E Tests** - Test complete user workflows\n4. **Performance Tests** - Test under load conditions' }],
        usage: {
          input_tokens: 850,
          output_tokens: 320,
          cache_read_input_tokens: 500,
          cache_creation_input_tokens: 0
        }
      }
    }
  ];
  
  // Create test JSONL file
  const testJsonlPath = path.join(fixturesDir, 'test-session.jsonl');
  const jsonlContent = testEntries.map(entry => JSON.stringify(entry)).join('\n');
  await fs.writeFile(testJsonlPath, jsonlContent, 'utf-8');
  
  // Create multiple session test file
  const multiSessionId1 = '550e8400-e29b-41d4-a716-446655440001';
  const multiSessionId2 = '550e8400-e29b-41d4-a716-446655440002';
  
  const multiSessionEntries = [
    {
      sessionId: multiSessionId1,
      timestamp: new Date(Date.now() - 86400000).toISOString(), // Yesterday
      type: 'user',
      cwd: '/Users/test/project1',
      message: { role: 'user', content: [{ type: 'text', text: 'Session 1 message' }] }
    },
    {
      sessionId: multiSessionId2, 
      timestamp: new Date().toISOString(),
      type: 'user',
      cwd: '/Users/test/project2', 
      message: { role: 'user', content: [{ type: 'text', text: 'Session 2 message' }] }
    }
  ];
  
  const multiSessionPath = path.join(fixturesDir, 'multi-session.jsonl');
  const multiSessionContent = multiSessionEntries.map(entry => JSON.stringify(entry)).join('\n');
  await fs.writeFile(multiSessionPath, multiSessionContent, 'utf-8');
  
  console.log('✅ Test fixtures created successfully');
}

/**
 * Wait for both frontend and backend servers to be accessible
 */
async function waitForServers() {
  console.log('🔌 Waiting for servers to be ready...');
  
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Wait for backend server
  let backendReady = false;
  let attempts = 0;
  while (!backendReady && attempts < 30) {
    try {
      const response = await page.goto('http://localhost:3002/api', { timeout: 5000 });
      if (response && response.status() === 200) {
        backendReady = true;
        console.log('✅ Backend server ready');
      }
    } catch (error) {
      attempts++;
      await page.waitForTimeout(1000);
    }
  }
  
  // Wait for frontend server
  let frontendReady = false;
  attempts = 0;
  while (!frontendReady && attempts < 30) {
    try {
      const response = await page.goto('http://localhost:5173', { timeout: 5000 });
      if (response && response.status() === 200) {
        frontendReady = true;
        console.log('✅ Frontend server ready');
      }
    } catch (error) {
      attempts++;
      await page.waitForTimeout(1000);
    }
  }
  
  await browser.close();
  
  if (!backendReady || !frontendReady) {
    throw new Error('Servers failed to start within timeout period');
  }
}

export default globalSetup;