class ResourceManager {
    constructor() {
        this._manifest = [];
        this._loaded = new Set();
        this._spritesheets = new Map();
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
                if (asset.type === 'spritesheet') {
                    await this._loadSpritesheet(alias, src, asset);
                } else {
                    await PIXI.Assets.load({ src, alias });
                }

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

        if (this._spritesheets.has(alias)) {
            return this._spritesheets.get(alias);
        }

        return PIXI.Assets.get(alias) ?? null;
    }

    getSpritesheet(alias) {
        return this._spritesheets.get(alias) || null;
    }

    has(alias) {
        return !!alias && (this._loaded.has(alias) || PIXI.Assets?.cache?.has(alias) || this._spritesheets.has(alias));
    }

    reset() {
        PIXI.Assets.reset();
        this._loaded.clear();
        this._spritesheets.clear();
        this._manifest = [];
    }

    async _loadSpritesheet(alias, src, asset) {
        const baseAlias = asset.baseAlias || `${alias}__base`;
        const texture = await PIXI.Assets.load({ src, alias: baseAlias });

        let data = null;
        // Prefer external JSON if provided (TexturePacker/PIXI format)
        if (asset.json) {
            try {
                const res = await fetch(asset.json);
                if (res.ok) {
                    data = await res.json();
                    // Ensure meta.image is the src for correct baseTexture linkage
                    if (!data.meta) {
                        data.meta = {};
                    }
                    data.meta.image = src;
                }
            } catch (e) {
                console.warn('ResourceManager: failed to fetch spritesheet JSON for', alias, e);
            }
        }

        if (!data) {
            const width = asset.width || texture.width || (texture.baseTexture?.realWidth ?? texture.baseTexture?.width) || 0;
            const height = asset.height || texture.height || (texture.baseTexture?.realHeight ?? texture.baseTexture?.height) || 0;

            const frames = Array.isArray(asset.frames) && asset.frames.length
                ? asset.frames
                : [{ name: asset.frameName || `${alias}_frame`, rect: 'full', anchor: asset.anchor || [0.5, 0.5] }];

            data = {
                frames: {},
                animations: asset.animations || {},
                meta: {
                    image: src,
                    scale: 1,
                    size: { w: width || 0, h: height || 0 }
                }
            };

            frames.forEach(frame => {
                const name = frame.name;
                let rect = frame.rect;
                if (!rect || rect === 'full') {
                    rect = [0, 0, width || texture.width, height || texture.height];
                }

                const [x, y, w, h] = rect;
                const anchor = Array.isArray(frame.anchor) ? frame.anchor : (frame.anchor ? [frame.anchor.x, frame.anchor.y] : [0.5, 0.5]);

                data.frames[name] = {
                    frame: { x, y, w, h },
                    spriteSourceSize: { x: 0, y: 0, w, h },
                    sourceSize: { w, h },
                    anchor: { x: anchor[0] ?? 0.5, y: anchor[1] ?? 0.5 }
                };
            });

            if (!Object.keys(data.animations).length) {
                const defaultFrameName = frames[0].name;
                data.animations.idle = [defaultFrameName];
            }
        }

        const spritesheet = new PIXI.Spritesheet(texture, data);
        await spritesheet.parse();

        this._spritesheets.set(alias, spritesheet);
        PIXI.Assets.cache.set(alias, spritesheet);

        Object.entries(spritesheet.textures).forEach(([name, tex]) => {
            PIXI.Assets.cache.set(`${alias}:${name}`, tex);
        });
    }
}
