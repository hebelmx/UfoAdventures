import * as PIXI from 'pixi.js';
import { System, Entity } from './core';
import { EventBus } from './event-bus';
import { InputService } from './input-service';
import type { ServiceLocator } from './service-locator';
import type { BehaviorTreeService } from './behavior-tree-service';
import type { WeaponService } from './weapon-service';
import type {
    CombatDamageEvent,
    CombatProjectileFiredEvent,
    GameResultsRequest,
    ShieldHitEvent
} from './event-payloads';
import type {
    AbilityGameContext,
    BehaviorSceneOptions,
    BehaviorSummonTarget,
    BehaviorSummonTargetConfig,
    BehaviorTreeActionStep,
    BehaviorTreeGameContext,
    BehaviorTreeNodeDefinition,
    BehaviorTreeWaitStep,
    BossTelegraphOptions,
    CombatGameContext,
    EffectSpawnOptions,
    EffectDescriptor,
    EnemySpawnContext,
    EnemySpawnTemplate,
    EnemySpawningConfig,
    EnemyWaveDefinition,
    EnemyWaveSpawnDefinition,
    ProjectileSpawnPayload,
    ProjectileVelocity,
    RuntimeGameContext,
    RuntimeEntity,
    WeaponBeamDefinition,
    WeaponDefinitionWithExtras,
    WeaponProjectileConfig
} from './combat-types';
import {
    Transform,
    Sprite,
    Motion,
    Enemy,
    BehaviorTreeComponent,
    EnemyBehavior,
    EnemyBehaviorConfig,
    Weapon,
    Bullet,
    EnemyBullet,
    Collider,
    Health,
    PlayerAbilities,
    Boss,
    BossPhase,
    BossPhaseDefinition,
    AbilityState,
    Vector2Like,
    getComponentOrNull,
    getComponents,
    AIStateMachineComponent,
    Guidance,
    HomingMissile,
    CyborgLimb
} from './components';
import { ProportionalNavigationGuidance } from './guidance';
import { Player } from '../entities/player';
import { UiService, type AbilityName } from './ui-service';
import { IAIBrain, StateMachine } from './ai-state-machine';
import { PatrolState, ChaseState, AttackState } from './enemy-ai-states';
import { ConfigService } from './config-service'; // Import ConfigService

type BehaviorTreeStepDefinition = BehaviorTreeActionStep | BehaviorTreeWaitStep;

interface BehaviorTreeStepState {
    started?: boolean;
    previousWeaponId?: string;
}

type BehaviorTreeRuntimeComponent = BehaviorTreeComponent & {
    _tree?: BehaviorTreeNodeDefinition | null;
    steps: BehaviorTreeStepDefinition[];
    current: BehaviorTreeStepDefinition | null;
    memory: Record<string, unknown>;
};

type BossRuntimeEntity = RuntimeEntity & {
    _direction?: number;
};

type BossPhaseData = BossPhaseDefinition & {
    spiralOffset?: number;
};
export class RenderSystem extends System {
    private readonly app: PIXI.Application;
    constructor(app: PIXI.Application) {
        super();
        this.app = app;
    }

    update(entities: Entity[], delta: number): void {
        entities.forEach(entity => {
            const components = getComponents(entity, Transform, Sprite);
            if (!components) {
                return;
            }
            const [transform, spriteComponent] = components;

            const sprite = spriteComponent.sprite;
            sprite.x = transform.position.x;
            sprite.y = transform.position.y;
            sprite.rotation = transform.rotation;
            sprite.scale.x = transform.scale.x;
            sprite.scale.y = transform.scale.y;
        });
    }
}

export class PlayerInputSystem extends System {
    private readonly input: InputService | null;

    constructor(inputService: InputService | null) {
        super();
        this.input = inputService ?? null;
    }

    update(entities: Entity[], delta: number): void {
        const playerEntity = entities.find(entity => entity.hasComponent(Player));
        if (!playerEntity) {
            return;
        }

        const motion = getComponentOrNull(playerEntity, Motion);
        if (motion) {
            const horizontal = this.input?.getAxisValue('moveX') ?? 0;
            const vertical = this.input?.getAxisValue('moveY') ?? 0;

            motion.velocity.x = horizontal * motion.speed;
            motion.velocity.y = vertical * motion.speed;

            const abilities = getComponentOrNull(playerEntity, PlayerAbilities);
            if (abilities) {
                const { x, y } = motion.velocity;
                if (Math.abs(x) > 0.05 || Math.abs(y) > 0.05) {
                    const magnitude = Math.sqrt(x * x + y * y) || 1;
                    abilities.lastDirection = {
                        x: x / magnitude,
                        y: y / magnitude
                    };
                }
            }
        }

        const weapon = getComponentOrNull(playerEntity, Weapon);
        if (weapon) {
            weapon.isShooting = this.input?.isActionActive('attackPrimary') ?? false;
        }
    }
}

export class BehaviorTreeSystem extends System {
    private readonly game: BehaviorTreeGameContext;
    private readonly services: ServiceLocator;
    private readonly _stepState: WeakMap<BehaviorTreeStepDefinition, BehaviorTreeStepState>;
    private readonly behaviorTreeService: BehaviorTreeService | null;
    private readonly weaponService: WeaponService | null;
    private readonly eventBus: EventBus | null;
    private readonly uiService: UiService | null;

    constructor(game: BehaviorTreeGameContext, services: ServiceLocator, uiService: UiService | null = null) {
        super();
        this.game = game;
        this.services = services;
        this._stepState = new WeakMap();
        this.behaviorTreeService = this._resolveService<BehaviorTreeService>('behaviorTreeService');
        this.weaponService = this._resolveService<WeaponService>('weaponService');
        this.eventBus = this._resolveService<EventBus>('eventBus');
        this.uiService = uiService;
    }

    update(entities: Entity[], delta: number): void {
        if (!this.behaviorTreeService) {
            return;
        }

        const deltaSeconds = delta / 60;

        entities.forEach(entity => {
            if (!entity.hasComponent(BehaviorTreeComponent)) {
                return;
            }

            const runtimeEntity = entity as RuntimeEntity;
            if (runtimeEntity._stasisPaused) {
                return;
            }

            const component = entity.getComponent(BehaviorTreeComponent) as BehaviorTreeRuntimeComponent;
            const steps = this._ensureTree(component);
            if (!steps || steps.length === 0) {
                return;
            }

            this._advance(runtimeEntity, component, deltaSeconds);
        });
    }

    private _resolveService<T>(key: string): T | null {
        try {
            return this.services.resolve<T>(key);
        } catch (error) {
            return null;
        }
    }

    private _ensureTree(component: BehaviorTreeRuntimeComponent | null): BehaviorTreeStepDefinition[] | null {
        if (!component) {
            return null;
        }

        if (!component._tree && component.treeId && this.behaviorTreeService) {
            const tree = this.behaviorTreeService.getTree(component.treeId) as BehaviorTreeNodeDefinition | null;
            if (!tree) {
                return null;
            }

            component._tree = tree;
            component.steps = this._flattenTree(tree);
            component.loop = tree.loop === true;
            component.stepIndex = 0;
            component.stepElapsed = 0;
            component.current = null;
            component.memory = component.memory || {};
        }

        return component.steps as BehaviorTreeStepDefinition[];
    }

    private _flattenTree(node: BehaviorTreeNodeDefinition | null | undefined): BehaviorTreeStepDefinition[] {
        if (!node) {
            return [];
        }

        if (node.type === 'sequence') {
            const children = Array.isArray(node.children) ? node.children : [];
            const steps: BehaviorTreeStepDefinition[] = [];
            children.forEach(child => {
                steps.push(...this._flattenTree(child));
            });
            return steps;
        }

        if (node.type === 'action' || node.type === 'wait') {
            const step = { ...node } as BehaviorTreeStepDefinition;
            if (step.type === 'wait' && typeof step.duration !== 'number') {
                step.duration = 0;
            }
            if (typeof step.duration !== 'number') {
                step.duration = 0;
            }
            return [step];
        }

        return [];
    }

    private _advance(entity: RuntimeEntity, component: BehaviorTreeRuntimeComponent, deltaSeconds: number): void {
        if (!component.steps || !component.steps.length) {
            return;
        }

        component.stepElapsed += deltaSeconds;
        let guard = 0;

        while (guard++ < 16) {
            if (component.stepIndex >= component.steps.length) {
                if (component.loop) {
                    component.stepIndex = 0;
                } else {
                    component.current = null;
                    component.stepElapsed = 0;
                    return;
                }
            }

            const step = component.steps[component.stepIndex];
            if (!step) {
                return;
            }

            if (component.current !== step) {
                this._startStep(entity, component, step);
                component.current = step;
            }

            this._updateStep(entity, component, step, deltaSeconds);

            const duration = typeof step.duration === 'number' ? Math.max(0, step.duration) : 0;
            const finished = duration > 0 ? component.stepElapsed >= duration : this._isInstantStep(step);

            if (!finished) {
                break;
            }

            const overrun = duration > 0 ? component.stepElapsed - duration : component.stepElapsed;
            this._finishStep(entity, component, step);
            component.stepIndex += 1;
            component.current = null;
            component.stepElapsed = Math.max(0, overrun);
        }
    }

