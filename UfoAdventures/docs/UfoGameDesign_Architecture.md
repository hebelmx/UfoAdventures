# UFO Space Adventure - Architecture & Systems (v1.1)

> Sections 1-11 from the original design doc covering architecture, systems, and tooling.

> Enhanced architecture document for developers. Describes modular architecture, scene flow, game loop, entity management, and persistence with improved patterns and best practices.

---

## 1) Enhanced Architecture Overview

**Stack**: HTML5 Canvas, TypeScript/ES6+, CSS, WebAudio, IndexedDB. GPU: WebGL via PixiJS with Canvas fallback.

**Architecture Pattern**: Clean ECS + Command Pattern + Observer Pattern + Service Locator

```
┌──────────────────────────────────────────────────────────────────┐
│                        GameApplication                           │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ │
│  │ ConfigSvc   │ │ ResourceMgr │ │ SceneMgr    │ │ AudioSvc    │ │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘ │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ │
│  │ InputSvc    │ │ EventBus    │ │ SaveSvc     │ │ UISvc       │ │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘ │
└────────────────────────────┬─────────────────────────────────────┘
                             │ manages
                             ▼
┌────────────────────────────┴─────────────────────────────────────┐
│                    GameLoop (RAF + Fixed Timestep)               │
│   Initialize() → Start() → Update(deltaTime) → Render() → Loop   │
└────────────────────────────┬─────────────────────────────────────┘
                             │ orchestrates
                             ▼
┌────────────────────────────┴─────────────────────────────────────┐
│ SystemManager: IPhysicsSystem | ICollisionSystem | IAISystem     │
│ IRenderSystem | IWeaponSystem | ISpawningSystem | IUISystem      │
└────────────────────────────┬─────────────────────────────────────┘
                             │ operates on
                             ▼
┌────────────────────────────┴─────────────────────────────────────┐
│ EntityManager: Entity = ComponentContainer                       │
│ Components: ITransform, IMotion, ICollider, ISprite, IWeapon,   │
│ IHealth, IScoreProvider, IAIBrain, ILifetime, IMagicInventory   │
└──────────────────────────────────────────────────────────────────┘
```

**Core Principles**

- **Separation of Concerns**: Each system has a single responsibility
- **Dependency Injection**: Services registered via ServiceLocator
- **Event-Driven**: Loose coupling through EventBus with typed events
- **Data-Driven**: Configuration externalized to JSON with schema validation
- **Performance**: Object pooling, spatial partitioning, GPU acceleration

---

## 2) Improved Scene Management

```
[BOOTSTRAP] → [ASSET_LOADING] → [MAIN_MENU]
     │                               │
     │                               ├─→ Campaign → [ADVENTURE_MODE]
     │                               ├─→ Arcade → [ARCADE_MODE]  
     │                               ├─→ Practice → [TRAINING_MODE]
     │                               ├─→ Settings → [OPTIONS_MENU]
     │                               └─→ Credits → [CREDITS_SCENE]
     │                                             │
     └─────────────────────────────────────────────┘

Game States: [PLAYING] ⟷ [PAUSED] ⟷ [INVENTORY]
End States:  [VICTORY] | [DEFEAT] → [RESULTS] → [LEADERBOARD] → [MAIN_MENU]
```

**Enhanced SceneManager**

```typescript
interface IScene {
  readonly id: string;
  initialize(context: ISceneContext): Promise<void>;
  enter(parameters?: any): Promise<void>;
  update(deltaTime: number): void;
  render(renderer: IRenderer): void;
  exit(): Promise<void>;
  dispose(): void;
}

interface ISceneTransition {
  execute(from: IScene, to: IScene): Promise<void>;
}

class SceneManager {
  private sceneStack: IScene[] = [];
  private transitions: Map<string, ISceneTransition> = new Map();
  
  pushScene(sceneId: string, params?: any, transition?: string): Promise<void>
  popScene(transition?: string): Promise<void>
  replaceScene(sceneId: string, params?: any, transition?: string): Promise<void>
}
```

---

## 3) Enhanced Game Loop with Performance Monitoring

