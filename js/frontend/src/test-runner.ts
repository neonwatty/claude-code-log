/**
 * Test runner for base component architecture
 */
import { runTests as runBaseTests } from './components/base/__tests__/simple-base-test';
import { runUtilsTests } from './components/utils/__tests__/simple-utils-test';
import { runTypesTests } from './components/types/__tests__/simple-types-test';

async function runAllTests() {
  console.log('🧪 Running Base Component Architecture Tests\n');
  console.log('=' .repeat(60));
  
  let allPassed = true;
  
  try {
    // Run base component tests
    console.log('\n📦 BaseComponent Tests');
    console.log('-'.repeat(30));
    const baseTestsResult = await runBaseTests();
    allPassed = allPassed && baseTestsResult;
    
    // Run utility function tests
    console.log('\n🔧 Session Utils Tests');
    console.log('-'.repeat(30));
    const utilsTestsResult = await runUtilsTests();
    allPassed = allPassed && utilsTestsResult;
    
    // Run type interface tests
    console.log('\n📝 TypeScript Interface Tests');
    console.log('-'.repeat(30));
    const typesTestsResult = await runTypesTests();
    allPassed = allPassed && typesTestsResult;
    
  } catch (error) {
    console.error('\n❌ Test runner error:', error);
    allPassed = false;
  }
  
  console.log('\n' + '='.repeat(60));
  
  if (allPassed) {
    console.log('✅ All base component architecture tests passed!');
    console.log('\n🎉 Subtask 7.1 (Base Component Architecture) is ready!');
  } else {
    console.log('❌ Some tests failed. Please review the output above.');
  }
  
  return allPassed;
}

// Auto-run if this is the main module
if (typeof require !== 'undefined' && require.main === module) {
  runAllTests();
}

export { runAllTests };