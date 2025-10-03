import * as PIXI from 'pixi.js';
import { Entity } from './engine/core';
import { SystemManager, type SystemDiagnostics } from './engine/system-manager';
import { EntityManager } from './engine/entity-manager';
import { PerformanceProfiler, type PerformanceSummary } from './engine/performance-profiler';
import { Transform, Sprite, Motion, Enemy, BehaviorTreeComponent, EnemyBehavior, Weapon, Bullet, EnemyBullet, Collider, Health, PlayerAbilities, Boss, BossPhase, getComponentOrNull, Vector2Like } from './engine/components';
import { Player } from './entities/player';
import {
    RenderSystem,
    PlayerInputSystem,
    BehaviorTreeSystem,
    EnemyBehaviorSystem,
    MovementSystem,
    EffectLifetimeSystem,
    AbilitySystem,
    EnemySpawningSystem,
    ShootingSystem,
    CollisionSystem,
    UISystem,
    BossAISystem,
    BossShootingSystem,
    BoundaryCleanupSystem,
    CleanupSystem
} from './engine/systems';
import { EntityPool } from './engine/entity-pool';
import type { ServiceLocator } from './engine/service-locator';
import type { ResourceManager } from './engine/resource-manager';
import type { EventBus } from './engine/event-bus';
import type { InputService } from './engine/input-service';
import type {
    BehaviorSceneOptions,
    BossConfig,
    CombatGameContext,
    EffectSpawnOptions,
    EnemySpawnContext,
    EnemySpawnTemplate,
    ProjectileSpawnPayload,
    RuntimeEntity
} from './engine/combat-types';

interface PerformanceStats {
    frameCount: number;
    accumulator: number;
    fps: number;
    lastFrameMs: number;
}

type PoolParamRecord = Record<string, unknown>;
type RuntimePool = EntityPool<RuntimeEntity, PoolParamRecord>;
export type RuntimeStartOptions = BehaviorSceneOptions & { backgroundAlias?: string };
interface DisplayObjectOptions {
    atlasAlias?: string;
    animation?: string;
    fallbackAlias?: string;
    width?: number;
    height?: number;
    speed?: number;
}

export interface AbilitySnapshot {
    shieldRemaining: number;
    shieldActive: boolean;
    stasisRemaining: number;
    stasisPaused: number;
}

export class GameplayRuntime implements CombatGameContext {
    public readonly app: PIXI.Application;
    public readonly services: ServiceLocator;
    public readonly stage: PIXI.Container;
    public entities: RuntimeEntity[] = [];
    private readonly _entityManager: EntityManager;
    private readonly _systemManager: SystemManager;
    private readonly _profiler = new PerformanceProfiler();
    private _frameInterpolation = 0;
    private _lastFrameSkips = 0;
    private _systemDiagnostics: SystemDiagnostics[] = [];
    public mode = 'adventure';
    public sceneOptions: BehaviorSceneOptions = {};
    public backgroundSprite: PIXI.Sprite | null = null;


    private _isRunning = false;
    private _paused = false;

    private _resourceManager: ResourceManager | null = null;
    private readonly _entityPools: Map<string, RuntimePool>;
    private readonly _enemyPools: Map<string, RuntimePool>;

    private _performanceText: PIXI.Text | null = null;
    private _performanceStats: PerformanceStats = { frameCount: 0, accumulator: 0, fps: 0, lastFrameMs: 0 };
    private _performanceOverlayVisible = true;
    private _performanceToggleOff: (() => void) | null = null;
    private _collisionSystem: CollisionSystem | null = null;

    constructor(app: PIXI.Application, services: ServiceLocator) {
        this.app = app;
        this.services = services;
        this.stage = new PIXI.Container();
        this.stage.sortableChildren = true;
        this._systemManager = new SystemManager({ profiler: this._profiler });
        this._entityManager = new EntityManager(this.entities, { releaseEntity: (entity, index) => this.releaseEntity(entity, index) });

        this._entityPools = new Map<string, RuntimePool>();
        this._enemyPools = new Map<string, RuntimePool>();
    }

    start(mode: string, options: RuntimeStartOptions = {}): void {
        this.mode = mode || 'adventure';
        const { backgroundAlias, ...sceneOptions } = options;
        this.sceneOptions = sceneOptions;
        this._ensureStageAttached();
        this._resetWorld();
        this._ensurePools();
        this._applyBackground(backgroundAlias || 'background');
        this._ensurePerformanceOverlay();
        this._buildCoreSystems();

        if (this.mode === 'adventure') {
            this._setupAdventureMode();
        } else if (this.mode === 'boss') {
            this._setupBossMode();
        } else if (this.mode === 'enemyDemo') {
            this._setupEnemyDemoMode();
        } else {
            console.warn('GameplayRuntime: unknown mode', this.mode);
            this._setupAdventureMode();
        }

        this._isRunning = true;
        this._paused = false;
    }

    update(delta: number, interpolation = this._frameInterpolation): void {
        if (!this._isRunning || this._paused) {
            return;
        }

        this._profiler.markStart('frame:update');
        this._frameInterpolation = interpolation;
        try {
            this._systemManager.update(this.entities, delta);
            this._systemDiagnostics = this._systemManager.getDiagnosticsSnapshot();
        } finally {
            this._profiler.markEnd('frame:update');
        }

        this._updatePerformanceOverlay(delta);
    }


    render(interpolation: number): void {
        this._frameInterpolation = interpolation;
        if (!this._isRunning || this._paused) {
            return;
        }

        this._profiler.markStart('frame:render');
        try {
            this._systemManager.render(this.entities, interpolation);
        } finally {
            this._profiler.markEnd('frame:render');
        }
    }

    setFrameSkipCount(count: number): void {
        this._lastFrameSkips = count;
    }

