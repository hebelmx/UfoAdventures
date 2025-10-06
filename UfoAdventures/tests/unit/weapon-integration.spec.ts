import { describe, expect, it, vi, beforeEach } from 'vitest';
import { WeaponService, WeaponDefinitionExtras } from '../../src/js/engine/weapon-service';
import { BurstRifleStrategy } from '../../src/js/engine/weapons/burst-rifle';
import { LaserCannonStrategy } from '../../src/js/engine/weapons/laser-cannon';
import { Entity } from '../../src/js/engine/core';
import { Transform, Weapon } from '../../src/js/engine/components';

describe('Weapon Integration Tests', () => {
    let weaponService: WeaponService;
    let mockDefinition: WeaponDefinitionExtras;

    beforeEach(() => {
        weaponService = new WeaponService();
        mockDefinition = {
            cooldown: 0.5,
            projectiles: [],
            heatPerShot: 10,
            maxHeat: 100,
            heatDecayRate: 5,
            burstCount: 3,
            burstDelay: 0.1,
            chargeTime: 1.0
        };
        // Clear weapon instances between tests
        weaponService.clearWeaponInstances();
    });

    describe('BurstRifleStrategy Integration', () => {
        it('should handle burst firing correctly', () => {
            weaponService.registerWeaponType('burst-rifle', BurstRifleStrategy);
            const instance = weaponService.getWeaponInstance('entity1', 'burst-rifle') as BurstRifleStrategy;
            
            const entity = new Entity();
            entity.addComponent(new Transform({ x: 0, y: 0 }));
            
            // First shot should start burst
            const result1 = instance.fire({
                shooter: entity,
                transform: entity.getComponent(Transform)!,
                weapon: { weaponId: 'burst-rifle' },
                definition: mockDefinition
            });
            
            expect(result1).toHaveLength(1);
            expect(result1[0].type).toBe('player');
            
            // Second shot should be blocked (burst delay)
            const result2 = instance.fire({
                shooter: entity,
                transform: entity.getComponent(Transform)!,
                weapon: { weaponId: 'burst-rifle' },
                definition: mockDefinition
            });
            
            expect(result2).toHaveLength(0); // Blocked by burst delay
        });

        it('should complete burst after delay', () => {
            weaponService.registerWeaponType('burst-rifle', BurstRifleStrategy);
            const instance = weaponService.getWeaponInstance('entity1', 'burst-rifle') as BurstRifleStrategy;
            
            const entity = new Entity();
            entity.addComponent(new Transform({ x: 0, y: 0 }));
            
            // First shot
            instance.fire({
                shooter: entity,
                transform: entity.getComponent(Transform)!,
                weapon: { weaponId: 'burst-rifle' },
                definition: mockDefinition
            });
            
            // First shot should fire immediately
            let result = instance.fire({
                shooter: entity,
                transform: entity.getComponent(Transform)!,
                weapon: { weaponId: 'burst-rifle' },
                definition: mockDefinition
            });
            expect(result).toHaveLength(1);
            
            // Second shot should wait for burst delay
            result = instance.fire({
                shooter: entity,
                transform: entity.getComponent(Transform)!,
                weapon: { weaponId: 'burst-rifle' },
                definition: mockDefinition
            });
            expect(result).toHaveLength(0); // Should not fire yet
            
            // Update heat to advance burst timer
            instance.updateHeat(mockDefinition, 0.15); // More than burst delay
            
            // Third shot should now fire
            result = instance.fire({
                shooter: entity,
                transform: entity.getComponent(Transform)!,
                weapon: { weaponId: 'burst-rifle' },
                definition: mockDefinition
            });
            expect(result).toHaveLength(1);
        });
    });

    describe('LaserCannonStrategy Integration', () => {
        it('should handle charging correctly', () => {
            weaponService.registerWeaponType('laser-cannon', LaserCannonStrategy);
            const instance = weaponService.getWeaponInstance('entity1', 'laser-cannon') as LaserCannonStrategy;
            
            const entity = new Entity();
            entity.addComponent(new Transform({ x: 0, y: 0 }));
            
            // First fire should start charging (no projectile)
            const result1 = instance.fire({
                shooter: entity,
                transform: entity.getComponent(Transform)!,
                weapon: { weaponId: 'laser-cannon' },
                definition: mockDefinition
            });
            
            expect(result1).toHaveLength(0);
            expect(instance.isCharging()).toBe(true);
            expect(instance.getChargeProgress()).toBe(0);
        });

        it('should fire after full charge', () => {
            weaponService.registerWeaponType('laser-cannon', LaserCannonStrategy);
            const instance = weaponService.getWeaponInstance('entity1', 'laser-cannon') as LaserCannonStrategy;
            
            const entity = new Entity();
            entity.addComponent(new Transform({ x: 0, y: 0 }));
            
            // Start charging
            instance.fire({
                shooter: entity,
                transform: entity.getComponent(Transform)!,
                weapon: { weaponId: 'laser-cannon' },
                definition: mockDefinition
            });
            
            expect(instance.isCharging()).toBe(true);
            
            // Simulate full charge time (more than 1 second)
            let fired = false;
            for (let i = 0; i < 70; i++) { // More than 1 second at 60 FPS
                const result = instance.fire({
                    shooter: entity,
                    transform: entity.getComponent(Transform)!,
                    weapon: { weaponId: 'laser-cannon' },
                    definition: mockDefinition
                });
                
                // Should fire at some point during charging
                if (result.length > 0) {
                    fired = true;
                    break;
                }
            }
            
            expect(fired).toBe(true);
            
            expect(instance.isCharging()).toBe(false);
        });
    });

    describe('Heat Management Integration', () => {
        it('should prevent firing when overheated', () => {
            weaponService.registerWeaponType('burst-rifle', BurstRifleStrategy);
            const instance = weaponService.getWeaponInstance('entity1', 'burst-rifle');
            
            const entity = new Entity();
            entity.addComponent(new Transform({ x: 0, y: 0 }));
            
            // Overheat the weapon
            (instance as any)._addHeat(100, 100);
            
            const result = instance.fire({
                shooter: entity,
                transform: entity.getComponent(Transform)!,
                weapon: { weaponId: 'burst-rifle' },
                definition: mockDefinition
            });
            
            expect(result).toHaveLength(0);
            expect(instance.isOverheated()).toBe(true);
        });

        it('should cool down over time', () => {
            weaponService.registerWeaponType('burst-rifle', BurstRifleStrategy);
            const instance = weaponService.getWeaponInstance('entity1', 'burst-rifle');
            
            // Overheat the weapon
            (instance as any)._addHeat(100, 100);
            expect(instance.isOverheated()).toBe(true);
            
            // Cool down over time (need to go below 50 to reset overheat)
            instance.updateHeat(mockDefinition, 12.0); // 12 seconds to go from 100 to 40 (below 50)
            
            expect(instance.isOverheated()).toBe(false);
            expect(instance.getHeatLevel(100)).toBeLessThan(1.0);
        });
    });

    describe('Weapon Service Integration', () => {
        it('should manage multiple weapon instances correctly', () => {
            weaponService.registerWeaponType('burst-rifle', BurstRifleStrategy);
            
            const instance1 = weaponService.getWeaponInstance('entity1', 'burst-rifle');
            const instance2 = weaponService.getWeaponInstance('entity2', 'burst-rifle');
            const instance3 = weaponService.getWeaponInstance('entity1', 'burst-rifle'); // Same as instance1
            
            expect(instance1).toBe(instance3); // Should be the same instance
            expect(instance1).not.toBe(instance2); // Different entities
        });

        it('should clean up weapon instances', () => {
            weaponService.registerWeaponType('burst-rifle', BurstRifleStrategy);
            
            weaponService.getWeaponInstance('entity1', 'burst-rifle');
            weaponService.getWeaponInstance('entity2', 'burst-rifle');
            
            expect(weaponService.getWeaponHeat('entity1', 'burst-rifle')).toBe(0);
            expect(weaponService.getWeaponHeat('entity2', 'burst-rifle')).toBe(0);
            
            weaponService.removeWeaponInstance('entity1', 'burst-rifle');
            
            // Should still work for entity2
            expect(weaponService.getWeaponHeat('entity2', 'burst-rifle')).toBe(0);
        });

        it('should handle unknown weapon types gracefully', () => {
            const instance = weaponService.getWeaponInstance('entity1', 'unknown-weapon');
            expect(instance).toBeNull();
            
            const heat = weaponService.getWeaponHeat('entity1', 'unknown-weapon');
            expect(heat).toBe(0);
            
            const isOverheated = weaponService.isWeaponOverheated('entity1', 'unknown-weapon');
            expect(isOverheated).toBe(false);
        });
    });

    describe('Edge Cases', () => {
        it('should handle zero heat decay rate', () => {
            const zeroDecayDefinition = { ...mockDefinition, heatDecayRate: 0 };
            weaponService.registerWeaponType('burst-rifle', BurstRifleStrategy);
            const instance = weaponService.getWeaponInstance('entity1', 'burst-rifle');
            
            (instance as any)._addHeat(50, 100);
            expect(instance.getHeatLevel(100)).toBe(0.5); // Should be 0.5 after adding heat
            
            instance.updateHeat(zeroDecayDefinition, 10.0); // 10 seconds
            
            expect(instance.getHeatLevel(100)).toBe(0.5); // Should not decay
        });

        it('should handle very high heat values', () => {
            weaponService.registerWeaponType('burst-rifle', BurstRifleStrategy);
            const instance = weaponService.getWeaponInstance('entity1', 'burst-rifle');
            
            (instance as any)._addHeat(1000, 100); // Try to add more than max
            expect(instance.getHeatLevel()).toBe(1.0); // Should be capped at max
        });

        it('should handle negative delta time', () => {
            weaponService.registerWeaponType('burst-rifle', BurstRifleStrategy);
            const instance = weaponService.getWeaponInstance('entity1', 'burst-rifle');
            
            (instance as any)._addHeat(50, 100);
            const initialHeat = instance.getHeatLevel(100);
            instance.updateHeat(mockDefinition, -1.0); // Negative time
            
            expect(instance.getHeatLevel(100)).toBe(initialHeat); // Should not change
        });
    });
});
