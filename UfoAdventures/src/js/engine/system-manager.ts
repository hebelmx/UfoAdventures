import { System, Entity } from './core';
import { PerformanceProfiler, type MeasurementSummary } from './performance-profiler'; // Import MeasurementSummary

export interface SystemDiagnostics {
    name: string;
    averageMs: number;
    minMs: number;
    maxMs: number;
    samples: number;
    lastError?: string; // Added lastError
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
        const initialLength = this.systems.length;
        this.systems = this.systems.filter(s => {
            if (s === system) {
                s.destroy?.(); // Call destroy on the system being unregistered
                this.profiler?.clearMeasurements(`system:${s.constructor.name}`); // Clear profiler data
                return false;
            }
            return true;
        });
    }

    update(entities: Entity[], delta: number, interpolation: number = 0): void {
        this.systems.forEach(system => {
            const systemName = system.constructor.name;
            this.profiler?.markStart(`system:${systemName}`);
            try {
                system.update(entities, delta, interpolation);
            } catch (error: unknown) { // Catch unknown error type
                const errorMessage = error instanceof Error ? error.message : String(error);
                console.error(`Error in system ${systemName}:`, error);
                this.profiler?.recordError(`system:${systemName}`, errorMessage);
            } finally {
                this.profiler?.markEnd(`system:${systemName}`);
            }
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
                    samples: measurement.samples,
                    lastError: measurement.lastError // Include lastError
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

    render(entities: Entity[], interpolation: number): void {
        this.systems.forEach(system => {
            if (typeof system.render === 'function') {
                const systemName = system.constructor.name;
                this.profiler?.markStart(`system:render:${systemName}`);
                try {
                    system.render(entities, interpolation);
                } catch (error: unknown) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    console.error(`Error in system render ${systemName}:`, error);
                    this.profiler?.recordError(`system:render:${systemName}`, errorMessage);
                } finally {
                    this.profiler?.markEnd(`system:render:${systemName}`);
                }
            }
        });
    }
}