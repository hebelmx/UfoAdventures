import { WeaponBase, type WeaponDefinitionExtras } from '../weapon-service';

export class PlayerBlasterStrategy extends WeaponBase {
    fire({ definition }: { shooter: any; transform: any; weapon: any; definition: WeaponDefinitionExtras }) {
        const volley = Math.max(1, definition.volley ?? 1);
        const base = (definition.projectiles && definition.projectiles[0]) || { type: 'player', speed: 12, damage: 2 };
        const accuracy = Math.max(0, definition.accuracyDegrees ?? 0);
        const toRad = (deg: number) => (deg * Math.PI) / 180;

        const shots = Array.from({ length: volley }).map((_, i) => {
            const jitterDeg = accuracy > 0 ? (Math.random() * 2 - 1) * accuracy : 0;
            const angle = toRad(jitterDeg);
            // Apply simple rotation to base velocity dy
            const speed = (base as any).speed ?? 12;
            const vx = Math.sin(angle) * speed * 0.5; // small horizontal spread
            const vy = -Math.cos(angle) * speed;
            return { ...base, dx: vx, dy: vy } as any;
        });

        return shots;
    }
}


