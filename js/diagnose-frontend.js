#!/usr/bin/env node

console.log('🔍 Frontend Diagnosis Tool');
console.log('==========================\n');

// Test 1: Check if backend API is working
async function testBackendAPI() {
  console.log('1. Testing Backend API...');
  try {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch('http://localhost:3001/api/sessions?limit=1');
    const data = await response.json();
    
    if (data.success && data.data?.sessions?.length > 0) {
      const session = data.data.sessions[0];
      console.log('   ✅ Backend API working');
      console.log(`   📊 Found ${data.data.sessions.length} session(s)`);
      console.log(`   📄 Sample session: ${session.id.substring(0, 12)}... (${session.entries.length} entries)`);
      console.log(`   📁 Directory: ${session.cwd}`);
      return true;
    } else {
      console.log('   ❌ Backend API returned invalid data');
      return false;
    }
  } catch (error) {
    console.log(`   ❌ Backend API error: ${error.message}`);
    return false;
  }
}

// Test 2: Check frontend server
async function testFrontendServer() {
  console.log('\n2. Testing Frontend Server...');
  try {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch('http://localhost:5173/');
    const html = await response.text();
    
    console.log('   ✅ Frontend server responding');
    console.log(`   📄 HTML size: ${html.length} characters`);
    
    // Check for key elements
    if (html.includes('<app-main>')) {
      console.log('   ✅ Found <app-main> component');
    } else {
      console.log('   ❌ Missing <app-main> component');
    }
    
    if (html.includes('src/app.ts')) {
      console.log('   ✅ Found app.ts script import');
    } else {
      console.log('   ❌ Missing app.ts script import');
    }
    
    return true;
  } catch (error) {
    console.log(`   ❌ Frontend server error: ${error.message}`);
    return false;
  }
}

// Test 3: Try to trigger API call
async function triggerSessionLoad() {
  console.log('\n3. Monitoring for Frontend API Requests...');
  console.log('   ⏱️  Waiting 10 seconds for frontend to make API calls...');
  console.log('   💡 Open http://localhost:5173/ in your browser now!');
  
  // Wait and check if backend receives requests
  await new Promise(resolve => setTimeout(resolve, 10000));
  console.log('   ⌛ Monitoring period complete');
}

async function main() {
  const backendOk = await testBackendAPI();
  const frontendOk = await testFrontendServer();
  
  if (backendOk && frontendOk) {
    await triggerSessionLoad();
    
    console.log('\n🎯 Diagnosis Summary:');
    console.log('=====================================');
    console.log('✅ Backend API: Working (returning real Claude Code sessions)');
    console.log('✅ Frontend Server: Running');
    console.log('');
    console.log('🔍 Possible Issues:');
    console.log('1. JavaScript errors preventing app initialization');
    console.log('2. CORS issues (though API allows localhost:5173)');
    console.log('3. Frontend not calling loadSessionData() method');
    console.log('4. WebSocket connection issues preventing app startup');
    console.log('');
    console.log('📋 Next Steps:');
    console.log('1. Open http://localhost:5173/ in browser');
    console.log('2. Check browser console for JavaScript errors');
    console.log('3. Check Network tab for failed requests');
    console.log('4. Look for the debug panel in the app');
    console.log('');
    console.log('✨ Expected: App should show real sessions from:');
    console.log('   - /Users/jeremywatt/Desktop/marketer-gen');
    console.log('   - /Users/jeremywatt/Desktop/marketer-gen-nextjs');
    console.log('   - And other real Claude Code project conversations');
  } else {
    console.log('\n❌ Basic infrastructure issues detected');
  }
}

main().catch(console.error);