import { WeaponBase, type WeaponDefinitionExtras } from '../weapon-service';

export class BurstRifleStrategy extends WeaponBase {
    private _burstCount: number = 0;
    private _burstTimer: number = 0;
    private _isBursting: boolean = false;

    fire({ definition }: { shooter: any; transform: any; weapon: any; definition: WeaponDefinitionExtras }) {
        const burstCount = definition.burstCount || 3;
        const burstDelay = definition.burstDelay || 0.1;
        const heatPerShot = definition.heatPerShot || 8;
        const maxHeat = definition.maxHeat || 100;

        // Check if weapon can fire (heat management)
        if (!this._canFire(definition)) {
            return []; // Return empty array if overheated
        }

        // Start burst if not already bursting
        if (!this._isBursting) {
            this._isBursting = true;
            this._burstCount = 0;
            this._burstTimer = 0;
        }

        // Check burst timing - only for subsequent shots in burst
        if (this._isBursting && this._burstCount > 0) {
            const burstDelay = definition.burstDelay || 0.1;
            if (this._burstTimer < burstDelay) {
                return []; // Not ready for next shot in burst
            }
        }

        // Add heat for firing
        this._addHeat(heatPerShot, maxHeat);

        const base = (definition.projectiles && definition.projectiles[0]) || { type: 'player', speed: 15, damage: 3 };
        const accuracy = Math.max(0, definition.accuracyDegrees ?? 2);

        const projectile = { ...base };
        const shot = this._applyAccuracy(projectile, accuracy);

        this._burstCount++;
        this._burstTimer = 0; // Reset timer for next shot
        if (this._burstCount >= burstCount) {
            this._isBursting = false;
        }

        return [shot];
    }

    // Override to handle burst timing
    updateHeat(definition: WeaponDefinitionExtras, deltaTime: number): void {
        super.updateHeat(definition, deltaTime);
        
        if (this._isBursting) {
            this._burstTimer += deltaTime;
            const burstDelay = definition.burstDelay || 0.1;
            
            if (this._burstTimer >= burstDelay) {
                this._burstTimer = 0;
                // Allow next shot in burst
            }
        }
    }

    // Check if weapon can fire (considering burst state)
    protected _canFire(definition: WeaponDefinitionExtras): boolean {
        // First check heat management
        if (!super._canFire(definition)) {
            return false;
        }
        
        // Allow firing if not bursting, or if bursting and (first shot or timer is ready)
        if (this._isBursting) {
            const burstDelay = definition.burstDelay || 0.1;
            return this._burstCount === 0 || this._burstTimer >= burstDelay;
        }
        
        return true;
    }
}
