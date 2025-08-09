#!/usr/bin/env node

/**
 * Test script for file system monitoring functionality
 * Tests file creation, modification, and deletion scenarios
 */

const { writeFileSync, unlinkSync, appendFileSync, mkdirSync, existsSync } = require('fs');
const { join } = require('path');
const WebSocket = require('ws');

// Test configuration
const TEST_DIR = join(__dirname, 'test-monitoring');
const TEST_FILES = [
  'session-1.jsonl',
  'session-2.jsonl',
  'test-file.jsonl'
];

const WS_URL = 'ws://localhost:3000';

// Ensure test directory exists
if (!existsSync(TEST_DIR)) {
  mkdirSync(TEST_DIR, { recursive: true });
}

// Sample JSONL content for testing
const sampleJsonlContent = [
  '{"type":"message","role":"user","content":"Hello, world!","timestamp":"2024-01-01T00:00:00Z"}',
  '{"type":"message","role":"assistant","content":"Hi there!","timestamp":"2024-01-01T00:00:01Z"}',
  '{"type":"tool_use","name":"read_file","parameters":{"path":"test.txt"},"timestamp":"2024-01-01T00:00:02Z"}'
].join('\n');

// WebSocket client for monitoring events
class FileMonitorTestClient {
  constructor() {
    this.ws = null;
    this.events = [];
    this.connected = false;
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(WS_URL);
      
      this.ws.on('open', () => {
        console.log('✅ Connected to WebSocket server');
        this.connected = true;
        
        // Authenticate (minimal test auth)
        this.ws.send(JSON.stringify({
          type: 'authenticate',
          data: { userId: 'test-user', sessionId: 'test-session' }
        }));
        
        resolve();
      });

      this.ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.events.push(message);
          console.log('📨 WebSocket event received:', JSON.stringify(message, null, 2));
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      });

      this.ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        reject(error);
      });

      this.ws.on('close', () => {
        console.log('🔌 WebSocket connection closed');
        this.connected = false;
      });

      // Timeout for connection
      setTimeout(() => {
        if (!this.connected) {
          reject(new Error('WebSocket connection timeout'));
        }
      }, 5000);
    });
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
    }
  }

  getEvents() {
    return this.events;
  }

  clearEvents() {
    this.events = [];
  }
}

// Test scenarios
class FileMonitoringTests {
  constructor(client) {
    this.client = client;
    this.testResults = [];
  }

  async runAllTests() {
    console.log('🚀 Starting file monitoring tests...\n');

    try {
      await this.testFileCreation();
      await this.wait(1000);
      
      await this.testFileModification();
      await this.wait(1000);
      
      await this.testMultipleFileOperations();
      await this.wait(1000);
      
      await this.testFileDeletion();
      
      this.printResults();
    } catch (error) {
      console.error('❌ Test suite failed:', error);
    }
  }

  async testFileCreation() {
    console.log('📝 Test 1: File Creation');
    
    this.client.clearEvents();
    const testFile = join(TEST_DIR, TEST_FILES[0]);
    
    // Create a new JSONL file
    writeFileSync(testFile, sampleJsonlContent);
    console.log(`   Created file: ${testFile}`);
    
    // Wait for file system events
    await this.wait(500);
    
    const events = this.client.getEvents();
    const fileEvents = events.filter(e => e.type === 'file-system-event');
    
    if (fileEvents.length > 0) {
      console.log('   ✅ File creation event detected');
      this.testResults.push({ test: 'File Creation', passed: true });
    } else {
      console.log('   ❌ No file creation event detected');
      this.testResults.push({ test: 'File Creation', passed: false });
    }
    
    console.log();
  }

  async testFileModification() {
    console.log('📝 Test 2: File Modification');
    
    this.client.clearEvents();
    const testFile = join(TEST_DIR, TEST_FILES[0]);
    
    // Modify the existing file
    const additionalContent = '\n{"type":"message","role":"user","content":"Modified content","timestamp":"2024-01-01T00:00:03Z"}';
    appendFileSync(testFile, additionalContent);
    console.log(`   Modified file: ${testFile}`);
    
    // Wait for file system events
    await this.wait(500);
    
    const events = this.client.getEvents();
    const fileEvents = events.filter(e => e.type === 'file-system-event');
    
    if (fileEvents.length > 0) {
      console.log('   ✅ File modification event detected');
      this.testResults.push({ test: 'File Modification', passed: true });
    } else {
      console.log('   ❌ No file modification event detected');
      this.testResults.push({ test: 'File Modification', passed: false });
    }
    
    console.log();
  }

