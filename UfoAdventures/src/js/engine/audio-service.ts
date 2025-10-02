import { ResourceManager } from './resource-manager';
import { EventBus } from './event-bus';
import { Boss, Enemy } from './components';
import { Player } from '../entities/player';
import type { Entity } from './core';
import type { CombatDamageEvent, CombatProjectileFiredEvent, CombatTargetType, GameResultsRequest } from './event-payloads';

export interface AudioServiceOptions {
    resourceManager: ResourceManager;
}

export interface AudioTrack {
    type: 'music' | 'sfx';
    element: HTMLAudioElement | null;
    baseVolume: number;
    loop: boolean;
    meta?: any;
}

export interface AudioSettings {
    music: 'on' | 'off';
    sfx: 'on' | 'off';
    musicVolume?: number;
    sfxVolume?: number;
    masterVolume?: number;
}

export class AudioService {
    private readonly _resourceManager: ResourceManager | null;
    private readonly _tracks: Map<string, AudioTrack> = new Map();
    private _eventBus: EventBus | null = null;
    private _subscriptions: (() => void)[] = [];
    private _masterVolume = 1;
    private _muted = false;
    private _settings: AudioSettings = { music: 'on', sfx: 'on' };
    private _currentMusicAlias: string | null = null;
    private _currentMusic: HTMLAudioElement | null = null;
    private readonly _activeSounds: Set<HTMLAudioElement> = new Set();
    private readonly _supportsAudio: boolean;

    constructor(options: Partial<AudioServiceOptions> = {}) {
        this._resourceManager = options.resourceManager || null;
        this._supportsAudio = typeof Audio !== 'undefined';
    }

    async configure(config: { music?: any[], sfx?: any[] } = {}, settings: Partial<AudioSettings> = {}): Promise<void> {
        this._tracks.clear();
        this._currentMusicAlias = null;
        this._currentMusic = null;
        const music = Array.isArray(config.music) ? config.music : [];
        const sfx = Array.isArray(config.sfx) ? config.sfx : [];
        const loaders: Promise<void>[] = []; 
        music.forEach(def => loaders.push(this._loadTrack(def, 'music')));
        sfx.forEach(def => loaders.push(this._loadTrack(def, 'sfx')));
        await Promise.all(loaders);
        this.applySettings(settings);
    }

    attach(eventBus: EventBus): void {
        if (!eventBus || this._eventBus === eventBus) {
            return;
        }
        this.detach();
        this._eventBus = eventBus;
        this._subscriptions = [
            eventBus.on('ability:combo-breaker', () => this.playSound('sfx_combo_breaker')),
            eventBus.on('ability:teleport', () => this.playSound('sfx_teleport')),
            eventBus.on<CombatProjectileFiredEvent>('combat:projectile-fired', payload => this._handleProjectileFired(payload)),
            eventBus.on<CombatDamageEvent>('combat:damage', payload => this._handleDamage(payload)),
            eventBus.on('boss:phase-change', () => this.playSound('sfx_boss_phase_shift')),
            eventBus.on('boss:defeated', () => {
                this.playSound('sfx_boss_defeated');
            }),
            eventBus.on<GameResultsRequest>('game:request-results', payload => this._handleResults(payload))
        ];
    }

    detach(): void {
        while (this._subscriptions.length) {
            const off = this._subscriptions.pop();
            if (off) {
                try {
                    off();
                } catch (error) {
                    console.warn('AudioService: failed to detach event listener', error);
                }
            }
        }
        this._eventBus = null;
    }

