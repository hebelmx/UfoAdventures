import { describe, expect, it, vi } from 'vitest';
import * as PIXI from 'pixi.js';

import { GameplayRuntime } from '../../src/js/gameplay-runtime';
import { ServiceLocator } from '../../src/js/engine/service-locator';

describe('GameplayRuntime render pipeline', () => {
    const createStubApp = (): PIXI.Application => {
        const ticker = {
            add: vi.fn(),
            remove: vi.fn(),
            start: vi.fn(),
            stop: vi.fn(),
            deltaMS: 16.67
        };

        return {
            stage: new PIXI.Container(),
            ticker
        } as unknown as PIXI.Application;
    };

    it('forwards interpolation to the system manager', () => {
        const runtime = new GameplayRuntime(createStubApp(), new ServiceLocator());
        const renderSpy = vi.fn();

        (runtime as any)._systemManager = {
            update: vi.fn(),
            render: renderSpy,
            getDiagnosticsSnapshot: () => []
        };

        runtime.render(0.42);

        expect(renderSpy).toHaveBeenCalledTimes(1);
        expect(renderSpy.mock.calls[0][0]).toBe(runtime.entities);
        expect(renderSpy.mock.calls[0][1]).toBe(0.42);
        expect((runtime as any)._frameInterpolation).toBe(0.42);
    });
});
