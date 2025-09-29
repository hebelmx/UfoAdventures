class GameplayRuntime {
    constructor(app, services) {
        this.app = app;
        this.services = services;
        this.stage = new PIXI.Container();
        this.stage.sortableChildren = true;

        this._resourceManager = null;
        this._entityPools = new Map();
        this._enemyPools = new Map();

        this._performanceText = null;
        this._performanceStats = { frameCount: 0, accumulator: 0, fps: 0, lastFrameMs: 0 };
        this._performanceOverlayVisible = true;
        this._performanceToggleOff = null;

        this.entities = [];
        this.systems = [];
        this.mode = 'adventure';
        this.sceneOptions = {};
        this.backgroundSprite = null;
        this._isRunning = false;
        this._paused = false;
    }

    start(mode, options = {}) {
        this.mode = mode || 'adventure';
        this.sceneOptions = options;
        this._ensureStageAttached();
        this._resetWorld();
        this._ensurePools();
        this._applyBackground(options.backgroundAlias || 'background');
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

    update(delta) {
        if (!this._isRunning || this._paused) {
            return;
        }

        for (const system of this.systems) {
            system.update(this.entities, delta);
        }

        this._updatePerformanceOverlay(delta);
    }

    // Test helpers (read-only)
    getActiveCounts() {
        const bullets = this.entities.filter(e => e.hasComponent && e.hasComponent(Bullet) && !e.isRemoved).length;
        const effects = this.entities.filter(e => e.hasComponent && e.hasComponent(Sprite) && e.poolId === 'effect' && !e.isRemoved).length;
        const enemies = this.entities.filter(e => e.hasComponent && e.hasComponent(Enemy) && !e.isRemoved).length;
        const player = this.entities.find(e => e.hasComponent && e.hasComponent(Player)) || null;
        return { bullets, effects, enemies, hasPlayer: !!player };
    }

    stop() {
        if (!this._isRunning) {
            return;
        }

        for (const system of this.systems) {
            if (typeof system.destroy === 'function') {
                system.destroy();
            }
        }

        this._isRunning = false;
        this._paused = false;
        this._resetWorld();
    }

    setPaused(isPaused) {
        this._paused = !!isPaused;
    }

    isPaused() {
        return this._paused;
    }

    removeEntity(entity) {
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

    addEntity(entity) {
        this._registerEntity(entity);
    }

    _ensureStageAttached() {
        if (!this.stage.parent) {
            this.app.stage.addChild(this.stage);
        }
    }

    _resetWorld() {
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
        this.entities = [];
        this.systems = [];
        this._collisionSystem = null;
    }

    _ensurePerformanceOverlay() {
        if (!this._performanceText) {
            const options = {
                fontFamily: 'Consolas, Menlo, monospace',
                fontSize: 12,
                fill: 0xbfd6ff,
                align: 'left'
            };
            const text = new PIXI.Text('FPS: �', options);
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

    _bindPerformanceToggle(inputService) {
        if (!inputService || typeof inputService.registerCommand !== 'function' || this._performanceToggleOff) {
            return;
        }
        this._performanceToggleOff = inputService.registerCommand('togglePerformanceOverlay', () => {
            this._togglePerformanceOverlay();
        }, { trigger: 'down' });
    }

    _unbindPerformanceToggle() {
        if (typeof this._performanceToggleOff === 'function') {
            try {
                this._performanceToggleOff();
            } catch (error) {
                console.warn('GameplayRuntime: failed to unbind performance toggle', error);
            }
        }
        this._performanceToggleOff = null;
    }

    _togglePerformanceOverlay() {
        this._performanceOverlayVisible = !this._performanceOverlayVisible;
        if (this._performanceText) {
            this._performanceText.visible = this._performanceOverlayVisible;
        }
    }

_updatePerformanceOverlay(delta) {
        if (!this._performanceText) {
            return;
        }

        const stats = this._performanceStats || (this._performanceStats = { frameCount: 0, accumulator: 0, fps: 0, lastFrameMs: 0 });
        const elapsedMS = Number.isFinite(this.app?.ticker?.elapsedMS) ? this.app.ticker.elapsedMS : ((delta || 1) * (1000 / 60));

        stats.lastFrameMs = elapsedMS || 0;
        stats.accumulator += stats.lastFrameMs;
        stats.frameCount += 1;

        if (stats.accumulator >= 500) {
            stats.fps = (stats.frameCount * 1000) / stats.accumulator;
            stats.accumulator = 0;
            stats.frameCount = 0;
        }

        let activeBullets = 0;
        let activeEffects = 0;
        const enemyActive = {};

        for (const entity of this.entities) {
            const poolId = entity.poolId;
            if (!poolId) {
                continue;
            }
            if (poolId === 'bullet') {
                activeBullets += 1;
            } else if (poolId === 'effect') {
                activeEffects += 1;
            } else if (typeof poolId === 'string' && poolId.startsWith('enemy:')) {
                enemyActive[poolId] = (enemyActive[poolId] || 0) + 1;
            }
        }

        const bulletPool = this._entityPools.get('bullet');
        const effectPool = this._entityPools.get('effect');

        const enemySummaries = [];
        this._enemyPools.forEach((pool, key) => {
            const shortKey = key.replace('enemy:', '');
            enemySummaries.push(`${shortKey}:${enemyActive[key] || 0}/${pool.size()}`);
        });

        const fpsDisplay = Number.isFinite(stats.fps) ? stats.fps.toFixed(1) : '�';
        const frameDisplay = Number.isFinite(stats.lastFrameMs) ? stats.lastFrameMs.toFixed(2) : '�';

        const collisionDiagnostics = this._collisionSystem && typeof this._collisionSystem.getDiagnostics === 'function'
            ? this._collisionSystem.getDiagnostics()
            : null;

        const lines = [
            `FPS: ${fpsDisplay} (frame ${frameDisplay}ms)`,
            `Entities: ${this.entities.length}`,
            `Bullets A:${activeBullets} | Pool:${bulletPool ? bulletPool.size() : 0}`,
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

        this._performanceText.text = lines.join('\n');
    }

    _ensurePools() {
        if (!this._entityPools.has('bullet')) {
            this._entityPools.set('bullet', new EntityPool({
                create: () => this._createBulletEntity(),
                activate: (entity, params = {}) => this._activateBulletEntity(entity, params),
                deactivate: (entity) => this._deactivateBulletEntity(entity),
                reset: (entity) => this._resetBulletEntity(entity)
            }));
        }

        if (!this._entityPools.has('effect')) {
            this._entityPools.set('effect', new EntityPool({
                create: () => this._createEffectEntity(),
                activate: (entity, params = {}) => this._activateEffectEntity(entity, params),
                deactivate: (entity) => this._deactivateEffectEntity(entity),
                reset: (entity) => this._resetEffectEntity(entity)
            }));
        }
    }

    _applyBackground(alias) {
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
        background.width = this.app.renderer.width || this.app.screen.width;
        background.height = this.app.renderer.height || this.app.screen.height;
        background.zIndex = -100;
        this.stage.addChildAt(background, 0);
        this.backgroundSprite = background;
    }

    _buildCoreSystems() {
        const inputService = this.services.resolve('inputService');
        let eventBus = null;
        try {
            eventBus = this.services.resolve('eventBus');
        } catch (error) {
            eventBus = null;
        }

        this.systems.push(new PlayerInputSystem(inputService));
        this.systems.push(new AbilitySystem(this, eventBus, inputService));
        this.systems.push(new EnemyBehaviorSystem(this));
        this.systems.push(new MovementSystem());
        this.systems.push(new EffectLifetimeSystem(this));
        this.systems.push(new ShootingSystem(this, eventBus));
        const collisionSystem = new CollisionSystem(this, eventBus);
        this.systems.push(collisionSystem);
        this._collisionSystem = collisionSystem;
        this.systems.push(new UISystem(this));
        this.systems.push(new BoundaryCleanupSystem(this));
        this.systems.push(new RenderSystem(this.app));
        this.systems.push(new CleanupSystem(this));

        this._bindPerformanceToggle(inputService);
    }

    _setupAdventureMode() {
        const player = this._createPlayerEntity();
        this._registerEntity(player);

        const enemyOptions = this.sceneOptions?.enemies || {};
        this.systems.push(new EnemySpawningSystem(this, enemyOptions));
    }

    _setupBossMode() {
        const player = this._createPlayerEntity();
        this._registerEntity(player);

        const boss = new Entity();
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
        boss.addComponent(new Health(500));
        boss.getComponent(Health).max = 500;

        const bossConfig = this.sceneOptions?.boss || {};
        boss.addComponent(new BossPhase(bossConfig.phases || [], boss.getComponent(Health).max));
        boss.addComponent(new Boss());
        this._registerEntity(boss);

        this.systems.push(new BossAISystem(this));
        this.systems.push(new BossShootingSystem(this));
    }

    _setupEnemyDemoMode() {
        const player = this._createPlayerEntity();
        this._registerEntity(player);
        const enemyOptions = this.sceneOptions?.enemies || {};
        this.systems.push(new EnemySpawningSystem(this, enemyOptions));
    }

    _createPlayerEntity() {
        const player = new Entity();
        player.addComponent(new Transform({ x: 400, y: 500 }));
        const displayObject = this._buildDisplayObject({
            atlasAlias: 'player-atlas',
            animation: 'idle',
            fallbackAlias: 'player',
            width: 50,
            height: 50,
            speed: 0.12
        });
        player.addComponent(new Sprite(displayObject));        player.addComponent(new Motion());
        player.addComponent(new Weapon());
        player.addComponent(new Collider(20));
        player.addComponent(new Health(100));
        player.addComponent(new PlayerAbilities());
        player.addComponent(new Player());
        return player;
    }

    _getResourceManager() {
        if (this._resourceManager) {
            return this._resourceManager;
        }
        try {
            this._resourceManager = this.services.resolve('resourceManager');
        } catch (error) {
            this._resourceManager = null;
        }
        return this._resourceManager;
    }

    _buildDisplayObject(options = {}) {
        const { atlasAlias, animation = 'idle', fallbackAlias, width, height, speed } = options || {};
        const resourceManager = this._getResourceManager();
        let displayObject = null;

        if (resourceManager && atlasAlias) {
            const spritesheet = resourceManager.getSpritesheet(atlasAlias);
            if (spritesheet) {
                const animationName = animation in (spritesheet.animations || {}) ? animation : 'idle';
                const frameNames = (spritesheet.animations && spritesheet.animations[animationName]) || (spritesheet.animations && spritesheet.animations.idle) || [];
                const textures = frameNames
                    .map(name => spritesheet.textures ? spritesheet.textures[name] : null)
                    .filter(texture => !!texture);
                if (textures.length) {
                    displayObject = new PIXI.AnimatedSprite(textures);
                    displayObject.animationSpeed = speed ?? 0.1;
                    displayObject.loop = true;
                    displayObject.play();
                }
            }
        }

        if (!displayObject) {
            const fallbackTexture = fallbackAlias ? PIXI.Assets.get(fallbackAlias) : null;
            const atlasTexture = atlasAlias ? PIXI.Assets.get(atlasAlias) : null;
            const texture = fallbackTexture || atlasTexture || PIXI.Texture.WHITE;
            displayObject = new PIXI.Sprite(texture);
        }

        if (displayObject.anchor && typeof displayObject.anchor.set === 'function') {
            displayObject.anchor.set(0.5);
        } else if (displayObject.anchor) {
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

    _createBulletEntity() {
        const bullet = new Entity();
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
        return bullet;
    }

    _resetBulletEntity(entity) {
        const transform = entity.getComponent(Transform);
        if (transform) {
            transform.position.x = 0;
            transform.position.y = 0;
        }
        const motion = entity.getComponent(Motion);
        if (motion) {
            motion.velocity.x = 0;
            motion.velocity.y = -12;
        }
    }

    _activateBulletEntity(entity, params = {}) {
        const transform = entity.getComponent(Transform);
        const motion = entity.getComponent(Motion);
        const sprite = entity.getComponent(Sprite)?.sprite;

        if (transform) {
            transform.position.x = params.position?.x ?? 0;
            transform.position.y = params.position?.y ?? 0;
        }

        if (motion) {
            motion.velocity.x = params.velocity?.x ?? 0;
            motion.velocity.y = params.velocity?.y ?? -12;
        }

        if (sprite) {
            sprite.visible = true;
            if (typeof params.tint === 'number') {
                sprite.tint = params.tint;
            }
        }

        entity.isRemoved = false;
    }

    _deactivateBulletEntity(entity) {
        const sprite = entity.getComponent(Sprite)?.sprite;
        if (sprite) {
            sprite.visible = false;
        }

        const motion = entity.getComponent(Motion);
        if (motion) {
            motion.velocity.x = 0;
            motion.velocity.y = 0;
        }
    }

    _createEffectEntity() {
        const effect = new Entity();
        effect.poolId = 'effect';
        effect.addComponent(new Transform({ x: 0, y: 0 }));
        const sprite = new PIXI.Sprite(PIXI.Texture.WHITE);
        sprite.width = 16;
        sprite.height = 16;
        sprite.alpha = 0.7;
        sprite.anchor.set(0.5);
        effect.addComponent(new Sprite(sprite));
        return effect;
    }

    _resetEffectEntity(entity) {
        entity.lifeTime = 0;
        entity.fadeRate = null;
        const transform = entity.getComponent(Transform);
        if (transform) {
            transform.position.x = 0;
            transform.position.y = 0;
        }
    }

    _activateEffectEntity(entity, params = {}) {
        const transform = entity.getComponent(Transform);
        const sprite = entity.getComponent(Sprite)?.sprite;

        if (transform) {
            transform.position.x = params.position?.x ?? 0;
            transform.position.y = params.position?.y ?? 0;
        }

        if (sprite) {
            sprite.visible = true;
            const targetAlpha = typeof params.alpha === 'number' ? params.alpha : (sprite.alpha === 0 ? 0.9 : sprite.alpha);
            sprite.alpha = targetAlpha;
            if (typeof params.tint === 'number') {
                sprite.tint = params.tint;
            }
            if (params.scale && sprite.scale) {
                if (typeof params.scale === 'number') {
                    sprite.scale.set(params.scale);
                } else if (typeof params.scale === 'object') {
                    sprite.scale.x = params.scale.x ?? sprite.scale.x;
                    sprite.scale.y = params.scale.y ?? sprite.scale.y;
                }
            }
            if (sprite instanceof PIXI.AnimatedSprite && params.animation) {
                if (typeof sprite.gotoAndPlay === 'function') {
                    try {
                        sprite.gotoAndPlay(params.animation);
                    } catch (error) {
                        sprite.play(params.animation);
                    }
                } else if (typeof sprite.play === 'function') {
                    sprite.play(params.animation);
                }
            }
        }

        entity.lifeTime = typeof params.lifeTime === 'number' ? params.lifeTime : 0.25;
        entity.fadeRate = typeof params.fade === 'number' ? params.fade : null;
        entity.isRemoved = false;
    }

    _deactivateEffectEntity(entity) {
        const sprite = entity.getComponent(Sprite)?.sprite;
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

    spawnPlayerBullet(position, velocity, options = {}) {
        const pool = this._entityPools.get('bullet');
        if (!pool) {
            return null;
        }
        const bullet = pool.acquire({ position, velocity, tint: options.tint });
        if (!bullet) {
            return null;
        }
        bullet.poolId = 'bullet';
        this._registerEntity(bullet, true);
        return bullet;
    }

    spawnEffect(options = {}) {
        const pool = this._entityPools.get('effect');
        if (!pool) {
            return null;
        }
        const effect = pool.acquire(options);
        if (!effect) {
            return null;
        }
        effect.poolId = 'effect';
        this._registerEntity(effect, true);
        return effect;
    }

    _getEnemyPool(template) {
        const key = template && template.id ? 'enemy:' + template.id : 'enemy:default';
        if (!this._enemyPools.has(key)) {
            this._enemyPools.set(key, new EntityPool({
                create: () => this._buildEnemyEntity(template),
                activate: (entity, params = {}) => this._activateEnemyEntity(entity, template, params),
                deactivate: (entity) => this._deactivateEnemyEntity(entity)
            }));
        }
        return this._enemyPools.get(key);
    }

    spawnEnemyFromTemplate(template, context = {}) {
        if (!template) {
            return null;
        }
        const pool = this._getEnemyPool(template);
        const enemy = pool ? pool.acquire(context) : null;
        if (!enemy) {
            return null;
        }
        enemy.poolId = template && template.id ? 'enemy:' + template.id : 'enemy:default';
        this._registerEntity(enemy, true);
        return enemy;
    }

    _buildEnemyEntity(template = {}) {
        const enemy = new Entity();
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
        enemy.addComponent(new Motion({ x: 0, y: template.verticalSpeed || 2 }));
        enemy.addComponent(new Enemy());
        enemy.addComponent(new Collider(template.colliderRadius || 20));
        enemy.addComponent(new EnemyBehavior(Object.assign({}, template)));
        enemy.addComponent(new Health(template.health || 50));
        return enemy;
    }

    _activateEnemyEntity(entity, template = {}, params = {}) {
        const transform = entity.getComponent(Transform);
        const motion = entity.getComponent(Motion);
        const behavior = entity.getComponent(EnemyBehavior);
        const sprite = entity.getComponent(Sprite)?.sprite;
        const health = entity.getComponent(Health);

        const position = params.position || {};
        const altitude = params.altitude;
        const screen = this.app.renderer?.screen || this.app.screen;

        if (transform) {
            const positionRatio = params.positionRatio ?? null;
            if (positionRatio !== null && typeof positionRatio === 'number') {
                transform.position.x = screen.width * positionRatio;
            } else if (typeof position.x === 'number') {
                transform.position.x = position.x;
            }
            transform.position.y = typeof position.y === 'number' ? position.y : (typeof altitude === 'number' ? altitude : -50);
        }

        if (motion) {
            motion.velocity.x = 0;
            motion.velocity.y = template.verticalSpeed || 2;
        }

        if (behavior) {
            behavior.pattern = template.pattern || behavior.pattern || 'sine';
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

        if (sprite) {
            sprite.visible = true;
            if (sprite instanceof PIXI.AnimatedSprite && typeof sprite.play === 'function') {
                const animName = template.spritesheet?.animation || 'idle';
                if (typeof sprite.gotoAndPlay === 'function') {
                    sprite.gotoAndPlay(animName);
                } else {
                    sprite.play(animName);
                }
            }
        }

        if (health) {
            health.max = template.health || health.max || 50;
            health.health = health.max;
        }

        entity.isRemoved = false;
    }

    _deactivateEnemyEntity(entity) {
        const sprite = entity.getComponent(Sprite)?.sprite;
        if (sprite) {
            sprite.visible = false;
            if (sprite instanceof PIXI.AnimatedSprite && typeof sprite.stop === 'function') {
                sprite.stop();
            }
        }
        const motion = entity.getComponent(Motion);
        if (motion) {
            motion.velocity.x = 0;
            motion.velocity.y = 0;
        }
        const behavior = entity.getComponent(EnemyBehavior);
        if (behavior) {
            behavior.originX = null;
            behavior.elapsed = 0;
        }
    }

    releaseEntity(entity, index) {
        if (!entity) {
            return;
        }

        if (entity.hasComponent && entity.hasComponent(Sprite)) {
            const sprite = entity.getComponent(Sprite).sprite;
            if (sprite && sprite.parent) {
                sprite.parent.removeChild(sprite);
            }
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

    _attachSprite(entity) {
        if (!entity || !entity.hasComponent || !entity.hasComponent(Sprite)) {
            return;
        }
        const sprite = entity.getComponent(Sprite).sprite;
        if (sprite && !sprite.parent) {
            this.stage.addChild(sprite);
        }
    }

    _detachSprite(entity) {
        if (!entity || !entity.hasComponent || !entity.hasComponent(Sprite)) {
            return;
        }
        const sprite = entity.getComponent(Sprite).sprite;
        if (sprite && sprite.parent) {
            sprite.parent.removeChild(sprite);
        }
    }

    _registerEntity(entity, isPooled = false) {
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

window.GameplayRuntime = GameplayRuntime;
window.Game = GameplayRuntime;



