class PauseScene extends Scene {
    constructor(services) {
        super('pause-menu', services);
        this._overlay = null;
        this._mode = 'adventure';
        this._handlers = [];
    }

    async onEnter(params = {}) {
        this._mode = params.mode || 'adventure';
        this._overlay = document.getElementById('pauseOverlay');
        if (this._overlay) {
            this._overlay.style.display = 'flex';
        }

        this._bindButtons();
    }

    async onSuspend() {
        if (this._overlay) {
            this._overlay.style.display = 'none';
        }
    }

    async onResume() {
        if (this._overlay) {
            this._overlay.style.display = 'flex';
        }
    }

    async onExit() {
        this._unbindButtons();
        if (this._overlay) {
            this._overlay.style.display = 'none';
            this._overlay = null;
        }

        await super.onExit();
    }

    _bindButtons() {
        const sceneManager = this.services.resolve('sceneManager');
        const eventBus = this.eventBus;

        this._hookButton('pauseResumeButton', async (button) => {
            button.disabled = true;
            try {
                await sceneManager.pop();
            } catch (error) {
                console.error('PauseScene: failed to resume gameplay', error);
                button.disabled = false;
            }
        });

        this._hookButton('pauseInventoryButton', async (button) => {
            button.disabled = true;
            try {
                await sceneManager.push('inventory', { mode: this._mode });
            } catch (error) {
                console.error('PauseScene: failed to open inventory', error);
            } finally {
                button.disabled = false;
            }
        });

        this._hookButton('pauseEndButton', async (button) => {
            button.disabled = true;
            try {
                await sceneManager.pop({ reason: 'end-mission' }, { resume: false });
                if (eventBus) {
                    eventBus.emit('game:request-results', {
                        outcome: 'mission-complete',
                        reason: 'mission-complete',
                        mode: this._mode
                    });
                }
            } catch (error) {
                console.error('PauseScene: failed to end mission', error);
                button.disabled = false;
            }
        });

        this._hookButton('pauseQuitButton', async (button) => {
            button.disabled = true;
            try {
                await sceneManager.pop({ reason: 'quit-to-menu' }, { resume: false });
                if (eventBus) {
                    eventBus.emit('game:return-to-menu');
                }
            } catch (error) {
                console.error('PauseScene: failed to quit to menu', error);
                button.disabled = false;
            }
        });
    }

    _hookButton(id, handler) {
        const element = document.getElementById(id);
        if (!element) {
            console.warn('PauseScene: button not found', id);
            return;
        }

        const wrapped = () => handler(element);
        element.addEventListener('click', wrapped);
        element.disabled = false;
        this._handlers.push({ element, handler: wrapped });
    }

    _unbindButtons() {
        while (this._handlers.length) {
            const { element, handler } = this._handlers.pop();
            element.removeEventListener('click', handler);
        }
    }
}