    private _isInstantStep(step: BehaviorTreeStepDefinition | null | undefined): boolean {
        if (!step) {
            return true;
        }
        if (step.type === 'wait') {
            return (step.duration ?? 0) <= 0;
        }
        if (step.type === 'action') {
            return (step.duration ?? 0) <= 0 && step.name !== 'fireWeapon';
        }
        return true;
    }

    private _getState(step: BehaviorTreeStepDefinition): BehaviorTreeStepState {
        let state = this._stepState.get(step);
        if (!state) {
            state = {};
            this._stepState.set(step, state);
        }
        return state;
    }

    private _startStep(entity: RuntimeEntity, _component: BehaviorTreeRuntimeComponent, step: BehaviorTreeStepDefinition): void {
        const state = this._getState(step);
        state.started = true;

        if (step.type !== 'action') {
            return;
        }

        switch (step.name) {
            case 'setOscillation':
                this._applyOscillation(entity, step);
                break;
            case 'setSwoop':
                this._applySwoop(entity, step);
                break;
            case 'strafe':
                this._applyStrafe(entity, step);
                break;
            case 'telegraph':
                this._handleTelegraph(entity, step);
                break;
            case 'summon':
                this._handleSummon(entity, step);
                break;
            case 'fireWeapon':
                this._beginWeaponFire(entity, step, state);
                break;
            default:
                break;
        }
    }

    private _updateStep(entity: RuntimeEntity, _component: BehaviorTreeRuntimeComponent, step: BehaviorTreeStepDefinition, _deltaSeconds: number): void {
        if (step.type === 'action' && step.name === 'fireWeapon') {
            this._maintainWeaponFire(entity, step);
        }
    }

    private _finishStep(entity: RuntimeEntity, _component: BehaviorTreeRuntimeComponent, step: BehaviorTreeStepDefinition): void {
        const state = this._getState(step);

        if (step.type === 'action' && step.name === 'fireWeapon') {
            this._endWeaponFire(entity, state);
        }

        state.started = false;
    }

    private _applyOscillation(entity: RuntimeEntity, step: BehaviorTreeActionStep): void {
        const behavior = getComponentOrNull(entity, EnemyBehavior);
        if (!behavior) {
            return;
        }
        behavior.pattern = 'sine';
        if (typeof step.amplitude === 'number') {
            behavior.amplitude = step.amplitude;
        }
        if (typeof step.frequency === 'number') {
            behavior.frequency = step.frequency;
        }
        if (typeof step.speedY === 'number') {
            behavior.verticalSpeed = step.speedY;
        }
    }

    private _applySwoop(entity: RuntimeEntity, step: BehaviorTreeActionStep): void {
        const behavior = getComponentOrNull(entity, EnemyBehavior);
        if (!behavior) {
            return;
        }
        behavior.pattern = 'swoop';
        if (typeof step.diveSpeed === 'number') {
            behavior.diveSpeed = step.diveSpeed;
        }
        if (typeof step.climbSpeed === 'number') {
            behavior.climbSpeed = step.climbSpeed;
        }
        if (typeof step.vertical === 'number') {
            behavior.verticalSpeed = step.vertical;
        }
        if (typeof step.horizontalDrift === 'number') {
            behavior.horizontalDrift = step.horizontalDrift;
        }
    }

    private _applyStrafe(entity: RuntimeEntity, step: BehaviorTreeActionStep): void {
        const behavior = getComponentOrNull(entity, EnemyBehavior);
        if (!behavior) {
            return;
        }
        behavior.pattern = 'strafe';
        if (typeof step.speed === 'number') {
            behavior.horizontalSpeed = step.speed;
        }
        if (typeof step.vertical === 'number') {
            behavior.verticalSpeed = step.vertical;
        }
    }

    private _handleTelegraph(entity: RuntimeEntity, step: BehaviorTreeActionStep): void {
        if (typeof step.message === 'string') {
            this.uiService?.showMessage(step.message, '#ffcc66');
        }

        this.eventBus?.emit('boss:telegraph', { ...step });

        const transform = getComponentOrNull(entity, Transform);
        const basePosition = transform
            ? { x: transform.position.x, y: transform.position.y }
            : { x: 0, y: 0 };

        const effectOptions: EffectSpawnOptions = {
            position: {
                x: step.position?.x ?? basePosition.x,
                y: step.position?.y ?? (basePosition.y - (step.offsetY ?? 0))
            },
            lifeTime: step.duration ?? 0.6,
            tint: typeof step.tint === 'number' ? step.tint : 0xffddaa,
            scale: step.scale ?? 1.6,
            alpha: step.alpha ?? 0.85
        };

        this.game.spawnEffect(effectOptions);
    }

    private _handleSummon(entity: RuntimeEntity, step: BehaviorTreeActionStep): void {
        const targetsSource = Array.isArray(step.targets) ? step.targets : Array.isArray(step.summon) ? step.summon : [];
        if (!targetsSource.length) {
            return;
        }

        const normalizedTargets = targetsSource.map<BehaviorSummonTargetConfig>(target =>
            typeof target === 'string' ? { template: target } : target
        );

        normalizedTargets.forEach(target => this._summonTarget(entity, target));

        this.eventBus?.emit('boss:summon', { targets: normalizedTargets });
    }

    private _summonTarget(entity: RuntimeEntity, target: BehaviorSummonTargetConfig): void {
        const templateDef = this._resolveSummonTemplate(target);
        if (!templateDef) {
            console.warn('BehaviorTreeSystem: summon template not found', target);
            return;
        }

        const count = Math.max(1, target.count ?? 1);
        const radius = typeof target.radius === 'number' ? target.radius : 80;
        const verticalRadius = typeof target.verticalRadius === 'number' ? target.verticalRadius : radius * 0.6;
        const angleOffset = typeof target.angleOffset === 'number' ? target.angleOffset : 0;
        const transform = getComponentOrNull(entity, Transform);
        const screen = this._getScreen();
        const baseX = target.position?.x ?? (transform ? transform.position.x : screen.width / 2);
        const baseY = target.position?.y ?? (transform ? transform.position.y + 40 : screen.height / 3);

        for (let i = 0; i < count; i += 1) {
            const t = count === 1 ? 0 : i / count;
            const angle = angleOffset + t * Math.PI * 2;
            const offsetX = Math.cos(angle) * radius;
            const offsetY = Math.sin(angle) * verticalRadius;

            const context: EnemySpawnContext = {
                position: {
                    x: baseX + (target.offset?.x ?? 0) + offsetX,
                    y: baseY + (target.offset?.y ?? 0) + offsetY
                }
            };

            this.game.spawnEnemyFromTemplate(templateDef, context);
        }
    }

    private _resolveSummonTemplate(target: BehaviorSummonTargetConfig): EnemySpawnTemplate | null {
        if (target.template && typeof target.template === 'object') {
            return target.template as EnemySpawnTemplate;
        }

        const templateId = typeof target.template === 'string' ? target.template : target.templateId ?? target.id;
        if (!templateId) {
            return null;
        }

        const templates = this._getEnemyTemplates();
        return templates.find(entry => entry.id === templateId) ?? null;
    }

    private _getEnemyTemplates(): EnemySpawnTemplate[] {
        const options = this.game.sceneOptions ?? {};
        const enemies = options.enemies ?? {};
        return Array.isArray(enemies.templates) ? enemies.templates as EnemySpawnTemplate[] : [];
    }

    private _getScreen(): PIXI.Rectangle {
        const renderer = this.game.app?.renderer;
        return renderer ? renderer.screen : this.game.app.screen;
    }

    private _beginWeaponFire(entity: RuntimeEntity, step: BehaviorTreeActionStep, state: BehaviorTreeStepState): void {
        const weapon = getComponentOrNull(entity, Weapon);
        if (!weapon || entity.hasComponent?.(Boss)) {
            return;
        }

        state.previousWeaponId = weapon.weaponId;
        if (step.weaponId) {
            weapon.weaponId = step.weaponId;
        }

        const definition = this.weaponService?.get(weapon.weaponId);
        if (definition && typeof definition.cooldown === 'number') {
            weapon.cooldown = definition.cooldown;
            weapon.fireRate = definition.cooldown;
        }

        weapon.isShooting = true;
        weapon.triggerShot = true;
        weapon.fireTimer = weapon.fireRate;
    }

    private _maintainWeaponFire(entity: RuntimeEntity, _step: BehaviorTreeActionStep): void {
        const weapon = getComponentOrNull(entity, Weapon);
        if (!weapon || entity.hasComponent?.(Boss)) {
            return;
        }
        weapon.isShooting = true;
    }

    private _endWeaponFire(entity: RuntimeEntity, state: BehaviorTreeStepState): void {
        const weapon = getComponentOrNull(entity, Weapon);
        if (!weapon || entity.hasComponent?.(Boss)) {
            return;
        }
        weapon.isShooting = false;
        weapon.triggerShot = false;
        if (state.previousWeaponId) {
            weapon.weaponId = state.previousWeaponId;
        }
    }
}
export class MovementSystem extends System {
    update(entities: Entity[], delta: number): void {
        entities.forEach(entity => {
            const components = getComponents(entity, Transform, Motion);
            if (!components) {
                return;
            }

            const [transform, motion] = components;
            transform.position.x += motion.velocity.x * delta;
            transform.position.y += motion.velocity.y * delta;
        });
    }
}

