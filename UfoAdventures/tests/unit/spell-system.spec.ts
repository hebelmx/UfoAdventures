import { describe, expect, it, vi, beforeEach } from 'vitest';
import { SpellSystem, ShieldSpell, StasisSpell, HealSpell } from '../../src/js/engine/spell-system';
import { MagicInventory, SpellDefinition } from '../../src/js/engine/magic-inventory';
import { EventBus } from '../../src/js/engine/event-bus';
import { Entity } from '../../src/js/engine/core';
import { Health } from '../../src/js/engine/components';

describe('SpellSystem', () => {
    let spellSystem: SpellSystem;
    let mockGame: any;
    let eventBus: EventBus;

    beforeEach(() => {
        eventBus = new EventBus();
        mockGame = {
            spawnEffect: vi.fn()
        };
        spellSystem = new SpellSystem(mockGame, eventBus);
    });

    it('should initialize with spell definitions', () => {
        const shieldDef = spellSystem.getSpellDefinition('shield');
        expect(shieldDef).toBeDefined();
        expect(shieldDef?.name).toBe('Shield');
        expect(shieldDef?.manaCost).toBe(20);
    });

    it('should create shield spell instances', () => {
        const entity = new Entity();
        const magicInventory = new MagicInventory(100);
        const definition: SpellDefinition = {
            id: 'shield',
            name: 'Shield',
            manaCost: 20,
            cooldown: 0.25,
            castTime: 0,
            duration: 4
        };

        const spell = new ShieldSpell(definition, entity, magicInventory);
        expect(spell).toBeInstanceOf(ShieldSpell);
    });

    it('should cast shield spell when conditions are met', () => {
        const entity = new Entity();
        const magicInventory = new MagicInventory(100);
        const definition: SpellDefinition = {
            id: 'shield',
            name: 'Shield',
            manaCost: 20,
            cooldown: 0.25,
            castTime: 0,
            duration: 4
        };

        const spell = new ShieldSpell(definition, entity, magicInventory);
        
        expect(spell.canCast()).toBe(true);
        expect(spell.cast()).toBe(true);
        expect(magicInventory.manaPoints).toBe(80); // 100 - 20
        expect(magicInventory.globalCooldown).toBe(0.25);
    });

    it('should not cast shield spell when insufficient mana', () => {
        const entity = new Entity();
        const magicInventory = new MagicInventory(10); // Low mana
        const definition: SpellDefinition = {
            id: 'shield',
            name: 'Shield',
            manaCost: 20,
            cooldown: 0.25,
            castTime: 0,
            duration: 4
        };

        const spell = new ShieldSpell(definition, entity, magicInventory);
        
        expect(spell.canCast()).toBe(false);
        expect(spell.cast()).toBe(false);
        expect(magicInventory.manaPoints).toBe(10); // Unchanged
    });

    it('should update shield spell duration', () => {
        const entity = new Entity();
        const magicInventory = new MagicInventory(100);
        const definition: SpellDefinition = {
            id: 'shield',
            name: 'Shield',
            manaCost: 20,
            cooldown: 0.25,
            castTime: 0,
            duration: 4
        };

        const spell = new ShieldSpell(definition, entity, magicInventory);
        spell.cast();
        
        expect(spell.isComplete()).toBe(false);
        
        // Update for 2 seconds
        spell.update(2.0);
        expect(spell.isComplete()).toBe(false);
        
        // Update for 3 more seconds (total 5, duration is 4)
        spell.update(3.0);
        expect(spell.isComplete()).toBe(true);
    });

    it('should cast heal spell and restore health', () => {
        const entity = new Entity();
        const healthComponent = new Health(50); // 50 health, max 50
        healthComponent.max = 100; // Set max to 100
        entity.addComponent(healthComponent);
        const magicInventory = new MagicInventory(100);
        const definition: SpellDefinition = {
            id: 'heal',
            name: 'Heal',
            manaCost: 25,
            cooldown: 0.3,
            castTime: 0,
            healing: 20
        };

        const spell = new HealSpell(definition, entity, magicInventory);
        
        expect(spell.canCast()).toBe(true);
        expect(spell.cast()).toBe(true);
        
        const health = entity.getComponent(Health);
        expect(health?.health).toBe(70); // 50 + 20
        expect(magicInventory.manaPoints).toBe(75); // 100 - 25
    });

    it('should create stasis spell', () => {
        const entity = new Entity();
        const magicInventory = new MagicInventory(100);
        const definition: SpellDefinition = {
            id: 'stasis',
            name: 'Stasis Field',
            manaCost: 30,
            cooldown: 0.5,
            castTime: 0,
            duration: 2,
            range: 100
        };

        const spell = new StasisSpell(definition, entity, magicInventory);
        expect(spell).toBeInstanceOf(StasisSpell);
        expect(spell.canCast()).toBe(true);
    });
});
