import { ServiceLocator } from './service-locator';
import { EventBus, Handler } from './event-bus';

export interface IScene {
    readonly name: string;
    onEnter(params?: unknown): Promise<void>;
    onExit(params?: unknown): Promise<void>;
    onSuspend(): Promise<void>;
    onResume(): Promise<void>;
    fixedUpdate(delta: number): void;
    update(delta: number): void;
    render(interpolation: number): void;
}

export class Scene implements IScene {
    readonly name: string;
    protected readonly services: ServiceLocator;
    protected readonly eventBus: EventBus | null;
    private readonly _subscriptions: (() => void)[] = [];

    constructor(name: string, services: ServiceLocator) {
        this.name = name;
        this.services = services;
        this.eventBus = services.optional<EventBus>('eventBus');
    }

    async onEnter(_params?: unknown): Promise<void> {}
    async onExit(_params?: unknown): Promise<void> {
        this._teardownSubscriptions();
    }
    async onSuspend(): Promise<void> {}
    async onResume(): Promise<void> {}
    fixedUpdate(_delta: number): void {}
    update(_delta: number): void {}
    render(_interpolation: number): void {}

    protected subscribe<T>(event: string, handler: Handler<T>): () => void {
        if (!this.eventBus) {
            console.warn(`Scene ${this.name} requested event subscription before EventBus registration.`);
            return () => {};
        }

        const off = this.eventBus.on(event, handler);
        this._subscriptions.push(off);
        return off;
    }

    private _teardownSubscriptions(): void {
        while (this._subscriptions.length) {
            const off = this._subscriptions.pop();
            if (off) {
                try {
                    off();
                } catch (error) {
                    console.error('Scene subscription teardown failed', error);
                }
            }
        }
    }
}

interface SceneStackEntry {
    name: string;
    scene: IScene;
}

export class SceneManager {
    private readonly services: ServiceLocator;
    private readonly _scenes: Map<string, IScene> = new Map();
    private readonly _sceneStack: SceneStackEntry[] = [];
    private _activeScene: IScene | null = null;
    private _activeName: string | null = null;
    private readonly eventBus: EventBus | null;

    constructor(services: ServiceLocator) {
        this.services = services;
        this.eventBus = services.optional<EventBus>('eventBus');
    }

    register(name: string, scene: IScene): void {
        if (!name || !scene) {
            throw new Error('SceneManager.register requires a name and scene instance');
        }

        if (this._scenes.has(name)) {
            throw new Error(`Scene ${name} is already registered.`);
        }

        this._scenes.set(name, scene);
    }

    has(name: string): boolean {
        return this._scenes.has(name);
    }

    async change(name: string, params?: unknown): Promise<void> {
        await this.replace(name, params);
    }

    async push(name: string, params?: unknown, options: { suspendCurrent?: boolean } = {}): Promise<void> {
        const suspendCurrent = options.suspendCurrent !== false;
        await this._push(name, params, { suspendCurrent });
    }

    async pop(params?: unknown, options: { resume?: boolean } = {}): Promise<void> {
        const resume = options.resume !== false;
        await this._pop({ params, resume });
    }

    async replace(name: string, params?: unknown, options: { resumeUnderneath?: boolean; suspendCurrent?: boolean } = {}): Promise<void> {
        const resumeUnderneath = options.resumeUnderneath ?? false;

        await this._pop({ resume: resumeUnderneath });
        await this._push(name, params, { suspendCurrent: false });
    }

    async clear(): Promise<void> {
        while (this._sceneStack.length) {
            const entry = this._sceneStack.pop();
            if (entry) {
                try {
                    await this._callIfFunction(entry.scene, 'onExit');
                } catch (error) {
                    console.error(`SceneManager: failed to exit scene during clear: ${entry.name}`, error);
                }
            }
        }

        this._setActive(null, null);
    }

    fixedUpdate(deltaSeconds: number): void {
        this._activeScene?.fixedUpdate(deltaSeconds);
    }

    update(deltaSeconds: number): void {
        this._activeScene?.update(deltaSeconds);
    }

    render(interpolation: number): void {
        this._activeScene?.render(interpolation);
    }

    getActiveScene(): IScene | null {
        return this._activeScene;
    }

    getActiveName(): string | null {
        return this._activeName;
    }

    _getScene(name: string): IScene {
        if (!this._scenes.has(name)) {
            throw new Error(`Scene ${name} is not registered.`);
        }
        return this._scenes.get(name)!;
    }

    private async _push(name: string, params?: unknown, options: { suspendCurrent?: boolean } = {}): Promise<void> {
        const scene = this._getScene(name);
        const current = this._getTopEntry();
        const shouldSuspend = options.suspendCurrent !== false;

        if (current && shouldSuspend) {
            await this._callIfFunction(current.scene, 'onSuspend');
        }

        this._sceneStack.push({ name, scene });
        this._setActive(scene, name);
        await scene.onEnter(params);
    }

    private async _pop(options: { params?: unknown; resume?: boolean } = {}): Promise<IScene | null> {
        if (!this._sceneStack.length) {
            return null;
        }

        const leaving = this._sceneStack.pop();
        if (leaving) {
            await this._callIfFunction(leaving.scene, 'onExit', options.params);
        }

        const newTop = this._getTopEntry();
        if (newTop) {
            this._setActive(newTop.scene, newTop.name);
            if (options.resume) {
                await this._callIfFunction(newTop.scene, 'onResume');
            }
        } else {
            this._setActive(null, null);
        }

        return leaving ? leaving.scene : null;
    }

    private _getTopEntry(): SceneStackEntry | null {
        if (!this._sceneStack.length) {
            return null;
        }
        return this._sceneStack[this._sceneStack.length - 1];
    }

    private _setActive(scene: IScene | null, name: string | null): void {
        this._activeScene = scene;
        this._activeName = name;
    }

    private async _callIfFunction(scene: IScene, method: keyof IScene, ...args: unknown[]): Promise<void> {
        const candidate = scene[method];
        if (typeof candidate === 'function') {
            await (candidate as (...innerArgs: unknown[]) => unknown).apply(scene, args);
        }
    }
}
