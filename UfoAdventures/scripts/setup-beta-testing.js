#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Beta Testing Setup Script
 * 
 * This script sets up the beta testing environment for UFO Adventures,
 * including configuration, deployment, and monitoring setup.
 */

const BETA_CONFIG = {
    version: '1.0.0-beta',
    environment: 'staging',
    features: {
        feedback: true,
        analytics: true,
        performanceMonitoring: true,
        autoErrorReporting: true,
        autoPerformanceReporting: true
    },
    endpoints: {
        feedback: '/api/beta-feedback',
        analytics: '/api/analytics',
        health: '/api/health'
    },
    limits: {
        maxEventsPerSession: 1000,
        sessionTimeout: 0, // No timeout
        maxFeedbackPerDay: 50
    }
};

function setupBetaTesting() {
    console.log('🚀 Setting up Beta Testing Environment for UFO Adventures');
    console.log('=' * 60);

    try {
        // 1. Create beta configuration
        createBetaConfig();

        // 2. Set up environment variables
        setupEnvironmentVariables();

        // 3. Create beta build
        createBetaBuild();

        // 4. Set up monitoring
        setupMonitoring();

        // 5. Create deployment scripts
        createDeploymentScripts();

        // 6. Set up feedback collection
        setupFeedbackCollection();

        // 7. Create beta testing documentation
        createBetaDocumentation();

        console.log('\n✅ Beta Testing Environment setup complete!');
        console.log('\nNext steps:');
        console.log('1. Review the beta configuration in beta-config.json');
        console.log('2. Deploy to staging environment');
        console.log('3. Invite beta testers');
        console.log('4. Monitor feedback and analytics');

    } catch (error) {
        console.error('❌ Error setting up beta testing environment:', error);
        process.exit(1);
    }
}

function createBetaConfig() {
    console.log('📝 Creating beta configuration...');
    
    const configPath = path.join(__dirname, '..', 'beta-config.json');
    const config = {
        ...BETA_CONFIG,
        timestamp: new Date().toISOString(),
        setup: {
            nodeVersion: process.version,
            platform: process.platform,
            arch: process.arch
        }
    };

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log(`   ✅ Beta configuration created: ${configPath}`);
}

function setupEnvironmentVariables() {
    console.log('🔧 Setting up environment variables...');
    
    const envPath = path.join(__dirname, '..', '.env.beta');
    const envContent = `
# Beta Testing Environment Variables
NODE_ENV=staging
BETA_TESTING_ENABLED=true
FEEDBACK_ENDPOINT=${BETA_CONFIG.endpoints.feedback}
ANALYTICS_ENDPOINT=${BETA_CONFIG.endpoints.analytics}
HEALTH_ENDPOINT=${BETA_CONFIG.endpoints.health}
MAX_EVENTS_PER_SESSION=${BETA_CONFIG.limits.maxEventsPerSession}
SESSION_TIMEOUT=${BETA_CONFIG.limits.sessionTimeout}
MAX_FEEDBACK_PER_DAY=${BETA_CONFIG.limits.maxFeedbackPerDay}
BETA_VERSION=${BETA_CONFIG.version}
`;

    fs.writeFileSync(envPath, envContent);
    console.log(`   ✅ Environment variables created: ${envPath}`);
}

function createBetaBuild() {
    console.log('🏗️  Creating beta build...');
    
    try {
        // Create beta build script
        const buildScript = `#!/bin/bash
# Beta Build Script for UFO Adventures

echo "🚀 Building beta version ${BETA_CONFIG.version}..."

# Set environment
export NODE_ENV=staging
export BETA_TESTING_ENABLED=true

# Install dependencies
npm install

# Run tests
npm run test:unit
npm run test:e2e

# Build for production
npm run build

# Create beta-specific build
mkdir -p dist/beta
cp -r dist/* dist/beta/

# Add beta testing files
cp src/css/beta-feedback.css dist/beta/
cp src/js/beta-testing-guide.html dist/beta/

# Create beta manifest
cat > dist/beta/manifest.json << EOF
{
  "name": "UFO Adventures Beta",
  "version": "${BETA_CONFIG.version}",
  "description": "Beta testing version of UFO Adventures",
  "beta": true,
  "features": ${JSON.stringify(BETA_CONFIG.features)},
  "endpoints": ${JSON.stringify(BETA_CONFIG.endpoints)},
  "limits": ${JSON.stringify(BETA_CONFIG.limits)}
}
EOF

echo "✅ Beta build complete!"
echo "📁 Beta files created in: dist/beta/"
`;

        const buildScriptPath = path.join(__dirname, 'build-beta.sh');
        fs.writeFileSync(buildScriptPath, buildScript);
        fs.chmodSync(buildScriptPath, '755');
        console.log(`   ✅ Beta build script created: ${buildScriptPath}`);

    } catch (error) {
        console.warn('   ⚠️  Warning: Could not create beta build script:', error.message);
    }
}

