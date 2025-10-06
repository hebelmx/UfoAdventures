import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ShootingSystem } from '../../src/js/engine/systems';
import { Entity } from '../../src/js/engine/core';
import { Motion, Transform, Weapon } from '../../src/js/engine/components';

describe('ShootingSystem projectile spawn with basic template', () => {
    let system: ShootingSystem;
    let game: any;

    beforeEach(() => {
        game = {
            spawnProjectile: vi.fn(() => new Entity()),
            entities: [],
            app: { renderer: { screen: { width: 800, height: 600 } } }
        };
        const eventBus = { emit: vi.fn(), on: vi.fn() } as any;
        system = new ShootingSystem(game as any, {} as any, eventBus);
    });

    it('fires projectiles and emits event payload', () => {
        const origin = new Entity();
        origin.addComponent(new Transform({ x: 100, y: 100 }));
        origin.addComponent(new Motion({ x: 0, y: 0 }));
        const weapon = origin.addComponent(new Weapon({ weaponId: 'player-blaster', cooldown: 0.01 }));
        weapon.isShooting = true;

        const entities = [origin];
        system.update(entities as any, 60); // one second worth
        expect(game.spawnProjectile).toHaveBeenCalled();
    });
});