```typescript
class GameLoop {
  private readonly FIXED_TIMESTEP = 1000 / 60; // 16.67ms
  private readonly MAX_FRAME_SKIP = 5;
  
  private accumulator = 0;
  private lastFrameTime = 0;
  private frameCount = 0;
  private fpsTimer = 0;
  private currentFPS = 0;
  
  private performanceMetrics = {
    updateTime: 0,
    renderTime: 0,
    systemTimes: new Map<string, number>()
  };

  run(): void {
    const currentTime = performance.now();
    const frameTime = Math.min(currentTime - this.lastFrameTime, 250); // Cap at 250ms
    
    this.lastFrameTime = currentTime;
    this.accumulator += frameTime;
    
    // Fixed timestep updates
    let updateCount = 0;
    while (this.accumulator >= this.FIXED_TIMESTEP && updateCount < this.MAX_FRAME_SKIP) {
      this.update(this.FIXED_TIMESTEP / 1000);
      this.accumulator -= this.FIXED_TIMESTEP;
      updateCount++;
    }
    
    // Variable timestep rendering
    const interpolation = this.accumulator / this.FIXED_TIMESTEP;
    this.render(interpolation);
    
    this.updatePerformanceMetrics();
    requestAnimationFrame(() => this.run());
  }
}
```

---

## 4) Enhanced Component System

```typescript
// Base interfaces with proper typing
interface IComponent {
  readonly type: ComponentType;
  enabled: boolean;
  entity?: Entity;
}

interface ITransform extends IComponent {
  position: Vector2;
  rotation: number;
  scale: Vector2;
  parent?: ITransform;
  readonly worldPosition: Vector2;
  readonly worldRotation: number;
}

interface IMotion extends IComponent {
  velocity: Vector2;
  acceleration: Vector2;
  angularVelocity: number;
  maxSpeed: number;
  drag: number;
}

interface ICollider extends IComponent {
  shape: CollisionShape;
  bounds: Rectangle;
  layer: CollisionLayer;
  mask: CollisionMask;
  isTrigger: boolean;
  material: PhysicsMaterial;
}

interface IWeapon extends IComponent {
  weaponType: WeaponType;
  cooldownTimer: number;
  ammunition: number;
  heatLevel: number;
  accuracy: number;
  damage: DamageInfo;
}

// Enhanced magic system
interface IMagicInventory extends IComponent {
  spells: Map<SpellType, SpellData>;
  selectedSpell: SpellType;
  globalCooldown: number;
  manaPoints: number;
  maxMana: number;
}
```

---

## 5) Advanced Enemy System

### 5.1 AI State Machine

```typescript
interface IAIBrain extends IComponent {
  stateMachine: StateMachine<AIState>;
  blackboard: Map<string, any>;
  detectionRadius: number;
  attackRange: number;
  lastKnownPlayerPosition?: Vector2;
}

enum AIState {
  Idle,
  Patrol,
  Chase,
  Attack,
  Retreat,
  Dead
}

class AISystem implements ISystem {
  update(entities: Entity[], deltaTime: number): void {
    for (const entity of entities.filter(e => e.has(IAIBrain))) {
      const brain = entity.get(IAIBrain);
      const currentState = brain.stateMachine.currentState;
      
      switch (currentState) {
        case AIState.Patrol:
          this.executePatrolBehavior(entity, brain, deltaTime);
          break;
        case AIState.Chase:
          this.executeChaseBehavior(entity, brain, deltaTime);
          break;
        case AIState.Attack:
          this.executeAttackBehavior(entity, brain, deltaTime);
          break;
      }
      
      brain.stateMachine.update(deltaTime);
    }
  }
}
```

### 5.2 Enhanced Enemy Types

```typescript
// Configurable enemy templates
interface EnemyTemplate {
  id: string;
  components: ComponentTemplate[];
  behaviorTree: BehaviorNodeTemplate;
  spawnWeight: number;
  difficultyModifiers: DifficultyModifier[];
}

const ENEMY_TEMPLATES: Record<string, EnemyTemplate> = {
  "alien_basic": {
    id: "alien_basic",
    components: [
      { type: "Transform", data: { scale: { x: 1, y: 1 } } },
      { type: "Motion", data: { maxSpeed: 150 } },
      { type: "Health", data: { maxHP: 2 } },
      { type: "Weapon", data: { type: "laser_basic", cooldown: 2.0 } }
    ],
    behaviorTree: "zigzag_shooter",
    spawnWeight: 1.0,
    difficultyModifiers: [
      { stat: "maxSpeed", easy: 0.7, normal: 1.0, hard: 1.3 },
      { stat: "cooldown", easy: 1.5, normal: 1.0, hard: 0.6 }
    ]
  }
};
```

---

## 6) Advanced Weapon & Magic Systems

### 6.1 Weapon System Redesign

