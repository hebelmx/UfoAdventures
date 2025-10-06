import { describe, expect, it } from 'vitest';
import { PlayerBlasterStrategy } from '../../src/js/engine/weapons/player-blaster.ts';

describe('PlayerBlasterStrategy', () => {
    it('produces volley with accuracy spread', () => {
        const strat = new PlayerBlasterStrategy();
        const def: any = { cooldown: 0.2, projectiles: [{ type: 'player', speed: 12, damage: 2 }], volley: 3, accuracyDegrees: 5 };
        const shots = strat.fire({ shooter: {}, transform: {}, weapon: {}, definition: def });
        expect(shots.length).toBe(3);
        // Expect presence of dx/dy on result
        expect(typeof (shots[0] as any).dx).toBe('number');
        expect(typeof (shots[0] as any).dy).toBe('number');
    });
});