    finalizeFrame(frameDurationMs: number, interpolation: number): void {
        const clampedDuration = Number.isFinite(frameDurationMs) && frameDurationMs >= 0 ? frameDurationMs : 0;
        const fps = clampedDuration > 0 ? 1000 / clampedDuration : undefined;

        let activeBullets = 0;
        let enemyBullets = 0;
        let activeEffects = 0;

        for (const entity of this.entities) {
            const poolId = (entity as any).poolId;
            if (poolId === 'bullet') {
                activeBullets += 1;
            } else if (poolId === 'enemyBullet') {
                enemyBullets += 1;
            } else if (poolId === 'effect') {
                activeEffects += 1;
            }
        }

        const collisionDiagnostics = this._collisionSystem && typeof this._collisionSystem.getDiagnostics === 'function'
            ? this._collisionSystem.getDiagnostics()
            : null;

        this._profiler.recordFrame({
            frameMs: clampedDuration,
            fps,
            frameSkips: this._lastFrameSkips,
            interpolation,
            entities: this.entities.length,
            bullets: activeBullets,
            enemyBullets,
            effects: activeEffects,
            gridCells: collisionDiagnostics?.cells,
            gridEntities: collisionDiagnostics?.entities
        });
    }

    getPerformanceSummary(): PerformanceSummary {
        return this._profiler.getSummary();
    }

    // Test helpers (read-only)
    getActiveCounts(): { bullets: number; effects: number; enemies: number; hasPlayer: boolean } {
        const bullets = this.entities.filter(entity => entity.hasComponent(Bullet) && !entity.isRemoved).length;
        const effects = this.entities.filter(entity => entity.poolId === 'effect' && !entity.isRemoved).length;
        const enemies = this.entities.filter(entity => entity.hasComponent(Enemy) && !entity.isRemoved).length;
        const player = this.entities.find(entity => entity.hasComponent(Player)) ?? null;
        return { bullets, effects, enemies, hasPlayer: Boolean(player) };
    }

    getAbilitySnapshot(): AbilitySnapshot | null {
        const playerEntity = this.entities.find(entity => entity.hasComponent(Player));
        if (!playerEntity) {
            return null;
        }

        const abilities = getComponentOrNull(playerEntity, PlayerAbilities);
        if (!abilities) {
            return null;
        }

        const shieldState = abilities.states?.shield ?? null;
        const stasisState = abilities.states?.stasisField ?? null;
        const stasisPaused = this.entities.filter(entity => entity._stasisPaused).length;

        return {
            shieldRemaining: abilities.activeShieldStrength ?? 0,
            shieldActive: !!(shieldState?.active && (abilities.activeShieldStrength ?? 0) > 0),
            stasisRemaining: stasisState?.remaining ?? abilities.stasisTimer ?? 0,
            stasisPaused
        };
    }

    stop(): void {
        if (!this._isRunning) {
            return;
        }

        this._isRunning = false;
        this._paused = false;
        this._resetWorld();
    }

    setPaused(isPaused: boolean): void {
        this._paused = Boolean(isPaused);
    }

    isPaused(): boolean {
        return this._paused;
    }

    removeEntity(entity: RuntimeEntity | null | undefined): void {
        if (!entity) {
            return;
        }

        if (entity.poolId) {
            this.releaseEntity(entity);
            return;
        }

        const index = this.entities.indexOf(entity);
        if (index > -1) {
            this.entities.splice(index, 1);
        }

        this._detachSprite(entity);
        entity.isRemoved = true;
    }

    addEntity(entity: RuntimeEntity): void {
        this._registerEntity(entity);
    }

    _ensureStageAttached(): void {
        if (!this.stage.parent) {
            this.app.stage.addChild(this.stage);
        }
    }

    _resetWorld(): void {
        if (this.backgroundSprite && this.backgroundSprite.parent === this.stage) {
            this.stage.removeChild(this.backgroundSprite);
        }

        this.backgroundSprite = null;
        this.stage.removeChildren();
        this._unbindPerformanceToggle();
        if (this._performanceText) {
            if (typeof this._performanceText.destroy === 'function') {
                this._performanceText.destroy();
            }
            this._performanceText = null;
        }
        this._performanceStats = { frameCount: 0, accumulator: 0, fps: 0, lastFrameMs: 0 };
        this._systemManager.reset({ destroy: true });
        this._entityManager.clear();
        this.entities.length = 0;
        this._systemDiagnostics = [];
        this._collisionSystem = null;
    }

    _ensurePerformanceOverlay(): void {
        if (!this._performanceText) {
            const options = {
                fontFamily: 'Consolas, Menlo, monospace',
                fontSize: 12,
                fill: 0xbfd6ff,
                align: 'left' as const
            };
            const text = new PIXI.Text({ text: 'FPS: --', style: options });
            text.visible = this._performanceOverlayVisible;
            text.x = 10;
            text.y = 10;
            text.zIndex = 1000;
            text.alpha = 0.9;
            text.roundPixels = true;
            this._performanceText = text;
        }
        if (this._performanceText && !this._performanceText.parent) {
            this._performanceText.visible = this._performanceOverlayVisible;
            this.stage.addChild(this._performanceText);
        }
    }

    _bindPerformanceToggle(inputService: InputService | null): void {
        if (!inputService || typeof inputService.registerCommand !== 'function' || this._performanceToggleOff) {
            return;
        }
        this._performanceToggleOff = inputService.registerCommand('togglePerformanceOverlay', () => {
            this._togglePerformanceOverlay();
        }, { trigger: 'down' });
    }

    _unbindPerformanceToggle(): void {
        if (typeof this._performanceToggleOff === 'function') {
            try {
                this._performanceToggleOff();
            } catch (error) {
                console.warn('GameplayRuntime: failed to unbind performance toggle', error);
            }
        }
        this._performanceToggleOff = null;
    }

    _togglePerformanceOverlay(): void {
        this._performanceOverlayVisible = !this._performanceOverlayVisible;
        if (this._performanceText) {
            this._performanceText.visible = this._performanceOverlayVisible;
        }
    }

