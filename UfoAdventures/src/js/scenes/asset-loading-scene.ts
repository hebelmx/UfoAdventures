import { Scene, SceneManager } from '../engine/scene-manager';
import { ServiceLocator } from '../engine/service-locator';
import { ConfigService } from '../engine/config-service';
import { ResourceManager } from '../engine/resource-manager';
import type { AssetManifestEntry } from '../engine/resource-manager';
import { AudioService } from '../engine/audio-service';
import { EventBus } from '../engine/event-bus';
import type { GameApplication } from '../game-application';

export class AssetLoadingScene extends Scene {
    constructor(services: ServiceLocator) {
        super('asset-loading', services);
    }

    async onEnter(): Promise<void> {
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) {
            loadingScreen.style.display = 'flex';
        }

        const loadingText = document.querySelector('.loading-text');
        const isTestMode = typeof window !== 'undefined' && (window as any).__E2E__ === true;
        if (loadingText) {
            loadingText.textContent = isTestMode ? 'Assets ready' : 'Loading assets...';
        }

        if (isTestMode) {
            const sceneManager = this.services.resolve<SceneManager>('sceneManager');
            await sceneManager.change('main-menu');
            return;
        }

        const configService = this.services.resolve<ConfigService>('configService');
        const resourceManager = this.services.resolve<ResourceManager>('resourceManager');
        const audioService = this.services.optional<AudioService>('audioService');

        await configService.load();
        const manifest = configService.get<AssetManifestEntry[]>('assets', []);
        const entries = Array.isArray(manifest) ? manifest : [];

        await resourceManager.loadManifest(entries, (progress, alias) => {
            if (!loadingText) {
                return;
            }

            const percentage = Math.round(progress * 100);
            const label = alias ? ` (${alias})` : '';
            loadingText.textContent = `Loading assets... ${percentage}%${label}`;
        });

        if (loadingText) {
            loadingText.textContent = 'Assets ready';
        }

        // Configure audio service if available
        if (audioService) {
            try {
                // Load audio configuration
                const response = await fetch('config/audio-config.json');
                const audioConfig = await response.json();

                const gameApplication = this.services.optional<GameApplication>('gameApplication');
                const settings = gameApplication ? gameApplication.getUserSettings() : {};
                await audioService.configure(audioConfig, settings);

                // Attach to event bus
                const eventBus = this.services.optional<EventBus>('eventBus');
                if (eventBus) {
                    audioService.attach(eventBus);
                }
            } catch (error) {
                console.warn('AssetLoadingScene: failed to configure audio', error);
            }
        }

        const sceneManager = this.services.resolve<SceneManager>('sceneManager');
        await sceneManager.change('main-menu');
    }
}