```typescript
interface IWeaponSystem extends ISystem {
  registerWeaponType(type: WeaponType, factory: WeaponFactory): void;
  fire(entity: Entity, target?: Vector2): void;
  canFire(entity: Entity): boolean;
}

abstract class WeaponBase {
  abstract fire(shooter: Entity, target: Vector2): Projectile[];
  abstract canFire(weapon: IWeapon): boolean;
  abstract update(weapon: IWeapon, deltaTime: number): void;
}

class LaserWeapon extends WeaponBase {
  fire(shooter: Entity, target: Vector2): Projectile[] {
    const transform = shooter.get(ITransform);
    const projectile = ProjectileFactory.createLaser({
      position: transform.position,
      direction: Vector2.normalize(Vector2.subtract(target, transform.position)),
      damage: this.damage,
      speed: this.projectileSpeed
    });
    return [projectile];
  }
}

class MissileWeapon extends WeaponBase {
  fire(shooter: Entity, target: Vector2): Projectile[] {
    const missiles: Projectile[] = [];
    for (let i = 0; i < this.volleySize; i++) {
      const missile = ProjectileFactory.createGuidedMissile({
        position: this.getBarrelPosition(shooter, i),
        target: target,
        guidance: this.guidanceType,
        damage: this.damage
      });
      missiles.push(missile);
    }
    return missiles;
  }
}
```

): boolean;
  beginCast(caster: Entity): void;
  executeCast(caster: Entity): void;
  cancelCast(caster: Entity): void;
}

class ShieldSpell implements ISpell {
  readonly id = SpellType.Shield;
  readonly manaCost = 25;
  readonly cooldown = 10.0;
  readonly castTime = 0.5;
  
  executeCast(caster: Entity): void {
    const shieldEntity = EntityFactory.createShield({
      owner: caster,
      duration: 5.0,
      absorptionAmount: 100
    });
    
    EventBus.emit(new SpellCastEvent({
      caster: caster,
      spell: this,
      effect: shieldEntity
    }));
  }
}
```

### 6.3 Level 3: Pet Cyborg Arena

**Scene Overview**
The UFO enters a futuristic arena with metallic platforms and neon-lit edges, facing the modular Pet Cyborg boss - a segmented robotic creature with detachable limbs that fight independently.

```typescript
interface ICyborgLimb extends IComponent {
  limbType: LimbType;
  parentCore: Entity;
  detachmentHealth: number;
  isDetached: boolean;
  reattachCooldown: number;
  attackPattern: AttackPattern;
}

interface ICyborgCore extends IComponent {
  attachedLimbs: Entity[];
  detachedLimbs: Entity[];
  vulnerabilityWindow: number;
  enrageThreshold: number;
  isVulnerable: boolean;
}

enum LimbType {
  LeftArm = "left_arm",
  RightArm = "right_arm", 
  LeftLeg = "left_leg",
  RightLeg = "right_leg",
  Tail = "tail",
  Head = "head"
}

class PetCyborgBoss {
  private readonly limbTemplates: Record<LimbType, LimbTemplate> = {
    [LimbType.LeftArm]: {
      spriteSize: { width: 128, height: 128 },
      health: 150,
      attackPattern: AttackPattern.PunchCombo,
      detachDistance: 200,
      animations: ["idle", "punch", "detach", "reattach", "sparks"]
    },
    [LimbType.RightArm]: {
      spriteSize: { width: 128, height: 128 },
      health: 150,
      attackPattern: AttackPattern.LaserBeam,
      detachDistance: 300,
      animations: ["idle", "charge_laser", "fire_laser", "detach", "reattach"]
    },
    [LimbType.LeftLeg]: {
      spriteSize: { width: 128, height: 128 },
      health: 120,
      attackPattern: AttackPattern.Stomp,
      detachDistance: 150,
      animations: ["idle", "walk", "jump", "stomp", "detach", "sparks"]
    },
    [LimbType.RightLeg]: {
      spriteSize: { width: 128, height: 128 },
      health: 120,
      attackPattern: AttackPattern.Kick,
      detachDistance: 150,
      animations: ["idle", "walk", "kick", "detach", "reattach"]
    },
    [LimbType.Tail]: {
      spriteSize: { width: 128, height: 128 },
      health: 100,
      attackPattern: AttackPattern.Whip,
      detachDistance: 250,
      animations: ["idle", "whip", "detach", "autonomous_float"]
    },
    [LimbType.Head]: {
      spriteSize: { width: 128, height: 128 },
      health: 200,
      attackPattern: AttackPattern.PlasmaBurst,
      detachDistance: 180,
      animations: ["idle", "charge_plasma", "burst", "detach", "autonomous_attack"]
    }
  };

