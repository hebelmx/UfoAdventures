import * as PIXI from 'pixi.js';

export interface AssetManifestEntry {
    alias: string;
    src: string;
    type?: 'spritesheet' | 'texture';
    json?: string;
    width?: number;
    height?: number;
    frames?: any[];
    animations?: any;
    frameName?: string;
    anchor?: number[] | { x: number, y: number };
    baseAlias?: string;
    id?: string;
    name?: string;
    url?: string;
}

export class ResourceManager {
    private _manifest: AssetManifestEntry[] = [];
    private readonly _loaded: Set<string> = new Set();
    private readonly _spritesheets: Map<string, PIXI.Spritesheet> = new Map();
    private readonly _testMode: boolean;

    constructor() {
        this._testMode = this._detectTestMode();
    }

    async loadManifest(manifest: AssetManifestEntry[], onProgress?: (progress: number, asset: string | null) => void): Promise<void> {
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
            const aliasSource = asset.alias ?? asset.id ?? asset.name ?? '';
            const srcSource = asset.src ?? asset.url ?? '';
            const alias = aliasSource.trim();
            const src = srcSource.trim();

            if (!alias || !src) {
                console.warn('ResourceManager: invalid manifest entry', asset);
                completed += 1;
                if (typeof onProgress === 'function') {
                    onProgress(completed / total, alias);
                }
                continue;
            }

            if (this._loaded.has(alias) && PIXI.Assets.cache.has(alias)) {
                completed += 1;
                if (typeof onProgress === 'function') {
                    onProgress(completed / total, alias);
                }
                continue;
            }

            try {
                if (this._testMode) {
                    await this._primeTestAsset(alias, asset.type, asset);
                } else if (asset.type === 'spritesheet') {
                    await this._loadSpritesheet(alias, src, asset);
                } else {
                    await PIXI.Assets.load({ alias, src });
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

    get<T extends PIXI.Texture | PIXI.Spritesheet>(alias: string): T | null {
        if (!alias) {
            return null;
        }

        if (this._spritesheets.has(alias)) {
            return this._spritesheets.get(alias) as T;
        }

        return PIXI.Assets.get(alias) ?? null;
    }

    getSpritesheet(alias: string): PIXI.Spritesheet | null {
        return this._spritesheets.get(alias) || null;
    }

    has(alias: string): boolean {
        return !!alias && (this._loaded.has(alias) || PIXI.Assets.cache.has(alias) || this._spritesheets.has(alias));
    }

    reset(): void {
        PIXI.Assets.reset();
        this._loaded.clear();
        this._spritesheets.clear();
        this._manifest = [];
    }

    private _detectTestMode(): boolean {
        try {
            return typeof window !== 'undefined' && (window as any).__E2E__ === true;
        } catch (error) {
            return false;
        }
    }

    private async _primeTestAsset(alias: string, type: string | undefined, asset: AssetManifestEntry): Promise<void> {
        if (type === 'spritesheet') {
            await this._createPlaceholderSpritesheet(alias, asset);
            return;
        }

        if (!PIXI.Assets.cache.has(alias)) {
            PIXI.Assets.cache.set(alias, PIXI.Texture.WHITE);
        }
    }

    private async _loadSpritesheet(alias: string, src: string, asset: AssetManifestEntry): Promise<void> {
        if (this._testMode) {
            await this._createPlaceholderSpritesheet(alias, asset);
            return;
        }

        const baseAlias = asset.baseAlias || `${alias}__base`;
        const texture = await PIXI.Assets.load<PIXI.Texture>({ src, alias: baseAlias });

        let data: any = null;
        if (asset.json) {
            try {
                const res = await fetch(asset.json);
                if (res.ok) {
                    data = await res.json();
                    if (!data.meta) {
                        data.meta = {};
                    }
                    data.meta.image = src;
                }
            } catch (e) {
                console.warn('ResourceManager: failed to fetch spritesheet JSON for', alias, e);
            }
        }

        const manifestAnimations = this._normalizeAnimationMap(asset.animations);

        if (data) {
            if (manifestAnimations) {
                const existing = typeof data.animations === 'object' && data.animations !== null ? data.animations : {};
                data.animations = { ...existing, ...manifestAnimations };
            }

            if (!this._hasAnimationFrames(data.animations)) {
                data.animations = this._deriveAnimationsFromFrames(data.frames);
            }
        }

        if (!data) {
            const width = asset.width ?? texture.width ?? texture.baseTexture?.width ?? 0;
            const height = asset.height ?? texture.height ?? texture.baseTexture?.height ?? 0;

            const frames = Array.isArray(asset.frames) && asset.frames.length
                ? asset.frames
                : [{ name: asset.frameName || `${alias}_frame`, rect: 'full', anchor: asset.anchor || [0.5, 0.5] }];

            data = {
                frames: {},
                animations: manifestAnimations || this._deriveAnimationsFromFrames(),
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

            if (!this._hasAnimationFrames(data.animations)) {
                const defaultFrameName = frames[0].name;
                data.animations = { idle: [defaultFrameName] };
            }
        }

        const spritesheet = new PIXI.Spritesheet(texture.baseTexture, data);
        await spritesheet.parse();

        this._spritesheets.set(alias, spritesheet);
        PIXI.Assets.cache.set(alias, spritesheet);

        Object.entries(spritesheet.textures).forEach(([name, tex]) => {
            PIXI.Assets.cache.set(`${alias}:${name}`, tex);
        });
    }

    private async _createPlaceholderSpritesheet(alias: string, asset: AssetManifestEntry = {} as AssetManifestEntry): Promise<void> {
        const frameName = `${alias}__frame__`;
        const baseTexture = PIXI.Texture.WHITE.baseTexture;
        const manifestAnimations = this._normalizeAnimationMap(asset.animations);
        const animations = manifestAnimations && Object.keys(manifestAnimations).length
            ? manifestAnimations
            : { idle: [frameName] };

        const data = {
            frames: {
                [frameName]: {
                    frame: { x: 0, y: 0, w: 1, h: 1 },
                    spriteSourceSize: { x: 0, y: 0, w: 1, h: 1 },
                    sourceSize: { w: 1, h: 1 },
                    anchor: { x: 0.5, y: 0.5 }
                }
            },
            animations,
            meta: {
                image: 'placeholder',
                scale: 1,
                size: { w: 1, h: 1 }
            }
        };

        const spritesheet = new PIXI.Spritesheet(baseTexture, data);
        await spritesheet.parse();

        this._spritesheets.set(alias, spritesheet);
        PIXI.Assets.cache.set(alias, spritesheet);
        PIXI.Assets.cache.set(`${alias}:${frameName}`, PIXI.Texture.WHITE);
    }

    private _normalizeAnimationMap(value: unknown): Record<string, string[]> | null {
        if (!value || typeof value !== 'object') {
            return null;
        }

        const result: Record<string, string[]> = {};
        Object.entries(value as Record<string, unknown>).forEach(([name, frames]) => {
            if (!frames) {
                return;
            }
            if (Array.isArray(frames)) {
                const normalized = frames.filter(frame => typeof frame === 'string');
                if (normalized.length) {
                    result[name] = normalized;
                }
                return;
            }

            if (typeof frames === 'string') {
                result[name] = [frames];
            }
        });

        return Object.keys(result).length ? result : null;
    }

    private _hasAnimationFrames(animations: Record<string, unknown> | null | undefined): boolean {
        if (!animations || typeof animations !== 'object') {
            return false;
        }

        return Object.values(animations).some(frames => Array.isArray(frames) && frames.length > 0);
    }

    private _deriveAnimationsFromFrames(frames?: Record<string, unknown>): Record<string, string[]> {
        if (!frames || typeof frames !== 'object') {
            return {};
        }

        const frameNames = Object.keys(frames);
        if (!frameNames.length) {
            return {};
        }

        const grouped: Record<string, string[]> = {};
        frameNames.forEach(name => {
            const key = name.split(/[\/:-]/, 1)[0] || 'idle';
            if (!grouped[key]) {
                grouped[key] = [];
            }
            grouped[key].push(name);
        });

        Object.keys(grouped).forEach(key => {
            grouped[key] = grouped[key]
                .slice()
                .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
        });

        return Object.keys(grouped).length ? grouped : {};
    }

}


