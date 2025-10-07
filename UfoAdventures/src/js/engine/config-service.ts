import Ajv from 'ajv';
import addFormats from 'ajv-formats';

export interface ConfigValidationOptions {
    validateOnLoad?: boolean;
    watchForChanges?: boolean;
    onValidationError?: (errors: string[]) => void;
    onConfigChange?: (config: unknown) => void;
}

export class ConfigService {
    private readonly _configPath: string;
    private _config: unknown = null;
    private readonly _validator: Ajv;
    private readonly _options: ConfigValidationOptions;
    private _watchers: Array<(config: unknown) => void> = [];
    private _validationErrors: string[] = [];

    constructor(configPath: string, options: ConfigValidationOptions = {}) {
        this._configPath = configPath;
        this._options = {
            validateOnLoad: true,
            watchForChanges: false,
            ...options
        };
        
        // Initialize AJV validator
        this._validator = new Ajv({ allErrors: true });
        addFormats(this._validator);
        
        // Load schemas
        this._loadSchemas();
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
        
        // Validate configuration if enabled
        if (this._options.validateOnLoad) {
            this._validateConfig(this._config);
        }
        
        // Notify watchers
        this._notifyWatchers(this._config);
        
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
            
            // Re-validate after loading supplemental config
            if (this._options.validateOnLoad) {
                this._validateConfig(this._config);
            }
        } catch (error) {
            console.warn('ConfigService: failed to load supplemental config', path, error);
        }
    }

    /**
     * Add a watcher that will be called when configuration changes
     */
    addWatcher(watcher: (config: unknown) => void): () => void {
        this._watchers.push(watcher);
        
        // Return unsubscribe function
        return () => {
            const index = this._watchers.indexOf(watcher);
            if (index > -1) {
                this._watchers.splice(index, 1);
            }
        };
    }

    /**
     * Validate a specific section of the configuration
     */
    validateSection<T>(sectionName: string, data: T): boolean {
        const schema = this._getSchemaForSection(sectionName);
        if (!schema) {
            console.warn(`ConfigService: No schema found for section '${sectionName}'`);
            return true;
        }

        try {
            const validate = this._validator.compile(schema);
            const isValid = validate(data);
            
            if (!isValid && validate.errors) {
                const errors = validate.errors.map(error => 
                    `${sectionName}: ${error.instancePath} ${error.message}`
                );
                this._validationErrors = errors;
                this._options.onValidationError?.(errors);
                return false;
            }
            
            return true;
        } catch (error) {
            console.warn(`ConfigService: Error validating section '${sectionName}'`, error);
            return true; // Return true on validation errors to avoid breaking the app
        }
    }

    /**
     * Get the last validation errors
     */
    getValidationErrors(): string[] {
        return [...this._validationErrors];
    }

    /**
     * Check if the current configuration is valid
     */
    isValid(): boolean {
        return this._validationErrors.length === 0;
    }

    /**
     * Reload configuration and validate
     */
    async reload<T = unknown>(): Promise<T> {
        this._config = null;
        this._validationErrors = [];
        return this.load<T>();
    }

    private _loadSchemas(): void {
        // Load main game config schema
        this._loadSchema('game-config', '/schemas/game-config-schema.json');
        this._loadSchema('assets', '/schemas/assets-schema.json');
        this._loadSchema('enemies', '/schemas/enemies-schema.json');
        this._loadSchema('weapons', '/schemas/weapons-schema.json');
        this._loadSchema('missions', '/schemas/missions-schema.json');
    }

    private async _loadSchema(name: string, path: string): Promise<void> {
        try {
            const response = await fetch(path);
            if (response.ok) {
                const schema = await response.json();
                this._validator.addSchema(schema, name);
            }
        } catch (error) {
            console.warn(`ConfigService: Failed to load schema '${name}' from '${path}'`, error);
        }
    }

    private _validateConfig(config: unknown): void {
        if (!config || typeof config !== 'object') {
            this._validationErrors = ['Configuration must be an object'];
            this._options.onValidationError?.(this._validationErrors);
            return;
        }

        const validate = this._validator.getSchema('game-config');
        if (!validate) {
            console.warn('ConfigService: Main game config schema not loaded');
            return;
        }

        const isValid = validate(config);
        if (!isValid && validate.errors) {
            this._validationErrors = validate.errors.map(error => 
                `${error.instancePath} ${error.message}`
            );
            this._options.onValidationError?.(this._validationErrors);
        } else {
            this._validationErrors = [];
        }
    }

    private _getSchemaForSection(sectionName: string): any {
        return this._validator.getSchema(sectionName);
    }

    private _notifyWatchers(config: unknown): void {
        this._watchers.forEach(watcher => {
            try {
                watcher(config);
            } catch (error) {
                console.error('ConfigService: Error in config watcher', error);
            }
        });
        
        this._options.onConfigChange?.(config);
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}
