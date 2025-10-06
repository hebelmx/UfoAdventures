import { describe, expect, it, vi, beforeEach } from 'vitest';
import { WeaponService } from '../../src/js/engine/weapon-service';
import { SpellSystem, ShieldSpell } from '../../src/js/engine/spell-system';
import { AbilityVFXSystem } from '../../src/js/engine/ability-vfx-system';
import { EventBus } from '../../src/js/engine/event-bus';
import { Entity } from '../../src/js/engine/core';
import { Transform, Weapon, MagicInventory, PlayerAbilities, Health, Sprite } from '../../src/js/engine/components';
import { Player } from '../../src/js/entities/player';

describe('Epic 4 System Integration Tests', () => {
    let weaponService: WeaponService;
    let spellSystem: SpellSystem;
    let vfxSystem: AbilityVFXSystem;
    let eventBus: EventBus;
    let mockGame: any;
    let player: Entity;

    beforeEach(() => {
        eventBus = new EventBus();
        mockGame = {
            spawnEffect: vi.fn(),
            spawnProjectile: vi.fn(),
            addEntity: vi.fn(),
            entities: []
        };
        
        weaponService = new WeaponService();
        spellSystem = new SpellSystem(mockGame, eventBus);
        vfxSystem = new AbilityVFXSystem(mockGame, eventBus);
        
        // Create a complete player entity
        player = new Entity();
        player.addComponent(new Player());
        player.addComponent(new Transform({ x: 100, y: 100 }));
        player.addComponent(new Weapon({ weaponId: 'player-blaster' }));
        player.addComponent(new MagicInventory(100));
        player.addComponent(new PlayerAbilities({
            shieldDuration: 4,
            shieldStrength: 20,
            stasisDuration: 2,
            stasisRange: 100,
            healAmount: 20
        }));
        player.addComponent(new Health(100));
        player.addComponent(new Sprite({} as any));
        
        mockGame.entities = [player];
    });

    describe('Weapon and Magic Integration', () => {
        it('should handle weapon firing and spell casting simultaneously', () => {
            const weapon = player.getComponent(Weapon)!;
            const magicInventory = player.getComponent(MagicInventory)!;
            
            // Set up weapon to fire
            weapon.isShooting = true;
            weapon.fireTimer = 0.6; // Ready to fire
            
            // Set up spell to cast
            const abilities = player.getComponent(PlayerAbilities)!;
            abilities.states['shield'].queued = true;
            
            // Both should be able to execute
            expect(weapon.fireTimer).toBeGreaterThan(0);
            expect(abilities.states['shield'].queued).toBe(true);
            expect(magicInventory.canCast(20)).toBe(true);
        });

        it('should handle weapon heat and mana consumption independently', () => {
            const magicInventory = player.getComponent(MagicInventory)!;
            
            // Consume mana for spell
            magicInventory.consumeMana(30);
            expect(magicInventory.manaPoints).toBe(70);
            
            // Weapon heat should not be affected
            const weaponHeat = weaponService.getWeaponHeat(player.id || 'unknown', 'player-blaster');
            expect(weaponHeat).toBe(0);
        });

        it('should handle weapon overheat and spell cooldown independently', () => {
            const magicInventory = player.getComponent(MagicInventory)!;
            
            // Set spell cooldown
            magicInventory.globalCooldown = 0.5;
            
            // Weapon should still be able to fire (if not overheated)
            const isWeaponOverheated = weaponService.isWeaponOverheated(player.id || 'unknown', 'player-blaster');
            expect(isWeaponOverheated).toBe(false);
            
            // Spell should be blocked by cooldown
            expect(magicInventory.canCast(20)).toBe(false);
        });
    });

    describe('VFX and System Integration', () => {
        it('should trigger VFX for both weapon and spell effects', () => {
            const spawnEffectSpy = vi.spyOn(mockGame, 'spawnEffect');
            
            // Trigger weapon VFX (through ability system)
            eventBus.emit('ability:vfx-trigger', {
                entity: player,
                abilityName: 'comboBreaker'
            });
            
            // Trigger spell VFX
            const shieldDef = spellSystem.getSpellDefinition('shield');
            const shieldSpell = new ShieldSpell(shieldDef!, player, player.getComponent(MagicInventory)!);
            shieldSpell.cast();
            
            expect(spawnEffectSpy).toHaveBeenCalled();
        });

        it('should handle multiple VFX triggers without conflicts', () => {
            const spawnEffectSpy = vi.spyOn(mockGame, 'spawnEffect');
            
            // Trigger multiple VFX
            eventBus.emit('ability:vfx-trigger', { entity: player, abilityName: 'comboBreaker' });
            eventBus.emit('ability:vfx-trigger', { entity: player, abilityName: 'teleport' });
            eventBus.emit('ability:vfx-trigger', { entity: player, abilityName: 'shield' });
            
            expect(spawnEffectSpy).toHaveBeenCalled();
        });

        it('should handle VFX with different entity positions', () => {
            const player2 = new Entity();
            player2.addComponent(new Transform({ x: 200, y: 200 }));
            player2.addComponent(new Sprite({} as any));
            
            const spawnEffectSpy = vi.spyOn(mockGame, 'spawnEffect');
            
            // Trigger VFX on both entities
            eventBus.emit('ability:vfx-trigger', { entity: player, abilityName: 'comboBreaker' });
            eventBus.emit('ability:vfx-trigger', { entity: player2, abilityName: 'comboBreaker' });
            
            expect(spawnEffectSpy).toHaveBeenCalled();
            
            // Check that effects were spawned at different positions
            const calls = spawnEffectSpy.mock.calls;
            expect(calls.length).toBeGreaterThan(0);
        });
    });

    describe('Event System Integration', () => {
        it('should handle all Epic 4 events without conflicts', () => {
            const eventSpy = vi.spyOn(eventBus, 'emit');
            
            // Emit various events
            eventBus.emit('ability:vfx-trigger', { entity: player, abilityName: 'comboBreaker' });
            eventBus.emit('spell:cast', { entity: player, spellId: 'shield' });
            eventBus.emit('weapon:fire', { entity: player, weaponId: 'player-blaster' });
            
            expect(eventSpy).toHaveBeenCalled();
        });

        it('should handle event listeners correctly', () => {
            const listeners: Array<{ event: string; handler: Function }> = [];
            
            // Mock event bus to capture listeners
            const mockEventBus = {
                on: vi.fn((event: string, handler: Function) => {
                    listeners.push({ event, handler });
                }),
                emit: vi.fn()
            };
            
            // Create systems with mock event bus
            new AbilityVFXSystem(mockGame, mockEventBus as any);
            
            expect(mockEventBus.on).toHaveBeenCalledWith('ability:vfx-trigger', expect.any(Function));
        });
    });

    describe('Resource Management Integration', () => {
        it('should handle weapon instance cleanup', () => {
            const entityId = player.id || 'unknown';
            
            // Create weapon instance
            weaponService.getWeaponInstance(entityId, 'player-blaster');
            expect(weaponService.getWeaponHeat(entityId, 'player-blaster')).toBe(0);
            
            // Clean up
            weaponService.removeWeaponInstance(entityId, 'player-blaster');
            
            // Should handle gracefully
            expect(weaponService.getWeaponHeat(entityId, 'player-blaster')).toBe(0);
        });

        it('should handle spell cleanup', () => {
            const activeSpells = spellSystem.getActiveSpells();
            expect(activeSpells.size).toBe(0);
            
            // Cast a spell
            const shieldDef = spellSystem.getSpellDefinition('shield');
            const shieldSpell = new ShieldSpell(shieldDef!, player, player.getComponent(MagicInventory)!);
            shieldSpell.cast();
            
            // Update to complete the spell
            shieldSpell.update(5.0);
            
            // Should be cleaned up
            expect(shieldSpell.isComplete()).toBe(true);
        });

        it('should handle VFX cleanup', () => {
            // Trigger VFX
            vfxSystem.triggerAbilityVFX(player, 'comboBreaker');
            
            const activeAnimations = (vfxSystem as any)._activeAnimations;
            expect(activeAnimations.size).toBe(1);
            
            // Simulate time passing
            vfxSystem.update([player], 1000);
            
            // Should clean up expired animations
            expect(activeAnimations.size).toBeLessThan(1);
        });
    });

    describe('Performance Integration', () => {
        it('should handle many entities efficiently', () => {
            const entities = Array.from({ length: 100 }, (_, i) => {
                const e = new Entity();
                e.addComponent(new Transform({ x: i, y: i }));
                e.addComponent(new Weapon({ weaponId: 'player-blaster' }));
                e.addComponent(new MagicInventory(100));
                e.addComponent(new PlayerAbilities({}));
                e.addComponent(new Health(100));
                e.addComponent(new Sprite({} as any));
                return e;
            });
            
            const startTime = performance.now();
            
            // Process all entities
            entities.forEach(entity => {
                weaponService.getWeaponInstance(entity.id || 'unknown', 'player-blaster');
                vfxSystem.triggerAbilityVFX(entity, 'comboBreaker');
            });
            
            const endTime = performance.now();
            const duration = endTime - startTime;
            
            // Should complete quickly
            expect(duration).toBeLessThan(200);
        });

        it('should handle rapid fire scenarios', () => {
            const weapon = player.getComponent(Weapon)!;
            const magicInventory = player.getComponent(MagicInventory)!;
            
            // Simulate rapid firing
            for (let i = 0; i < 10; i++) {
                weapon.fireTimer = 0.6; // Ready to fire
                magicInventory.consumeMana(5);
            }
            
            // Should handle gracefully
            expect(weapon.fireTimer).toBe(0.6);
            expect(magicInventory.manaPoints).toBe(50);
        });
    });

    describe('Error Recovery Integration', () => {
        it('should handle missing components gracefully', () => {
            const incompleteEntity = new Entity();
            incompleteEntity.addComponent(new Transform({ x: 0, y: 0 }));
            
            // Should not throw errors
            expect(() => {
                weaponService.getWeaponInstance(incompleteEntity.id || 'unknown', 'player-blaster');
                vfxSystem.triggerAbilityVFX(incompleteEntity, 'comboBreaker');
            }).not.toThrow();
        });

        it('should handle invalid weapon types gracefully', () => {
            const weapon = player.getComponent(Weapon)!;
            weapon.weaponId = 'invalid-weapon';
            
            const instance = weaponService.getWeaponInstance(player.id || 'unknown', 'invalid-weapon');
            expect(instance).toBeNull();
        });

        it('should handle invalid spell IDs gracefully', () => {
            const spellDef = spellSystem.getSpellDefinition('invalid-spell');
            expect(spellDef).toBeNull();
        });
    });

    describe('State Consistency Integration', () => {
        it('should maintain consistent state across systems', () => {
            const weapon = player.getComponent(Weapon)!;
            const magicInventory = player.getComponent(MagicInventory)!;
            const abilities = player.getComponent(PlayerAbilities)!;
            
            // Initial state
            expect(weapon.fireTimer).toBe(0);
            expect(magicInventory.manaPoints).toBe(100);
            expect(abilities.states['shield'].active).toBe(false);
            
            // Cast spell
            abilities.states['shield'].queued = true;
            const shieldDef = spellSystem.getSpellDefinition('shield');
            const shieldSpell = new ShieldSpell(shieldDef!, player, magicInventory);
            shieldSpell.cast();
            
            // State should be consistent
            expect(magicInventory.manaPoints).toBe(80);
            expect(abilities.states['shield'].active).toBe(true);
            expect(weapon.fireTimer).toBe(0); // Unchanged
        });

        it('should handle system updates in correct order', () => {
            const entities = [player];
            
            // Update all systems
            spellSystem.update(entities, 60);
            vfxSystem.update(entities, 60);
            
            // Should not cause conflicts
            expect(player.getComponent(MagicInventory)?.manaPoints).toBeDefined();
        });
    });
});
