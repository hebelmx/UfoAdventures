import { EventBus } from './event-bus';

export interface ActionState {
    active: boolean;
    lastKey: string | null;
    timestamp: number;
}

export interface AxisBinding {
    positive: Set<string>;
    negative: Set<string>;
}

export interface InputConfig {
    actions?: { [key: string]: string | string[] };
    axes?: { name: string, positive: string | string[], negative: string | string[] }[];
}

export class InputService {
    private readonly eventBus: EventBus | null;
    private _actionBindings: Map<string, Set<string>> = new Map();
    private _keyBindings: Map<string, Set<string>> = new Map();
    private _axisBindings: Map<string, AxisBinding> = new Map();
    private _actionState: Map<string, ActionState> = new Map();
    private _enabled = false;

    constructor(eventBus: EventBus | null) {
        this.eventBus = eventBus;

        this._handleKeyDown = this._handleKeyDown.bind(this);
        this._handleKeyUp = this._handleKeyUp.bind(this);
        this._handleBlur = this._handleBlur.bind(this);
        this._handleKeyPress = this._handleKeyPress.bind(this);
        this._handleMouseDown = this._handleMouseDown.bind(this);
        this._handleMouseUp = this._handleMouseUp.bind(this);

        window.addEventListener('keydown', this._handleKeyDown);
        window.addEventListener('keyup', this._handleKeyUp);
        window.addEventListener('blur', this._handleBlur);
        window.addEventListener('keypress', this._handleKeyPress, { capture: true });
        window.addEventListener('mousedown', this._handleMouseDown);
        window.addEventListener('mouseup', this._handleMouseUp);
        window.addEventListener('contextmenu', (e) => { try { e.preventDefault(); } catch(_) {} });
    }

    configure(config: InputConfig = {}): void {
        const actions = config.actions || {};
        const axes = Array.isArray(config.axes) ? config.axes : [];

        this._actionBindings.clear();
        this._keyBindings.clear();
        this._axisBindings.clear();
        this._actionState.clear();

        Object.keys(actions).forEach(actionName => {
            const keys = Array.isArray(actions[actionName]) ? actions[actionName] : [actions[actionName] as string];
            const normalizedKeys = keys.filter(Boolean);
            this._actionBindings.set(actionName, new Set(normalizedKeys));
            this._actionState.set(actionName, { active: false, lastKey: null, timestamp: 0 });

            normalizedKeys.forEach(keyCode => {
                if (!this._keyBindings.has(keyCode)) {
                    this._keyBindings.set(keyCode, new Set());
                }
                this._keyBindings.get(keyCode)!.add(actionName);
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

    registerCommand(action: string, handler: (payload: any) => void, options: { trigger?: 'up' | 'down' } = {}): () => void {
        if (!this.eventBus) {
            console.warn('InputService.registerCommand called without an EventBus');
            return () => {};
        }

        const trigger = options.trigger === 'up' ? 'up' : 'down';
        const eventName = this._eventName(action, trigger);
        return this.eventBus.on(eventName, handler);
    }

    unregisterCommand(off: () => void): void {
        if (typeof off === 'function') {
            off();
        }
    }

    isActionActive(action: string): boolean {
        const state = this._actionState.get(action);
        return !!(state && state.active);
    }

    getActionState(action: string): ActionState {
        return this._actionState.get(action) || { active: false, lastKey: null, timestamp: 0 };
    }

    getAxisValue(name: string): number {
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

        return Math.max(-1, Math.min(1, value));
    }

    enable(): void {
        if (this._enabled) {
            return;
        }
        this._enabled = true;
    }

    disable(): void {
        if (!this._enabled) {
            return;
        }
        this._enabled = false;
        this.reset();
    }

    reset(): void {
        this._actionState.forEach((state, action) => {
            if (state.active) {
                state.active = false;
                state.lastKey = null;
                state.timestamp = performance.now();
                this._emitAction(action, 'up', null, null);
            }
        });
    }

    destroy(): void {
        this.disable();
        window.removeEventListener('keydown', this._handleKeyDown);
        window.removeEventListener('keyup', this._handleKeyUp);
        window.removeEventListener('blur', this._handleBlur);
        window.removeEventListener('keypress', this._handleKeyPress, { capture: true });
        window.removeEventListener('mousedown', this._handleMouseDown);
        window.removeEventListener('mouseup', this._handleMouseUp);
        this._actionBindings.clear();
        this._keyBindings.clear();
        this._axisBindings.clear();
        this._actionState.clear();
    }

    private _normalizeActionList(actions: string | string[] | undefined): Set<string> {
        if (!actions) {
            return new Set();
        }
        if (!Array.isArray(actions)) {
            return new Set([actions]);
        }
        return new Set(actions.filter(Boolean));
    }

    private _handleKeyDown(event: KeyboardEvent): void {
        if (!this._enabled) {
            return;
        }

        const actions = this._keyBindings.get(event.code);
        if (!actions || !actions.size) {
            return;
        }

        const timestamp = performance.now();
        try { event.preventDefault(); } catch (e) {}
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

    private _handleKeyUp(event: KeyboardEvent): void {
        if (!this._enabled) {
            return;
        }

        const actions = this._keyBindings.get(event.code);
        if (!actions || !actions.size) {
            return;
        }

        const timestamp = performance.now();
        try { event.preventDefault(); } catch (e) {}
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

    private _handleKeyPress(event: KeyboardEvent): void {
        if (!this._enabled) {
            return;
        }

        const actions = this._keyBindings.get(event.code);
        if (actions && actions.size) {
            try { event.preventDefault(); } catch (e) {}
        }
    }

    private _mouseCode(button: number): string {
        switch (button) {
            case 0: return 'MouseLeft';
            case 1: return 'MouseMiddle';
            case 2: return 'MouseRight';
            default: return `Mouse${button}`;
        }
    }

    private _handleMouseDown(event: MouseEvent): void {
        if (!this._enabled) {
            return;
        }
        const code = this._mouseCode(event.button);
        const actions = this._keyBindings.get(code);
        if (!actions || !actions.size) {
            return;
        }
        const timestamp = performance.now();
        try { event.preventDefault(); } catch (e) {}
        actions.forEach(action => {
            const state = this._actionState.get(action);
            if (state && !state.active) {
                state.active = true;
                state.lastKey = code;
                state.timestamp = timestamp;
                this._emitAction(action, 'down', code, event);
            }
        });
    }

    private _handleMouseUp(event: MouseEvent): void {
        if (!this._enabled) {
            return;
        }
        const code = this._mouseCode(event.button);
        const actions = this._keyBindings.get(code);
        if (!actions || !actions.size) {
            return;
        }
        const timestamp = performance.now();
        try { event.preventDefault(); } catch (e) {}
        actions.forEach(action => {
            const state = this._actionState.get(action);
            if (state && state.active) {
                state.active = false;
                state.lastKey = code;
                state.timestamp = timestamp;
                this._emitAction(action, 'up', code, event);
            }
        });
    }

    private _handleBlur(): void {
        this.reset();
    }

    private _emitAction(action: string, trigger: 'up' | 'down', keyCode: string | null, originalEvent: Event | null): void {
        if (!this.eventBus) {
            return;
        }

        const payload = {
            action,
            trigger,
            keyCode,
            originalEvent,
        };
        this.eventBus.emit(this._eventName(action, trigger), payload);
        this.eventBus.emit(this._eventName('any', trigger), payload);
    }

    private _eventName(action: string, trigger: 'up' | 'down'): string {
        return `input:${action}:${trigger}`;
    }
}