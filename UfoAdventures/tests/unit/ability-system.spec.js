import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { describe, expect, beforeAll, it } from 'vitest';

const projectRoot = resolve(process.cwd());

const sandbox = {
    console,
    performance: { now: () => Date.now() },
    showMessage: () => {},
    updateComboDisplay: () => {}
};

sandbox.Component = class Component {};
sandbox.System = class System {};
sandbox.setTimeout = setTimeout;
sandbox.clearTimeout = clearTimeout;

sandbox.PIXI = {
    Texture: { WHITE: {} },
    Assets: { get: () => ({}) }
};

sandbox.PIXI.Sprite = class Sprite {
    constructor() {
        const anchor = { x: 0.5, y: 0.5, set(x = 0.5, y = x) { anchor.x = x; anchor.y = y; } };
        this.anchor = anchor;
        this.width = 0;
        this.height = 0;
    }
};

sandbox.PIXI.AnimatedSprite = class AnimatedSprite extends sandbox.PIXI.Sprite {
    constructor(textures = []) {
        super();
        this.textures = textures;
        this.animationSpeed = 0;
        this.loop = true;
    }
    play() {}
};

sandbox.console = console;


sandbox.window = sandbox;

const loadScript = (relativePath) => {
    const filePath = resolve(projectRoot, relativePath);
    const code = readFileSync(filePath, 'utf8');
    try {
        vm.runInNewContext(code, sandbox, { filename: filePath });
    } catch (error) {
        throw new Error(`Failed to load ${filePath}: ${error.message}`);
    }
};

const evaluate = (expression) => vm.runInNewContext(expression, sandbox);

describe('AbilitySystem integration basics', () => {
    let Entity;
    let Transform;
    let Motion;
    let Player;
    let PlayerAbilities;
    let AbilitySystem;

    beforeAll(() => {
        loadScript('src/js/engine/core.js');
        loadScript('src/js/engine/components.js');
        loadScript('src/js/entities/player.js');
        loadScript('src/js/engine/entity-pool.js');
        loadScript('src/js/engine/spatial-grid.js');

        sandbox.updateAbilityCooldown = () => {};
        sandbox.showMessage = () => {};

        loadScript('src/js/engine/systems.js');

        Entity = evaluate('Entity');
        Transform = evaluate('Transform');
        Motion = evaluate('Motion');
        Player = evaluate('Player');
        PlayerAbilities = evaluate('PlayerAbilities');
        AbilitySystem = evaluate('AbilitySystem');
    });

    it('initialises PlayerAbilities cooldown defaults', () => {
        const abilities = new PlayerAbilities({ comboBreakerCooldown: 3, teleportCooldown: 2 });

        expect(abilities.states.comboBreaker.cooldown).toBe(3);
        expect(abilities.states.teleport.cooldown).toBe(2);
        expect(abilities.lastDirection).toEqual({ x: 0, y: -1 });
    });

    it('executes queued teleport and updates cooldown + HUD hooks', () => {
        const player = new Entity();
        player.addComponent(new Transform({ x: 400, y: 200 }));
        player.addComponent(new Motion({ x: 0, y: 0 }));
        player.addComponent(new Player());
        player.addComponent(new PlayerAbilities({ teleportCooldown: 1 }));

        const abilityState = player.getComponent(PlayerAbilities).states.teleport;
        abilityState.timer = 0;
        abilityState.queued = true;

        const screen = { width: 800, height: 600 };
        const gameStub = { app: { renderer: { screen }, screen }, entities: [player], spawnEffect: () => {}, spawnPlayerBullet: () => null };
        const eventBus = { emit: () => {} };
        const inputService = { registerCommand: () => () => {} };

        const cooldownUpdates = [];
        sandbox.updateAbilityCooldown = (name, state) => {
            cooldownUpdates.push({ name, timer: state.timer });
        };

        const abilitySystem = new AbilitySystem(gameStub, eventBus, inputService);

        abilitySystem.update([player], 60);

        const transform = player.getComponent(Transform);
        expect(transform.position.y).toBe(60);
        expect(transform.position.x).toBe(400);
        expect(abilityState.timer).toBeCloseTo(abilityState.cooldown, 5);
        expect(abilityState.queued).toBe(false);

        const teleportUpdate = cooldownUpdates.find((entry) => entry.name === 'teleport');
        expect(teleportUpdate).toBeTruthy();
        expect(teleportUpdate.timer).toBeGreaterThan(0);
    });
});
