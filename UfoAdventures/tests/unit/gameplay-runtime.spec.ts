import { describe, expect, it, vi } from 'vitest';
import * as PIXI from 'pixi.js';

import { GameplayRuntime } from '../../src/js/gameplay-runtime';
import { ServiceLocator } from '../../src/js/engine/service-locator';
import { Entity } from '../../src/js/engine/core';

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

        (runtime as any)._isRunning = true;

        runtime.render(0.42);

        expect(renderSpy).toHaveBeenCalledTimes(1);
        expect(renderSpy.mock.calls[0][0]).toBe(runtime.entities);
        expect(renderSpy.mock.calls[0][1]).toBe(0.42);
        expect((runtime as any)._frameInterpolation).toBe(0.42);
    });

    it('records profiler measurements and frame metrics', () => {
        const runtime = new GameplayRuntime(createStubApp(), new ServiceLocator());
        (runtime as any)._isRunning = true;

        runtime.entities.push(new Entity() as any);
        runtime.entities.push(Object.assign(new Entity(), { poolId: 'bullet' }));

        runtime.update(1 / 60);
        runtime.render(0.5);
        runtime.setFrameSkipCount(2);
        runtime.finalizeFrame(16.67, 0.5);

        const summary = runtime.getPerformanceSummary();
        expect(summary.measurements['frame:update']).toBeDefined();
        expect(summary.measurements['frame:render']).toBeDefined();
        const frameRow = summary.metrics.find(row => row.metric === 'frame (ms)');
        expect(frameRow?.average).toBeGreaterThan(0);
        const bulletRow = summary.metrics.find(row => row.metric === 'player bullets');
        expect(bulletRow?.peak).toBeGreaterThanOrEqual(1);
    });
});
