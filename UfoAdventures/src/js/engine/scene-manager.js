class Scene {
    constructor(name, services) {
        this.name = name;
        this.services = services;
        this.eventBus = null;
        this._subscriptions = [];

        try {
            this.eventBus = services?.resolve ? services.resolve('eventBus') : null;
        } catch (error) {
            this.eventBus = null;
        }
    }

    async onEnter() {}

    async onExit() {
        this._teardownSubscriptions();
    }

    async onSuspend() {}

    async onResume() {}

    fixedUpdate() {}

    update() {}

    render() {}

    subscribe(event, handler) {
        if (!this.eventBus) {
            console.warn('Scene', this.name, 'requested event subscription before EventBus registration.');
            return () => {};
        }

        const off = this.eventBus.on(event, handler);
        this._subscriptions.push(off);
        return off;
    }

    _teardownSubscriptions() {
        while (this._subscriptions.length) {
            const off = this._subscriptions.pop();
            try {
                off();
            } catch (error) {
                console.error('Scene subscription teardown failed', error);
            }
        }
    }
}

class SceneManager {
    constructor(services) {
        this.services = services;
        this._scenes = new Map();
        this._sceneStack = [];
        this._activeScene = null;
        this._activeName = null;
        this.eventBus = null;

        try {
            this.eventBus = services?.resolve ? services.resolve('eventBus') : null;
        } catch (error) {
            this.eventBus = null;
        }
    }

    register(name, scene) {
        if (!name || !scene) {
            throw new Error('SceneManager.register requires a name and scene instance');
        }

        if (this._scenes.has(name)) {
            throw new Error('Scene ' + name + ' is already registered.');
        }

        this._scenes.set(name, scene);
    }

    has(name) {
        return this._scenes.has(name);
    }

    async change(name, params) {
        return this.replace(name, params);
    }

    async push(name, params, options = {}) {
        const suspendCurrent = options.suspendCurrent !== false;
        await this._push(name, params, { suspendCurrent });
    }

    async pop(params, options = {}) {
        const resume = options.resume !== false;
        await this._pop({ params, resume });
    }

    async replace(name, params, options = {}) {
        const resumeUnderneath = options.resumeUnderneath ?? false;
        const suspendCurrent = options.suspendCurrent !== false;

        await this._pop({ resume: resumeUnderneath });
        await this._push(name, params, { suspendCurrent });
    }

    fixedUpdate(deltaSeconds) {
        if (this._activeScene && typeof this._activeScene.fixedUpdate === 'function') {
            this._activeScene.fixedUpdate(deltaSeconds);
        }
    }

    update(deltaSeconds) {
        if (this._activeScene && typeof this._activeScene.update === 'function') {
            this._activeScene.update(deltaSeconds);
        }
    }

    render(interpolation) {
        if (this._activeScene && typeof this._activeScene.render === 'function') {
            this._activeScene.render(interpolation);
        }
    }

    getActiveScene() {
        return this._activeScene;
    }

    getActiveName() {
        return this._activeName;
    }

    async _push(name, params, options = {}) {
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

    async _pop({ params, resume = true } = {}) {
        if (!this._sceneStack.length) {
            return null;
        }

        const leaving = this._sceneStack.pop();
        await this._callIfFunction(leaving.scene, 'onExit', params);

        const newTop = this._getTopEntry();
        if (newTop) {
            this._setActive(newTop.scene, newTop.name);
            if (resume) {
                await this._callIfFunction(newTop.scene, 'onResume');
            }
        } else {
            this._setActive(null, null);
        }

        return leaving.scene;
    }

    _getScene(name) {
        if (!this._scenes.has(name)) {
            throw new Error('Scene ' + name + ' is not registered.');
        }
        return this._scenes.get(name);
    }

    _getTopEntry() {
        if (!this._sceneStack.length) {
            return null;
        }
        return this._sceneStack[this._sceneStack.length - 1];
    }

    _setActive(scene, name) {
        this._activeScene = scene;
        this._activeName = name;
    }

    async _callIfFunction(scene, method, ...args) {
        if (scene && typeof scene[method] === 'function') {
            await scene[method](...args);
        }
    }
}
