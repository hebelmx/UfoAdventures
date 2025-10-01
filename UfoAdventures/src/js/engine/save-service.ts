class SaveService {
    constructor(options = {}) {
        this.dbName = options.dbName || 'UFOAdventures';
        this.storeName = options.storeName || 'saves';
        this.version = Number.isFinite(options.version) ? options.version : 1;
        this.keyPrefix = options.keyPrefix || (this.dbName + ':' + this.storeName + ':');
        this._indexedDB = this._resolveIndexedDB();
        this._dbPromise = null;
        this._localStorage = this._resolveLocalStorage();
        this._memoryStore = new Map();
        this._isFallback = !this._indexedDB;
        this._readyPromise = this._indexedDB ? this._openDatabase().catch(error => {
            console.warn('SaveService: IndexedDB unavailable, falling back to local storage.', error);
            this._indexedDB = null;
            this._isFallback = true;
            return null;
        }) : Promise.resolve(null);
    }

    ready() {
        return this._readyPromise;
    }

    async save(key, value) {
        if (!key) {
            return;
        }
        const record = { key, value, timestamp: Date.now() };
        if (this._indexedDB) {
            await this._writeIndexedDB(record);
        } else {
            this._writeFallback(record);
        }
    }

    async load(key) {
        if (!key) {
            return null;
        }
        if (this._indexedDB) {
            const record = await this._readIndexedDB(key);
            return record ? record.value : null;
        }
        return this._readFallback(key);
    }

    async delete(key) {
        if (!key) {
            return;
        }
        if (this._indexedDB) {
            await this._deleteIndexedDB(key);
        } else {
            this._deleteFallback(key);
        }
    }

    async list(prefix = null) {
        if (this._indexedDB) {
            return this._listIndexedDB(prefix);
        }
        return this._listFallback(prefix);
    }

    async clear(prefix = null) {
        if (this._indexedDB) {
            await this._clearIndexedDB(prefix);
        } else {
            this._clearFallback(prefix);
        }
    }

    _resolveIndexedDB() {
        try {
            if (typeof window === 'undefined') {
                return null;
            }
            return window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB || null;
        } catch (error) {
            console.warn('SaveService: IndexedDB not accessible.', error);
            return null;
        }
    }

    _resolveLocalStorage() {
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

    async _openDatabase() {
        if (!this._indexedDB) {
            return null;
        }
        if (this._dbPromise) {
            return this._dbPromise;
        }
        this._dbPromise = new Promise((resolve, reject) => {
            const request = this._indexedDB.open(this.dbName, this.version);
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

    async _withStore(mode, handler) {
        const db = await this._openDatabase();
        if (!db) {
            throw new Error('SaveService: IndexedDB unavailable.');
        }
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.storeName, mode);
            const store = tx.objectStore(this.storeName);
            let result;
            try {
                result = handler(store, tx, resolve, reject);
            } catch (error) {
                reject(error);
            }
            tx.oncomplete = () => {
                resolve(result);
            };
            tx.onabort = () => {
                reject(tx.error || new Error('SaveService: transaction aborted.'));
            };
            tx.onerror = () => {
                reject(tx.error || new Error('SaveService: transaction error.'));
            };
        });
    }

    async _writeIndexedDB(record) {
        await this._withStore('readwrite', (store) => {
            store.put(record);
        });
    }

    async _readIndexedDB(key) {
        return this._withStore('readonly', (store, tx, resolve, reject) => {
            const request = store.get(key);
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error || new Error('SaveService: failed to load record.'));
        });
    }

    async _deleteIndexedDB(key) {
        await this._withStore('readwrite', (store) => {
            store.delete(key);
        });
    }

    async _listIndexedDB(prefix) {
        const records = [];
        await this._withStore('readonly', (store, tx, resolve, reject) => {
            const request = store.openCursor();
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (!cursor) {
                    resolve();
                    return;
                }
                if (!prefix || cursor.key.startsWith(prefix)) {
                    records.push(cursor.value);
                }
                cursor.continue();
            };
            request.onerror = () => reject(request.error || new Error('SaveService: failed to iterate records.'));
        });
        return records;
    }

    async _clearIndexedDB(prefix) {
        if (!prefix) {
            await this._withStore('readwrite', (store) => store.clear());
            return;
        }
        const keysToDelete = [];
        await this._withStore('readonly', (store, tx, resolve, reject) => {
            const request = store.openKeyCursor();
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (!cursor) {
                    resolve();
                    return;
                }
                if (cursor.key && cursor.key.startsWith(prefix)) {
                    keysToDelete.push(cursor.key);
                }
                cursor.continue();
            };
            request.onerror = () => reject(request.error || new Error('SaveService: failed to enumerate keys.'));
        });
        if (!keysToDelete.length) {
            return;
        }
        await this._withStore('readwrite', (store) => {
            keysToDelete.forEach((key) => store.delete(key));
        });
    }

    _writeFallback(record) {
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

    _readFallback(key) {
        if (this._localStorage) {
            try {
                const raw = this._localStorage.getItem(this.keyPrefix + key);
                if (!raw) {
                    return null;
                }
                const parsed = JSON.parse(raw);
                return parsed ? parsed.value : null;
            } catch (error) {
                console.warn('SaveService: failed to read from localStorage, checking memory store.', error);
            }
        }
        const record = this._memoryStore.get(key);
        return record ? record.value : null;
    }

    _deleteFallback(key) {
        if (this._localStorage) {
            try {
                this._localStorage.removeItem(this.keyPrefix + key);
            } catch (error) {
                console.warn('SaveService: failed to delete from localStorage.', error);
            }
        }
        this._memoryStore.delete(key);
    }

    _listFallback(prefix) {
        const records = [];
        if (this._localStorage) {
            for (let i = 0; i < this._localStorage.length; i++) {
                const storageKey = this._localStorage.key(i);
                if (!storageKey || !storageKey.startsWith(this.keyPrefix)) {
                    continue;
                }
                const logicalKey = storageKey.slice(this.keyPrefix.length);
                if (prefix && !logicalKey.startsWith(prefix)) {
                    continue;
                }
                try {
                    const parsed = JSON.parse(this._localStorage.getItem(storageKey));
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

    _clearFallback(prefix) {
        if (this._localStorage) {
            const keys = [];
            for (let i = 0; i < this._localStorage.length; i++) {
                const storageKey = this._localStorage.key(i);
                if (storageKey && storageKey.startsWith(this.keyPrefix)) {
                    const logicalKey = storageKey.slice(this.keyPrefix.length);
                    if (!prefix || logicalKey.startsWith(prefix)) {
                        keys.push(storageKey);
                    }
                }
            }
            keys.forEach(key => {
                try {
                    this._localStorage.removeItem(key);
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

window.SaveService = SaveService;
