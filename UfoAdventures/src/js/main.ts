let gameApp;

window.addEventListener('load', async () => {
    try {
        gameApp = new GameApplication();
        await gameApp.boot();
        window.gameApp = gameApp;
        // Expose runtime for Playwright
        try {
            const services = gameApp.services;
            const sceneManager = services.resolve('sceneManager');
            const gameplayScene = sceneManager ? sceneManager._getScene('gameplay') : null;
            Object.defineProperty(window, '__gameRuntime', {
                get() {
                    return gameplayScene && gameplayScene.runtime ? gameplayScene.runtime : null;
                }, configurable: true
            });
        } catch {}
    } catch (error) {
        console.error('Failed to boot UFO Adventures', error);
        const loadingText = document.querySelector('.loading-text');
        if (loadingText) {
            loadingText.textContent = 'Failed to start. Check console logs.';
        }
    }
});
