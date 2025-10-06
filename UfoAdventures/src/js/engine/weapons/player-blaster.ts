import { WeaponBase, type WeaponDefinitionExtras } from '../weapon-service';

export class PlayerBlasterStrategy extends WeaponBase {
    fire({ definition }: { shooter: any; transform: any; weapon: any; definition: WeaponDefinitionExtras }) {
        // Check if weapon can fire (heat management)
        if (!this._canFire(definition)) {
            return []; // Return empty array if overheated
        }

        const volley = Math.max(1, definition.volley ?? 1);
        const base = (definition.projectiles && definition.projectiles[0]) || { type: 'player', speed: 12, damage: 2 };
        const accuracy = Math.max(0, definition.accuracyDegrees ?? 0);
        const heatPerShot = definition.heatPerShot || 5;
        const maxHeat = definition.maxHeat || 100;

        // Add heat for firing
        this._addHeat(heatPerShot * volley, maxHeat);

        const shots = Array.from({ length: volley }).map((_, i) => {
            const projectile = { ...base };
            return this._applyAccuracy(projectile, accuracy);
        });

        return shots;
    }
}


