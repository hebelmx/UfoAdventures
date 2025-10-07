import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CollisionSystem } from '../../src/js/engine/systems';
import { SpatialGrid } from '../../src/js/engine/spatial-grid';
import { Entity } from '../../src/js/engine/core';
import { Transform, Collider, Bullet, Enemy, Boss, EnemyBullet, Health } from '../../src/js/engine/components';
import { Player } from '../../src/js/entities/player';

describe('Spatial Grid Integration', () => {
    let collisionSystem: CollisionSystem;
    let mockGame: any;
    let mockEventBus: any;
    let mockUiService: any;

    beforeEach(() => {
        mockGame = {
            spawnEffect: vi.fn(),
            spawnProjectile: vi.fn(),
            getEntities: vi.fn(() => [])
        };
        mockEventBus = {
            emit: vi.fn()
        };
        mockUiService = {
            showMessage: vi.fn()
        };

        collisionSystem = new CollisionSystem(mockGame, mockEventBus, mockUiService);
    });

    describe('Spatial Grid Operations', () => {
        it('should update spatial grid with collidable entities', () => {
            const entities = [
                createTestEntity('bullet', 100, 100, 10),
                createTestEntity('enemy', 200, 200, 20),
                createTestEntity('boss', 300, 300, 30),
                createTestEntity('player', 50, 50, 15)
            ];

            collisionSystem.update(entities, 16);

            const metrics = collisionSystem.getCollisionMetrics();
            expect(metrics.entitiesInGrid).toBe(4);
        });

        it('should ignore non-collidable entities', () => {
            const entities = [
                createTestEntity('bullet', 100, 100, 10),
                createTestEntity('enemy', 200, 200, 20),
                // Entity without collider
                createTestEntityWithoutCollider('effect', 300, 300)
            ];

            collisionSystem.update(entities, 16);

            const metrics = collisionSystem.getCollisionMetrics();
            expect(metrics.entitiesInGrid).toBe(2);
        });

        it('should find nearby entities using spatial grid', () => {
            const bullet = createTestEntity('bullet', 100, 100, 10);
            const nearbyEnemy = createTestEntity('enemy', 110, 110, 20);
            const farEnemy = createTestEntity('enemy', 500, 500, 20);

            const entities = [bullet, nearbyEnemy, farEnemy];

            collisionSystem.update(entities, 16);

            // The bullet should only collide with the nearby enemy
            const metrics = collisionSystem.getCollisionMetrics();
            expect(metrics.totalChecks).toBeGreaterThan(0);
        });
    });

    describe('Collision Detection Performance', () => {
        it('should reduce collision checks with spatial grid', () => {
            const entities = [];
            
            // Create many entities spread out
            for (let i = 0; i < 50; i++) {
                entities.push(createTestEntity('enemy', i * 200, i * 200, 20));
            }

            // Add a bullet that will only be near one enemy
            entities.push(createTestEntity('bullet', 100, 100, 10));

            collisionSystem.update(entities, 16);

            const metrics = collisionSystem.getCollisionMetrics();
            expect(metrics.totalChecks).toBeLessThan(50 * 50); // Much less than naive O(n²)
        });

        it('should track collision metrics', () => {
            const entities = [
                createTestEntity('bullet', 100, 100, 10),
                createTestEntity('enemy', 110, 110, 20)
            ];

            collisionSystem.update(entities, 16);

            const metrics = collisionSystem.getCollisionMetrics();
            expect(metrics).toHaveProperty('totalChecks');
            expect(metrics).toHaveProperty('entitiesInGrid');
            expect(metrics.totalChecks).toBeGreaterThan(0);
            expect(metrics.entitiesInGrid).toBe(2);
        });
    });

    describe('Spatial Grid Bounds', () => {
        it('should calculate correct entity bounds', () => {
            const entity = createTestEntity('enemy', 100, 100, 20);
            const bounds = collisionSystem['_getEntityBounds'](entity);

            expect(bounds).toEqual({
                minX: 80,  // 100 - 20
                minY: 80,  // 100 - 20
                maxX: 120, // 100 + 20
                maxY: 120  // 100 + 20
            });
        });

        it('should expand bounds for nearby entity queries', () => {
            const entity = createTestEntity('bullet', 100, 100, 10);
            const bounds = collisionSystem['_getEntityBounds'](entity);
            const nearbyEntities = collisionSystem['_getNearbyEntities'](entity);

            // Should use expanded bounds for query
            expect(bounds).toBeDefined();
            expect(nearbyEntities).toBeInstanceOf(Set);
        });
    });

    describe('Collision System Integration', () => {
        it('should handle bullet-enemy collisions with spatial grid', () => {
            const bullet = createTestEntity('bullet', 100, 100, 10);
            const enemy = createTestEntity('enemy', 105, 105, 20);
            enemy.addComponent(new Health(50));

            const entities = [bullet, enemy];

            collisionSystem.update(entities, 16);

            // Bullet should be removed after collision
            expect(bullet.isRemoved).toBe(true);
        });

        it('should handle player-enemy collisions with spatial grid', () => {
            const player = createTestEntity('player', 100, 100, 15);
            const enemy = createTestEntity('enemy', 110, 110, 20);
            player.addComponent(new Health(100));
            enemy.addComponent(new Health(50));

            const entities = [player, enemy];

            collisionSystem.update(entities, 16);

            // Player should take damage
            const playerHealth = player.getComponent(Health);
            expect(playerHealth.health).toBeLessThan(100);
        });
    });

    describe('Edge Cases', () => {
        it('should handle entities without colliders', () => {
            const entity = createTestEntityWithoutCollider('effect', 100, 100);
            const bounds = collisionSystem['_getEntityBounds'](entity);

            expect(bounds).toBeNull();
        });

        it('should handle entities without transforms', () => {
            const entity = new Entity();
            entity.addComponent(new Collider(20));
            // No Transform component

            const bounds = collisionSystem['_getEntityBounds'](entity);
            expect(bounds).toBeNull();
        });

        it('should clear spatial grid between updates', () => {
            const entities1 = [createTestEntity('enemy', 100, 100, 20)];
            const entities2 = [createTestEntity('enemy', 200, 200, 20)];

            collisionSystem.update(entities1, 16);
            let metrics = collisionSystem.getCollisionMetrics();
            expect(metrics.entitiesInGrid).toBe(1);

            collisionSystem.update(entities2, 16);
            metrics = collisionSystem.getCollisionMetrics();
            expect(metrics.entitiesInGrid).toBe(1);
        });
    });
});

function createTestEntity(type: string, x: number, y: number, radius: number): Entity {
    const entity = new Entity();
    entity.addComponent(new Transform({ x, y }));
    entity.addComponent(new Collider(radius));

    switch (type) {
        case 'bullet':
            entity.addComponent(new Bullet());
            break;
        case 'enemy':
            entity.addComponent(new Enemy());
            break;
        case 'boss':
            entity.addComponent(new Boss());
            break;
        case 'enemyBullet':
            entity.addComponent(new EnemyBullet());
            break;
        case 'player':
            entity.addComponent(new Player());
            break;
    }

    return entity;
}

function createTestEntityWithoutCollider(type: string, x: number, y: number): Entity {
    const entity = new Entity();
    entity.addComponent(new Transform({ x, y }));
    // No Collider component
    return entity;
}
