import { Scene, SceneManager } from '../engine/scene-manager';
import { ServiceLocator } from '../engine/service-locator';
import type { GameResultsRequest } from '../engine/event-payloads';

interface UIHandler {
    element: HTMLElement;
    handler: () => void;
}

export class PauseScene extends Scene {
    private _overlay: HTMLElement | null = null;
    private _mode = 'adventure';
    private _missionId: string | null = null;
    private readonly _handlers: UIHandler[] = [];

    constructor(services: ServiceLocator) {
        super('pause-menu', services);
    }

    async onEnter(params: { mode?: string; missionId?: string | null } = {}): Promise<void> {
        this._mode = params.mode || 'adventure';
        this._missionId = params.missionId ?? null;
        this._overlay = document.getElementById('pauseOverlay');
        if (this._overlay) {
            this._overlay.style.display = 'flex';
        }

        this._bindButtons();
    }

    async onSuspend(): Promise<void> {
        if (this._overlay) {
            this._overlay.style.display = 'none';
        }
    }

    async onResume(): Promise<void> {
        if (this._overlay) {
            this._overlay.style.display = 'flex';
        }
    }

    async onExit(): Promise<void> {
        this._unbindButtons();
        if (this._overlay) {
            this._overlay.style.display = 'none';
            this._overlay = null;
        }
        this._missionId = null;

        await super.onExit();
    }

    private _bindButtons(): void {
        const sceneManager = this.services.resolve<SceneManager>('sceneManager');
        const eventBus = this.eventBus;

        this._hookButton('pauseResumeButton', async (button) => {
            button.disabled = true;
            try {
                await sceneManager.pop();
            } catch (error) {
                console.error('PauseScene: failed to resume gameplay', error);
                button.disabled = false;
            }
        });

        this._hookButton('pauseInventoryButton', async (button) => {
            button.disabled = true;
            try {
                await sceneManager.push('inventory', { mode: this._mode });
            } catch (error) {
                console.error('PauseScene: failed to open inventory', error);
            } finally {
                button.disabled = false;
            }
        });

        this._hookButton('pauseEndButton', async (button) => {
            button.disabled = true;
            try {
                await sceneManager.pop(undefined, { resume: false });
                if (eventBus) {
                    const payload: GameResultsRequest = {
                        outcome: 'mission-complete',
                        reason: 'mission-complete',
                        mode: this._mode,
                        missionId: this._missionId
                    };
                    eventBus.emit<GameResultsRequest>('game:request-results', payload);
                }
            } catch (error) {
                console.error('PauseScene: failed to end mission', error);
                button.disabled = false;
            }
        });

        this._hookButton('pauseQuitButton', async (button) => {
            button.disabled = true;
            try {
                await sceneManager.pop(undefined, { resume: false });
                if (eventBus) {
                    eventBus.emit('game:return-to-menu');
                }
            } catch (error) {
                console.error('PauseScene: failed to quit to menu', error);
                button.disabled = false;
            }
        });
    }

    private _hookButton(id: string, handler: (button: HTMLButtonElement) => void): void {
        const element = document.getElementById(id) as HTMLButtonElement | null;
        if (!element) {
            console.warn('PauseScene: button not found', id);
            return;
        }

        const wrapped = () => handler(element);
        element.addEventListener('click', wrapped);
        element.disabled = false;
        this._handlers.push({ element, handler: wrapped });
    }

    private _unbindButtons(): void {
        while (this._handlers.length) {
            const { element, handler } = this._handlers.pop()!;
            element.removeEventListener('click', handler);
        }
    }
}
