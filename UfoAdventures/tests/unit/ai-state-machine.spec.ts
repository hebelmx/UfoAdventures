import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StateMachine, IAIBrain } from '../../src/js/engine/ai-state-machine';
import { ConfigService } from '../../src/js/engine/config-service'; // Import ConfigService

describe('StateMachine', () => {
    let mockPatrolState: IAIBrain;
    let mockChaseState: IAIBrain;
    let mockAttackState: IAIBrain;
    let stateMachine: StateMachine<string>;
    let mockConfigService: ConfigService; // Mock ConfigService

    beforeEach(() => {
        mockPatrolState = {
            onEnter: vi.fn(),
            onExit: vi.fn(),
            onUpdate: vi.fn(),
        };
        mockChaseState = {
            onEnter: vi.fn(),
            onExit: vi.fn(),
            onUpdate: vi.fn(),
        };
        mockAttackState = {
            onEnter: vi.fn(),
            onExit: vi.fn(),
            onUpdate: vi.fn(),
        };

        const states = new Map<string, IAIBrain>();
        states.set('patrol', mockPatrolState);
        states.set('chase', mockChaseState);
        states.set('attack', mockAttackState);

        mockConfigService = {
            get: vi.fn((key: string) => {
                if (key === 'debug.aiStateMachine') {
                    return true; // Enable debug logging for tests
                }
                return undefined;
            }),
        } as unknown as ConfigService;

        stateMachine = new StateMachine(states, mockConfigService); // Pass mockConfigService
    });

    it('should transition to a new state and call onEnter', () => {
        const params = { entityId: 123 };
        stateMachine.transitionTo('patrol', params);

        expect(stateMachine.currentState).toBe('patrol');
        expect(mockPatrolState.onEnter).toHaveBeenCalledWith(params);
        expect(mockPatrolState.onExit).not.toHaveBeenCalled();
        expect(mockChaseState.onEnter).not.toHaveBeenCalled();
    });

    it('should call onExit on the old state and onEnter on the new state during transition', () => {
        stateMachine.transitionTo('patrol');
        expect(mockPatrolState.onEnter).toHaveBeenCalledTimes(1);

        stateMachine.transitionTo('chase');

        expect(stateMachine.currentState).toBe('chase');
        expect(mockPatrolState.onExit).toHaveBeenCalledTimes(1);
        expect(mockChaseState.onEnter).toHaveBeenCalledTimes(1);
    });

    it('should call onUpdate on the current state', () => {
        stateMachine.transitionTo('patrol');
        const delta = 0.5;
        stateMachine.update(delta);

        expect(mockPatrolState.onUpdate).toHaveBeenCalledWith(delta);
        expect(mockChaseState.onUpdate).not.toHaveBeenCalled();
    });

    it('should reset the state machine', () => {
        stateMachine.transitionTo('patrol');
        stateMachine.reset();

        expect(stateMachine.currentState).toBeNull();
        expect(mockPatrolState.onExit).toHaveBeenCalledTimes(1);
    });

    it('should not transition to an unregistered state', () => {
        const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        stateMachine.transitionTo('unregistered');

        expect(stateMachine.currentState).toBeNull();
        expect(consoleWarnSpy).toHaveBeenCalledWith('StateMachine: Attempted to transition to unregistered state: unregistered');
        consoleWarnSpy.mockRestore();
    });
});