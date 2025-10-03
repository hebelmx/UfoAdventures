import { initializeUI } from './ui';
import { GameApplication } from './game-application';

let gameApp: GameApplication;

window.addEventListener('load', async () => {
    try {
        initializeUI();
        gameApp = new GameApplication();
        await gameApp.boot();
        
        const exposeToWindow = import.meta.env.DEV || (window.__E2E__ === true);
        if (exposeToWindow) {
            const handles = window.__devHandles ?? (window.__devHandles = {});
            handles.gameApp = gameApp;
            window.gameApp = gameApp;
        }

    } catch (error) {
        console.error('Failed to boot UFO Adventures', error);
        const loadingText = document.querySelector('.loading-text');
        if (loadingText) {
            loadingText.textContent = 'Failed to start. Check console logs.';
        }
    }
});

window.addEventListener('beforeunload', async () => {
    if (gameApp) {
        try {
            await gameApp.shutdown();
        } catch (error) {
            console.error('Error during shutdown', error);
        }
    }
    if (window.__devHandles?.gameApp === gameApp) {
        delete window.__devHandles.gameApp;
    }
    if (window.gameApp === gameApp) {
        delete window.gameApp;
    }
});
