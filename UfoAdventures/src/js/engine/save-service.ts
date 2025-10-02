export interface SaveServiceOptions {
    dbName?: string;
    storeName?: string;
    version?: number;
    keyPrefix?: string;
}

export interface SaveRecord<T = unknown> {
    key: string;
    value: T;
    timestamp: number;
}

type LocalStorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>;

export class SaveService {
    private readonly dbName: string;
    private readonly storeName: string;
    private readonly version: number;
    private readonly keyPrefix: string;
    private _indexedDB: IDBFactory | null;
    private _dbPromise: Promise<IDBDatabase | null> | null = null;
    private readonly _localStorage: LocalStorageLike | null;
    private readonly _memoryStore: Map<string, SaveRecord> = new Map();
    private _isFallback: boolean;
    private readonly _readyPromise: Promise<IDBDatabase | null>;

    constructor(options: SaveServiceOptions = {}) {
        this.dbName = options.dbName || 'UFOAdventures';
        this.storeName = options.storeName || 'saves';
        this.version = Number.isFinite(options.version) ? Number(options.version) : 1;
        this.keyPrefix = options.keyPrefix || `${this.dbName}:${this.storeName}:`;
        this._indexedDB = this._resolveIndexedDB();
        this._localStorage = this._resolveLocalStorage();
        this._isFallback = !this._indexedDB;
        this._readyPromise = this._indexedDB
            ? this._openDatabase().catch(error => {
                console.warn('SaveService: IndexedDB unavailable, falling back to local storage.', error);
                this._indexedDB = null;
                this._isFallback = true;
                return null;
            })
            : Promise.resolve(null);
    }

    ready(): Promise<IDBDatabase | null> {
        return this._readyPromise;
    }

    async save(key: string, value: unknown): Promise<void> {
        if (!key) {
            return;
        }
        const record: SaveRecord = { key, value, timestamp: Date.now() };
        if (this._indexedDB) {
            await this._writeIndexedDB(record);
        } else {
            this._writeFallback(record);
        }
    }

    async load<T = unknown>(key: string): Promise<T | null> {
        if (!key) {
            return null;
        }
        if (this._indexedDB) {
            const record = await this._readIndexedDB(key);
            return record ? (record.value as T) : null;
        }
        return this._readFallback<T>(key);
    }

    async delete(key: string): Promise<void> {
        if (!key) {
            return;
        }
        if (this._indexedDB) {
            await this._deleteIndexedDB(key);
        } else {
            this._deleteFallback(key);
        }
    }

    async list(prefix: string | null = null): Promise<SaveRecord[]> {
        if (this._indexedDB) {
            return this._listIndexedDB(prefix);
        }
        return this._listFallback(prefix);
    }

    async clear(prefix: string | null = null): Promise<void> {
        if (this._indexedDB) {
            await this._clearIndexedDB(prefix);
        } else {
            this._clearFallback(prefix);
        }
    }

    private _resolveIndexedDB(): IDBFactory | null {
        try {
            if (typeof window === 'undefined') {
                return null;
            }
            return (
                window.indexedDB ||
                (window as any).mozIndexedDB ||
                (window as any).webkitIndexedDB ||
                (window as any).msIndexedDB ||
                null
            );
        } catch (error) {
            console.warn('SaveService: IndexedDB not accessible.', error);
            return null;
        }
    }

    private _resolveLocalStorage(): LocalStorageLike | null {
        try {
            if (typeof window !== 'undefined' && window.localStorage) {
                const key = '__save_service_probe__';
                window.localStorage.setItem(key, '1');
                window.localStorage.removeItem(key);
                return window.localStorage;
            }
        } catch (error) {
            console.warn('SaveService: localStorage unavailable, using in-memory store.', error);
        }
        return null;
    }

