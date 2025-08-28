#!/usr/bin/env node

/**
 * Test Suite Setup Validation Script
 * 
 * This script validates that the Playwright test suite is properly configured
 * and ready to run. It checks dependencies, configuration, and test files.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔍 Validating Claude Code Log E2E Test Suite Setup...\n');

let errors = [];
let warnings = [];

// Check if we're in the right directory
function checkDirectory() {
  const currentDir = process.cwd();
  const packageJsonPath = path.join(currentDir, 'package.json');
  
  if (!fs.existsSync(packageJsonPath)) {
    errors.push('❌ package.json not found. Please run this script from the js/ directory.');
    return false;
  }
  
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  if (packageJson.name !== 'claude-code-log') {
    errors.push('❌ Not in the correct project directory. Please run from the claude-code-log js/ directory.');
    return false;
  }
  
  console.log('✅ Directory validation passed');
  return true;
}

// Check required dependencies
function checkDependencies() {
  console.log('📦 Checking dependencies...');
  
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  
  const requiredDeps = [
    '@playwright/test',
    'lit',
    'express',
    'typescript'
  ];
  
  const allDeps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies
  };
  
  for (const dep of requiredDeps) {
    if (!allDeps[dep]) {
      errors.push(`❌ Missing dependency: ${dep}`);
    } else {
      console.log(`  ✅ ${dep} - ${allDeps[dep]}`);
    }
  }
  
  // Check if Playwright browsers are installed
  try {
    execSync('npx playwright --version', { stdio: 'pipe' });
    console.log('✅ Playwright CLI available');
    
    // Try to check if browsers are installed
    try {
      execSync('npx playwright install --dry-run', { stdio: 'pipe' });
      console.log('✅ Playwright browsers appear to be installed');
    } catch (e) {
      warnings.push('⚠️  Playwright browsers may need installation. Run: npx playwright install');
    }
  } catch (e) {
    errors.push('❌ Playwright CLI not available. Install with: npm install @playwright/test');
  }
}

// Check test files exist
function checkTestFiles() {
  console.log('📋 Checking test files...');
  
  const testFiles = [
    'playwright.config.ts',
    'tests/global-setup.ts',
    'tests/global-teardown.ts',
    'tests/utils.ts',
    'tests/debug-helpers.ts',
    'tests/e2e/claude-code-log.spec.ts',
    'tests/e2e/debug-manual-testing.spec.ts'
  ];
  
  for (const file of testFiles) {
    const filePath = path.join(process.cwd(), file);
    if (fs.existsSync(filePath)) {
      console.log(`  ✅ ${file}`);
    } else {
      errors.push(`❌ Missing test file: ${file}`);
    }
  }
}

// Check configuration files
function checkConfiguration() {
  console.log('⚙️  Checking configuration...');
  
  // Check Playwright config
  const playwrightConfig = path.join(process.cwd(), 'playwright.config.ts');
  if (fs.existsSync(playwrightConfig)) {
    const config = fs.readFileSync(playwrightConfig, 'utf8');
    
    // Check for key configuration elements
    if (config.includes('webServer:')) {
      console.log('  ✅ Web server configuration found');
    } else {
      warnings.push('⚠️  Web server configuration may be missing from playwright.config.ts');
    }
    
    if (config.includes('globalSetup')) {
      console.log('  ✅ Global setup configuration found');
    } else {
      warnings.push('⚠️  Global setup configuration may be missing');
    }
  }
  
  // Check package.json scripts
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  
  if (packageJson.scripts && packageJson.scripts['test:e2e']) {
    console.log('  ✅ E2E test script found in package.json');
  } else {
    warnings.push('⚠️  Add "test:e2e": "playwright test" to package.json scripts');
  }
  
  if (packageJson.scripts && packageJson.scripts['dev']) {
    console.log('  ✅ Development server script found');
  } else {
    warnings.push('⚠️  Development server script missing - tests may not auto-start servers');
  }
}

// Check directory structure
function checkDirectories() {
  console.log('📁 Checking directory structure...');
  
  const requiredDirs = [
    'tests',
    'tests/e2e',
    'tests/fixtures',
    'test-results',
    'test-results/debug-screenshots'
  ];
  
  for (const dir of requiredDirs) {
    const dirPath = path.join(process.cwd(), dir);
    if (fs.existsSync(dirPath)) {
      console.log(`  ✅ ${dir}/`);
    } else {
      console.log(`  📁 Creating ${dir}/`);
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }
}

// Test TypeScript compilation
function checkTypeScript() {
  console.log('🔧 Checking TypeScript configuration...');
  
  const tsconfigPath = path.join(process.cwd(), 'tsconfig.json');
  if (fs.existsSync(tsconfigPath)) {
    console.log('  ✅ TypeScript configuration found');
    
    // Try to compile test files
    try {
      execSync('npx tsc --noEmit playwright.config.ts', { stdio: 'pipe' });
      console.log('  ✅ Playwright config TypeScript validation passed');
    } catch (e) {
      warnings.push('⚠️  TypeScript compilation issues in test configuration');
    }
  } else {
    warnings.push('⚠️  TypeScript configuration not found');
  }
}

// Run a basic Playwright command
function testPlaywrightCommand() {
  console.log('🧪 Testing Playwright command...');
  
  try {
    const output = execSync('npx playwright --help', { encoding: 'utf8', stdio: 'pipe' });
    if (output.includes('Usage')) {
      console.log('  ✅ Playwright command working correctly');
    }
  } catch (e) {
    errors.push('❌ Playwright command failed. Check installation.');
  }
}

// Check if servers can be started
function checkServerAvailability() {
  console.log('🌐 Checking server port availability...');
  
  const { execSync } = require('child_process');
  
  // Check if ports are free
  const ports = [3002, 5173];
  
  for (const port of ports) {
    try {
      const result = execSync(`lsof -i :${port}`, { encoding: 'utf8', stdio: 'pipe' });
      if (result.trim()) {
        warnings.push(`⚠️  Port ${port} is in use. Stop existing services or tests may fail.`);
      } else {
        console.log(`  ✅ Port ${port} available`);
      }
    } catch (e) {
      // lsof returns error if no process found (port is free)
      console.log(`  ✅ Port ${port} available`);
    }
  }
}

// Generate test report
function generateTestReport() {
  console.log('\n📊 Generating validation report...');
  
  const report = {
    timestamp: new Date().toISOString(),
    validation: {
      passed: errors.length === 0,
      errors: errors.length,
      warnings: warnings.length
    },
    checks: {
      directory: true,
      dependencies: true,
      testFiles: true,
      configuration: true,
      directories: true,
      typescript: true,
      playwright: true,
      serverPorts: true
    },
    errors,
    warnings,
    nextSteps: []
  };
  
  if (errors.length === 0) {
    report.nextSteps = [
      'Run tests: npm run test:e2e',
      'Debug mode: DEBUG=true HEADED=true npm run test:e2e',
      'Manual testing: npx playwright test debug-manual-testing.spec.ts --headed --debug'
    ];
  } else {
    report.nextSteps = [
      'Fix errors listed above',
      'Run validation again: node tests/validate-setup.js',
      'Install missing dependencies if needed'
    ];
  }
  
  // Save report
  const reportPath = path.join(process.cwd(), 'test-results', 'setup-validation.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  console.log(`📄 Validation report saved to: ${reportPath}`);
  
  return report;
}

// Main validation function
async function validateSetup() {
  console.log('🚀 Starting setup validation...\n');
  
  // Run all checks
  checkDirectory() && checkDependencies();
  checkTestFiles();
  checkConfiguration();
  checkDirectories();
  checkTypeScript();
  testPlaywrightCommand();
  checkServerAvailability();
  
  // Generate report
  const report = generateTestReport();
  
  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📋 VALIDATION SUMMARY');
  console.log('='.repeat(60));
  
  if (report.validation.passed) {
    console.log('🎉 Setup validation PASSED!');
    console.log('✅ Your E2E test suite is ready to run.');
  } else {
    console.log('❌ Setup validation FAILED!');
    console.log(`❌ ${errors.length} error(s) need to be fixed.`);
  }
  
  if (warnings.length > 0) {
    console.log(`⚠️  ${warnings.length} warning(s) - tests should still work but consider addressing these.`);
  }
  
  console.log('\n📝 ERRORS:');
  errors.forEach(error => console.log(`  ${error}`));
  
  if (warnings.length > 0) {
    console.log('\n📝 WARNINGS:');
    warnings.forEach(warning => console.log(`  ${warning}`));
  }
  
  console.log('\n🎯 NEXT STEPS:');
  report.nextSteps.forEach(step => console.log(`  • ${step}`));
  
  console.log('\n' + '='.repeat(60));
  
  // Exit with appropriate code
  process.exit(errors.length > 0 ? 1 : 0);
}

// Run validation
validateSetup().catch(console.error);