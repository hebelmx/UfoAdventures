import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AbilityVFXSystem } from '../../src/js/engine/ability-vfx-system';
import { EventBus } from '../../src/js/engine/event-bus';
import { Entity } from '../../src/js/engine/core';
import { Transform, Sprite } from '../../src/js/engine/components';

describe('Ability VFX Integration Tests', () => {
    let vfxSystem: AbilityVFXSystem;
    let mockGame: any;
    let eventBus: EventBus;
    let entity: Entity;

    beforeEach(() => {
        eventBus = new EventBus();
        mockGame = {
            spawnEffect: vi.fn()
        };
        vfxSystem = new AbilityVFXSystem(mockGame, eventBus);
        
        entity = new Entity();
        entity.addComponent(new Transform({ x: 100, y: 100 }));
        entity.addComponent(new Sprite({} as any));
    });

    describe('VFX Configuration Integration', () => {
        it('should have all required VFX configs', () => {
            const abilities = ['comboBreaker', 'teleport', 'shield', 'stasis', 'heal'];
            
            abilities.forEach(ability => {
                const config = vfxSystem.getVFXConfig(ability);
                expect(config).toBeDefined();
                expect(config?.effects).toBeDefined();
                expect(config?.effects.length).toBeGreaterThan(0);
            });
        });

        it('should have all required animation configs', () => {
            const abilities = ['comboBreaker', 'teleport', 'shield', 'stasis', 'heal'];
            
            abilities.forEach(ability => {
                const config = vfxSystem.getAnimationConfig(ability);
                expect(config).toBeDefined();
                expect(config?.animation).toBeDefined();
                expect(config?.duration).toBeGreaterThan(0);
            });
        });

        it('should have consistent VFX properties', () => {
            const comboConfig = vfxSystem.getVFXConfig('comboBreaker');
            expect(comboConfig?.effects[0].tint).toBe(0xffaa33);
            expect(comboConfig?.effects[0].animation).toBe('comboBreaker');
            expect(comboConfig?.effects[0].lifeTime).toBe(0.4);
            
            const teleportConfig = vfxSystem.getVFXConfig('teleport');
            expect(teleportConfig?.effects[0].tint).toBe(0x66ccff);
            expect(teleportConfig?.effects[0].animation).toBe('teleport-trail');
        });
    });

    describe('Event System Integration', () => {
        it('should listen for VFX trigger events', () => {
            const eventSpy = vi.spyOn(eventBus, 'on');
            
            // Create new system to test event binding
            new AbilityVFXSystem(mockGame, eventBus);
            
            expect(eventSpy).toHaveBeenCalledWith('ability:vfx-trigger', expect.any(Function));
        });

        it('should trigger VFX on event', () => {
            const spawnEffectSpy = vi.spyOn(mockGame, 'spawnEffect');
            
            // Emit VFX trigger event
            eventBus.emit('ability:vfx-trigger', {
                entity,
                abilityName: 'comboBreaker'
            });
            
            expect(spawnEffectSpy).toHaveBeenCalled();
        });

        it('should handle teleport events with origin and destination', () => {
            const spawnEffectSpy = vi.spyOn(mockGame, 'spawnEffect');
            
            eventBus.emit('ability:vfx-trigger', {
                entity,
                abilityName: 'teleport',
                origin: { x: 50, y: 50 },
                destination: { x: 150, y: 150 }
            });
            
            expect(spawnEffectSpy).toHaveBeenCalledTimes(2); // Origin and destination
        });

        it('should emit VFX triggered events', () => {
            const eventSpy = vi.spyOn(eventBus, 'emit');
            
            vfxSystem.triggerAbilityVFX(entity, 'comboBreaker');
            
            expect(eventSpy).toHaveBeenCalledWith('ability:vfx-triggered', {
                entity,
                abilityName: 'comboBreaker',
                position: { x: 100, y: 100 }
            });
        });
    });

    describe('Animation Management Integration', () => {
        it('should apply and revert animations correctly', () => {
            const sprite = entity.getComponent(Sprite)!;
            const originalTint = sprite.sprite.tint;
            const originalScale = { x: sprite.sprite.scale.x, y: sprite.sprite.scale.y };
            const originalAlpha = sprite.sprite.alpha;
            
            // Trigger ability VFX
            vfxSystem.triggerAbilityVFX(entity, 'comboBreaker');
            
            // Check if animation properties were applied
            const comboConfig = vfxSystem.getAnimationConfig('comboBreaker');
            if (comboConfig?.tint !== undefined) {
                expect(sprite.sprite.tint).toBe(comboConfig.tint);
            }
            
            // Simulate time passing to trigger reversion
            vfxSystem.update([entity], 600); // 600ms for combo breaker
            
            // Properties should be reverted
            expect(sprite.sprite.tint).toBe(originalTint);
            expect(sprite.sprite.scale.x).toBe(originalScale.x);
            expect(sprite.sprite.scale.y).toBe(originalScale.y);
            expect(sprite.sprite.alpha).toBe(originalAlpha);
        });

        it('should handle multiple concurrent animations', () => {
            const entity2 = new Entity();
            entity2.addComponent(new Transform({ x: 200, y: 200 }));
            entity2.addComponent(new Sprite({} as any));
            
            // Trigger VFX on both entities
            vfxSystem.triggerAbilityVFX(entity, 'comboBreaker');
            vfxSystem.triggerAbilityVFX(entity2, 'teleport');
            
            // Both should have active animations
            const activeAnimations = (vfxSystem as any)._activeAnimations;
            expect(activeAnimations.size).toBe(2);
        });

        it('should handle animation cleanup on entity removal', () => {
            vfxSystem.triggerAbilityVFX(entity, 'comboBreaker');
            
            const activeAnimations = (vfxSystem as any)._activeAnimations;
            expect(activeAnimations.size).toBe(1);
            
            // Simulate entity removal by updating with empty array
            vfxSystem.update([], 1000);
            
            // Animation should still be tracked (no automatic cleanup)
            expect(activeAnimations.size).toBe(1);
        });
    });

    describe('Shield VFX Integration', () => {
        it('should trigger shield VFX with duration', () => {
            const spawnEffectSpy = vi.spyOn(mockGame, 'spawnEffect');
            
            vfxSystem.triggerShieldVFX(entity, 4.0);
            
            expect(spawnEffectSpy).toHaveBeenCalledTimes(2); // Bubble and aura
        });

        it('should handle shield duration correctly', () => {
            vfxSystem.triggerShieldVFX(entity, 2.0);
            
            const activeAnimations = (vfxSystem as any)._activeAnimations;
            const shieldKey = `${entity.id || 'unknown'}:shield-duration`;
            
            expect(activeAnimations.has(shieldKey)).toBe(true);
        });
    });

    describe('Teleport VFX Integration', () => {
        it('should handle teleport with different positions', () => {
            const spawnEffectSpy = vi.spyOn(mockGame, 'spawnEffect');
            
            const origin = { x: 0, y: 0 };
            const destination = { x: 100, y: 100 };
            
            vfxSystem.triggerTeleportVFX(entity, origin, destination);
            
            expect(spawnEffectSpy).toHaveBeenCalledTimes(2);
            
            // Check origin effect
            const originCall = spawnEffectSpy.mock.calls[0][0];
            expect(originCall.position).toEqual(origin);
            expect(originCall.animation).toBe('teleport-trail');
            
            // Check destination effect
            const destCall = spawnEffectSpy.mock.calls[1][0];
            expect(destCall.position).toEqual(destination);
            expect(destCall.animation).toBe('teleport-arrival');
        });

        it('should handle teleport with same origin and destination', () => {
            const spawnEffectSpy = vi.spyOn(mockGame, 'spawnEffect');
            
            const position = { x: 50, y: 50 };
            
            vfxSystem.triggerTeleportVFX(entity, position, position);
            
            expect(spawnEffectSpy).toHaveBeenCalledTimes(2);
        });
    });

    describe('Error Handling Integration', () => {
        it('should handle missing entity components gracefully', () => {
            const entityWithoutSprite = new Entity();
            entityWithoutSprite.addComponent(new Transform({ x: 0, y: 0 }));
            
            // Should not throw error
            expect(() => {
                vfxSystem.triggerAbilityVFX(entityWithoutSprite, 'comboBreaker');
            }).not.toThrow();
        });

        it('should handle missing transform component', () => {
            const entityWithoutTransform = new Entity();
            entityWithoutTransform.addComponent(new Sprite({} as any));
            
            expect(() => {
                vfxSystem.triggerAbilityVFX(entityWithoutTransform, 'comboBreaker');
            }).not.toThrow();
        });

        it('should handle null game context', () => {
            const nullGameVfxSystem = new AbilityVFXSystem(null as any, eventBus);
            
            expect(() => {
                nullGameVfxSystem.triggerAbilityVFX(entity, 'comboBreaker');
            }).toThrow(); // Should throw when trying to spawn effects
        });
    });

    describe('Performance Integration', () => {
        it('should handle many concurrent VFX efficiently', () => {
            const entities = Array.from({ length: 100 }, (_, i) => {
                const e = new Entity();
                e.addComponent(new Transform({ x: i * 10, y: i * 10 }));
                e.addComponent(new Sprite({} as any));
                return e;
            });
            
            const startTime = performance.now();
            
            // Trigger VFX on all entities
            entities.forEach(entity => {
                vfxSystem.triggerAbilityVFX(entity, 'comboBreaker');
            });
            
            const endTime = performance.now();
            const duration = endTime - startTime;
            
            // Should complete quickly (less than 100ms for 100 entities)
            expect(duration).toBeLessThan(100);
        });

        it('should clean up expired animations efficiently', () => {
            // Create many animations
            for (let i = 0; i < 50; i++) {
                const e = new Entity();
                e.addComponent(new Transform({ x: i, y: i }));
                e.addComponent(new Sprite({} as any));
                vfxSystem.triggerAbilityVFX(e, 'comboBreaker');
            }
            
            const activeAnimations = (vfxSystem as any)._activeAnimations;
            expect(activeAnimations.size).toBe(50);
            
            // Simulate time passing to expire animations
            vfxSystem.update([], 1000);
            
            // Should have cleaned up expired animations
            expect(activeAnimations.size).toBeLessThan(50);
        });
    });
});
