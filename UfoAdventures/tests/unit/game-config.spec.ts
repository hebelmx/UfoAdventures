import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { BehaviorTreeService } from '../../src/js/engine/behavior-tree-service';
import { EnemySpawningSystem } from '../../src/js/engine/systems';
import { ConfigService } from '../../src/js/engine/config-service';
import { ServiceLocator } from '../../src/js/engine/service-locator';
import { Health, Motion, Weapon, EnemyBehavior } from '../../src/js/engine/components';
import type { EnemySpawnTemplate, BehaviorTreeGameContext } from '../../src/js/engine/combat-types';

type BehaviorTreeStep = {
    type?: string;
    name?: string;
    duration?: number;
    weaponId?: string;
    targets?: Array<Record<string, unknown>>;
    summon?: Array<Record<string, unknown>>;
    children?: BehaviorTreeStep[];
};

const configPath = join(process.cwd(), 'src', 'config', 'game-config.json');
const gameConfig = JSON.parse(readFileSync(configPath, 'utf8')) as Record<string, unknown>;

const behaviorTrees = gameConfig.behaviorTrees as Record<string, BehaviorTreeStep>;
const weapons = gameConfig.weapons as Record<string, unknown>;
const assets = new Set((gameConfig.assets as Array<Record<string, unknown>>).map(asset => asset.alias as string));
const enemyTemplates = (gameConfig.enemies as Record<string, unknown>).templates as Array<Record<string, unknown>>;
const bossConfig = gameConfig.boss as Record<string, unknown>;

const supportedActions = new Set([
    'setOscillation',
    'setSwoop',
    'strafe',
    'telegraph',
    'summon',
    'fireWeapon'
]);

function collectSummonTargets(step: BehaviorTreeStep): string[] {
    const targets: string[] = [];
    const source = Array.isArray(step.targets) ? step.targets : Array.isArray(step.summon) ? step.summon : [];
    source.forEach(target => {
        if (typeof target?.template === 'string') {
            targets.push(target.template);
        } else if (typeof target?.templateId === 'string') {
            targets.push(target.templateId);
        } else if (typeof target?.id === 'string') {
            targets.push(target.id);
        }
    });
    return targets;
}

function traverseBehaviorTree(step: BehaviorTreeStep, visit: (node: BehaviorTreeStep) => void): void {
    if (!step) {
        return;
    }
    visit(step);
    if (Array.isArray(step.children)) {
        step.children.forEach(child => traverseBehaviorTree(child, visit));
    }
}

describe('game configuration', () => {
    const enemyIds = new Set(enemyTemplates.map(template => (template as any).id as string));

    it('references valid assets, weapons, and behaviour trees for each enemy template', () => {
        enemyTemplates.forEach(template => {
            const entry = template as any;
            const alias = entry.spritesheet?.alias as string | undefined;
            const behaviorTreeId = entry.behaviorTreeId as string | undefined;
            const weaponId = entry.weaponId as string | undefined;

            if (alias) {
                expect(assets.has(alias)).toBe(true);
            }
            if (behaviorTreeId) {
                expect(behaviorTrees).toHaveProperty(behaviorTreeId);
            }
            if (weaponId) {
                expect(weapons).toHaveProperty(weaponId);
            }
        });
    });

    it('exposes boss phases that reference known behaviours, weapons, and summonable templates', () => {
        const bossBehavior = (bossConfig as any).behaviorTreeId as string | undefined;
        if (bossBehavior) {
            expect(behaviorTrees).toHaveProperty(bossBehavior);
        }

        const phases = Array.isArray((bossConfig as any).phases) ? (bossConfig as any).phases as Array<Record<string, unknown>> : [];
        phases.forEach(phase => {
            const phaseEntry = phase as any;
            const phaseTree = phaseEntry.behaviorTreeId as string | undefined;
            if (phaseTree) {
                expect(behaviorTrees).toHaveProperty(phaseTree);
            }

            const weaponId = phaseEntry.weaponId as string | undefined;
            if (weaponId) {
                expect(weapons).toHaveProperty(weaponId);
            }

            const summons = Array.isArray(phaseEntry.summon) ? phaseEntry.summon as Array<Record<string, unknown>> : [];
            summons.forEach(entry => {
                const template = (entry.template ?? entry.id ?? entry.templateId) as string | undefined;
                if (template) {
                    expect(enemyIds.has(template)).toBe(true);
                }
            });
        });
    });

    it('declares behaviour tree steps with supported actions and valid references', () => {
        Object.entries(behaviorTrees).forEach(([treeId, root]) => {
            traverseBehaviorTree(root, (step) => {
                if (!step || step.type !== 'action') {
                    return;
                }

                const actionName = step.name;
                expect(supportedActions.has(actionName ?? '')).toBe(true);

                if (actionName === 'fireWeapon' && step.weaponId) {
                    expect(weapons).toHaveProperty(step.weaponId);
                }

                if (actionName === 'summon' && step.targets) {
                    const targets = collectSummonTargets(step);
                    targets.forEach(target => {
                        expect(enemyIds.has(target)).toBe(true);
                    });
                }
            });
        });
    });
});