function setupMonitoring() {
    console.log('📊 Setting up monitoring...');
    
    const monitoringConfig = {
        performance: {
            enabled: true,
            metrics: ['fps', 'frameTime', 'memoryUsage', 'loadTime'],
            thresholds: {
                fps: 30,
                frameTime: 33,
                memoryUsage: 100,
                loadTime: 5000
            }
        },
        errors: {
            enabled: true,
            autoReport: true,
            severity: ['critical', 'high', 'medium']
        },
        analytics: {
            enabled: true,
            events: ['session-start', 'session-end', 'level-complete', 'player-death'],
            retention: 30 // days
        }
    };

    const monitoringPath = path.join(__dirname, '..', 'monitoring-config.json');
    fs.writeFileSync(monitoringPath, JSON.stringify(monitoringConfig, null, 2));
    console.log(`   ✅ Monitoring configuration created: ${monitoringPath}`);
}

function createDeploymentScripts() {
    console.log('🚀 Creating deployment scripts...');
    
    // Create deployment script
    const deployScript = `#!/bin/bash
# Beta Deployment Script for UFO Adventures

echo "🚀 Deploying beta version ${BETA_CONFIG.version}..."

# Check if beta build exists
if [ ! -d "dist/beta" ]; then
    echo "❌ Beta build not found. Run build-beta.sh first."
    exit 1
fi

# Deploy to staging server
echo "📤 Deploying to staging server..."
rsync -avz --delete dist/beta/ staging-server:/var/www/ufo-adventures-beta/

# Update server configuration
echo "🔧 Updating server configuration..."
ssh staging-server "cd /var/www/ufo-adventures-beta && npm install --production"

# Restart services
echo "🔄 Restarting services..."
ssh staging-server "sudo systemctl restart ufo-adventures-beta"

# Health check
echo "🏥 Performing health check..."
sleep 5
curl -f http://staging-server/health || {
    echo "❌ Health check failed!"
    exit 1
}

echo "✅ Beta deployment complete!"
echo "🌐 Beta version available at: http://staging-server/ufo-adventures-beta/"
`;

    const deployScriptPath = path.join(__dirname, 'deploy-beta.sh');
    fs.writeFileSync(deployScriptPath, deployScript);
    fs.chmodSync(deployScriptPath, '755');
    console.log(`   ✅ Deployment script created: ${deployScriptPath}`);

    // Create rollback script
    const rollbackScript = `#!/bin/bash
# Beta Rollback Script for UFO Adventures

echo "🔄 Rolling back beta deployment..."

# Rollback to previous version
ssh staging-server "cd /var/www/ufo-adventures-beta && git checkout HEAD~1"

# Restart services
echo "🔄 Restarting services..."
ssh staging-server "sudo systemctl restart ufo-adventures-beta"

# Health check
echo "🏥 Performing health check..."
sleep 5
curl -f http://staging-server/health || {
    echo "❌ Health check failed!"
    exit 1
}

echo "✅ Rollback complete!"
`;

    const rollbackScriptPath = path.join(__dirname, 'rollback-beta.sh');
    fs.writeFileSync(rollbackScriptPath, rollbackScript);
    fs.chmodSync(rollbackScriptPath, '755');
    console.log(`   ✅ Rollback script created: ${rollbackScriptPath}`);
}

