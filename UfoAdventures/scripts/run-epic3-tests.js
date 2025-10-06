#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Epic 3 Automated Test Runner
 * 
 * This script runs all Epic 3 E2E tests and generates a comprehensive report
 * to replace manual testing requirements.
 */

const EPIC3_TESTS = [
  'epic3-difficulty-modifiers.spec.ts',
  'epic3-arena-environment.spec.ts', 
  'epic3-portal-escape.spec.ts',
  'epic3-missile-guidance.spec.ts',
  'epic3-tarak-boss.spec.ts'
];

const TEST_REQUIREMENTS = {
  'epic3-difficulty-modifiers.spec.ts': {
    story: '3.2',
    name: 'Enemy Difficulty Modifiers',
    manualRequirement: 'Gameplay smoke test run on easy & hard to validate behaviour',
    automatedTests: [
      'Easy mode modifiers applied correctly',
      'Hard mode modifiers applied correctly', 
      'Enemy spawning with difficulty modifiers',
      'Easy vs hard mode validation',
      'Gameplay balance across difficulties'
    ]
  },
  'epic3-arena-environment.spec.ts': {
    story: '3.3',
    name: 'Pet Cyborg Arena Encounter',
    manualRequirement: 'Playthrough recorded for QA evidence',
    automatedTests: [
      'Warning and hazard spawning',
      'Player damage on hazard collision',
      'Visual effects for warnings and hazards',
      'Arena environment system integration'
    ]
  },
  'epic3-portal-escape.spec.ts': {
    story: '3.4', 
    name: 'Dimensional Portal Escape Scene',
    manualRequirement: 'Gameplay video captured for documentation',
    automatedTests: [
      'Portal escape scene loading',
      'Key and time ball collectibles',
      'Key collection progress tracking',
      'Countdown timer functionality',
      'Portal opening when keys collected',
      'Win/lose conditions'
    ]
  },
  'epic3-missile-guidance.spec.ts': {
    story: '3.5',
    name: 'Missile Guidance and Seeker Systems', 
    manualRequirement: 'Manual sanity check: throttle browser to 4× CPU slowdown',
    automatedTests: [
      'Homing missile creation with guidance',
      'Proportional navigation velocity updates',
      'Multiple guidance types support',
      'Trail effects for missiles',
      'Performance under CPU throttling'
    ]
  },
  'epic3-tarak-boss.spec.ts': {
    story: '3.6',
    name: 'Tarak Boss Behaviors',
    manualRequirement: 'Manual boss run recorded verifying behaviour',
    automatedTests: [
      'Tarak boss creation with phase system',
      'Phase transitions based on health',
      'Different movement patterns per phase',
      'Reinforcement summoning in beta phase',
      'Energy spikes in gamma phase',
      'Tarak-specific attack patterns',
      'Phase transition events'
    ]
  }
};

function runEpic3Tests() {
  console.log('🚀 Starting Epic 3 Automated Testing Suite');
  console.log('==========================================\n');

  const results = {
    totalTests: 0,
    passedTests: 0,
    failedTests: 0,
    testResults: []
  };

  // Ensure test directory exists
  const testDir = path.join(__dirname, '..', 'tests', 'e2e');
  if (!fs.existsSync(testDir)) {
    console.error('❌ Test directory not found:', testDir);
    process.exit(1);
  }

  // Run each Epic 3 test file
  EPIC3_TESTS.forEach(testFile => {
    const testPath = path.join(testDir, testFile);
    
    if (!fs.existsSync(testPath)) {
      console.log(`⚠️  Test file not found: ${testFile}`);
      return;
    }

    const testInfo = TEST_REQUIREMENTS[testFile];
    console.log(`\n📋 Running ${testInfo.name} (Story ${testInfo.story})`);
    console.log(`   Manual Requirement: ${testInfo.manualRequirement}`);
    console.log(`   Automated Tests: ${testInfo.automatedTests.length} test scenarios`);
    
    try {
      console.log(`   🏃 Executing: ${testFile}`);
      
      // Run the specific test file
      const output = execSync(`npx playwright test ${testFile} --reporter=json`, {
        cwd: path.join(__dirname, '..'),
        encoding: 'utf8',
        stdio: 'pipe'
      });

      const testResult = JSON.parse(output);
      const passed = testResult.stats.passed;
      const failed = testResult.stats.failed;
      
      results.totalTests += passed + failed;
      results.passedTests += passed;
      results.failedTests += failed;
      
      results.testResults.push({
        story: testInfo.story,
        name: testInfo.name,
        testFile,
        passed,
        failed,
        total: passed + failed,
        status: failed === 0 ? 'PASSED' : 'FAILED'
      });

      if (failed === 0) {
        console.log(`   ✅ PASSED: ${passed} tests`);
      } else {
        console.log(`   ❌ FAILED: ${failed} tests, ${passed} passed`);
      }

    } catch (error) {
      console.log(`   ❌ ERROR: Failed to run ${testFile}`);
      console.log(`   ${error.message}`);
      
      results.testResults.push({
        story: testInfo.story,
        name: testInfo.name,
        testFile,
        passed: 0,
        failed: 1,
        total: 1,
        status: 'ERROR'
      });
    }
  });

  // Generate comprehensive report
  generateReport(results);
}

function generateReport(results) {
  console.log('\n📊 Epic 3 Automated Testing Report');
  console.log('==================================');
  
  console.log(`\n📈 Summary:`);
  console.log(`   Total Tests: ${results.totalTests}`);
  console.log(`   Passed: ${results.passedTests} ✅`);
  console.log(`   Failed: ${results.failedTests} ❌`);
  console.log(`   Success Rate: ${((results.passedTests / results.totalTests) * 100).toFixed(1)}%`);

  console.log(`\n📋 Story Results:`);
  results.testResults.forEach(result => {
    const status = result.status === 'PASSED' ? '✅' : '❌';
    console.log(`   ${status} Story ${result.story}: ${result.name}`);
    console.log(`      Tests: ${result.passed}/${result.total} passed`);
  });

  console.log(`\n🎯 Manual Testing Replacement Status:`);
  results.testResults.forEach(result => {
    const testInfo = TEST_REQUIREMENTS[result.testFile];
    const status = result.status === 'PASSED' ? '✅ AUTOMATED' : '❌ NEEDS MANUAL';
    console.log(`   ${status} Story ${result.story}: ${testInfo.manualRequirement}`);
  });

  // Generate JSON report for CI/CD
  const reportPath = path.join(__dirname, '..', 'epic3-test-report.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    summary: {
      totalTests: results.totalTests,
      passedTests: results.passedTests,
      failedTests: results.failedTests,
      successRate: (results.passedTests / results.totalTests) * 100
    },
    results: results.testResults,
    manualTestingReplacement: results.testResults.every(r => r.status === 'PASSED')
  }, null, 2));

  console.log(`\n📄 Detailed report saved to: ${reportPath}`);

  // Exit with appropriate code
  if (results.failedTests > 0) {
    console.log('\n❌ Some tests failed. Manual testing may be required.');
    process.exit(1);
  } else {
    console.log('\n✅ All Epic 3 tests passed! Manual testing requirements have been automated.');
    process.exit(0);
  }
}

// Run the tests
if (require.main === module) {
  runEpic3Tests();
}

module.exports = { runEpic3Tests, EPIC3_TESTS, TEST_REQUIREMENTS };
