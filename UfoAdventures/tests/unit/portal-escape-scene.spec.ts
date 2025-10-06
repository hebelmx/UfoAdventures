import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ServiceLocator } from '../../src/js/engine/service-locator';
import { EventBus } from '../../src/js/engine/event-bus';
import { UiService } from '../../src/js/engine/ui-service';
import { PortalEscapeScene } from '../../src/js/scenes/portal-escape-scene';

describe('PortalEscapeScene', () => {
    let services: ServiceLocator;
    let bus: EventBus;
    let scene: PortalEscapeScene;

    beforeEach(() => {
        services = new ServiceLocator();
        bus = new EventBus();
        services.register('eventBus', bus);
        const ui: Partial<UiService> = { setTextContent: vi.fn(), showMessage: vi.fn() };
        services.register('uiService', ui as UiService);
        scene = new PortalEscapeScene(services);
    });

    it('opens portal after collecting required keys', async () => {
        const portalOpen = vi.fn();
        bus.on('portal:open', portalOpen);
        await scene.onEnter();

        bus.emit('collectible:key');
        bus.emit('collectible:key');
        bus.emit('collectible:key');

        expect(portalOpen).toHaveBeenCalled();
        await scene.onExit();
    });
});


