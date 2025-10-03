import { SaveService } from './save-service';
import { RunSummary } from './mission-service';

export interface ProgressionServiceOptions {
    storageKey?: string;
    maxPerMission?: number;
    saveService?: SaveService;
}

interface StorageAdapter {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
}

interface StoredRunCollection {
    runs: RunSummary[];
}

export class ProgressionService {
    private readonly _storageKey: string;
    private readonly _maxPerMission: number;
    private _runs: RunSummary[] = [];
    private _saveService: SaveService | null;
    private _storage: StorageAdapter | null;
    private readonly _loadPromise: Promise<void>;

    constructor(options: ProgressionServiceOptions = {}) {
        this._storageKey = options.storageKey || 'ufoadventures:runs';
        this._maxPerMission = Number.isFinite(options.maxPerMission) ? options.maxPerMission! : 20;
        this._saveService = options.saveService || null;
        this._storage = this._saveService ? null : this._resolveStorage();
        this._loadPromise = this._load();
    }

    setSaveService(saveService: SaveService): void {
        this._saveService = saveService;
        this._storage = null;
    }

    ready(): Promise<void> {
        return this._loadPromise;
    }

    recordRun(run: RunSummary): RunSummary | undefined {
        if (!run || !run.missionId) {
            return;
        }

        const normalized: RunSummary = {
            ...run,
            id: run.id || `${run.missionId}:${Date.now()}`
        };

        this._runs.push(normalized);
        this._runs.sort((a, b) => (b.score || 0) - (a.score || 0));
        this._enforceLimit(normalized.missionId);
        this._persist();
        return normalized;
    }

    getRuns(missionId?: string, limit?: number): RunSummary[] {
        const filtered = missionId ? this._runs.filter(run => run.missionId === missionId) : this._runs.slice();
        if (!Number.isFinite(limit) || limit! <= 0) {
            return filtered;
        }
        return filtered.slice(0, limit);
    }

    getPersonalBest(missionId: string): RunSummary | null {
        const runs = this.getRuns(missionId);
        return runs.length ? runs[0] : null;
    }

    clearMission(missionId: string): void {
        if (!missionId) {
            return;
        }
        this._runs = this._runs.filter(run => run.missionId !== missionId);
        this._persist();
    }

    resetAll(): void {
        this._runs = [];
        this._persist();
    }

    private _enforceLimit(missionId: string): void {
        const runs = this._runs.filter(run => run.missionId === missionId);
        if (runs.length <= this._maxPerMission) {
            return;
        }
        const toRemove = runs.slice(this._maxPerMission);
        if (!toRemove.length) {
            return;
        }
        const removeIds = new Set(toRemove.map(run => run.id));
        this._runs = this._runs.filter(run => !removeIds.has(run.id));
    }

    private _resolveStorage(): StorageAdapter {
        try {
            if (typeof window !== 'undefined' && window.localStorage) {
                return window.localStorage;
            }
        } catch (error) {
            console.warn('ProgressionService: localStorage unavailable, falling back to memory store.', error);
        }
        const memory = new Map<string, string>();
        return {
            getItem: (key: string) => (memory.has(key) ? memory.get(key)! : null),
            setItem: (key: string, value: string) => {
                memory.set(key, value);
            },
            removeItem: (key: string) => {
                memory.delete(key);
            }
        };
    }

    private async _load(): Promise<void> {
        if (this._saveService) {
            try {
                const data = await this._saveService.load<RunSummary[] | StoredRunCollection>(this._storageKey);
                if (Array.isArray(data)) {
                    this._runs = data.slice();
                } else if (ProgressionService._isStoredRunCollection(data)) {
                    this._runs = data.runs.slice();
                } else {
                    this._runs = [];
                }
            } catch (error) {
                console.warn('ProgressionService: failed to load runs from SaveService', error);
                this._runs = [];
            }
            return;
        }

        if (!this._storage) {
            this._runs = [];
            return;
        }

        try {
            const data = this._storage.getItem(this._storageKey);
            if (!data) {
                this._runs = [];
                return;
            }
            const parsed = JSON.parse(data) as unknown;
            this._runs = Array.isArray(parsed) ? (parsed as RunSummary[]).slice() : [];
        } catch (error) {
            console.warn('ProgressionService: failed to load stored runs', error);
            this._runs = [];
        }
    }

    private _persist(): void {
        this._save().catch(error => console.warn('ProgressionService: failed to persist runs', error));
    }

    private async _save(): Promise<void> {
        if (this._saveService) {
            await this._saveService.save(this._storageKey, this._runs);
            return;
        }

        if (!this._storage) {
            return;
        }

        try {
            this._storage.setItem(this._storageKey, JSON.stringify(this._runs));
        } catch (error) {
            console.warn('ProgressionService: failed to persist runs', error);
        }
    }

    private static _isStoredRunCollection(value: unknown): value is StoredRunCollection {
        if (!value || typeof value !== 'object') {
            return false;
        }
        const candidate = value as StoredRunCollection;
        return Array.isArray(candidate.runs);
    }
}
