import * as PIXI from 'pixi.js';
import { ServiceLocator } from './engine/service-locator';
import { EventBus } from './engine/event-bus';
import { ConfigService } from './engine/config-service';
import { ResourceManager } from './engine/resource-manager';
import { SceneManager, IScene } from './engine/scene-manager';
import { InputService } from './engine/input-service';
import { SaveService } from './engine/save-service';
import { AudioService, AudioSettings } from './engine/audio-service';
import { MissionService } from './engine/mission-service';
import { BehaviorTreeService } from './engine/behavior-tree-service';
import { WeaponService } from './engine/weapon-service';
import { ProgressionService } from './engine/progression-service';
import { UiService } from './engine/ui-service';
import { PlayerBlasterStrategy } from './engine/weapons/player-blaster';
import { BurstRifleStrategy } from './engine/weapons/burst-rifle';
import { LaserCannonStrategy } from './engine/weapons/laser-cannon';
import { SceneTransitions } from './ui/scene-transitions';
import { BootstrapScene } from './scenes/bootstrap-scene';
import { AssetLoadingScene } from './scenes/asset-loading-scene';
import { MainMenuScene } from './scenes/main-menu-scene';
import { GameplayScene } from './scenes/gameplay-scene';
import { PauseScene } from './scenes/pause-scene';
import { InventoryScene } from './scenes/inventory-scene';
import { ResultsScene } from './scenes/results-scene';
import { OptionsScene } from './scenes/options-scene';
import { CreditsScene } from './scenes/credits-scene';
import { LeaderboardScene } from './scenes/leaderboard-scene';
import { PortalEscapeScene } from './scenes/portal-escape-scene';
import { ArcadeScene } from './scenes/arcade-scene';
import { TrainingScene } from './scenes/training-scene';
import type { GameConfiguration, ApplicationScreenConfig } from './engine/game-configuration';
import type { GameplayRuntime } from './gameplay-runtime';

export class GameApplication {
    private static readonly MAX_FRAME_SKIP = 5;
    private static readonly MAX_DELTA_SECONDS = 0.25;

    private readonly canvas: HTMLCanvasElement;
    private readonly services: ServiceLocator = new ServiceLocator();
    private userSettings: AudioSettings & { difficulty: string };
    private pixiApp: PIXI.Application | null = null;
    private _sceneManager: SceneManager | null = null;
    private _sceneTransitions: SceneTransitions | null = null;
    private _tickInterpolation = 0;
    private _ticker: PIXI.Ticker | null = null;
    private readonly _tickHandler: () => void;
    private _fixedDelta = 1 / 60;
    private _accumulator = 0;
    private readonly _lifecycleDisposers: Array<() => void> = [];

    constructor() {
        this.canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
        if (!this.canvas) {
            throw new Error('GameApplication: canvas element not found');
        }
        this.userSettings = {
            masterVolume: 1.0,
            musicVolume: 0.8,
            sfxVolume: 1.0,
            difficulty: 'normal',
            music: 'on',
            sfx: 'on'
        };
        this._tickHandler = this._onTick.bind(this);
    }

    async boot(): Promise<void> {
        try {
            await this._initializeServices();
            await this._registerScenes();
            const sceneManager = this.services.resolve<SceneManager>('sceneManager');
            await sceneManager.change('bootstrap');
        } catch (error) {
            console.error('GameApplication: failed to boot', error);
            throw error;
        }
    }

    public getSceneManager(): SceneManager | null {
        return this._sceneManager;
    }

    public getService<T>(key: string): T | null {
        return this.services.optional<T>(key);
    }

    private async _initializeServices(): Promise<void> {
        this.services.replace('gameApplication', this);

        const eventBus = new EventBus();
        this.services.register('eventBus', eventBus);

        const configService = new ConfigService('config/game-config.json');
        this.services.register('configService', configService);

        const resourceManager = new ResourceManager();
        this.services.register('resourceManager', resourceManager);

        const sceneManager = new SceneManager(this.services);
        this.services.register('sceneManager', sceneManager);
        this._sceneManager = sceneManager;

        const inputService = new InputService(eventBus);
        this.services.register('inputService', inputService);

        const saveService = new SaveService({
            dbName: 'UFOAdventures',
            storeName: 'saves',
            version: 1
        });
        this.services.register('saveService', saveService);
        await saveService.ready();

        const audioService = new AudioService({ resourceManager });
        this.services.register('audioService', audioService);

        const missionService = new MissionService();
        this.services.register('missionService', missionService);

        const behaviorTreeService = new BehaviorTreeService();
        this.services.register('behaviorTreeService', behaviorTreeService);

        const weaponService = new WeaponService();
        this.services.register('weaponService', weaponService);
        weaponService.registerWeaponType('player-blaster', PlayerBlasterStrategy);
        weaponService.registerWeaponType('burst-rifle', BurstRifleStrategy);
        weaponService.registerWeaponType('laser-cannon', LaserCannonStrategy);

        const uiService = new UiService();
        this.services.register('uiService', uiService);

        // Load configuration and apply to runtime services
        const config = await configService.load<GameConfiguration>();
        await this._initializePixiApp(config?.application?.screen || {});
        if (!this.pixiApp) {
            throw new Error('GameApplication: PIXI application failed to initialize');
        }
        this.services.register('pixiApp', this.pixiApp);

        this._applyConfiguration({
            config,
            missionService,
            behaviorTreeService,
            weaponService,
            inputService
        });

        // Instantiate progression service after configuration is available
        const progressionOptions = { ...(config?.progression || {}), saveService };
        const progressionService = new ProgressionService(progressionOptions);
        this.services.register('progressionService', progressionService);
        await progressionService.ready();

        // Load and apply persisted user settings
        await this._loadUserSettings();
        this._applyUserSettings();

        

        // Attach optional scene transition helper
        if (typeof SceneTransitions === 'function') {
            this._sceneTransitions = new SceneTransitions();
            this._sceneTransitions.attach(sceneManager);
            this.services.register('sceneTransitions', this._sceneTransitions);
        }

        inputService.enable();
        this._startTicker();
    }

