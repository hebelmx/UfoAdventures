import { System, Entity } from './core';
import { EventBus } from './event-bus';
import { AbilityGameContext, EffectSpawnOptions } from './combat-types';
import { PlayerAbilities, Transform, Sprite } from './components';
import { Player } from '../entities/player';

export interface AbilityVFXConfig {
    animation?: string;
    sound?: string;
    effects: EffectSpawnOptions[];
    duration?: number;
    tint?: number;
    scale?: number;
    alpha?: number;
}

export interface AbilityAnimationConfig {
    animation: string;
    duration: number;
    revertAfter?: number;
    tint?: number;
    scale?: number;
    alpha?: number;
}

export class AbilityVFXSystem extends System {
    private readonly game: AbilityGameContext;
    private readonly eventBus: EventBus | null;
    private readonly _vfxConfigs: Map<string, AbilityVFXConfig> = new Map();
    private readonly _animationConfigs: Map<string, AbilityAnimationConfig> = new Map();
    private readonly _activeAnimations: Map<string, { entity: Entity; endTime: number; originalSprite?: any }> = new Map();

    constructor(game: AbilityGameContext, eventBus: EventBus | null) {
        super();
        this.game = game;
        this.eventBus = eventBus ?? null;
        this._initializeVFXConfigs();
        this._initializeAnimationConfigs();
        this._bindEvents();
    }

    private _bindEvents(): void {
        if (!this.eventBus) {
            return;
        }

        this.eventBus.on('ability:vfx-trigger', (payload: any) => {
            const { entity, abilityName, origin, destination } = payload;
            
            if (abilityName === 'teleport' && origin && destination) {
                this.triggerTeleportVFX(entity, origin, destination);
            } else {
                this.triggerAbilityVFX(entity, abilityName);
            }
        });
    }

    private _initializeVFXConfigs(): void {
        // Combo Breaker VFX
        this._vfxConfigs.set('comboBreaker', {
            animation: 'combo-breaker-cast',
            sound: 'combo-breaker-cast',
            effects: [
                {
                    position: { x: 0, y: 0 }, // Will be set relative to player
                    tint: 0xffaa33,
                    alpha: 0.95,
                    lifeTime: 0.4,
                    fade: 1.2,
                    scale: 1.2,
                    atlasAlias: 'vfx-atlas',
                    animation: 'comboBreaker',
                    animationSpeed: 0.18,
                    loop: false
                },
                {
                    position: { x: 0, y: 0 },
                    tint: 0xff6600,
                    alpha: 0.7,
                    lifeTime: 0.6,
                    fade: 0.8,
                    scale: 2.0,
                    atlasAlias: 'vfx-atlas',
                    animation: 'shockwave',
                    animationSpeed: 0.15,
                    loop: false
                }
            ],
            duration: 0.4
        });

        // Teleport VFX
        this._vfxConfigs.set('teleport', {
            animation: 'teleport-cast',
            sound: 'teleport-cast',
            effects: [
                {
                    position: { x: 0, y: 0 }, // Origin position
                    tint: 0x66ccff,
                    alpha: 0.7,
                    lifeTime: 0.25,
                    fade: 1.5,
                    scale: 0.9,
                    atlasAlias: 'vfx-atlas',
                    animation: 'teleport-trail',
                    animationSpeed: 0.24,
                    loop: false
                },
                {
                    position: { x: 0, y: 0 }, // Destination position
                    tint: 0xffffff,
                    alpha: 0.8,
                    lifeTime: 0.3,
                    fade: 1.8,
                    scale: 1.1,
                    atlasAlias: 'vfx-atlas',
                    animation: 'teleport-arrival',
                    animationSpeed: 0.2,
                    loop: false
                }
            ],
            duration: 0.3
        });

        // Shield VFX
        this._vfxConfigs.set('shield', {
            animation: 'shield-cast',
            sound: 'shield-cast',
            effects: [
                {
                    position: { x: 0, y: 0 },
                    tint: 0x00ff88,
                    alpha: 0.8,
                    lifeTime: 0.5,
                    fade: 0.5,
                    scale: 1.5,
                    atlasAlias: 'vfx-atlas',
                    animation: 'shield-bubble',
                    animationSpeed: 0.12,
                    loop: false
                },
                {
                    position: { x: 0, y: 0 },
                    tint: 0x88ffaa,
                    alpha: 0.6,
                    lifeTime: 1.0,
                    fade: 0.3,
                    scale: 2.0,
                    atlasAlias: 'vfx-atlas',
                    animation: 'shield-aura',
                    animationSpeed: 0.08,
                    loop: true
                }
            ],
            duration: 0.5
        });

        // Stasis VFX
        this._vfxConfigs.set('stasis', {
            animation: 'stasis-cast',
            sound: 'stasis-cast',
            effects: [
                {
                    position: { x: 0, y: 0 },
                    tint: 0xaa44ff,
                    alpha: 0.9,
                    lifeTime: 0.3,
                    fade: 1.0,
                    scale: 1.8,
                    atlasAlias: 'vfx-atlas',
                    animation: 'stasis-field',
                    animationSpeed: 0.2,
                    loop: false
                },
                {
                    position: { x: 0, y: 0 },
                    tint: 0x8844aa,
                    alpha: 0.5,
                    lifeTime: 2.0,
                    fade: 0.2,
                    scale: 3.0,
                    atlasAlias: 'vfx-atlas',
                    animation: 'stasis-zone',
                    animationSpeed: 0.05,
                    loop: true
                }
            ],
            duration: 0.3
        });

        // Heal VFX
        this._vfxConfigs.set('heal', {
            animation: 'heal-cast',
            sound: 'heal-cast',
            effects: [
                {
                    position: { x: 0, y: 0 },
                    tint: 0x44ff44,
                    alpha: 0.8,
                    lifeTime: 0.4,
                    fade: 0.8,
                    scale: 1.3,
                    atlasAlias: 'vfx-atlas',
                    animation: 'heal-burst',
                    animationSpeed: 0.15,
                    loop: false
                },
                {
                    position: { x: 0, y: 0 },
                    tint: 0x88ff88,
                    alpha: 0.6,
                    lifeTime: 0.8,
                    fade: 0.4,
                    scale: 1.8,
                    atlasAlias: 'vfx-atlas',
                    animation: 'heal-particles',
                    animationSpeed: 0.1,
                    loop: false
                }
            ],
            duration: 0.4
        });
    }

