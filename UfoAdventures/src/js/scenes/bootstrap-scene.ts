import { Scene, SceneManager } from '../engine/scene-manager';
import { ServiceLocator } from '../engine/service-locator';

export class BootstrapScene extends Scene {
    constructor(services: ServiceLocator) {
        super('bootstrap', services);
    }

    async onEnter(): Promise<void> {
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) {
            loadingScreen.style.display = 'flex';
        }

        const loadingText = document.querySelector('.loading-text');
        if (loadingText) {
            loadingText.textContent = 'Preparing systems...';
        }

        const sceneManager = this.services.resolve<SceneManager>('sceneManager');
        window.requestAnimationFrame(() => {
            sceneManager.change('asset-loading').catch((error: any) => {
                console.error('Failed to advance from bootstrap scene', error);
            });
        });
    }
}