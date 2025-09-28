class ResourceManager {
    constructor() {
        this._manifest = [];
        this._loaded = new Set();
    }

    async loadManifest(manifest, onProgress) {
        if (!Array.isArray(manifest) || !manifest.length) {
            if (typeof onProgress === 'function') {
                onProgress(1, null);
            }
            return;
        }

        this._manifest = manifest.slice();
        let completed = 0;
        const total = this._manifest.length;

        for (const asset of this._manifest) {
            const alias = asset.alias || asset.id || asset.name;
            const src = asset.src || asset.url;

            if (!alias || !src) {
                console.warn('ResourceManager: invalid manifest entry', asset);
                completed += 1;
                if (typeof onProgress === 'function') {
                    onProgress(completed / total, alias);
                }
                continue;
            }

            if (this._loaded.has(alias) && PIXI.Assets?.cache?.has(alias)) {
                completed += 1;
                if (typeof onProgress === 'function') {
                    onProgress(completed / total, alias);
                }
                continue;
            }

            try {
                await PIXI.Assets.load({ src, alias });
                this._loaded.add(alias);
                completed += 1;
                if (typeof onProgress === 'function') {
                    onProgress(completed / total, alias);
                }
            } catch (error) {
                console.error('ResourceManager: failed to load asset', alias, error);
                throw error;
            }
        }
    }

    get(alias) {
        if (!alias) {
            return null;
        }

        return PIXI.Assets.get(alias) ?? null;
    }

    has(alias) {
        return !!alias && (this._loaded.has(alias) || PIXI.Assets?.cache?.has(alias));
    }

    reset() {
        PIXI.Assets.reset();
        this._loaded.clear();
        this._manifest = [];
    }
}
