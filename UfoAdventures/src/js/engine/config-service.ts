export class ConfigService {
    private readonly _configPath: string;
    private _config: unknown = null;

    constructor(configPath: string) {
        this._configPath = configPath;
    }

    async load<T = unknown>(): Promise<T> {
        if (this._config) {
            return this._config as T;
        }

        const response = await fetch(this._configPath);
        if (!response.ok) {
            throw new Error(`Failed to load config: ${response.status} ${response.statusText}`);
        }

        this._config = await response.json();
        return this._config as T;
    }

    get<T>(path: string | string[], defaultValue?: T): T | undefined {
        if (!path) {
            return this._config === undefined || this._config === null
                ? defaultValue
                : (this._config as T);
        }

        const segments = Array.isArray(path) ? path : String(path).split('.');
        let cursor: unknown = this._config;

        for (const segment of segments) {
            if (!isRecord(cursor) || !(segment in cursor)) {
                return defaultValue;
            }

            cursor = cursor[segment];
        }

        return cursor as T;
    }

    has(path: string | string[]): boolean {
        if (!path) {
            return !!this._config;
        }

        const segments = Array.isArray(path) ? path : String(path).split('.');
        let cursor: unknown = this._config;

        for (const segment of segments) {
            if (!isRecord(cursor) || !(segment in cursor)) {
                return false;
            }

            cursor = cursor[segment];
        }

        return true;
    }

    async _loadSupplemental(path: string, property: string): Promise<void> {
        if (!path) {
            return;
        }
        try {
            const response = await fetch(path);
            if (!response.ok) {
                return;
            }
            const data = await response.json();
            if (!data || typeof data !== 'object') {
                return;
            }
            if (!isRecord(this._config)) {
                this._config = {};
            }
            (this._config as Record<string, unknown>)[property] = data;
        } catch (error) {
            console.warn('ConfigService: failed to load supplemental config', path, error);
        }
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}
