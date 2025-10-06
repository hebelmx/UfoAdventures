export interface ProjectileDefinition {
    type: string;
    speed: number;
    damage: number;
    [key: string]: unknown;
}

export interface WeaponDefinition {
    cooldown: number;
    projectiles: ProjectileDefinition[];
    [key: string]: unknown;
}

// Optional extensions for factory-based weapons
export interface WeaponDefinitionExtras extends WeaponDefinition {
    accuracyDegrees?: number;
    volley?: number;
    heatPerShot?: number;
    maxHeat?: number;
    heatDecayRate?: number;
    overheatThreshold?: number;
    burstCount?: number;
    burstDelay?: number;
    spreadAngle?: number;
    penetration?: number;
    ricochetCount?: number;
}

export abstract class WeaponBase {
    protected _heat: number = 0;
    protected _isOverheated: boolean = false;
    protected _lastFireTime: number = 0;

    // Return a list of projectile definitions to spawn for this fire action
    abstract fire(params: {
        shooter: any;
        transform: any;
        weapon: any;
        definition: WeaponDefinitionExtras;
    }): ProjectileDefinition[];

    // Heat management methods
    protected _addHeat(amount: number, maxHeat: number): void {
        this._heat = Math.min(this._heat + amount, maxHeat);
        this._isOverheated = this._heat >= (maxHeat * 0.9); // Overheat at 90% of max heat
    }

    protected _decayHeat(decayRate: number, deltaTime: number): void {
        this._heat = Math.max(0, this._heat - (decayRate * deltaTime));
        if (this._heat < 50) { // Cool down below 50 to reset overheat
            this._isOverheated = false;
        }
    }

    protected _canFire(definition: WeaponDefinitionExtras): boolean {
        if (this._isOverheated) {
            return false;
        }
        
        const heatPerShot = definition.heatPerShot || 0;
        const maxHeat = definition.maxHeat || 100;
        
        return (this._heat + heatPerShot) <= maxHeat;
    }

    protected _applyAccuracy(projectile: ProjectileDefinition, accuracyDegrees: number): ProjectileDefinition {
        if (accuracyDegrees <= 0) {
            return projectile;
        }

        const jitterDeg = (Math.random() * 2 - 1) * accuracyDegrees;
        const angle = (jitterDeg * Math.PI) / 180;
        
        const speed = (projectile as any).speed || 12;
        const vx = Math.sin(angle) * speed * 0.5;
        const vy = -Math.cos(angle) * speed;
        
        return {
            ...projectile,
            dx: vx,
            dy: vy
        } as any;
    }

    // Get current heat level (0-1)
    getHeatLevel(maxHeat: number = 100): number {
        return this._heat / maxHeat;
    }

    // Check if weapon is overheated
    isOverheated(): boolean {
        return this._isOverheated;
    }

    // Update heat decay (call this from weapon system)
    updateHeat(definition: WeaponDefinitionExtras, deltaTime: number): void {
        if (deltaTime <= 0) {
            return; // Don't decay heat with negative or zero time
        }
        const decayRate = definition.heatDecayRate || 10; // Heat per second decay
        if (decayRate > 0) {
            this._decayHeat(decayRate, deltaTime);
        }
    }
}

export class WeaponService {
    private readonly _weapons: Map<string, WeaponDefinition> = new Map();
    private _defaultId: string | null = 'player-blaster';
    private readonly _strategies: Map<string, new () => WeaponBase> = new Map();
    private readonly _weaponInstances: Map<string, WeaponBase> = new Map();

    configure(config: { [key: string]: Partial<WeaponDefinition> } = {}): void {
        this._weapons.clear();
        Object.keys(config || {}).forEach(id => {
            const definition: WeaponDefinition = {
                cooldown: 0.5,
                projectiles: [],
                ...config[id]
            };
            this._weapons.set(id, definition);
        });

        if (config && config['player-blaster']) {
            this._defaultId = 'player-blaster';
        } else if (this._weapons.size) {
            const first = this._weapons.keys().next();
            this._defaultId = first.done ? null : (typeof first.value === 'string' ? first.value : null);
        } else {
            this._defaultId = null;
        }
    }

    get(id?: string): WeaponDefinition | null {
        const weaponId = id || this._defaultId;
        if (!weaponId) {
            return null;
        }
        return this._weapons.get(weaponId) || null;
    }

    registerWeaponType(id: string, ctor: new () => WeaponBase): void {
        if (!id || typeof ctor !== 'function') {
            return;
        }
        this._strategies.set(id, ctor);
    }

    createStrategy(id?: string): WeaponBase | null {
        const key = id || this._defaultId || '';
        const Ctor = this._strategies.get(key);
        if (!Ctor) {
            return null;
        }
        try {
            return new Ctor();
        } catch (_e) {
            return null;
        }
    }

    // Get or create a weapon instance for an entity
    getWeaponInstance(entityId: string, weaponId?: string): WeaponBase | null {
        const key = `${entityId}:${weaponId || this._defaultId}`;
        
        if (!this._weaponInstances.has(key)) {
            const strategy = this.createStrategy(weaponId);
            if (strategy) {
                this._weaponInstances.set(key, strategy);
            }
        }
        
        return this._weaponInstances.get(key) || null;
    }

    // Update heat for all weapon instances
    updateWeaponHeat(entityId: string, weaponId: string, deltaTime: number): void {
        const key = `${entityId}:${weaponId}`;
        const instance = this._weaponInstances.get(key);
        const definition = this.get(weaponId) as WeaponDefinitionExtras;
        
        if (instance && definition) {
            instance.updateHeat(definition, deltaTime);
        }
    }

    // Get weapon heat level for UI display
    getWeaponHeat(entityId: string, weaponId: string): number {
        const key = `${entityId}:${weaponId}`;
        const instance = this._weaponInstances.get(key);
        const definition = this.get(weaponId) as WeaponDefinitionExtras;
        const maxHeat = definition?.maxHeat || 100;
        return instance ? instance.getHeatLevel(maxHeat) : 0;
    }

    // Check if weapon is overheated
    isWeaponOverheated(entityId: string, weaponId: string): boolean {
        const key = `${entityId}:${weaponId}`;
        const instance = this._weaponInstances.get(key);
        return instance ? instance.isOverheated() : false;
    }

    // Clear weapon instances (useful for cleanup)
    clearWeaponInstances(): void {
        this._weaponInstances.clear();
    }

    // Remove specific weapon instance
    removeWeaponInstance(entityId: string, weaponId: string): void {
        const key = `${entityId}:${weaponId}`;
        this._weaponInstances.delete(key);
    }
}