    applySettings(settings: Partial<AudioSettings> = {}): void {
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

    setMasterVolume(value: number): void {
        const normalized = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 1;
        this._masterVolume = normalized;
        this._updateMusicChannel();
        this._activeSounds.forEach(sound => {
            sound.volume = this._calculateSfxVolume((sound as any)._baseVolume || 1);
        });
    }

    mute(flag = true): void {
        this._muted = !!flag;
        this._updateMusicChannel();
        this._activeSounds.forEach(sound => {
            sound.volume = this._muted ? 0 : this._calculateSfxVolume((sound as any)._baseVolume || 1);
        });
        if (this._muted && this._currentMusic) {
            this._currentMusic.pause();
        } else if (!this._muted && this._currentMusic && this._currentMusic.paused) {
            this._currentMusic.play().catch(() => {});
        }
    }

    playMusic(alias: string, options: { loop?: boolean } = {}): void {
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

    stopMusic(): void {
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

    playSound(alias: string, options: { loop?: boolean, volume?: number, offset?: number } = {}): void {
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
        (element as any)._baseVolume = (options.volume !== undefined ? options.volume : track.baseVolume || 1);
        element.volume = this._calculateSfxVolume((element as any)._baseVolume);
        element.currentTime = options.offset || 0;
        this._activeSounds.add(element);
        const cleanup = () => {
            element.removeEventListener('ended', cleanup);
            element.removeEventListener('error', cleanup);
            this._activeSounds.delete(element);
        };
        element.addEventListener('ended', cleanup, { once: true });
        element.addEventListener('error', cleanup, { once: true });
        const playPromise = element.play();
        if (playPromise && typeof playPromise.catch === 'function') {
            playPromise.catch(error => {
                console.warn('AudioService: failed to play sound', alias, error);
                cleanup();
            });
        }
    }

    private _cloneAudioElement(track: AudioTrack): HTMLAudioElement {
        if (!this._supportsAudio || !track.element) {
            return this._createStubAudio();
        }
        const template = track.element;
        const clone = template.cloneNode(true) as HTMLAudioElement;
        if (!clone || !clone.src) {
            const audio = new Audio(template.src);
            audio.crossOrigin = template.crossOrigin || 'anonymous';
            return audio;
        }
        return clone;
    }

    private async _loadTrack(definition: any = {}, type: 'music' | 'sfx'): Promise<void> {
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

    private _createAudioElement(definition: any): Promise<HTMLAudioElement> {
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
                const onError = (event: Event | string) => {
                    cleanup();
                    reject(new Error(`Audio failed to load: ${typeof event === 'string' ? event : audio.src}`));
                };
                audio.addEventListener('canplaythrough', onReady, { once: true });
                audio.addEventListener('error', onError, { once: true });
                audio.load();
            } catch (error) {
                reject(error);
            }
        });
    }

    private _createStubAudio(): HTMLAudioElement {
        return {
            paused: true,
            loop: false,
            volume: 0,
            currentTime: 0,
            play: () => Promise.resolve(),
            pause: () => {},
            addEventListener: () => {},
            removeEventListener: () => {}
        } as any;
    }

    private _updateMusicChannel(): void {
        if (!this._currentMusic) {
            return;
        }
        const track = this._tracks.get(this._currentMusicAlias!);
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

    private _calculateSfxVolume(base: number): number {
        if (this._muted || this._settings.sfx === 'off') {
            return 0;
        }
        return Math.max(0, Math.min(1, base * this._masterVolume));
    }

    private _shouldPlayMusic(): boolean {
        return !this._muted && this._settings.music !== 'off';
    }

    private _handleProjectileFired(payload?: CombatProjectileFiredEvent): void {
        if (!payload) {
            return;
        }
        const source = payload.source || (payload.origin && payload.origin.hasComponent && payload.origin.hasComponent(Player) ? 'player' : 'enemy');
        if (source === 'player') {
            this.playSound('sfx_player_fire', { volume: 0.65 });
        } else if (source === 'enemy') {
            this.playSound('sfx_enemy_fire', { volume: 0.55 });
        }
    }

    private _handleDamage(payload?: CombatDamageEvent): void {
        const type = payload?.targetType ?? this._inferTargetType(payload?.target ?? null);
        if (type === 'player') {
            this.playSound('sfx_player_damage');
        } else if (type === 'enemy') {
            this.playSound('sfx_enemy_damage', { volume: 0.5 });
        }
    }

    private _inferTargetType(target: Entity | null): CombatTargetType {
        if (!target || typeof target.hasComponent !== 'function') {
            return null;
        }
        if (target.hasComponent(Player)) {
            return 'player';
        }
        if (target.hasComponent(Boss)) {
            return 'boss';
        }
        if (target.hasComponent(Enemy)) {
            return 'enemy';
        }
        return null;
    }

    private _handleResults(payload?: GameResultsRequest): void {
        const outcome = payload?.outcome || payload?.reason || 'complete';
        if (outcome === 'complete' || outcome === 'victory') {
            this.playSound('sfx_results_success', { volume: 0.8 });
        } else {
            this.playSound('sfx_results_failure', { volume: 0.75 });
        }
        this.stopMusic();
        this.playMusic('music_results', { loop: false });
    }
}
