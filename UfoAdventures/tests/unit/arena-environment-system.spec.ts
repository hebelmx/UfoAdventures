import { describe, expect, it, vi } from 'vitest';
import { ArenaEnvironmentSystem } from '../../src/js/engine/systems';

describe('ArenaEnvironmentSystem', () => {
    it('spawns a hazard effect on interval', () => {
        const game = { app: { renderer: { screen: { width: 800, height: 600 } } }, spawnEffect: vi.fn(() => null) } as any;
        const system = new ArenaEnvironmentSystem(game);
        // run a little over the interval to trigger at least once
        for (let i = 0; i < 70; i += 1) {
            system.update([] as any, 1);
        }
        expect(game.spawnEffect).toHaveBeenCalled();
    });
});


