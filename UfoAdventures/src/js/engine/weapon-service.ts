class WeaponService {
    constructor() {
        this._weapons = new Map();
        this._defaultId = 'player-blaster';
    }

    configure(config = {}) {
        this._weapons.clear();
        Object.keys(config || {}).forEach(id => {
            const definition = Object.assign({}, config[id]);
            if (!definition.cooldown) {
                definition.cooldown = 0.5;
            }
            if (!Array.isArray(definition.projectiles)) {
                definition.projectiles = [];
            }
            this._weapons.set(id, definition);
        });
        if (config && config['player-blaster']) {
            this._defaultId = 'player-blaster';
        } else if (this._weapons.size) {
            this._defaultId = this._weapons.keys().next().value;
        } else {
            this._defaultId = null;
        }
    }

    get(id) {
        if (!id) {
            return this._defaultId ? this._weapons.get(this._defaultId) : null;
        }
        return this._weapons.get(id) || (this._defaultId ? this._weapons.get(this._defaultId) : null);
    }
}

window.WeaponService = WeaponService;