  initializeBoss(): Entity {
    const core = EntityFactory.createEntity();
    
    // Add core components
    core.add(new Transform({ position: new Vector2(400, 300) }));
    core.add(new Health({ maxHP: 500, currentHP: 500 }));
    core.add(new CyborgCore({
      attachedLimbs: [],
      detachedLimbs: [],
      vulnerabilityWindow: 0,
      enrageThreshold: 0.3,
      isVulnerable: false
    }));
    
    // Create and attach all limbs
    Object.values(LimbType).forEach(limbType => {
      const limb = this.createLimb(limbType, core);
      core.get(ICyborgCore).attachedLimbs.push(limb);
    });
    
    return core;
  }
  
  private createLimb(type: LimbType, parent: Entity): Entity {
    const template = this.limbTemplates[type];
    const limb = EntityFactory.createEntity();
    
    limb.add(new Transform({
      position: this.getLimbAttachPosition(parent, type),
      scale: new Vector2(1, 1)
    }));
    
    limb.add(new Health({
      maxHP: template.health,
      currentHP: template.health
    }));
    
    limb.add(new CyborgLimb({
      limbType: type,
      parentCore: parent,
      detachmentHealth: template.health * 0.3,
      isDetached: false,
      reattachCooldown: 0,
      attackPattern: template.attackPattern
    }));
    
    limb.add(new Sprite({
      texture: `cyborg_${type}`,
      size: template.spriteSize,
      animations: template.animations
    }));
    
    limb.add(new Collider({
      shape: CollisionShape.Rectangle,
      size: template.spriteSize,
      layer: CollisionLayer.Enemy
    }));
    
    return limb;
  }
}

class CyborgAI implements ISystem {
  update(entities: Entity[], deltaTime: number): void {
    entities.filter(e => e.has(ICyborgCore)).forEach(core => {
      this.updateCoreLogic(core, deltaTime);
    });
    
    entities.filter(e => e.has(ICyborgLimb)).forEach(limb => {
      this.updateLimbLogic(limb, deltaTime);
    });
  }
  
  private updateLimbLogic(limb: Entity, deltaTime: number): void {
    const cyborgLimb = limb.get(ICyborgLimb);
    const health = limb.get(IHealth);
    
    // Check for detachment condition
    if (!cyborgLimb.isDetached && health.currentHP <= cyborgLimb.detachmentHealth) {
      this.detachLimb(limb);
    }
    
    // Update behavior based on attachment state
    if (cyborgLimb.isDetached) {
      this.executeDetachedBehavior(limb, deltaTime);
    } else {
      this.executeAttachedBehavior(limb, deltaTime);
    }
  }
  
  private detachLimb(limb: Entity): void {
    const cyborgLimb = limb.get(ICyborgLimb);
    const core = cyborgLimb.parentCore;
    const coreComponent = core.get(ICyborgCore);
    
    cyborgLimb.isDetached = true;
    
    // Move from attached to detached list
    const index = coreComponent.attachedLimbs.indexOf(limb);
    if (index > -1) {
      coreComponent.attachedLimbs.splice(index, 1);
      coreComponent.detachedLimbs.push(limb);
    }
    
    // Spawn particle effects
    this.spawnDetachmentEffects(limb);
    
    // Play detachment animation
    limb.get(ISprite).playAnimation("detach");
    
    // Give autonomous movement
    limb.add(new Motion({
      velocity: Vector2.random().scale(100),
      maxSpeed: 150,
      drag: 0.95
    }));
    
    EventBus.emit(new LimbDetachedEvent({ limb, core }));
  }
  
  private spawnDetachmentEffects(limb: Entity): void {
    const position = limb.get(ITransform).position;
    
    // Sparks effect
    const sparks = EntityFactory.createParticleSystem({
      position: position,
      particleCount: 20,
      texture: "spark_particle",
      lifetime: 2.0,
      velocity: { min: 50, max: 150 },
      color: { start: Color.Yellow, end: Color.Orange }
    });
    
    // Smoke effect
    const smoke = EntityFactory.createParticleSystem({
      position: position,
      particleCount: 15,
      texture: "smoke_particle",
      lifetime: 3.0,
      velocity: { min: 20, max: 80 },
      color: { start: Color.Gray, end: Color.DarkGray }
    });
    
    GameState.scene.addEntity(sparks);
    GameState.scene.addEntity(smoke);
  }
}

// Arena Environment System
class ArenaEnvironment {
  private energySpikeTimer: number = 0;
  private readonly SPIKE_INTERVAL = 3.0; // seconds
  private readonly SPIKE_WARNING_TIME = 1.5;
  