    _updatePerformanceOverlay(delta: number): void {
        if (!this._performanceText) {
            return;
        }

        const stats = this._performanceStats || (this._performanceStats = { frameCount: 0, accumulator: 0, fps: 0, lastFrameMs: 0 });
        const elapsedMS = Number.isFinite(this.app?.ticker?.elapsedMS)
            ? this.app.ticker.elapsedMS
            : (delta || 1) * (1000 / 60);

        stats.lastFrameMs = elapsedMS || 0;
        stats.accumulator += stats.lastFrameMs;
        stats.frameCount += 1;

        if (stats.accumulator >= 500) {
            stats.fps = (stats.frameCount * 1000) / stats.accumulator;
            stats.accumulator = 0;
            stats.frameCount = 0;
        }

        let activeBullets = 0;
        let enemyBullets = 0;
        let activeEffects = 0;
        const enemyActive: Record<string, number> = {};

        for (const entity of this.entities) {
            const poolId = entity.poolId;
            if (!poolId) {
                continue;
            }
            if (poolId === 'bullet') {
                activeBullets += 1;
            } else if (poolId === 'enemyBullet') {
                enemyBullets += 1;
            
            } else if (poolId === 'effect') {
                activeEffects += 1;
            } else if (typeof poolId === 'string' && poolId.startsWith('enemy:')) {
                enemyActive[poolId] = (enemyActive[poolId] || 0) + 1;
            }
        }

        const bulletPool = this._entityPools.get('bullet');
        const enemyBulletPool = this._entityPools.get('enemyBullet');
        const effectPool = this._entityPools.get('effect');

        const enemySummaries: string[] = [];
        this._enemyPools.forEach((pool, key) => {
            const shortKey = key.replace('enemy:', '');
            enemySummaries.push(`${shortKey}:${enemyActive[key] || 0}/${pool.size()}`);
        });

        const fpsDisplay = Number.isFinite(stats.fps) ? stats.fps.toFixed(1) : '--';
        const frameDisplay = Number.isFinite(stats.lastFrameMs) ? stats.lastFrameMs.toFixed(2) : '--';

        const collisionDiagnostics = this._collisionSystem && typeof this._collisionSystem.getDiagnostics === 'function'
            ? this._collisionSystem.getDiagnostics()
            : null;

        const lines = [
            `FPS: ${fpsDisplay} (frame ${frameDisplay}ms)`,
            `Frame Skips: ${this._lastFrameSkips}`,
            `Interpolation: ${this._frameInterpolation.toFixed(2)}`,
            `Entities: ${this.entities.length}`,
            `Player Bullets A:${activeBullets} | Pool:${bulletPool ? bulletPool.size() : 0}`,
            `Enemy Bullets A:${enemyBullets} | Pool:${enemyBulletPool ? enemyBulletPool.size() : 0}`,
            `Effects A:${activeEffects} | Pool:${effectPool ? effectPool.size() : 0}`
        ];

        if (collisionDiagnostics) {
            lines.push(`Grid cells: ${collisionDiagnostics.cells} | Occupants: ${collisionDiagnostics.entities}`);
        }

        if (enemySummaries.length) {
            lines.push(`Enemies ${enemySummaries.join(' ')}`);
        } else {
            lines.push('Enemies none');
        }

        const summary = this._profiler.getSummary();
        const updateStats = summary.measurements['frame:update'];
        const renderStats = summary.measurements['frame:render'];

        if (updateStats) {
            lines.push(`Update avg:${updateStats.averageMs.toFixed(2)}ms max:${updateStats.maxMs.toFixed(2)}ms`);
        }

        if (renderStats) {
            lines.push(`Render avg:${renderStats.averageMs.toFixed(2)}ms max:${renderStats.maxMs.toFixed(2)}ms`);
        }

        const systemMetrics = Object.entries(summary.measurements)
            .filter(([key]) => key.startsWith('system:'))
            .sort(([, a], [, b]) => (b.averageMs ?? 0) - (a.averageMs ?? 0))
            .slice(0, 3);

        if (systemMetrics.length) {
            lines.push('Systems:');
            for (const [key, stats] of systemMetrics) {
                const name = key.replace('system:', '');
                lines.push(`  ${name}: ${stats.averageMs.toFixed(2)}ms (max ${stats.maxMs.toFixed(2)}ms)`);
            }
        }

        this._performanceText.text = lines.join('\\n');
    }

    _ensurePools(): void {
        if (!this._entityPools.has('bullet')) {
            this._entityPools.set('bullet', new EntityPool<RuntimeEntity, PoolParamRecord>({
                create: () => this._createBulletEntity(),
                activate: (entity, params: PoolParamRecord = {}) => this._activateBulletEntity(entity, params),
                deactivate: entity => this._deactivateBulletEntity(entity),
                reset: entity => this._resetBulletEntity(entity)
            }));
        }

        if (!this._entityPools.has('enemyBullet')) {
            this._entityPools.set('enemyBullet', new EntityPool<RuntimeEntity, PoolParamRecord>({
                create: () => this._createEnemyBulletEntity(),
                activate: (entity, params: PoolParamRecord = {}) => this._activateEnemyBulletEntity(entity, params),
                deactivate: entity => this._deactivateEnemyBulletEntity(entity),
                reset: entity => this._resetEnemyBulletEntity(entity)
            }));
        }

        if (!this._entityPools.has('effect')) {
            this._entityPools.set('effect', new EntityPool<RuntimeEntity, PoolParamRecord>({
                create: () => this._createEffectEntity(),
                activate: (entity, params: PoolParamRecord = {}) => this._activateEffectEntity(entity, params),
                deactivate: entity => this._deactivateEffectEntity(entity),
                reset: entity => this._resetEffectEntity(entity)
            }));
        }
    }

