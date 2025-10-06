import { describe, expect, it } from 'vitest';
import { WeaponBase, WeaponService, type WeaponDefinitionExtras } from '../../src/js/engine/weapon-service';

class TestBlaster extends WeaponBase {
    fire({ definition }: { shooter: any; transform: any; weapon: any; definition: WeaponDefinitionExtras }) {
        const volley = Math.max(1, definition.volley ?? 1);
        const base = definition.projectiles?.[0] || { type: 'player', speed: 10, damage: 1 };
        return Array.from({ length: volley }).map(() => ({ ...base }));
    }
}

describe('Weapon factory', () => {
    it('registers and creates strategy, fires volley count', () => {
        const svc = new WeaponService();
        svc.configure({ 'player-blaster': { cooldown: 0.2, projectiles: [{ type: 'player', speed: 12, damage: 2 }], volley: 3 } as any });
        svc.registerWeaponType('player-blaster', TestBlaster);
        const strategy = svc.createStrategy('player-blaster');
        expect(strategy).not.toBeNull();
        const def = svc.get('player-blaster') as WeaponDefinitionExtras;
        const result = strategy!.fire({ shooter: {}, transform: {}, weapon: {}, definition: def });
        expect(result.length).toBe(3);
        expect(result[0].type).toBe('player');
    });
});


