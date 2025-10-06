import { Scene, SceneManager } from '../engine/scene-manager';
import { UiService } from '../engine/ui-service';
import { ServiceLocator } from '../engine/service-locator';
import { SceneTransitions } from '../ui/scene-transitions';

interface UIHandler {
    element: HTMLElement;
    handler: () => void;
}

export class TrainingScene extends Scene {
    private _overlay: HTMLElement | null = null;
    private _sceneTransitions: SceneTransitions | null = null;
    private readonly _handlers: UIHandler[] = [];
    private readonly _missionId = 'training-sandbox';
    private readonly _uiService: UiService | null;

    constructor(services: ServiceLocator) {
        super('training', services);
        this._uiService = services.optional<UiService>('uiService');
    }

    async onEnter(): Promise<void> {
        this._overlay = document.getElementById('trainingOverlay');
        this._uiService?.setOverlayVisible('trainingOverlay', true);
        this._sceneTransitions = this.services.optional<SceneTransitions>('sceneTransitions');
        this._bind();
    }

    async onExit(): Promise<void> {
        this._unbind();
        this._uiService?.setOverlayVisible('trainingOverlay', false);
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
        }, undefined, 'fade').catch(error => {
            console.error('TrainingScene: failed to start training mode', error);
        });
    }

    private _close(): void {
        if (this._sceneTransitions && typeof this._sceneTransitions.isActive === 'function' && this._sceneTransitions.isActive()) {
            return;
        }
        const sceneManager = this.services.resolve<SceneManager>('sceneManager');
        sceneManager.pop(undefined, undefined, 'fade');
    }
}