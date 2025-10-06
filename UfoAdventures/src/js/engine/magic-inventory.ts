import { Component } from './core';

export interface IMagicInventory {
    manaPoints: number;
    maxMana: number;
    globalCooldown: number;
    canCast(cost: number): boolean;
    consumeMana(amount: number): boolean;
    regenerateMana(amount: number): void;
    updateCooldown(deltaTime: number): void;
}

export interface SpellDefinition {
    id: string;
    name: string;
    manaCost: number;
    cooldown: number;
    castTime: number;
    range?: number;
    duration?: number;
    damage?: number;
    healing?: number;
    effects?: string[];
    animation?: string;
    sound?: string;
}

export interface SpellState {
    queued: boolean;
    active: boolean;
    remaining: number;
    cooldown: number;
    castProgress: number;
}

export class MagicInventory extends Component implements IMagicInventory {
    manaPoints: number;
    maxMana: number;
    globalCooldown: number;
    private _manaRegenRate: number = 5; // Mana per second
    private _manaRegenDelay: number = 2; // Seconds before mana starts regenerating
    private _lastCastTime: number = 0;
    private _timeSinceLastCast: number = 0;

    constructor(maxMana = 100) {
        super();
        this.maxMana = maxMana;
        this.manaPoints = maxMana;
        this.globalCooldown = 0;
    }

    canCast(cost: number): boolean {
        return this.manaPoints >= cost && this.globalCooldown <= 0;
    }

    consumeMana(amount: number): boolean {
        if (this.manaPoints >= amount) {
            this.manaPoints = Math.max(0, this.manaPoints - amount);
            this._timeSinceLastCast = 0; // Reset timer
            return true;
        } else {
            // Consume all available mana if not enough
            this.manaPoints = 0;
            this._timeSinceLastCast = 0; // Reset timer
            return false;
        }
    }

    regenerateMana(amount: number): void {
        this.manaPoints = Math.min(this.maxMana, this.manaPoints + amount);
    }

    updateCooldown(deltaTime: number): void {
        if (deltaTime < 0) {
            return; // Don't update with negative time
        }
        
        this.globalCooldown = Math.max(0, this.globalCooldown - deltaTime);
        
        // Update time since last cast
        this._timeSinceLastCast += deltaTime;
        
        // Regenerate mana if enough time has passed
        if (this._timeSinceLastCast >= this._manaRegenDelay) {
            this.regenerateMana(this._manaRegenRate * deltaTime);
        }
    }

    // Get mana percentage (0-1)
    getManaPercentage(): number {
        return this.manaPoints / this.maxMana;
    }

    // Set mana regeneration rate
    setManaRegenRate(rate: number): void {
        this._manaRegenRate = rate;
    }

    // Set mana regeneration delay
    setManaRegenDelay(delay: number): void {
        this._manaRegenDelay = delay;
    }
}