    _applyBackground(alias?: string | null): void {
        if (!alias) {
            return;
        }

        const texture = PIXI.Assets.get(alias);
        if (!texture) {
            console.warn('GameplayRuntime: background alias not found', alias);
            return;
        }

        const background = new PIXI.Sprite(texture);
        background.x = 0;
        background.y = 0;
        const renderer = (this.app as { renderer?: { width?: number; height?: number } } | null)?.renderer;
        if (renderer?.width) {
            background.width = renderer.width;
        }
        if (renderer?.height) {
            background.height = renderer.height;
        }
        if (!renderer?.width) {
            const fallbackWidth = texture.width ?? texture.baseTexture?.width;
            if (fallbackWidth) {
                background.width = fallbackWidth;
            }
        }
        if (!renderer?.height) {
            const fallbackHeight = texture.height ?? texture.baseTexture?.height;
            if (fallbackHeight) {
                background.height = fallbackHeight;
            }
        }
        background.zIndex = -100;
        this.stage.addChildAt(background, 0);
        this.backgroundSprite = background;
    }

    _buildCoreSystems(): void {
        let inputService: InputService | null = null;
        try {
            inputService = this.services.resolve<InputService>('inputService');
        } catch (error) {
            inputService = null;
        }

        let eventBus: EventBus | null = null;
        try {
            eventBus = this.services.resolve<EventBus>('eventBus');
        } catch (error) {
            eventBus = null;
        }

        this._systemManager.register(new PlayerInputSystem(inputService));
        this._systemManager.register(new BehaviorTreeSystem(this, this.services));
        this._systemManager.register(new AbilitySystem(this, eventBus, inputService));
        this._systemManager.register(new EnemyBehaviorSystem(this));
        this._systemManager.register(new MovementSystem());
        this._systemManager.register(new EffectLifetimeSystem(this));
        this._systemManager.register(new ShootingSystem(this, this.services, eventBus));
        const collisionSystem = new CollisionSystem(this, eventBus);
        this._systemManager.register(collisionSystem);
        this._collisionSystem = collisionSystem;
        this._systemManager.register(new UISystem(this));
        this._systemManager.register(new BoundaryCleanupSystem(this));
        this._systemManager.register(new RenderSystem(this.app));
        this._systemManager.register(new CleanupSystem(this));

        this._bindPerformanceToggle(inputService);
        this._bindPerformanceToggle(inputService);
    }

    _setupAdventureMode(): void {
        const player = this._createPlayerEntity();
        this._registerEntity(player);

        const enemyOptions = this.sceneOptions?.enemies ?? {};
        this._systemManager.register(new EnemySpawningSystem(this, enemyOptions));
    }

    _setupBossMode(): void {
        const player = this._createPlayerEntity();
        this._registerEntity(player);

        const boss = new Entity() as RuntimeEntity;
        boss.addComponent(new Transform({ x: 400, y: 100 }));
        const bossDisplay = this._buildDisplayObject({
            atlasAlias: 'tarak-atlas-idle',
            animation: 'idle_phase1',
            fallbackAlias: 'amidogus',
            width: 160,
            height: 160,
            speed: 0.08
        });
        boss.addComponent(new Sprite(bossDisplay));
        boss.addComponent(new Motion({ x: 2, y: 0 }));
        boss.addComponent(new Collider(50));

        const healthComponent = boss.addComponent(new Health(500));
        healthComponent.max = 500;
        healthComponent.health = 500;

        const bossConfig: BossConfig | undefined = this.sceneOptions?.boss;
        const phases = bossConfig?.phases ?? [];
        boss.addComponent(new BossPhase(phases, healthComponent.max));
        boss.addComponent(new Boss());

        const initialPhase = phases[0] ?? null;
        const initialTreeId = bossConfig?.behaviorTreeId ?? initialPhase?.behaviorTreeId ?? null;
        if (initialTreeId) {
            boss.addComponent(new BehaviorTreeComponent(initialTreeId));
        }

        const initialWeaponId = bossConfig?.weaponId ?? initialPhase?.weaponId ?? 'boss-beam';
        const fireRate = typeof initialPhase?.fireRate === 'number' ? initialPhase.fireRate : 1.2;
        boss.addComponent(new Weapon({ weaponId: initialWeaponId, cooldown: fireRate }));

        this._registerEntity(boss);

        this._systemManager.register(new BossAISystem(this));
        this._systemManager.register(new BossShootingSystem(this));
    }

    _setupEnemyDemoMode(): void {
        const player = this._createPlayerEntity();
        this._registerEntity(player);
        const enemyOptions = this.sceneOptions?.enemies ?? {};
        this._systemManager.register(new EnemySpawningSystem(this, enemyOptions));
    }

    _createPlayerEntity(): RuntimeEntity {
        const player = new Entity() as RuntimeEntity;
        player.addComponent(new Transform({ x: 400, y: 500 }));
        const displayObject = this._buildDisplayObject({
            atlasAlias: 'player-atlas',
            animation: 'idle',
            fallbackAlias: 'player',
            width: 50,
            height: 50,
            speed: 0.12
        });
        player.addComponent(new Sprite(displayObject));
        player.addComponent(new Motion());
        player.addComponent(new Weapon());
        player.addComponent(new Collider(20));
        player.addComponent(new Health(100));
        player.addComponent(new PlayerAbilities());
        player.addComponent(new Player());
        return player;
    }

    _getResourceManager(): ResourceManager | null {
        if (this._resourceManager) {
            return this._resourceManager;
        }
        try {
            this._resourceManager = this.services.resolve<ResourceManager>('resourceManager');
        } catch (error) {
            this._resourceManager = null;
        }
        return this._resourceManager;
    }

