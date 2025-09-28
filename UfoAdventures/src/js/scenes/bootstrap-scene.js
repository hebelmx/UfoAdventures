class BootstrapScene extends Scene {
    constructor(services) {
        super('bootstrap', services);
    }

    async onEnter() {
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) {
            loadingScreen.style.display = 'flex';
        }

        const loadingText = document.querySelector('.loading-text');
        if (loadingText) {
            loadingText.textContent = 'Preparing systems...';
        }

        const sceneManager = this.services.resolve('sceneManager');
        window.requestAnimationFrame(() => {
            sceneManager.change('asset-loading').catch((error) => {
                console.error('Failed to advance from bootstrap scene', error);
            });
        });
    }
}
