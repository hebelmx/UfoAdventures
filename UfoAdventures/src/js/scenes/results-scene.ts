class ResultsScene extends Scene {
    constructor(services) {
        super('results', services);
        this._overlay = null;
        this._handlers = [];
        this._lastParams = {};
    }

    async onEnter(params = {}) {
        this._lastParams = params;
        this._overlay = document.getElementById('resultsOverlay');
        if (this._overlay) {
            this._overlay.style.display = 'flex';
        }

        this._renderContent(params);
        this._bindButtons();
    }

    async onExit() {
        this._unbindButtons();
        if (this._overlay) {
            this._overlay.style.display = 'none';
            this._overlay = null;
        }

        await super.onExit();
    }

    _renderContent(params) {
        const outcome = params.outcome || 'mission-complete';
        const mode = params.mode || 'adventure';
        const reason = params.reason || '';
        const details = params.details;

        const titleEl = document.getElementById('resultsTitle');
        const summaryEl = document.getElementById('resultsSummary');
        const detailEl = document.getElementById('resultsDetail');

        if (titleEl) {
            titleEl.textContent = outcome === 'defeat' ? 'Mission Failed' : 'Mission Complete';
        }

        if (summaryEl) {
            const reasonText = reason ? 'Reason: ' + reason : '';
            summaryEl.textContent = 'Mode: ' + mode + (reasonText ? ' • ' + reasonText : '');
        }

        if (detailEl) {
            if (details && typeof details === 'string') {
                detailEl.textContent = details;
            } else if (details && typeof details === 'object') {
                detailEl.textContent = JSON.stringify(details, null, 2);
            } else {
                detailEl.textContent = 'Great job pilot! Prepare for the next sortie.';
            }
        }
    }

    _bindButtons() {
        const sceneManager = this.services.resolve('sceneManager');

        this._hookButton('resultsMenuButton', async (button) => {
            button.disabled = true;
            try {
                await sceneManager.replace('main-menu');
            } catch (error) {
                console.error('ResultsScene: failed to return to menu', error);
                button.disabled = false;
            }
        });

        this._hookButton('resultsRetryButton', async (button) => {
            button.disabled = true;
            try {
                await sceneManager.replace('gameplay', {
                    mode: this._lastParams.mode || 'adventure',
                    options: this._lastParams.options || {}
                });
            } catch (error) {
                console.error('ResultsScene: failed to restart gameplay', error);
                button.disabled = false;
            }
        });
    }

    _hookButton(id, handler) {
        const element = document.getElementById(id);
        if (!element) {
            console.warn('ResultsScene: button not found', id);
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
            element.disabled = false;
        }
    }
}
