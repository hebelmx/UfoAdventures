let gameApp;

window.addEventListener('load', async () => {
    try {
        gameApp = new GameApplication();
        await gameApp.boot();
        window.gameApp = gameApp;
    } catch (error) {
        console.error('Failed to boot UFO Adventures', error);
        const loadingText = document.querySelector('.loading-text');
        if (loadingText) {
            loadingText.textContent = 'Failed to start. Check console logs.';
        }
    }
});
