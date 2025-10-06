import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BossAISystem } from '../../src/js/engine/systems';
import { Entity } from '../../src/js/engine/core';
import { Boss, BossPhase, Health, Motion, Transform } from '../../src/js/engine/components';
import type { BossConfig } from '../../src/js/engine/combat-types';
import { ServiceLocator } from '../../src/js/engine/service-locator';

describe('BossAISystem telegraph and phase change', () => {
    let services: ServiceLocator;
    let uiService: { showMessage: ReturnType<typeof vi.fn> };
    let eventBus: { emit: ReturnType<typeof vi.fn> };
    let game: any;
    let system: BossAISystem;

    beforeEach(() => {
        services = new ServiceLocator();
        uiService = { showMessage: vi.fn() } as any;
        eventBus = { emit: vi.fn(), on: vi.fn() } as any;
        services.register('eventBus', eventBus as any);

        game = {
            services,
            app: { renderer: { screen: { width: 800, height: 600 } } },
            spawnEffect: vi.fn(() => null)
        };

        system = new BossAISystem(game, uiService as any);
    });

    it('emits telegraph and phase change, and spawns telegraph effect', () => {
        const boss = new Entity();
        boss.addComponent(new Transform({ x: 400, y: 100 }));
        boss.addComponent(new Motion({ x: 0, y: 0 }));
        boss.addComponent(new Boss());
        const health = boss.addComponent(new Health(500));
        // Arrange thresholds so the first phase doesn't match, second does
        const phases = [
            { threshold: 0.1 },
            { threshold: 0.5, message: 'Phase 2', telegraphEffect: { atlasAlias: 'vfx-atlas', animation: 'beam_attack', animationSpeed: 0.5 } }
        ];
        boss.addComponent(new BossPhase(phases as any, 500));

        // Set health for ratio 0.4 so i=1 matches (0.5) and triggers change
        health.health = 200;

        system.update([boss] as any, 1);

        // ui message is optional; assert event and effect always
        expect(game.spawnEffect).toHaveBeenCalled();
        expect((eventBus.emit as any).mock.calls.some((c: any[]) => c[0] === 'boss:telegraph')).toBe(true);
        expect((eventBus.emit as any).mock.calls.some((c: any[]) => c[0] === 'boss:phase-change')).toBe(true);
    });
});


