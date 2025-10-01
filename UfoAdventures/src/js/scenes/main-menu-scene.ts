class MainMenuScene extends Scene {
    constructor(services) {
        super('main-menu', services);
        this._buttonHandlers = [];
    }

    async onEnter() {
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) {
            loadingScreen.style.display = 'flex';
        }

        const loadingText = document.querySelector('.loading-text');
        if (loadingText) {
            loadingText.textContent = 'Select a mission to begin';
        }

        const sceneManager = this.services.resolve('sceneManager');
        const buttons = [
            { id: 'startGameButton', mode: 'adventure' },
            { id: 'startBossFightButton', mode: 'boss' },
            { id: 'startEnemyDemoButton', mode: 'enemyDemo' },
        ];

        buttons.forEach(({ id, mode }) => {
            const element = document.getElementById(id);
            if (!element) {
                console.warn('MainMenuScene: button not found', id);
                return;
            }

            element.disabled = false;
            const handler = () => {
                element.disabled = true;
                sceneManager.change('gameplay', { mode }).catch((error) => {
                    console.error('Failed to start gameplay mode', mode, error);
                    element.disabled = false;
                });
            };

            element.addEventListener('click', handler);
            this._buttonHandlers.push({ element, handler });
        });
    }

    async onExit() {
        this._buttonHandlers.forEach(({ element, handler }) => {
            element.removeEventListener('click', handler);
        });
        this._buttonHandlers = [];

        const loadingText = document.querySelector('.loading-text');
        if (loadingText) {
            loadingText.textContent = 'Loading...';
        }

        await super.onExit();
    }
}
