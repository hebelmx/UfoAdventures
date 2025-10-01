class AssetLoadingScene extends Scene {
    constructor(services) {
        super('asset-loading', services);
    }

    async onEnter() {
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) {
            loadingScreen.style.display = 'flex';
        }

        const loadingText = document.querySelector('.loading-text');
        if (loadingText) {
            loadingText.textContent = 'Loading assets...';
        }

        const configService = this.services.resolve('configService');
        const resourceManager = this.services.resolve('resourceManager');

        await configService.load();
        const manifest = configService.get('assets', []);

        await resourceManager.loadManifest(manifest, (progress, alias) => {
            if (!loadingText) {
                return;
            }

            const percentage = Math.round(progress * 100);
            const label = alias ? ' (' + alias + ')' : '';
            loadingText.textContent = 'Loading assets... ' + percentage + '%' + label;
        });

        if (loadingText) {
            loadingText.textContent = 'Assets ready';
        }

        const sceneManager = this.services.resolve('sceneManager');
        await sceneManager.change('main-menu');
    }
}
