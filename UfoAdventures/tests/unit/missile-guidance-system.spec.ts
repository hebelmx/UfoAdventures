import { beforeEach, describe, expect, it } from 'vitest';
import { MissileGuidanceSystem } from '../../src/js/engine/systems';
import { Entity } from '../../src/js/engine/core';
import { Enemy, Guidance, HomingMissile, Motion, Transform } from '../../src/js/engine/components';
import { Player } from '../../src/js/entities/player';

describe('MissileGuidanceSystem', () => {
    let system: MissileGuidanceSystem;

    beforeEach(() => {
        system = new MissileGuidanceSystem({} as any);
    });

    it('nudges missile velocity towards a moving target', () => {
        const player = new Entity();
        player.addComponent(new Transform({ x: 100, y: 0 }));
        player.addComponent(new Motion({ x: 0, y: 1 }));
        player.addComponent(new Player());

        const enemy = new Entity();
        enemy.addComponent(new Enemy());
        enemy.addComponent(new Transform({ x: 50, y: 0 }));
        enemy.addComponent(new Motion({ x: 0, y: 0 }));

        const missile = new Entity();
        missile.addComponent(new HomingMissile());
        missile.addComponent(new Guidance(3, 'player'));
        const m = missile.addComponent(new Motion({ x: 1, y: 0 }));
        missile.addComponent(new Transform({ x: 0, y: 0 }));

        const entities = [player, enemy, missile];
        // Run multiple small ticks to integrate acceleration
        for (let i = 0; i < 20; i += 1) {
            system.update(entities as any, 6); // 6 frames ~ 0.1s
        }
        expect(m.velocity.y).not.toBe(0);
    });
});


