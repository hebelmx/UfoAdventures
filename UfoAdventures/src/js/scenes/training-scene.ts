import { Scene, SceneManager } from '../engine/scene-manager';
import { ServiceLocator } from '../engine/service-locator';

interface UIHandler {
    element: HTMLElement;
    handler: () => void;
}

export class TrainingScene extends Scene {
    private _overlay: HTMLElement | null = null;
    private _sceneTransitions: any | null = null;
    private readonly _handlers: UIHandler[] = [];
    private readonly _missionId = 'training-sandbox';

    constructor(services: ServiceLocator) {
        super('training', services);
    }

    async onEnter(): Promise<void> {
        this._overlay = document.getElementById('trainingOverlay');
        if (this._overlay) {
            this._overlay.style.display = 'flex';
        }
        this._sceneTransitions = this.services.optional<any>('sceneTransitions');
        this._bind();
    }

    async onExit(): Promise<void> {
        this._unbind();
        if (this._overlay) {
            this._overlay.style.display = 'none';
        }
        this._overlay = null;
        this._sceneTransitions = null;
        await super.onExit();
    }

    private _bind(): void {
        const startButton = document.getElementById('trainingStartButton');
        if (startButton) {
            const handler = () => this._startTraining();
            startButton.addEventListener('click', handler);
            this._handlers.push({ element: startButton, handler });
        }
        const backButton = document.getElementById('trainingBackButton');
        if (backButton) {
            const handler = () => this._close();
            backButton.addEventListener('click', handler);
            this._handlers.push({ element: backButton, handler });
        }
    }

    private _unbind(): void {
        while (this._handlers.length) {
            const { element, handler } = this._handlers.pop()!;
            try {
                element.removeEventListener('click', handler);
            }
            catch (error) {
                console.warn('TrainingScene: failed to remove handler', error);
            }
        }
    }

    private _startTraining(): void {
        if (this._sceneTransitions && typeof this._sceneTransitions.isActive === 'function' && this._sceneTransitions.isActive()) {
            return;
        }
        const sceneManager = this.services.resolve<SceneManager>('sceneManager');
        sceneManager.replace('gameplay', {
            missionId: this._missionId,
            mode: 'training',
            options: { training: true }
        }).catch(error => {
            console.error('TrainingScene: failed to start training mode', error);
        });
    }

    private _close(): void {
        if (this._sceneTransitions && typeof this._sceneTransitions.isActive === 'function' && this._sceneTransitions.isActive()) {
            return;
        }
        const sceneManager = this.services.resolve<SceneManager>('sceneManager');
        sceneManager.pop();
    }
}