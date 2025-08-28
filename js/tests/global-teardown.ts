import fs from 'fs/promises';
import path from 'path';

/**
 * Global Teardown for Playwright Tests
 * 
 * Runs once after all tests to:
 * - Clean up test fixtures (optional)
 * - Archive test results
 * - Clean up temporary files
 */
async function globalTeardown() {
  console.log('🧹 Starting Claude Code Log E2E Test Teardown...');
  
  // Optionally clean up test fixtures
  if (process.env.CLEAN_FIXTURES === 'true') {
    const fixturesDir = path.join(__dirname, 'fixtures');
    try {
      await fs.rmdir(fixturesDir, { recursive: true });
      console.log('🗑️  Test fixtures cleaned up');
    } catch (error) {
      console.log('ℹ️  No fixtures to clean up');
    }
  }
  
  // Archive test results with timestamp
  const resultsDir = path.join(process.cwd(), 'test-results');
  const archiveDir = path.join(process.cwd(), 'test-archive');
  
  try {
    await fs.mkdir(archiveDir, { recursive: true });
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const archivePath = path.join(archiveDir, `test-run-${timestamp}`);
    
    // Copy results to archive (if they exist)
    try {
      await fs.rename(resultsDir, archivePath);
      console.log(`📦 Test results archived to: ${archivePath}`);
    } catch (error) {
      console.log('ℹ️  No test results to archive');
    }
  } catch (error) {
    console.log('⚠️  Could not archive test results:', error);
  }
  
  console.log('✅ Global teardown completed');
}

export default globalTeardown;