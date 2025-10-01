class EventBus {
    constructor() {
        this._listeners = new Map();
    }

    on(event, handler) {
        if (!event || typeof handler !== 'function') {
            throw new Error('EventBus.on requires an event name and handler function');
        }

        if (!this._listeners.has(event)) {
            this._listeners.set(event, new Set());
        }

        const listeners = this._listeners.get(event);
        listeners.add(handler);
        return () => this.off(event, handler);
    }

    once(event, handler) {
        const off = this.on(event, (payload) => {
            off();
            handler(payload);
        });
        return off;
    }

    off(event, handler) {
        if (!this._listeners.has(event)) {
            return;
        }

        const listeners = this._listeners.get(event);
        listeners.delete(handler);
        if (!listeners.size) {
            this._listeners.delete(event);
        }
    }

    emit(event, payload) {
        if (!this._listeners.has(event)) {
            return;
        }

        const listeners = Array.from(this._listeners.get(event));
        for (const listener of listeners) {
            try {
                listener(payload);
            } catch (error) {
                console.error('EventBus listener error for', event, error);
            }
        }
    }

    clear(event) {
        if (typeof event === 'undefined') {
            this._listeners.clear();
            return;
        }

        this._listeners.delete(event);
    }
}
