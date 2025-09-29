class SpatialGrid {
    constructor(options = {}) {
        this.cellSize = options.cellSize || 120;
        this._cells = new Map();
        this._entityToCellKeys = new Map();
    }

    clear() {
        this._cells.clear();
        this._entityToCellKeys.clear();
    }

    insert(entity, bounds) {
        if (!entity || !bounds) {
            return;
        }

        const cellKeys = this._getCellKeys(bounds);
        this._entityToCellKeys.set(entity, cellKeys);

        for (const key of cellKeys) {
            if (!this._cells.has(key)) {
                this._cells.set(key, new Set());
            }
            this._cells.get(key).add(entity);
        }
    }

    update(entity, bounds) {
        this.remove(entity);
        this.insert(entity, bounds);
    }

    remove(entity) {
        if (!entity) {
            return;
        }

        const keys = this._entityToCellKeys.get(entity);
        if (!keys) {
            return;
        }

        for (const key of keys) {
            const bucket = this._cells.get(key);
            if (bucket) {
                bucket.delete(entity);
                if (!bucket.size) {
                    this._cells.delete(key);
                }
            }
        }

        this._entityToCellKeys.delete(entity);
    }

    cellCount() {
        return this._cells.size;
    }

    entityCount() {
        return this._entityToCellKeys.size;
    }

    query(bounds) {
        if (!bounds) {
            return new Set();
        }

        const results = new Set();
        const keys = this._getCellKeys(bounds);
        for (const key of keys) {
            const bucket = this._cells.get(key);
            if (bucket) {
                bucket.forEach(entity => results.add(entity));
            }
        }
        return results;
    }

    _getCellKeys({ minX, minY, maxX, maxY }) {
        const size = this.cellSize;
        const startX = Math.floor(minX / size);
        const startY = Math.floor(minY / size);
        const endX = Math.floor(maxX / size);
        const endY = Math.floor(maxY / size);

        const keys = [];
        for (let gx = startX; gx <= endX; gx++) {
            for (let gy = startY; gy <= endY; gy++) {
                keys.push(gx + ':' + gy);
            }
        }
        return keys;
    }
}

window.SpatialGrid = SpatialGrid;
