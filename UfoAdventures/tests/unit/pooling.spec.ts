import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as PIXI from 'pixi.js';
import { GameplayRuntime } from '../../src/js/gameplay-runtime';
import { ServiceLocator } from '../../src/js/engine/service-locator';
import { EventBus } from '../../src/js/engine/event-bus';

function createRuntime(): GameplayRuntime {
    const stage = new PIXI.Container();
    const app = {
        stage,
        screen: new PIXI.Rectangle(0, 0, 800, 600),
        renderer: {
            width: 800,
            height: 600,
            screen: new PIXI.Rectangle(0, 0, 800, 600)
        },
        ticker: { add: () => {}, remove: () => {}, deltaMS: 16.67 }
    } as unknown as PIXI.Application;

    const services = new ServiceLocator();
    services.register('eventBus', new EventBus());

    return new GameplayRuntime(app, services);
}

describe('GameplayRuntime pooling', () => {
    let runtime: GameplayRuntime;

    beforeEach(() => {
        vi.spyOn(PIXI.Assets, 'get').mockReturnValue(PIXI.Texture.WHITE);
        runtime = createRuntime();
        runtime.start('adventure', {});
    });

    afterEach(() => {
        runtime.stop();
        vi.restoreAllMocks();
    });

    it('reuses effect entities after their lifetime expires', () => {
        const first = runtime.spawnEffect({ lifeTime: 0.05, fade: 1 });
        expect(first).toBeTruthy();

        // Run a few frames to expire the effect and allow cleanup to release it to the pool
        runtime.update(6); // ~0.1 seconds
        runtime.update(6);

        const second = runtime.spawnEffect({ lifeTime: 0.05 });
        expect(second).toBe(first);
    });

    it('returns projectiles to the pool when removed manually', () => {
        const projectile = runtime.spawnProjectile({
            type: 'player',
            position: { x: 10, y: 10 },
            velocity: { x: 0, y: -12 },
            damage: 10
        });

        expect(projectile).toBeTruthy();
        runtime.removeEntity(projectile!);

        const recycled = runtime.spawnProjectile({
            type: 'player',
            position: { x: 10, y: 20 },
            velocity: { x: 0, y: -12 }
        });

        expect(recycled).toBe(projectile);
    });
});