    private async _registerScenes(): Promise<void> {
        const sceneManager = this.services.resolve<SceneManager>('sceneManager');
        
        // Register all scenes
        this._registerScene(sceneManager, new BootstrapScene(this.services));
        this._registerScene(sceneManager, new AssetLoadingScene(this.services));
        this._registerScene(sceneManager, new MainMenuScene(this.services));
        this._registerScene(sceneManager, new GameplayScene(this.services));
        this._registerScene(sceneManager, new PauseScene(this.services));
        this._registerScene(sceneManager, new InventoryScene(this.services));
        this._registerScene(sceneManager, new ResultsScene(this.services));
        this._registerScene(sceneManager, new OptionsScene(this.services));
        this._registerScene(sceneManager, new CreditsScene(this.services));
        this._registerScene(sceneManager, new LeaderboardScene(this.services));
        this._registerScene(sceneManager, new PortalEscapeScene(this.services));
        this._registerScene(sceneManager, new ArcadeScene(this.services));
        this._registerScene(sceneManager, new TrainingScene(this.services));
    }

    private async _loadUserSettings(): Promise<void> {
        try {
            const saveService = this.services.resolve<SaveService>('saveService');
            const savedSettings = await saveService.load<any>('userSettings');
            if (savedSettings) {
                this.userSettings = { ...this.userSettings, ...savedSettings };
            }
        } catch (error) {
            console.warn('GameApplication: failed to load user settings', error);
        }
    }

    async saveUserSettings(): Promise<void> {
        try {
            const saveService = this.services.resolve<SaveService>('saveService');
            await saveService.save('userSettings', this.userSettings);
        } catch (error) {
            console.error('GameApplication: failed to save user settings', error);
        }
    }

    setUserSettings(settings: Partial<AudioSettings & { difficulty: string }> = {}): void {
        if (!settings || typeof settings !== 'object') {
            return;
        }
        this.userSettings = { ...this.userSettings, ...settings };
        this._applyUserSettings();
        this.saveUserSettings();
    }

    private _applyUserSettings(): void {
        const audioService = this.services.optional<AudioService>('audioService');
        if (audioService) {
            audioService.applySettings(this.userSettings);
        }

        const eventBus = this.services.optional<EventBus>('eventBus');
        if (eventBus) {
            eventBus.emit('settings:changed', this.userSettings);
        }
    }

    getUserSettings(): AudioSettings & { difficulty: string } {
        return { ...this.userSettings };
    }

    async shutdown(): Promise<void> {
        try {
            await this.saveUserSettings();

            if (this.pixiApp && this._ticker) {
                this.pixiApp.ticker.remove(this._tickHandler, this);
            }

            this._unbindLifecycleHandlers();
            this._resetAccumulator();

            const sceneManager = this.services.optional<SceneManager>('sceneManager');
            if (sceneManager) {
                await sceneManager.clear();
            }

            const inputService = this.services.optional<InputService>('inputService');
            if (inputService) {
                inputService.disable();
            }

            const audioService = this.services.optional<AudioService>('audioService');
            if (audioService && typeof (audioService as any).shutdown === 'function') {
                await (audioService as any).shutdown();
            }

            if (this._sceneTransitions && typeof this._sceneTransitions.detach === 'function') {
                try { this._sceneTransitions.detach(); } catch (error) { console.warn('GameApplication: failed to detach scene transitions', error); }
            }

            if (this.pixiApp) {
                try {
                    this.pixiApp.destroy(false);
                } catch (error) {
                    console.warn('GameApplication: failed to destroy PIXI app', error);
                }
                this.pixiApp = null;
            }

            this._ticker = null;
            this._sceneManager = null;
            this._sceneTransitions = null;

            this.services.reset();
        } catch (error) {
            console.error('GameApplication: error during shutdown', error);
        }
    }

    private _registerScene(sceneManager: SceneManager, scene: IScene): void {
        if (!sceneManager || !scene) {
            return;
        }
        const name = scene.name;
        if (!name) {
            throw new Error('Scene registration requires a scene with a name.');
        }
        sceneManager.register(name, scene);
    }

