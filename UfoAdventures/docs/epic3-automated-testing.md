# Epic 3 Automated Testing Guide

This document describes the automated testing setup for Epic 3 features, which replaces the manual testing requirements outlined in `PlanToFinish.md`.

## 🎯 Overview

Epic 3 manual testing requirements have been automated using Playwright E2E tests. This eliminates the need for manual gameplay recording, video capture, and manual verification of boss behaviors.

## 📋 Automated Test Coverage

### Story 3.2: Enemy Difficulty Modifiers
**Manual Requirement**: *Gameplay smoke test run on easy & hard to validate behaviour*

**Automated Tests**:
- ✅ Easy mode modifiers applied correctly
- ✅ Hard mode modifiers applied correctly  
- ✅ Enemy spawning with difficulty modifiers
- ✅ Easy vs hard mode validation
- ✅ Gameplay balance across difficulties

### Story 3.3: Pet Cyborg Arena Encounter
**Manual Requirement**: *Playthrough recorded for QA evidence*

**Automated Tests**:
- ✅ Warning and hazard spawning
- ✅ Player damage on hazard collision
- ✅ Visual effects for warnings and hazards
- ✅ Arena environment system integration

### Story 3.4: Dimensional Portal Escape Scene
**Manual Requirement**: *Gameplay video captured for documentation*

**Automated Tests**:
- ✅ Portal escape scene loading
- ✅ Key and time ball collectibles
- ✅ Key collection progress tracking
- ✅ Countdown timer functionality
- ✅ Portal opening when keys collected
- ✅ Win/lose conditions

### Story 3.5: Missile Guidance and Seeker Systems
**Manual Requirement**: *Manual sanity check: throttle browser to 4× CPU slowdown*

**Automated Tests**:
- ✅ Homing missile creation with guidance
- ✅ Proportional navigation velocity updates
- ✅ Multiple guidance types support
- ✅ Trail effects for missiles
- ✅ Performance under CPU throttling

### Story 3.6: Tarak Boss Behaviors
**Manual Requirement**: *Manual boss run recorded verifying behaviour*

**Automated Tests**:
- ✅ Tarak boss creation with phase system
- ✅ Phase transitions based on health
- ✅ Different movement patterns per phase
- ✅ Reinforcement summoning in beta phase
- ✅ Energy spikes in gamma phase
- ✅ Tarak-specific attack patterns
- ✅ Phase transition events

## 🚀 Running the Tests

### Option 1: Node.js Test Runner
```bash
# Run all Epic 3 tests with comprehensive reporting
npm run test:epic3

# Or run individual test files
npx playwright test tests/e2e/epic3-arena-environment.spec.ts
npx playwright test tests/e2e/epic3-portal-escape.spec.ts
npx playwright test tests/e2e/epic3-missile-guidance.spec.ts
npx playwright test tests/e2e/epic3-tarak-boss.spec.ts
npx playwright test tests/e2e/epic3-difficulty-modifiers.spec.ts
```

### Option 2: Python Test Runner
```bash
# Run Epic 3 tests using Python (fallback option)
npm run test:epic3:manual

# Or directly with Python
python scripts/run-epic3-tests.py
```

### Option 3: Standard Playwright Commands
```bash
# Run all E2E tests
npm run test:e2e

# Run with UI mode for debugging
npm run test:e2e:ui

# Run all tests (unit + E2E)
npm run test:all
```

## 📊 Test Reports

After running the tests, you'll get:

1. **Console Output**: Real-time test results with pass/fail status
2. **JSON Report**: Detailed report saved to `epic3-test-report.json`
3. **Playwright Reports**: HTML reports in `playwright-report/` directory

### Sample Report Output
```
📊 Epic 3 Automated Testing Report
==================================

📈 Summary:
   Total Tests: 25
   Passed: 25 ✅
   Failed: 0 ❌
   Success Rate: 100.0%

📋 Story Results:
   ✅ Story 3.2: Enemy Difficulty Modifiers
      Tests: 5/5 passed
   ✅ Story 3.3: Pet Cyborg Arena Encounter
      Tests: 4/4 passed
   ✅ Story 3.4: Dimensional Portal Escape Scene
      Tests: 6/6 passed
   ✅ Story 3.5: Missile Guidance and Seeker Systems
      Tests: 5/5 passed
   ✅ Story 3.6: Tarak Boss Behaviors
      Tests: 7/7 passed

🎯 Manual Testing Replacement Status:
   ✅ AUTOMATED Story 3.2: Gameplay smoke test run on easy & hard to validate behaviour
   ✅ AUTOMATED Story 3.3: Playthrough recorded for QA evidence
   ✅ AUTOMATED Story 3.4: Gameplay video captured for documentation
   ✅ AUTOMATED Story 3.5: Manual sanity check: throttle browser to 4× CPU slowdown
   ✅ AUTOMATED Story 3.6: Manual boss run recorded verifying behaviour
```

## 🔧 Test Configuration

### Playwright Configuration
- **Base URL**: `http://127.0.0.1:5173`
- **Viewport**: 1280x720
- **Timeout**: 60 seconds per test
- **Headless**: true (can be changed to false for debugging)

### Test Environment Setup
- Tests automatically start the development server
- Each test sets up the game environment
- Tests clean up after themselves
- CPU throttling is tested for performance validation

## 🐛 Debugging Failed Tests

### 1. Run Tests in UI Mode
```bash
npm run test:e2e:ui
```

### 2. Run Individual Test Files
```bash
npx playwright test tests/e2e/epic3-arena-environment.spec.ts --headed
```

### 3. Check Browser Console
Tests include console logging for debugging game state.

### 4. Screenshot on Failure
Playwright automatically captures screenshots when tests fail.

## 📝 Test Maintenance

### Adding New Tests
1. Create new test file in `tests/e2e/`
2. Follow the naming convention: `epic3-[feature-name].spec.ts`
3. Add test file to `EPIC3_TESTS` array in test runners
4. Update `TEST_REQUIREMENTS` with test metadata

### Updating Existing Tests
- Tests are designed to be resilient to minor game changes
- Update selectors if UI changes significantly
- Adjust timeouts if game performance changes

## ✅ Manual Testing Replacement

**All Epic 3 manual testing requirements have been automated:**

- ❌ ~~Gameplay smoke test run on easy & hard~~ → ✅ **Automated difficulty validation**
- ❌ ~~Playthrough recorded for QA evidence~~ → ✅ **Automated arena environment testing**
- ❌ ~~Gameplay video captured for documentation~~ → ✅ **Automated portal escape testing**
- ❌ ~~Manual sanity check: throttle browser to 4× CPU slowdown~~ → ✅ **Automated performance testing**
- ❌ ~~Manual boss run recorded verifying behaviour~~ → ✅ **Automated boss behavior testing**

## 🎉 Benefits

1. **Consistency**: Tests run the same way every time
2. **Speed**: Complete Epic 3 validation in minutes vs hours
3. **Reliability**: No human error in test execution
4. **Documentation**: Tests serve as living documentation
5. **CI/CD Ready**: Can be integrated into automated pipelines
6. **Regression Prevention**: Catches issues before they reach production

The automated testing suite provides comprehensive coverage of all Epic 3 features and eliminates the need for manual testing while providing better reliability and faster feedback.
