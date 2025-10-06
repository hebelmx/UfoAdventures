import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ResultsScene } from '../../src/js/scenes/results-scene';
import { ServiceLocator } from '../../src/js/engine/service-locator';
import { UiService } from '../../src/js/engine/ui-service';
import { MissionService } from '../../src/js/engine/mission-service';
import { SceneManager } from '../../src/js/engine/scene-manager';
import { ProgressionService } from '../../src/js/engine/progression-service';

describe('ResultsScene', () => {
    let services: ServiceLocator;
    let uiService: UiService;
    let missionService: MissionService;
    let progressionService: ProgressionService;
    let scene: ResultsScene;

    beforeEach(() => {
        document.body.innerHTML = `
            <div id="resultsOverlay" style="display:none">
                <h2 id="resultsTitle"></h2>
                <div id="resultsSummary"></div>
                <ul id="resultsObjectives"></ul>
                <div id="resultsStats"></div>
                <table id="resultsLeaderboard"><tbody></tbody></table>
                <form id="resultsSubmissionForm">
                    <input id="resultsCallsign" />
                    <button id="resultsSubmitButton" type="submit"></button>
                </form>
                <button id="resultsMenuButton"></button>
                <button id="resultsRetryButton"></button>
            </div>
        `;

        services = new ServiceLocator();
        uiService = {
            setOverlayVisible: vi.fn(),
            showMessage: vi.fn(),
            setTextContent: vi.fn(),
            getElement: vi.fn((id) => document.getElementById(id))
        } as unknown as UiService;

        missionService = {
            getDefault: vi.fn(() => ({ id: 'm1', name: 'Mission', mode: 'adventure', objectives: [], scoring: {}, rewards: {} })),
            getById: vi.fn(() => ({ id: 'm1', name: 'Mission', mode: 'adventure', objectives: [], scoring: {}, rewards: {} })),
            evaluateObjectives: vi.fn(() => []),
            calculateScore: vi.fn(() => 123)
        } as unknown as MissionService;

        progressionService = {
            ready: vi.fn(() => Promise.resolve()),
            getRuns: vi.fn(() => []),
            recordRun: vi.fn((run) => ({ ...run }))
        } as unknown as ProgressionService;

        services.register('uiService', uiService);
        services.register('missionService', missionService);
        services.register('progressionService', progressionService);
        services.register('sceneManager', {
            replace: vi.fn(() => Promise.resolve()),
            push: vi.fn(() => Promise.resolve())
        } as unknown as SceneManager);

        scene = new ResultsScene(services);
    });

    it('uses UiService to show and hide overlay on enter/exit', async () => {
        await scene.onEnter({ outcome: 'complete' });
        expect(uiService.setOverlayVisible).toHaveBeenCalledWith('resultsOverlay', true);

        await scene.onExit();
        expect(uiService.setOverlayVisible).toHaveBeenCalledWith('resultsOverlay', false);
    });

    it('saves run and shows confirmation message on submit', async () => {
        await scene.onEnter({ outcome: 'complete' });

        const form = document.getElementById('resultsSubmissionForm') as HTMLFormElement;
        const callsign = document.getElementById('resultsCallsign') as HTMLInputElement;
        callsign.value = 'Tester';

        // Simulate submit
        const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
        form.dispatchEvent(submitEvent);

        expect(progressionService.recordRun).toHaveBeenCalled();
        expect(uiService.showMessage).toHaveBeenCalled();
    });
});


