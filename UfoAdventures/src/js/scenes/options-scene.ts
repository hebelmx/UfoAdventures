class OptionsScene extends Scene {
    constructor(services) {
        super('options', services);
        this._overlay = null;
        this._saveService = null;
        this._gameApplication = null;
        this._form = null;
        this._audioService = null;
        this._storageKey = 'ufoadventures:options';
        this._handlers = [];
    }

    async onEnter() {
        this._overlay = document.getElementById('optionsOverlay');
        this._form = document.getElementById('optionsForm');
        if (this._overlay) {
            this._overlay.style.display = 'flex';
        }
        this._saveService = this.services.optional ? this.services.optional('saveService') : null;
        this._gameApplication = window.gameApp || null;
        await this._restoreValues();
        this._bind();
    }

    async onExit() {
        this._unbind();
        if (this._overlay) {
            this._overlay.style.display = 'none';
        }
        this._overlay = null;
        this._form = null;
        await super.onExit();
        this._saveService = null;
        this._gameApplication = null;
        this._audioService = null;
    }

    _bind() {
        const closeButton = document.getElementById('optionsCloseButton');
        if (closeButton) {
            const handler = () => this._close();
            closeButton.addEventListener('click', handler);
            this._handlers.push({ element: closeButton, handler });
        }

        if (this._form) {
            const submitHandler = async (event) => {
                event.preventDefault();
                try {
                    await this._persistValues();
                    if (typeof showMessage === 'function') {
                        showMessage('Options saved.', '#6bffb8');
                    }
                    this._close();
                } catch (error) {
                    console.error('OptionsScene: failed to persist values', error);
                    if (typeof showMessage === 'function') {
                        showMessage('Unable to save options. See console for details.', '#ff8686');
                    }
                }
            };
            this._form.addEventListener('submit', submitHandler);
            this._handlers.push({ element: this._form, handler: submitHandler, type: 'submit' });
        }
    }

    _unbind() {
        while (this._handlers.length) {
            const { element, handler, type } = this._handlers.pop();
            try {
                element.removeEventListener(type || 'click', handler);
            } catch (error) {
                console.warn('OptionsScene: failed to remove handler', error);
            }
        }
    }

    async _restoreValues() {
        const stored = await this._load();
        const music = document.getElementById('optionsMusic');
        const sfx = document.getElementById('optionsSfx');
        const difficulty = document.getElementById('optionsDifficulty');
        if (music && stored.music) {
            music.value = stored.music;
        }
        if (sfx && stored.sfx) {
            sfx.value = stored.sfx;
        }
        if (difficulty && stored.difficulty) {
            difficulty.value = stored.difficulty;
        }
    }


    async _persistValues() {
        const music = document.getElementById('optionsMusic');
        const sfx = document.getElementById('optionsSfx');
        const difficulty = document.getElementById('optionsDifficulty');
        const payload = {
            music: music ? music.value : 'on',
            sfx: sfx ? sfx.value : 'on',
            difficulty: difficulty ? difficulty.value : 'standard'
        };
        
        // Convert to GameApplication settings format
        const settings = {
            musicVolume: payload.music === 'on' ? 0.8 : 0,
            sfxVolume: payload.sfx === 'on' ? 1.0 : 0,
            difficulty: payload.difficulty
        };
        
        await this._save(payload);
        if (this._gameApplication && typeof this._gameApplication.setUserSettings === 'function') {
            this._gameApplication.setUserSettings(settings);
        }
    }

    async _load() {
        if (this._saveService && typeof this._saveService.load === 'function') {
            try {
                const data = await this._saveService.load(this._storageKey);
                if (data && typeof data === 'object') {
                    return Object.assign({ music: 'on', sfx: 'on', difficulty: 'standard' }, data);
                }
            } catch (error) {
                console.warn('OptionsScene: failed to load options from SaveService', error);
            }
        }
        try {
            const raw = window.localStorage ? window.localStorage.getItem(this._storageKey) : null;
            if (!raw) {
                return { music: 'on', sfx: 'on', difficulty: 'standard' };
            }
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') {
                return Object.assign({ music: 'on', sfx: 'on', difficulty: 'standard' }, parsed);
            }
        } catch (error) {
            console.warn('OptionsScene: failed to load stored options', error);
        }
        return { music: 'on', sfx: 'on', difficulty: 'standard' };
    }

    async _save(payload) {
        if (this._saveService && typeof this._saveService.save === 'function') {
            await this._saveService.save(this._storageKey, payload);
            return;
        }
        try {
            window.localStorage?.setItem(this._storageKey, JSON.stringify(payload));
        } catch (error) {
            console.warn('OptionsScene: failed to persist options', error);
        }
    }

    _close() {
        const sceneManager = this.services.resolve('sceneManager');
        sceneManager.pop();
    }
}






