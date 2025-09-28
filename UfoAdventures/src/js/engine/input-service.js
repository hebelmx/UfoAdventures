class InputService {
    constructor(eventBus) {
        this.eventBus = eventBus || null;
        this._actionBindings = new Map();
        this._keyBindings = new Map();
        this._axisBindings = new Map();
        this._actionState = new Map();

        this._handleKeyDown = this._handleKeyDown.bind(this);
        this._handleKeyUp = this._handleKeyUp.bind(this);
        this._handleBlur = this._handleBlur.bind(this);

        window.addEventListener('keydown', this._handleKeyDown);
        window.addEventListener('keyup', this._handleKeyUp);
        window.addEventListener('blur', this._handleBlur);
    }

    configure(config = {}) {
        const actions = config.actions || {};
        const axes = Array.isArray(config.axes) ? config.axes : [];

        this._actionBindings.clear();
        this._keyBindings.clear();
        this._axisBindings.clear();
        this._actionState.clear();

        Object.keys(actions).forEach(actionName => {
            const keys = Array.isArray(actions[actionName]) ? actions[actionName] : [actions[actionName]];
            const normalizedKeys = keys.filter(Boolean);
            this._actionBindings.set(actionName, new Set(normalizedKeys));
            this._actionState.set(actionName, { active: false, lastKey: null, timestamp: 0 });

            normalizedKeys.forEach(keyCode => {
                if (!this._keyBindings.has(keyCode)) {
                    this._keyBindings.set(keyCode, new Set());
                }
                this._keyBindings.get(keyCode).add(actionName);
            });
        });

        axes.forEach(axisConfig => {
            if (!axisConfig || !axisConfig.name) {
                return;
            }

            const positive = this._normalizeActionList(axisConfig.positive);
            const negative = this._normalizeActionList(axisConfig.negative);
            this._axisBindings.set(axisConfig.name, { positive, negative });
        });
    }

    registerCommand(action, handler, options = {}) {
        if (!this.eventBus) {
            console.warn('InputService.registerCommand called without an EventBus');
            return () => {};
        }

        const trigger = options.trigger === 'up' ? 'up' : 'down';
        const eventName = this._eventName(action, trigger);
        return this.eventBus.on(eventName, handler);
    }

    unregisterCommand(off) {
        if (typeof off === 'function') {
            off();
        }
    }

    isActionActive(action) {
        const state = this._actionState.get(action);
        return !!(state && state.active);
    }

    getActionState(action) {
        return this._actionState.get(action) || { active: false, lastKey: null, timestamp: 0 };
    }

    getAxisValue(name) {
        const axis = this._axisBindings.get(name);
        if (!axis) {
            return 0;
        }

        let value = 0;
        axis.positive.forEach(action => {
            if (this.isActionActive(action)) {
                value += 1;
            }
        });
        axis.negative.forEach(action => {
            if (this.isActionActive(action)) {
                value -= 1;
            }
        });

        if (value > 1) {
            value = 1;
        } else if (value < -1) {
            value = -1;
        }

        return value;
    }

    reset() {
        this._actionState.forEach((state, action) => {
            if (state.active) {
                state.active = false;
                state.lastKey = null;
                state.timestamp = performance.now();
                this._emitAction(action, 'up', null, null);
            }
        });
    }

    destroy() {
        window.removeEventListener('keydown', this._handleKeyDown);
        window.removeEventListener('keyup', this._handleKeyUp);
        window.removeEventListener('blur', this._handleBlur);
        this._actionBindings.clear();
        this._keyBindings.clear();
        this._axisBindings.clear();
        this._actionState.clear();
    }

    _normalizeActionList(actions) {
        if (!actions) {
            return new Set();
        }
        if (!Array.isArray(actions)) {
            return new Set([actions]);
        }
        return new Set(actions.filter(Boolean));
    }

    _handleKeyDown(event) {
        const actions = this._keyBindings.get(event.code);
        if (!actions || !actions.size) {
            return;
        }

        const timestamp = performance.now();
        actions.forEach(action => {
            const state = this._actionState.get(action);
            if (state && !state.active) {
                state.active = true;
                state.lastKey = event.code;
                state.timestamp = timestamp;
                this._emitAction(action, 'down', event.code, event);
            }
        });
    }

    _handleKeyUp(event) {
        const actions = this._keyBindings.get(event.code);
        if (!actions || !actions.size) {
            return;
        }

        const timestamp = performance.now();
        actions.forEach(action => {
            const state = this._actionState.get(action);
            if (state && state.active) {
                state.active = false;
                state.lastKey = event.code;
                state.timestamp = timestamp;
                this._emitAction(action, 'up', event.code, event);
            }
        });
    }

    _handleBlur() {
        this.reset();
    }

    _emitAction(action, trigger, keyCode, originalEvent) {
        if (!this.eventBus) {
            return;
        }

        const payload = {
            action,
            trigger,
            keyCode: keyCode || null,
            originalEvent: originalEvent || null,
        };
        this.eventBus.emit(this._eventName(action, trigger), payload);
        this.eventBus.emit(this._eventName('any', trigger), payload);
    }

    _eventName(action, trigger) {
        return 'input:' + action + ':' + trigger;
    }
}