export class EffectLifetimeSystem extends System {
    private readonly game: RuntimeGameContext;

    constructor(game: RuntimeGameContext) {
        super();
        this.game = game;
    }

    update(entities: Entity[], delta: number): void {
        const deltaSeconds = delta / 60;

        entities.forEach(entity => {
            const runtimeEntity = entity as RuntimeEntity;
            if (runtimeEntity.poolId !== 'effect') {
                return;
            }

            const remaining = (typeof runtimeEntity.lifeTime === 'number' ? runtimeEntity.lifeTime : 0) - deltaSeconds;
            runtimeEntity.lifeTime = remaining;

            if (typeof runtimeEntity.fadeRate === 'number') {
                const spriteComponent = getComponentOrNull(entity, Sprite);
                if (spriteComponent) {
                    const sprite = spriteComponent.sprite;
                    const nextAlpha = Math.max(0, sprite.alpha - runtimeEntity.fadeRate * deltaSeconds);
                    sprite.alpha = nextAlpha;
                    if (nextAlpha <= 0.01) {
                        sprite.visible = false;
                    }
                }
            }

            if (remaining <= 0) {
                runtimeEntity.isRemoved = true;
            }
        });
    }
}

export class AbilitySystem extends System {
    private readonly game: AbilityGameContext;
    private readonly eventBus: EventBus | null;
    private readonly inputService: InputService | null;
    private readonly uiService: UiService | null;
    private readonly _handlers: Array<() => void> = [];
    private _revertTimers: Map<Entity, ReturnType<typeof setTimeout>> = new Map();

    constructor(
        game: AbilityGameContext,
        eventBus: EventBus | null,
        inputService: InputService | null,
        uiService: UiService | null = null
    ) {
        super();
        this.game = game;
        this.eventBus = eventBus ?? null;
        this.inputService = inputService ?? null;
        this.uiService = uiService ?? null;
        this._bindInput();
    }

    destroy(): void {
        while (this._handlers.length) {
            const off = this._handlers.pop();
            try {
                off?.();
            } catch (error) {
                console.error('AbilitySystem: failed to unregister command', error);
            }
        }

        for (const timer of this._revertTimers.values()) {
            try {
                clearTimeout(timer);
            } catch (error) {
                // ignore
            }
        }
        this._revertTimers.clear();
    }

    update(entities: Entity[], delta: number): void {
        const playerEntity = entities.find(entity => entity.hasComponent(Player));
        if (!playerEntity) {
            return;
        }

        const abilities = getComponentOrNull(playerEntity, PlayerAbilities);
        if (!abilities) {
            return;
        }

        const deltaSeconds = delta / 60;
        const comboState = abilities.states.comboBreaker ?? null;
        const teleportState = abilities.states.teleport ?? null;

        if (comboState && comboState.timer > 0) {
            comboState.timer = Math.max(0, comboState.timer - deltaSeconds);
        }

        if (teleportState && teleportState.timer > 0) {
            teleportState.timer = Math.max(0, teleportState.timer - deltaSeconds);
        }

        this._updateLastDirection(playerEntity, abilities);

        if (comboState?.queued) {
            this._executeComboBreaker(playerEntity, comboState);
        }

        if (teleportState?.queued) {
            this._executeTeleport(playerEntity, abilities, teleportState);
        }

        this.uiService?.updateAbilityCooldown('comboBreaker', comboState ?? null);
        this.uiService?.updateAbilityCooldown('teleport', teleportState ?? null);
    }

    private _bindInput(): void {
        if (!this.inputService) {
            return;
        }

        this._handlers.push(
            this.inputService.registerCommand('comboBreaker', () => this._queueAbility('comboBreaker'), { trigger: 'down' })
        );
        this._handlers.push(
            this.inputService.registerCommand('teleport', () => this._queueAbility('teleport'), { trigger: 'down' })
        );
    }

    private _queueAbility(name: AbilityName): void {
        const player = this._getPlayer(this.game.entities ?? []);
        if (!player) {
            return;
        }

        const abilities = getComponentOrNull(player, PlayerAbilities);
        if (!abilities) {
            return;
        }

        const state = abilities.states[name];
        if (!state) {
            return;
        }

        if ((state.timer ?? 0) > 0) {
            const label = name === 'teleport' ? 'Teleport ready in ' : 'Combo breaker ready in ';
            this.uiService?.showMessage(`${label}${state.timer.toFixed(1)}s`, '#99a0ff');
            return;
        }

        state.queued = true;
    }

    private _executeComboBreaker(player: RuntimeEntity, state: AbilityState): void {
        const playerComponent = getComponentOrNull(player, Player);
        if (playerComponent) {
            (playerComponent as unknown as { combo?: number }).combo = 0;
        }

        state.timer = state.cooldown;
        state.queued = false;

        const transform = getComponentOrNull(player, Transform);
        if (transform) {
            this.game.spawnEffect?.({
                position: { x: transform.position.x, y: transform.position.y },
                tint: 0xffaa33,
                alpha: 0.95,
                lifeTime: 0.4,
                fade: 1.2,
                scale: 1.2,
                atlasAlias: 'vfx-atlas',
                animation: 'comboBreaker',
                animationSpeed: 0.18,
                loop: false
            });
        }

        this._playPlayerAnimation(player, 'comboBreaker', { revertAfter: 600 });
        this.uiService?.updateCombo(0);
        this.uiService?.showMessage('Combo breaker unleashed!', '#ffaa33');
        this.eventBus?.emit('ability:combo-breaker', { player });
    }

    private _executeTeleport(player: RuntimeEntity, abilities: PlayerAbilities, state: AbilityState): void {
        const transform = getComponentOrNull(player, Transform);
        if (!transform) {
            state.queued = false;
            return;
        }

        const origin = { x: transform.position.x, y: transform.position.y };
        const direction = abilities.lastDirection ?? { x: 0, y: -1 };
        const magnitude = Math.sqrt(direction.x * direction.x + direction.y * direction.y) || 1;
        const normalized: Vector2Like = {
            x: direction.x / magnitude,
            y: direction.y / magnitude
        };
        const distance = 140;
        const screen = this._getScreen();

        transform.position.x = this._clamp(transform.position.x + normalized.x * distance, 30, screen.width - 30);
        transform.position.y = this._clamp(transform.position.y + normalized.y * distance, 30, screen.height - 30);

        state.timer = state.cooldown;
        state.queued = false;

        this._playPlayerAnimation(player, 'teleport', { revertAfter: 400 });

        this.game.spawnEffect?.({
            position: origin,
            tint: 0x66ccff,
            alpha: 0.7,
            lifeTime: 0.25,
            fade: 1.5,
            scale: 0.9,
            atlasAlias: 'vfx-atlas',
            animation: 'teleport-trail',
            animationSpeed: 0.24,
            loop: false
        });
        this.game.spawnEffect?.({
            position: { x: transform.position.x, y: transform.position.y },
            tint: 0xffffff,
            alpha: 0.8,
            lifeTime: 0.3,
            fade: 1.8,
            scale: 1.0,
            atlasAlias: 'vfx-atlas',
            animation: 'teleport-arrive',
            animationSpeed: 0.2,
            loop: false
        });

        this.uiService?.showMessage('Teleport!', '#66ccff');
        this.eventBus?.emit('ability:teleport', { player, direction: normalized });
    }

    private _playPlayerAnimation(
        player: RuntimeEntity,
        animation: string,
        options: { revertAfter?: number; revertTo?: string; speed?: number } = {}
    ): void {
        const spriteComponent = getComponentOrNull(player, Sprite);
        if (!spriteComponent) {
            return;
        }

        const { sprite } = spriteComponent;
        if (sprite instanceof PIXI.AnimatedSprite) {
            const animatedSprite = sprite as PIXI.AnimatedSprite;
            const gotoAndPlay = (animatedSprite as unknown as { gotoAndPlay?(sequence: string): void }).gotoAndPlay;
            if (typeof gotoAndPlay === 'function') {
                try {
                    gotoAndPlay.call(animatedSprite, animation);
                } catch (error) {
                    (animatedSprite as unknown as { play?(arg?: unknown): void }).play?.(animation);
                }
            } else {
                (animatedSprite as unknown as { play?(arg?: unknown): void }).play?.(animation);
            }

            if (typeof options.speed === 'number') {
                animatedSprite.animationSpeed = options.speed;
            }
        }

        if (typeof options.revertAfter === 'number') {
            const existing = this._revertTimers.get(player);
            if (existing) {
                clearTimeout(existing);
            }

            const timer = setTimeout(() => {
                this._revertTimers.delete(player);
                this._playPlayerAnimation(player, options.revertTo ?? 'idle');
            }, options.revertAfter);

            this._revertTimers.set(player, timer);
        }
    }

    private _updateLastDirection(player: RuntimeEntity, abilities: PlayerAbilities): void {
        const motion = getComponentOrNull(player, Motion);
        if (!motion) {
            return;
        }

        const { x, y } = motion.velocity;
        if (Math.abs(x) <= 0.05 && Math.abs(y) <= 0.05) {
            return;
        }

        const magnitude = Math.sqrt(x * x + y * y) || 1;
        abilities.lastDirection = { x: x / magnitude, y: y / magnitude };
    }