    _buildDisplayObject(options: DisplayObjectOptions = {}): PIXI.Sprite | PIXI.AnimatedSprite {
        const { atlasAlias, animation = 'idle', fallbackAlias, width, height, speed } = options;
        const resourceManager = this._getResourceManager();
        let displayObject: PIXI.Sprite | PIXI.AnimatedSprite | null = null;

        if (resourceManager && atlasAlias) {
            const spritesheet = resourceManager.getSpritesheet(atlasAlias);
            if (spritesheet) {
                const frames = this._resolveAnimationFrames(spritesheet, animation ?? 'idle');
                if (frames.length) {
                    const animated = new PIXI.AnimatedSprite(frames);
                    animated.animationSpeed = speed ?? 0.1;
                    animated.loop = true;
                    animated.play();
                    displayObject = animated;
                }
            }
        }

        if (!displayObject) {
            const fallbackTexture = fallbackAlias ? PIXI.Assets.get(fallbackAlias) : null;
            const atlasTexture = atlasAlias ? PIXI.Assets.get(atlasAlias) : null;
            const texture = fallbackTexture || atlasTexture || PIXI.Texture.WHITE;
            displayObject = new PIXI.Sprite(texture);
        }

        if ('anchor' in displayObject && displayObject.anchor && typeof displayObject.anchor.set === 'function') {
            displayObject.anchor.set(0.5);
        } else if ('anchor' in displayObject && displayObject.anchor) {
            displayObject.anchor.x = displayObject.anchor.x ?? 0.5;
            displayObject.anchor.y = displayObject.anchor.y ?? 0.5;
        }

        if (typeof width === 'number' && width > 0) {
            displayObject.width = width;
        }
        if (typeof height === 'number' && height > 0) {
            displayObject.height = height;
        }

        return displayObject;
    }

    private _resolveAnimationFrames(spritesheet: PIXI.Spritesheet, animation: string): PIXI.Texture[] {
        const animations = spritesheet.animations ?? {};
        if (animations && animations[animation] && animations[animation].length) {
            return animations[animation].slice();
        }

        if (animations && animations.idle && animations.idle.length) {
            return animations.idle.slice();
        }

        const textures = spritesheet.textures ?? {};
        const textureNames = Object.keys(textures);
        if (!textureNames.length) {
            return [];
        }

        const normalizedName = animation?.toLowerCase() ?? 'idle';
        const prefixed = textureNames.filter(name => {
            const lower = name.toLowerCase();
            return lower.startsWith(`${normalizedName}-`) || lower.startsWith(`${normalizedName}/`);
        });

        const selected = prefixed.length ? prefixed : textureNames;
        const ordered = selected.slice().sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
        return ordered.map(name => textures[name]).filter((texture): texture is PIXI.Texture => !!texture);
    }

    _createBulletEntity(): RuntimeEntity {
        const bullet = new Entity() as RuntimeEntity;
        bullet.poolId = 'bullet';
        bullet.addComponent(new Transform({ x: 0, y: 0 }));
        const sprite = new PIXI.Sprite(PIXI.Texture.WHITE);
        sprite.width = 5;
        sprite.height = 12;
        sprite.tint = 0xffff88;
        sprite.anchor.set(0.5);
        bullet.addComponent(new Sprite(sprite));
        bullet.addComponent(new Motion({ x: 0, y: -12 }));
        bullet.addComponent(new Bullet());
        bullet.addComponent(new Collider(5));
        bullet.damage = 25;
        return bullet;
    }

    _resetBulletEntity(entity: RuntimeEntity): void {
        const transform = getComponentOrNull(entity, Transform);
        if (transform) {
            transform.position.x = 0;
            transform.position.y = 0;
        }
        const motion = getComponentOrNull(entity, Motion);
        if (motion) {
            motion.velocity.x = 0;
            motion.velocity.y = -12;
        }
        entity.damage = 25;
        entity.projectileOwner = 'player';
    }

    _activateBulletEntity(entity: RuntimeEntity, params: PoolParamRecord = {}): void {
        const transform = getComponentOrNull(entity, Transform);
        const motion = getComponentOrNull(entity, Motion);
        const sprite = getComponentOrNull(entity, Sprite)?.sprite;
        const options = params as Partial<ProjectileSpawnPayload>;

        if (transform) {
            transform.position.x = options.position?.x ?? 0;
            transform.position.y = options.position?.y ?? 0;
        }

        if (motion) {
            motion.velocity.x = options.velocity?.x ?? 0;
            motion.velocity.y = options.velocity?.y ?? -12;
        }

        if (sprite) {
            sprite.visible = true;
            if (typeof options.tint === 'number') {
                sprite.tint = options.tint;
            }
            if (options.scale && sprite.scale) {
                if (typeof options.scale === 'number') {
                    sprite.scale.set(options.scale);
                } else if (typeof options.scale === 'object') {
                    sprite.scale.x = options.scale.x ?? sprite.scale.x;
                    sprite.scale.y = options.scale.y ?? sprite.scale.y;
                }
            }
        }

        entity.damage = typeof options.damage === 'number' ? options.damage : entity.damage;
        entity.projectileOwner = 'player';
        entity.isRemoved = false;
    }

    _deactivateBulletEntity(entity: RuntimeEntity): void {
        const sprite = getComponentOrNull(entity, Sprite)?.sprite;
        if (sprite) {
            sprite.visible = false;
        }

        const motion = getComponentOrNull(entity, Motion);
        if (motion) {
            motion.velocity.x = 0;
            motion.velocity.y = 0;
        }
    }

    _createEnemyBulletEntity(): RuntimeEntity {
        const projectile = new Entity() as RuntimeEntity;
        projectile.poolId = 'enemyBullet';
        projectile.addComponent(new Transform({ x: 0, y: 0 }));
        const sprite = new PIXI.Sprite(PIXI.Texture.WHITE);
        sprite.width = 10;
        sprite.height = 10;
        sprite.tint = 0xff5555;
        sprite.anchor.set(0.5);
        projectile.addComponent(new Sprite(sprite));
        projectile.addComponent(new Motion({ x: 0, y: 6 }));
        projectile.addComponent(new EnemyBullet());
        projectile.addComponent(new Collider(6));
        projectile.damage = 15;
        return projectile;
    }

