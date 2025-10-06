import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TarakBossSystem } from '../../src/js/engine/systems';
import { Entity } from '../../src/js/engine/core';
import { Transform, Motion, Boss, BossPhase, Health } from '../../src/js/engine/components';
import type { CombatGameContext } from '../../src/js/engine/combat-types';

describe('TarakBossSystem', () => {
    let system: TarakBossSystem;
    let mockGame: CombatGameContext;
    let mockEventBus: any;

    beforeEach(() => {
        mockEventBus = {
            emit: vi.fn()
        };

        mockGame = {
            app: {
                renderer: { screen: { width: 800, height: 600 } }
            },
            spawnEffect: vi.fn(),
            addEntity: vi.fn()
        } as any;

        system = new TarakBossSystem(mockGame, {
            resolve: vi.fn(() => mockEventBus)
        } as any);
    });

    it('should initialize correctly', () => {
        expect(system).toBeDefined();
    });

    it('should transition to beta phase when health drops below 60%', () => {
        const boss = new Entity();
        boss.addComponent(new Transform({ x: 400, y: 100 }));
        boss.addComponent(new Motion({ x: 0, y: 0 }));
        const health = boss.addComponent(new Health(500));
        health.health = 250; // 50% health
        const bossPhase = boss.addComponent(new BossPhase([], 500));
        bossPhase.currentPhase = 0;
        boss.addComponent(new Boss());

        const entities = [boss];
        system.update(entities, 1);

        expect(bossPhase.currentPhase).toBe(1);
        expect(mockEventBus.emit).toHaveBeenCalledWith('boss:phase-transition', {
            entity: boss,
            phase: 1,
            message: 'Tarak grows furious!'
        });
    });

    it('should transition to gamma phase when health drops below 30%', () => {
        const boss = new Entity();
        boss.addComponent(new Transform({ x: 400, y: 100 }));
        boss.addComponent(new Motion({ x: 0, y: 0 }));
        const health = boss.addComponent(new Health(500));
        health.health = 100; // 20% health
        const bossPhase = boss.addComponent(new BossPhase([], 500));
        bossPhase.currentPhase = 0;
        boss.addComponent(new Boss());

        const entities = [boss];
        system.update(entities, 1);

        expect(bossPhase.currentPhase).toBe(2);
        expect(mockEventBus.emit).toHaveBeenCalledWith('boss:phase-transition', {
            entity: boss,
            phase: 2,
            message: 'Tarak unleashes chaos!'
        });
    });

    it('should not transition if already in the target phase', () => {
        const boss = new Entity();
        boss.addComponent(new Transform({ x: 400, y: 100 }));
        boss.addComponent(new Motion({ x: 0, y: 0 }));
        const health = boss.addComponent(new Health(500));
        health.health = 250; // 50% health
        const bossPhase = boss.addComponent(new BossPhase([], 500));
        bossPhase.currentPhase = 1; // Already in beta phase
        boss.addComponent(new Boss());

        const entities = [boss];
        system.update(entities, 1);

        expect(bossPhase.currentPhase).toBe(1); // Should remain unchanged
        expect(mockEventBus.emit).not.toHaveBeenCalled();
    });

    it('should apply alpha phase movement pattern', () => {
        const boss = new Entity();
        boss.addComponent(new Transform({ x: 400, y: 100 }));
        const motion = boss.addComponent(new Motion({ x: 0, y: 0 }));
        const health = boss.addComponent(new Health(500));
        const bossPhase = boss.addComponent(new BossPhase([], 500));
        bossPhase.currentPhase = 0; // Alpha phase
        boss.addComponent(new Boss());

        const entities = [boss];
        system.update(entities, 60); // 1 second

        // Should have some movement
        expect(motion.velocity.x).not.toBe(0);
        expect(motion.velocity.y).not.toBe(0);
    });

    it('should apply beta phase movement pattern', () => {
        const boss = new Entity();
        boss.addComponent(new Transform({ x: 400, y: 100 }));
        const motion = boss.addComponent(new Motion({ x: 0, y: 0 }));
        const health = boss.addComponent(new Health(500));
        const bossPhase = boss.addComponent(new BossPhase([], 500));
        bossPhase.currentPhase = 1; // Beta phase
        boss.addComponent(new Boss());

        const entities = [boss];
        system.update(entities, 60); // 1 second

        // Should have more aggressive movement
        expect(motion.velocity.x).not.toBe(0);
        expect(motion.velocity.y).not.toBe(0);
    });

    it('should apply gamma phase movement pattern', () => {
        const boss = new Entity();
        boss.addComponent(new Transform({ x: 400, y: 100 }));
        const motion = boss.addComponent(new Motion({ x: 0, y: 0 }));
        const health = boss.addComponent(new Health(500));
        const bossPhase = boss.addComponent(new BossPhase([], 500));
        bossPhase.currentPhase = 2; // Gamma phase
        boss.addComponent(new Boss());

        const entities = [boss];
        system.update(entities, 60); // 1 second

        // Should have chaotic movement
        expect(motion.velocity.x).not.toBe(0);
        expect(motion.velocity.y).not.toBe(0);
    });

    it('should summon reinforcements in beta phase', () => {
        const boss = new Entity();
        boss.addComponent(new Transform({ x: 400, y: 100 }));
        boss.addComponent(new Motion({ x: 0, y: 0 }));
        const health = boss.addComponent(new Health(500));
        const bossPhase = boss.addComponent(new BossPhase([], 500));
        bossPhase.currentPhase = 1; // Beta phase
        boss.addComponent(new Boss());

        // Mock random to trigger summon
        const originalRandom = Math.random;
        Math.random = vi.fn(() => 0.05); // Low value to trigger summon

        const entities = [boss];
        
        // Run multiple updates to trigger summon
        for (let i = 0; i < 200; i++) {
            system.update(entities, 1);
        }

        // Should have summoned reinforcements
        expect(mockGame.addEntity).toHaveBeenCalled();
        expect(mockGame.spawnEffect).toHaveBeenCalledWith(
            expect.objectContaining({
                atlasAlias: 'vfx-atlas',
                animation: 'summon-reinforcements'
            })
        );

        Math.random = originalRandom;
    });

    it('should create energy spikes in gamma phase', () => {
        const boss = new Entity();
        boss.addComponent(new Transform({ x: 400, y: 100 }));
        boss.addComponent(new Motion({ x: 0, y: 0 }));
        const health = boss.addComponent(new Health(500));
        const bossPhase = boss.addComponent(new BossPhase([], 500));
        bossPhase.currentPhase = 2; // Gamma phase
        boss.addComponent(new Boss());

        // Mock random to trigger energy spikes
        const originalRandom = Math.random;
        Math.random = vi.fn(() => 0.1); // Low value to trigger spikes

        const entities = [boss];
        
        // Run multiple updates to trigger spikes
        for (let i = 0; i < 150; i++) {
            system.update(entities, 1);
        }

        // Should have created energy spikes
        expect(mockGame.addEntity).toHaveBeenCalled();
        expect(mockGame.spawnEffect).toHaveBeenCalledWith(
            expect.objectContaining({
                atlasAlias: 'vfx-atlas',
                animation: 'energy-spike-warning'
            })
        );

        Math.random = originalRandom;
    });

    it('should add phase transition effects', () => {
        const boss = new Entity();
        boss.addComponent(new Transform({ x: 400, y: 100 }));
        boss.addComponent(new Motion({ x: 0, y: 0 }));
        const health = boss.addComponent(new Health(500));
        health.health = 250; // 50% health
        const bossPhase = boss.addComponent(new BossPhase([], 500));
        bossPhase.currentPhase = 0;
        boss.addComponent(new Boss());

        const entities = [boss];
        system.update(entities, 1);

        // Should have spawned phase transition effect
        expect(mockGame.spawnEffect).toHaveBeenCalledWith(
            expect.objectContaining({
                alpha: 1.0,
                scale: 4.0,
                tint: 0xff0000,
                atlasAlias: 'vfx-atlas',
                animation: 'phase-transition'
            })
        );
    });

    it('should ignore entities without boss components', () => {
        const regularEntity = new Entity();
        regularEntity.addComponent(new Transform({ x: 400, y: 100 }));
        regularEntity.addComponent(new Motion({ x: 0, y: 0 }));

        const entities = [regularEntity];
        system.update(entities, 1);

        // Should not emit any events or spawn effects
        expect(mockEventBus.emit).not.toHaveBeenCalled();
        expect(mockGame.spawnEffect).not.toHaveBeenCalled();
    });
});
