import { describe, expect, it, vi, beforeEach } from 'vitest';
import { WeaponService, WeaponBase, WeaponDefinitionExtras } from '../../src/js/engine/weapon-service';
import { Entity } from '../../src/js/engine/core';

class TestWeaponStrategy extends WeaponBase {
    fire(params: { shooter: any; transform: any; weapon: any; definition: WeaponDefinitionExtras }) {
        const heatPerShot = params.definition.heatPerShot || 5;
        const maxHeat = params.definition.maxHeat || 100;
        
        if (!this._canFire(params.definition)) {
            return [];
        }
        
        this._addHeat(heatPerShot, maxHeat);
        
        return [{
            type: 'test',
            speed: 10,
            damage: 5
        }];
    }
}

describe('WeaponService', () => {
    let weaponService: WeaponService;
    let mockDefinition: WeaponDefinitionExtras;

    beforeEach(() => {
        weaponService = new WeaponService();
        mockDefinition = {
            cooldown: 0.5,
            projectiles: [],
            heatPerShot: 10,
            maxHeat: 100,
            heatDecayRate: 5
        };
    });

    it('should register weapon types', () => {
        weaponService.registerWeaponType('test-weapon', TestWeaponStrategy);
        const strategy = weaponService.createStrategy('test-weapon');
        expect(strategy).toBeInstanceOf(TestWeaponStrategy);
    });

    it('should create weapon instances for entities', () => {
        weaponService.registerWeaponType('test-weapon', TestWeaponStrategy);
        const instance = weaponService.getWeaponInstance('entity1', 'test-weapon');
        expect(instance).toBeInstanceOf(TestWeaponStrategy);
    });

    it('should manage weapon heat', () => {
        weaponService.registerWeaponType('test-weapon', TestWeaponStrategy);
        const instance = weaponService.getWeaponInstance('entity1', 'test-weapon');
        
        // Add heat
        (instance as any)._addHeat(50, 100);
        expect(instance.getHeatLevel()).toBe(0.5);
        
        // Check overheat
        (instance as any)._addHeat(50, 100);
        expect(instance.isOverheated()).toBe(true);
    });

    it('should update weapon heat over time', () => {
        weaponService.registerWeaponType('test-weapon', TestWeaponStrategy);
        weaponService.updateWeaponHeat('entity1', 'test-weapon', 1.0); // 1 second
        
        const heat = weaponService.getWeaponHeat('entity1', 'test-weapon');
        expect(heat).toBeLessThan(1.0); // Should have decayed
    });

    it('should prevent firing when overheated', () => {
        weaponService.registerWeaponType('test-weapon', TestWeaponStrategy);
        const instance = weaponService.getWeaponInstance('entity1', 'test-weapon');
        
        // Overheat the weapon
        (instance as any)._addHeat(100, 100);
        
        const result = instance.fire({
            shooter: new Entity(),
            transform: { position: { x: 0, y: 0 } },
            weapon: { weaponId: 'test-weapon' },
            definition: mockDefinition
        });
        
        expect(result).toEqual([]); // Should return empty array when overheated
    });
});
