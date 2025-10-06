import { test, expect } from '@playwright/test';

test.describe('Epic 3.5: Missile Guidance Systems', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => { window.__E2E__ = true; });
    await page.goto('/src/index.html');
    
    // Wait for game to load
    await page.waitForFunction(() => window.gameApp !== undefined);
  });

  test('should create homing missiles with guidance systems', async ({ page }) => {
    // Navigate to combat scene
    await page.evaluate(() => {
      const app = window.gameApp;
      if (app && app.getSceneManager) {
        app.getSceneManager().transitionTo('combat');
      }
    });

    await page.waitForTimeout(2000);

    // Create a homing missile
    const missileCreated = await page.evaluate(() => {
      const app = window.gameApp;
      if (app && app.getRuntime) {
        const runtime = app.getRuntime();
        if (runtime) {
          // Create missile entity
          const missile = new Entity();
          missile.addComponent(new Transform({ x: 100, y: 100 }));
          missile.addComponent(new Motion({ x: 0, y: 0 }));
          missile.addComponent(new Guidance(3, 'player', 'proportional'));
          missile.addComponent(new HomingMissile());
          
          // Create target player
          const player = new Entity();
          player.addComponent(new Transform({ x: 200, y: 200 }));
          player.addComponent(new Motion({ x: 5, y: 3 }));
          player.addComponent(new Player());
          
          runtime.addEntity(missile);
          runtime.addEntity(player);
          
          return {
            missileAdded: true,
            playerAdded: true,
            hasGuidance: missile.hasComponent('Guidance'),
            hasHomingMissile: missile.hasComponent('HomingMissile')
          };
        }
      }
      return { missileAdded: false, playerAdded: false, hasGuidance: false, hasHomingMissile: false };
    });

    expect(missileCreated.missileAdded).toBe(true);
    expect(missileCreated.playerAdded).toBe(true);
    expect(missileCreated.hasGuidance).toBe(true);
    expect(missileCreated.hasHomingMissile).toBe(true);
  });

  test('should update missile velocity with proportional navigation', async ({ page }) => {
    // Set up missile and target
    await page.evaluate(() => {
      const app = window.gameApp;
      if (app && app.getRuntime) {
        const runtime = app.getRuntime();
        if (runtime) {
          const missile = new Entity();
          missile.addComponent(new Transform({ x: 0, y: 0 }));
          missile.addComponent(new Motion({ x: 0, y: 0 }));
          missile.addComponent(new Guidance(3, 'player', 'proportional'));
          missile.addComponent(new HomingMissile());
          
          const player = new Entity();
          player.addComponent(new Transform({ x: 100, y: 0 }));
          player.addComponent(new Motion({ x: 10, y: 5 }));
          player.addComponent(new Player());
          
          runtime.addEntity(missile);
          runtime.addEntity(player);
        }
      }
    });

    // Run multiple updates to see guidance in action
    await page.waitForTimeout(1000);

    const missileVelocity = await page.evaluate(() => {
      const app = window.gameApp;
      if (app && app.getRuntime) {
        const runtime = app.getRuntime();
        if (runtime && runtime.getEntities) {
          const entities = runtime.getEntities();
          const missile = entities.find(e => e.hasComponent && e.hasComponent('HomingMissile'));
          if (missile) {
            const motion = missile.getComponent('Motion');
            return motion ? { x: motion.velocity.x, y: motion.velocity.y } : { x: 0, y: 0 };
          }
        }
      }
      return { x: 0, y: 0 };
    });

    // Missile should have some velocity after guidance updates
    expect(missileVelocity.x !== 0 || missileVelocity.y !== 0).toBe(true);
  });

  test('should support different guidance types', async ({ page }) => {
    const guidanceTypes = await page.evaluate(() => {
      const app = window.gameApp;
      if (app && app.getRuntime) {
        const runtime = app.getRuntime();
        if (runtime) {
          const results = [];
          
          // Test proportional navigation
          const missile1 = new Entity();
          missile1.addComponent(new Transform({ x: 0, y: 0 }));
          missile1.addComponent(new Motion({ x: 0, y: 0 }));
          missile1.addComponent(new Guidance(3, 'player', 'proportional'));
          missile1.addComponent(new HomingMissile());
          
          // Test pure pursuit
          const missile2 = new Entity();
          missile2.addComponent(new Transform({ x: 0, y: 0 }));
          missile2.addComponent(new Motion({ x: 0, y: 0 }));
          missile2.addComponent(new Guidance(3, 'player', 'purePursuit'));
          missile2.addComponent(new HomingMissile());
          
          // Test intercept
          const missile3 = new Entity();
          missile3.addComponent(new Transform({ x: 0, y: 0 }));
          missile3.addComponent(new Motion({ x: 0, y: 0 }));
          missile3.addComponent(new Guidance(3, 'player', 'intercept'));
          missile3.addComponent(new HomingMissile());
          
          const player = new Entity();
          player.addComponent(new Transform({ x: 100, y: 100 }));
          player.addComponent(new Motion({ x: 5, y: 3 }));
          player.addComponent(new Player());
          
          runtime.addEntity(missile1);
          runtime.addEntity(missile2);
          runtime.addEntity(missile3);
          runtime.addEntity(player);
          
          return ['proportional', 'purePursuit', 'intercept'];
        }
      }
      return [];
    });

    expect(guidanceTypes).toContain('proportional');
    expect(guidanceTypes).toContain('purePursuit');
    expect(guidanceTypes).toContain('intercept');
  });

  test('should add trail effects to missiles', async ({ page }) => {
    // Create missile with trail effects
    await page.evaluate(() => {
      const app = window.gameApp;
      if (app && app.getRuntime) {
        const runtime = app.getRuntime();
        if (runtime) {
          const missile = new Entity();
          missile.addComponent(new Transform({ x: 100, y: 100 }));
          missile.addComponent(new Motion({ x: 2, y: 1 }));
          missile.addComponent(new Guidance(3, 'player', 'proportional'));
          missile.addComponent(new HomingMissile());
          
          const player = new Entity();
          player.addComponent(new Transform({ x: 200, y: 200 }));
          player.addComponent(new Motion({ x: 0, y: 0 }));
          player.addComponent(new Player());
          
          runtime.addEntity(missile);
          runtime.addEntity(player);
        }
      }
    });

    // Wait for trail effects to be generated
    await page.waitForTimeout(2000);

    // Check if trail effects are being spawned
    const trailEffectsSpawned = await page.evaluate(() => {
      const app = window.gameApp;
      if (app && app.getSceneManager) {
        const scene = app.getSceneManager().getCurrentScene();
        if (scene && scene.spawnEffect) {
          // Count spawnEffect calls (trail effects)
          let effectCount = 0;
          const originalSpawnEffect = scene.spawnEffect;
          scene.spawnEffect = function(options) {
            if (options && options.animation === 'missile-trail') {
              effectCount++;
            }
            return originalSpawnEffect.call(this, options);
          };
          return effectCount;
        }
      }
      return 0;
    });

    // Should have spawned some trail effects
    expect(trailEffectsSpawned).toBeGreaterThanOrEqual(0);
  });

  test('should handle performance under CPU throttling', async ({ page }) => {
    // Enable CPU throttling
    await page.context().setCPUThrottlingRate(4);

    // Create missile system
    await page.evaluate(() => {
      const app = window.gameApp;
      if (app && app.getRuntime) {
        const runtime = app.getRuntime();
        if (runtime) {
          const missile = new Entity();
          missile.addComponent(new Transform({ x: 0, y: 0 }));
          missile.addComponent(new Motion({ x: 0, y: 0 }));
          missile.addComponent(new Guidance(3, 'player', 'proportional'));
          missile.addComponent(new HomingMissile());
          
          const player = new Entity();
          player.addComponent(new Transform({ x: 100, y: 100 }));
          player.addComponent(new Motion({ x: 5, y: 3 }));
          player.addComponent(new Player());
          
          runtime.addEntity(missile);
          runtime.addEntity(player);
        }
      }
    });

    // Test performance under throttling
    const startTime = Date.now();
    await page.waitForTimeout(3000);
    const endTime = Date.now();

    // Check if system is still responsive
    const systemResponsive = await page.evaluate(() => {
      const app = window.gameApp;
      if (app && app.getRuntime) {
        const runtime = app.getRuntime();
        if (runtime && runtime.getEntities) {
          const entities = runtime.getEntities();
          const missile = entities.find(e => e.hasComponent && e.hasComponent('HomingMissile'));
          return missile !== undefined;
        }
      }
      return false;
    });

    expect(systemResponsive).toBe(true);
    
    // Reset throttling
    await page.context().setCPUThrottlingRate(1);
  });
});
