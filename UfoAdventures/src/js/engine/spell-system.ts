import { System, Entity } from './core';
import { EventBus } from './event-bus';
import { AbilityGameContext, EffectSpawnOptions } from './combat-types';
import { MagicInventory, SpellDefinition, SpellState, IMagicInventory } from './magic-inventory';
import { PlayerAbilities, Transform, Health } from './components';

export abstract class Spell {
    protected definition: SpellDefinition;
    protected caster: Entity;
    protected magicInventory: IMagicInventory;

    constructor(definition: SpellDefinition, caster: Entity, magicInventory: IMagicInventory) {
        this.definition = definition;
        this.caster = caster;
        this.magicInventory = magicInventory;
    }

    abstract canCast(): boolean;
    abstract cast(): boolean;
    abstract update(deltaTime: number): void;
    abstract isComplete(): boolean;
}

export class ShieldSpell extends Spell {
    private _duration: number = 0;
    private _isActive: boolean = false;

    canCast(): boolean {
        return this.magicInventory.canCast(this.definition.manaCost);
    }

    cast(): boolean {
        if (!this.canCast()) {
            return false;
        }

        if (!this.magicInventory.consumeMana(this.definition.manaCost)) {
            return false;
        }

        this._duration = this.definition.duration || 4;
        this._isActive = true;
        this.magicInventory.globalCooldown = this.definition.cooldown;

        return true;
    }

    update(deltaTime: number): void {
        if (this._isActive) {
            this._duration -= deltaTime;
            if (this._duration <= 0) {
                this._isActive = false;
            }
        }
    }

    isComplete(): boolean {
        return !this._isActive;
    }

    isActive(): boolean {
        return this._isActive;
    }

    getRemainingDuration(): number {
        return this._duration;
    }
}

export class StasisSpell extends Spell {
    private _duration: number = 0;
    private _isActive: boolean = false;
    private _affectedEntities: Entity[] = [];

    canCast(): boolean {
        return this.magicInventory.canCast(this.definition.manaCost);
    }

    cast(): boolean {
        if (!this.canCast()) {
            return false;
        }

        if (!this.magicInventory.consumeMana(this.definition.manaCost)) {
            return false;
        }

        this._duration = this.definition.duration || 2;
        this._isActive = true;
        this.magicInventory.globalCooldown = this.definition.cooldown;

        // Find and freeze nearby entities
        this._findAndFreezeEntities();

        return true;
    }

    update(deltaTime: number): void {
        if (this._isActive) {
            this._duration -= deltaTime;
            if (this._duration <= 0) {
                this._unfreezeEntities();
                this._isActive = false;
            }
        }
    }

    isComplete(): boolean {
        return !this._isActive;
    }

    private _findAndFreezeEntities(): void {
        const transform = this.caster.getComponent(Transform);
        if (!transform) return;

        const range = this.definition.range || 100;
        // This would need to be implemented with the game context to find nearby entities
        // For now, we'll just mark the spell as active
    }

    private _unfreezeEntities(): void {
        this._affectedEntities.forEach(entity => {
            // Unfreeze entity
            (entity as any)._stasisPaused = false;
        });
        this._affectedEntities = [];
    }
}

export class HealSpell extends Spell {
    private _healAmount: number = 0;

    canCast(): boolean {
        return this.magicInventory.canCast(this.definition.manaCost);
    }

    cast(): boolean {
        if (!this.canCast()) {
            return false;
        }

        if (!this.magicInventory.consumeMana(this.definition.manaCost)) {
            return false;
        }

        this._healAmount = this.definition.healing || 20;
        this.magicInventory.globalCooldown = this.definition.cooldown;

        // Apply healing
        const health = this.caster.getComponent(Health);
        if (health) {
            health.health = Math.min(health.max, health.health + this._healAmount);
        }

        return true;
    }

    update(_deltaTime: number): void {
        // Instant heal, no update needed
    }

    isComplete(): boolean {
        return true; // Instant spell
    }
}

export class SpellSystem extends System {
    private readonly game: AbilityGameContext;
    private readonly eventBus: EventBus | null;
    private readonly _activeSpells: Map<string, Spell> = new Map();
    private readonly _spellDefinitions: Map<string, SpellDefinition> = new Map();

    constructor(game: AbilityGameContext, eventBus: EventBus | null) {
        super();
        this.game = game;
        this.eventBus = eventBus ?? null;
        this._initializeSpellDefinitions();
    }

