import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ShootingSystem } from '../../src/js/engine/systems';
import { ServiceLocator } from '../../src/js/engine/service-locator';
import { EventBus } from '../../src/js/engine/event-bus';
import { WeaponBase, WeaponService, type WeaponDefinitionExtras } from '../../src/js/engine/weapon-service';
import { Entity } from '../../src/js/engine/core';
import { Transform, Weapon, Motion } from '../../src/js/engine/components';

class TestStrategy extends WeaponBase {
    fire({ definition }: { shooter: any; transform: any; weapon: any; definition: WeaponDefinitionExtras }) {
        const base = definition.projectiles?.[0] || { type: 'player', speed: 10, damage: 1 };
        return [{ ...base }, { ...base }];
    }
}

describe('ShootingSystem with strategy', () => {
    let services: ServiceLocator;
    let bus: EventBus;
    let weaponService: WeaponService;
    let game: any;
    let system: ShootingSystem;

    beforeEach(() => {
        services = new ServiceLocator();
        bus = new EventBus();
        weaponService = new WeaponService();
        weaponService.configure({ 'player-blaster': { cooldown: 0.01, projectiles: [{ type: 'player', speed: 10, damage: 1 }] } });
        weaponService.registerWeaponType('player-blaster', TestStrategy);
        services.register('weaponService', weaponService);
        game = { app: { renderer: { screen: { width: 800, height: 600 } } }, spawnProjectile: vi.fn(() => new Entity()) };
        system = new ShootingSystem(game as any, services, bus);
    });

    it('uses strategy to spawn multiple shots', () => {
        const e = new Entity();
        e.addComponent(new Transform({ x: 0, y: 0 }));
        e.addComponent(new Motion({ x: 0, y: 0 }));
        const w = e.addComponent(new Weapon({ weaponId: 'player-blaster', cooldown: 0.01 }));
        w.isShooting = true;
        system.update([e] as any, 60);
        expect((game.spawnProjectile as any).mock.calls.length).toBeGreaterThanOrEqual(2);
    });
});


