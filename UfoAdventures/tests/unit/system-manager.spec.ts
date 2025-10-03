import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Entity, System } from '../../src/js/engine/core';
import { SystemManager } from '../../src/js/engine/system-manager';

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

    beforeEach(() => {
        manager = new SystemManager();
        entities = [new Entity()];
    });

    it('updates registered systems in registration order', () => {
        const calls: string[] = [];
        const first = new StubSystem('first', () => calls.push('first'));
        const second = new StubSystem('second', () => calls.push('second'));

        manager.register(first);
        manager.register(second);

        manager.update(entities, 1 / 60);

        expect(calls).toEqual(['first', 'second']);
    });

    it('captures diagnostics for each system after update', () => {
        const system = new StubSystem('timed', () => {
            // noop
        });
        manager.register(system);

        manager.update(entities, 1 / 60);

        const diagnostics = manager.getDiagnosticsSnapshot();
        expect(diagnostics).toHaveLength(1);
        expect(diagnostics[0].name).toBe('StubSystem');
        expect(diagnostics[0].updateCount).toBe(1);
        expect(diagnostics[0].lastUpdateMs).toBeGreaterThanOrEqual(0);
    });

    it('records errors without stopping subsequent systems', () => {
        const errorSystem = new StubSystem('error', () => {
            throw new Error('boom');
        });
        const healthySpy = vi.fn();
        const healthySystem = new StubSystem('healthy', healthySpy);

        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        manager.register(errorSystem);
        manager.register(healthySystem);

        manager.update(entities, 1 / 60);

        const diagnostics = manager.getDiagnosticsSnapshot();
        const errorDiag = diagnostics.find(diag => diag.name === 'StubSystem');
        expect(errorDiag?.lastError).toContain('boom');
        expect(healthySpy).toHaveBeenCalledTimes(1);
        errorSpy.mockRestore();
    });

    it('unregister destroys systems when requested', () => {
        const destroySpy = vi.fn();
        const system = new StubSystem('temp', () => {}, destroySpy);
        const id = manager.register(system);

        manager.unregister(id);

        expect(destroySpy).toHaveBeenCalledTimes(1);
        expect(manager.getDiagnosticsSnapshot()).toHaveLength(0);
    });

    it('invokes render on systems that implement it', () => {
        const renderSpy = vi.fn();
        const system = new StubSystem('renderable', () => {}, undefined, renderSpy);

        manager.register(system);
        manager.render(entities, 0.75);

        expect(renderSpy).toHaveBeenCalledTimes(1);
        expect(renderSpy.mock.calls[0][0]).toBe(entities);
        expect(renderSpy.mock.calls[0][1]).toBe(0.75);
    });

    it('skips rendering for systems without a render method', () => {
        const system = new StubSystem('headless', () => {});
        manager.register(system);

        expect(() => manager.render(entities, 0.2)).not.toThrow();
    });
});
