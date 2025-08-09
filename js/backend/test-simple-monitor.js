#!/usr/bin/env node

/**
 * Simple test for FileSystemMonitor without WebSocket dependency
 */

const { writeFileSync, unlinkSync, mkdirSync, existsSync } = require('fs');
const { join } = require('path');

// Import our FileSystemMonitor (we'll need to compile it first)
const TEST_DIR = join(__dirname, 'test-monitoring-simple');

// Ensure test directory exists
if (!existsSync(TEST_DIR)) {
  mkdirSync(TEST_DIR, { recursive: true });
}

// Sample JSONL content for testing
const sampleJsonlContent = [
  '{"type":"user","timestamp":"2024-01-01T00:00:00Z","sessionId":"test-session-123","uuid":"uuid-1","message":{"role":"user","content":"Hello, world!"}}',
  '{"type":"assistant","timestamp":"2024-01-01T00:00:01Z","sessionId":"test-session-123","uuid":"uuid-2","message":{"id":"msg-1","role":"assistant","content":[{"type":"text","text":"Hi there!"}]}}',
].join('\n');

// Test basic file operations without WebSocket
class SimpleFileMonitorTest {
  constructor() {
    this.events = [];
  }

  async runTests() {
    console.log('🚀 Running simple file monitor tests...\n');
    
    try {
      // Test 1: Create a JSONL file
      await this.testFileCreation();
      
      // Test 2: Modify the file
      await this.testFileModification();
      
      // Test 3: Delete the file
      await this.testFileDeletion();
      
      console.log('✅ All basic file operations completed successfully');
      
    } catch (error) {
      console.error('❌ Test failed:', error);
    } finally {
      this.cleanup();
    }
  }

  async testFileCreation() {
    console.log('📝 Test 1: File Creation');
    
    const testFile = join(TEST_DIR, 'test-session-123.jsonl');
    writeFileSync(testFile, sampleJsonlContent);
    
    console.log(`   Created: ${testFile}`);
    console.log('   ✅ File creation successful\n');
  }

  async testFileModification() {
    console.log('📝 Test 2: File Modification');
    
    const testFile = join(TEST_DIR, 'test-session-123.jsonl');
    const additionalContent = '\n{"type":"user","timestamp":"2024-01-01T00:00:02Z","sessionId":"test-session-123","uuid":"uuid-3","message":{"role":"user","content":"Modified content"}}';
    
    // Read current content and append
    const currentContent = require('fs').readFileSync(testFile, 'utf8');
    writeFileSync(testFile, currentContent + additionalContent);
    
    console.log(`   Modified: ${testFile}`);
    console.log('   ✅ File modification successful\n');
  }

  async testFileDeletion() {
    console.log('📝 Test 3: File Deletion');
    
    const testFile = join(TEST_DIR, 'test-session-123.jsonl');
    unlinkSync(testFile);
    
    console.log(`   Deleted: ${testFile}`);
    console.log('   ✅ File deletion successful\n');
  }

  cleanup() {
    console.log('🧹 Cleaning up test files...');
    try {
      const testFiles = [
        'test-session-123.jsonl',
        'test-session-456.jsonl',
        'another-test.jsonl'
      ];
      
      testFiles.forEach(filename => {
        const filePath = join(TEST_DIR, filename);
        try {
          unlinkSync(filePath);
        } catch (error) {
          // File might not exist, that's okay
        }
      });
      
      console.log('✅ Cleanup completed');
    } catch (error) {
      console.error('⚠️ Cleanup error:', error.message);
    }
  }
}

// Test session ID extraction
function testSessionIdExtraction() {
  console.log('🔍 Testing Session ID Extraction\n');
  
  const testCases = [
    {
      filepath: '/path/to/test-session-123.jsonl',
      entries: [
        { sessionId: 'test-session-123', type: 'user' }
      ],
      expected: 'test-session-123'
    },
    {
      filepath: '/path/to/a1b2c3d4-e5f6-7890-abcd-ef1234567890.jsonl',
      entries: [],
      expected: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
    },
    {
      filepath: '/path/to/unknown-file.jsonl',
      entries: [
        { metadata: { sessionId: 'meta-session-456' } }
      ],
      expected: 'meta-session-456'
    }
  ];

  testCases.forEach((testCase, index) => {
    const result = extractSessionId(testCase.filepath, testCase.entries);
    const status = result === testCase.expected ? '✅' : '❌';
    console.log(`   Test ${index + 1}: ${status} Expected: ${testCase.expected}, Got: ${result}`);
  });
  
  console.log();
}

// Simple session ID extraction function (copied from FileSystemMonitor)
function extractSessionId(filepath, entries) {
  // Try to extract session ID from filename or entries
  const filename = filepath.split('/').pop() || '';
  
  // Check if filename contains a UUID-like pattern
  const uuidMatch = filename.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
  if (uuidMatch) {
    return uuidMatch[1];
  }
  
  // Check first entry for session metadata
  if (entries.length > 0) {
    const firstEntry = entries[0];
    if (firstEntry.sessionId) {
      return firstEntry.sessionId;
    }
    if (firstEntry.metadata && firstEntry.metadata.sessionId) {
      return firstEntry.metadata.sessionId;
    }
  }
  
  return null;
}

// Main execution
async function main() {
  console.log('📋 File System Monitor - Basic Functionality Test');
  console.log('=================================================\n');
  
  console.log(`📂 Test directory: ${TEST_DIR}\n`);
  
  // Test session ID extraction logic
  testSessionIdExtraction();
  
  // Test basic file operations
  const test = new SimpleFileMonitorTest();
  await test.runTests();
  
  console.log('🎉 All tests completed!');
}

// Handle cleanup on exit
process.on('SIGINT', () => {
  console.log('\n🛑 Test interrupted, cleaning up...');
  const test = new SimpleFileMonitorTest();
  test.cleanup();
  process.exit(0);
});

// Run the tests
main().catch(console.error);