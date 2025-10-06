import { describe, expect, it, vi } from 'vitest';
import { CyborgLimbSystem } from '../../src/js/engine/systems';
import { Entity } from '../../src/js/engine/core';
import { CyborgLimb, Health, Motion, Transform } from '../../src/js/engine/components';

describe('CyborgLimbSystem', () => {
    it('detaches limb when health drops below threshold and emits effect', () => {
        const game = { app: { renderer: { screen: { width: 800, height: 600 } } }, spawnEffect: vi.fn(() => null) } as any;
        const system = new CyborgLimbSystem(game, { resolve: vi.fn(() => ({ emit: vi.fn(), on: vi.fn() })) } as any);

        const limb = new Entity();
        limb.addComponent(new Transform({ x: 10, y: 10 }));
        const c = limb.addComponent(new CyborgLimb());
        c.maxHealth = 100;
        c.health = 100;
        limb.addComponent(new Health(30)); // <= 30 triggers detach (30% of 100)
        limb.addComponent(new Motion({ x: 0, y: 0 }));

        system.update([limb] as any, 1);
        expect(c.isAttached).toBe(false);
        expect(game.spawnEffect).toHaveBeenCalled();
    });
});


