import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MainMenuScene } from '../../src/js/scenes/main-menu-scene';
import { ServiceLocator } from '../../src/js/engine/service-locator';
import { UiService } from '../../src/js/engine/ui-service';
import { MissionService } from '../../src/js/engine/mission-service';
import { ProgressionService } from '../../src/js/engine/progression-service';
import { AudioService } from '../../src/js/engine/audio-service';
import { SceneManager } from '../../src/js/engine/scene-manager';

describe('MainMenuScene', () => {
    let services: ServiceLocator;
    let uiService: UiService;
    let missionService: MissionService;
    let progressionService: ProgressionService;
    let audioService: AudioService;
    let sceneManager: SceneManager;
    let scene: MainMenuScene;

    beforeEach(() => {
        services = new ServiceLocator();

        uiService = {
            setOverlayVisible: vi.fn(),
            getElement: vi.fn((id) => {
                const element = document.createElement('div');
                element.id = id;
                if (id.includes('Button')) {
                    return document.createElement('button');
                }
                return element;
            }),
            setTextContent: vi.fn(),
            // Mock other UiService methods if needed
        } as unknown as UiService;

        missionService = {
            getAll: vi.fn(() => ([{ id: 'mission1', name: 'Mission 1', mode: 'adventure', objectives: [], scoring: {}, rewards: {} }])),
            getDefault: vi.fn(() => ({ id: 'mission1', name: 'Mission 1', mode: 'adventure', objectives: [], scoring: {}, rewards: {} })),
        } as unknown as MissionService;

        progressionService = {
            getRuns: vi.fn(() => []),
        } as unknown as ProgressionService;

        audioService = {
            playMusic: vi.fn(),
        } as unknown as AudioService;

        sceneManager = {
            change: vi.fn(() => Promise.resolve()),
            push: vi.fn(() => Promise.resolve()),
        } as unknown as SceneManager;

        services.register('uiService', uiService);
        services.register('missionService', missionService);
        services.register('progressionService', progressionService);
        services.register('audioService', audioService);
        services.register('sceneManager', sceneManager);

        scene = new MainMenuScene(services);
    });

    it('should set overlay visible and play music on enter', async () => {
        await scene.onEnter();

        expect(uiService.setOverlayVisible).toHaveBeenCalledWith('loadingScreen', false);
        expect(uiService.setOverlayVisible).toHaveBeenCalledWith('mainMenuOverlay', true);
        expect(audioService.playMusic).toHaveBeenCalledWith('music_main_theme', { loop: true });
        expect(missionService.getAll).toHaveBeenCalled();
        expect(missionService.getDefault).toHaveBeenCalled();
        expect(uiService.setTextContent).toHaveBeenCalledWith('missionHeader', 'Select a mission to begin');
    });

    it('should hide overlay and clear state on exit', async () => {
        await scene.onEnter(); // Ensure some state is set
        await scene.onExit();

        expect(uiService.setOverlayVisible).toHaveBeenCalledWith('mainMenuOverlay', false);
        // Add more assertions for state clearing if needed
    });
});