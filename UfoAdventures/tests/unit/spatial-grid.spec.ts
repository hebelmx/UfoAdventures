import { describe, it, expect, beforeEach } from 'vitest';
import { SpatialGrid, SpatialBounds } from '../../src/js/engine/spatial-grid';

describe('SpatialGrid', () => {
    let spatialGrid: SpatialGrid<string>;

    beforeEach(() => {
        spatialGrid = new SpatialGrid<string>({ cellSize: 100 });
    });

    describe('Basic Operations', () => {
        it('should insert entities into correct cells', () => {
            const entity1 = 'entity1';
            const entity2 = 'entity2';
            const bounds1: SpatialBounds = { minX: 50, minY: 50, maxX: 150, maxY: 150 };
            const bounds2: SpatialBounds = { minX: 250, minY: 250, maxX: 350, maxY: 350 };

            spatialGrid.insert(entity1, bounds1);
            spatialGrid.insert(entity2, bounds2);

            expect(spatialGrid.entityCount()).toBe(2);
            expect(spatialGrid.cellCount()).toBeGreaterThan(0);
        });

        it('should query entities in specific bounds', () => {
            const entity1 = 'entity1';
            const entity2 = 'entity2';
            const bounds1: SpatialBounds = { minX: 50, minY: 50, maxX: 80, maxY: 80 };
            const bounds2: SpatialBounds = { minX: 250, minY: 250, maxX: 280, maxY: 280 };

            spatialGrid.insert(entity1, bounds1);
            spatialGrid.insert(entity2, bounds2);

            const queryBounds: SpatialBounds = { minX: 0, minY: 0, maxX: 100, maxY: 100 };
            const results = spatialGrid.query(queryBounds);

            expect(results.size).toBe(1);
            expect(results.has(entity1)).toBe(true);
            expect(results.has(entity2)).toBe(false);
        });

        it('should remove entities correctly', () => {
            const entity = 'entity';
            const bounds: SpatialBounds = { minX: 50, minY: 50, maxX: 150, maxY: 150 };

            spatialGrid.insert(entity, bounds);
            expect(spatialGrid.entityCount()).toBe(1);

            spatialGrid.remove(entity);
            expect(spatialGrid.entityCount()).toBe(0);
        });

        it('should update entity positions', () => {
            const entity = 'entity';
            const oldBounds: SpatialBounds = { minX: 50, minY: 50, maxX: 80, maxY: 80 };
            const newBounds: SpatialBounds = { minX: 250, minY: 250, maxX: 280, maxY: 280 };

            spatialGrid.insert(entity, oldBounds);
            spatialGrid.update(entity, newBounds);

            const oldQueryBounds: SpatialBounds = { minX: 0, minY: 0, maxX: 100, maxY: 100 };
            const newQueryBounds: SpatialBounds = { minX: 200, minY: 200, maxX: 300, maxY: 300 };

            // Entity should no longer be in old bounds
            expect(spatialGrid.query(oldQueryBounds).has(entity)).toBe(false);
            // Entity should be in new bounds
            expect(spatialGrid.query(newQueryBounds).has(entity)).toBe(true);
        });
    });

    describe('Cell Management', () => {
        it('should handle entities spanning multiple cells', () => {
            const entity = 'entity';
            const bounds: SpatialBounds = { minX: 50, minY: 50, maxX: 250, maxY: 250 };

            spatialGrid.insert(entity, bounds);

            // Entity spans multiple cells (100x100 cell size)
            expect(spatialGrid.cellCount()).toBeGreaterThan(1);
            expect(spatialGrid.entityCount()).toBe(1);
        });

        it('should clean up empty cells', () => {
            const entity = 'entity';
            const bounds: SpatialBounds = { minX: 50, minY: 50, maxX: 150, maxY: 150 };

            spatialGrid.insert(entity, bounds);
            const cellCount = spatialGrid.cellCount();

            spatialGrid.remove(entity);
            expect(spatialGrid.cellCount()).toBe(0);
        });

        it('should use default cell size when not specified', () => {
            const defaultGrid = new SpatialGrid<string>();
            expect(defaultGrid.cellSize).toBe(120);
        });

        it('should use minimum cell size of 1', () => {
            const smallGrid = new SpatialGrid<string>({ cellSize: 0 });
            expect(smallGrid.cellSize).toBe(1);
        });
    });

    describe('Query Operations', () => {
        it('should return empty set for null bounds', () => {
            const results = spatialGrid.query(null);
            expect(results.size).toBe(0);
        });

        it('should return empty set for undefined bounds', () => {
            const results = spatialGrid.query(undefined);
            expect(results.size).toBe(0);
        });

        it('should handle queries with no matching entities', () => {
            const entity = 'entity';
            const bounds: SpatialBounds = { minX: 50, minY: 50, maxX: 150, maxY: 150 };

            spatialGrid.insert(entity, bounds);

            const queryBounds: SpatialBounds = { minX: 500, minY: 500, maxX: 600, maxY: 600 };
            const results = spatialGrid.query(queryBounds);

            expect(results.size).toBe(0);
        });

        it('should handle overlapping entities', () => {
            const entity1 = 'entity1';
            const entity2 = 'entity2';
            const bounds1: SpatialBounds = { minX: 50, minY: 50, maxX: 150, maxY: 150 };
            const bounds2: SpatialBounds = { minX: 100, minY: 100, maxX: 200, maxY: 200 };

            spatialGrid.insert(entity1, bounds1);
            spatialGrid.insert(entity2, bounds2);

            const queryBounds: SpatialBounds = { minX: 100, minY: 100, maxX: 150, maxY: 150 };
            const results = spatialGrid.query(queryBounds);

            expect(results.size).toBe(2);
            expect(results.has(entity1)).toBe(true);
            expect(results.has(entity2)).toBe(true);
        });
    });

    describe('Edge Cases', () => {
        it('should handle null entities', () => {
            const bounds: SpatialBounds = { minX: 50, minY: 50, maxX: 150, maxY: 150 };

            spatialGrid.insert(null, bounds);
            spatialGrid.insert(undefined, bounds);

            expect(spatialGrid.entityCount()).toBe(0);
        });

        it('should handle null bounds', () => {
            const entity = 'entity';

            spatialGrid.insert(entity, null);
            spatialGrid.insert(entity, undefined);

            expect(spatialGrid.entityCount()).toBe(0);
        });

        it('should handle zero-size bounds', () => {
            const entity = 'entity';
            const bounds: SpatialBounds = { minX: 50, minY: 50, maxX: 50, maxY: 50 };

            spatialGrid.insert(entity, bounds);
            expect(spatialGrid.entityCount()).toBe(1);
        });

        it('should handle negative coordinates', () => {
            const entity = 'entity';
            const bounds: SpatialBounds = { minX: -100, minY: -100, maxX: -50, maxY: -50 };

            spatialGrid.insert(entity, bounds);
            expect(spatialGrid.entityCount()).toBe(1);

            const queryBounds: SpatialBounds = { minX: -150, minY: -150, maxX: 0, maxY: 0 };
            const results = spatialGrid.query(queryBounds);
            expect(results.size).toBe(1);
        });

        it('should clear all entities and cells', () => {
            const entity1 = 'entity1';
            const entity2 = 'entity2';
            const bounds1: SpatialBounds = { minX: 50, minY: 50, maxX: 150, maxY: 150 };
            const bounds2: SpatialBounds = { minX: 250, minY: 250, maxX: 350, maxY: 350 };

            spatialGrid.insert(entity1, bounds1);
            spatialGrid.insert(entity2, bounds2);

            expect(spatialGrid.entityCount()).toBe(2);
            expect(spatialGrid.cellCount()).toBeGreaterThan(0);

            spatialGrid.clear();

            expect(spatialGrid.entityCount()).toBe(0);
            expect(spatialGrid.cellCount()).toBe(0);
        });
    });

    describe('Performance Characteristics', () => {
        it('should handle many entities efficiently', () => {
            const entities: string[] = [];
            const bounds: SpatialBounds[] = [];

            // Create 1000 entities
            for (let i = 0; i < 1000; i++) {
                const entity = `entity${i}`;
                const x = (i % 10) * 100;
                const y = Math.floor(i / 10) * 100;
                const entityBounds: SpatialBounds = {
                    minX: x,
                    minY: y,
                    maxX: x + 50,
                    maxY: y + 50
                };

                entities.push(entity);
                bounds.push(entityBounds);
            }

            // Insert all entities
            for (let i = 0; i < entities.length; i++) {
                spatialGrid.insert(entities[i], bounds[i]);
            }

            expect(spatialGrid.entityCount()).toBe(1000);

            // Query should be fast even with many entities
            const queryBounds: SpatialBounds = { minX: 0, minY: 0, maxX: 100, maxY: 100 };
            const results = spatialGrid.query(queryBounds);

            // Should only return entities in the first cell
            expect(results.size).toBeLessThan(1000);
        });
    });
});