    private _getPlayer(entities: Entity[]): RuntimeEntity | null {
        const match = entities.find(entity => entity.hasComponent(Player));
        return match ? (match as RuntimeEntity) : null;
    }

    private _getScreen(): PIXI.Rectangle {
        const renderer = this.game.app.renderer;
        return renderer ? renderer.screen : this.game.app.screen;
    }

    private _clamp(value: number, min: number, max: number): number {
        return Math.min(Math.max(value, min), max);
    }
}

export class EnemyBehaviorSystem extends System {
    private readonly game: RuntimeGameContext;

    constructor(game: RuntimeGameContext) {
        super();
        this.game = game;
    }

    update(entities: Entity[], delta: number): void {
        const deltaSeconds = delta / 60;

        entities.forEach(entity => {
            if (!entity.hasComponent(EnemyBehavior) || !entity.hasComponent(Enemy) || !entity.hasComponent(AIStateMachineComponent)) {
                return;
            }

            const aiComponent = entity.getComponent(AIStateMachineComponent);
            aiComponent.stateMachine.update(deltaSeconds);
        });
    }

    private _getScreen(): PIXI.Rectangle {
        const renderer = this.game.app.renderer;
        return renderer ? renderer.screen : this.game.app.screen;
    }
}


export class EnemySpawningSystem extends System {
    private readonly game: BehaviorTreeGameContext;
    private readonly templates: Map<string, EnemySpawnTemplate>;
    private readonly waves: EnemyWaveDefinition[];
    private waveIndex = 0;
    private elapsed = 0;
    private readonly _difficultyModifiers: Record<string, any>; // Store difficulty modifiers

    constructor(game: BehaviorTreeGameContext, config: EnemySpawningConfig = {}) {
        super();
        this.game = game;
        this.templates = this._buildTemplateMap(config.templates);
        this.waves = this._normalizeWaves(config.waves);

        const configService = game.services.optional<ConfigService>('configService');
        this._difficultyModifiers = configService?.get('enemies.difficultyModifiers') ?? {};
    }

    update(_entities: Entity[], delta: number): void {
        const deltaSeconds = delta / 60;
        this.elapsed += deltaSeconds;

        while (this.waveIndex < this.waves.length) {
            const wave = this.waves[this.waveIndex];
            const trigger = wave.delay ?? 0;
            if (this.elapsed >= trigger) {
                this._spawnWave(wave);
                this.waveIndex += 1;
            } else {
                break;
            }
        }

        if (this.waveIndex >= this.waves.length) {
            this.waveIndex = 0;
            this.elapsed = 0;
        }
    }

    private _spawnWave(wave: EnemyWaveDefinition): void {
        const spawns = Array.isArray(wave.spawns) ? wave.spawns : [];
        spawns.forEach(spawn => {
            if (!spawn || typeof spawn.template !== 'string') {
                return;
            }

            const template = this.templates.get(spawn.template);
            if (!template) {
                console.warn('EnemySpawningSystem: template not found', spawn.template);
                return;
            }

            const count = Math.max(1, spawn.count ?? 1);
            const positions = this._resolvePositions(count, spawn);

            positions.forEach(positionRatio => {
                const enemy = this._createEnemy(template, positionRatio, spawn.altitude);
                this.game.addEntity(enemy);
            });
        });
    }

    private _createEnemy(template: EnemySpawnTemplate, positionRatio: number, altitude?: number): Entity {
        const screen = this._getScreen();
        const spawnX = screen.width * positionRatio;
        const spawnY = typeof altitude === 'number' ? altitude : -50;

        const difficulty = this.game.mode; // Assuming game.mode holds the difficulty
        const modifiers = this._difficultyModifiers[difficulty] || this._difficultyModifiers.normal || {};

        const healthMultiplier = modifiers.healthMultiplier ?? 1.0;
        const damageMultiplier = modifiers.damageMultiplier ?? 1.0;
        const fireRateMultiplier = modifiers.fireRateMultiplier ?? 1.0;
        const speedMultiplier = modifiers.speedMultiplier ?? 1.0; // Added speedMultiplier

        const enemy = new Entity();
        enemy.addComponent(new Transform({ x: spawnX, y: spawnY }));
        enemy.addComponent(new Sprite(template.spritesheet?.alias ?? template.texture ?? PIXI.Texture.WHITE));
        enemy.addComponent(new Motion({ x: 0, y: (typeof template.verticalSpeed === 'number' ? template.verticalSpeed : 2) * speedMultiplier }));
        enemy.addComponent(new Enemy());
        enemy.addComponent(new Collider(template.colliderRadius ?? 20));

        const modifiedHealth = (template.health ?? 50) * healthMultiplier;
        enemy.addComponent(new Health(modifiedHealth));

        const behaviorConfig: EnemyBehaviorConfig = {
            pattern: typeof template.pattern === 'string' ? template.pattern : undefined,
            amplitude: typeof template.amplitude === 'number' ? template.amplitude : undefined,
            frequency: typeof template.frequency === 'number' ? template.frequency : undefined,
            verticalSpeed: (typeof template.verticalSpeed === 'number' ? template.verticalSpeed : undefined) * speedMultiplier,
            diveSpeed: (typeof template.diveSpeed === 'number' ? template.diveSpeed : undefined) * speedMultiplier,
            climbSpeed: (typeof template.climbSpeed === 'number' ? template.climbSpeed : undefined) * speedMultiplier,
            horizontalSpeed: (typeof template.horizontalSpeed === 'number' ? template.horizontalSpeed : undefined) * speedMultiplier,
            horizontalDrift: (typeof template.horizontalDrift === 'number' ? template.horizontalDrift : undefined) * speedMultiplier,
            originX: spawnX
        };

        enemy.addComponent(new EnemyBehavior(behaviorConfig));

        if (typeof template.behaviorTreeId === 'string') {
            enemy.addComponent(new BehaviorTreeComponent(template.behaviorTreeId));
        }

        if (typeof template.weaponId === 'string') {
            const cooldown = (typeof template.weaponCooldown === 'number'
                ? template.weaponCooldown
                : typeof template.fireRate === 'number'
                    ? template.fireRate
                    : 1.0) / fireRateMultiplier; // Apply fire rate multiplier

            enemy.addComponent(new Weapon({
                weaponId: template.weaponId,
                cooldown
            }));
        }

        const aiStates = new Map<string, IAIBrain>();
        aiStates.set('patrol', new PatrolState());
        aiStates.set('chase', new ChaseState());
        aiStates.set('attack', new AttackState());
        const stateMachine = new StateMachine(aiStates, this.game.services.optional<ConfigService>('configService') ?? undefined); // Pass ConfigService
        enemy.addComponent(new AIStateMachineComponent(stateMachine));
        stateMachine.transitionTo('patrol', { entity: enemy });

        return enemy;
    }

    private _resolvePositions(count: number, spawn: EnemyWaveSpawnDefinition): number[] {
        if (Array.isArray(spawn.positions) && spawn.positions.length) {
            return spawn.positions.slice(0, count);
        }

        const spread = Math.min(1, Math.max(0.1, spawn.spread ?? 0.6));
        const offset = Math.min(1, Math.max(0, spawn.offset ?? 0.5));
        const start = offset - spread / 2;
        const step = spread / Math.max(1, count - 1);

        const positions: number[] = [];
        for (let i = 0; i < count; i += 1) {
            positions.push(Math.min(0.95, Math.max(0.05, start + step * i)));
        }
        return positions;
    }

    private _buildTemplateMap(templates?: EnemySpawnTemplate[]): Map<string, EnemySpawnTemplate> {
        const map = new Map<string, EnemySpawnTemplate>();
        (templates ?? []).forEach(template => {
            if (template && typeof template.id === 'string' && template.id) {
                map.set(template.id, template);
            }
        });

        if (!map.size) {
            map.set('default', {
                id: 'default',
                texture: 'blade',
                initialState: 'patrol',
                verticalSpeed: 2,
                amplitude: 80,
                frequency: 1.2
            });
        }

        return map;
    }

    private _normalizeWaves(waves?: EnemyWaveDefinition[]): EnemyWaveDefinition[] {
        if (!Array.isArray(waves) || !waves.length) {
            return this._defaultWaves();
        }

        return waves
            .map(wave => ({
                delay: wave?.delay ?? 0,
                spawns: Array.isArray(wave?.spawns)
                    ? wave.spawns.filter(spawn => spawn && typeof spawn.template === 'string')
                    : []
            }))
            .filter(wave => wave.spawns.length > 0);
    }

    private _defaultWaves(): EnemyWaveDefinition[] {
        return [
            { delay: 0, spawns: [{ template: 'default', count: 3, spread: 0.6 }] },
            { delay: 7, spawns: [{ template: 'default', count: 4, spread: 0.8 }] }
        ];
    }

    private _getScreen(): PIXI.Rectangle {
        const renderer = this.game.app.renderer;
        return renderer ? renderer.screen : this.game.app.screen;
    }
}

export class ShootingSystem extends System {
    private readonly game: CombatGameContext;
    private readonly eventBus: EventBus | null;
    private readonly weaponService: WeaponService | null;

