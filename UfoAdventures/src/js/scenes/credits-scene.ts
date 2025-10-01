class CreditsScene extends Scene {
    constructor(services) {
        super('credits', services);
        this._overlay = null;
        this._handler = null;
    }

    async onEnter() {
        this._overlay = document.getElementById('creditsOverlay');
        if (this._overlay) {
            this._overlay.style.display = 'flex';
        }
        const closeButton = document.getElementById('creditsCloseButton');
        if (closeButton) {
            this._handler = () => this._close();
            closeButton.addEventListener('click', this._handler);
        }
    }

    async onExit() {
        if (this._handler) {
            const closeButton = document.getElementById('creditsCloseButton');
            try {
                closeButton?.removeEventListener('click', this._handler);
            } catch (error) {
                console.warn('CreditsScene: failed to remove handler', error);
            }
        }
        if (this._overlay) {
            this._overlay.style.display = 'none';
        }
        this._overlay = null;
        this._handler = null;
        await super.onExit();
    }

    _close() {
        const sceneManager = this.services.resolve('sceneManager');
        sceneManager.pop();
    }
}