    _resetEnemyBulletEntity(entity: RuntimeEntity): void {
        const transform = getComponentOrNull(entity, Transform);
        if (transform) {
            transform.position.x = 0;
            transform.position.y = 0;
        }
        const motion = getComponentOrNull(entity, Motion);
        if (motion) {
            motion.velocity.x = 0;
            motion.velocity.y = 6;
        }
        entity.damage = 15;
        entity.projectileOwner = 'enemy';
    }

    _activateEnemyBulletEntity(entity: RuntimeEntity, params: PoolParamRecord = {}): void {
        const transform = getComponentOrNull(entity, Transform);
        const motion = getComponentOrNull(entity, Motion);
        const sprite = getComponentOrNull(entity, Sprite)?.sprite;
        const options = params as Partial<ProjectileSpawnPayload>;

        if (transform) {
            transform.position.x = options.position?.x ?? 0;
            transform.position.y = options.position?.y ?? 0;
        }

        if (motion) {
            motion.velocity.x = options.velocity?.x ?? 0;
            motion.velocity.y = options.velocity?.y ?? 6;
        }

        if (sprite) {
            sprite.visible = true;
            if (typeof options.tint === 'number') {
                sprite.tint = options.tint;
            }
            if (options.scale && sprite.scale) {
                if (typeof options.scale === 'number') {
                    sprite.scale.set(options.scale);
                } else if (typeof options.scale === 'object') {
                    sprite.scale.x = options.scale.x ?? sprite.scale.x;
                    sprite.scale.y = options.scale.y ?? sprite.scale.y;
                }
            }
        }

        entity.damage = typeof options.damage === 'number' ? options.damage : entity.damage;
        entity.projectileOwner = 'enemy';
        entity.isRemoved = false;
    }

    _deactivateEnemyBulletEntity(entity: RuntimeEntity): void {
        const sprite = getComponentOrNull(entity, Sprite)?.sprite;
        if (sprite) {
            sprite.visible = false;
        }
        const motion = getComponentOrNull(entity, Motion);
        if (motion) {
            motion.velocity.x = 0;
            motion.velocity.y = 0;
        }
    }

    _createEffectEntity(): RuntimeEntity {
        const effect = new Entity() as RuntimeEntity;
        effect.poolId = 'effect';
        effect.addComponent(new Transform({ x: 0, y: 0 }));
        const placeholderTexture = PIXI.Texture.EMPTY || PIXI.Texture.WHITE;
        const animated = new PIXI.AnimatedSprite([placeholderTexture]);
        animated.texture = placeholderTexture;
        animated.visible = false;
        animated.loop = false;
        animated.animationSpeed = 0.18;
        animated.anchor.set(0.5);
        effect.addComponent(new Sprite(animated));
        return effect;
    }

    _resetEffectEntity(entity: RuntimeEntity): void {
        entity.lifeTime = 0;
        entity.fadeRate = null;
        const transform = getComponentOrNull(entity, Transform);
        if (transform) {
            transform.position.x = 0;
            transform.position.y = 0;
        }
        const spriteComponent = getComponentOrNull(entity, Sprite);
        const sprite = spriteComponent?.sprite;
        if (sprite) {
            sprite.visible = false;
            sprite.alpha = 0;
            if (sprite instanceof PIXI.AnimatedSprite) {
                sprite.stop();
                if (typeof sprite.gotoAndStop === 'function') {
                    try {
                        sprite.gotoAndStop(0);
                    } catch (error) {
                        // ignore
                    }
                }
            }
        }
        (entity as any)._atlasAlias = null;
        (entity as any)._atlasAnimation = null;
    }

    _activateEffectEntity(entity: RuntimeEntity, params: PoolParamRecord = {}): void {
        const transform = getComponentOrNull(entity, Transform);
        const spriteComponent = getComponentOrNull(entity, Sprite);
        const sprite = spriteComponent?.sprite;
        const options = params as Partial<EffectSpawnOptions>;

        if (transform) {
            transform.position.x = options.position?.x ?? 0;
            transform.position.y = options.position?.y ?? 0;
        }

        if (sprite) {
            sprite.visible = true;
            const targetAlpha = typeof options.alpha === 'number' ? options.alpha : sprite.alpha || 0.9;
            sprite.alpha = targetAlpha;
            if (typeof options.tint === 'number') {
                (sprite as PIXI.Sprite).tint = options.tint;
            }
            if (options.scale) {
                if (typeof options.scale === 'number') {
                    if (sprite.scale && typeof sprite.scale.set === 'function') {
                        sprite.scale.set(options.scale);
                    } else if (sprite.scale) {
                        sprite.scale.x = options.scale;
                        sprite.scale.y = options.scale;
                    }
                } else if (typeof options.scale === 'object' && sprite.scale) {
                    sprite.scale.x = options.scale.x ?? sprite.scale.x;
                    sprite.scale.y = options.scale.y ?? sprite.scale.y;
                }
            }

            if (sprite instanceof PIXI.AnimatedSprite) {
                const resourceManager = this._getResourceManager();
                const alias = options.atlasAlias ?? ((entity as any)._atlasAlias as string | null) ?? null;
                const animation = options.animation ?? ((entity as any)._atlasAnimation as string | null) ?? null;
                const shouldReload = !!options.atlasAlias && options.atlasAlias !== (entity as any)._atlasAlias;
                const shouldReanimate = shouldReload || (animation && animation !== (entity as any)._atlasAnimation);

                if (resourceManager && alias && (shouldReload || sprite.textures.length === 0)) {
                    const spritesheet = resourceManager.getSpritesheet(alias);
                    if (spritesheet) {
                        const frames = this._resolveAnimationFrames(spritesheet, animation ?? 'idle');
                        if (frames.length) {
                            sprite.textures = frames;
                            sprite.gotoAndPlay(0);
                        }
                    }
                }

                if (typeof options.animationSpeed === 'number') {
                    sprite.animationSpeed = options.animationSpeed;
                }

                sprite.loop = options.loop ?? false;
                if (shouldReanimate && typeof sprite.gotoAndPlay === 'function') {
                    try {
                        sprite.gotoAndPlay(0);
                    } catch (error) {
                        sprite.play();
                    }
                } else if (!sprite.playing) {
                    sprite.play();
                }

                (entity as any)._atlasAlias = alias;
                (entity as any)._atlasAnimation = animation;
            }
        }

        entity.lifeTime = typeof options.lifeTime === 'number' ? options.lifeTime : 0.25;
        entity.fadeRate = typeof options.fade === 'number' ? options.fade : null;
        entity.isRemoved = false;
    }

