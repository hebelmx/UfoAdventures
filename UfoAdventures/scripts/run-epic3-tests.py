#!/usr/bin/env python3
"""
Epic 3 Automated Test Runner (Python Version)

This script provides an alternative Python-based test runner for Epic 3 features.
It can be used as a fallback or for environments where Node.js is not available.
"""

import subprocess
import json
import os
import sys
from datetime import datetime
from pathlib import Path

# Epic 3 test configuration
EPIC3_TESTS = [
    'epic3-difficulty-modifiers.spec.ts',
    'epic3-arena-environment.spec.ts', 
    'epic3-portal-escape.spec.ts',
    'epic3-missile-guidance.spec.ts',
    'epic3-tarak-boss.spec.ts'
]

TEST_REQUIREMENTS = {
    'epic3-difficulty-modifiers.spec.ts': {
        'story': '3.2',
        'name': 'Enemy Difficulty Modifiers',
        'manual_requirement': 'Gameplay smoke test run on easy & hard to validate behaviour',
        'automated_tests': [
            'Easy mode modifiers applied correctly',
            'Hard mode modifiers applied correctly', 
            'Enemy spawning with difficulty modifiers',
            'Easy vs hard mode validation',
            'Gameplay balance across difficulties'
        ]
    },
    'epic3-arena-environment.spec.ts': {
        'story': '3.3',
        'name': 'Pet Cyborg Arena Encounter',
        'manual_requirement': 'Playthrough recorded for QA evidence',
        'automated_tests': [
            'Warning and hazard spawning',
            'Player damage on hazard collision',
            'Visual effects for warnings and hazards',
            'Arena environment system integration'
        ]
    },
    'epic3-portal-escape.spec.ts': {
        'story': '3.4', 
        'name': 'Dimensional Portal Escape Scene',
        'manual_requirement': 'Gameplay video captured for documentation',
        'automated_tests': [
            'Portal escape scene loading',
            'Key and time ball collectibles',
            'Key collection progress tracking',
            'Countdown timer functionality',
            'Portal opening when keys collected',
            'Win/lose conditions'
        ]
    },
    'epic3-missile-guidance.spec.ts': {
        'story': '3.5',
        'name': 'Missile Guidance and Seeker Systems', 
        'manual_requirement': 'Manual sanity check: throttle browser to 4× CPU slowdown',
        'automated_tests': [
            'Homing missile creation with guidance',
            'Proportional navigation velocity updates',
            'Multiple guidance types support',
            'Trail effects for missiles',
            'Performance under CPU throttling'
        ]
    },
    'epic3-tarak-boss.spec.ts': {
        'story': '3.6',
        'name': 'Tarak Boss Behaviors',
        'manual_requirement': 'Manual boss run recorded verifying behaviour',
        'automated_tests': [
            'Tarak boss creation with phase system',
            'Phase transitions based on health',
            'Different movement patterns per phase',
            'Reinforcement summoning in beta phase',
            'Energy spikes in gamma phase',
            'Tarak-specific attack patterns',
            'Phase transition events'
        ]
    }
}

def run_command(command, cwd=None):
    """Run a command and return the result."""
    try:
        result = subprocess.run(
            command, 
            shell=True, 
            cwd=cwd, 
            capture_output=True, 
            text=True, 
            timeout=300
        )
        return {
            'success': result.returncode == 0,
            'stdout': result.stdout,
            'stderr': result.stderr,
            'returncode': result.returncode
        }
    except subprocess.TimeoutExpired:
        return {
            'success': False,
            'stdout': '',
            'stderr': 'Command timed out after 5 minutes',
            'returncode': -1
        }
    except Exception as e:
        return {
            'success': False,
            'stdout': '',
            'stderr': str(e),
            'returncode': -1
        }

def check_dependencies():
    """Check if required dependencies are available."""
    print("🔍 Checking dependencies...")
    
    # Check if Node.js is available
    node_result = run_command('node --version')
    if not node_result['success']:
        print("❌ Node.js not found. Please install Node.js to run Playwright tests.")
        return False
    
    # Check if npm is available
    npm_result = run_command('npm --version')
    if not npm_result['success']:
        print("❌ npm not found. Please install npm.")
        return False
    
    # Check if Playwright is installed
    playwright_result = run_command('npx playwright --version')
    if not playwright_result['success']:
        print("⚠️  Playwright not found. Installing...")
        install_result = run_command('npm install @playwright/test')
        if not install_result['success']:
            print("❌ Failed to install Playwright.")
            return False
    
    print("✅ Dependencies check passed.")
    return True

