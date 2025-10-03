import type * as PIXI from 'pixi.js';
import type { Entity } from './core';
import type { Vector2Like } from './components';
import type { ServiceLocator } from './service-locator';
import type { ProjectileDefinition, WeaponDefinition } from './weapon-service';

export interface EffectSpawnOptions {
    position: Vector2Like;
    lifeTime?: number;
    tint?: number;
    scale?: number | Vector2Like;
    alpha?: number;
    fade?: number;
    animation?: string;
}

export interface EffectDescriptor {
    atlas: string;
    animation?: string;
    animationSpeed?: number;
    loop?: boolean;
}

export type RuntimeEntity = Entity & {
    poolId?: string;
    lifeTime?: number;
    fadeRate?: number | null;
    damage?: number;
    projectileOwner?: 'player' | 'enemy';
    _stasisPaused?: boolean;
    _stasisStoredVelocity?: Vector2Like;
    _direction?: number;
    [key: string]: unknown;
};

export interface BehaviorSceneOptions {
    enemies?: EnemySpawningConfig;
    boss?: BossConfig;
    [key: string]: unknown;
}

export interface EnemyTemplateSpritesheet {
    alias?: string;
    animation?: string;
    speed?: number;
    [key: string]: unknown;
}

export interface EnemyTemplateDefinition {
    id?: string;
    texture?: string;
    spritesheet?: EnemyTemplateSpritesheet | null;
    spriteWidth?: number;
    spriteHeight?: number;
    colliderRadius?: number;
    health?: number;
    verticalSpeed?: number;
    behaviorTreeId?: string;
    weaponId?: string;
    weaponCooldown?: number;
    fireRate?: number;
    pattern?: string;
    amplitude?: number;
    frequency?: number;
    horizontalSpeed?: number;
    horizontalDrift?: number;
    diveSpeed?: number;
    climbSpeed?: number;
    shield?: unknown;
    [key: string]: unknown;
}

export type EnemySpawnTemplate = EnemyTemplateDefinition;

export interface EnemySpawnContext {
    position?: Vector2Like;
    altitude?: number;
    positionRatio?: number;
    [key: string]: unknown;
}

export interface EnemyWaveSpawnDefinition {
    template: string;
    count?: number;
    spread?: number;
    offset?: number;
    altitude?: number;
    positions?: number[];
}

export interface EnemyWaveDefinition {
    delay?: number;
    spawns: EnemyWaveSpawnDefinition[];
}

export interface EnemySpawningConfig {
    templates?: EnemySpawnTemplate[];
    waves?: EnemyWaveDefinition[];
    [key: string]: unknown;
}

export type BehaviorSummonTarget = string | BehaviorSummonTargetConfig;

export interface BehaviorSummonTargetConfig {
    template?: EnemyTemplateDefinition | string;
    templateId?: string;
    id?: string;
    count?: number;
    radius?: number;
    verticalRadius?: number;
    angleOffset?: number;
    offset?: Partial<Vector2Like>;
    position?: Vector2Like;
    offsetY?: number;
    [key: string]: unknown;
}

export interface BehaviorTreeBaseNode {
    type: string;
    loop?: boolean;
    [key: string]: unknown;
}

export type BehaviorTreeActionName =
    | 'setOscillation'
    | 'setSwoop'
    | 'strafe'
    | 'telegraph'
    | 'summon'
    | 'fireWeapon'
    | (string & {});

export interface BehaviorTreeSequenceNode extends BehaviorTreeBaseNode {
    type: 'sequence';
    children?: BehaviorTreeNodeDefinition[];
}

export interface BehaviorTreeWaitStep extends BehaviorTreeBaseNode {
    type: 'wait';
    duration?: number;
}

