export interface SpatialGridOptions {
    cellSize?: number;
}

export interface SpatialBounds {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
}

export class SpatialGrid<T> {
    readonly cellSize: number;
    private readonly _cells: Map<string, Set<T>> = new Map();
    private readonly _entityToCellKeys: Map<T, string[]> = new Map();

    constructor(options: SpatialGridOptions = {}) {
        this.cellSize = Number.isFinite(options.cellSize) && options.cellSize !== undefined
            ? Math.max(1, options.cellSize)
            : 120;
    }

    clear(): void {
        this._cells.clear();
        this._entityToCellKeys.clear();
    }

    insert(entity: T | null | undefined, bounds: SpatialBounds | null | undefined): void {
        if (!entity || !bounds) {
            return;
        }

        const cellKeys = this._getCellKeys(bounds);
        this._entityToCellKeys.set(entity, cellKeys);

        for (const key of cellKeys) {
            if (!this._cells.has(key)) {
                this._cells.set(key, new Set());
            }
            this._cells.get(key)!.add(entity);
        }
    }

    update(entity: T | null | undefined, bounds: SpatialBounds | null | undefined): void {
        this.remove(entity);
        this.insert(entity, bounds);
    }

    remove(entity: T | null | undefined): void {
        if (!entity) {
            return;
        }

        const keys = this._entityToCellKeys.get(entity);
        if (!keys) {
            return;
        }

        for (const key of keys) {
            const bucket = this._cells.get(key);
            if (!bucket) {
                continue;
            }
            bucket.delete(entity);
            if (bucket.size === 0) {
                this._cells.delete(key);
            }
        }

        this._entityToCellKeys.delete(entity);
    }

    cellCount(): number {
        return this._cells.size;
    }

    entityCount(): number {
        return this._entityToCellKeys.size;
    }

    query(bounds: SpatialBounds | null | undefined): Set<T> {
        if (!bounds) {
            return new Set();
        }

        const results = new Set<T>();
        const keys = this._getCellKeys(bounds);
        for (const key of keys) {
            const bucket = this._cells.get(key);
            if (bucket) {
                bucket.forEach(entity => results.add(entity));
            }
        }
        return results;
    }

    private _getCellKeys(bounds: SpatialBounds): string[] {
        const { minX, minY, maxX, maxY } = bounds;
        const size = this.cellSize;
        const startX = Math.floor(minX / size);
        const startY = Math.floor(minY / size);
        const endX = Math.floor(maxX / size);
        const endY = Math.floor(maxY / size);

        const keys: string[] = [];
        for (let gx = startX; gx <= endX; gx += 1) {
            for (let gy = startY; gy <= endY; gy += 1) {
                keys.push(`${gx}:${gy}`);
            }
        }
        return keys;
    }
}