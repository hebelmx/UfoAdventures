import { Scene, SceneManager } from '../engine/scene-manager';
import { ServiceLocator } from '../engine/service-locator';
import { SaveService } from '../engine/save-service';
import { GameApplication } from '../game-application';


import { showMessage } from '../ui';

interface UIHandler {
    element: HTMLElement;
    handler: (event: Event) => void;
    type?: string;
}

interface Options {
    music: 'on' | 'off';
    sfx: 'on' | 'off';
    difficulty: 'story' | 'standard' | 'hard';
}

const DEFAULT_OPTIONS: Options = {
    music: 'on',
    sfx: 'on',
    difficulty: 'standard'
};

export class OptionsScene extends Scene {
    private _overlay: HTMLElement | null = null;
    private _saveService: SaveService | null = null;
    private _gameApplication: GameApplication | null = null;
    private _form: HTMLFormElement | null = null;
    private readonly _storageKey = 'ufoadventures:options';
    private readonly _handlers: UIHandler[] = [];

    constructor(services: ServiceLocator) {
        super('options', services);
    }

    async onEnter(): Promise<void> {
        this._overlay = document.getElementById('optionsOverlay');
        this._form = document.getElementById('optionsForm') as HTMLFormElement;
        if (this._overlay) {
            this._overlay.style.display = 'flex';
        }
        this._saveService = this.services.optional<SaveService>('saveService');
        this._gameApplication = this.services.optional<GameApplication>('gameApplication');
        await this._restoreValues();
        this._bind();
    }

    async onExit(): Promise<void> {
        this._unbind();
        if (this._overlay) {
            this._overlay.style.display = 'none';
        }
        this._overlay = null;
        this._form = null;
        await super.onExit();
        this._saveService = null;
        this._gameApplication = null;
    }

    private _bind(): void {
        const closeButton = document.getElementById('optionsCloseButton');
        if (closeButton) {
            const handler = () => this._close();
            closeButton.addEventListener('click', handler as EventListener);
            this._handlers.push({ element: closeButton, handler: handler as EventListener });
        }

        if (this._form) {
            const submitHandler = async (event: Event) => {
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

    private _unbind(): void {
        while (this._handlers.length) {
            const { element, handler, type } = this._handlers.pop()!;
            try {
                element.removeEventListener(type || 'click', handler);
            } catch (error) {
                console.warn('OptionsScene: failed to remove handler', error);
            }
        }
    }

    private async _restoreValues(): Promise<void> {
        const stored = await this._load();
        const music = document.getElementById('optionsMusic') as HTMLSelectElement;
        const sfx = document.getElementById('optionsSfx') as HTMLSelectElement;
        const difficulty = document.getElementById('optionsDifficulty') as HTMLSelectElement;
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

    private async _persistValues(): Promise<void> {
        const music = document.getElementById('optionsMusic') as HTMLSelectElement;
        const sfx = document.getElementById('optionsSfx') as HTMLSelectElement;
        const difficulty = document.getElementById('optionsDifficulty') as HTMLSelectElement;
        const payload: Options = {
            music: music ? music.value as 'on' | 'off' : 'on',
            sfx: sfx ? sfx.value as 'on' | 'off' : 'on',
            difficulty: difficulty ? difficulty.value as 'story' | 'standard' | 'hard' : 'standard'
        };
        
        const settings = {
            musicVolume: payload.music === 'on' ? 0.8 : 0,
            sfxVolume: payload.sfx === 'on' ? 1.0 : 0,
            difficulty: payload.difficulty
        };
        
        await this._save(payload);
        if (this._gameApplication) {
            this._gameApplication.setUserSettings(settings);
        }
    }

    private async _load(): Promise<Options> {
        if (this._saveService) {
            try {
                const data = await this._saveService.load<Options>(this._storageKey);
                if (data && typeof data === 'object') {
                    return { ...DEFAULT_OPTIONS, ...data };
                }
            } catch (error) {
                console.warn('OptionsScene: failed to load options from SaveService', error);
            }
        }
        try {
            const raw = window.localStorage ? window.localStorage.getItem(this._storageKey) : null;
            if (!raw) {
                return { ...DEFAULT_OPTIONS };
            }
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') {
                return { ...DEFAULT_OPTIONS, ...parsed };
            }
        } catch (error) {
            console.warn('OptionsScene: failed to load stored options', error);
        }
        return { ...DEFAULT_OPTIONS };
    }

    private async _save(payload: Options): Promise<void> {
        if (this._saveService) {
            await this._saveService.save(this._storageKey, payload);
            return;
        }
        try {
            window.localStorage?.setItem(this._storageKey, JSON.stringify(payload));
        } catch (error) {
            console.warn('OptionsScene: failed to persist options', error);
        }
    }

    private _close(): void {
        const sceneManager = this.services.resolve<SceneManager>('sceneManager');
        sceneManager.pop();
    }
}