export interface BehaviorTreeActionStep extends BehaviorTreeBaseNode {
    type: 'action';
    name?: BehaviorTreeActionName;
    duration?: number;
    weaponId?: string;
    message?: string;
    effect?: EffectDescriptor | string | null;
    summon?: BehaviorSummonTarget[];
    targets?: BehaviorSummonTarget[];
    offset?: Partial<Vector2Like>;
    position?: Vector2Like;
    offsetY?: number;
    amplitude?: number;
    frequency?: number;
    speedY?: number;
    diveSpeed?: number;
    climbSpeed?: number;
    vertical?: number;
    horizontalDrift?: number;
    horizontalSpeed?: number;
    speed?: number;
    tint?: number;
    scale?: number | Vector2Like;
    alpha?: number;
    telegrapheffect?: EffectDescriptor | string | null;
    telegraphDuration?: number;
    telegraphTint?: number;
    telegraphScale?: number | Vector2Like;
    telegraphPosition?: Vector2Like | null;
    telegraphOffsetY?: number;
    telegraphAlpha?: number;
    spiralOffset?: number;
    fireRate?: number;
    [key: string]: unknown;
}

export type BehaviorTreeNodeDefinition = BehaviorTreeSequenceNode | BehaviorTreeActionStep | BehaviorTreeWaitStep;

export interface BossPhaseDefinition {
    threshold?: number;
    message?: string;
    pattern?: string;
    horizontalSpeed?: number;
    verticalDrift?: number;
    fireRate?: number;
    behaviorTreeId?: string;
    weaponId?: string;
    telegrapheffect?: EffectDescriptor | string | null;
    telegraphDuration?: number;
    telegraphTint?: number;
    telegraphScale?: number | Vector2Like;
    telegraphPosition?: Vector2Like | null;
    telegraphOffsetY?: number;
    telegraphAlpha?: number;
    summon?: BehaviorSummonTarget[];
    vulnerabilityWindow?: number;
    spiralOffset?: number;
    [key: string]: unknown;
}

export interface BossConfig {
    behaviorTreeId?: string;
    weaponId?: string;
    phases?: BossPhaseDefinition[];
    [key: string]: unknown;
}

export interface BossTelegraphOptions {
    message?: string | null;\n    effect?: EffectDescriptor | string | null;
    duration?: number;
    tint?: number;
    scale?: number | Vector2Like;
    position?: Vector2Like | null;
    offsetY?: number;
    alpha?: number;
}

export interface ProjectileSpawnOptions {
    type: 'player' | 'enemy';
    position: Vector2Like;
    velocity: Vector2Like;
    tint?: number;
    scale?: number | Vector2Like;
    damage?: number;
}

export type ProjectileSpawnPayload = ProjectileSpawnOptions & Record<string, unknown>;

export type WeaponProjectileConfig = ProjectileDefinition & {
    offset?: Partial<Vector2Like>;
    dx?: number;
    dy?: number;
    angle?: number;
    scale?: number | Vector2Like;
    tint?: number;
};

export interface WeaponBeamDefinition {
    duration?: number;
    damage?: number;
    tint?: number;
    width?: number;
}

export type WeaponDefinitionWithExtras = WeaponDefinition & {
    projectiles?: WeaponProjectileConfig[];
    beam?: WeaponBeamDefinition | null;
};

export interface ProjectileVelocity {
    vx: number;
    vy: number;
}

export interface RuntimeGameContext {
    app: PIXI.Application;
    entities?: RuntimeEntity[];
    addEntity(entity: Entity): void;
    releaseEntity?(entity: Entity, index?: number): void;
}

export interface AbilityGameContext extends RuntimeGameContext {
    spawnEffect?(options: EffectSpawnOptions): Entity | null | void;
}

export interface BehaviorTreeGameContext extends RuntimeGameContext {
    sceneOptions?: BehaviorSceneOptions;
    mode?: string;
    services?: ServiceLocator;
    spawnEffect(options: EffectSpawnOptions): Entity | null | void;
    spawnEnemyFromTemplate(template: EnemySpawnTemplate, context?: EnemySpawnContext): Entity | null;
}

export interface CombatGameContext extends BehaviorTreeGameContext {
    spawnProjectile(options: ProjectileSpawnPayload): Entity | null;
}

