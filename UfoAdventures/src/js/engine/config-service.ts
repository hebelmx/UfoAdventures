class ConfigService {
    constructor(configPath) {
        this._configPath = configPath;
        this._config = null;
    }

    async load() {
        if (this._config) {
            return this._config;
        }

        const response = await fetch(this._configPath);
        if (!response.ok) {
            throw new Error('Failed to load config: ' + response.status + ' ' + response.statusText);
        }

        this._config = await response.json();
        return this._config;
    }

    get(path, defaultValue) {
        if (!path) {
            return this._config ?? defaultValue;
        }

        const segments = Array.isArray(path) ? path : String(path).split('.');
        let cursor = this._config;

        for (const segment of segments) {
            if (!cursor || typeof cursor !== 'object' || !(segment in cursor)) {
                return defaultValue;
            }

            cursor = cursor[segment];
        }

        return cursor;
    }

    has(path) {
        if (!path) {
            return !!this._config;
        }

        const segments = Array.isArray(path) ? path : String(path).split('.');
        let cursor = this._config;

        for (const segment of segments) {
            if (!cursor || typeof cursor !== 'object' || !(segment in cursor)) {
                return false;
            }

            cursor = cursor[segment];
        }

        return true;
    }
}