    _deactivateEffectEntity(entity: RuntimeEntity): void {
        const sprite = getComponentOrNull(entity, Sprite)?.sprite;
        if (sprite) {
            sprite.visible = false;
            sprite.alpha = 0;
            if (sprite instanceof PIXI.AnimatedSprite && typeof sprite.stop === 'function') {
                sprite.stop();
            }
        }
        entity.fadeRate = null;
        entity.lifeTime = 0;
    }

    spawnPlayerBullet(
        position: Vector2Like,
        velocity: Vector2Like,
        options: Partial<ProjectileSpawnPayload> = {}
    ): RuntimeEntity | null {
        return this.spawnProjectile({ type: 'player', position, velocity, ...options });
    }

    spawnProjectile(options: Partial<ProjectileSpawnPayload> = {}): RuntimeEntity | null {
        const type = options.type === 'enemy' ? 'enemy' : 'player';
        const poolKey = type === 'enemy' ? 'enemyBullet' : 'bullet';
        const pool = this._entityPools.get(poolKey);
        if (!pool) {
            return null;
        }

        const normalized: ProjectileSpawnPayload = {
            type,
            position: options.position ?? { x: 0, y: 0 },
            velocity: options.velocity ?? { x: 0, y: type === 'enemy' ? 6 : -12 },
            ...options
        } as ProjectileSpawnPayload;

        const projectile = pool.acquire(normalized);
        if (!projectile) {
            return null;
        }

        projectile.poolId = poolKey;
        projectile.projectileOwner = type;
        if (typeof normalized.damage === 'number') {
            projectile.damage = normalized.damage;
        }

        this._registerEntity(projectile);
        return projectile;
    }

    spawnEffect(options: Partial<EffectSpawnOptions> = {}): RuntimeEntity | null {
        const pool = this._entityPools.get('effect');
        if (!pool) {
            return null;
        }
        const normalized: EffectSpawnOptions = {
            position: options.position ?? { x: 0, y: 0 },
            lifeTime: options.lifeTime,
            tint: options.tint,
            scale: options.scale,
            alpha: options.alpha,
            fade: options.fade,
            atlasAlias: options.atlasAlias,
            animation: options.animation,
            animationSpeed: options.animationSpeed,
            loop: options.loop
        };
        const effect = pool.acquire(normalized as unknown as PoolParamRecord);
        if (!effect) {
            return null;
        }
        effect.poolId = 'effect';
        this._registerEntity(effect);
        return effect;
    }

    _getEnemyPool(template: EnemySpawnTemplate): RuntimePool | undefined {
        const key = template && template.id ? 'enemy:' + template.id : 'enemy:default';
        if (!this._enemyPools.has(key)) {
            this._enemyPools.set(key, new EntityPool<RuntimeEntity, PoolParamRecord>({
                create: () => this._buildEnemyEntity(template),
                activate: (entity, params = {}) =>
                    this._activateEnemyEntity(entity, template, params as EnemySpawnContext),
                deactivate: entity => this._deactivateEnemyEntity(entity)
            }));
        }
        return this._enemyPools.get(key);
    }

    spawnEnemyFromTemplate(template: EnemySpawnTemplate | null, context: EnemySpawnContext = {}): RuntimeEntity | null {
        if (!template) {
            return null;
        }
        const pool = this._getEnemyPool(template);
        const enemy = pool ? pool.acquire(context as PoolParamRecord) : null;
        if (!enemy) {
            return null;
        }
        enemy.poolId = template && template.id ? 'enemy:' + template.id : 'enemy:default';
        this._registerEntity(enemy);
        return enemy;
    }

    _buildEnemyEntity(template: EnemySpawnTemplate = {}): RuntimeEntity {
        const enemy = new Entity() as RuntimeEntity;
        enemy.poolId = template && template.id ? 'enemy:' + template.id : 'enemy:default';
        enemy.addComponent(new Transform({ x: 0, y: 0 }));
        const displayObject = this._buildDisplayObject({
            atlasAlias: template.spritesheet?.alias,
            animation: template.spritesheet?.animation || 'idle',
            fallbackAlias: template.texture,
            width: template.spriteWidth,
            height: template.spriteHeight,
            speed: template.spritesheet?.speed
        });
        enemy.addComponent(new Sprite(displayObject));
        enemy.addComponent(new Motion({ x: 0, y: template.verticalSpeed ?? 2 }));
        enemy.addComponent(new Enemy());
        enemy.addComponent(new Collider(template.colliderRadius ?? 20));
        enemy.addComponent(new EnemyBehavior({ ...template }));
        enemy.addComponent(new Health(template.health ?? 50));

        if (template.behaviorTreeId) {
            enemy.addComponent(new BehaviorTreeComponent(template.behaviorTreeId));
        }

        if (template.weaponId) {
            enemy.addComponent(new Weapon({
                weaponId: template.weaponId,
                cooldown: template.weaponCooldown ?? template.fireRate ?? 1.0
            }));
        }
        return enemy;
    }

