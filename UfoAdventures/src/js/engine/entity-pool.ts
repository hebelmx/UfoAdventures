export interface EntityPoolOptions<T, P = Record<string, unknown>> {
    create?: () => T | null | undefined;
    activate?: (entity: T, params: P) => void;
    deactivate?: (entity: T) => void;
    reset?: (entity: T) => void;
    maxSize?: number;
    initialSize?: number;
}

export interface EntityPoolStats {
    available: number;
    inUse: number;
    total: number;
}

export class EntityPool<T, P = Record<string, unknown>> {
    private readonly _create: () => T | null | undefined;
    private readonly _activate?: (entity: T, params: P) => void;
    private readonly _deactivate?: (entity: T) => void;
    private readonly _reset?: (entity: T) => void;
    private readonly _maxSize: number;
    private readonly _store: T[] = [];
    private _activeCount = 0;

    constructor(options: EntityPoolOptions<T, P> = {}) {
        this._create = options.create ?? (() => null);
        this._activate = options.activate;
        this._deactivate = options.deactivate;
        this._reset = options.reset;
        this._maxSize = Number.isFinite(options.maxSize) ? (options.maxSize as number) : Infinity;

        const initialSize = Math.max(0, Math.floor(options.initialSize ?? 0));
        for (let index = 0; index < initialSize; index += 1) {
            const entity = this._create();
            if (!entity) {
                continue;
            }

            this._deactivate?.(entity);
            this._store.push(entity);
        }
    }

    acquire(params?: P): T | null {
        const entity = this._store.pop() ?? this._create();
        if (!entity) {
            return null;
        }

        this._reset?.(entity);
        if (this._activate) {
            const activationParams = params ?? ({} as P);
            this._activate(entity, activationParams);
        }

        this._activeCount += 1;
        return entity;
    }

    release(entity: T | null | undefined): void {
        if (!entity) {
            return;
        }

        this._deactivate?.(entity);

        if (this._store.length < this._maxSize) {
            this._store.push(entity);
        }

        if (this._activeCount > 0) {
            this._activeCount -= 1;
        }
    }

    size(): number {
        return this._store.length;
    }

    inUse(): number {
        return this._activeCount;
    }

    stats(): EntityPoolStats {
        const available = this._store.length;
        const inUse = this._activeCount;
        return {
            available,
            inUse,
            total: available + inUse
        };
    }
}