    private async _openDatabase(): Promise<IDBDatabase | null> {
        if (!this._indexedDB) {
            return null;
        }
        if (this._dbPromise) {
            return this._dbPromise;
        }
        this._dbPromise = new Promise<IDBDatabase | null>((resolve, reject) => {
            const request = this._indexedDB!.open(this.dbName, this.version);
            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName, { keyPath: 'key' });
                }
            };
            request.onsuccess = () => {
                const db = request.result;
                db.onclose = () => {
                    this._dbPromise = null;
                };
                resolve(db);
            };
            request.onerror = () => {
                reject(request.error || new Error('SaveService: failed to open IndexedDB.'));
            };
            request.onblocked = () => {
                console.warn('SaveService: IndexedDB upgrade blocked by another tab.');
            };
        });
        return this._dbPromise;
    }

    private async _withStore<T>(
        mode: IDBTransactionMode,
        handler: (
            store: IDBObjectStore,
            tx: IDBTransaction,
            resolve: (value?: T | PromiseLike<T>) => void,
            reject: (reason?: unknown) => void
        ) => T | void
    ): Promise<T> {
        const db = await this._openDatabase();
        if (!db) {
            throw new Error('SaveService: IndexedDB unavailable.');
        }
        return new Promise<T>((resolve, reject) => {
            const tx = db.transaction(this.storeName, mode);
            const store = tx.objectStore(this.storeName);
            let result: T | undefined;
            let settled = false;
            const wrapResolve = (value?: T | PromiseLike<T>) => {
                settled = true;
                if (value === undefined) {
                    resolve(undefined as unknown as T);
                } else {
                    resolve(value);
                }
            };
            const wrapReject = (reason?: unknown) => {
                settled = true;
                reject(reason);
            };
            try {
                const handlerResult = handler(store, tx, wrapResolve, wrapReject);
                if (handlerResult !== undefined) {
                    result = handlerResult;
                }
            } catch (error) {
                wrapReject(error);
            }
            tx.oncomplete = () => {
                if (!settled) {
                    resolve((result as T) ?? (undefined as unknown as T));
                }
            };
            tx.onabort = () => wrapReject(tx.error || new Error('SaveService: transaction aborted.'));
            tx.onerror = () => wrapReject(tx.error || new Error('SaveService: transaction error.'));
        });
    }

    private async _writeIndexedDB(record: SaveRecord): Promise<void> {
        await this._withStore('readwrite', store => {
            store.put(record);
        });
    }

    private async _readIndexedDB(key: string): Promise<SaveRecord | null> {
        return this._withStore('readonly', (store, _tx, resolve, reject) => {
            const request = store.get(key);
            request.onsuccess = () => resolve((request.result as SaveRecord | null) || null);
            request.onerror = () => reject(request.error || new Error('SaveService: failed to load record.'));
        });
    }

    private async _deleteIndexedDB(key: string): Promise<void> {
        await this._withStore('readwrite', store => {
            store.delete(key);
        });
    }

    private async _listIndexedDB(prefix: string | null): Promise<SaveRecord[]> {
        const records: SaveRecord[] = [];
        await this._withStore('readonly', (store, _tx, resolve, reject) => {
            const request = store.openCursor();
            request.onsuccess = event => {
                const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
                if (!cursor) {
                    resolve();
                    return;
                }
                if (!prefix || String(cursor.key).startsWith(prefix)) {
                    records.push(cursor.value as SaveRecord);
                }
                cursor.continue();
            };
            request.onerror = () => reject(request.error || new Error('SaveService: failed to iterate records.'));
        });
        return records;
    }

    private async _clearIndexedDB(prefix: string | null): Promise<void> {
        if (!prefix) {
            await this._withStore('readwrite', store => {
                store.clear();
            });
            return;
        }
        const keysToDelete: string[] = [];
        await this._withStore('readonly', (store, _tx, resolve, reject) => {
            const request = store.openCursor();
            request.onsuccess = event => {
                const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
                if (!cursor) {
                    resolve();
                    return;
                }
                if (String(cursor.key).startsWith(prefix)) {
                    keysToDelete.push(String(cursor.key));
                }
                cursor.continue();
            };
            request.onerror = () => reject(request.error || new Error('SaveService: failed to enumerate keys.'));
        });
        if (!keysToDelete.length) {
            return;
        }
        await this._withStore('readwrite', store => {
            keysToDelete.forEach(key => store.delete(key));
        });
    }

    private _writeFallback(record: SaveRecord): void {
        if (this._localStorage) {
            try {
                this._localStorage.setItem(this.keyPrefix + record.key, JSON.stringify(record));
                return;
            } catch (error) {
                console.warn('SaveService: failed to persist to localStorage, storing in memory.', error);
            }
        }
        this._memoryStore.set(record.key, record);
    }

    private _readFallback<T>(key: string): T | null {
        if (this._localStorage) {
            try {
                const raw = this._localStorage.getItem(this.keyPrefix + key);
                if (!raw) {
                    return null;
                }
                const parsed = JSON.parse(raw) as SaveRecord<T>;
                return parsed ? parsed.value : null;
            } catch (error) {
                console.warn('SaveService: failed to read from localStorage, checking memory store.', error);
            }
        }
        const record = this._memoryStore.get(key) as SaveRecord<T> | undefined;
        return record ? record.value : null;
    }

    private _deleteFallback(key: string): void {
        if (this._localStorage) {
            try {
                this._localStorage.removeItem(this.keyPrefix + key);
            } catch (error) {
                console.warn('SaveService: failed to delete from localStorage.', error);
            }
        }
        this._memoryStore.delete(key);
    }

    private _listFallback(prefix: string | null): SaveRecord[] {
        const records: SaveRecord[] = [];
        const storage = this._localStorage;
        if (storage) {
            for (let i = 0; i < storage.length; i++) {
                const storageKey = storage.key(i);
                if (!storageKey || !storageKey.startsWith(this.keyPrefix)) {
                    continue;
                }
                const logicalKey = storageKey.slice(this.keyPrefix.length);
                if (prefix && !logicalKey.startsWith(prefix)) {
                    continue;
                }
                try {
                    const parsed = JSON.parse(storage.getItem(storageKey) || 'null') as SaveRecord | null;
                    if (parsed) {
                        records.push(parsed);
                    }
                } catch (error) {
                    console.warn('SaveService: failed to parse stored record.', error);
                }
            }
        }
        if (!prefix) {
            this._memoryStore.forEach((value, key) => {
                if (!records.find(entry => entry.key === key)) {
                    records.push(value);
                }
            });
        } else {
            this._memoryStore.forEach((value, key) => {
                if (key.startsWith(prefix) && !records.find(entry => entry.key === key)) {
                    records.push(value);
                }
            });
        }
        return records;
    }

    private _clearFallback(prefix: string | null): void {
        const storage = this._localStorage;
        if (storage) {
            const keys: string[] = [];
            for (let i = 0; i < storage.length; i++) {
                const storageKey = storage.key(i);
                if (storageKey && storageKey.startsWith(this.keyPrefix)) {
                    const logicalKey = storageKey.slice(this.keyPrefix.length);
                    if (!prefix || logicalKey.startsWith(prefix)) {
                        keys.push(storageKey);
                    }
                }
            }
            keys.forEach(key => {
                try {
                    storage.removeItem(key);
                } catch (error) {
                    console.warn('SaveService: failed to clear localStorage key', key, error);
                }
            });
        }
        if (!prefix) {
            this._memoryStore.clear();
        } else {
            Array.from(this._memoryStore.keys()).forEach(key => {
                if (key.startsWith(prefix)) {
                    this._memoryStore.delete(key);
                }
            });
        }
    }
}
