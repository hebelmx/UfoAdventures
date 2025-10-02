export interface PerformanceProfilerOptions {
    maxSamples?: number;
}

export type FrameMetrics = Record<string, number | undefined>;

interface FrameEntry extends FrameMetrics {
    timestamp: number;
}

export interface MeasurementSummary {
    samples: number;
    averageMs: number;
    minMs: number;
    maxMs: number;
}

export interface MetricRow {
    metric: string;
    average: number;
    min?: number;
    max?: number;
    peak?: number;
}

export interface PerformanceSummary {
    samples: number;
    durationMs: number;
    metrics: MetricRow[];
    measurements: Record<string, MeasurementSummary>;
}

export class PerformanceProfiler {
    readonly maxSamples: number;
    private readonly _frames: FrameEntry[] = [];
    private readonly _marks: Map<string, number> = new Map();
    private readonly _measurements: Map<string, number[]> = new Map();

    constructor(options: PerformanceProfilerOptions = {}) {
        this.maxSamples = Math.max(1, Math.floor(options.maxSamples ?? 600));
    }

    reset(): void {
        this._frames.length = 0;
        this._marks.clear();
        this._measurements.clear();
    }

    markStart(label: string | null | undefined): void {
        if (!label) {
            return;
        }
        this._marks.set(label, performance.now());
    }

    markEnd(label: string | null | undefined): number | null {
        if (!label) {
            return null;
        }
        const start = this._marks.get(label);
        if (start === undefined) {
            return null;
        }
        this._marks.delete(label);
        const duration = performance.now() - start;
        this._recordMeasurement(label, duration);
        return duration;
    }

    recordMeasurement(label: string | null | undefined, duration: number | null | undefined): void {
        if (!label || !Number.isFinite(duration)) {
            return;
        }
        this._recordMeasurement(label, duration as number);
    }

    recordFrame(frameMetrics: FrameMetrics = {}): void {
        const entry: FrameEntry = {
            timestamp: performance.now(),
            ...frameMetrics
        };
        this._frames.push(entry);
        if (this._frames.length > this.maxSamples) {
            this._frames.shift();
        }
    }

    getSummary(): PerformanceSummary {
        if (!this._frames.length) {
            return {
                samples: 0,
                durationMs: 0,
                metrics: [],
                measurements: {}
            };
        }

        const first = this._frames[0].timestamp;
        const last = this._frames[this._frames.length - 1].timestamp;
        const durationMs = Math.max(0, last - first);

        const metrics: MetricRow[] = [];
        const statRows: Array<[string, string[], boolean]> = [
            ['fps', ['fps'], false],
            ['frame (ms)', ['frameMs'], false],
            ['entities', ['entities'], true],
            ['player bullets', ['bullets'], true],
            ['enemy bullets', ['enemyBullets'], true],
            ['effects', ['effects'], true],
            ['grid cells', ['gridCells'], true],
            ['grid occupants', ['gridEntities'], true]
        ];

        for (const [label, keys, omitMin] of statRows) {
            const row = this._buildStatRow(label, keys, omitMin);
            if (row) {
                metrics.push(row);
            }
        }

        const measurements: Record<string, MeasurementSummary> = {};
        this._measurements.forEach((values, label) => {
            if (!values.length) {
                return;
            }
            const total = values.reduce((accumulator, value) => accumulator + value, 0);
            measurements[label] = {
                samples: values.length,
                averageMs: total / values.length,
                minMs: Math.min(...values),
                maxMs: Math.max(...values)
            };
        });

        return {
            samples: this._frames.length,
            durationMs,
            metrics,
            measurements
        };
    }

    private _recordMeasurement(label: string, duration: number): void {
        if (!this._measurements.has(label)) {
            this._measurements.set(label, []);
        }
        const bucket = this._measurements.get(label)!;
        bucket.push(duration);
        if (bucket.length > this.maxSamples) {
            bucket.shift();
        }
    }

    private _buildStatRow(label: string, keys: string[], omitMin = false): MetricRow | null {
        const values = this._frames
            .map(frame => keys.map(key => {
                const raw = frame[key];
                return Number.isFinite(raw) ? Number(raw) : null;
            }))
            .filter(mapped => mapped.some(value => value !== null));

        if (!values.length) {
            return null;
        }

        const flattened = values
            .reduce<number[]>((accumulator, entry) => {
                entry.forEach((value: number | null) => {
                    if (value !== null && Number.isFinite(value)) {
                        accumulator.push(value);
                    }
                });
                return accumulator;
            }, []);

        if (!flattened.length) {
            return null;
        }

        const min = Math.min(...flattened);
        const max = Math.max(...flattened);
        const avg = flattened.reduce((accumulator, value) => accumulator + value, 0) / flattened.length;

        if (omitMin) {
            return {
                metric: label,
                average: Number.isFinite(avg) ? avg : 0,
                peak: Number.isFinite(max) ? max : 0
            };
        }

        return {
            metric: label,
            min: Number.isFinite(min) ? min : 0,
            average: Number.isFinite(avg) ? avg : 0,
            max: Number.isFinite(max) ? max : 0
        };
    }
}
