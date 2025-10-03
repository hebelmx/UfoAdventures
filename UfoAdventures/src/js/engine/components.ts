import * as PIXI from 'pixi.js';
import { Component, ComponentConstructor, Entity } from './core';
import type { BossPhaseDefinition } from './combat-types';
export type { BossPhaseDefinition } from './combat-types';

type ComponentCtor<T extends Component = Component> = ComponentConstructor<T>;
type ComponentTuple<Ctors extends readonly ComponentCtor[]> = {
    [Index in keyof Ctors]: Ctors[Index] extends ComponentCtor<infer Instance> ? Instance : never;
};
type EntityWithComponents<Ctors extends readonly ComponentCtor[]> = Entity & {
    getComponent<Ctor extends Ctors[number]>(ctor: Ctor): InstanceType<Ctor>;
};

export function entityHasComponents<const Ctors extends readonly ComponentCtor[]>(
    entity: Entity,
    ...ctors: Ctors
): entity is EntityWithComponents<Ctors> {
    return ctors.every(ctor => entity.hasComponent(ctor));
}

export function getComponentOrNull<T extends Component>(
    entity: Entity,
    ctor: ComponentCtor<T>
): T | null {
    return entity.getComponent(ctor) ?? null;
}

export function getComponents<const Ctors extends readonly ComponentCtor[]>(
    entity: Entity,
    ...ctors: Ctors
): ComponentTuple<Ctors> | null {
    const instances: Component[] = [];
    for (const ctor of ctors) {
        const instance = entity.getComponent(ctor);
        if (!instance) {
            return null;
        }
        instances.push(instance);
    }
    return instances as ComponentTuple<Ctors>;
}

export function requireComponents<const Ctors extends readonly ComponentCtor[]>(
    entity: Entity,
    ...ctors: Ctors
): ComponentTuple<Ctors> {
    const components = getComponents(entity, ...ctors);
    if (!components) {
        const missing = ctors.map(ctor => ctor.name || 'Component').join(', ');
        throw new Error(`Entity is missing required components: ${missing}`);
    }
    return components;
}

export interface Vector2Like {
    x: number;
    y: number;
}

export class Transform extends Component {
    position: Vector2Like;
    rotation: number;
    scale: Vector2Like;

    constructor(position: Vector2Like = { x: 0, y: 0 }, rotation = 0, scale: Vector2Like = { x: 1, y: 1 }) {
        super();
        this.position = { ...position };
        this.rotation = rotation;
        this.scale = { ...scale };
    }
}

export class Sprite extends Component {
    sprite: PIXI.Sprite | PIXI.AnimatedSprite;

    constructor(input?: PIXI.Sprite | PIXI.AnimatedSprite | PIXI.Texture | string) {
        super();
        if (input instanceof PIXI.Sprite || input instanceof PIXI.AnimatedSprite) {
            this.sprite = input;
        } else if (typeof input === "string") {
            const texture = PIXI.Texture.from(input);
            this.sprite = new PIXI.Sprite(texture);
        } else {
            const texture = (input as PIXI.Texture) ?? PIXI.Texture.WHITE;
            this.sprite = new PIXI.Sprite(texture);
        }

        const sprite = this.sprite as PIXI.Sprite;
        const anchor = sprite.anchor as PIXI.ObservablePoint | PIXI.Point | undefined;
        if (anchor && typeof anchor.set === 'function') {
            anchor.set(0.5);
        } else if (anchor) {
            anchor.x = anchor.x ?? 0.5;
            anchor.y = anchor.y ?? 0.5;
        }
    }
}

export class Motion extends Component {
    velocity: Vector2Like;
    speed: number;

    constructor(velocity: Vector2Like = { x: 0, y: 0 }, speed = 5) {
        super();
        this.velocity = { ...velocity };
        this.speed = speed;
    }
}

export class Enemy extends Component {}

export interface BehaviorTreeStep {
    type?: string;
    duration?: number;
    [key: string]: unknown;
}

export class BehaviorTreeComponent extends Component {
    treeId: string | null;
    steps: BehaviorTreeStep[];
    loop: boolean;
    stepIndex: number;
    stepElapsed: number;
    current: BehaviorTreeStep | null;
    memory: Record<string, unknown>;

    constructor(treeId: string | null = null) {
        super();
        this.treeId = treeId;
        this.steps = [];
        this.loop = false;
        this.stepIndex = 0;
        this.stepElapsed = 0;
        this.current = null;
        this.memory = {};
    }
}

export interface EnemyBehaviorConfig {
    pattern?: string;
    amplitude?: number;
    frequency?: number;
    verticalSpeed?: number;
    diveSpeed?: number;
    climbSpeed?: number;
    horizontalSpeed?: number;
    horizontalDrift?: number;
    originX?: number | null;
    direction?: number;
}

export class EnemyBehavior extends Component {
    pattern: string;
    amplitude: number;
    frequency: number;
    verticalSpeed: number;
    diveSpeed: number;
    climbSpeed: number;
    horizontalSpeed: number;
    horizontalDrift: number;
    originX: number | null;
    direction: number;
    elapsed: number;

