class ServiceLocator {
    constructor() {
        this._services = new Map();
    }

    register(key, instance) {
        if (!key) {
            throw new Error('ServiceLocator.register: key is required');
        }

        if (this._services.has(key)) {
            throw new Error('Service "' + key + '" is already registered.');
        }

        this._services.set(key, instance);
    }

    resolve(key) {
        if (!this._services.has(key)) {
            throw new Error('Service "' + key + '" is not registered.');
        }

        return this._services.get(key);
    }

    optional(key) {
        return this._services.get(key) || null;
    }

    replace(key, instance) {
        if (!key) {
            throw new Error('ServiceLocator.replace: key is required');
        }

        this._services.set(key, instance);
    }

    unregister(key) {
        this._services.delete(key);
    }

    reset() {
        this._services.clear();
    }
}
