# Claude Code Log - E2E Testing Suite

This comprehensive Playwright testing suite validates all major features of the Claude Code Log application for manual validation and debugging.

## 🚀 Quick Start

### Prerequisites
```bash
# Install dependencies (if not already done)
npm install

# Ensure Playwright is installed
npx playwright install
```

### Running Tests

#### Basic Test Execution
```bash
# Run all E2E tests
npm run test:e2e

# Run specific test file
npx playwright test claude-code-log.spec.ts

# Run debug/manual testing suite
npx playwright test debug-manual-testing.spec.ts
```

#### Debug Mode (Recommended for Manual Validation)
```bash
# Run with browser visible and debug tools
npx playwright test --headed --debug

# Run with debugging environment variables
DEBUG=true HEADED=true npm run test:e2e

# Run specific debug test interactively
DEBUG=true HEADED=true npx playwright test debug-manual-testing.spec.ts
```

## 📋 Test Suites Overview

### 1. `claude-code-log.spec.ts` - Main Feature Validation
**Complete feature coverage for production validation:**

- **🏠 Application Dashboard**
  - Initial loading and state validation
  - Statistics display and accuracy
  - Connection status indicators
  - Theme switching functionality

- **🔌 WebSocket Connection Management**
  - Connection establishment
  - Reconnection handling
  - Connection statistics tracking
  - Toast notifications for connection events

- **🗄️ Backend API Integration**
  - Sessions API endpoints
  - Projects API functionality
  - Export API operations
  - Error handling and validation

- **🎯 User Interface Components**
  - Lit component rendering
  - Responsive design testing
  - Loading states and error handling
  - Component interaction testing

- **🔄 Full User Workflows**
  - Complete session viewing workflow
  - Data refresh operations
  - Offline/online transitions
  - End-to-end user scenarios

- **⚡ Performance & Reliability**
  - Load time measurements
  - Interaction responsiveness
  - State consistency validation
  - Rapid interaction handling

### 2. `debug-manual-testing.spec.ts` - Debug & Manual Validation
**Interactive debugging tools for manual validation:**

- **🎯 Interactive Application Validation**
  - Step-by-step visual validation with pause points
  - Manual inspection opportunities
  - Visual comparison screenshots

- **📊 Performance Analysis Session**
  - Load time analysis
  - Interaction performance measurement
  - Performance reporting

- **🌐 Network Activity Analysis**
  - Request/response monitoring
  - API call analysis
  - Network timing and failure detection

- **🧩 Component Deep Dive**
  - Lit component state inspection
  - Shadow DOM analysis
  - Component lifecycle validation

- **🎬 Progressive Visual Testing**
  - Step-by-step screenshot capture
  - Visual regression detection
  - UI state transition validation

- **🚨 Error Handling & Recovery Testing**
  - Error scenario simulation
  - Recovery mechanism validation
  - Offline/online handling

- **🎮 Interactive Debug Console Session**
  - Browser console debugging utilities
  - Real-time state inspection
  - Manual testing tools

## 🔧 Configuration

### Playwright Configuration (`playwright.config.ts`)
- **Automatic server management** - Starts both frontend (5173) and backend (3001) servers
- **Multiple browser testing** - Chrome, Firefox, Safari, Mobile
- **Debug-friendly settings** - Screenshots, videos, traces on failure
- **Timeout configurations** - Extended timeouts for manual debugging

### Test Data & Fixtures
- **Automatic test data creation** - Mock JSONL session files
- **Fixture management** - Automatic setup and cleanup
- **Realistic test scenarios** - Sample session data with proper structure

## 🐛 Debugging Features

### Visual Testing
```typescript
// Take debug screenshots
await utils.takeDebugScreenshot('custom-name');

// Visual comparison testing
await debug.takeVisualComparisonShot('test-state');

// Progressive screenshot capture
await debug.takeProgressiveScreenshots('workflow', steps, actionCallback);
```

### Performance Monitoring
```typescript
// Measure interaction performance
const duration = await debug.measureInteractionPerformance('action-name', async () => {
  // Your test action here
});

// Generate performance reports
const report = await debug.getPerformanceReport('test-name');
```

### Network Analysis
```typescript
// Analyze network activity
const analysis = await debug.analyzeNetworkActivity('test-name');

// Monitor API calls, response times, failures
console.log(`API calls: ${analysis.apiCalls}`);
console.log(`Avg response time: ${analysis.avgResponseTime}ms`);
```