    constructor(game: CombatGameContext, services: ServiceLocator, eventBus: EventBus | null) {
        super();
        this.game = game;
        this.eventBus = eventBus ?? null;
        this.weaponService = this._resolveWeaponService(services);
    }

    update(entities: Entity[], delta: number): void {
        const deltaSeconds = delta / 60;

        entities.forEach(entity => {
            if (!entity.hasComponent(Weapon) || !entity.hasComponent(Transform)) {
                return;
            }

            const runtimeEntity = entity as RuntimeEntity;
            if (runtimeEntity._stasisPaused) {
                return;
            }

            const components = getComponents(entity, Weapon, Transform);
            if (!components) {
                return;
            }

            const [weapon, transform] = components;
            const definition = (this.weaponService?.get(weapon.weaponId) ?? null) as WeaponDefinitionWithExtras | null;
            const cooldown = this._resolveCooldown(weapon, definition);

            weapon.cooldown = cooldown;
            weapon.fireRate = cooldown;
            weapon.fireTimer = (weapon.fireTimer ?? 0) + deltaSeconds;

            if (!weapon.isShooting && !weapon.triggerShot) {
                return;
            }

            while (weapon.fireTimer >= cooldown) {
                this._fireWeapon(runtimeEntity, transform, weapon, definition);
                weapon.fireTimer -= cooldown;
                weapon.triggerShot = false;

                if (!weapon.isShooting) {
                    break;
                }
            }

            if (weapon.fireTimer < 0) {
                weapon.fireTimer = 0;
            }
        });
    }

    private _resolveWeaponService(services: ServiceLocator): WeaponService | null {
        try {
            return services.resolve<WeaponService>('weaponService');
        } catch (error) {
            return null;
        }
    }

    private _resolveCooldown(weapon: Weapon, definition: WeaponDefinitionWithExtras | null): number {
        if (definition && typeof definition.cooldown === 'number') {
            return Math.max(0.01, definition.cooldown);
        }
        if (typeof weapon.cooldown === 'number' && weapon.cooldown > 0) {
            return weapon.cooldown;
        }
        return 0.35;
    }

    private _fireWeapon(entity: RuntimeEntity, transform: Transform, weapon: Weapon, definition: WeaponDefinitionWithExtras | null): void {
        const origin = { x: transform.position.x, y: transform.position.y };

        // Strategy-first: allow factory-based weapons to drive firing
        if (this.weaponService) {
            const strategy = this.weaponService.createStrategy(weapon.weaponId);
            if (strategy && definition) {
                try {
                    const shots = strategy.fire({ shooter: entity, transform, weapon, definition });
                    if (Array.isArray(shots) && shots.length) {
                        shots.forEach(projectileDef => {
                            const projectileType = (projectileDef.type as 'player' | 'enemy') || this._inferProjectileOwner(entity);
                            const position: Vector2Like = {
                                x: origin.x + ((projectileDef as any).offset?.x ?? 0),
                                y: origin.y + ((projectileDef as any).offset?.y ?? 0)
                            };
                            const velocity = this._resolveVelocity(projectileDef as any);
                            const damage = this._resolveDamage(projectileDef as any, entity);

                            const spawnOptions: ProjectileSpawnPayload = {
                                ...(projectileDef as any),
                                type: projectileType,
                                position,
                                velocity,
                                tint: (projectileDef as any).tint,
                                scale: (projectileDef as any).scale,
                                damage
                            };

                            const projectile = this.game.spawnProjectile(spawnOptions);
                            if (projectile && this.eventBus) {
                                this.eventBus.emit<CombatProjectileFiredEvent>('combat:projectile-fired', {
                                    origin: entity,
                                    projectile,
                                    source: projectileType
                                });
                            }
                        });
                        return; // handled by strategy
                    }
                } catch (_e) {
                    // Fallback to default path
                }
            }
        }

        const beamDef = definition?.beam ?? null;
        if (beamDef) {
            this._fireBeam(entity, transform, weapon, beamDef);
            return;
        }

        const projectiles = this._getProjectiles(definition, entity);
        projectiles.forEach(projectileDef => {
            const projectileType = (projectileDef.type as 'player' | 'enemy') || this._inferProjectileOwner(entity);
            const position: Vector2Like = {
                x: origin.x + (projectileDef.offset?.x ?? 0),
                y: origin.y + (projectileDef.offset?.y ?? 0)
            };
            const velocity = this._resolveVelocity(projectileDef);
            const damage = this._resolveDamage(projectileDef, entity);

            const spawnOptions: ProjectileSpawnPayload = {
                ...projectileDef,
                type: projectileType,
                position,
                velocity,
                tint: projectileDef.tint,
                scale: projectileDef.scale,
                damage
            };

            const projectile = this.game.spawnProjectile(spawnOptions);

            if (projectile && this.eventBus) {
                this.eventBus.emit<CombatProjectileFiredEvent>('combat:projectile-fired', {
                    origin: entity,
                    projectile,
                    source: projectileType
                });
            }
        });
    }

    private _fireBeam(entity: RuntimeEntity, transform: Transform, _weapon: Weapon, beamDef: WeaponBeamDefinition): void {
        const projectileType = this._inferProjectileOwner(entity);
        const duration = Math.max(0.1, beamDef.duration ?? 0.6);
        const damage = typeof beamDef.damage === 'number' ? beamDef.damage : 30;
        const tint = typeof beamDef.tint === 'number' ? beamDef.tint : (projectileType === 'enemy' ? 0xff9999 : 0x99ffef);
        const segments = Math.max(6, Math.floor(duration * 20));
        const speed = projectileType === 'enemy' ? 14 : -14;

        for (let i = 0; i < segments; i += 1) {
            const offsetY = (projectileType === 'enemy' ? i : -i) * 18;
            const spawnOptions: ProjectileSpawnPayload = {
                type: projectileType,
                position: { x: transform.position.x, y: transform.position.y + offsetY },
                velocity: { x: 0, y: speed },
                tint,
                damage,
                scale: beamDef.width ? { x: beamDef.width / 5, y: 1 } : 1.6
            };

            const projectile = this.game.spawnProjectile(spawnOptions);

            if (projectile && this.eventBus) {
                this.eventBus.emit<CombatProjectileFiredEvent>('combat:projectile-fired', {
                    origin: entity,
                    projectile,
                    source: projectileType,
                    beam: true
                });
            }
        }

        this.game.spawnEffect({
            position: { x: transform.position.x, y: transform.position.y },
            tint,
            alpha: 0.7,
            scale: {
                x: beamDef.width ? beamDef.width / 16 : 2.0,
                y: duration * 8
            },
            lifeTime: duration
        });
    }

    private _getProjectiles(definition: WeaponDefinitionWithExtras | null, entity: Entity): WeaponProjectileConfig[] {
        if (definition && Array.isArray(definition.projectiles) && definition.projectiles.length) {
            return definition.projectiles as WeaponProjectileConfig[];
        }
        return [this._defaultProjectile(entity)];
    }

    private _inferProjectileOwner(entity: Entity): 'player' | 'enemy' {
        return entity.hasComponent(Player) ? 'player' : 'enemy';
    }

    private _resolveVelocity(projectileDef: WeaponProjectileConfig): Vector2Like {
        const hasVector = typeof projectileDef.dx === 'number' || typeof projectileDef.dy === 'number';
        if (hasVector) {
            return {
                x: projectileDef.dx ?? 0,
                y: projectileDef.dy ?? 0
            };
        }

        const speed = typeof projectileDef.speed === 'number' ? projectileDef.speed : 12;
        const defaultAngle = projectileDef.type === 'enemy' ? Math.PI / 2 : -Math.PI / 2;
        const angle = typeof projectileDef.angle === 'number' ? projectileDef.angle : defaultAngle;
        return {
            x: Math.cos(angle) * speed,
            y: Math.sin(angle) * speed
        };
    }

    private _resolveDamage(projectileDef: WeaponProjectileConfig, entity: Entity): number {
        if (typeof projectileDef.damage === 'number') {
            return projectileDef.damage;
        }
        return entity.hasComponent(Player) ? 25 : 15;
    }

    private _defaultProjectile(entity: Entity): WeaponProjectileConfig {
        const isPlayer = entity.hasComponent(Player);
        return {
            type: isPlayer ? 'player' : 'enemy',
            dx: 0,
            dy: isPlayer ? -12 : 6,
            speed: Math.abs(isPlayer ? -12 : 6),
            tint: isPlayer ? 0xffff88 : 0xff5555,
            damage: isPlayer ? 25 : 15,
            offset: { x: 0, y: isPlayer ? -20 : 20 }
        };
    }
}

export class CollisionSystem extends System {
    private readonly game: CombatGameContext;
    private readonly eventBus: EventBus | null;
    private _playerDefeated = false;
    private readonly _defeatedBosses = new WeakSet<Entity>();
    private readonly uiService: UiService | null;

    constructor(game: CombatGameContext, eventBus: EventBus | null, uiService: UiService | null = null) {
        super();
        this.game = game;
        this.eventBus = eventBus ?? null;
        this.uiService = uiService ?? null;
    }