  update(deltaTime: number): void {
    this.energySpikeTimer += deltaTime;
    
    if (this.energySpikeTimer >= this.SPIKE_INTERVAL) {
      this.triggerEnergySpikes();
      this.energySpikeTimer = 0;
    }
  }
  
  private triggerEnergySpikes(): void {
    const spikePositions = this.generateSpikePattern();
    
    // Warning phase
    spikePositions.forEach(pos => {
      const warning = EntityFactory.createWarningIndicator({
        position: pos,
        duration: this.SPIKE_WARNING_TIME,
        color: Color.Red,
        pulseRate: 2.0
      });
      GameState.scene.addEntity(warning);
    });
    
    // Actual spikes after warning
    setTimeout(() => {
      spikePositions.forEach(pos => {
        const spike = EntityFactory.createEnergySpike({
          position: pos,
          damage: 50,
          duration: 2.0,
          height: 200
        });
        GameState.scene.addEntity(spike);
      });
    }, this.SPIKE_WARNING_TIME * 1000);
  }
  
  private generateSpikePattern(): Vector2[] {
    const patterns = [
      this.generateGridPattern(),
      this.generateRandomPattern(),
      this.generateWavePattern(),
      this.generateCrossPattern()
    ];
    
    return patterns[Math.floor(Math.random() * patterns.length)];
  }
}
```

### 6.4 Complete Stage: Dimensional Portal Escape

**Scene Overview**
The final escape sequence through a cosmic backdrop with a giant swirling dimensional portal, floating platforms in pseudo-3D space, and time-sensitive bonus collection objectives.

```typescript
interface IPortalMechanics extends IComponent {
  isActive: boolean;
  activationProgress: number;
  requiredKeys: number;
  collectedKeys: number;
  portalSize: number;
  maxPortalSize: number;
  spiralSpeed: number;
}

interface ITimeBall extends IComponent {
  timeBonus: number; // seconds added to countdown
  magneticRange: number;
  isCollected: boolean;
  glowIntensity: number;
}

interface IMidogusKey extends IComponent {
  isCollected: boolean;
  unlocksPowerLevel: number;
  glowColor: Color;
  rotationSpeed: number;
}

interface IFloatingPlatform extends IComponent {
  movementPattern: PlatformMovementPattern;
  moveSpeed: number;
  platformDepth: number; // pseudo-3D depth
  safeZone: boolean;
}

enum PlatformMovementPattern {
  Static,
  Horizontal,
  Vertical,
  Circular,
  Figure8,
  Random
}

class DimensionalPortalScene implements IScene {
  readonly id = "dimensional_portal_escape";
  
  private portal: Entity;
  private midogusKey: Entity;
  private timeBalls: Entity[] = [];
  private platforms: Entity[] = [];
  private timeLimit: number = 180; // 3 minutes
  private currentTime: number = 0;
  private allEnemiesCleared: boolean = false;
  private allBonusesCollected: boolean = false;

  async initialize(context: ISceneContext): Promise<void> {
    this.setupCosmicBackground();
    this.createDimensionalPortal();
    this.generateFloatingPlatforms();
    this.spawnMidogusKey();
    this.spawnTimeBalls();
    this.spawnEscapeEnemies();
  }

  private createDimensionalPortal(): void {
    this.portal = EntityFactory.createEntity();
    
    this.portal.add(new Transform({
      position: new Vector2(1200, 300), // Far right of screen
      scale: new Vector2(1, 1)
    }));
    
    this.portal.add(new Sprite({
      texture: "dimensional_portal",
      size: { width: 256, height: 256 },
      animations: ["spiral_slow", "spiral_fast", "activation", "fully_open"]
    }));
    
    this.portal.add(new PortalMechanics({
      isActive: false,
      activationProgress: 0,
      requiredKeys: 1,
      collectedKeys: 0,
      portalSize: 64, // Start small
      maxPortalSize: 256,
      spiralSpeed: 1.0
    }));
    
    this.portal.add(new Collider({
      shape: CollisionShape.Circle,
      radius: 32, // Small initially
      layer: CollisionLayer.Objective,
      isTrigger: true
    }));

    // Add swirling particle effect
    const portalEffect = EntityFactory.createParticleSystem({
      position: this.portal.get(ITransform).position,
      particleCount: 100,
      texture: "energy_particle",
      lifetime: 4.0,
      emissionRate: 25,
      velocity: { min: 30, max: 80 },
      color: { start: Color.Purple, end: Color.Blue },
      pattern: ParticlePattern.Spiral
    });
    
    GameState.scene.addEntity(this.portal);
    GameState.scene.addEntity(portalEffect);
  }

