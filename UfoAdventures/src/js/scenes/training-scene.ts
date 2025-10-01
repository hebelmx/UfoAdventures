class TrainingScene extends Scene {
    constructor(services) {
        super('training', services);
        this._overlay = null;
        this._sceneTransitions = null;
        this._handlers = [];
        this._missionId = 'training-sandbox';
    }

    async onEnter() {
        this._overlay = document.getElementById('trainingOverlay');
        if (this._overlay) {
            this._overlay.style.display = 'flex';
        }
        this._sceneTransitions = this.services.optional('sceneTransitions');
        this._bind();
    }

    async onExit() {
        this._unbind();
        if (this._overlay) {
            this._overlay.style.display = 'none';
        }
        this._overlay = null;
        this._sceneTransitions = null;
        await super.onExit();
    }

    _bind() {
        const startButton = document.getElementById('trainingStartButton');
        if (startButton) {
            const handler = () => this._startTraining();
            startButton.addEventListener('click', handler);
            this._handlers.push({ element: startButton, handler });
        }
        const backButton = document.getElementById('trainingBackButton');
        if (backButton) {
            const handler = () => this._close();
            backButton.addEventListener('click', handler);
            this._handlers.push({ element: backButton, handler });
        }
    }

    _unbind() {
        while (this._handlers.length) {
            const { element, handler } = this._handlers.pop();
            try {
                element.removeEventListener('click', handler);
            } catch (error) {
                console.warn('TrainingScene: failed to remove handler', error);
            }
        }
    }

    _startTraining() {
        if (this._sceneTransitions && typeof this._sceneTransitions.isActive === 'function' && this._sceneTransitions.isActive()) {
            return;
        }
        const sceneManager = this.services.resolve('sceneManager');
        sceneManager.replace('gameplay', {
            missionId: this._missionId,
            mode: 'training',
            options: { training: true }
        }).catch(error => {
            console.error('TrainingScene: failed to start training mode', error);
        });
    }

    _close() {
        if (this._sceneTransitions && typeof this._sceneTransitions.isActive === 'function' && this._sceneTransitions.isActive()) {
            return;
        }
        const sceneManager = this.services.resolve('sceneManager');
        sceneManager.pop();
    }
}




