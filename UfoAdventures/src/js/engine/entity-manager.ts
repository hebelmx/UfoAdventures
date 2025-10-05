import type { ComponentConstructor } from './core';
import type { RuntimeEntity } from './combat-types';

export interface EntityManagerOptions {
    releaseEntity?: (entity: RuntimeEntity, index?: number) => void;
}

/**
 * Manages the lifecycle, storage, and querying of entities within the game runtime.
 * It provides methods for adding, removing, finding, and querying entities,
 * and integrates with an entity pooling mechanism for efficient resource management.
 */
export class EntityManager {
    private readonly _entities: RuntimeEntity[];
    private readonly _releaseEntity: ((entity: RuntimeEntity, index?: number) => void) | null;

    constructor(entities: RuntimeEntity[], options: EntityManagerOptions = {}) {
        this._entities = entities;
        this._releaseEntity = options.releaseEntity ?? null;
    }

    add(entity: RuntimeEntity | null | undefined): RuntimeEntity | null {
        if (!entity) {
            return null;
        }
        if (!this._entities.includes(entity)) {
            this._entities.push(entity);
        }
        entity.isRemoved = false;
        return entity;
    }

    addMany(entities: Array<RuntimeEntity | null | undefined>): void {
        entities.forEach(entity => this.add(entity));
    }

    has(entity: RuntimeEntity | null | undefined): boolean {
        if (!entity) {
            return false;
        }
        return this._entities.includes(entity);
    }

    remove(entity: RuntimeEntity | null | undefined): boolean {
        if (!entity) {
            return false;
        }
        const index = this._entities.indexOf(entity);
        if (index === -1) {
            return false;
        }

        if (entity.poolId && this._releaseEntity) {
            this._releaseEntity(entity, index);
            return true;
        }

        this._detach(entity, index);
        return true;
    }

    detach(entity: RuntimeEntity | null | undefined, index?: number): boolean {
        if (!entity) {
            return false;
        }
        const removalIndex = typeof index === 'number' ? index : this._entities.indexOf(entity);
        if (removalIndex === -1) {
            return false;
        }
        this._detach(entity, removalIndex);
        return true;
    }

    clear(): void {
        this._entities.length = 0;
    }

    forEach(callback: (entity: RuntimeEntity, index: number) => void): void {
        this._entities.forEach(callback);
    }

    find(predicate: (entity: RuntimeEntity, index: number) => boolean): RuntimeEntity | null {
        const result = this._entities.find(predicate);
        return result ?? null;
    }

    query(predicate: (entity: RuntimeEntity, index: number) => boolean): RuntimeEntity[] {
        return this._entities.filter(predicate);
    }

    queryByComponents(...components: ComponentConstructor[]): RuntimeEntity[] {
        if (!components.length) {
            return this._entities.slice();
        }
        return this._entities.filter(entity => components.every(component => entity.hasComponent(component)));
    }

    findByComponents(...components: ComponentConstructor[]): RuntimeEntity | null {
        if (!components.length) {
            return this._entities[0] ?? null;
        }
        const entity = this._entities.find(candidate => components.every(component => candidate.hasComponent(component)));
        return entity ?? null;
    }

    getAll(): RuntimeEntity[] {
        return this._entities;
    }

    count(): number {
        return this._entities.length;
    }

    private _detach(entity: RuntimeEntity, index: number): void {
        if (index > -1) {
            this._entities.splice(index, 1);
        }
        entity.isRemoved = true;
    }
}
