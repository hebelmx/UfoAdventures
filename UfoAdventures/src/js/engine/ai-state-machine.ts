
import { ConfigService } from './config-service';

export interface IAIBrain {
    onEnter(params?: unknown): void;
    onExit(): void;
    onUpdate(delta: number): void;
}

export class StateMachine<T extends string> {
    private _currentState: T | null = null;
    private readonly _states: Map<T, IAIBrain>;
    private readonly _debugLoggingEnabled: boolean;

    constructor(states: Map<T, IAIBrain>, configService?: ConfigService) {
        this._states = states;
        this._debugLoggingEnabled = configService?.get('debug.aiStateMachine') ?? false;
    }

    public get currentState(): T | null {
        return this._currentState;
    }

    public transitionTo(newState: T, params?: unknown): void {
        if (!this._states.has(newState)) {
            if (this._debugLoggingEnabled) {
                console.warn(`StateMachine: Attempted to transition to unregistered state: ${newState}`);
            }
            return;
        }

        if (this._debugLoggingEnabled) {
            console.log(`StateMachine: Transitioning from ${this._currentState ?? 'null'} to ${newState}`);
        }

        if (this._currentState) {
            this._states.get(this._currentState)?.onExit();
        }

        this._currentState = newState;
        this._states.get(this._currentState)?.onEnter(params);
    }

    public update(delta: number): void {
        if (this._currentState) {
            this._states.get(this._currentState)?.onUpdate(delta);
        }
    }

    public reset(): void {
        if (this._currentState) {
            this._states.get(this._currentState)?.onExit();
        }
        this._currentState = null;
    }
}