  private checkWinConditions(): void {
    const player = GameState.player;
    const playerPos = player.get(ITransform).position;
    const portalPos = this.portal.get(ITransform).position;
    const portalMech = this.portal.get(IPortalMechanics);
    
    // Check if player reached activated portal
    if (portalMech.isActive && 
        Vector2.distance(playerPos, portalPos) <= portalMech.portalSize / 2) {
      
      let scoreMultiplier = 1.0;
      
      // Bonus scoring
      if (this.allEnemiesCleared) {
        scoreMultiplier += 0.5;
        UIService.showBonusMessage("All Enemies Cleared! +50% Score");
      }
      
      if (this.allBonusesCollected) {
        scoreMultiplier += 0.3;
        UIService.showBonusMessage("All Bonuses Collected! +30% Score");
      }
      
      const timeBonus = Math.max(0, this.timeLimit - this.currentTime) * 100;
      const finalScore = (GameState.score + timeBonus) * scoreMultiplier;
      
      EventBus.emit(new LevelCompleteEvent({
        levelId: "dimensional_portal_escape",
        score: finalScore,
        timeRemaining: this.timeLimit - this.currentTime,
        bonusesCollected: this.allBonusesCollected,
        enemiesCleared: this.allEnemiesCleared
      }));
      
      SceneManager.replaceScene("victory", {
        finalScore: finalScore,
        achievements: this.getAchievements()
      });
    }
  }
}

// Collision event handlers for collectibles
class CollectibleSystem implements ISystem {
  update(entities: Entity[], deltaTime: number): void {
    EventBus.on<CollisionEvent>("collision", (event) => {
      this.handleCollectiblePickup(event);
    });
  }
  
  private handleCollectiblePickup(event: CollisionEvent): void {
    const { entityA, entityB } = event;
    const player = GameState.player;
    
    // Check if player collected Midogus Key
    if ((entityA === player && entityB.has(IMidogusKey)) ||
        (entityB === player && entityA.has(IMidogusKey))) {
      
      const key = entityA === player ? entityB : entityA;
      const keyComp = key.get(IMidogusKey);
      
      if (!keyComp.isCollected) {
        keyComp.isCollected = true;
        
        // Update portal mechanics
        const portal = GameState.scene.findEntity("dimensional_portal");
        const portalMech = portal.get(IPortalMechanics);
        portalMech.collectedKeys++;
        
        // Play effects
        AudioService.playSound("key_pickup");
        key.get(ISprite).playAnimation("pickup");
        
        EventBus.emit(new KeyCollectedEvent({ key, player }));
      }
    }
  }
}
```

---

## 7) Enhanced Level 2: Missile Rain & GPU Acceleration

### 7.1 Advanced Missile Guidance

```typescript
interface IGuidanceSystem {
  update(missile: Entity, target: Entity, deltaTime: number): Vector2;
}

class ProportionalNavigationGuidance implements IGuidanceSystem {
  constructor(private navigationConstant: number = 3) {}
  
  update(missile: Entity, target: Entity, deltaTime: number): Vector2 {
    const missilePos = missile.get(ITransform).position;
    const targetPos = target.get(ITransform).position;
    const missileVel = missile.get(IMotion).velocity;
    
    const relativePosition = Vector2.subtract(targetPos, missilePos);
    const relativeVelocity = Vector2.subtract(target.get(IMotion).velocity, missileVel);
    
    const range = Vector2.magnitude(relativePosition);
    const losRate = Vector2.cross(relativePosition, relativeVelocity) / (range * range);
    
    const commandAcceleration = this.navigationConstant * losRate;
    return Vector2.perpendicular(Vector2.normalize(relativePosition)).scale(commandAcceleration);
  }
}

enum MissileType {
  SAM_Basic,
  InfraredHoming,
  RadarGuided,
  SwarmMissile,
  LaserGuided
}

interface MissileTemplate {
  type: MissileType;
  guidance: IGuidanceSystem;
  seeker: ISeekerSystem;
  warhead: IWarhead;
  countermeasureVulnerability: CountermeasureType[];
}
```

### 7.2 GPU Acceleration with WebGL

```typescript
class WebGLRenderer implements IRenderer {
  private readonly pixiApp: PIXI.Application;
  private readonly particleContainer: PIXI.ParticleContainer;
  private readonly spritePool: Map<string, PIXI.Sprite[]> = new Map();
  
  constructor(canvas: HTMLCanvasElement) {
    this.pixiApp = new PIXI.Application({
      view: canvas,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true
    });
    
    // Configure particle container for missiles and effects
    this.particleContainer = new PIXI.ParticleContainer(10000, {
      scale: true,
      position: true,
      rotation: true,
      uvs: true,
      alpha: true
    });
  }
  
