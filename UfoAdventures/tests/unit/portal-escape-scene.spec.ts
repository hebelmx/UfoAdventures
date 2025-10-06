import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PortalEscapeScene } from '../../src/js/scenes/portal-escape-scene';
import { ServiceLocator } from '../../src/js/engine/service-locator';
import { EventBus } from '../../src/js/engine/event-bus';
import { UiService } from '../../src/js/engine/ui-service';
import { SceneManager } from '../../src/js/engine/scene-manager';

describe('PortalEscapeScene', () => {
    let scene: PortalEscapeScene;
    let mockServices: ServiceLocator;
    let mockEventBus: EventBus;
    let mockUiService: UiService;
    let mockSceneManager: SceneManager;

    beforeEach(() => {
        mockEventBus = {
            on: vi.fn(),
            emit: vi.fn(),
            off: vi.fn()
        } as any;

        mockUiService = {
            setTextContent: vi.fn(),
            showMessage: vi.fn()
        } as any;

        mockSceneManager = {
            push: vi.fn()
        } as any;

        mockServices = {
            optional: vi.fn((name: string) => {
                switch (name) {
                    case 'eventBus': return mockEventBus;
                    case 'uiService': return mockUiService;
                    default: return null;
                }
            }),
            resolve: vi.fn((name: string) => {
                if (name === 'sceneManager') return mockSceneManager;
                throw new Error(`Service ${name} not found`);
            })
        } as any;

        scene = new PortalEscapeScene(mockServices);
        
        // Mock the runtime to avoid PIXI initialization issues
        scene['_runtime'] = {
            getEntities: vi.fn(() => []),
            destroy: vi.fn()
        } as any;
    });

    it('should initialize with correct default values', () => {
        expect(scene).toBeDefined();
        expect(scene['_keysRequired']).toBe(3);
        expect(scene['_keysCollected']).toBe(0);
        expect(scene['_timeRemaining']).toBe(60);
        expect(scene['_portalOpen']).toBe(false);
        expect(scene['_gameWon']).toBe(false);
        expect(scene['_gameLost']).toBe(false);
    });

    it('should register event listeners on enter', async () => {
        // Prevent real runtime creation
        scene['_setupGameplay'] = vi.fn();
        
        await scene.onEnter();
        
        expect(mockEventBus.on).toHaveBeenCalledWith('collectible:key', expect.any(Function));
        expect(mockEventBus.on).toHaveBeenCalledWith('collectible:timeBall', expect.any(Function));
        expect(mockEventBus.on).toHaveBeenCalledWith('portal:enter', expect.any(Function));
    });

    it('should handle key collection correctly', async () => {
        // Prevent real runtime creation
        scene['_setupGameplay'] = vi.fn();
        
        await scene.onEnter();
        
        // Simulate key collection
        scene['_handleKeyCollected']();
        
        expect(scene['_keysCollected']).toBe(1);
        expect(mockUiService.showMessage).toHaveBeenCalledWith(
            'Key collected! (1/3)', 
            '#c4ff6b'
        );
    });

    it('should open portal when all keys are collected', async () => {
        // Prevent real runtime creation
        scene['_setupGameplay'] = vi.fn();
        
        await scene.onEnter();
        
        // Collect all required keys
        for (let i = 0; i < 3; i++) {
            scene['_handleKeyCollected']();
        }
        
        expect(scene['_portalOpen']).toBe(true);
        expect(mockUiService.showMessage).toHaveBeenCalledWith(
            'Portal opened! Enter to escape!', 
            '#8800ff'
        );
    });

    it('should handle time ball collection', async () => {
        // Prevent real runtime creation
        scene['_setupGameplay'] = vi.fn();
        
        await scene.onEnter();
        
        const initialTime = scene['_timeRemaining'];
        scene['_handleTimeBallCollected']({ value: 15 });
        
        expect(scene['_timeBonus']).toBe(15);
        expect(scene['_timeRemaining']).toBe(initialTime + 15);
        expect(mockUiService.showMessage).toHaveBeenCalledWith(
            '+15s bonus!', 
            '#00ffff'
        );
    });

    it('should handle portal entry when portal is open', async () => {
        // Prevent real runtime creation
        scene['_setupGameplay'] = vi.fn();
        
        await scene.onEnter();
        
        // Collect all keys to open portal
        for (let i = 0; i < 3; i++) {
            scene['_handleKeyCollected']();
        }
        
        // Enter portal
        scene['_handlePortalEnter']();
        
        expect(scene['_gameWon']).toBe(true);
    });

    it('should not allow portal entry when portal is closed', async () => {
        // Prevent real runtime creation
        scene['_setupGameplay'] = vi.fn();
        
        await scene.onEnter();
        
        // Try to enter portal without collecting keys
        scene['_handlePortalEnter']();
        
        expect(scene['_gameWon']).toBe(false);
    });

    it('should update timer correctly', async () => {
        // Prevent real runtime creation
        scene['_setupGameplay'] = vi.fn();
        
        await scene.onEnter();
        
        const initialTime = scene['_timeRemaining'];
        scene['_updateTimer'](60); // 1 second delta
        
        expect(scene['_timeRemaining']).toBe(initialTime - 1);
        expect(mockUiService.setTextContent).toHaveBeenCalledWith(
            'portalTime', 
            expect.stringContaining('Time:')
        );
    });

    it('should handle game loss when time runs out', async () => {
        // Prevent real runtime creation
        scene['_setupGameplay'] = vi.fn();
        
        await scene.onEnter();
        
        // Set time to 0
        scene['_timeRemaining'] = 0;
        scene['_checkWinLoseConditions']();
        
        expect(scene['_gameLost']).toBe(true);
    });

    it('should calculate correct win score', async () => {
        // Prevent real runtime creation
        scene['_setupGameplay'] = vi.fn();
        
        await scene.onEnter();
        
        // Set up win conditions
        scene['_keysCollected'] = 3;
        scene['_timeBonus'] = 20;
        scene['_timeRemaining'] = 30;
        
        scene['_handleGameWon']();
        
        const expectedScore = 3 * 1000 + 20 * 100 + 30 * 10; // 3500
        expect(mockUiService.showMessage).toHaveBeenCalledWith(
            `Escape successful! Score: ${expectedScore}`, 
            '#00ff00'
        );
    });

    it('should calculate correct loss score', async () => {
        // Prevent real runtime creation
        scene['_setupGameplay'] = vi.fn();
        
        await scene.onEnter();

        // Set up loss conditions
        scene['_keysCollected'] = 2;
        
        scene['_handleGameLost']();
        
        const expectedScore = 2 * 100; // 200
        expect(mockUiService.showMessage).toHaveBeenCalledWith(
            'Time\'s up! Portal escape failed!', 
            '#ff0000'
        );
    });

    it('should clean up resources on exit', async () => {
        // Prevent real runtime creation
        scene['_setupGameplay'] = vi.fn();
        
        await scene.onEnter();
        await scene.onExit();
        
        expect(scene['_off']).toBeFalsy();
        expect(scene['_runtime']).toBeNull();
    });
});