describe('BehaviorTreeService with configured trees', () => {
    it('returns cloned instances so callers cannot mutate the cache', () => {
        const service = new BehaviorTreeService();
        service.configure(behaviorTrees);

        const id = Object.keys(behaviorTrees)[0];
        const tree = service.getTree(id);
        expect(tree).not.toBeNull();

        if (!tree) {
            return;
        }

        (tree as any).children?.push({ type: 'wait', duration: 99 });

        const again = service.getTree(id);
        expect(again).not.toBeNull();
        expect((again as any).children?.some((step: BehaviorTreeStep) => step.duration === 99)).toBeFalsy();
    });
});

describe('EnemySpawningSystem with difficulty modifiers', () => {
    let mockConfigService: ConfigService;
    let mockServiceLocator: ServiceLocator;
    let mockGameContext: BehaviorTreeGameContext;
    let enemySpawningSystem: EnemySpawningSystem;

    const baseTemplate: EnemySpawnTemplate = {
        id: 'test-enemy',
        health: 100,
        verticalSpeed: 2,
        weaponId: 'enemy-dart',
        fireRate: 1.0,
        colliderRadius: 20,
    };

    beforeEach(() => {
        mockConfigService = {
            get: vi.fn((key: string) => {
                if (key === 'enemies.difficultyModifiers') {
                    return {
                        easy: {
                            healthMultiplier: 0.8,
                            damageMultiplier: 0.7,
                            fireRateMultiplier: 1.2,
                            speedMultiplier: 0.8,
                        },
                        normal: {
                            healthMultiplier: 1.0,
                            damageMultiplier: 1.0,
                            fireRateMultiplier: 1.0,
                            speedMultiplier: 1.0,
                        },
                        hard: {
                            healthMultiplier: 1.2,
                            damageMultiplier: 1.3,
                            fireRateMultiplier: 0.8,
                            speedMultiplier: 1.2,
                        },
                    };
                }
                return undefined;
            }),
        } as unknown as ConfigService;

        mockServiceLocator = {
            optional: vi.fn((key: string) => {
                if (key === 'configService') {
                    return mockConfigService;
                }
                return undefined;
            }),
            resolve: vi.fn(), // Add resolve for other services if needed
        } as unknown as ServiceLocator;

        mockGameContext = {
            mode: 'normal', // Default difficulty
            services: mockServiceLocator,
            app: { renderer: { screen: { width: 800, height: 600 } } }, // Mock PIXI.Application
            addEntity: vi.fn(),
        } as unknown as BehaviorTreeGameContext;

        enemySpawningSystem = new EnemySpawningSystem(mockGameContext, { templates: [baseTemplate] });
    });

    it('should apply normal difficulty modifiers by default', () => {
        const enemy = (enemySpawningSystem as any)._createEnemy(baseTemplate, 0.5);
        const health = enemy.getComponent(Health);
        const motion = enemy.getComponent(Motion);
        const weapon = enemy.getComponent(Weapon);

        expect(health?.max).toBe(100 * 1.0);
        expect(motion?.velocity.y).toBe(2 * 1.0);
        expect(weapon?.cooldown).toBe(1.0 / 1.0);
    });

    it('should apply easy difficulty modifiers', () => {
        mockGameContext.mode = 'easy';
        const enemy = (enemySpawningSystem as any)._createEnemy(baseTemplate, 0.5);
        const health = enemy.getComponent(Health);
        const motion = enemy.getComponent(Motion);
        const weapon = enemy.getComponent(Weapon);

        expect(health?.max).toBe(100 * 0.8);
        expect(motion?.velocity.y).toBe(2 * 0.8);
        expect(weapon?.cooldown).toBe(1.0 / 1.2);
    });

    it('should apply hard difficulty modifiers', () => {
        mockGameContext.mode = 'hard';
        const enemy = (enemySpawningSystem as any)._createEnemy(baseTemplate, 0.5);
        const health = enemy.getComponent(Health);
        const motion = enemy.getComponent(Motion);
        const weapon = enemy.getComponent(Weapon);

        expect(health?.max).toBe(100 * 1.2);
        expect(motion?.velocity.y).toBe(2 * 1.2);
        expect(weapon?.cooldown).toBe(1.0 / 0.8);
    });

    it('should apply modifiers to behavior properties', () => {
        const templateWithBehavior: EnemySpawnTemplate = {
            ...baseTemplate,
            horizontalSpeed: 10,
            diveSpeed: 5,
        };
        mockGameContext.mode = 'hard';
        const enemy = (enemySpawningSystem as any)._createEnemy(templateWithBehavior, 0.5);
        const behavior = enemy.getComponent(EnemyBehavior);

        expect(behavior?.horizontalSpeed).toBe(10 * 1.2);
        expect(behavior?.diveSpeed).toBe(5 * 1.2);
    });
});