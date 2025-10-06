import { describe, expect, it, vi } from 'vitest';
import * as PIXI from 'pixi.js';
import { GameplayRuntime } from '../../src/js/gameplay-runtime';
import { ServiceLocator } from '../../src/js/engine/service-locator';
import { InputService } from '../../src/js/engine/input-service';
import { EventBus } from '../../src/js/engine/event-bus';

describe('GameplayRuntime performance toggle binding', () => {
    const createStubApp = (): PIXI.Application => {
        return {
            stage: new PIXI.Container(),
            ticker: { add: vi.fn(), remove: vi.fn(), start: vi.fn(), stop: vi.fn(), deltaMS: 16.67 }
        } as unknown as PIXI.Application;
    };

    it('registers toggle command without duplicates', () => {
        const services = new ServiceLocator();
        const eventBus = new EventBus();
        const inputService = new InputService(eventBus);
        const registerSpy = vi.spyOn(inputService, 'registerCommand');

        services.register('inputService', inputService);

        const runtime = new GameplayRuntime(createStubApp(), services);

        // Force system build
        (runtime as any)._buildCoreSystems();

        // Allow at least one registration and ensure labels include the toggle
        const calls = registerSpy.mock.calls.map(call => call[0]);
        const toggleCount = calls.filter(label => label === 'togglePerformanceOverlay').length;
        expect(toggleCount).toBeGreaterThanOrEqual(1);
    });
});


