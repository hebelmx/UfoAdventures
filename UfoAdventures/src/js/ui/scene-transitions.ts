import type { SceneManager } from '../engine/scene-manager';

export interface SceneTransitionOptions {
    elementId?: string;
    fadeInDuration?: number;
    fadeOutDuration?: number;
}

type TransitionMethod = 'replace' | 'push' | 'pop';

type SceneManagerMethod = (...args: unknown[]) => unknown;

type ManagerMethod<M extends TransitionMethod> = SceneManager[M];

type MethodParameters<M extends TransitionMethod> = ManagerMethod<M> extends (...args: infer P) => unknown ? P : never;

type MethodReturn<M extends TransitionMethod> = ManagerMethod<M> extends (...args: unknown[]) => infer R ? R : never;

export class SceneTransitions {
    readonly elementId: string;
    readonly fadeInDuration: number;
    readonly fadeOutDuration: number;
    private _sceneManager: SceneManager | null = null;
    private _queue: Promise<unknown> = Promise.resolve();
    private readonly _wrappedMethods = new Set<TransitionMethod>();
    private _running = false;
    private readonly _originalMethods: Map<TransitionMethod, SceneManagerMethod> = new Map();
    private _isActive = false;

    constructor(options: SceneTransitionOptions = {}) {
        this.elementId = options.elementId || 'sceneTransition';
        this.fadeInDuration = SceneTransitions._sanitizeDuration(options.fadeInDuration, 240);
        this.fadeOutDuration = SceneTransitions._sanitizeDuration(options.fadeOutDuration, 180);
    }

    attach(sceneManager: SceneManager | null): void {
        if (!sceneManager || this._sceneManager === sceneManager) {
            return;
        }

        this.detach();

        this._sceneManager = sceneManager;
        (['replace', 'push', 'pop'] as TransitionMethod[]).forEach(method => this._wrapMethod(sceneManager, method));

        const mask = this._getElement();
        if (mask) {
            mask.classList.remove('scene-transition--visible');
            mask.style.pointerEvents = 'none';
            mask.style.opacity = '0';
        }
    }

    isActive(): boolean {
        return this._isActive;
    }

    detach(): void {
        if (!this._sceneManager) {
            this._wrappedMethods.clear();
            this._originalMethods.clear();
            return;
        }

        (['replace', 'push', 'pop'] as TransitionMethod[]).forEach(method => {
            const original = this._originalMethods.get(method);
            if (original) {
                (this._sceneManager as unknown as Record<string, SceneManagerMethod>)[method] = original;
            }
        });

        this._wrappedMethods.clear();
        this._originalMethods.clear();
        this._sceneManager = null;
    }

    private _wrapMethod<M extends TransitionMethod>(manager: SceneManager, method: M): void {
        if (typeof manager[method] !== 'function' || this._wrappedMethods.has(method)) {
            return;
        }

        const managerProxy = manager as unknown as Record<TransitionMethod, SceneManagerMethod>;
        const originalMethod = managerProxy[method];
        if (!originalMethod) {
            return;
        }
        const wrapped: SceneManagerMethod = (...args: unknown[]) => {
            const run = originalMethod.bind(manager) as (...innerArgs: unknown[]) => unknown;
            return this._enqueue(() => run(...args));
        };

        this._originalMethods.set(method, originalMethod);
        managerProxy[method] = wrapped;
        this._wrappedMethods.add(method);

    }

    private _enqueue<T>(action: () => Promise<T> | T): Promise<T> {
        if (this._running) {
            try {
                const direct = action();
                return direct instanceof Promise ? direct : Promise.resolve(direct);
            } catch (error) {
                return Promise.reject(error);
            }
        }

        const next = this._queue.then(() => this._run(action));
        this._queue = next.then(
            () => undefined,
            () => undefined
        );
        return next;
    }

    private async _run<T>(action: () => Promise<T> | T): Promise<T> {
        const mask = this._getElement();
        if (!mask) {
            return action();
        }

        this._running = true;
        await this._activate(mask);
        try {
            const result = await action();
            await this._deactivate(mask);
            return result;
        } catch (error) {
            await this._deactivate(mask);
            throw error;
        } finally {
            this._running = false;
        }
    }

    private async _activate(mask: HTMLElement): Promise<void> {
        this._isActive = true;
        mask.classList.add('scene-transition--visible');
        if (this.fadeInDuration > 0) {
            await this._delay(this.fadeInDuration);
        }
    }

    private async _deactivate(mask: HTMLElement): Promise<void> {
        mask.classList.remove('scene-transition--visible');
        if (this.fadeOutDuration > 0) {
            await this._delay(this.fadeOutDuration);
        }
        this._isActive = false;
    }

    private _getElement(): HTMLElement | null {
        if (typeof document === 'undefined') {
            return null;
        }
        return document.getElementById(this.elementId);
    }

    private _delay(ms: number): Promise<void> {
        if (!Number.isFinite(ms) || ms <= 0) {
            return Promise.resolve();
        }
        return new Promise(resolve => {
            setTimeout(resolve, ms);
        });
    }

    private static _sanitizeDuration(value: number | undefined, fallback: number): number {
        if (!Number.isFinite(value) || value === undefined) {
            return fallback;
        }
        return Math.max(0, value);
    }
}
