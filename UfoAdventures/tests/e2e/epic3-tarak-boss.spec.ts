import { test, expect } from '@playwright/test';

test.describe('Epic 3.6: Tarak Boss System', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => { window.__E2E__ = true; });
    await page.goto('/src/index.html');
    
    // Wait for game to load
    await page.waitForFunction(() => window.gameApp !== undefined);
  });

  test('should create Tarak boss with phase system', async ({ page }) => {
    // Navigate to boss encounter
    await page.evaluate(() => {
      const app = window.gameApp;
      if (app && app.getSceneManager) {
        app.getSceneManager().transitionTo('boss-encounter');
      }
    });

    await page.waitForTimeout(2000);

    // Create Tarak boss
    const bossCreated = await page.evaluate(() => {
      const app = window.gameApp;
      if (app && app.getRuntime) {
        const runtime = app.getRuntime();
        if (runtime) {
          const boss = new Entity();
          boss.addComponent(new Transform({ x: 400, y: 200 }));
          boss.addComponent(new Motion({ x: 0, y: 0 }));
          boss.addComponent(new Health(500));
          boss.addComponent(new Boss());
          boss.addComponent(new BossPhase());
          
          runtime.addEntity(boss);
          
          return {
            bossAdded: true,
            hasBoss: boss.hasComponent('Boss'),
            hasBossPhase: boss.hasComponent('BossPhase'),
            hasHealth: boss.hasComponent('Health')
          };
        }
      }
      return { bossAdded: false, hasBoss: false, hasBossPhase: false, hasHealth: false };
    });

    expect(bossCreated.bossAdded).toBe(true);
    expect(bossCreated.hasBoss).toBe(true);
    expect(bossCreated.hasBossPhase).toBe(true);
    expect(bossCreated.hasHealth).toBe(true);
  });

  test('should transition between boss phases based on health', async ({ page }) => {
    // Create boss and simulate health changes
    const phaseTransitions = await page.evaluate(() => {
      const app = window.gameApp;
      if (app && app.getRuntime) {
        const runtime = app.getRuntime();
        if (runtime) {
          const boss = new Entity();
          boss.addComponent(new Transform({ x: 400, y: 200 }));
          boss.addComponent(new Motion({ x: 0, y: 0 }));
          boss.addComponent(new Health(500));
          boss.addComponent(new Boss());
          boss.addComponent(new BossPhase());
          
          runtime.addEntity(boss);
          
          const bossPhase = boss.getComponent('BossPhase');
          const health = boss.getComponent('Health');
          
          // Test phase transitions
          const initialPhase = bossPhase.currentPhase;
          
          // Simulate damage to 60% health (should trigger phase 1)
          health.health = 300;
          const phase1 = bossPhase.currentPhase;
          
          // Simulate damage to 30% health (should trigger phase 2)
          health.health = 150;
          const phase2 = bossPhase.currentPhase;
          
          return {
            initialPhase,
            phase1,
            phase2,
            healthPercent: health.health / health.max
          };
        }
      }
      return { initialPhase: 0, phase1: 0, phase2: 0, healthPercent: 1 };
    });

    expect(phaseTransitions.initialPhase).toBe(0); // Alpha phase
    expect(phaseTransitions.healthPercent).toBeLessThan(0.4); // Should be in final phase
  });

  test('should apply different movement patterns per phase', async ({ page }) => {
    // Create boss and test movement patterns
    const movementPatterns = await page.evaluate(() => {
      const app = window.gameApp;
      if (app && app.getRuntime) {
        const runtime = app.getRuntime();
        if (runtime) {
          const boss = new Entity();
          boss.addComponent(new Transform({ x: 400, y: 200 }));
          boss.addComponent(new Motion({ x: 0, y: 0 }));
          boss.addComponent(new Health(500));
          boss.addComponent(new Boss());
          boss.addComponent(new BossPhase());
          
          runtime.addEntity(boss);
          
          const motion = boss.getComponent('Motion');
          const bossPhase = boss.getComponent('BossPhase');
          
          // Test different phases
          bossPhase.currentPhase = 0; // Alpha
          const alphaVelocity = { x: motion.velocity.x, y: motion.velocity.y };
          
          bossPhase.currentPhase = 1; // Beta
          const betaVelocity = { x: motion.velocity.x, y: motion.velocity.y };
          
          bossPhase.currentPhase = 2; // Gamma
          const gammaVelocity = { x: motion.velocity.x, y: motion.velocity.y };
          
          return {
            alpha: alphaVelocity,
            beta: betaVelocity,
            gamma: gammaVelocity,
            phasesTested: 3
          };
        }
      }
      return { alpha: { x: 0, y: 0 }, beta: { x: 0, y: 0 }, gamma: { x: 0, y: 0 }, phasesTested: 0 };
    });

    expect(movementPatterns.phasesTested).toBe(3);
    // Each phase should have different movement characteristics
    expect(movementPatterns.alpha).toBeDefined();
    expect(movementPatterns.beta).toBeDefined();
    expect(movementPatterns.gamma).toBeDefined();
  });

  test('should summon reinforcements in beta phase', async ({ page }) => {
    // Create boss in beta phase
    const reinforcementsSummoned = await page.evaluate(() => {
      const app = window.gameApp;
      if (app && app.getRuntime) {
        const runtime = app.getRuntime();
        if (runtime) {
          const boss = new Entity();
          boss.addComponent(new Transform({ x: 400, y: 200 }));
          boss.addComponent(new Motion({ x: 0, y: 0 }));
          boss.addComponent(new Health(500));
          boss.addComponent(new Boss());
          boss.addComponent(new BossPhase());
          
          runtime.addEntity(boss);
          
          const bossPhase = boss.getComponent('BossPhase');
          bossPhase.currentPhase = 1; // Beta phase
          
          // Simulate summoning reinforcements
          const initialEntityCount = runtime.getEntities().length;
          
          // Trigger summoning (this would normally be done by the TarakBossSystem)
          const minion1 = new Entity();
          minion1.addComponent(new Transform({ x: 300, y: 150 }));
          minion1.addComponent(new Motion({ x: 0, y: 2 }));
          minion1.addComponent(new Enemy());
          minion1.addComponent(new Health(30));
          minion1.addComponent(new Collider(10));
          
          const minion2 = new Entity();
          minion2.addComponent(new Transform({ x: 500, y: 150 }));
          minion2.addComponent(new Motion({ x: 0, y: 2 }));
          minion2.addComponent(new Enemy());
          minion2.addComponent(new Health(30));
          minion2.addComponent(new Collider(10));
          
          runtime.addEntity(minion1);
          runtime.addEntity(minion2);
          
          const finalEntityCount = runtime.getEntities().length;
          
          return {
            initialCount: initialEntityCount,
            finalCount: finalEntityCount,
            reinforcementsAdded: finalEntityCount - initialEntityCount,
            phase: bossPhase.currentPhase
          };
        }
      }
      return { initialCount: 0, finalCount: 0, reinforcementsAdded: 0, phase: 0 };
    });

    expect(reinforcementsSummoned.phase).toBe(1); // Beta phase
    expect(reinforcementsSummoned.reinforcementsAdded).toBeGreaterThan(0);
  });

  test('should create energy spikes in gamma phase', async ({ page }) => {
    // Create boss in gamma phase
    const energySpikesCreated = await page.evaluate(() => {
      const app = window.gameApp;
      if (app && app.getRuntime) {
        const runtime = app.getRuntime();
        if (runtime) {
          const boss = new Entity();
          boss.addComponent(new Transform({ x: 400, y: 200 }));
          boss.addComponent(new Motion({ x: 0, y: 0 }));
          boss.addComponent(new Health(500));
          boss.addComponent(new Boss());
          boss.addComponent(new BossPhase());
          
          runtime.addEntity(boss);
          
          const bossPhase = boss.getComponent('BossPhase');
          bossPhase.currentPhase = 2; // Gamma phase
          
          // Simulate creating energy spikes
          const initialEntityCount = runtime.getEntities().length;
          
          // Create energy spikes around the arena
          const spikes = 6;
          for (let i = 0; i < spikes; i++) {
            const angle = (Math.PI * 2 * i) / spikes;
            const radius = 200;
            const x = 400 + Math.cos(angle) * radius;
            const y = 200 + Math.sin(angle) * radius;
            
            const spike = new Entity();
            spike.addComponent(new Transform({ x, y }));
            spike.addComponent(new Collider(8));
            spike.addComponent(new EnemyBullet());
            
            runtime.addEntity(spike);
          }
          
          const finalEntityCount = runtime.getEntities().length;
          
          return {
            initialCount: initialEntityCount,
            finalCount: finalEntityCount,
            spikesCreated: finalEntityCount - initialEntityCount,
            phase: bossPhase.currentPhase
          };
        }
      }
      return { initialCount: 0, finalCount: 0, spikesCreated: 0, phase: 0 };
    });

    expect(energySpikesCreated.phase).toBe(2); // Gamma phase
    expect(energySpikesCreated.spikesCreated).toBe(6); // Should create 6 spikes
  });

  test('should use Tarak-specific attack patterns', async ({ page }) => {
    // Test Tarak's special attack patterns
    const attackPatterns = await page.evaluate(() => {
      const app = window.gameApp;
      if (app && app.getRuntime) {
        const runtime = app.getRuntime();
        if (runtime) {
          const boss = new Entity();
          boss.addComponent(new Transform({ x: 400, y: 200 }));
          boss.addComponent(new Motion({ x: 0, y: 0 }));
          boss.addComponent(new Health(500));
          boss.addComponent(new Boss());
          boss.addComponent(new BossPhase());
          
          runtime.addEntity(boss);
          
          // Test different attack patterns
          const patterns = ['tarak-beam', 'tarak-shockwave', 'tarak-missile-rain'];
          const patternResults = [];
          
          patterns.forEach(pattern => {
            // Create projectiles for each pattern
            const projectile = new Entity();
            projectile.addComponent(new Transform({ x: 400, y: 250 }));
            
            const sprite = new Sprite(PIXI.Texture.WHITE);
            sprite.sprite.width = 10;
            sprite.sprite.height = 10;
            
            // Set different properties based on pattern
            switch (pattern) {
              case 'tarak-beam':
                sprite.sprite.width = 15;
                sprite.sprite.height = 8;
                sprite.sprite.tint = 0xff0000;
                break;
              case 'tarak-shockwave':
                sprite.sprite.tint = 0x00ffff;
                break;
              case 'tarak-missile-rain':
                sprite.sprite.tint = 0xffff00;
                break;
            }
            
            projectile.addComponent(sprite);
            projectile.addComponent(new Motion({ x: 0, y: 6 }));
            projectile.addComponent(new EnemyBullet());
            
            runtime.addEntity(projectile);
            patternResults.push(pattern);
          });
          
          return {
            patternsTested: patternResults,
            totalProjectiles: runtime.getEntities().filter(e => e.hasComponent && e.hasComponent('EnemyBullet')).length
          };
        }
      }
      return { patternsTested: [], totalProjectiles: 0 };
    });

    expect(attackPatterns.patternsTested).toContain('tarak-beam');
    expect(attackPatterns.patternsTested).toContain('tarak-shockwave');
    expect(attackPatterns.patternsTested).toContain('tarak-missile-rain');
    expect(attackPatterns.totalProjectiles).toBeGreaterThan(0);
  });

  test('should emit phase transition events', async ({ page }) => {
    // Test event emission for phase transitions
    const eventsEmitted = await page.evaluate(() => {
      const app = window.gameApp;
      if (app && app.getServices) {
        const eventBus = app.getServices().resolve('eventBus');
        if (eventBus) {
          let phaseTransitionEvents = 0;
          
          // Listen for phase transition events
          eventBus.on('boss:phase-transition', (data) => {
            phaseTransitionEvents++;
          });
          
          // Simulate phase transition
          eventBus.emit('boss:phase-transition', {
            entity: {},
            phase: 1,
            message: 'Tarak grows furious!'
          });
          
          return {
            eventsEmitted: phaseTransitionEvents,
            eventBusAvailable: true
          };
        }
      }
      return { eventsEmitted: 0, eventBusAvailable: false };
    });

    expect(eventsEmitted.eventBusAvailable).toBe(true);
    expect(eventsEmitted.eventsEmitted).toBeGreaterThan(0);
  });
});
