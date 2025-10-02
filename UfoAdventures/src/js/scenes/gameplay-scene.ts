import { Scene, SceneManager } from '../engine/scene-manager';
import { ServiceLocator } from '../engine/service-locator';
import { ConfigService } from '../engine/config-service';
import { InputService } from '../engine/input-service';
import * as PIXI from 'pixi.js';
import type { BehaviorSceneOptions, EnemySpawningConfig, BossConfig } from '../engine/combat-types';
import type { CombatDamageEvent, GameResultsRequest } from '../engine/event-payloads';
import type { RunSummary } from '../engine/mission-service';


import { GameplayRuntime, RuntimeStartOptions } from '../gameplay-runtime';
import { Player } from '../entities/player';
import { Boss, Enemy } from '../engine/components';
import { flashHealthBar, flashBossHealthBar, addDamageLogEntry } from '../ui';
import type { DamageLogEntry } from '../ui';

interface GameplayEnterParams {
    mode?: string;
    options?: RuntimeStartOptions;
    missionId?: string;
}

export class GameplayScene extends Scene {
    private runtime: GameplayRuntime | null = null;
    private mode = 'adventure';
    private _isTransitioning = false;
    private readonly _inputBindings: (() => void)[] = [];
    private _activeOptions: BehaviorSceneOptions | null = null;
    private _missionId: string | null = null;

    constructor(services: ServiceLocator) {
        super('gameplay', services);
    }

    async onEnter(params: GameplayEnterParams = {}): Promise<void> {
        const app = this.services.resolve<PIXI.Application>('pixiApp');
        if (!this.runtime) {
            this.runtime = new GameplayRuntime(app, this.services);
        }

        const configService = this.services.resolve<ConfigService>('configService');
        const defaultMode = configService.get('modes.default', 'adventure');
        this.mode = params.mode || defaultMode!;
        this._activeOptions = this._composeRuntimeOptions(configService, this.mode, params.options);
        this._missionId = params.missionId ?? null;
        this._isTransitioning = false;

        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) {
            loadingScreen.style.display = 'none';
        }

        this._registerInputCommands();
        this.subscribe('game:return-to-menu', () => this._queueReturnToMenu());
        this.subscribe('combat:damage', (payload: CombatDamageEvent) => this._handleCombatDamage(payload));
        this.subscribe('game:request-results', (payload: GameResultsRequest) => this._handleResultsRequest(payload));

        const runtimeOptions: RuntimeStartOptions = {
            ...(this._activeOptions || {}),
            ...(params.options?.backgroundAlias ? { backgroundAlias: params.options.backgroundAlias } : {})
        };

        this.runtime.start(this.mode, runtimeOptions);

        if (typeof window !== 'undefined') {
            window.gameplayRuntime = this.runtime;
        }

