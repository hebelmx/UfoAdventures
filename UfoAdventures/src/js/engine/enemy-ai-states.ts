
import type { IAIBrain } from './ai-state-machine';
import type { Entity } from './core';
import { Motion, Transform, Player, getComponentOrNull, EnemyBehavior } from './components';

export class PatrolState implements IAIBrain {
    private _entity: Entity | null = null;

    onEnter(params?: { entity: Entity }): void {
        if (params?.entity) {
            this._entity = params.entity;
            const motion = getComponentOrNull(this._entity, Motion);
            const behavior = getComponentOrNull(this._entity, EnemyBehavior);
            if (motion && behavior) {
                motion.velocity.x = behavior.horizontalSpeed * behavior.direction;
                motion.velocity.y = behavior.verticalSpeed;
            }
        }
    }

    onExit(): void {
        this._entity = null;
    }

    onUpdate(delta: number): void {
        // Patrol logic here, e.g., change direction if boundary reached
    }
}

export class ChaseState implements IAIBrain {
    private _entity: Entity | null = null;

    onEnter(params?: { entity: Entity }): void {
        if (params?.entity) {
            this._entity = params.entity;
        }
    }

    onExit(): void {
        this._entity = null;
    }

    onUpdate(delta: number): void {
        if (!this._entity) {
            return;
        }

        const motion = getComponentOrNull(this._entity, Motion);
        const transform = getComponentOrNull(this._entity, Transform);
        const behavior = getComponentOrNull(this._entity, EnemyBehavior);
        const player = this._entity.world?.find(e => e.hasComponent(Player));

        if (motion && transform && behavior && player) {
            const playerTransform = getComponentOrNull(player, Transform);
            if (playerTransform) {
                const directionX = playerTransform.position.x - transform.position.x;
                const directionY = playerTransform.position.y - transform.position.y;
                const magnitude = Math.sqrt(directionX * directionX + directionY * directionY);

                if (magnitude > 0) {
                    motion.velocity.x = (directionX / magnitude) * behavior.horizontalSpeed;
                    motion.velocity.y = (directionY / magnitude) * behavior.diveSpeed;
                }
            }
        }
    }
}

export class AttackState implements IAIBrain {
    private _entity: Entity | null = null;

    onEnter(params?: { entity: Entity }): void {
        if (params?.entity) {
            this._entity = params.entity;
        }
    }

    onExit(): void {
        this._entity = null;
    }

    onUpdate(delta: number): void {
        // Attack logic here, e.g., fire weapon, special abilities
    }
}
