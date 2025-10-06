import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MissileGuidanceSystem } from '../../src/js/engine/systems';
import { 
    ProportionalNavigationGuidance, 
    PurePursuitGuidance, 
    InterceptGuidance 
} from '../../src/js/engine/guidance';
import { Entity } from '../../src/js/engine/core';
import { Transform, Motion, Guidance, HomingMissile, Enemy } from '../../src/js/engine/components';
import { Player } from '../../src/js/entities/player';
import type { CombatGameContext } from '../../src/js/engine/combat-types';

describe('MissileGuidanceSystem', () => {
    let system: MissileGuidanceSystem;
    let mockGame: CombatGameContext;

    beforeEach(() => {
        mockGame = {
            spawnEffect: vi.fn()
        } as any;

        system = new MissileGuidanceSystem(mockGame);
    });

    it('should initialize with multiple guidance systems', () => {
        expect(system).toBeDefined();
        // The system should have initialized guidance systems
        expect(system['guidanceSystems'].size).toBeGreaterThan(0);
    });

    it('should update missile with proportional guidance', () => {
        const missile = new Entity();
        missile.addComponent(new Transform({ x: 0, y: 0 }));
        missile.addComponent(new Motion({ x: 0, y: 0 }));
        missile.addComponent(new Guidance(3, 'player', 'proportional'));
        missile.addComponent(new HomingMissile());

        const player = new Entity();
        player.addComponent(new Transform({ x: 100, y: 0 }));
        player.addComponent(new Motion({ x: 10, y: 5 })); // Moving target
        player.addComponent(new Player());

        const entities = [missile, player];
        
        // Run multiple updates to ensure guidance has time to work
        for (let i = 0; i < 10; i++) {
            system.update(entities, 1);
        }

        // Missile should have some velocity after guidance update
        const motion = missile.getComponent(Motion);
        // Check that the missile has some velocity (either X or Y)
        expect(motion?.velocity.x !== 0 || motion?.velocity.y !== 0).toBe(true);
    });

    it('should update missile with pure pursuit guidance', () => {
        const missile = new Entity();
        missile.addComponent(new Transform({ x: 0, y: 0 }));
        missile.addComponent(new Motion({ x: 0, y: 0 }));
        missile.addComponent(new Guidance(3, 'player', 'purePursuit'));
        missile.addComponent(new HomingMissile());

        const player = new Entity();
        player.addComponent(new Transform({ x: 100, y: 0 }));
        player.addComponent(new Motion({ x: 10, y: 0 })); // Moving target
        player.addComponent(new Player());

        const entities = [missile, player];
        system.update(entities, 1);

        const motion = missile.getComponent(Motion);
        expect(motion?.velocity.x).not.toBe(0);
    });

    it('should update missile with intercept guidance', () => {
        const missile = new Entity();
        missile.addComponent(new Transform({ x: 0, y: 0 }));
        missile.addComponent(new Motion({ x: 50, y: 0 }));
        missile.addComponent(new Guidance(3, 'player', 'intercept'));
        missile.addComponent(new HomingMissile());

        const player = new Entity();
        player.addComponent(new Transform({ x: 100, y: 0 }));
        player.addComponent(new Motion({ x: 20, y: 0 }));
        player.addComponent(new Player());

        const entities = [missile, player];
        system.update(entities, 1);

        const motion = missile.getComponent(Motion);
        expect(motion?.velocity.x).not.toBe(0);
    });

    it('should target enemies when configured', () => {
        const missile = new Entity();
        missile.addComponent(new Transform({ x: 0, y: 0 }));
        missile.addComponent(new Motion({ x: 0, y: 0 }));
        missile.addComponent(new Guidance(3, 'enemy', 'proportional'));
        missile.addComponent(new HomingMissile());

        const enemy = new Entity();
        enemy.addComponent(new Transform({ x: 50, y: 0 }));
        enemy.addComponent(new Motion({ x: 5, y: 3 })); // Moving enemy
        enemy.addComponent(new Enemy());

        const entities = [missile, enemy];
        
        // Run multiple updates to ensure guidance has time to work
        for (let i = 0; i < 10; i++) {
            system.update(entities, 1);
        }

        const motion = missile.getComponent(Motion);
        // Check that the missile has some velocity (either X or Y)
        expect(motion?.velocity.x !== 0 || motion?.velocity.y !== 0).toBe(true);
    });

    it('should add trail effects to missiles', () => {
        const missile = new Entity();
        missile.addComponent(new Transform({ x: 0, y: 0 }));
        missile.addComponent(new Motion({ x: 0, y: 0 }));
        missile.addComponent(new Guidance(3, 'player', 'proportional'));
        missile.addComponent(new HomingMissile());

        const player = new Entity();
        player.addComponent(new Transform({ x: 100, y: 0 }));
        player.addComponent(new Motion({ x: 0, y: 0 }));
        player.addComponent(new Player());

        const entities = [missile, player];
        
        // Run multiple updates to increase chance of trail effect
        for (let i = 0; i < 10; i++) {
            system.update(entities, 1);
        }

        // Should have spawned some trail effects
        expect(mockGame.spawnEffect).toHaveBeenCalledWith(
            expect.objectContaining({
                atlasAlias: 'vfx-atlas',
                animation: 'missile-trail'
            })
        );
    });

    it('should handle missing target gracefully', () => {
        const missile = new Entity();
        missile.addComponent(new Transform({ x: 0, y: 0 }));
        missile.addComponent(new Motion({ x: 0, y: 0 }));
        missile.addComponent(new Guidance(3, 'player', 'proportional'));
        missile.addComponent(new HomingMissile());

        const entities = [missile]; // No target
        system.update(entities, 1);

        // Should not crash and missile should remain unchanged
        const motion = missile.getComponent(Motion);
        expect(motion?.velocity.x).toBe(0);
        expect(motion?.velocity.y).toBe(0);
    });

    it('should handle missing guidance component gracefully', () => {
        const missile = new Entity();
        missile.addComponent(new Transform({ x: 0, y: 0 }));
        missile.addComponent(new Motion({ x: 0, y: 0 }));
        missile.addComponent(new HomingMissile());
        // Missing Guidance component

        const player = new Entity();
        player.addComponent(new Transform({ x: 100, y: 0 }));
        player.addComponent(new Motion({ x: 0, y: 0 }));
        player.addComponent(new Player());

        const entities = [missile, player];
        system.update(entities, 1);

        // Should not crash
        const motion = missile.getComponent(Motion);
        expect(motion?.velocity.x).toBe(0);
        expect(motion?.velocity.y).toBe(0);
    });
});

