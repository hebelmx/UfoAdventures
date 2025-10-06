import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InventoryScene } from '../../src/js/scenes/inventory-scene';
import { ServiceLocator } from '../../src/js/engine/service-locator';
import { SceneManager } from '../../src/js/engine/scene-manager';

const setOverlayVisibleSpy = vi.fn();
vi.mock('../../src/js/ui/overlay-helpers', () => ({
    setOverlayVisible: (...args: unknown[]) => setOverlayVisibleSpy(...args)
}));

describe('InventoryScene', () => {
    let services: ServiceLocator;
    let sceneManager: SceneManager;
    let scene: InventoryScene;

    beforeEach(() => {
        document.body.innerHTML = `
            <div id="inventoryOverlay" style="display:none">
                <ul id="inventoryList"></ul>
                <button id="inventoryCloseButton"></button>
            </div>
        `;

        setOverlayVisibleSpy.mockClear();

        services = new ServiceLocator();
        sceneManager = {
            pop: vi.fn(() => Promise.resolve())
        } as unknown as SceneManager;
        services.register('sceneManager', sceneManager);
        scene = new InventoryScene(services);
    });

    it('shows and hides overlay using overlay-helpers and pops on close', async () => {
        await scene.onEnter({ mode: 'adventure', inventory: [] });
        expect(setOverlayVisibleSpy).toHaveBeenCalledWith(expect.any(HTMLElement), true, '#inventoryCloseButton');

        // simulate user closing
        const close = document.getElementById('inventoryCloseButton') as HTMLButtonElement;
        close.click();
        // allow promise microtasks to flush
        await Promise.resolve();

        expect((sceneManager.pop as any)).toHaveBeenCalled();
        // exit hides overlay
        await scene.onExit();
        expect(setOverlayVisibleSpy).toHaveBeenCalledWith(expect.any(HTMLElement), false);
    });
});


