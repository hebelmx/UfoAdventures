class ProgressionService {
    constructor(options = {}) {
        this._storageKey = options.storageKey || 'ufoadventures:runs';
        this._maxPerMission = Number.isFinite(options.maxPerMission) ? options.maxPerMission : 20;
        this._runs = [];
        this._saveService = options.saveService || null;
        this._storage = this._saveService ? null : this._resolveStorage();
        this._pendingSave = null;
        this._loadPromise = this._load();
    }

    setSaveService(saveService) {
        this._saveService = saveService;
        this._storage = null;
    }

    ready() {
        return this._loadPromise || Promise.resolve();
    }

    recordRun(run) {
        if (!run || !run.missionId) {
            return;
        }

        const normalized = Object.assign({}, run, {
            id: run.id || (run.missionId + ':' + Date.now())
        });

        this._runs.push(normalized);
        this._runs.sort((a, b) => (b.score || 0) - (a.score || 0));
        this._enforceLimit(normalized.missionId);
        this._persist();
        return normalized;
    }

    getRuns(missionId, limit = 10) {
        const filtered = missionId ? this._runs.filter(run => run.missionId === missionId) : this._runs.slice();
        if (!Number.isFinite(limit) || limit <= 0) {
            return filtered;
        }
        return filtered.slice(0, limit);
    }

    getPersonalBest(missionId) {
        const runs = this.getRuns(missionId);
        return runs.length ? runs[0] : null;
    }

    clearMission(missionId) {
        if (!missionId) {
            return;
        }
        this._runs = this._runs.filter(run => run.missionId !== missionId);
        this._persist();
    }

    resetAll() {
        this._runs = [];
        this._persist();
    }

    _enforceLimit(missionId) {
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

    _resolveStorage() {
        try {
            if (typeof window !== 'undefined' && window.localStorage) {
                return window.localStorage;
            }
        } catch (error) {
            console.warn('ProgressionService: localStorage unavailable, falling back to memory store.', error);
        }
        const memory = new Map();
        return {
            getItem: key => memory.has(key) ? memory.get(key) : null,
            setItem: (key, value) => memory.set(key, value),
            removeItem: key => memory.delete(key)
        };
    }

    _load() {
        if (this._saveService && typeof this._saveService.load === 'function') {
            return this._saveService.load(this._storageKey).then(data => {
                if (Array.isArray(data)) {
                    this._runs = data.slice();
                } else if (data && typeof data === 'object' && Array.isArray(data.runs)) {
                    this._runs = data.runs.slice();
                } else {
                    this._runs = [];
                }
            }).catch(error => {
                console.warn('ProgressionService: failed to load runs from SaveService', error);
                this._runs = [];
            });
        }

        return Promise.resolve().then(() => {
            try {
                const data = this._storage.getItem(this._storageKey);
                if (!data) {
                    this._runs = [];
                    return;
                }
                const parsed = JSON.parse(data);
                this._runs = Array.isArray(parsed) ? parsed : [];
            } catch (error) {
                console.warn('ProgressionService: failed to load stored runs', error);
                this._runs = [];
            }
        });
    }

    _persist() {
        const result = this._save();
        if (result && typeof result.then === 'function') {
            result.catch(error => console.warn('ProgressionService: failed to persist runs', error));
        }
    }

    _save() {
        if (this._saveService && typeof this._saveService.save === 'function') {
            return this._saveService.save(this._storageKey, this._runs);
        }
        try {
            this._storage.setItem(this._storageKey, JSON.stringify(this._runs));
        } catch (error) {
            console.warn('ProgressionService: failed to persist runs', error);
        }
        return null;
    }
}

window.ProgressionService = ProgressionService;
