class EntityPool {
    constructor(options = {}) {
        this._create = options.create || (() => null);
        this._activate = options.activate || ((entity, params) => {});
        this._deactivate = options.deactivate || ((entity) => {});
        this._reset = options.reset || ((entity) => {});
        this._store = [];
    }

    acquire(params = {}) {
        const entity = this._store.pop() || this._create();
        if (!entity) {
            return null;
        }
        if (typeof this._reset === 'function') {
            this._reset(entity);
        }
        if (typeof this._activate === 'function') {
            this._activate(entity, params);
        }
        return entity;
    }

    release(entity) {
        if (!entity) {
            return;
        }
        if (typeof this._deactivate === 'function') {
            this._deactivate(entity);
        }
        this._store.push(entity);
    }

    size() {
        return this._store.length;
    }
}

window.EntityPool = EntityPool;
