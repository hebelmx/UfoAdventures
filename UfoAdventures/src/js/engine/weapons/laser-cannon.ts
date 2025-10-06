import { WeaponBase, type WeaponDefinitionExtras } from '../weapon-service';

export class LaserCannonStrategy extends WeaponBase {
    private _chargeTime: number = 0;
    private _isCharging: boolean = false;
    private _chargeRequired: number = 1.0; // 1 second charge time

    fire({ definition }: { shooter: any; transform: any; weapon: any; definition: WeaponDefinitionExtras }) {
        const heatPerShot = definition.heatPerShot || 15;
        const maxHeat = definition.maxHeat || 100;
        const chargeTime = definition.chargeTime || 1.0;

        // Check if weapon can fire (heat management)
        if (!this._canFire(definition)) {
            return []; // Return empty array if overheated
        }

        // Start charging if not already charging
        if (!this._isCharging) {
            this._isCharging = true;
            this._chargeTime = 0;
            this._chargeRequired = chargeTime;
            return []; // No projectile on first frame
        }

        // Continue charging
        this._chargeTime += 0.016; // Assuming 60 FPS (1/60 = 0.016)

        // Check if fully charged
        if (this._chargeTime >= this._chargeRequired) {
            this._isCharging = false;
            this._chargeTime = 0;

            // Add heat for firing
            this._addHeat(heatPerShot, maxHeat);

            const base = (definition.projectiles && definition.projectiles[0]) || { 
                type: 'player', 
                speed: 25, 
                damage: 8,
                tint: 0xff0000, // Red laser
                scale: 1.5
            };

            // Laser is highly accurate
            const accuracy = Math.max(0, definition.accuracyDegrees ?? 0.5);
            const projectile = { ...base };
            const shot = this._applyAccuracy(projectile, accuracy);

            return [shot];
        }

        return []; // Still charging
    }

    // Check if weapon can fire (considering charge state)
    protected _canFire(definition: WeaponDefinitionExtras): boolean {
        if (this._isCharging) {
            return true; // Can continue charging
        }
        
        return super._canFire(definition);
    }

    // Get charge progress (0-1)
    getChargeProgress(): number {
        if (!this._isCharging) {
            return 0;
        }
        return Math.min(1, this._chargeTime / this._chargeRequired);
    }

    // Check if weapon is charging
    isCharging(): boolean {
        return this._isCharging;
    }
}
