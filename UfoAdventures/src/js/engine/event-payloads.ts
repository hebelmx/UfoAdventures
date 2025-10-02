import type { Entity } from './core';
import type { BehaviorSceneOptions } from './combat-types';
import type { RunSummary } from './mission-service';

export type CombatDamageSource = 'projectile' | 'collision';
export type CombatTargetType = 'player' | 'boss' | 'enemy' | null;

export interface CombatDamageEvent {
    target: Entity;
    source: Entity | null;
    amount: number;
    targetType: CombatTargetType;
    remainingHealth?: number;
    damageSource: CombatDamageSource;
}

export interface CombatProjectileFiredEvent {
    origin: Entity;
    projectile: Entity;
    source: 'player' | 'enemy';
    beam?: boolean;
}

export interface GameResultsRequest {
    outcome: string;
    reason?: string | null;
    mode?: string | null;
    options?: BehaviorSceneOptions | null;
    details?: unknown;
    missionId?: string | null;
    summary?: RunSummary | null;
}

export interface ShieldHitEvent {
    absorbed: number;
    remainingStrength: number;
    broke: boolean;
}