  renderMissileTrails(missiles: Entity[]): void {
    missiles.forEach(missile => {
      const trail = missile.get(IParticleEmitter);
      if (trail) {
        this.updateParticleEffect(trail);
      }
    });
  }
  
  renderWithShaders(entities: Entity[]): void {
    // Apply heat distortion shader to engines
    // Apply glow shader to weapons
    // Apply atmospheric scattering to Earth
  }
}
```

### 7.3 Advanced Boss: Tarak Dragon

```typescript
interface IBossController extends IComponent {
  phases: BossPhase[];
  currentPhase: number;
  phaseTransitionTriggers: PhaseTransition[];
  ultimateAttacks: UltimateAttack[];
}

class TarakDragonBoss {
  private readonly phases: BossPhase[] = [
    {
      name: "Assault Phase",
      healthThreshold: 1.0,
      attacks: ["sweep_attack", "flame_burst", "minion_summon"],
      movementPattern: "aerial_strafe",
      duration: 45
    },
    {
      name: "Armored Phase", 
      healthThreshold: 0.7,
      attacks: ["orb_shield", "ground_slam", "energy_beam"],
      movementPattern: "defensive_hover",
      specialCondition: "destroy_guardian_orbs"
    },
    {
      name: "Enraged Phase",
      healthThreshold: 0.35,
      attacks: ["taraka_beam", "shockwave_nova", "death_spiral"],
      movementPattern: "aggressive_dive",
      timeLimit: 60
    }
  ];
  
  executeTarakaBeam(): void {
    // Telegraph phase
    this.playTelegraphEffect("taraka_charge", 2.5);
    
    // Execution phase  
    setTimeout(() => {
      const beam = EntityFactory.createVerticalBeam({
        width: 64,
        damage: 150,
        duration: 3.0,
        shockwaveCount: 8
      });
      
      this.createShockwavePattern(beam.position, 8, 24);
    }, 2500);
  }
}
```

---

## 8) Enhanced Data Management

### 8.1 Configuration System

```typescript
interface IConfigurationService {
  get<T>(key: string): T;
  set<T>(key: string, value: T): void;
  validate(schema: ConfigSchema): ValidationResult;
  watch<T>(key: string, callback: (value: T) => void): void;
}

interface GameBalance {
  player: {
    health: number;
    speed: number;
    weaponDamage: Record<WeaponType, number>;
    magicCooldowns: Record<SpellType, number>;
  };
  enemies: Record<string, EnemyBalance>;
  difficulty: {
    scaling: DifficultyScaling;
    modifiers: DifficultyModifiers;
  };
}

// Schema validation for configuration
const balanceSchema = {
  type: "object",
  properties: {
    player: {
      type: "object",
      properties: {
        health: { type: "number", minimum: 1, maximum: 1000 },
        speed: { type: "number", minimum: 50, maximum: 500 }
      },
      required: ["health", "speed"]
    }
  }
};
```

### 8.2 Enhanced Save System

```typescript
interface ISaveService {
  save(key: string, data: any): Promise<void>;
  load<T>(key: string): Promise<T | null>;
  delete(key: string): Promise<void>;
  list(): Promise<string[]>;
  migrate(fromVersion: string, toVersion: string): Promise<void>;
}

class IndexedDBSaveService implements ISaveService {
  private readonly DB_NAME = "UFOSpaceAdventure";
  private readonly DB_VERSION = 2;
  private db?: IDBDatabase;
  
  async save(key: string, data: any): Promise<void> {
    const serialized = {
      data: data,
      timestamp: Date.now(),
      version: this.DB_VERSION,
      checksum: this.calculateChecksum(data)
    };
    
    const transaction = this.db!.transaction(["saves"], "readwrite");
    const store = transaction.objectStore("saves");
    await store.put(serialized, key);
  }
  
  private calculateChecksum(data: any): string {
    // Simple checksum for data integrity
    return btoa(JSON.stringify(data)).slice(0, 16);
  }
}
```

---

## 9) Performance Optimizations

### 9.1 Object Pooling

```typescript
class ObjectPool<T> {
  private readonly pool: T[] = [];
  private readonly factory: () => T;
  private readonly reset: (obj: T) => void;
  
  constructor(factory: () => T, reset: (obj: T) => void, initialSize: number = 10) {
    this.factory = factory;
    this.reset = reset;
    
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(factory());
    }
  }
  
  acquire(): T {
    if (this.pool.length > 0) {
      return this.pool.pop()!;
    }
    return this.factory();
  }
  
  release(obj: T): void {
    this.reset(obj);
    this.pool.push(obj);
  }
}

