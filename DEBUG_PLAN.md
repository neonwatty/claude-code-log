# Debugging Plan - Claude Code Log Application

## Overview

Based on Playwright testing, we've identified **5 critical bugs** that need systematic debugging. The most severe issue is **message duplication** in session views, followed by **navigation failures**.

## Priority 1: Message Duplication Bug 🚨

### Investigation Strategy

1. **Examine Session Detail Component**
   ```bash
   # Look at the session detail rendering logic
   js/frontend/src/components/session-detail/session-detail.ts
   ```

2. **Check Message Rendering**
   ```bash
   # Check if message-card component is being rendered multiple times
   js/frontend/src/components/message-card/message-card.ts
   ```

3. **Investigate Data Flow**
   - Check if messages are being fetched multiple times
   - Look for duplicate event listeners
   - Examine WebSocket message handling

### Likely Root Causes
- **Event Listener Duplication**: Multiple event listeners adding same messages
- **Component Re-rendering**: Session detail component mounting multiple times
- **Data Processing**: Messages being processed and added to DOM twice
- **WebSocket Handling**: Duplicate WebSocket connections sending same data

### Debugging Steps
1. Add `console.log` statements to track message rendering
2. Check component lifecycle methods (`connectedCallback`, `disconnectedCallback`)
3. Examine WebSocket event handlers for duplicate subscriptions
4. Look for DOM manipulation that might create duplicates

## Priority 2: Session Navigation Failure 🔴

### Investigation Strategy

1. **Examine Click Handlers**
   ```bash
   # Check session list click handling
   js/frontend/src/components/session-list/
   js/frontend/src/components/session-card/
   ```

2. **Router Investigation**
   - Check if routing is properly configured
   - Look for navigation event handlers
   - Examine URL generation and handling

### Likely Root Causes
- **Missing Click Handlers**: Session cards not properly configured for clicks
- **Router Issues**: Navigation logic not working
- **Event Bubbling**: Click events being prevented or not reaching handlers
- **CSS Issues**: Overlay elements blocking clicks

### Debugging Steps
1. Add click event listeners to session cards manually
2. Check CSS `pointer-events` and `z-index` issues
3. Examine router configuration
4. Test direct URL navigation

## Priority 3: Form Control Issues 🟡

### Investigation Strategy

1. **Examine Filter Controls**
   ```bash
   # Check filter bar and dropdown implementation
   js/frontend/src/components/filter-bar/filter-bar.ts
   ```

2. **Option Generation**
   - Check if dropdown options are being generated correctly
   - Look for timing issues in DOM rendering

### Likely Root Causes
- **Async Rendering**: Options not loaded when select is interacted with
- **Event Handler Issues**: Select change events not properly bound
- **DOM Structure**: Dropdown structure not matching expected selectors

## General Debugging Methodology

### Phase 1: Code Review (30 minutes)
1. **Review WebSocket Service**
   ```bash
   js/frontend/src/services/websocket-service.ts
   ```
   - Check for duplicate connection management
   - Look for event listener cleanup issues

2. **Review Base Component**
   ```bash
   js/frontend/src/components/base/base-component.ts
   ```
   - Check for lifecycle management issues
   - Look for event handler duplication

3. **Review Session Components**
   - Session list, session detail, message card components
   - Look for DOM manipulation patterns

### Phase 2: Live Debugging (45 minutes)
1. **Add Debug Logging**
   ```javascript
   // Add to suspected components
   console.log('Component mounting:', this.constructor.name);
   console.log('Messages received:', messages.length);
   console.log('Event handlers attached:', this.eventListeners?.length);
   ```

2. **Browser DevTools Investigation**
   - Open Chrome DevTools
   - Monitor Network tab for duplicate requests
   - Check Elements tab for duplicate DOM nodes
   - Use Console to test interactions manually

3. **WebSocket Debugging**
   ```javascript
   // Add to WebSocket service
   ws.addEventListener('message', (event) => {
     console.log('WS Message received:', event.data);
   });
   ```

### Phase 3: Fix Implementation (60-90 minutes)

#### For Message Duplication:
1. **Component Deduplication**
   - Ensure components only mount once
   - Add cleanup in `disconnectedCallback`
   - Use `Set` or `Map` to track rendered messages

2. **Event Listener Management**
   ```javascript
   // Proper cleanup pattern
   disconnectedCallback() {
     this.cleanupEventListeners();
   }
   ```

3. **Data Deduplication**
   ```javascript
   // Add unique message tracking
   const renderedMessages = new Set();
   messages.filter(msg => !renderedMessages.has(msg.id));
   ```

#### For Navigation Issues:
1. **Click Handler Restoration**
   ```javascript
   // Ensure click handlers are properly attached
   sessionCards.forEach(card => {
     card.addEventListener('click', this.handleSessionClick);
   });
   ```

2. **Router Debugging**
   - Check route definitions
   - Test programmatic navigation
   - Verify URL parameter handling

### Testing Strategy
1. **Manual Testing After Each Fix**
   - Test message duplication resolution
   - Verify navigation works
   - Check form controls

2. **Playwright Regression Testing**
   ```bash
   # Rerun our test scripts after fixes
   node test-session-details.js
   node test-other-features.js
   ```

3. **Cross-Browser Testing**
   - Test in Chrome, Firefox, Safari
   - Check mobile responsiveness

## Expected Timeline

- **Phase 1 (Code Review)**: 30 minutes
- **Phase 2 (Live Debugging)**: 45 minutes  
- **Phase 3 (Fix Implementation)**: 60-90 minutes
- **Testing & Validation**: 30 minutes

**Total Estimated Time**: 2.5 - 3.5 hours

## Success Criteria

✅ Messages appear exactly once in session detail view  
✅ Session cards are clickable and navigate correctly  
✅ Sort dropdown works properly  
✅ No duplicate content in DOM  
✅ WebSocket connections are properly managed  
✅ All Playwright tests pass without errors

## Files to Focus On

**High Priority**:
- `js/frontend/src/components/session-detail/session-detail.ts`
- `js/frontend/src/components/message-card/message-card.ts`
- `js/frontend/src/components/session-list/session-list.ts`
- `js/frontend/src/services/websocket-service.ts`

**Medium Priority**:
- `js/frontend/src/components/filter-bar/filter-bar.ts`
- `js/frontend/src/components/base/base-component.ts`
- `js/frontend/src/app.ts`

This systematic approach should resolve the identified bugs and restore full functionality to the application.