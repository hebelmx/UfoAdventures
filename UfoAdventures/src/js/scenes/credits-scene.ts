import { Scene, SceneManager } from '../engine/scene-manager';
import { setOverlayVisible } from '../ui/overlay-helpers';
import { ServiceLocator } from '../engine/service-locator';

export class CreditsScene extends Scene {
    private _overlay: HTMLElement | null = null;
    private _handler: (() => void) | null = null;

    constructor(services: ServiceLocator) {
        super('credits', services);
    }

    async onEnter(): Promise<void> {
        this._overlay = document.getElementById('creditsOverlay');
        setOverlayVisible(this._overlay, true, '#creditsCloseButton');
        const closeButton = document.getElementById('creditsCloseButton');
        if (closeButton) {
            this._handler = () => this._close();
            closeButton.addEventListener('click', this._handler);
        }
    }

    async onExit(): Promise<void> {
        if (this._handler) {
            const closeButton = document.getElementById('creditsCloseButton');
            try {
                closeButton?.removeEventListener('click', this._handler);
            } catch (error) {
                console.warn('CreditsScene: failed to remove handler', error);
            }
        }
        setOverlayVisible(this._overlay, false);
        this._overlay = null;
        this._handler = null;
        await super.onExit();
    }

    private _close(): void {
        const sceneManager = this.services.resolve<SceneManager>('sceneManager');
        sceneManager.pop();
    }
}