    _activateEnemyEntity(
        entity: RuntimeEntity,
        template: EnemySpawnTemplate = {},
        params: EnemySpawnContext = {}
    ): void {
        const transform = getComponentOrNull(entity, Transform);
        const motion = getComponentOrNull(entity, Motion);
        const behavior = getComponentOrNull(entity, EnemyBehavior);
        const sprite = getComponentOrNull(entity, Sprite)?.sprite;
        const health = getComponentOrNull(entity, Health);

        const position = (params.position ?? {}) as Partial<Vector2Like>;
        const altitude = params.altitude;
        const screen = this.app.renderer?.screen ?? this.app.screen;

        if (transform) {
            const positionRatio = params.positionRatio ?? null;
            if (typeof positionRatio === 'number') {
                transform.position.x = screen.width * positionRatio;
            } else if (typeof position.x === 'number') {
                transform.position.x = position.x;
            }
            transform.position.y = typeof position.y === 'number'
                ? position.y
                : typeof altitude === 'number'
                    ? altitude
                    : -50;
        }

        if (motion) {
            motion.velocity.x = 0;
            motion.velocity.y = template.verticalSpeed ?? 2;
        }

        if (behavior) {
            behavior.pattern = template.pattern ?? behavior.pattern ?? 'sine';
            behavior.frequency = template.frequency ?? behavior.frequency;
            behavior.amplitude = template.amplitude ?? behavior.amplitude;
            behavior.verticalSpeed = template.verticalSpeed ?? behavior.verticalSpeed;
            behavior.diveSpeed = template.diveSpeed ?? behavior.diveSpeed;
            behavior.climbSpeed = template.climbSpeed ?? behavior.climbSpeed;
            behavior.horizontalSpeed = template.horizontalSpeed ?? behavior.horizontalSpeed;
            behavior.horizontalDrift = template.horizontalDrift ?? behavior.horizontalDrift;
            behavior.originX = transform ? transform.position.x : behavior.originX;
            behavior.elapsed = 0;
        }

        const treeComponent = entity.getComponent(BehaviorTreeComponent);
        if (treeComponent) {
            treeComponent.treeId = template.behaviorTreeId ?? treeComponent.treeId ?? null;
            treeComponent.steps = [];
            treeComponent.stepIndex = 0;
            treeComponent.stepElapsed = 0;
            treeComponent.current = null;
        } else if (template.behaviorTreeId) {
            entity.addComponent(new BehaviorTreeComponent(template.behaviorTreeId));
        }

        const weaponComponent = entity.getComponent(Weapon);
        if (weaponComponent) {
            weaponComponent.weaponId = template.weaponId ?? weaponComponent.weaponId;
            const cooldown = template.weaponCooldown ?? template.fireRate;
            if (typeof cooldown === 'number') {
                weaponComponent.cooldown = cooldown;
                weaponComponent.fireRate = cooldown;
            }
            weaponComponent.isShooting = false;
            weaponComponent.triggerShot = false;
            weaponComponent.fireTimer = 0;
        } else if (template.weaponId) {
            entity.addComponent(new Weapon({
                weaponId: template.weaponId,
                cooldown: template.weaponCooldown ?? template.fireRate ?? 1.0
            }));
        }

        if (sprite) {
            sprite.visible = true;
            if (sprite instanceof PIXI.AnimatedSprite) {
                const animName = template.spritesheet?.animation ?? 'idle';
                const animatedSprite = sprite as PIXI.AnimatedSprite;
                const gotoAndPlay = (animatedSprite as unknown as { gotoAndPlay?(sequence: string): void }).gotoAndPlay;
                if (typeof gotoAndPlay === 'function') {
                    try {
                        gotoAndPlay.call(animatedSprite, animName);
                    } catch (error) {
                        animatedSprite.play();
                    }
                } else {
                    animatedSprite.play();
                }
            }
        }

        if (health) {
            health.max = template.health ?? health.max ?? 50;
            health.health = health.max;
        }

        entity.isRemoved = false;
    }

    _deactivateEnemyEntity(entity: RuntimeEntity): void {
        const sprite = getComponentOrNull(entity, Sprite)?.sprite;
        if (sprite) {
            sprite.visible = false;
            if (sprite instanceof PIXI.AnimatedSprite && typeof sprite.stop === 'function') {
                sprite.stop();
            }
        }
        const motion = getComponentOrNull(entity, Motion);
        if (motion) {
            motion.velocity.x = 0;
            motion.velocity.y = 0;
        }
        const behavior = getComponentOrNull(entity, EnemyBehavior);
        if (behavior) {
            behavior.originX = null;
            behavior.elapsed = 0;
        }
    }

    releaseEntity(entity: RuntimeEntity | null | undefined, index?: number): void {
        if (!entity) {
            return;
        }

        const spriteComponent = getComponentOrNull(entity, Sprite);
        if (spriteComponent?.sprite?.parent) {
            spriteComponent.sprite.parent.removeChild(spriteComponent.sprite);
        }

        const removalIndex = typeof index === 'number' ? index : this.entities.indexOf(entity);
        if (removalIndex > -1) {
            this.entities.splice(removalIndex, 1);
        }

        entity.isRemoved = false;

        const poolId = entity.poolId;
        if (!poolId) {
            return;
        }

        const pool = this._entityPools.get(poolId) || this._enemyPools.get(poolId);
        if (pool) {
            pool.release(entity);
        }
    }

    _attachSprite(entity: RuntimeEntity | null | undefined): void {
        if (!entity || !entity.hasComponent || !entity.hasComponent(Sprite)) {
            return;
        }
        const spriteComponent = getComponentOrNull(entity, Sprite);
        const sprite = spriteComponent?.sprite;
        if (sprite && !sprite.parent) {
            this.stage.addChild(sprite);
        }
    }

    _detachSprite(entity: RuntimeEntity | null | undefined): void {
        if (!entity || !entity.hasComponent || !entity.hasComponent(Sprite)) {
            return;
        }
        const spriteComponent = getComponentOrNull(entity, Sprite);
        const sprite = spriteComponent?.sprite;
        if (sprite && sprite.parent) {
            sprite.parent.removeChild(sprite);
        }
    }

    _registerEntity(entity: RuntimeEntity | null | undefined, isPooled = false): void {
        if (!entity) {
            return;
        }
        if (!isPooled || !this.entities.includes(entity)) {
            if (!this.entities.includes(entity)) {
                this.entities.push(entity);
            }
        }
        this._attachSprite(entity);
    }
}


