    update(entities: Entity[], _delta: number): void {
        const activeEntities = entities.filter(entity => !entity.isRemoved);
        const bullets = activeEntities.filter(entity => entity.hasComponent(Bullet));
        const enemies = activeEntities.filter(entity => entity.hasComponent(Enemy));
        const bosses = activeEntities.filter(entity => entity.hasComponent(Boss));
        const enemyProjectiles = activeEntities.filter(entity => entity.hasComponent(EnemyBullet));
        const player = activeEntities.find(entity => entity.hasComponent(Player)) ?? null;

        bullets.forEach(bullet => {
            enemies.forEach(enemy => {
                if (this._isColliding(bullet, enemy)) {
                    this._handleBulletHitsEnemy(bullet, enemy);
                }
            });

            bosses.forEach(boss => {
                if (this._isColliding(bullet, boss)) {
                    this._handleBulletHitsBoss(bullet, boss);
                }
            });
        });

        if (!player) {
            return;
        }

        enemies.forEach(enemy => {
            if (this._isColliding(player, enemy)) {
                this._handleEnemyHitsPlayer(enemy, player);
            }
        });

        enemyProjectiles.forEach(projectile => {
            if (this._isColliding(player, projectile)) {
                this._handleProjectileHitsPlayer(projectile, player);
            }
        });
    }

    private _isColliding(entityA: Entity, entityB: Entity): boolean {
        const componentsA = getComponents(entityA, Transform, Collider);
        const componentsB = getComponents(entityB, Transform, Collider);
        if (!componentsA || !componentsB) {
            return false;
        }

        const [transformA, colliderA] = componentsA;
        const [transformB, colliderB] = componentsB;
        const dx = transformA.position.x - transformB.position.x;
        const dy = transformA.position.y - transformB.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance < colliderA.radius + colliderB.radius;
    }

    private _handleBulletHitsEnemy(bullet: Entity, enemy: Entity): void {
        bullet.isRemoved = true;
        const health = getComponentOrNull(enemy, Health);
        const damage = this._getProjectileDamage(bullet, 25);

        if (health) {
            health.health = Math.max(0, health.health - damage);
            this._emitDamage(enemy, bullet, damage, health, 'projectile');
            if (health.health <= 0) {
                enemy.isRemoved = true;
            }
        } else {
            enemy.isRemoved = true;
        }
    }

    private _handleBulletHitsBoss(bullet: Entity, boss: Entity): void {
        const health = getComponentOrNull(boss, Health);
        if (!health) {
            return;
        }

        bullet.isRemoved = true;
        const damage = this._getProjectileDamage(bullet, 15);
        health.health = Math.max(0, health.health - damage);

        this._emitDamage(boss, bullet, damage, health, 'projectile');

        if (health.health <= 0 && !this._defeatedBosses.has(boss)) {
            this._defeatedBosses.add(boss);
            boss.isRemoved = true;

            this.uiService?.showMessage('Boss defeated!', '#66ff88');

            this.eventBus?.emit<GameResultsRequest>('game:request-results', {
                outcome: 'victory',
                reason: 'boss-defeated',
                mode: this.game.mode ?? 'adventure',
                options: this.game.sceneOptions ?? {}
            });
        }
    }

    private _handleEnemyHitsPlayer(enemy: Entity, player: Entity): void {
        enemy.isRemoved = true;
        this._damagePlayer(player, 10, 'collision');
    }

    private _handleProjectileHitsPlayer(projectile: Entity, player: Entity): void {
        projectile.isRemoved = true;
        const damage = this._getProjectileDamage(projectile, 10);
        this._damagePlayer(player, damage, 'projectile');
    }

    private _damagePlayer(playerEntity: Entity, amount: number, source: 'collision' | 'projectile'): void {
        const playerComponent = getComponentOrNull(playerEntity, Player);
        const health = getComponentOrNull(playerEntity, Health);
        const abilities = getComponentOrNull(playerEntity, PlayerAbilities);

        if (!playerComponent || !health) {
            return;
        }

        const shieldResult = this._applyShieldAbsorb(abilities, amount);
        const damage = shieldResult.damage;

        if (shieldResult.absorbed > 0) {
            if (shieldResult.broke) {
                this.uiService?.showMessage('Shield shattered!', '#ff8080');
            } else {
                this.uiService?.showMessage(`Shield absorbed ${shieldResult.absorbed} damage.`, '#88e0ff');
            }

        this.eventBus?.emit<ShieldHitEvent>('ability:shield-hit', {
            absorbed: shieldResult.absorbed,
            remainingStrength: abilities?.activeShieldStrength ?? 0,
            broke: shieldResult.broke
        });
        }

        if (damage <= 0) {
            return;
        }

        health.health = Math.max(0, health.health - damage);
        this._emitDamage(playerEntity, null, damage, health, source);
        this.uiService?.showMessage('Hit! Shields dropping.', '#ff6666');

        if (health.health > 0) {
            return;
        }

        const playerStats = playerComponent as unknown as { lives?: number };
        const currentLives = typeof playerStats.lives === 'number' ? playerStats.lives : 0;

        if (currentLives > 1) {
            playerStats.lives = currentLives - 1;
            health.health = 100;

            const transform = getComponentOrNull(playerEntity, Transform);
            const screen = this._getScreen();
            if (transform) {
                transform.position.x = screen.width / 2;
                transform.position.y = screen.height - 80;
            }

            const remainingLives = playerStats.lives ?? 0;
            this.uiService?.showMessage(`Life lost! ${remainingLives} remaining.`, '#ffbb55');
            return;
        }

        if (this._playerDefeated) {
            return;
        }

        this._playerDefeated = true;
        playerEntity.isRemoved = true;

        this.eventBus?.emit<GameResultsRequest>('game:request-results', {
            outcome: 'defeat',
            reason: 'player-destroyed',
            mode: this.game.mode ?? 'adventure',
            options: this.game.sceneOptions ?? {}
        });
    }

    private _emitDamage(target: Entity, source: Entity | null, amount: number, healthComponent: Health | null, damageSource: 'projectile' | 'collision'): void {
        if (!this.eventBus) {
            return;
        }

        const event: CombatDamageEvent = {
            target,
            source,
            amount,
            targetType: this._classifyTarget(target),
            remainingHealth: healthComponent?.health,
            damageSource
        };
        this.eventBus.emit<CombatDamageEvent>('combat:damage', event);
    }

    private _classifyTarget(entity: Entity | null): 'player' | 'boss' | 'enemy' | null {
        if (!entity || typeof entity.hasComponent !== 'function') {
            return null;
        }
        if (entity.hasComponent(Player)) {
            return 'player';
        }
        if (entity.hasComponent(Boss)) {
            return 'boss';
        }
        if (entity.hasComponent(Enemy)) {
            return 'enemy';
        }
        return null;
    }

    getDiagnostics(): { cells: number; entities: number } | null {
        return null;
    }

    private _getProjectileDamage(projectile: Entity | null, fallback: number): number {
        if (!projectile) {
            return fallback;
        }
        const damageValue = (projectile as unknown as { damage?: number }).damage;
        return typeof damageValue === 'number' ? damageValue : fallback;
    }

    private _applyShieldAbsorb(abilities: PlayerAbilities | null, amount: number): { damage: number; absorbed: number; broke: boolean } {
        if (!abilities || abilities.activeShield <= 0 || abilities.activeShieldStrength <= 0 || amount <= 0) {
            return { damage: amount, absorbed: 0, broke: false };
        }

        const absorbed = Math.min(abilities.activeShieldStrength, amount);
        abilities.activeShieldStrength = Math.max(0, abilities.activeShieldStrength - absorbed);
        if (abilities.activeShieldStrength <= 0) {
            abilities.activeShield = 0;
        }

        return {
            damage: Math.max(0, amount - absorbed),
            absorbed,
            broke: abilities.activeShieldStrength <= 0
        };
    }

    private _getScreen(): PIXI.Rectangle {
        const renderer = this.game.app.renderer;
        return renderer ? renderer.screen : this.game.app.screen;
    }
}

export class UISystem extends System {
    private readonly game: RuntimeGameContext;
    private readonly uiService: UiService | null;

    constructor(game: RuntimeGameContext, uiService: UiService | null = null) {
        super();
        this.game = game;
        this.uiService = uiService;
    }

    update(entities: Entity[], delta: number): void {
        const playerEntity = entities.find(entity => entity.hasComponent(Player));
        if (playerEntity) {
            const components = getComponents(playerEntity, Player, Health);
            if (!components) {
                return;
            }

            const [playerComponent, health] = components;
            const maxHealth = typeof health.max === 'number' ? health.max : 100;
            this.uiService?.updateHealth(health.health, maxHealth);

            const stats = playerComponent as unknown as { combo?: number; lives?: number };
            this.uiService?.updateCombo(stats.combo ?? 0);
            this.uiService?.updateLives(stats.lives ?? 0);
        }

        const bossEntity = entities.find(entity => entity.hasComponent(Boss));
        if (bossEntity) {
            const bossHealth = getComponentOrNull(bossEntity, Health);
            if (bossHealth) {
                const max = typeof bossHealth.max === 'number' ? bossHealth.max : 500;
                this.uiService?.updateBossHealth(bossHealth.health, max);
                this.uiService?.setBossHealthVisible(true);
            }
        } else {
            this.uiService?.setBossHealthVisible(false);
        }
    }
}