// Usage
const projectilePool = new ObjectPool(
  () => new Projectile(),
  (projectile) => projectile.reset(),
  100
);
```

### 9.2 Spatial Partitioning

```typescript
class SpatialGrid {
  private readonly cellSize: number;
  private readonly grid: Map<string, Entity[]> = new Map();
  
  constructor(cellSize: number) {
    this.cellSize = cellSize;
  }
  
  insert(entity: Entity): void {
    const bounds = entity.get(ICollider).bounds;
    const cells = this.getCellsForBounds(bounds);
    
    for (const cell of cells) {
      const key = `${cell.x},${cell.y}`;
      if (!this.grid.has(key)) {
        this.grid.set(key, []);
      }
      this.grid.get(key)!.push(entity);
    }
  }
  
  query(bounds: Rectangle): Entity[] {
    const result: Entity[] = [];
    const cells = this.getCellsForBounds(bounds);
    
    for (const cell of cells) {
      const key = `${cell.x},${cell.y}`;
      const entities = this.grid.get(key) || [];
      result.push(...entities);
    }
    
    return Array.from(new Set(result)); // Remove duplicates
  }
}
```

---

## 10) Testing & Quality Assurance

### 10.1 Unit Testing Framework

```typescript
describe("WeaponSystem", () => {
  let weaponSystem: IWeaponSystem;
  let mockEntity: Entity;
  
  beforeEach(() => {
    weaponSystem = new WeaponSystem();
    mockEntity = EntityFactory.createTestEntity();
  });
  
  test("should fire projectile when weapon is ready", () => {
    // Arrange
    const weapon = mockEntity.get(IWeapon);
    weapon.cooldownTimer = 0;
    
    // Act
    const projectiles = weaponSystem.fire(mockEntity, Vector2.zero);
    
    // Assert
    expect(projectiles).toHaveLength(1);
    expect(weapon.cooldownTimer).toBeGreaterThan(0);
  });
  
  test("should not fire when weapon is on cooldown", () => {
    // Arrange
    const weapon = mockEntity.get(IWeapon);
    weapon.cooldownTimer = 1.0;
    
    // Act
    const projectiles = weaponSystem.fire(mockEntity, Vector2.zero);
    
    // Assert
    expect(projectiles).toHaveLength(0);
  });
});
```

### 10.2 Performance Profiling

```typescript
class PerformanceProfiler {
  private readonly measurements: Map<string, number[]> = new Map();
  
  startMeasurement(label: string): void {
    performance.mark(`${label}-start`);
  }
  
  endMeasurement(label: string): number {
    performance.mark(`${label}-end`);
    performance.measure(label, `${label}-start`, `${label}-end`);
    
    const measure = performance.getEntriesByName(label, "measure")[0];
    const duration = measure.duration;
    
    if (!this.measurements.has(label)) {
      this.measurements.set(label, []);
    }
    this.measurements.get(label)!.push(duration);
    
    return duration;
  }
  
  getAverageTime(label: string): number {
    const times = this.measurements.get(label) || [];
    return times.reduce((a, b) => a + b, 0) / times.length;
  }
}
```

---

## 11) Deployment & DevOps

### 11.1 Build Configuration

```typescript
// webpack.config.js
const config = {
  entry: "./src/main.ts",
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "game.[contenthash].js"
  },
  optimization: {
    splitChunks: {
      chunks: "all",
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: "vendors",
          chunks: "all"
        },
        engine: {
          test: /[\\/]src[\\/]core[\\/]/,
          name: "engine",
          chunks: "all"
        }
      }
    }
  },
  plugins: [
    new CompressionPlugin({
      algorithm: "gzip",
      test: /\.(js|css|html|svg)$/,
      threshold: 8192,
      minRatio: 0.8
    })
  ]
};
```

### 11.2 Asset Pipeline

```typescript
class AssetPipeline {
  async optimizeTextures(): Promise<void> {
    // Convert to WebP for modern browsers
    // Generate mipmaps for scaling
    // Compress using texture compression
  }
  
  async generateSpritesheets(): Promise<void> {
    // Pack individual sprites into atlases
    // Generate metadata for frame positions
    // Optimize for GPU texture formats
  }
  
  async compressAudio(): Promise<void> {
    // Convert to OGG Vorbis and MP3
    // Generate multiple quality levels
    // Create audio sprites for SFX
  }
}
```

---

