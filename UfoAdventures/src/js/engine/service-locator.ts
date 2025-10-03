export class ServiceLocator {
    private readonly _services = new Map<string, unknown>();

    register<T>(key: string, instance: T): void {
        if (!key) {
            throw new Error('ServiceLocator.register: key is required');
        }

        if (this._services.has(key)) {
            throw new Error(`Service "${key}" is already registered.`);
        }

        this._services.set(key, instance);
    }

    resolve<T>(key: string): T {
        if (!this._services.has(key)) {
            throw new Error(`Service "${key}" is not registered.`);
        }

        return this._services.get(key) as T;
    }

    optional<T>(key: string): T | null {
        return (this._services.get(key) as T | undefined) ?? null;
    }

    replace<T>(key: string, instance: T): void {
        if (!key) {
            throw new Error('ServiceLocator.replace: key is required');
        }

        this._services.set(key, instance);
    }

    unregister(key: string): void {
        this._services.delete(key);
    }

    reset(): void {
        this._services.clear();
    }
}