function setupFeedbackCollection() {
    console.log('📝 Setting up feedback collection...');
    
    const feedbackConfig = {
        categories: [
            'bug',
            'suggestion',
            'balance',
            'performance',
            'ui',
            'audio',
            'other'
        ],
        severity: [
            'low',
            'medium',
            'high',
            'critical'
        ],
        autoCollection: {
            errors: true,
            performance: true,
            crashes: true
        },
        manualCollection: {
            feedbackForm: true,
            quickReports: true,
            surveys: true
        }
    };

    const feedbackPath = path.join(__dirname, '..', 'feedback-config.json');
    fs.writeFileSync(feedbackPath, JSON.stringify(feedbackConfig, null, 2));
    console.log(`   ✅ Feedback configuration created: ${feedbackPath}`);
}

function createBetaDocumentation() {
    console.log('📚 Creating beta documentation...');
    
    const documentation = {
        setup: 'docs/beta-testing-plan.md',
        guide: 'src/js/beta-testing-guide.html',
        api: 'docs/beta-api.md',
        faq: 'docs/beta-faq.md'
    };

    // Create API documentation
    const apiDoc = `# Beta Testing API Documentation

## Endpoints

### POST /api/beta-feedback
Submit beta feedback

**Request Body:**
\`\`\`json
{
  "category": "bug|suggestion|balance|performance|ui|audio|other",
  "severity": "low|medium|high|critical",
  "title": "string",
  "description": "string",
  "stepsToReproduce": "string (optional)",
  "expectedBehavior": "string (optional)",
  "actualBehavior": "string (optional)",
  "browserInfo": {
    "userAgent": "string",
    "platform": "string",
    "language": "string",
    "screenResolution": "string",
    "viewportSize": "string",
    "timezone": "string"
  },
  "gameState": {
    "currentScene": "string",
    "gameMode": "string",
    "difficulty": "string",
    "playerHealth": "number",
    "playerMana": "number",
    "currentWeapon": "string",
    "activeAbilities": "string[]",
    "performanceMetrics": {
      "fps": "number",
      "frameTime": "number",
      "memoryUsage": "number",
      "entitiesCount": "number",
      "systemsCount": "number"
    }
  },
  "timestamp": "number",
  "sessionId": "string",
  "playerId": "string"
}
\`\`\`

### POST /api/analytics
Submit analytics data

**Request Body:**
\`\`\`json
{
  "sessionId": "string",
  "events": [
    {
      "type": "string",
      "data": "object",
      "timestamp": "number",
      "sessionId": "string"
    }
  ],
  "timestamp": "number"
}
\`\`\`

### GET /api/health
Health check endpoint

**Response:**
\`\`\`json
{
  "status": "healthy",
  "version": "1.0.0-beta",
  "timestamp": "number",
  "uptime": "number"
}
\`\`\`
`;

    const apiDocPath = path.join(__dirname, '..', 'docs', 'beta-api.md');
    fs.writeFileSync(apiDocPath, apiDoc);
    console.log(`   ✅ API documentation created: ${apiDocPath}`);

    // Create FAQ
    const faq = `# Beta Testing FAQ

## General Questions

**Q: What is beta testing?**
A: Beta testing is the final testing phase before release, where we gather feedback from real users to identify bugs and improve the game.

**Q: How long will the beta last?**
A: The beta testing period is expected to last 2-4 weeks, depending on the feedback received.

**Q: Will my progress be saved?**
A: Beta progress may be reset between sessions. We recommend treating it as a testing environment rather than a permanent save.

## Technical Questions

**Q: What browsers are supported?**
A: Chrome 90+, Firefox 88+, Safari 14+, and Edge 90+ are supported.

**Q: What if I encounter a bug?**
A: Use the F1 key to open the feedback form and report the bug with as much detail as possible.

**Q: How do I report performance issues?**
A: Use the F3 key to quickly report performance issues, or use the F1 key for detailed feedback.

## Feedback Questions

**Q: What kind of feedback are you looking for?**
A: We want feedback on gameplay, bugs, performance, UI/UX, and any suggestions for improvement.

**Q: How often should I provide feedback?**
A: Provide feedback whenever you encounter issues or have suggestions. There's no minimum requirement.

**Q: Will my feedback be used?**
A: Yes! All feedback is reviewed and used to improve the game before release.
`;

    const faqPath = path.join(__dirname, '..', 'docs', 'beta-faq.md');
    fs.writeFileSync(faqPath, faq);
    console.log(`   ✅ FAQ created: ${faqPath}`);
}

// Run the setup
if (require.main === module) {
    setupBetaTesting();
}

module.exports = { setupBetaTesting, BETA_CONFIG };
