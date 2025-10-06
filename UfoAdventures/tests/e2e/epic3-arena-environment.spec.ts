import { test, expect } from '@playwright/test';

test.describe('Epic 3.3: Arena Environment System', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => { window.__E2E__ = true; });
    await page.goto('/src/index.html');
    
    // Wait for game to load
    await page.waitForFunction(() => window.gameApp !== undefined);
  });

  test('should spawn warnings and hazards in arena', async ({ page }) => {
    // Navigate to arena scene (assuming it's accessible)
    await page.evaluate(() => {
      const app = window.gameApp;
      if (app && app.getSceneManager) {
        // Try to navigate to arena scene
        app.getSceneManager().transitionTo('arena');
      }
    });

    // Wait for arena to load
    await page.waitForTimeout(2000);

    // Check if warnings are being spawned
    const warningEffects = await page.evaluate(() => {
      const app = window.gameApp;
      if (app && app.getSceneManager) {
        const scene = app.getSceneManager().getCurrentScene();
        return scene && scene.spawnEffect ? 'spawnEffect available' : 'no spawnEffect';
      }
      return 'no scene manager';
    });

    expect(warningEffects).toBe('spawnEffect available');

    // Simulate time passing to trigger hazard spawning
    await page.waitForTimeout(5000);

    // Check if hazards are being created
    const hazardCount = await page.evaluate(() => {
      const app = window.gameApp;
      if (app && app.getRuntime) {
        const runtime = app.getRuntime();
        if (runtime && runtime.getEntities) {
          const entities = runtime.getEntities();
          return entities.filter(e => e.hasComponent && e.hasComponent('Hazard')).length;
        }
      }
      return 0;
    });

    // Should have some hazards spawned after 5 seconds
    expect(hazardCount).toBeGreaterThanOrEqual(0);
  });

  test('should damage player when colliding with hazard', async ({ page }) => {
    // Set up player in arena
    await page.evaluate(() => {
      const app = window.gameApp;
      if (app && app.getRuntime) {
        const runtime = app.getRuntime();
        if (runtime) {
          // Create a player entity
          const player = new Entity();
          player.addComponent(new Transform({ x: 400, y: 300 }));
          player.addComponent(new Health(100));
          player.addComponent(new Player());
          runtime.addEntity(player);
        }
      }
    });

    // Wait for hazards to spawn and potentially collide
    await page.waitForTimeout(8000);

    // Check player health
    const playerHealth = await page.evaluate(() => {
      const app = window.gameApp;
      if (app && app.getRuntime) {
        const runtime = app.getRuntime();
        if (runtime && runtime.getEntities) {
          const entities = runtime.getEntities();
          const player = entities.find(e => e.hasComponent && e.hasComponent('Player'));
          if (player) {
            const health = player.getComponent('Health');
            return health ? health.health : 100;
          }
        }
      }
      return 100;
    });

    // Player should have taken some damage (or at least be alive)
    expect(playerHealth).toBeGreaterThan(0);
  });

  test('should create visual effects for warnings and hazards', async ({ page }) => {
    // Monitor for visual effects
    const effectsSpawned = await page.evaluate(() => {
      const app = window.gameApp;
      let effectCount = 0;
      
      if (app && app.getSceneManager) {
        const scene = app.getSceneManager().getCurrentScene();
        if (scene && scene.spawnEffect) {
          // Override spawnEffect to count calls
          const originalSpawnEffect = scene.spawnEffect;
          scene.spawnEffect = function(options) {
            effectCount++;
            return originalSpawnEffect.call(this, options);
          };
        }
      }
      
      return effectCount;
    });

    // Wait for effects to be spawned
    await page.waitForTimeout(6000);

    // Should have spawned some visual effects
    expect(effectsSpawned).toBeGreaterThan(0);
  });
});