    constructor(config: EnemyBehaviorConfig = {}) {
        super();
        this.pattern = config.pattern || "sine";
        this.amplitude = config.amplitude ?? 80;
        this.frequency = config.frequency ?? 1.4;
        this.verticalSpeed = config.verticalSpeed ?? 2;
        this.diveSpeed = config.diveSpeed ?? 4;
        this.climbSpeed = config.climbSpeed ?? -3;
        this.horizontalSpeed = config.horizontalSpeed ?? 2.5;
        this.horizontalDrift = config.horizontalDrift ?? 0;
        this.originX = config.originX ?? null;
        this.direction = config.direction ?? 0;
        this.elapsed = 0;
    }
}

export interface WeaponOptions {
    weaponId?: string;
    cooldown?: number;
    isShooting?: boolean;
}

export class Weapon extends Component {
    weaponId: string;
    cooldown: number;
    fireRate: number;
    isShooting: boolean;
    triggerShot = false;
    justActivated = false;
    fireTimer = 0;

    constructor(options: WeaponOptions | number = {}) {
        super();
        const normalized: WeaponOptions = typeof options === "number" ? { cooldown: options } : options;
        this.weaponId = normalized.weaponId || "player-blaster";
        this.cooldown = typeof normalized.cooldown === "number" ? normalized.cooldown : 0.5;
        this.fireRate = this.cooldown;
        this.isShooting = !!normalized.isShooting;
    }
}

export class Bullet extends Component {}
export class EnemyBullet extends Component {}

export class Collider extends Component {
    radius: number;

    constructor(radius = 10) {
        super();
        this.radius = radius;
    }
}

export class Health extends Component {
    health: number;
    max: number;

    constructor(health = 100) {
        super();
        this.health = health;
        this.max = health;
    }
}

export interface AbilityState {
    cooldown: number;
    timer: number;
    queued: boolean;
    remaining: number;
    active: boolean;
    duration?: number;
    strength?: number;
}

export interface PlayerAbilityOptions {
    comboBreakerCooldown?: number;
    teleportCooldown?: number;
    shieldCooldown?: number;
    shieldDuration?: number;
    shieldStrength?: number;
    stasisCooldown?: number;
    stasisDuration?: number;
}

export class PlayerAbilities extends Component {
    states: Record<string, AbilityState>;
    lastDirection: Vector2Like;
    activeShield: number;
    activeShieldStrength: number;
    stasisTimer: number;

    constructor(options: PlayerAbilityOptions = {}) {
        super();
        const comboCooldown = options.comboBreakerCooldown ?? 5;
        const teleportCooldown = options.teleportCooldown ?? 3;
        const shieldCooldown = options.shieldCooldown ?? 10;
        const stasisCooldown = options.stasisCooldown ?? 12;
        this.states = {
            comboBreaker: { cooldown: comboCooldown, timer: 0, queued: false, remaining: 0, active: false },
            teleport: { cooldown: teleportCooldown, timer: 0, queued: false, remaining: 0, active: false },
            shield: {
                cooldown: shieldCooldown,
                timer: 0,
                queued: false,
                duration: options.shieldDuration ?? 4,
                strength: options.shieldStrength ?? 40,
                remaining: 0,
                active: false
            },
            stasisField: {
                cooldown: stasisCooldown,
                timer: 0,
                queued: false,
                duration: options.stasisDuration ?? 2,
                remaining: 0,
                active: false
            }
        } as Record<string, AbilityState>;
        this.lastDirection = { x: 0, y: -1 };
        this.activeShield = 0;
        this.activeShieldStrength = options.shieldStrength ?? 40;
        this.stasisTimer = 0;
    }
}

export class Boss extends Component {}

export class BossPhase extends Component {
    phases: BossPhaseDefinition[];
    maxHealth: number;
    currentIndex: number;
    fireTimer: number;
    spiralOffset: number;
    phaseTimer: number;
    vulnerableTimer: number;

    constructor(phases: BossPhaseDefinition[] = [], maxHealth = 500) {
        super();
        this.phases = Array.isArray(phases) ? phases.slice() : [];
        this.maxHealth = maxHealth;
        this.currentIndex = 0;
        this.fireTimer = 0;
        this.spiralOffset = 0;
        this.phaseTimer = 0;
        this.vulnerableTimer = 0;
    }

    update(currentHealth: number): BossPhaseDefinition | null {
        if (!this.phases.length || !this.maxHealth) {
            return null;
        }

        const ratio = Math.max(0, currentHealth) / this.maxHealth;
        for (let i = 0; i < this.phases.length; i += 1) {
            const phase = this.phases[i];
            const threshold = typeof phase.threshold === "number" ? phase.threshold : 1;
            if (ratio <= threshold) {
                if (i !== this.currentIndex) {
                    this.currentIndex = i;
                    this.fireTimer = 0;
                    return phase;
                }
                return null;
            }
        }

        return null;
    }

    getCurrent(): BossPhaseDefinition | null {
        return this.phases[this.currentIndex] || null;
    }
}




