import { describe, expect, it, vi, beforeEach } from 'vitest';
import { SpellSystem, ShieldSpell, StasisSpell, HealSpell } from '../../src/js/engine/spell-system';
import { MagicInventory, SpellDefinition } from '../../src/js/engine/magic-inventory';
import { EventBus } from '../../src/js/engine/event-bus';
import { Entity } from '../../src/js/engine/core';
import { Health, PlayerAbilities, Transform } from '../../src/js/engine/components';

describe('Spell Integration Tests', () => {
    let spellSystem: SpellSystem;
    let mockGame: any;
    let eventBus: EventBus;
    let entity: Entity;
    let magicInventory: MagicInventory;
    let abilities: PlayerAbilities;

    beforeEach(() => {
        eventBus = new EventBus();
        mockGame = {
            spawnEffect: vi.fn()
        };
        spellSystem = new SpellSystem(mockGame, eventBus);
        
        entity = new Entity();
        entity.addComponent(new Transform({ x: 100, y: 100 }));
        magicInventory = new MagicInventory(100);
        abilities = new PlayerAbilities({
            shieldDuration: 4,
            shieldStrength: 20,
            stasisDuration: 2,
            stasisRange: 100,
            healAmount: 20
        });
        
        entity.addComponent(magicInventory);
        entity.addComponent(abilities);
    });

    describe('Spell Casting Integration', () => {
        it('should cast shield spell and update ability state', () => {
            const shieldDef = spellSystem.getSpellDefinition('shield');
            expect(shieldDef).toBeDefined();
            
            const spell = new ShieldSpell(shieldDef!, entity, magicInventory);
            
            expect(spell.canCast()).toBe(true);
            expect(spell.cast()).toBe(true);
            
            // Check mana consumption
            expect(magicInventory.manaPoints).toBe(80); // 100 - 20
            expect(magicInventory.globalCooldown).toBe(0.25);
            
            // Check spell state (not ability state - that's handled by SpellSystem)
            expect(spell.isActive()).toBe(true);
            expect(spell.getRemainingDuration()).toBe(4);
        });

        it('should cast heal spell and restore health', () => {
            const health = new Health(50);
            health.max = 100;
            entity.addComponent(health);
            
            const healDef = spellSystem.getSpellDefinition('heal');
            const spell = new HealSpell(healDef!, entity, magicInventory);
            
            expect(spell.canCast()).toBe(true);
            expect(spell.cast()).toBe(true);
            
            expect(health.health).toBe(70); // 50 + 20
            expect(magicInventory.manaPoints).toBe(75); // 100 - 25
        });

        it('should prevent casting when on cooldown', () => {
            const shieldDef = spellSystem.getSpellDefinition('shield');
            const spell = new ShieldSpell(shieldDef!, entity, magicInventory);
            
            // Cast first spell
            spell.cast();
            expect(magicInventory.globalCooldown).toBe(0.25);
            
            // Try to cast another spell immediately
            const healDef = spellSystem.getSpellDefinition('heal');
            const healSpell = new HealSpell(healDef!, entity, magicInventory);
            
            expect(healSpell.canCast()).toBe(false);
            expect(healSpell.cast()).toBe(false);
        });

        it('should allow casting after cooldown expires', () => {
            const shieldDef = spellSystem.getSpellDefinition('shield');
            const spell = new ShieldSpell(shieldDef!, entity, magicInventory);
            
            // Cast first spell
            spell.cast();
            
            // Simulate cooldown expiration
            magicInventory.updateCooldown(0.3); // More than 0.25 cooldown
            
            // Should be able to cast again
            const healDef = spellSystem.getSpellDefinition('heal');
            const healSpell = new HealSpell(healDef!, entity, magicInventory);
            
            expect(healSpell.canCast()).toBe(true);
        });
    });

    describe('Mana Management Integration', () => {
        it('should regenerate mana over time', () => {
            // Consume some mana
            magicInventory.consumeMana(50);
            expect(magicInventory.manaPoints).toBe(50);
            
            // Simulate time passing (more than regen delay)
            magicInventory.updateCooldown(3.0); // 3 seconds
            
            // Mana should have regenerated (5 mana/sec * 1 second = 5 mana)
            expect(magicInventory.manaPoints).toBeGreaterThan(50);
        });

        it('should not regenerate mana during cooldown delay', () => {
            magicInventory.consumeMana(50);
            const initialMana = magicInventory.manaPoints;
            
            // Update for less than regen delay
            magicInventory.updateCooldown(1.0); // 1 second (less than 2 second delay)
            
            expect(magicInventory.manaPoints).toBe(initialMana);
        });

        it('should cap mana at maximum', () => {
            magicInventory.consumeMana(20);
            expect(magicInventory.manaPoints).toBe(80);
            
            // Regenerate more than needed
            magicInventory.regenerateMana(50);
            
            expect(magicInventory.manaPoints).toBe(100); // Should be capped
        });

        it('should handle mana regeneration rate changes', () => {
            magicInventory.setManaRegenRate(10); // 10 mana per second
            magicInventory.consumeMana(50);
            
            // Update for 3 seconds (more than regen delay)
            magicInventory.updateCooldown(3.0);
            
            expect(magicInventory.manaPoints).toBeGreaterThan(50);
        });
    });

    describe('Spell Duration Integration', () => {
        it('should update shield duration correctly', () => {
            const shieldDef = spellSystem.getSpellDefinition('shield');
            const spell = new ShieldSpell(shieldDef!, entity, magicInventory);
            
            spell.cast();
            expect(spell.isComplete()).toBe(false);
            
            // Update for 2 seconds
            spell.update(2.0);
            expect(spell.isComplete()).toBe(false);
            
            // Update for 3 more seconds (total 5, duration is 4)
            spell.update(3.0);
            expect(spell.isComplete()).toBe(true);
        });

        it('should handle instant spells correctly', () => {
            const healDef = spellSystem.getSpellDefinition('heal');
            const spell = new HealSpell(healDef!, entity, magicInventory);
            
            spell.cast();
            expect(spell.isComplete()).toBe(true);
            
            // Update should not change completion state
            spell.update(1.0);
            expect(spell.isComplete()).toBe(true);
        });
    });

    describe('Event System Integration', () => {
        it('should handle spell casting without errors', () => {
            const shieldDef = spellSystem.getSpellDefinition('shield');
            const spell = new ShieldSpell(shieldDef!, entity, magicInventory);
            
            // Should not throw errors
            expect(() => {
                spell.cast();
            }).not.toThrow();
        });

        it('should handle spell completion without errors', () => {
            const shieldDef = spellSystem.getSpellDefinition('shield');
            const spell = new ShieldSpell(shieldDef!, entity, magicInventory);
            
            spell.cast();
            
            // Should not throw errors
            expect(() => {
                spell.update(5.0); // Complete the spell
            }).not.toThrow();
        });
    });

    describe('Edge Cases', () => {
        it('should handle zero mana cost spells', () => {
            const zeroCostDef: SpellDefinition = {
                id: 'free-spell',
                name: 'Free Spell',
                manaCost: 0,
                cooldown: 0.1,
                castTime: 0,
                duration: 1
            };
            
            const spell = new ShieldSpell(zeroCostDef, entity, magicInventory);
            
            expect(spell.canCast()).toBe(true);
            expect(spell.cast()).toBe(true);
            expect(magicInventory.manaPoints).toBe(100); // Unchanged
        });

        it('should handle spells with zero duration', () => {
            const instantDef: SpellDefinition = {
                id: 'instant-spell',
                name: 'Instant Spell',
                manaCost: 10,
                cooldown: 0.1,
                castTime: 0,
                duration: 0
            };
            
            const spell = new ShieldSpell(instantDef, entity, magicInventory);
            
            spell.cast();
            // Shield spell with zero duration should still be active until manually updated
            expect(spell.isActive()).toBe(true);
        });

        it('should handle insufficient mana gracefully', () => {
            magicInventory.consumeMana(90); // Leave only 10 mana
            expect(magicInventory.manaPoints).toBe(10);
            
            const shieldDef = spellSystem.getSpellDefinition('shield');
            const spell = new ShieldSpell(shieldDef!, entity, magicInventory);
            
            expect(spell.canCast()).toBe(false);
            expect(spell.cast()).toBe(false);
            expect(magicInventory.manaPoints).toBe(10); // Unchanged
        });

        it('should handle negative delta time', () => {
            const shieldDef = spellSystem.getSpellDefinition('shield');
            const spell = new ShieldSpell(shieldDef!, entity, magicInventory);
            
            spell.cast();
            const initialRemaining = (spell as any)._duration;
            
            spell.update(-1.0); // Negative time
            
            // Duration should not decrease with negative time
            expect((spell as any)._duration).toBeGreaterThanOrEqual(initialRemaining);
        });
    });

    describe('Multiple Spells Integration', () => {
        it('should handle multiple active spells', () => {
            const shieldDef = spellSystem.getSpellDefinition('shield');
            const healDef = spellSystem.getSpellDefinition('heal');
            
            const shieldSpell = new ShieldSpell(shieldDef!, entity, magicInventory);
            const healSpell = new HealSpell(healDef!, entity, magicInventory);
            
            // Cast both spells
            shieldSpell.cast();
            healSpell.cast();
            
            expect(shieldSpell.isComplete()).toBe(false);
            expect(healSpell.isComplete()).toBe(true);
            
            // Update shield spell
            shieldSpell.update(5.0);
            expect(shieldSpell.isComplete()).toBe(true);
        });

        it('should handle spell interactions correctly', () => {
            // Cast shield first
            const shieldDef = spellSystem.getSpellDefinition('shield');
            const shieldSpell = new ShieldSpell(shieldDef!, entity, magicInventory);
            shieldSpell.cast();
            
            // Wait for cooldown
            magicInventory.updateCooldown(0.3);
            
            // Cast heal
            const healDef = spellSystem.getSpellDefinition('heal');
            const healSpell = new HealSpell(healDef!, entity, magicInventory);
            healSpell.cast();
            
            expect(shieldSpell.isComplete()).toBe(false); // Still active
            expect(healSpell.isComplete()).toBe(true); // Instant
        });
    });
});