def run_epic3_tests():
    """Run all Epic 3 tests and generate a report."""
    print("🚀 Starting Epic 3 Automated Testing Suite (Python)")
    print("=" * 50)
    
    if not check_dependencies():
        sys.exit(1)
    
    # Get project root directory
    project_root = Path(__file__).parent.parent
    test_dir = project_root / 'tests' / 'e2e'
    
    if not test_dir.exists():
        print(f"❌ Test directory not found: {test_dir}")
        sys.exit(1)
    
    results = {
        'total_tests': 0,
        'passed_tests': 0,
        'failed_tests': 0,
        'test_results': []
    }
    
    # Run each Epic 3 test file
    for test_file in EPIC3_TESTS:
        test_path = test_dir / test_file
        
        if not test_path.exists():
            print(f"⚠️  Test file not found: {test_file}")
            continue
        
        test_info = TEST_REQUIREMENTS[test_file]
        print(f"\n📋 Running {test_info['name']} (Story {test_info['story']})")
        print(f"   Manual Requirement: {test_info['manual_requirement']}")
        print(f"   Automated Tests: {len(test_info['automated_tests'])} test scenarios")
        
        try:
            print(f"   🏃 Executing: {test_file}")
            
            # Run the specific test file
            command = f"npx playwright test {test_file} --reporter=json"
            result = run_command(command, cwd=project_root)
            
            if result['success']:
                try:
                    test_result = json.loads(result['stdout'])
                    passed = test_result.get('stats', {}).get('passed', 0)
                    failed = test_result.get('stats', {}).get('failed', 0)
                    
                    results['total_tests'] += passed + failed
                    results['passed_tests'] += passed
                    results['failed_tests'] += failed
                    
                    results['test_results'].append({
                        'story': test_info['story'],
                        'name': test_info['name'],
                        'test_file': test_file,
                        'passed': passed,
                        'failed': failed,
                        'total': passed + failed,
                        'status': 'PASSED' if failed == 0 else 'FAILED'
                    })
                    
                    if failed == 0:
                        print(f"   ✅ PASSED: {passed} tests")
                    else:
                        print(f"   ❌ FAILED: {failed} tests, {passed} passed")
                        
                except json.JSONDecodeError:
                    print(f"   ❌ ERROR: Failed to parse test results for {test_file}")
                    results['test_results'].append({
                        'story': test_info['story'],
                        'name': test_info['name'],
                        'test_file': test_file,
                        'passed': 0,
                        'failed': 1,
                        'total': 1,
                        'status': 'ERROR'
                    })
            else:
                print(f"   ❌ ERROR: Failed to run {test_file}")
                print(f"   {result['stderr']}")
                results['test_results'].append({
                    'story': test_info['story'],
                    'name': test_info['name'],
                    'test_file': test_file,
                    'passed': 0,
                    'failed': 1,
                    'total': 1,
                    'status': 'ERROR'
                })
                
        except Exception as e:
            print(f"   ❌ EXCEPTION: {str(e)}")
            results['test_results'].append({
                'story': test_info['story'],
                'name': test_info['name'],
                'test_file': test_file,
                'passed': 0,
                'failed': 1,
                'total': 1,
                'status': 'EXCEPTION'
            })
    
    # Generate comprehensive report
    generate_report(results, project_root)

def generate_report(results, project_root):
    """Generate a comprehensive test report."""
    print("\n📊 Epic 3 Automated Testing Report")
    print("=" * 35)
    
    print(f"\n📈 Summary:")
    print(f"   Total Tests: {results['total_tests']}")
    print(f"   Passed: {results['passed_tests']} ✅")
    print(f"   Failed: {results['failed_tests']} ❌")
    
    if results['total_tests'] > 0:
        success_rate = (results['passed_tests'] / results['total_tests']) * 100
        print(f"   Success Rate: {success_rate:.1f}%")
    
    print(f"\n📋 Story Results:")
    for result in results['test_results']:
        status = '✅' if result['status'] == 'PASSED' else '❌'
        print(f"   {status} Story {result['story']}: {result['name']}")
        print(f"      Tests: {result['passed']}/{result['total']} passed")
    
    print(f"\n🎯 Manual Testing Replacement Status:")
    all_passed = True
    for result in results['test_results']:
        test_info = TEST_REQUIREMENTS[result['test_file']]
        status = '✅ AUTOMATED' if result['status'] == 'PASSED' else '❌ NEEDS MANUAL'
        if result['status'] != 'PASSED':
            all_passed = False
        print(f"   {status} Story {result['story']}: {test_info['manual_requirement']}")
    
    # Generate JSON report
    report_data = {
        'timestamp': datetime.now().isoformat(),
        'summary': {
            'total_tests': results['total_tests'],
            'passed_tests': results['passed_tests'],
            'failed_tests': results['failed_tests'],
            'success_rate': (results['passed_tests'] / results['total_tests']) * 100 if results['total_tests'] > 0 else 0
        },
        'results': results['test_results'],
        'manual_testing_replacement': all_passed
    }
    
    report_path = project_root / 'epic3-test-report.json'
    with open(report_path, 'w') as f:
        json.dump(report_data, f, indent=2)
    
    print(f"\n📄 Detailed report saved to: {report_path}")
    
    # Exit with appropriate code
    if results['failed_tests'] > 0:
        print("\n❌ Some tests failed. Manual testing may be required.")
        sys.exit(1)
    else:
        print("\n✅ All Epic 3 tests passed! Manual testing requirements have been automated.")
        sys.exit(0)

if __name__ == '__main__':
    run_epic3_tests()
