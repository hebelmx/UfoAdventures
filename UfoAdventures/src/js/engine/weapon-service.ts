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
}

export abstract class WeaponBase {
    // Return a list of projectile definitions to spawn for this fire action
    abstract fire(params: {
        shooter: any;
        transform: any;
        weapon: any;
        definition: WeaponDefinitionExtras;
    }): ProjectileDefinition[];
}

export class WeaponService {
    private readonly _weapons: Map<string, WeaponDefinition> = new Map();
    private _defaultId: string | null = 'player-blaster';
    private readonly _strategies: Map<string, new () => WeaponBase> = new Map();

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
}