export class BossAISystem extends System {
    private readonly game: CombatGameContext;
    private readonly eventBus: EventBus | null;
    private readonly uiService: UiService | null;

    constructor(game: CombatGameContext, uiService: UiService | null = null) {
        super();
        this.game = game;
        this.eventBus = this._resolveEventBus(game.services);
        this.uiService = uiService ?? null;
    }

    update(entities: Entity[], delta: number): void {
        const screen = this._getScreen();

        entities.forEach(entity => {
            if (!entity.hasComponent(Boss) || !entity.hasComponent(Motion) || !entity.hasComponent(Transform)) {
                return;
            }

            const bossEntity = entity as BossRuntimeEntity;
            if (bossEntity._stasisPaused) {
                return;
            }

            const components = getComponents(entity, Motion, Transform);
            if (!components) {
                return;
            }

            const [motion, transform] = components;
            const health = getComponentOrNull(entity, Health);
            const phaseComponent = getComponentOrNull(entity, BossPhase);

            let currentPhase: BossPhaseData | null = null;

            if (phaseComponent && health) {
                const changedPhase = phaseComponent.update(health.health) as BossPhaseData | null;
                currentPhase = phaseComponent.getCurrent() as BossPhaseData | null;

                if (changedPhase?.message) {
                    this.uiService?.showMessage(changedPhase.message, '#66ccff');
                }

                if (changedPhase) {
                    this._applyPhaseBehavior(bossEntity, changedPhase);
                }
            } else if (phaseComponent) {
                currentPhase = phaseComponent.getCurrent() as BossPhaseData | null;
            }

            const horizontalSpeed = typeof currentPhase?.horizontalSpeed === 'number'
                ? currentPhase.horizontalSpeed
                : motion.speed ?? 2;

            bossEntity._direction = bossEntity._direction ?? 1;
            if (transform.position.x < 80) {
                bossEntity._direction = 1;
            } else if (transform.position.x > screen.width - 80) {
                bossEntity._direction = -1;
            }

            motion.velocity.x = horizontalSpeed * bossEntity._direction;
            motion.velocity.y = typeof currentPhase?.verticalDrift === 'number' ? currentPhase.verticalDrift : 0;
        });
    }

    private _resolveEventBus(services?: ServiceLocator): EventBus | null {
        if (!services) {
            return null;
        }
        try {
            return services.resolve<EventBus>('eventBus');
        } catch (error) {
            return null;
        }
    }

    private _applyShieldAbsorb(abilities: PlayerAbilities | null, amount: number): { damage: number; absorbed: number; broke: boolean } {
        if (!abilities || abilities.activeShield <= 0 || abilities.activeShieldStrength <= 0 || amount <= 0) {
            return { damage: amount, absorbed: 0, broke: false };
        }

        const absorbed = Math.min(abilities.activeShieldStrength, amount);
        abilities.activeShieldStrength = Math.max(0, abilities.activeShieldStrength - absorbed);
        if (abilities.activeShieldStrength <= 0) {
            abilities.activeShield = 0;
        }

        return {
            damage: Math.max(0, amount - absorbed),
            absorbed,
            broke: abilities.activeShieldStrength <= 0
        };
    }

    private _getProjectileDamage(projectile: Entity | null, fallback: number): number {
        if (!projectile) {
            return fallback;
        }
        const damageValue = (projectile as unknown as { damage?: number }).damage;
        return typeof damageValue === 'number' ? damageValue : fallback;
    }

    private _applyPhaseBehavior(entity: BossRuntimeEntity, phase: BossPhaseData): void {
        const treeComponent = getComponentOrNull(entity, BehaviorTreeComponent);
        if (treeComponent && phase.behaviorTreeId) {
            treeComponent.treeId = phase.behaviorTreeId;
            treeComponent.steps = [];
            treeComponent.stepIndex = 0;
            treeComponent.stepElapsed = 0;
            treeComponent.current = null;
        }

        const weapon = getComponentOrNull(entity, Weapon);
        if (weapon) {
            if (phase.weaponId) {
                weapon.weaponId = phase.weaponId;
            }
            if (typeof phase.fireRate === 'number') {
                weapon.cooldown = phase.fireRate;
                weapon.fireRate = phase.fireRate;
            }
            weapon.isShooting = false;
            weapon.triggerShot = false;
            weapon.fireTimer = 0;
        }

        if (phase.telegraphEffect) {
            this._handleTelegraph(entity, {
                message: phase.message ?? null,
                effect: phase.telegraphEffect,
                duration: phase.telegraphDuration,
                tint: phase.telegraphTint,
                scale: phase.telegraphScale,
                alpha: phase.telegraphAlpha,
                offsetY: phase.telegraphOffsetY,
                position: phase.telegraphPosition ?? null
            });
        }

        const summonTargets = this._normalizeSummonTargets(phase.summon);
        summonTargets.forEach(target => this._summonTarget(entity, target));

        this.eventBus?.emit('boss:phase-change', { ...phase });
    }

    private _handleTelegraph(entity: BossRuntimeEntity, telegraph: BossTelegraphOptions): void {
        if (telegraph.message) {
            this.uiService?.showMessage(telegraph.message, '#ffcc66');
        }

        this.eventBus?.emit('boss:telegraph', {
            entity,
            ...telegraph
        });

        const transform = getComponentOrNull(entity, Transform);
        const basePosition = transform
            ? { x: transform.position.x, y: transform.position.y }
            : { x: 0, y: 0 };

        const effectOptions: EffectSpawnOptions = {
            position: {
                x: telegraph.position?.x ?? basePosition.x,
                y: telegraph.position?.y ?? (basePosition.y - (telegraph.offsetY ?? 0))
            },
            lifeTime: telegraph.duration ?? 0.6,
            tint: telegraph.tint ?? 0xffddaa,
            scale: telegraph.scale ?? 1.6,
            alpha: telegraph.alpha ?? 0.85
        };

        this.game.spawnEffect(effectOptions);
    }

    private _resolveEffectDescriptor(effect: EffectDescriptor | string | null | undefined): Partial<EffectSpawnOptions> {
        if (!effect) {
            return {};
        }

        if (typeof effect === 'string') {
            const trimmed = effect.trim();
            if (!trimmed) {
                return {};
            }
            if (trimmed.startsWith('vfx-atlas-')) {
                const animation = trimmed.replace('vfx-atlas-', '').replace(/_/g, '-');
                return { atlasAlias: 'vfx-atlas', animation };
            }
            return { atlasAlias: trimmed };
        }

        if (typeof effect === 'object') {
            const descriptor = effect as EffectDescriptor & { atlasAlias?: string; atlas?: string; sequence?: string; speed?: number };
            const atlas = descriptor.atlasAlias ?? descriptor.atlas ?? null;
            const animation = descriptor.animation ?? descriptor.sequence ?? null;
            const animationSpeed = descriptor.animationSpeed ?? descriptor.speed ?? undefined;
            const loop = descriptor.loop;
            const result: Partial<EffectSpawnOptions> = {};
            if (atlas) {
                result.atlasAlias = atlas;
            }
            if (animation) {
                result.animation = animation;
            }
            if (typeof animationSpeed === 'number' && Number.isFinite(animationSpeed)) {
                result.animationSpeed = animationSpeed;
            }
            if (typeof loop === 'boolean') {
                result.loop = loop;
            }
            return result;
        }

        return {};
    }

    private _normalizeSummonTargets(targets?: BehaviorSummonTarget[]): BehaviorSummonTargetConfig[] {
        if (!Array.isArray(targets)) {
            return [];
        }
        return targets.map(target => (typeof target === 'string' ? { template: target } : target));
    }

    private _summonTarget(entity: BossRuntimeEntity, target: BehaviorSummonTargetConfig): void {
        const templateDef = this._resolveSummonTemplate(target);
        if (!templateDef) {
            console.warn('BossAISystem: summon template not found', target);
            return;
        }

        const count = Math.max(1, target.count ?? 1);
        const radius = typeof target.radius === 'number' ? target.radius : 80;
        const verticalRadius = typeof target.verticalRadius === 'number' ? target.verticalRadius : radius * 0.6;
        const angleOffset = typeof target.angleOffset === 'number' ? target.angleOffset : 0;
        const transform = getComponentOrNull(entity, Transform);
        const screen = this._getScreen();
        const baseX = target.position?.x ?? (transform ? transform.position.x : screen.width / 2);
        const baseY = target.position?.y ?? (transform ? transform.position.y + 40 : screen.height / 3);

        for (let i = 0; i < count; i += 1) {
            const t = count === 1 ? 0 : i / count;
            const angle = angleOffset + t * Math.PI * 2;
            const offsetX = Math.cos(angle) * radius;
            const offsetY = Math.sin(angle) * verticalRadius;

            const context: EnemySpawnContext = {
                position: {
                    x: baseX + (target.offset?.x ?? 0) + offsetX,
                    y: baseY + (target.offset?.y ?? 0) + offsetY
                }
            };

            this.game.spawnEnemyFromTemplate(templateDef, context);
        }
    }