### Component Inspection
```typescript
// Inspect Lit component state
const componentState = await debug.inspectLitComponent('app-main');

// Get all component states
const allStates = await debug.getAllComponentStates();
```

### Interactive Debugging
```typescript
// Enable browser console utilities
await debug.enableInteractiveMode();

// Pause for manual inspection
await debug.pauseForInspection('Check connection status manually');
```

## 📊 Test Reports & Output

### Automatic Report Generation
- **HTML Reports** - Visual test results with screenshots
- **JSON Reports** - Machine-readable test data
- **Performance Reports** - Timing and metrics analysis
- **Network Analysis** - Request/response analysis
- **Component State Reports** - Component inspection data

### Report Locations
```
test-results/
├── html-report/           # Playwright HTML reports
├── debug-screenshots/     # Debug screenshots
├── visual-comparisons/    # Visual testing screenshots
├── network-analysis/      # Network activity reports
├── performance/           # Performance metrics
├── component-states/      # Component state snapshots
└── comprehensive-reports/ # Combined analysis reports
```

## 💡 Manual Testing Workflow

### 1. Start Debug Session
```bash
DEBUG=true HEADED=true npx playwright test debug-manual-testing.spec.ts
```

### 2. Use Interactive Features
- **Pause Points** - Test will pause for manual inspection
- **Browser Console** - Use `window.manualDebug` utilities
- **DevTools** - Elements, Network, Console tabs for detailed inspection

### 3. Available Browser Console Commands
```javascript
// Get complete application state
window.manualDebug.getFullAppState()

// Test specific component
window.manualDebug.testComponent('app-main')

// Trigger events manually
window.manualDebug.triggerEvent('.connection-button', 'click')

// Inspect element styles
window.manualDebug.getComputedStyles('.app-title')
```

### 4. Review Generated Reports
- Check `test-results/` directory for comprehensive analysis
- Review screenshots for visual validation
- Analyze performance metrics for optimization opportunities

## 🎯 Manual Validation Checklist

### ✅ Application Loading
- [ ] App loads without errors
- [ ] Main title displays correctly
- [ ] Statistics grid shows expected data
- [ ] Connection status component renders

### ✅ Connection Management
- [ ] Connection status updates appropriately
- [ ] Connect/Disconnect buttons function
- [ ] Reconnection works correctly
- [ ] Connection statistics display properly

### ✅ API Integration
- [ ] Sessions API returns expected data
- [ ] Projects API functions correctly
- [ ] Export API handles requests properly
- [ ] Error responses handled gracefully

### ✅ User Interface
- [ ] Components render correctly
- [ ] Responsive design works on different screen sizes
- [ ] Loading states display appropriately
- [ ] Error states show helpful messages

### ✅ Performance
- [ ] Initial load completes within reasonable time
- [ ] Interactions respond quickly
- [ ] No memory leaks during extended use
- [ ] Network requests complete efficiently

## 🚨 Troubleshooting

### Common Issues

#### Servers Not Starting
```bash
# Check if ports are available
lsof -i :3001  # Backend
lsof -i :5173  # Frontend

# Kill existing processes if needed
kill -9 <PID>

# Restart servers manually
npm run dev:backend &
npm run dev:frontend &
```

#### Tests Failing
```bash
# Run with debug output
DEBUG=pw:api npx playwright test

# Check test results
npx playwright show-report

# Clean test cache
rm -rf test-results/
```

#### Component Not Found Errors
- Ensure app is fully loaded before interactions
- Check for timing issues with `await utils.waitForAppReady()`
- Verify component selectors match current DOM structure

### Debug Environment Variables
```bash
DEBUG=true          # Enable debug mode
HEADED=true         # Show browser during tests
CLEAN_FIXTURES=true # Clean up test fixtures after run
```

## 🤝 Contributing

When adding new features to the app, ensure corresponding tests are added:

1. **Add feature tests** to `claude-code-log.spec.ts`
2. **Add manual validation** to `debug-manual-testing.spec.ts`
3. **Update test utilities** in `utils.ts` if needed
4. **Add debug helpers** in `debug-helpers.ts` for complex features
5. **Update this README** with new testing instructions

## 📚 Additional Resources

- [Playwright Documentation](https://playwright.dev/)
- [Lit Testing Guide](https://lit.dev/docs/tools/testing/)
- [Express.js Testing](https://expressjs.com/en/guide/testing.html)
- [WebSocket Testing Strategies](https://playwright.dev/docs/network#websockets)