  async testMultipleFileOperations() {
    console.log('📝 Test 3: Multiple File Operations');
    
    this.client.clearEvents();
    
    // Create multiple files simultaneously
    TEST_FILES.slice(1).forEach((filename, index) => {
      const testFile = join(TEST_DIR, filename);
      const content = sampleJsonlContent + `\n{"index": ${index}}`;
      writeFileSync(testFile, content);
      console.log(`   Created file: ${testFile}`);
    });
    
    // Wait for file system events
    await this.wait(800);
    
    const events = this.client.getEvents();
    const fileEvents = events.filter(e => e.type === 'file-system-event');
    
    if (fileEvents.length >= 2) {
      console.log(`   ✅ Multiple file events detected (${fileEvents.length})`);
      this.testResults.push({ test: 'Multiple File Operations', passed: true });
    } else {
      console.log(`   ❌ Expected multiple events, got ${fileEvents.length}`);
      this.testResults.push({ test: 'Multiple File Operations', passed: false });
    }
    
    console.log();
  }

  async testFileDeletion() {
    console.log('📝 Test 4: File Deletion');
    
    this.client.clearEvents();
    const testFile = join(TEST_DIR, TEST_FILES[0]);
    
    // Delete the file
    try {
      unlinkSync(testFile);
      console.log(`   Deleted file: ${testFile}`);
    } catch (error) {
      console.log(`   Error deleting file: ${error.message}`);
    }
    
    // Wait for file system events
    await this.wait(500);
    
    const events = this.client.getEvents();
    const fileEvents = events.filter(e => e.type === 'file-system-event');
    
    if (fileEvents.length > 0) {
      console.log('   ✅ File deletion event detected');
      this.testResults.push({ test: 'File Deletion', passed: true });
    } else {
      console.log('   ❌ No file deletion event detected');
      this.testResults.push({ test: 'File Deletion', passed: false });
    }
    
    console.log();
  }

  async wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  printResults() {
    console.log('📊 Test Results Summary:');
    console.log('========================');
    
    let passed = 0;
    let total = this.testResults.length;
    
    this.testResults.forEach(result => {
      const status = result.passed ? '✅ PASS' : '❌ FAIL';
      console.log(`${status}: ${result.test}`);
      if (result.passed) passed++;
    });
    
    console.log('========================');
    console.log(`Overall: ${passed}/${total} tests passed`);
    
    if (passed === total) {
      console.log('🎉 All tests passed!');
    } else {
      console.log('⚠️  Some tests failed. Check the file monitoring configuration.');
    }
  }

  cleanup() {
    console.log('🧹 Cleaning up test files...');
    TEST_FILES.forEach(filename => {
      const testFile = join(TEST_DIR, filename);
      try {
        unlinkSync(testFile);
      } catch (error) {
        // File might already be deleted or not exist
      }
    });
  }
}

// Main test execution
async function main() {
  const client = new FileMonitorTestClient();
  const tests = new FileMonitoringTests(client);

  try {
    console.log('📋 File System Monitoring Test Suite');
    console.log('====================================\n');
    
    console.log(`📂 Test directory: ${TEST_DIR}`);
    console.log(`🔗 WebSocket URL: ${WS_URL}\n`);

    // Connect to WebSocket server
    await client.connect();
    
    // Wait a moment for authentication
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Run tests
    await tests.runAllTests();
    
  } catch (error) {
    console.error('❌ Test execution failed:', error);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 Make sure the backend server is running on port 3000');
      console.log('💡 Enable file monitoring with environment variables:');
      console.log('   FILE_MONITORING_ENABLED=true');
      console.log(`   FILE_MONITORING_PATHS=${TEST_DIR}`);
    }
    
  } finally {
    // Cleanup
    tests.cleanup();
    client.disconnect();
  }
}

// Handle cleanup on exit
process.on('SIGINT', () => {
  console.log('\n🛑 Test interrupted, cleaning up...');
  const tests = new FileMonitoringTests(null);
  tests.cleanup();
  process.exit(0);
});

// Run the tests
main().catch(console.error);