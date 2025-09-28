import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { describe, expect, beforeAll, it } from 'vitest';

const projectRoot = resolve(process.cwd());

const sandbox = {
  console,
  performance: { now: () => Date.now() },
  showMessage: () => {},
  updateComboDisplay: () => {},
};

sandbox.Component = class Component {};
sandbox.System = class System {};
sandbox.setTimeout = setTimeout;
sandbox.clearTimeout = clearTimeout;

sandbox.PIXI = {
  Sprite: class Sprite {
    constructor() {
      this.anchor = { set: () => {} };
      this.width = 0;
      this.height = 0;
    }
  },
  Texture: { WHITE: {} },
  Assets: { get: () => ({}) }
};

sandbox.console = console;

const loadScript = (relativePath) => {
  const filePath = resolve(projectRoot, relativePath);
  const code = readFileSync(filePath, 'utf8');
  vm.runInNewContext(code, sandbox, { filename: filePath });
};

describe('AbilitySystem integration basics', () => {
  beforeAll(() => {
    // load core + components + entities + systems once for the sandbox
    loadScript('src/js/engine/core.js');
    loadScript('src/js/engine/components.js');
    loadScript('src/js/entities/player.js');

    sandbox.updateAbilityCooldown = () => {};
    sandbox.showMessage = () => {};

    loadScript('src/js/engine/systems.js');
  });

  it('initialises PlayerAbilities cooldown defaults', () => {
    const PlayerAbilities = sandbox.PlayerAbilities;
    const abilities = new PlayerAbilities({ comboBreakerCooldown: 3, teleportCooldown: 2 });

    expect(abilities.states.comboBreaker.cooldown).toBe(3);
    expect(abilities.states.teleport.cooldown).toBe(2);
    expect(abilities.lastDirection).toEqual({ x: 0, y: -1 });
  });

  it('executes queued teleport and updates cooldown + HUD hooks', () => {
    const { Entity, Transform, Motion } = sandbox;
    const Player = sandbox.Player;
    const PlayerAbilities = sandbox.PlayerAbilities;
    const AbilitySystem = sandbox.AbilitySystem;

    const player = new Entity();
    player.addComponent(new Transform({ x: 400, y: 200 }));
    player.addComponent(new Motion({ x: 0, y: 0 }));
    player.addComponent(new Player());
    player.addComponent(new PlayerAbilities({ teleportCooldown: 1 }));

    const abilityState = player.getComponent(PlayerAbilities).states.teleport;
    abilityState.timer = 0;
    abilityState.queued = true;

    const screen = { width: 800, height: 600 };
    const gameStub = { app: { renderer: { screen }, screen }, entities: [player] };
    const eventBus = { emit: () => {} };
    const inputService = { registerCommand: () => () => {} };

    const cooldownUpdates = [];
    sandbox.updateAbilityCooldown = (name, state) => {
      cooldownUpdates.push({ name, timer: state.timer });
    };

    const abilitySystem = new AbilitySystem(gameStub, eventBus, inputService);

    abilitySystem.update([player], 60); // simulate 1 second frame delta (60 ticks)

    const transform = player.getComponent(Transform);
    expect(transform.position.y).toBe(60); // 200 - 140 distance
    expect(transform.position.x).toBe(400);
    expect(abilityState.timer).toBeCloseTo(abilityState.cooldown, 5);
    expect(abilityState.queued).toBe(false);

    const teleportUpdate = cooldownUpdates.find((entry) => entry.name === 'teleport');
    expect(teleportUpdate).toBeTruthy();
    expect(teleportUpdate.timer).toBeGreaterThan(0);
  });
});
