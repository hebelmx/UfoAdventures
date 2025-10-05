import { System, Entity } from './core';
import { PerformanceProfiler } from './performance-profiler';

export interface SystemDiagnostics {
    name: string;
    averageMs: number;
    minMs: number;
    maxMs: number;
    samples: number;
}

interface SystemManagerOptions {
    profiler?: PerformanceProfiler;
}

export class SystemManager {
    private systems: System[] = [];
    private profiler: PerformanceProfiler | null = null;

    constructor(options?: SystemManagerOptions) {
        if (options?.profiler) {
            this.profiler = options.profiler;
        }
    }

    registerSystem(system: System): void {
        this.systems.push(system);
    }

    unregisterSystem(system: System): void {
        this.systems = this.systems.filter(s => s !== system);
    }

    update(entities: Entity[], delta: number, interpolation: number = 0): void {
        this.systems.forEach(system => {
            const systemName = system.constructor.name;
            this.profiler?.start(`system:${systemName}`);
            system.update(entities, delta, interpolation);
            this.profiler?.end(`system:${systemName}`);
        });
    }

    getDiagnosticsSnapshot(): SystemDiagnostics[] {
        if (!this.profiler) {
            return [];
        }
        const summary = this.profiler.getSummary();
        const systemMeasurements: SystemDiagnostics[] = [];
        for (const key in summary.measurements) {
            if (key.startsWith('system:')) {
                const name = key.replace('system:', '');
                const measurement = summary.measurements[key];
                systemMeasurements.push({
                    name,
                    averageMs: measurement.averageMs,
                    minMs: measurement.minMs,
                    maxMs: measurement.maxMs,
                    samples: measurement.samples
                });
            }
        }
        return systemMeasurements;
    }

    reset(options?: { destroy?: boolean }): void {
        if (options?.destroy) {
            this.destroy();
        } else {
            this.systems = [];
        }
    }

    init(): void {
        this.systems.forEach(system => system.init?.());
    }

    destroy(): void {
        this.systems.forEach(system => system.destroy?.());
        this.systems = [];
    }
}