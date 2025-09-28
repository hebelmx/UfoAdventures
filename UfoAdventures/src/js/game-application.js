class GameApplication {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        if (!this.canvas) {
            throw new Error('GameApplication: #gameCanvas element not found');
        }

        this.services = new ServiceLocator();
        this.eventBus = new EventBus();
        this.configService = new ConfigService('config/game-config.json');
        this.resourceManager = new ResourceManager();
        this.sceneManager = new SceneManager(this.services);
        this.inputService = new InputService(this.eventBus);

        this.services.register('eventBus', this.eventBus);
        this.services.register('configService', this.configService);
        this.services.register('resourceManager', this.resourceManager);
        this.services.register('sceneManager', this.sceneManager);
        this.services.register('inputService', this.inputService);
        this.services.register('gameApplication', this);

        this.app = null;
        this.fixedTimeStep = 1000 / 60;
        this.accumulator = 0;
        this._isBooted = false;
        this._tick = this._tick.bind(this);
    }

    async boot() {
        if (this._isBooted) {
            return;
        }

        await this.configService.load();
        const inputConfig = this.configService.get('input', {});
        this.inputService.configure(inputConfig);
        this._initialisePixi();
        this.services.register('pixiApp', this.app);

        this._registerScenes();
        this._isBooted = true;

        await this.sceneManager.change('bootstrap');
        this.app.ticker.add(this._tick);
    }

    _initialisePixi() {
        const screenConfig = this.configService.get('application.screen', {});
        const width = screenConfig.width || 800;
        const height = screenConfig.height || 600;
        const backgroundColor = this._parseColor(screenConfig.backgroundColor, 0x000000);

        this.app = new PIXI.Application({
            width,
            height,
            backgroundColor,
            view: this.canvas,
            antialias: true
        });

        this.app.stage.sortableChildren = true;
    }

    _registerScenes() {
        this.sceneManager.register('bootstrap', new BootstrapScene(this.services));
        this.sceneManager.register('asset-loading', new AssetLoadingScene(this.services));
        this.sceneManager.register('main-menu', new MainMenuScene(this.services));
        this.sceneManager.register('gameplay', new GameplayScene(this.services));
        this.sceneManager.register('pause-menu', new PauseScene(this.services));
        this.sceneManager.register('inventory', new InventoryScene(this.services));
        this.sceneManager.register('results', new ResultsScene(this.services));
    }

    _tick() {
        const elapsedMS = this.app.ticker.elapsedMS || this.fixedTimeStep;
        this.accumulator += elapsedMS;
        const stepSeconds = this.fixedTimeStep / 1000;

        while (this.accumulator >= this.fixedTimeStep) {
            this.sceneManager.fixedUpdate(stepSeconds);
            this.accumulator -= this.fixedTimeStep;
        }

        this.sceneManager.update(elapsedMS / 1000);
    }

    _parseColor(value, fallback) {
        if (typeof value === 'number' && Number.isFinite(value)) {
            return value;
        }

        if (typeof value === 'string') {
            const hex = value.trim().replace('#', '');
            const parsed = Number.parseInt(hex, 16);
            if (!Number.isNaN(parsed)) {
                return parsed;
            }
        }

        return fallback;
    }
}



