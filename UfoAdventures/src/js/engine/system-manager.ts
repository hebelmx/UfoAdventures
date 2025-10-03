import { type Entity, System } from './core';
import type { PerformanceProfiler } from './performance-profiler';

export interface SystemManagerOptions {
    profiler?: PerformanceProfiler | null;
}

export interface SystemRegistrationOptions {
    id?: string;
    name?: string;
    priority?: number;
}

export interface SystemDiagnostics {
    id: string;
    name: string;
    priority: number;
    lastUpdateMs: number;
    averageUpdateMs: number;
    totalUpdateMs: number;
    updateCount: number;
    lastError: string | null;
}

interface SystemEntry {
    id: string;
    name: string;
    priority: number;
    order: number;
    system: System;
    diagnostics: SystemDiagnostics;
}

export class SystemManager {
    private readonly _entries: SystemEntry[] = [];
    private readonly _diagnostics = new Map<string, SystemDiagnostics>();
    private readonly _idCounts = new Map<string, number>();
    private _nextOrder = 0;
    private _profiler: PerformanceProfiler | null;

    constructor(options: SystemManagerOptions = {}) {
        this._profiler = options.profiler ?? null;
    }

    setProfiler(profiler: PerformanceProfiler | null): void {
        this._profiler = profiler ?? null;
    }

    register(system: System, options: SystemRegistrationOptions = {}): string {
        if (!system) {
            throw new Error('SystemManager.register requires a System instance.');
        }

        const baseId = options.id || this._inferName(system);
        const id = this._ensureUniqueId(baseId);
        const name = options.name || this._inferName(system);
        const priority = Number.isFinite(options.priority) ? Number(options.priority) : 0;

        if (this._entries.find(entry => entry.id === id)) {
            throw new Error(`SystemManager: system with id "${id}" is already registered.`);
        }

        const diagnostics: SystemDiagnostics = {
            id,
            name,
            priority,
            lastUpdateMs: 0,
            averageUpdateMs: 0,
            totalUpdateMs: 0,
            updateCount: 0,
            lastError: null
        };

        const entry: SystemEntry = {
            id,
            name,
            priority,
            order: this._nextOrder += 1,
            system,
            diagnostics
        };

        this._entries.push(entry);
        this._diagnostics.set(id, diagnostics);
        this._sortEntries();
        return id;
    }

    unregister(candidate: string | System, options: { destroy?: boolean } = {}): void {
        const entryIndex = this._entries.findIndex(entry => entry.id === candidate || entry.system === candidate);
        if (entryIndex === -1) {
            return;
        }

        const [entry] = this._entries.splice(entryIndex, 1);
        this._diagnostics.delete(entry.id);

        if (options.destroy !== false && typeof entry.system.destroy === 'function') {
            try {
                entry.system.destroy();
            } catch (error) {
                console.error(`SystemManager: error destroying system "${entry.name}"`, error);
            }
        }
    }

    destroyAll(): void {
        this.reset({ destroy: true });
    }

    reset(options: { destroy?: boolean } = {}): void {
        const shouldDestroy = options.destroy !== false;
        if (shouldDestroy) {
            for (const entry of this._entries) {
                if (typeof entry.system.destroy === 'function') {
                    try {
                        entry.system.destroy();
                    } catch (error) {
                        console.error(`SystemManager: error destroying system "${entry.name}"`, error);
                    }
                }
            }
        }

        this._entries.length = 0;
        this._diagnostics.clear();
        this._idCounts.clear();
        this._nextOrder = 0;
    }

    update(entities: Entity[], delta: number): void {
        const now = typeof performance !== 'undefined' && performance?.now ? () => performance.now() : () => Date.now();

        for (const entry of this._entries) {
            const diagnostics = entry.diagnostics;
            const start = now();
            let duration = 0;

            try {
                entry.system.update(entities, delta);
                duration = now() - start;
                diagnostics.lastError = null;
            } catch (error) {
                duration = now() - start;
                diagnostics.lastError = error instanceof Error ? error.message : String(error);
                console.error(`SystemManager: update failed for "${entry.name}"`, error);
            }

            diagnostics.lastUpdateMs = duration;
            diagnostics.totalUpdateMs += duration;
            diagnostics.updateCount += 1;
            diagnostics.averageUpdateMs = diagnostics.updateCount > 0
                ? diagnostics.totalUpdateMs / diagnostics.updateCount
                : 0;

            const label = `system:${diagnostics.name}`;
            this._profiler?.recordMeasurement(label, duration);
        }
    }

    render(entities: Entity[], interpolation: number): void {
        for (const entry of this._entries) {
            if (typeof entry.system.render !== 'function') {
                continue;
            }

            try {
                entry.system.render(entities, interpolation);
            } catch (error) {
                console.error(`SystemManager: render failed for "${entry.name}"`, error);
            }
        }
    }

    listSystems(): System[] {
        return this._entries.map(entry => entry.system);
    }

    getDiagnosticsSnapshot(): SystemDiagnostics[] {
        return this._entries.map(entry => ({ ...entry.diagnostics }));
    }

    private _sortEntries(): void {
        this._entries.sort((a, b) => {
            if (a.priority === b.priority) {
                return a.order - b.order;
            }
            return a.priority - b.priority;
        });
    }

    private _inferName(system: System): string {
        return system?.constructor?.name || 'System';
    }

    private _ensureUniqueId(baseId: string): string {
        const key = baseId || 'system';
        const count = (this._idCounts.get(key) ?? 0) + 1;
        this._idCounts.set(key, count);
        if (count === 1) {
            return key;
        }
        return `${key}#${count}`;
    }
}
