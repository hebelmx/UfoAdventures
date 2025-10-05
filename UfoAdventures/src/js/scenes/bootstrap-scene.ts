import { Scene, SceneManager } from '../engine/scene-manager';
import { ServiceLocator } from '../engine/service-locator';
import { setOverlayVisible } from '../ui/overlay-helpers';

export class BootstrapScene extends Scene {
    constructor(services: ServiceLocator) {
        super('bootstrap', services);
    }

    async onEnter(): Promise<void> {
        const loadingScreen = document.getElementById('loadingScreen');
        setOverlayVisible(loadingScreen, true);

        const loadingText = document.querySelector('.loading-text');
        if (loadingText) {
            loadingText.textContent = 'Preparing systems...';
        }

        const sceneManager = this.services.resolve<SceneManager>('sceneManager');
        window.requestAnimationFrame(() => {
            sceneManager.change('asset-loading', undefined, undefined, 'instant').catch((error: unknown) => {
                console.error('Failed to advance from bootstrap scene', error);
            });
        });
    }
}
