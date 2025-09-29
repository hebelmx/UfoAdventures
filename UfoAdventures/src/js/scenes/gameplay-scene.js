class GameplayScene extends Scene {
    constructor(services) {
        super('gameplay', services);
        this.runtime = null;
        this.mode = 'adventure';
        this._isTransitioning = false;
        this._inputBindings = [];
        this._activeOptions = null;
    }

    async onEnter(params = {}) {
        const app = this.services.resolve('pixiApp');
        if (!this.runtime) {
            this.runtime = new GameplayRuntime(app, this.services);
        }

        const configService = this.services.resolve('configService');
        const defaultMode = configService.get('modes.default', 'adventure');
        this.mode = params.mode || defaultMode;
        this._activeOptions = this._composeRuntimeOptions(configService, this.mode, params.options);
        this._isTransitioning = false;

        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) {
            loadingScreen.style.display = 'none';
        }

        this._registerInputCommands();
        this.subscribe('game:return-to-menu', () => this._queueReturnToMenu());
        this.subscribe('combat:damage', (payload) => this._handleCombatDamage(payload));
        this.subscribe('game:request-results', (payload) => this._handleResultsRequest(payload));

        this.runtime.start(this.mode, this._activeOptions || {});

        // Ensure canvas is focusable and focused so Space/keys go to gameplay, not UI buttons
        const canvas = document.getElementById('gameCanvas');
        if (canvas) {
            try { canvas.setAttribute('tabindex', '0'); } catch (e) {}
            try { canvas.focus(); } catch (e) {}
        }
    }

    async onSuspend() {
        this._releaseInputCommands();
        if (this.runtime) {
            this.runtime.setPaused(true);
        }
    }

    async onResume() {
        if (this.runtime) {
            this.runtime.setPaused(false);
        }
        this._registerInputCommands();
    }

    fixedUpdate(deltaSeconds) {
        if (!this.runtime) {
            return;
        }

        const normalized = deltaSeconds / (1 / 60);
        this.runtime.update(normalized);
    }

    async onExit() {
        this._releaseInputCommands();
        if (this.runtime) {
            this.runtime.stop();
        }

        this._isTransitioning = false;

        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) {
            loadingScreen.style.display = 'flex';
        }

        await super.onExit();
    }

    _registerInputCommands() {
        this._releaseInputCommands();

        let inputService = null;
        try {
            inputService = this.services.resolve('inputService');
        } catch (error) {
            console.warn('GameplayScene: input service not available', error);
            return;
        }

        if (!inputService || typeof inputService.registerCommand !== 'function') {
            return;
        }

        this._inputBindings.push(
            inputService.registerCommand('pause', () => this._handlePause(), { trigger: 'down' })
        );
        this._inputBindings.push(
            inputService.registerCommand('openInventory', () => this._handleInventory(), { trigger: 'down' })
        );
    }

    _releaseInputCommands() {
        while (this._inputBindings.length) {
            const off = this._inputBindings.pop();
            try {
                if (typeof off === 'function') {
                    off();
                }
            } catch (error) {
                console.error('GameplayScene: failed to unregister input command', error);
            }
        }
    }

    _composeRuntimeOptions(configService, mode, overrides = {}) {
        const baseOptions = (overrides && typeof overrides === 'object') ? this._deepClone(overrides) : {};
        if (!baseOptions.enemies) {
            const enemyConfig = configService.get('enemies');
            if (enemyConfig) {
                baseOptions.enemies = {
                    templates: this._deepClone(enemyConfig.templates) || [],
                    waves: this._deepClone(enemyConfig.waves) || []
                };
            }
        }

        if (!baseOptions.boss && (mode === 'boss' || mode === 'adventure')) {
            const bossConfig = configService.get('boss');
            if (bossConfig) {
                baseOptions.boss = this._deepClone(bossConfig);
            }
        }

        return baseOptions;
    }

    _deepClone(value) {
        if (value === null || value === undefined) {
            return value;
        }

        try {
            return JSON.parse(JSON.stringify(value));
        } catch (error) {
            console.warn('GameplayScene: failed to clone config value', error);
            return value;
        }
    }


    _handlePause() {
        if (this._isTransitioning) {
            return;
        }

        const sceneManager = this.services.resolve('sceneManager');
        if (sceneManager.getActiveName() !== this.name) {
            return;
        }

        sceneManager.push('pause-menu', { mode: this.mode }).catch((error) => {
            console.error('GameplayScene: failed to open pause menu', error);
        });
    }

    _handleInventory() {
        if (this._isTransitioning) {
            return;
        }

        const sceneManager = this.services.resolve('sceneManager');
        if (sceneManager.getActiveName() !== this.name) {
            return;
        }

        sceneManager.push('inventory', { mode: this.mode }).catch((error) => {
            console.error('GameplayScene: failed to open inventory', error);
        });
    }

    _handleCombatDamage(payload = {}) {
        const targetEntity = payload.target;
        const amount = Math.max(0, Math.round(payload.amount || 0));
        const remaining = payload.remainingHealth;
        const damageSource = payload.damageSource || null;
        let entryType = 'enemy';
        let label = 'Target';

        if (targetEntity && typeof targetEntity.hasComponent === 'function') {
            if (targetEntity.hasComponent(Player)) {
                entryType = 'player';
                label = 'Player';
                if (typeof flashHealthBar === 'function') {
                    flashHealthBar();
                }
            } else if (targetEntity.hasComponent(Boss)) {
                entryType = 'boss';
                label = 'Boss';
                if (typeof flashBossHealthBar === 'function') {
                    flashBossHealthBar();
                }
            } else if (targetEntity.hasComponent(Enemy)) {
                entryType = 'enemy';
                label = 'Enemy';
            }
        }

        if (typeof addDamageLogEntry === 'function') {
            addDamageLogEntry({
                target: label,
                amount,
                remainingHealth: remaining,
                source: damageSource,
                type: entryType
            });
        }
    }

    _handleResultsRequest(payload = {}) {
        const outcome = payload.outcome || payload.reason || 'complete';
        this._showResults(outcome, payload);
    }

    _queueReturnToMenu() {
        if (this._isTransitioning) {
            return;
        }

        this._isTransitioning = true;
        if (this.runtime) {
            this.runtime.stop();
        }

        const sceneManager = this.services.resolve('sceneManager');
        sceneManager.replace('main-menu').catch((error) => {
            console.error('Failed to return to main menu', error);
            this._isTransitioning = false;
        });
    }

    _showResults(outcome, payload = {}) {
        if (this._isTransitioning) {
            return;
        }

        this._isTransitioning = true;
        if (this.runtime) {
            this.runtime.stop();
        }

        const sceneManager = this.services.resolve('sceneManager');
        const params = {
            outcome,
            mode: this.mode,
            details: payload.details || null,
            reason: payload.reason || null,
        };

        sceneManager.replace('results', params).catch((error) => {
            console.error('GameplayScene: failed to show results scene', error);
            this._isTransitioning = false;
        });
    }
}