    private _applyConfiguration({ config = {}, missionService, behaviorTreeService, weaponService, inputService }: { config: GameConfiguration, missionService: MissionService, behaviorTreeService: BehaviorTreeService, weaponService: WeaponService, inputService: InputService }): void {
        if (missionService && config.missions) {
            missionService.configure(config.missions);
        }
        if (behaviorTreeService && config.behaviorTrees) {
            behaviorTreeService.configure(config.behaviorTrees);
        }
        if (weaponService && config.weapons) {
            weaponService.configure(config.weapons);
        }
        if (inputService && config.input) {
            inputService.configure(config.input);
        }
    }

    private async _initializePixiApp(screen: ApplicationScreenConfig = {}): Promise<void> {
        if (this.pixiApp) {
            return;
        }

        const width = Number.isFinite(screen.width) ? screen.width : 800;
        const height = Number.isFinite(screen.height) ? screen.height : 600;
        const backgroundColor = this._normalizeColor(screen.backgroundColor);

        try {
            const app = new PIXI.Application();
            await app.init({
                canvas: this.canvas,
                width,
                height,
                backgroundColor,
                antialias: true
            });
            app.stage.sortableChildren = true;
            this.pixiApp = app;
        } catch (error) {
            console.error('GameApplication: failed to initialize PIXI application', error);
            throw error;
        }
    }

    private _startTicker(): void {
        if (!this.pixiApp || !this._sceneManager) {
            return;
        }
        this._fixedDelta = 1 / 60;
        this._resetAccumulator();
        this._ticker = this.pixiApp.ticker ?? null;
        if (!this._ticker) {
            console.warn('GameApplication: PIXI ticker unavailable; runtime updates disabled');
            return;
        }
        this._ticker.add(this._tickHandler, this);
        this._bindLifecycleHandlers();
    }

    private _onTick(): void {
        if (!this._sceneManager || !this.pixiApp) {
            return;
        }

        const ticker = this.pixiApp.ticker;
        const deltaSeconds = ticker ? Math.min(ticker.deltaMS / 1000, GameApplication.MAX_DELTA_SECONDS) : this._fixedDelta;

        this._accumulator += deltaSeconds;

        const gameplayRuntime = this.services.optional<GameplayRuntime>('gameplayRuntime');

        let stepsExecuted = 0;
        while (this._accumulator >= this._fixedDelta && stepsExecuted < GameApplication.MAX_FRAME_SKIP) {
            this._sceneManager.fixedUpdate(this._fixedDelta);
            this._accumulator -= this._fixedDelta;
            stepsExecuted += 1;
        }

        if (this._accumulator >= this._fixedDelta) {
            this._accumulator = this._accumulator % this._fixedDelta;
        }

        this._tickInterpolation = this._accumulator / this._fixedDelta;

        if (gameplayRuntime) {
            gameplayRuntime.setFrameSkipCount(stepsExecuted);
        }

        this._sceneManager.update(deltaSeconds);
        this._sceneManager.render(this._tickInterpolation);

        if (gameplayRuntime) {
            gameplayRuntime.finalizeFrame(deltaSeconds * 1000, this._tickInterpolation);
        }
    }

    private _resetAccumulator(): void {
        this._accumulator = 0;
        this._tickInterpolation = 0;
    }

    private _bindLifecycleHandlers(): void {
        this._unbindLifecycleHandlers();

        if (typeof window === 'undefined' || typeof document === 'undefined') {
            return;
        }

        const reset = () => this._resetAccumulator();

        const visibilityHandler = () => reset();
        document.addEventListener('visibilitychange', visibilityHandler);
        this._lifecycleDisposers.push(() => document.removeEventListener('visibilitychange', visibilityHandler));

        const blurHandler = () => reset();
        window.addEventListener('blur', blurHandler);
        this._lifecycleDisposers.push(() => window.removeEventListener('blur', blurHandler));

        const focusHandler = () => reset();
        window.addEventListener('focus', focusHandler);
        this._lifecycleDisposers.push(() => window.removeEventListener('focus', focusHandler));
    }

    private _unbindLifecycleHandlers(): void {
        while (this._lifecycleDisposers.length) {
            const dispose = this._lifecycleDisposers.pop();
            try {
                dispose?.();
            } catch (error) {
                console.warn('GameApplication: failed to unbind lifecycle handler', error);
            }
        }
    }

    public pauseTicker(): void {
        if (!this._ticker) {
            return;
        }
        this._ticker.stop();
        this._resetAccumulator();
    }

    public resumeTicker(): void {
        if (!this._ticker) {
            return;
        }
        this._resetAccumulator();
        this._ticker.start();
    }

    private _normalizeColor(value?: number | string): number {
        if (typeof value === 'number' && Number.isFinite(value)) {
            return value;
        }
        if (typeof value === 'string') {
            const trimmed = value.trim();
            if (/^#?[0-9a-fA-F]{6}$/.test(trimmed)) {
                const hex = trimmed.startsWith('#') ? trimmed.slice(1) : trimmed;
                return parseInt(hex, 16);
            }
        }
        return 0x0f192a;
    }
}