        const canvas = document.getElementById('gameCanvas');
        if (canvas) {
            try { canvas.setAttribute('tabindex', '0'); } catch (e) {}
            try { canvas.focus(); } catch (e) {}
        }
    }

    async onSuspend(): Promise<void> {
        this._releaseInputCommands();
        if (this.runtime) {
            this.runtime.setPaused(true);
        }
    }

    async onResume(): Promise<void> {
        if (this.runtime) {
            this.runtime.setPaused(false);
        }
        this._registerInputCommands();
    }

    fixedUpdate(deltaSeconds: number): void {
        if (!this.runtime) {
            return;
        }

        const normalized = deltaSeconds / (1 / 60);
        this.runtime.update(normalized);
    }

    async onExit(): Promise<void> {
        this._releaseInputCommands();
        if (this.runtime) {
            this.runtime.stop();
        }

        if (typeof window !== 'undefined' && window.gameplayRuntime === this.runtime) {
            delete window.gameplayRuntime;
        }

        this._isTransitioning = false;
        this._missionId = null;

        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) {
            loadingScreen.style.display = 'flex';
        }

        await super.onExit();
    }

    private _registerInputCommands(): void {
        this._releaseInputCommands();

        const inputService = this.services.optional<InputService>('inputService');
        if (!inputService) {
            console.warn('GameplayScene: input service not available');
            return;
        }

        this._inputBindings.push(
            inputService.registerCommand('pause', () => this._handlePause(), { trigger: 'down' })
        );
        this._inputBindings.push(
            inputService.registerCommand('openInventory', () => this._handleInventory(), { trigger: 'down' })
        );
    }

    private _releaseInputCommands(): void {
        while (this._inputBindings.length) {
            const off = this._inputBindings.pop();
            if (off) {
                try {
                    off();
                } catch (error) {
                    console.error('GameplayScene: failed to unregister input command', error);
                }
            }
        }
    }

    private _composeRuntimeOptions(
        configService: ConfigService,
        mode: string,
        overrides?: RuntimeStartOptions
    ): BehaviorSceneOptions {
        const { backgroundAlias: _bg, ...behaviorOverrides } = overrides ?? {};
        const baseOptions: BehaviorSceneOptions = behaviorOverrides
            ? this._clone(behaviorOverrides)
            : {};

        if (!baseOptions.enemies) {
            const enemyConfig = configService.get<EnemySpawningConfig>('enemies');
            if (enemyConfig) {
                baseOptions.enemies = this._clone(enemyConfig);
            }
        }

        if (!baseOptions.boss && (mode === 'boss' || mode === 'adventure')) {
            const bossConfig = configService.get<BossConfig>('boss');
            if (bossConfig) {
                baseOptions.boss = this._clone(bossConfig);
            }
        }

        return baseOptions;
    }

    private _clone<T>(value: T): T {
        if (value === null || value === undefined) {
            return value;
        }

        if (typeof structuredClone === 'function') {
            try {
                return structuredClone(value);
            } catch (error) {
                console.warn('GameplayScene: structuredClone failed, falling back to JSON clone', error);
            }
        }

        try {
            return JSON.parse(JSON.stringify(value)) as T;
        } catch (error) {
            console.warn('GameplayScene: failed to clone config value', error);
            return value;
        }
    }

    private _handlePause(): void {
        if (this._isTransitioning) {
            return;
        }

        const sceneManager = this.services.resolve<SceneManager>('sceneManager');
        if (sceneManager.getActiveName() !== this.name) {
            return;
        }

        sceneManager.push('pause-menu', { mode: this.mode, missionId: this._missionId }).catch((error) => {
            console.error('GameplayScene: failed to open pause menu', error);
        });
    }

    private _handleInventory(): void {
        if (this._isTransitioning) {
            return;
        }

        const sceneManager = this.services.resolve<SceneManager>('sceneManager');
        if (sceneManager.getActiveName() !== this.name) {
            return;
        }

        sceneManager.push('inventory', { mode: this.mode }).catch((error) => {
            console.error('GameplayScene: failed to open inventory', error);
        });
    }

    private _handleCombatDamage(payload?: CombatDamageEvent): void {
        if (!payload) {
            return;
        }

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
            const entry: DamageLogEntry = {
                target: label,
                amount,
                remainingHealth: remaining,
                source: damageSource ?? undefined,
                type: entryType as DamageLogEntry['type']
            };
            addDamageLogEntry(entry);
        }
    }

    private _handleResultsRequest(payload?: GameResultsRequest): void {
        const outcome = payload?.outcome || payload?.reason || 'complete';
        this._showResults(outcome, payload);
    }

    private _queueReturnToMenu(): void {
        if (this._isTransitioning) {
            return;
        }

        this._isTransitioning = true;
        if (this.runtime) {
            this.runtime.stop();
        }

        const sceneManager = this.services.resolve<SceneManager>('sceneManager');
        sceneManager.replace('main-menu').catch((error) => {
            console.error('Failed to return to main menu', error);
            this._isTransitioning = false;
        });
    }

    private _showResults(outcome: string, payload?: GameResultsRequest): void {
        if (this._isTransitioning) {
            return;
        }

        this._isTransitioning = true;
        if (this.runtime) {
            this.runtime.stop();
        }

        const sceneManager = this.services.resolve<SceneManager>('sceneManager');
        const summary = this._coerceRunSummary(payload?.details);
        const params = {
            outcome,
            mode: this.mode,
            missionId: this._missionId,
            reason: payload?.reason ?? null,
            summary: summary ?? undefined,
            details: payload?.details ?? null
        };

        sceneManager.replace('results', params).catch((error) => {
            console.error('GameplayScene: failed to show results scene', error);
            this._isTransitioning = false;
        });
    }

    private _coerceRunSummary(value: unknown): RunSummary | null {
        if (!value || typeof value !== 'object') {
            return null;
        }

        const candidate = value as Partial<RunSummary>;
        if (typeof candidate.missionId === 'string' && typeof candidate.score === 'number') {
            return candidate as RunSummary;
        }
        return null;
    }
}
