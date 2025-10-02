export interface ProjectileDefinition {
    type: string;
    speed: number;
    damage: number;
    [key: string]: any;
}

export interface WeaponDefinition {
    cooldown: number;
    projectiles: ProjectileDefinition[];
    [key: string]: any;
}

export class WeaponService {
    private readonly _weapons: Map<string, WeaponDefinition> = new Map();
    private _defaultId: string | null = 'player-blaster';

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
}
