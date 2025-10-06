import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TrainingScene } from '../../src/js/scenes/training-scene';
import { ServiceLocator } from '../../src/js/engine/service-locator';
import { UiService } from '../../src/js/engine/ui-service';

describe('TrainingScene', () => {
    let services: ServiceLocator;
    let uiService: UiService;
    let scene: TrainingScene;

    beforeEach(() => {
        document.body.innerHTML = `
            <div id="trainingOverlay" style="display:none">
                <button id="trainingStartButton"></button>
                <button id="trainingBackButton"></button>
            </div>
        `;

        services = new ServiceLocator();
        uiService = {
            setOverlayVisible: vi.fn(),
            getElement: vi.fn((id) => document.getElementById(id)),
            setTextContent: vi.fn(),
            showMessage: vi.fn()
        } as unknown as UiService;

        services.register('uiService', uiService);
        scene = new TrainingScene(services);
    });

    it('shows and hides overlay via UiService on enter/exit', async () => {
        await scene.onEnter();
        expect(uiService.setOverlayVisible).toHaveBeenCalledWith('trainingOverlay', true);

        await scene.onExit();
        expect(uiService.setOverlayVisible).toHaveBeenCalledWith('trainingOverlay', false);
    });
});


