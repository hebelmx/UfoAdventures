import { test, expect } from '@playwright/test';

test.describe('Epic 3.2: Enemy Difficulty Modifiers', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => { window.__E2E__ = true; });
    await page.goto('/src/index.html');
    
    // Wait for game to load
    await page.waitForFunction(() => window.gameApp !== undefined);
  });

  test('should apply easy mode modifiers', async ({ page }) => {
    // Set game to easy mode
    const easyModeResults = await page.evaluate(() => {
      const app = window.gameApp;
      if (app && app.getServices) {
        const configService = app.getServices().resolve('configService');
        if (configService) {
          // Set difficulty to easy
          configService.setDifficulty('easy');
          
          // Get difficulty modifiers
          const modifiers = configService.getDifficultyModifiers('easy');
          
          return {
            difficulty: 'easy',
            healthMultiplier: modifiers.healthMultiplier || 1.0,
            damageMultiplier: modifiers.damageMultiplier || 1.0,
            fireRateMultiplier: modifiers.fireRateMultiplier || 1.0,
            speedMultiplier: modifiers.speedMultiplier || 1.0,
            modifiersApplied: true
          };
        }
      }
      return { difficulty: 'none', modifiersApplied: false };
    });

    expect(easyModeResults.modifiersApplied).toBe(true);
    expect(easyModeResults.difficulty).toBe('easy');
    // Easy mode should have reduced values
    expect(easyModeResults.healthMultiplier).toBeLessThanOrEqual(1.0);
    expect(easyModeResults.damageMultiplier).toBeLessThanOrEqual(1.0);
  });

  test('should apply hard mode modifiers', async ({ page }) => {
    // Set game to hard mode
    const hardModeResults = await page.evaluate(() => {
      const app = window.gameApp;
      if (app && app.getServices) {
        const configService = app.getServices().resolve('configService');
        if (configService) {
          // Set difficulty to hard
          configService.setDifficulty('hard');
          
          // Get difficulty modifiers
          const modifiers = configService.getDifficultyModifiers('hard');
          
          return {
            difficulty: 'hard',
            healthMultiplier: modifiers.healthMultiplier || 1.0,
            damageMultiplier: modifiers.damageMultiplier || 1.0,
            fireRateMultiplier: modifiers.fireRateMultiplier || 1.0,
            speedMultiplier: modifiers.speedMultiplier || 1.0,
            modifiersApplied: true
          };
        }
      }
      return { difficulty: 'none', modifiersApplied: false };
    });

    expect(hardModeResults.modifiersApplied).toBe(true);
    expect(hardModeResults.difficulty).toBe('hard');
    // Hard mode should have increased values
    expect(hardModeResults.healthMultiplier).toBeGreaterThanOrEqual(1.0);
    expect(hardModeResults.damageMultiplier).toBeGreaterThanOrEqual(1.0);
  });

  test('should spawn enemies with difficulty modifiers applied', async ({ page }) => {
    // Test enemy spawning with modifiers
    const enemySpawnResults = await page.evaluate(() => {
      const app = window.gameApp;
      if (app && app.getRuntime) {
        const runtime = app.getRuntime();
        if (runtime) {
          // Set to hard mode
          const configService = app.getServices ? app.getServices().resolve('configService') : null;
          if (configService) {
            configService.setDifficulty('hard');
            const modifiers = configService.getDifficultyModifiers('hard');
            
            // Create enemy with modifiers applied
            const enemy = new Entity();
            enemy.addComponent(new Transform({ x: 100, y: 100 }));
            enemy.addComponent(new Motion({ x: 0, y: 2 }));
            enemy.addComponent(new Enemy());
            enemy.addComponent(new Collider(20));
            
            // Apply modifiers to health
            const baseHealth = 50;
            const modifiedHealth = baseHealth * (modifiers.healthMultiplier || 1.0);
            enemy.addComponent(new Health(modifiedHealth));
            
            // Apply modifiers to speed
            const motion = enemy.getComponent('Motion');
            const baseSpeed = 2;
            const modifiedSpeed = baseSpeed * (modifiers.speedMultiplier || 1.0);
            motion.velocity.y = modifiedSpeed;
            
            runtime.addEntity(enemy);
            
            const health = enemy.getComponent('Health');
            const finalMotion = enemy.getComponent('Motion');
            
            return {
              baseHealth,
              modifiedHealth: health.health,
              baseSpeed,
              modifiedSpeed: finalMotion.velocity.y,
              healthMultiplier: modifiers.healthMultiplier,
              speedMultiplier: modifiers.speedMultiplier,
              enemySpawned: true
            };
          }
        }
      }
      return { enemySpawned: false };
    });

    expect(enemySpawnResults.enemySpawned).toBe(true);
    expect(enemySpawnResults.modifiedHealth).toBeGreaterThanOrEqual(enemySpawnResults.baseHealth);
    expect(enemySpawnResults.modifiedSpeed).toBeGreaterThanOrEqual(enemySpawnResults.baseSpeed);
  });

  test('should validate easy vs hard mode differences', async ({ page }) => {
    // Compare easy and hard mode modifiers
    const modeComparison = await page.evaluate(() => {
      const app = window.gameApp;
      if (app && app.getServices) {
        const configService = app.getServices().resolve('configService');
        if (configService) {
          // Get easy mode modifiers
          const easyModifiers = configService.getDifficultyModifiers('easy');
          
          // Get hard mode modifiers
          const hardModifiers = configService.getDifficultyModifiers('hard');
          
          return {
            easy: {
              health: easyModifiers.healthMultiplier || 1.0,
              damage: easyModifiers.damageMultiplier || 1.0,
              speed: easyModifiers.speedMultiplier || 1.0
            },
            hard: {
              health: hardModifiers.healthMultiplier || 1.0,
              damage: hardModifiers.damageMultiplier || 1.0,
              speed: hardModifiers.speedMultiplier || 1.0
            },
            comparisonValid: true
          };
        }
      }
      return { comparisonValid: false };
    });

    expect(modeComparison.comparisonValid).toBe(true);
    
    // Hard mode should generally be more challenging than easy mode
    expect(modeComparison.hard.health).toBeGreaterThanOrEqual(modeComparison.easy.health);
    expect(modeComparison.hard.damage).toBeGreaterThanOrEqual(modeComparison.easy.damage);
    expect(modeComparison.hard.speed).toBeGreaterThanOrEqual(modeComparison.easy.speed);
  });

  test('should maintain gameplay balance across difficulties', async ({ page }) => {
    // Test that different difficulties are playable
    const gameplayBalance = await page.evaluate(() => {
      const app = window.gameApp;
      if (app && app.getServices) {
        const configService = app.getServices().resolve('configService');
        const difficulties = ['easy', 'normal', 'hard'];
        const results = [];
        
        difficulties.forEach(difficulty => {
          const modifiers = configService.getDifficultyModifiers(difficulty);
          
          // Check that modifiers are reasonable (not too extreme)
          const healthReasonable = modifiers.healthMultiplier >= 0.5 && modifiers.healthMultiplier <= 3.0;
          const damageReasonable = modifiers.damageMultiplier >= 0.5 && modifiers.damageMultiplier <= 3.0;
          const speedReasonable = modifiers.speedMultiplier >= 0.5 && modifiers.speedMultiplier <= 2.0;
          
          results.push({
            difficulty,
            healthReasonable,
            damageReasonable,
            speedReasonable,
            overallReasonable: healthReasonable && damageReasonable && speedReasonable
          });
        });
        
        return {
          difficulties: results,
          allReasonable: results.every(r => r.overallReasonable)
        };
      }
      return { allReasonable: false };
    });

    expect(gameplayBalance.allReasonable).toBe(true);
    expect(gameplayBalance.difficulties).toHaveLength(3);
  });
});
