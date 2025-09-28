class GameplayRuntime {
    constructor(app, services) {
        this.app = app;
        this.services = services;
        this.stage = new PIXI.Container();
        this.stage.sortableChildren = true;

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
        this._applyBackground(options.backgroundAlias || 'background');
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
        const index = this.entities.indexOf(entity);
        if (index > -1) {
            this.entities.splice(index, 1);
        }

        if (entity.hasComponent(Sprite)) {
            const sprite = entity.getComponent(Sprite).sprite;
            if (sprite.parent === this.stage) {
                this.stage.removeChild(sprite);
            }
        }

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
        this.entities = [];
        this.systems = [];
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
        this.systems.push(new ShootingSystem(this, eventBus));
        this.systems.push(new CollisionSystem(this, eventBus));
        this.systems.push(new UISystem(this));
        this.systems.push(new BoundaryCleanupSystem(this));
        this.systems.push(new RenderSystem(this.app));
        this.systems.push(new CleanupSystem(this));
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
        boss.addComponent(new Sprite(PIXI.Assets.get('amidogus')));
        const bossSprite = boss.getComponent(Sprite).sprite;
        bossSprite.width = 100;
        bossSprite.height = 100;
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
        player.addComponent(new Sprite(PIXI.Assets.get('player')));
        const sprite = player.getComponent(Sprite).sprite;
        sprite.width = 50;
        sprite.height = 50;
        player.addComponent(new Motion());
        player.addComponent(new Weapon());
        player.addComponent(new Collider(20));
        player.addComponent(new Health(100));\r\n        player.addComponent(new PlayerAbilities());
        player.addComponent(new Player());
        return player;
    }

    _registerEntity(entity) {
        this.entities.push(entity);
        if (entity.hasComponent(Sprite)) {
            const sprite = entity.getComponent(Sprite).sprite;
            if (!sprite.parent) {
                this.stage.addChild(sprite);
            }
        }
    }
}

window.GameplayRuntime = GameplayRuntime;
window.Game = GameplayRuntime;




