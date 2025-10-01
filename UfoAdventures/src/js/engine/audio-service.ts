class AudioService {
    constructor(options = {}) {
        this._resourceManager = options.resourceManager || null;
        this._tracks = new Map();
        this._eventBus = null;
        this._subscriptions = [];
        this._masterVolume = 1;
        this._muted = false;
        this._settings = { music: 'on', sfx: 'on' };
        this._currentMusicAlias = null;
        this._currentMusic = null;
        this._activeSounds = new Set();
        this._supportsAudio = typeof Audio !== 'undefined';
    }

    async configure(config = {}, settings = {}) {
        this._tracks.clear();
        this._currentMusicAlias = null;
        this._currentMusic = null;
        const music = Array.isArray(config.music) ? config.music : [];
        const sfx = Array.isArray(config.sfx) ? config.sfx : [];
        const loaders = [];
        music.forEach(def => loaders.push(this._loadTrack(def, 'music')));
        sfx.forEach(def => loaders.push(this._loadTrack(def, 'sfx')));
        await Promise.all(loaders);
        this.applySettings(settings);
    }

    attach(eventBus) {
        if (!eventBus || this._eventBus === eventBus) {
            return;
        }
        this.detach();
        this._eventBus = eventBus;
        this._subscriptions = [
            eventBus.on('ability:combo-breaker', () => this.playSound('sfx_combo_breaker')),
            eventBus.on('ability:teleport', () => this.playSound('sfx_teleport')),
            eventBus.on('combat:projectile-fired', payload => this._handleProjectileFired(payload)),
            eventBus.on('combat:damage', payload => this._handleDamage(payload)),
            eventBus.on('boss:phase-change', () => this.playSound('sfx_boss_phase_shift')),
            eventBus.on('boss:defeated', () => {
                this.playSound('sfx_boss_defeated');
            }),
            eventBus.on('game:request-results', payload => this._handleResults(payload))
        ];
    }

    detach() {
        while (this._subscriptions.length) {
            const off = this._subscriptions.pop();
            try {
                if (typeof off === 'function') {
                    off();
                }
            } catch (error) {
                console.warn('AudioService: failed to detach event listener', error);
            }
        }
        this._eventBus = null;
    }

    applySettings(settings = {}) {
        // Convert from GameApplication settings format
        if (typeof settings.musicVolume === 'number') {
            this._settings.music = settings.musicVolume > 0 ? 'on' : 'off';
            this._settings.musicVolume = settings.musicVolume;
        }
        if (typeof settings.sfxVolume === 'number') {
            this._settings.sfx = settings.sfxVolume > 0 ? 'on' : 'off';
            this._settings.sfxVolume = settings.sfxVolume;
        }
        if (typeof settings.masterVolume === 'number') {
            this.setMasterVolume(settings.masterVolume);
        }
        this._updateMusicChannel();
    }

    setMasterVolume(value) {
        const normalized = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 1;
        this._masterVolume = normalized;
        this._updateMusicChannel();
        this._activeSounds.forEach(sound => {
            if (sound && typeof sound.volume === 'number') {
                sound.volume = this._calculateSfxVolume(sound._baseVolume || 1);
            }
        });
    }

    mute(flag = true) {
        this._muted = !!flag;
        this._updateMusicChannel();
        this._activeSounds.forEach(sound => {
            if (sound && typeof sound.volume === 'number') {
                sound.volume = this._muted ? 0 : this._calculateSfxVolume(sound._baseVolume || 1);
            }
        });
        if (this._muted && this._currentMusic) {
            this._currentMusic.pause();
        } else if (!this._muted && this._currentMusic && !this._currentMusic.paused) {
            this._currentMusic.play().catch(() => {});
        }
    }

    playMusic(alias, options = {}) {
        if (!alias) {
            return;
        }
        const track = this._tracks.get(alias);
        if (!track || track.type !== 'music') {
            console.warn('AudioService: music track not found', alias);
            return;
        }

        const element = track.element ? track.element : this._createStubAudio();
        element.loop = options.loop !== undefined ? !!options.loop : !!track.loop;
        element.currentTime = 0;

        this._currentMusicAlias = alias;
        this._currentMusic = element;
        this._updateMusicChannel();
        if (this._shouldPlayMusic()) {
            const playPromise = element.play();
            if (playPromise && typeof playPromise.catch === 'function') {
                playPromise.catch(error => {
                    console.warn('AudioService: failed to play music', alias, error);
                });
            }
        }
    }

    stopMusic() {
        if (!this._currentMusic) {
            return;
        }
        try {
            this._currentMusic.pause();
            this._currentMusic.currentTime = 0;
        } catch (error) {
            console.warn('AudioService: failed to stop music', error);
        }
        this._currentMusic = null;
        this._currentMusicAlias = null;
    }

    playSound(alias, options = {}) {
        if (this._muted || this._settings.sfx === 'off') {
            return;
        }
        const track = this._tracks.get(alias);
        if (!track || track.type !== 'sfx') {
            console.warn('AudioService: sfx track not found', alias);
            return;
        }
        const element = track.element ? this._cloneAudioElement(track) : this._createStubAudio();
        element.loop = !!options.loop;
        element._baseVolume = (options.volume !== undefined ? options.volume : track.baseVolume || 1);
        element.volume = this._calculateSfxVolume(element._baseVolume);
        element.currentTime = options.offset || 0;
        this._activeSounds.add(element);
        const cleanup = () => {
            element.removeEventListener && element.removeEventListener('ended', cleanup);
            element.removeEventListener && element.removeEventListener('error', cleanup);
            this._activeSounds.delete(element);
        };
        if (element.addEventListener) {
            element.addEventListener('ended', cleanup, { once: true });
            element.addEventListener('error', cleanup, { once: true });
        }
        const playPromise = element.play ? element.play() : null;
        if (playPromise && typeof playPromise.catch === 'function') {
            playPromise.catch(error => {
                console.warn('AudioService: failed to play sound', alias, error);
                cleanup();
            });
        } else if (!playPromise) {
            cleanup();
        }
    }

    _cloneAudioElement(track) {
        if (!this._supportsAudio || !track.element) {
            return this._createStubAudio();
        }
        const template = track.element;
        const clone = template.cloneNode(true);
        if (!clone || !clone.src) {
            const audio = new Audio(template.src);
            audio.crossOrigin = template.crossOrigin || 'anonymous';
            return audio;
        }
        return clone;
    }

    async _loadTrack(definition = {}, type) {
        const alias = definition.alias;
        const src = definition.src;
        if (!alias || !src) {
            console.warn('AudioService: invalid audio definition', definition);
            return;
        }
        if (!this._supportsAudio) {
            this._tracks.set(alias, { type, element: null, baseVolume: definition.volume ?? 1, loop: !!definition.loop });
            return;
        }
        try {
            const element = await this._createAudioElement(definition);
            this._tracks.set(alias, {
                type,
                element,
                baseVolume: definition.volume ?? 1,
                loop: type === 'music' ? (definition.loop !== false) : !!definition.loop,
                meta: definition
            });
        } catch (error) {
            console.warn('AudioService: failed to load track', alias, error);
            this._tracks.set(alias, { type, element: null, baseVolume: definition.volume ?? 1, loop: !!definition.loop });
        }
    }

    _createAudioElement(definition) {
        return new Promise((resolve, reject) => {
            try {
                const audio = new Audio();
                audio.preload = 'auto';
                if (definition.crossOrigin) {
                    audio.crossOrigin = definition.crossOrigin;
                } else {
                    audio.crossOrigin = 'anonymous';
                }
                audio.loop = !!definition.loop;
                audio.src = definition.src;
                const cleanup = () => {
                    audio.removeEventListener('canplaythrough', onReady);
                    audio.removeEventListener('error', onError);
                };
                const onReady = () => {
                    cleanup();
                    resolve(audio);
                };
                const onError = (event) => {
                    cleanup();
                    reject(new Error('Audio failed to load: ' + (event?.message || audio.src)));
                };
                audio.addEventListener('canplaythrough', onReady, { once: true });
                audio.addEventListener('error', onError, { once: true });
                audio.load();
            } catch (error) {
                reject(error);
            }
        });
    }

    _createStubAudio() {
        return {
            paused: true,
            loop: false,
            volume: 0,
            currentTime: 0,
            play() { return Promise.resolve(); },
            pause() {},
            addEventListener() {},
            removeEventListener() {}
        };
    }

    _updateMusicChannel() {
        if (!this._currentMusic) {
            return;
        }
        const track = this._tracks.get(this._currentMusicAlias);
        const baseVolume = track ? (track.baseVolume ?? 1) : 1;
        const effectiveVolume = this._shouldPlayMusic() ? baseVolume * this._masterVolume : 0;
        this._currentMusic.volume = effectiveVolume;
        if (effectiveVolume <= 0.0001) {
            try {
                this._currentMusic.pause();
            } catch (error) {}
        } else if (this._currentMusic.paused) {
            const playPromise = this._currentMusic.play();
            if (playPromise && typeof playPromise.catch === 'function') {
                playPromise.catch(() => {});
            }
        }
    }

    _calculateSfxVolume(base) {
        if (this._muted || this._settings.sfx === 'off') {
            return 0;
        }
        return Math.max(0, Math.min(1, base * this._masterVolume));
    }

    _shouldPlayMusic() {
        return !this._muted && this._settings.music !== 'off';
    }

    _handleProjectileFired(payload = {}) {
        const source = payload.source || (payload.origin && payload.origin.hasComponent && payload.origin.hasComponent(Player) ? 'player' : 'enemy');
        if (source === 'player') {
            this.playSound('sfx_player_fire', { volume: 0.65 });
        } else if (source === 'enemy') {
            this.playSound('sfx_enemy_fire', { volume: 0.55 });
        }
    }

    _handleDamage(payload = {}) {
        const type = payload.targetType || this._inferTargetType(payload.target);
        if (type === 'player') {
            this.playSound('sfx_player_damage');
        } else if (type === 'enemy') {
            this.playSound('sfx_enemy_damage', { volume: 0.5 });
        }
    }

    _inferTargetType(target) {
        if (!target || typeof target.hasComponent !== 'function') {
            return null;
        }
        if (typeof Player !== 'undefined' && target.hasComponent(Player)) {
            return 'player';
        }
        if (typeof Boss !== 'undefined' && target.hasComponent(Boss)) {
            return 'boss';
        }
        if (typeof Enemy !== 'undefined' && target.hasComponent(Enemy)) {
            return 'enemy';
        }
        return null;
    }

    _handleResults(payload = {}) {
        const outcome = payload.outcome || payload.reason || 'complete';
        if (outcome === 'complete' || outcome === 'victory') {
            this.playSound('sfx_results_success', { volume: 0.8 });
        } else {
            this.playSound('sfx_results_failure', { volume: 0.75 });
        }
        this.stopMusic();
        this.playMusic('music_results', { loop: false });
    }
}

window.AudioService = AudioService;
