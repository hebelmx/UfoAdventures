import { describe, expect, it, vi } from 'vitest';
import { MagicSystem } from '../../src/js/engine/magic-system';
import { EventBus } from '../../src/js/engine/event-bus';
import { Entity } from '../../src/js/engine/core';
import { MagicInventory, PlayerAbilities, Transform } from '../../src/js/engine/components';

describe('MagicSystem', () => {
    it('casts shield when queued and consumes mana', () => {
        const game = { spawnEffect: vi.fn(() => null) } as any;
        const bus = new EventBus();
        const sys = new MagicSystem(game, bus);
        const e = new Entity();
        e.addComponent(new Transform({ x: 10, y: 10 }));
        e.addComponent(new MagicInventory(100));
        const abilities = e.addComponent(new PlayerAbilities({ shieldDuration: 1, shieldStrength: 20 }));
        abilities.states['shield'].queued = true;

        sys.update([e] as any, 60);
        expect(abilities.states['shield'].active).toBe(true);
        expect(game.spawnEffect).toHaveBeenCalled();
    });
});