    private _initializeAnimationConfigs(): void {
        this._animationConfigs.set('comboBreaker', {
            animation: 'combo-breaker',
            duration: 0.6,
            revertAfter: 600,
            tint: 0xffaa33,
            scale: 1.2,
            alpha: 0.9
        });

        this._animationConfigs.set('teleport', {
            animation: 'teleport',
            duration: 0.4,
            revertAfter: 400,
            tint: 0x66ccff,
            scale: 1.1,
            alpha: 0.8
        });

        this._animationConfigs.set('shield', {
            animation: 'shield-active',
            duration: 4.0,
            revertAfter: 0, // Don't revert automatically
            tint: 0x00ff88,
            scale: 1.0,
            alpha: 0.7
        });

        this._animationConfigs.set('stasis', {
            animation: 'stasis-cast',
            duration: 0.3,
            revertAfter: 300,
            tint: 0xaa44ff,
            scale: 1.3,
            alpha: 0.8
        });

        this._animationConfigs.set('heal', {
            animation: 'heal-cast',
            duration: 0.4,
            revertAfter: 400,
            tint: 0x44ff44,
            scale: 1.1,
            alpha: 0.9
        });
    }

    update(entities: Entity[], delta: number): void {
        const deltaSeconds = delta / 60;

        // Update active animations
        for (const [key, animation] of this._activeAnimations.entries()) {
            if (Date.now() >= animation.endTime) {
                this._revertAnimation(animation.entity, key);
                this._activeAnimations.delete(key);
            }
        }

        // Listen for ability events
        this._processAbilityEvents(entities, deltaSeconds);
    }

    private _processAbilityEvents(entities: Entity[], deltaSeconds: number): void {
        // This would be called when abilities are triggered
        // For now, we'll provide methods that can be called by other systems
    }

