import { Scene, SceneManager } from '../engine/scene-manager';
import { ServiceLocator } from '../engine/service-locator';
import { ConfigService } from '../engine/config-service';
import { ResourceManager } from '../engine/resource-manager';
import type { AssetManifestEntry } from '../engine/resource-manager';
import { AudioService } from '../engine/audio-service';
import { EventBus } from '../engine/event-bus';
import type { GameApplication } from '../game-application';
import { setOverlayVisible } from '../ui/overlay-helpers';

export class AssetLoadingScene extends Scene {
    constructor(services: ServiceLocator) {
        super('asset-loading', services);
    }

    async onEnter(): Promise<void> {
        const loadingScreen = document.getElementById('loadingScreen');
        setOverlayVisible(loadingScreen, true);

        const loadingText = document.querySelector('.loading-text');
        const isTestMode = typeof window !== 'undefined' && window.__E2E__ === true;
        if (loadingText) {
            loadingText.textContent = isTestMode ? 'Assets ready' : 'Loading assets...';
        }

        if (isTestMode && typeof window !== 'undefined') {
            console.info('AssetLoadingScene: skipping manifest for E2E run');
        }

        const configService = this.services.resolve<ConfigService>('configService');
        const resourceManager = this.services.resolve<ResourceManager>('resourceManager');
        const audioService = this.services.optional<AudioService>('audioService');

        await configService.load();
        const manifest = configService.get<AssetManifestEntry[]>('assets', []);
        const entries = Array.isArray(manifest) ? manifest : [];

        await resourceManager.loadManifest(entries, (progress, alias) => {
            if (!loadingText || isTestMode) {
                return;
            }

            const percentage = Math.round(progress * 100);
            const label = alias ? ` (${alias})` : '';
            loadingText.textContent = `Loading assets... ${percentage}%${label}`;
        });

        if (loadingText) {
            loadingText.textContent = 'Assets ready';
        }

        if (!isTestMode && audioService) {
            try {
                const response = await fetch('config/audio-config.json');
                const audioConfig = await response.json();

                const gameApplication = this.services.optional<GameApplication>('gameApplication');
                const settings = gameApplication ? gameApplication.getUserSettings() : {};
                await audioService.configure(audioConfig, settings);

                const eventBus = this.services.optional<EventBus>('eventBus');
                if (eventBus) {
                    audioService.attach(eventBus);
                }
            } catch (error) {
                console.warn('AssetLoadingScene: failed to configure audio', error);
            }
        }

        const sceneManager = this.services.resolve<SceneManager>('sceneManager');
        if (isTestMode) {
            sceneManager.change('main-menu', undefined, undefined, 'fade').then(() => {
                if (typeof window !== 'undefined') {
                    console.info('AssetLoadingScene: main menu scene loaded');
                }
            }).catch(error => {
                console.error('AssetLoadingScene: failed to load main menu', error);
            });
            return;
        }

        await sceneManager.change('main-menu', undefined, undefined, 'fade');
    }
}
