import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Entity, System } from '../../src/js/engine/core';
import { SystemManager, type SystemDiagnostics } from '../../src/js/engine/system-manager';
import { PerformanceProfiler, type MeasurementSummary } from '../../src/js/engine/performance-profiler';

describe('SystemManager', () => {
    class StubSystem extends System {
        readonly label: string;
        readonly onUpdate: (entities: Entity[], delta: number) => void;
        readonly onDestroy?: () => void;
        readonly onRender?: (entities: Entity[], interpolation: number) => void;

        constructor(
            label: string,
            onUpdate: (entities: Entity[], delta: number) => void,
            onDestroy?: () => void,
            onRender?: (entities: Entity[], interpolation: number) => void
        ) {
            super();
            this.label = label;
            this.onUpdate = onUpdate;
            this.onDestroy = onDestroy;
            this.onRender = onRender;
        }

        update(entities: Entity[], delta: number): void {
            this.onUpdate(entities, delta);
        }

        render(entities: Entity[], interpolation: number): void {
            this.onRender?.(entities, interpolation);
        }

        destroy(): void {
            this.onDestroy?.();
        }
    }

    let manager: SystemManager;
    let entities: Entity[];
    let profiler: PerformanceProfiler; // Keep this as PerformanceProfiler type
    let mockProfiler: {
        markStart: ReturnType<typeof vi.fn>;
        markEnd: ReturnType<typeof vi.fn>;
        recordError: ReturnType<typeof vi.fn>;
        clearMeasurements: ReturnType<typeof vi.fn>;
        getSummary: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
        mockProfiler = {
            markStart: vi.fn(),
            markEnd: vi.fn(),
            recordError: vi.fn(),
            clearMeasurements: vi.fn(),
            getSummary: vi.fn(() => ({
                samples: 0,
                durationMs: 0,
                metrics: [],
                measurements: {},
                errors: {}
            }))
        };
        profiler = mockProfiler as unknown as PerformanceProfiler; // Cast to PerformanceProfiler
        manager = new SystemManager({ profiler });
        entities = [new Entity()];
    });

    it('updates registered systems in registration order', () => {
        const calls: string[] = [];
        const first = new StubSystem('first', () => calls.push('first'));
        const second = new StubSystem('second', () => calls.push('second'));

        manager.registerSystem(first);
        manager.registerSystem(second);

        manager.update(entities, 1 / 60);

        expect(calls).toEqual(['first', 'second']);
    });

    it('captures diagnostics for each system after update', () => {
        const system = new StubSystem('timed', () => {
            // noop
        });
        manager.registerSystem(system);

        mockProfiler.getSummary.mockReturnValue({
            samples: 1,
            durationMs: 10,
            metrics: [],
            measurements: {
                'system:StubSystem': {
                    samples: 1,
                    averageMs: 10,
                    minMs: 5,
                    maxMs: 15
                } as MeasurementSummary
            },
            errors: {}
        });

        manager.update(entities, 1 / 60);

        const diagnostics = manager.getDiagnosticsSnapshot();
        expect(diagnostics).toHaveLength(1);
        expect(diagnostics[0].name).toBe('StubSystem');
        expect(diagnostics[0].samples).toBeGreaterThanOrEqual(1);
        expect(diagnostics[0].averageMs).toBeGreaterThanOrEqual(0);
    });

    it('records errors without stopping subsequent systems', () => {
        const errorSystem = new StubSystem('error', () => {
            throw new Error('boom');
        });
        const healthySpy = vi.fn();
        const healthySystem = new StubSystem('healthy', healthySpy);

        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        manager.registerSystem(errorSystem);
        manager.registerSystem(healthySystem);

        manager.update(entities, 1 / 60);

        expect(mockProfiler.recordError).toHaveBeenCalledWith('system:StubSystem', 'boom');
        expect(healthySpy).toHaveBeenCalledTimes(1);
        errorSpy.mockRestore();
    });

    it('unregister destroys systems when requested', () => {
        const destroySpy = vi.fn();
        const system = new StubSystem('temp', () => {}, destroySpy);
        manager.registerSystem(system);

        manager.unregisterSystem(system);

        expect(destroySpy).toHaveBeenCalledTimes(1);
        expect(mockProfiler.clearMeasurements).toHaveBeenCalledWith('system:StubSystem');
    });

    it('invokes render on systems that implement it', () => {
        const renderSpy = vi.fn();
        const system = new StubSystem('renderable', () => {}, undefined, renderSpy);

        manager.registerSystem(system);
        manager.render(entities, 0.75);

        expect(renderSpy).toHaveBeenCalledTimes(1);
        expect(renderSpy.mock.calls[0][0]).toBe(entities);
        expect(renderSpy.mock.calls[0][1]).toBe(0.75);
    });

    it('skips rendering for systems without a render method', () => {
        const system = new StubSystem('headless', () => {});
        manager.registerSystem(system);

        expect(() => manager.render(entities, 0.2)).not.toThrow();
    });
});