    // Public methods for other systems to trigger VFX
    triggerAbilityVFX(entity: Entity, abilityName: string, customPosition?: { x: number; y: number }): void {
        const config = this._vfxConfigs.get(abilityName);
        if (!config) {
            console.warn(`No VFX config found for ability: ${abilityName}`);
            return;
        }

        const transform = entity.getComponent(Transform);
        if (!transform) {
            return;
        }

        const position = customPosition || { x: transform.position.x, y: transform.position.y };

        // Spawn all effects
        config.effects.forEach(effectConfig => {
            const effect: EffectSpawnOptions = {
                ...effectConfig,
                position: {
                    x: position.x + (effectConfig.position?.x || 0),
                    y: position.y + (effectConfig.position?.y || 0)
                }
            };
            this.game.spawnEffect(effect);
        });

        // Play animation
        this._playAbilityAnimation(entity, abilityName);

        // Emit event
        this.eventBus?.emit('ability:vfx-triggered', {
            entity,
            abilityName,
            position
        });
    }

    private _playAbilityAnimation(entity: Entity, abilityName: string): void {
        const config = this._animationConfigs.get(abilityName);
        if (!config) {
            return;
        }

        const sprite = entity.getComponent(Sprite);
        if (!sprite) {
            return;
        }

        // Store original sprite properties
        const originalSprite = {
            tint: sprite.sprite.tint,
            scale: { x: sprite.sprite.scale.x, y: sprite.sprite.scale.y },
            alpha: sprite.sprite.alpha
        };

        // Apply animation properties
        if (config.tint !== undefined) {
            sprite.sprite.tint = config.tint;
        }
        if (config.scale !== undefined) {
            sprite.sprite.scale.set(config.scale);
        }
        if (config.alpha !== undefined) {
            sprite.sprite.alpha = config.alpha;
        }

        // Set up animation reversion
        const endTime = Date.now() + (config.revertAfter || config.duration * 1000);
        const key = `${entity.id || 'unknown'}:${abilityName}`;
        this._activeAnimations.set(key, {
            entity,
            endTime,
            originalSprite
        });
    }

    private _revertAnimation(entity: Entity, key: string): void {
        const animation = this._activeAnimations.get(key);
        if (!animation || !animation.originalSprite) {
            return;
        }

        const sprite = entity.getComponent(Sprite);
        if (!sprite) {
            return;
        }

        // Restore original properties
        sprite.sprite.tint = animation.originalSprite.tint;
        sprite.sprite.scale.set(animation.originalSprite.scale.x, animation.originalSprite.scale.y);
        sprite.sprite.alpha = animation.originalSprite.alpha;
    }

    // Method to trigger shield VFX with duration
    triggerShieldVFX(entity: Entity, duration: number): void {
        this.triggerAbilityVFX(entity, 'shield');
        
        // Set up shield duration animation
        const key = `${entity.id || 'unknown'}:shield-duration`;
        const endTime = Date.now() + (duration * 1000);
        this._activeAnimations.set(key, {
            entity,
            endTime,
            originalSprite: undefined // Don't revert shield animation
        });
    }

    // Method to trigger teleport VFX with origin and destination
    triggerTeleportVFX(entity: Entity, origin: { x: number; y: number }, destination: { x: number; y: number }): void {
        const config = this._vfxConfigs.get('teleport');
        if (!config) {
            return;
        }

        // Spawn origin effect
        if (config.effects[0]) {
            const originEffect: EffectSpawnOptions = {
                ...config.effects[0],
                position: origin
            };
            this.game.spawnEffect(originEffect);
        }

        // Spawn destination effect
        if (config.effects[1]) {
            const destEffect: EffectSpawnOptions = {
                ...config.effects[1],
                position: destination
            };
            this.game.spawnEffect(destEffect);
        }

        // Play animation
        this._playAbilityAnimation(entity, 'teleport');
    }

    // Get VFX config for external use
    getVFXConfig(abilityName: string): AbilityVFXConfig | null {
        return this._vfxConfigs.get(abilityName) || null;
    }

    // Get animation config for external use
    getAnimationConfig(abilityName: string): AbilityAnimationConfig | null {
        return this._animationConfigs.get(abilityName) || null;
    }
}