    private _resolveSummonTemplate(target: BehaviorSummonTargetConfig): EnemySpawnTemplate | null {
        if (target.template && typeof target.template === 'object') {
            return target.template as EnemySpawnTemplate;
        }

        const templateId = typeof target.template === 'string' ? target.template : target.templateId ?? target.id;
        if (!templateId) {
            return null;
        }

        const templates = this._getEnemyTemplates();
        return templates.find(entry => entry.id === templateId) ?? null;
    }

    private _getEnemyTemplates(): EnemySpawnTemplate[] {
        const options = this.game.sceneOptions ?? {};
        const enemies = options.enemies ?? {};
        return Array.isArray(enemies.templates) ? enemies.templates as EnemySpawnTemplate[] : [];
    }

    private _getScreen(): PIXI.Rectangle {
        const renderer = this.game.app.renderer;
        return renderer ? renderer.screen : this.game.app.screen;
    }
}

export class BossShootingSystem extends System {
    private readonly game: CombatGameContext;
    private _fallbackTimer = 0;

    constructor(game: CombatGameContext) {
        super();
        this.game = game;
    }

    update(entities: Entity[], delta: number): void {
        const deltaSeconds = delta / 60;

        entities.forEach(entity => {
            if (!entity.hasComponent(Boss) || !entity.hasComponent(Transform)) {
                return;
            }

            const bossEntity = entity as BossRuntimeEntity;
            if (bossEntity._stasisPaused) {
                return;
            }

            const transform = getComponentOrNull(entity, Transform);
            if (!transform) {
                return;
            }

            const phaseComponent = getComponentOrNull(entity, BossPhase);
            const phase = phaseComponent ? (phaseComponent.getCurrent() as BossPhaseData | null) : null;
            const fireRate = typeof phase?.fireRate === 'number' ? phase.fireRate : 1;

            if (phaseComponent) {
                phaseComponent.fireTimer += deltaSeconds;
                if (phaseComponent.fireTimer < fireRate) {
                    return;
                }
                phaseComponent.fireTimer = 0;
            } else {
                this._fallbackTimer += deltaSeconds;
                if (this._fallbackTimer < fireRate) {
                    return;
                }
                this._fallbackTimer = 0;
            }

            this._spawnProjectiles(transform, phase);
        });
    }

    private _spawnProjectiles(transform: Transform, phase: BossPhaseData | null): void {
        const velocities: ProjectileVelocity[] = [];
        const pattern = typeof phase?.pattern === 'string' ? phase.pattern : 'spread';

        switch (pattern) {
            case 'burst':
                velocities.push({ vx: 0, vy: 6 });
                velocities.push({ vx: 1.5, vy: 5.4 });
                velocities.push({ vx: -1.5, vy: 5.4 });
                velocities.push({ vx: 2.4, vy: 5.0 });
                velocities.push({ vx: -2.4, vy: 5.0 });
                break;
            case 'spiral': {
                const steps = 6;
                const offset = phase?.spiralOffset ?? 0;
                for (let i = 0; i < steps; i += 1) {
                    const angle = offset + (Math.PI * 2 * i) / steps;
                    velocities.push({ vx: Math.cos(angle) * 4, vy: Math.sin(angle) * 4 + 3 });
                }
                if (phase) {
                    phase.spiralOffset = (offset + 0.6) % (Math.PI * 2);
                }
                break;
            }
            case 'spread':
            default:
                velocities.push({ vx: 0, vy: 6 });
                velocities.push({ vx: 1.2, vy: 5.4 });
                velocities.push({ vx: -1.2, vy: 5.4 });
                break;
        }

        velocities.forEach(velocity => {
            const bullet = new Entity();
            bullet.addComponent(new Transform({ x: transform.position.x, y: transform.position.y + 50 }));
            const sprite = new Sprite(PIXI.Texture.WHITE);
            sprite.sprite.width = 10;
            sprite.sprite.height = 10;
            sprite.sprite.tint = 0xff5555;
            bullet.addComponent(sprite);
            bullet.addComponent(new Motion({ x: velocity.vx, y: velocity.vy }));
            bullet.addComponent(new EnemyBullet());
            bullet.addComponent(new Collider(5));

            this.game.addEntity(bullet);
        });
    }
}

export class BoundaryCleanupSystem extends System {
    private readonly game: RuntimeGameContext;
    private readonly padding: number;

    constructor(game: RuntimeGameContext, padding = 80) {
        super();
        this.game = game;
        this.padding = padding;
    }

    update(entities: Entity[], delta: number): void {
        const screen = this._getScreen();

        entities.forEach(entity => {
            const transform = getComponentOrNull(entity, Transform);
            if (!transform) {
                return;
            }

            if (entity.hasComponent(Player)) {
                return;
            }

            const { x, y } = transform.position;
            if (
                x < -this.padding ||
                x > screen.width + this.padding ||
                y < -this.padding ||
                y > screen.height + this.padding
            ) {
                entity.isRemoved = true;
            }
        });
    }

    private _getScreen(): PIXI.Rectangle {
        const renderer = this.game.app.renderer;
        return renderer ? renderer.screen : this.game.app.screen;
    }
}


export class CleanupSystem extends System {
    private readonly game: RuntimeGameContext;

    constructor(game: RuntimeGameContext) {
        super();
        this.game = game;
    }

    update(entities: Entity[], delta: number): void {
        const collection = this.game.entities ?? entities;

        for (let i = collection.length - 1; i >= 0; i -= 1) {
            const entity = collection[i];
            if (!entity.isRemoved) {
                continue;
            }

            const runtimeEntity = entity as RuntimeEntity;
            if (runtimeEntity.poolId && typeof this.game.releaseEntity === 'function') {
                this.game.releaseEntity(runtimeEntity, i);
                continue;
            }

            const spriteComponent = getComponentOrNull(entity, Sprite);
            if (spriteComponent) {
                const { sprite } = spriteComponent;
                if (sprite.parent) {
                    sprite.parent.removeChild(sprite);
                }
            }

            collection.splice(i, 1);

            if (collection !== entities) {
                const index = entities.indexOf(entity);
                if (index >= 0) {
                    entities.splice(index, 1);
                }
            }
        }
    }
}

export class MissileGuidanceSystem extends System {
    private readonly game: CombatGameContext;
    private readonly guidance = new ProportionalNavigationGuidance(3);

    constructor(game: CombatGameContext) {
        super();
        this.game = game;
    }

    update(entities: Entity[], delta: number): void {
        const deltaSeconds = delta / 60;
        const player = entities.find(e => e.hasComponent(Player));
        const enemies = entities.filter(e => e.hasComponent(Enemy));

        entities.forEach(entity => {
            if (!entity.hasComponent(HomingMissile) || !entity.hasComponent(Guidance) || !entity.hasComponent(Motion)) {
                return;
            }
            const guidanceComp = entity.getComponent(Guidance)!;
            const motion = entity.getComponent(Motion)!;

            const target = guidanceComp.target === 'player' ? player : enemies[0];
            if (!target) {
                return;
            }

            const accel = this.guidance.update(entity, target, deltaSeconds);
            motion.velocity.x += accel.x * deltaSeconds * 120; // amplify for visibility
            motion.velocity.y += accel.y * deltaSeconds * 120;
        });
    }
}

export class CyborgLimbSystem extends System {
    private readonly game: CombatGameContext;
    private readonly eventBus: EventBus | null;

    constructor(game: CombatGameContext, services?: ServiceLocator) {
        super();
        this.game = game;
        this.eventBus = services ? ((): EventBus | null => {
            try { return services.resolve<EventBus>('eventBus'); } catch { return null; }
        })() : null;
    }

    update(entities: Entity[], _delta: number): void {
        entities.forEach(entity => {
            if (!entity.hasComponent(CyborgLimb) || !entity.hasComponent(Health)) {
                return;
            }
            const limb = entity.getComponent(CyborgLimb)!;
            const health = entity.getComponent(Health)!;
            const threshold = Math.max(1, Math.floor(limb.maxHealth * 0.3));
            if (limb.isAttached && health.health <= threshold) {
                limb.isAttached = false;
                // give detached motion nudge
                const motion = getComponentOrNull(entity, Motion) || entity.addComponent(new Motion());
                motion.velocity.x = (Math.random() * 2 - 1) * 3;
                motion.velocity.y = (Math.random() * 2 - 1) * 3;
                this.eventBus?.emit('cyborg:limb-detached', { entity });
                // small spark effect
                this.game.spawnEffect({ position: { x: entity.getComponent(Transform)?.position.x ?? 0, y: entity.getComponent(Transform)?.position.y ?? 0 }, alpha: 0.9, scale: 1.2 });
            }
        });
    }
}

export class ArenaEnvironmentSystem extends System {
    private readonly game: CombatGameContext;
    private _timer = 0;
    private readonly _interval = 1.0; // seconds

    constructor(game: CombatGameContext) {
        super();
        this.game = game;
    }

    update(_entities: Entity[], delta: number): void {
        this._timer += delta / 60;
        if (this._timer >= this._interval) {
            this._timer = 0;
            const screen = (this.game.app as any)?.renderer?.screen || this.game.app.screen;
            const x = Math.random() * (screen?.width || 800);
            const y = (screen?.height || 600) * 0.2;
            this.game.spawnEffect({ position: { x, y }, alpha: 0.8, scale: 1.0 });
        }
    }
}