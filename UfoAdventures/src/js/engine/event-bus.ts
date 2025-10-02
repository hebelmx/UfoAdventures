export type Handler<T = any> = (payload: T) => void;

export class EventBus {
    private readonly _listeners: Map<string, Set<Handler>> = new Map();

    on<T>(event: string, handler: Handler<T>): () => void {
        if (!event || typeof handler !== 'function') {
            throw new Error('EventBus.on requires an event name and handler function');
        }

        if (!this._listeners.has(event)) {
            this._listeners.set(event, new Set());
        }

        const listeners = this._listeners.get(event)!;
        listeners.add(handler);
        return () => this.off(event, handler);
    }

    once<T>(event: string, handler: Handler<T>): () => void {
        const off = this.on<T>(event, (payload) => {
            off();
            handler(payload);
        });
        return off;
    }

    off<T>(event: string, handler: Handler<T>): void {
        if (!this._listeners.has(event)) {
            return;
        }

        const listeners = this._listeners.get(event)!;
        listeners.delete(handler);
        if (!listeners.size) {
            this._listeners.delete(event);
        }
    }

    emit<T>(event: string, payload?: T): void {
        if (!this._listeners.has(event)) {
            return;
        }

        const listeners = Array.from(this._listeners.get(event)!);
        for (const listener of listeners) {
            try {
                listener(payload);
            } catch (error) {
                console.error(`EventBus listener error for "${event}"`, error);
            }
        }
    }

    clear(event?: string): void {
        if (typeof event === 'undefined') {
            this._listeners.clear();
            return;
        }

        this._listeners.delete(event);
    }
}