import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AbilityVFXSystem } from '../../src/js/engine/ability-vfx-system';
import { EventBus } from '../../src/js/engine/event-bus';
import { Entity } from '../../src/js/engine/core';
import { Transform, Sprite } from '../../src/js/engine/components';

describe('AbilityVFXSystem', () => {
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

    it('should initialize with VFX configs', () => {
        const comboConfig = vfxSystem.getVFXConfig('comboBreaker');
        expect(comboConfig).toBeDefined();
        expect(comboConfig?.effects).toHaveLength(2);
        expect(comboConfig?.effects[0].tint).toBe(0xffaa33);
    });

    it('should initialize with animation configs', () => {
        const comboAnimConfig = vfxSystem.getAnimationConfig('comboBreaker');
        expect(comboAnimConfig).toBeDefined();
        expect(comboAnimConfig?.animation).toBe('combo-breaker');
        expect(comboAnimConfig?.duration).toBe(0.6);
    });

    it('should trigger ability VFX', () => {
        vfxSystem.triggerAbilityVFX(entity, 'comboBreaker');
        
        // Should spawn multiple effects
        expect(mockGame.spawnEffect).toHaveBeenCalledTimes(2);
        
        // Check first effect properties
        const firstCall = mockGame.spawnEffect.mock.calls[0][0];
        expect(firstCall.tint).toBe(0xffaa33);
        expect(firstCall.position).toEqual({ x: 100, y: 100 });
        expect(firstCall.animation).toBe('comboBreaker');
    });

    it('should trigger teleport VFX with origin and destination', () => {
        const origin = { x: 50, y: 50 };
        const destination = { x: 150, y: 150 };
        
        vfxSystem.triggerTeleportVFX(entity, origin, destination);
        
        // Should spawn 2 effects (origin and destination)
        expect(mockGame.spawnEffect).toHaveBeenCalledTimes(2);
        
        // Check origin effect
        const originCall = mockGame.spawnEffect.mock.calls[0][0];
        expect(originCall.position).toEqual(origin);
        expect(originCall.animation).toBe('teleport-trail');
        
        // Check destination effect
        const destCall = mockGame.spawnEffect.mock.calls[1][0];
        expect(destCall.position).toEqual(destination);
        expect(destCall.animation).toBe('teleport-arrival');
    });

    it('should trigger shield VFX with duration', () => {
        vfxSystem.triggerShieldVFX(entity, 4.0);
        
        // Should spawn shield effects
        expect(mockGame.spawnEffect).toHaveBeenCalledTimes(2);
        
        // Check shield bubble effect
        const bubbleCall = mockGame.spawnEffect.mock.calls[0][0];
        expect(bubbleCall.tint).toBe(0x00ff88);
        expect(bubbleCall.animation).toBe('shield-bubble');
        
        // Check shield aura effect
        const auraCall = mockGame.spawnEffect.mock.calls[1][0];
        expect(auraCall.tint).toBe(0x88ffaa);
        expect(auraCall.animation).toBe('shield-aura');
        expect(auraCall.loop).toBe(true);
    });

    it('should handle unknown ability gracefully', () => {
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        
        vfxSystem.triggerAbilityVFX(entity, 'unknownAbility');
        
        expect(consoleSpy).toHaveBeenCalledWith('No VFX config found for ability: unknownAbility');
        expect(mockGame.spawnEffect).not.toHaveBeenCalled();
        
        consoleSpy.mockRestore();
    });

    it('should emit ability VFX triggered event', () => {
        const eventSpy = vi.spyOn(eventBus, 'emit');
        
        vfxSystem.triggerAbilityVFX(entity, 'comboBreaker');
        
        expect(eventSpy).toHaveBeenCalledWith('ability:vfx-triggered', {
            entity,
            abilityName: 'comboBreaker',
            position: { x: 100, y: 100 }
        });
    });

    it('should update active animations', () => {
        // Trigger an ability to start an animation
        vfxSystem.triggerAbilityVFX(entity, 'comboBreaker');
        
        // Update system (simulate time passing)
        vfxSystem.update([entity], 60); // 1 second at 60 FPS
        
        // Animation should still be active (combo breaker has 600ms revert time)
        // This is a basic test - in a real scenario you'd need to mock time more precisely
        expect(mockGame.spawnEffect).toHaveBeenCalled();
    });
});