describe('ProportionalNavigationGuidance', () => {
    let guidance: ProportionalNavigationGuidance;
    let missile: Entity;
    let target: Entity;

    beforeEach(() => {
        guidance = new ProportionalNavigationGuidance(3, 50);
        missile = new Entity();
        target = new Entity();
    });

    it('should calculate acceleration for stationary target', () => {
        missile.addComponent(new Transform({ x: 0, y: 0 }));
        missile.addComponent(new Motion({ x: 0, y: 0 }));
        target.addComponent(new Transform({ x: 100, y: 0 }));
        target.addComponent(new Motion({ x: 0, y: 0 }));

        const accel = guidance.update(missile, target, 1);
        expect(accel.x).toBeCloseTo(0, 5); // No perpendicular acceleration for direct approach
        expect(accel.y).toBeCloseTo(0, 5);
    });

    it('should calculate acceleration for moving target', () => {
        missile.addComponent(new Transform({ x: 0, y: 0 }));
        missile.addComponent(new Motion({ x: 0, y: 0 }));
        target.addComponent(new Transform({ x: 100, y: 0 }));
        target.addComponent(new Motion({ x: 0, y: 10 })); // Moving perpendicular

        const accel = guidance.update(missile, target, 1);
        expect(accel.x).not.toBe(0);
        expect(Math.abs(accel.y)).toBeLessThan(0.5); // Small y component due to numerical precision
    });

    it('should clamp acceleration to maximum', () => {
        guidance = new ProportionalNavigationGuidance(100, 10); // High gain, low max
        missile.addComponent(new Transform({ x: 0, y: 0 }));
        missile.addComponent(new Motion({ x: 0, y: 0 }));
        target.addComponent(new Transform({ x: 100, y: 0 }));
        target.addComponent(new Motion({ x: 0, y: 100 })); // Fast moving target

        const accel = guidance.update(missile, target, 1);
        const magnitude = Math.sqrt(accel.x * accel.x + accel.y * accel.y);
        expect(magnitude).toBeLessThanOrEqual(10);
    });
});

describe('PurePursuitGuidance', () => {
    let guidance: PurePursuitGuidance;
    let missile: Entity;
    let target: Entity;

    beforeEach(() => {
        guidance = new PurePursuitGuidance(1.0, 30);
        missile = new Entity();
        target = new Entity();
    });

    it('should predict target position', () => {
        missile.addComponent(new Transform({ x: 0, y: 0 }));
        missile.addComponent(new Motion({ x: 0, y: 0 }));
        target.addComponent(new Transform({ x: 100, y: 0 }));
        target.addComponent(new Motion({ x: 20, y: 0 })); // Moving target

        const accel = guidance.update(missile, target, 1);
        expect(accel.x).toBeGreaterThan(0); // Should accelerate towards predicted position
        expect(accel.y).toBe(0);
    });

    it('should limit desired speed', () => {
        guidance = new PurePursuitGuidance(0.1, 30); // Very short lookahead
        missile.addComponent(new Transform({ x: 0, y: 0 }));
        missile.addComponent(new Motion({ x: 0, y: 0 }));
        target.addComponent(new Transform({ x: 1000, y: 0 })); // Very far target
        target.addComponent(new Motion({ x: 0, y: 0 }));

        const accel = guidance.update(missile, target, 1);
        // Should not exceed maximum speed
        expect(Math.abs(accel.x)).toBeLessThanOrEqual(30);
    });
});

describe('InterceptGuidance', () => {
    let guidance: InterceptGuidance;
    let missile: Entity;
    let target: Entity;

    beforeEach(() => {
        guidance = new InterceptGuidance(40, 5);
        missile = new Entity();
        target = new Entity();
    });

    it('should calculate intercept point', () => {
        missile.addComponent(new Transform({ x: 0, y: 0 }));
        missile.addComponent(new Motion({ x: 50, y: 0 }));
        target.addComponent(new Transform({ x: 100, y: 0 }));
        target.addComponent(new Motion({ x: 20, y: 0 }));

        const accel = guidance.update(missile, target, 1);
        expect(accel.x).not.toBe(0);
        expect(accel.y).toBe(0);
    });

    it('should handle fast missile scenarios', () => {
        missile.addComponent(new Transform({ x: 0, y: 0 }));
        missile.addComponent(new Motion({ x: 200, y: 0 })); // Very fast missile
        target.addComponent(new Transform({ x: 100, y: 0 }));
        target.addComponent(new Motion({ x: 10, y: 0 }));

        const accel = guidance.update(missile, target, 1);
        // Should still produce reasonable acceleration
        expect(Math.abs(accel.x)).toBeLessThanOrEqual(40);
    });
});