    private _initializeSpellDefinitions(): void {
        // Shield spell
        this._spellDefinitions.set('shield', {
            id: 'shield',
            name: 'Shield',
            manaCost: 20,
            cooldown: 0.25,
            castTime: 0,
            duration: 4,
            animation: 'shield-cast',
            sound: 'shield-cast'
        });

        // Stasis spell
        this._spellDefinitions.set('stasis', {
            id: 'stasis',
            name: 'Stasis Field',
            manaCost: 30,
            cooldown: 0.5,
            castTime: 0,
            duration: 2,
            range: 100,
            animation: 'stasis-cast',
            sound: 'stasis-cast'
        });

        // Heal spell
        this._spellDefinitions.set('heal', {
            id: 'heal',
            name: 'Heal',
            manaCost: 25,
            cooldown: 0.3,
            castTime: 0,
            healing: 20,
            animation: 'heal-cast',
            sound: 'heal-cast'
        });
    }

    update(entities: Entity[], delta: number): void {
        const deltaSeconds = delta / 60;

        entities.forEach(entity => {
            const magicInventory = entity.getComponent(MagicInventory);
            if (!magicInventory) {
                return;
            }

            // Update mana regeneration and cooldowns
            magicInventory.updateCooldown(deltaSeconds);

            const abilities = entity.getComponent(PlayerAbilities);
            if (!abilities) {
                return;
            }

            // Process spell casting
            this._processSpellCasting(entity, magicInventory, abilities, deltaSeconds);
        });

        // Update active spells
        this._updateActiveSpells(deltaSeconds);
    }

    private _processSpellCasting(entity: Entity, magicInventory: MagicInventory, abilities: PlayerAbilities, deltaSeconds: number): void {
        const entityId = entity.id || 'unknown';

        // Check for queued spells
        Object.keys(abilities.states).forEach(spellId => {
            const state = abilities.states[spellId];
            if (state?.queued) {
                this._castSpell(entity, spellId, magicInventory, abilities);
                state.queued = false;
            }
        });
    }

    private _castSpell(entity: Entity, spellId: string, magicInventory: MagicInventory, abilities: PlayerAbilities): void {
        const definition = this._spellDefinitions.get(spellId);
        if (!definition) {
            return;
        }

        let spell: Spell | null = null;

        switch (spellId) {
            case 'shield':
                spell = new ShieldSpell(definition, entity, magicInventory);
                break;
            case 'stasis':
                spell = new StasisSpell(definition, entity, magicInventory);
                break;
            case 'heal':
                spell = new HealSpell(definition, entity, magicInventory);
                break;
        }

        if (spell && spell.canCast()) {
            if (spell.cast()) {
                const entityId = entity.id || 'unknown';
                this._activeSpells.set(`${entityId}:${spellId}`, spell);

                // Update ability state
                const state = abilities.states[spellId];
                if (state) {
                    state.active = true;
                    state.remaining = definition.duration || 0;
                }

                // Spawn visual effects
                this._spawnSpellEffects(entity, definition);

                // Emit event
                this.eventBus?.emit('spell:cast', {
                    entity,
                    spellId,
                    definition
                });
            }
        }
    }

    private _updateActiveSpells(deltaSeconds: number): void {
        for (const [key, spell] of this._activeSpells.entries()) {
            spell.update(deltaSeconds);
            
            if (spell.isComplete()) {
                this._activeSpells.delete(key);
                
                // Emit completion event
                this.eventBus?.emit('spell:complete', {
                    spellId: key.split(':')[1]
                });
            }
        }
    }

    private _spawnSpellEffects(entity: Entity, definition: SpellDefinition): void {
        const transform = entity.getComponent(Transform);
        if (!transform) return;

        const effectOptions: EffectSpawnOptions = {
            position: { x: transform.position.x, y: transform.position.y },
            alpha: 1.0,
            scale: 1.0,
            tint: 0xffffff,
            lifeTime: 1.0,
            atlasAlias: 'vfx-atlas',
            animation: definition.animation || 'spell-cast'
        };

        this.game.spawnEffect(effectOptions);
    }

    // Public methods for external systems
    getSpellDefinition(spellId: string): SpellDefinition | null {
        return this._spellDefinitions.get(spellId) || null;
    }

    isSpellActive(entityId: string, spellId: string): boolean {
        return this._activeSpells.has(`${entityId}:${spellId}`);
    }

    getActiveSpells(): Map<string, Spell> {
        return new Map(this._activeSpells);
    }
}
