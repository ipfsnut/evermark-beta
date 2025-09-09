# Testing Anomalies Log

## Purpose
Track all anomalies, inconsistencies, and issues found during comprehensive testing to ensure beta completion.

---

## Critical Issues Found

### 1. Hook Test API Mismatch (RESOLVED)
**File**: `src/features/voting/hooks/useVotingState.test.tsx`
**Issue**: Tests expect `delegate()` and `undelegate()` but hook returns `delegateVotes()` and `undelegateVotes()`
**Impact**: 12+ test failures
**Root Cause**: Test-implementation mismatch, possibly from refactoring
**Status**: FIXED
**Cross-Platform Impact**: All platforms
**Fix Applied**: Updated tests to match actual hook API, fixed mock completeness and React Testing Library patterns

### 2. React Testing Library Migration Incomplete (MEDIUM PRIORITY) 
**Files**: 
- `src/features/voting/hooks/useVotingState.test.tsx`
- `src/features/leaderboard/hooks/useLeaderboardState.test.tsx`
**Issue**: Tests using deprecated `waitForNextUpdate()` instead of `waitFor()`
**Impact**: 20+ test failures
**Root Cause**: Upgrade to newer testing library version
**Status**: PARTIALLY FIXED
**Cross-Platform Impact**: All platforms
**Fix Applied**: Converting to `waitFor()` pattern

### 3. Mock Completeness Issues (MEDIUM PRIORITY)
**File**: `src/features/voting/hooks/useVotingState.test.tsx`
**Issue**: Staking data mock missing `isLoading` and `error` fields causing null reference errors
**Impact**: All voting hook tests fail with "Cannot read properties of null"
**Root Cause**: Incomplete mock setup
**Status**: FIXED
**Cross-Platform Impact**: All platforms
**Fix Applied**: Added missing mock fields

---

## Cross-Platform Considerations

### Android Specific Concerns
- [ ] Touch gesture handling in miniapp environment
- [ ] WebView compatibility (Android System WebView vs Chrome Custom Tabs)
- [ ] Wallet connection patterns on Android
- [ ] Frame rendering performance on older Android devices

### iOS Specific Concerns  
- [ ] SafeArea handling in miniapp
- [ ] iOS WebKit limitations
- [ ] WKWebView vs SFSafariViewController differences
- [ ] Touch feedback and haptics

### Browser Compatibility
- [ ] Chrome on various devices
- [ ] Safari (mobile and desktop)
- [ ] Firefox mobile
- [ ] Samsung Internet
- [ ] Edge mobile

---

## Test Categories Needing Attention

### 1. Component Tests (PENDING)
- No comprehensive React component testing yet
- Need to test all UI components across different screen sizes
- Form validation and user interaction flows

### 2. Provider Tests (PENDING)
- Context providers not fully tested
- State management edge cases
- Provider composition and nesting

### 3. Integration Tests (PENDING)
- End-to-end user workflows
- Cross-feature integrations
- Real wallet connection flows

### 4. Error Boundary Tests (PENDING)
- Component crash recovery
- Network failure handling
- Wallet disconnection scenarios

---

## Performance Anomalies

### Bundle Size Warning
**Issue**: Build warning about chunks > 500kb
**Impact**: Slower load times, especially on mobile networks
**Priority**: MEDIUM (post-beta optimization)
**Recommendation**: Implement code splitting for non-critical routes

---

## Testing Strategy

### Immediate Priorities (Beta Completion)
1. Fix all failing hook tests
2. Add component tests for critical user flows
3. Test wallet connection on multiple devices
4. Verify frame functionality in Farcaster on Android/iOS

### Systematic Approach
1. **Fix Current Failures**: Get to 100% test pass rate
2. **Add Missing Coverage**: Components, providers, integration tests
3. **Cross-Platform Validation**: Test on real devices
4. **Performance Testing**: Load times, interaction responsiveness
5. **Edge Case Testing**: Network failures, wallet disconnections, etc.

---

## Device Testing Matrix

### Priority Devices for Beta
- [ ] iPhone (iOS Safari)
- [ ] iPhone (Farcaster miniapp)
- [ ] Android Chrome
- [ ] Android (Farcaster miniapp)
- [ ] Desktop Chrome
- [ ] Desktop Safari
- [ ] Desktop Firefox

### Test Scenarios per Device
- [ ] Wallet connection/disconnection
- [ ] Evermark creation with image upload
- [ ] Voting and staking flows
- [ ] Frame interactions (Farcaster only)
- [ ] Navigation and menu functionality
- [ ] Beta points tracking

---

## Next Actions

1. **IMMEDIATE**: Fix remaining hook test failures
2. **PHASE 1**: Add component tests for critical flows
3. **PHASE 2**: Cross-platform device testing
4. **PHASE 3**: Performance optimization
5. **PHASE 4**: Comprehensive edge case coverage

---

*Last Updated: $(date)*
*Status: Active Development*