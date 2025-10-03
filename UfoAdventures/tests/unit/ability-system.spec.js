import { describe, expect, beforeEach, it, vi } from 'vitest';

vi.mock('pixi.js', () => {
  class Sprite {
    constructor() {
      this.anchor = { x: 0.5, y: 0.5, set(x = 0.5, y = x) { this.anchor.x = x; this.anchor.y = y; } };
      this.width = 0;
      this.height = 0;
    }
  }

  class AnimatedSprite extends Sprite {
    constructor(textures = []) {
      super();
      this.textures = textures;
      this.animationSpeed = 0;
      this.loop = true;
    }
    play() {}
  }

  return {
    Texture: { WHITE: {} },
    Assets: { get: () => ({}) },
    Sprite,
    AnimatedSprite,
    Container: class {
      constructor() {
        this.children = [];
        this.sortableChildren = false;
      }
      addChild(child) {
        this.children.push(child);
        return child;
      }
      removeChild(child) {
        this.children = this.children.filter(entry => entry !== child);
      }
      removeChildren() {
        this.children = [];
      }
    },
    Text: class {
      constructor() {
        this.visible = true;
        this.alpha = 1;
      }
      destroy() {}
    }
  };
});

import { Entity } from '../../src/js/engine/core';
import { Transform, Motion, PlayerAbilities } from '../../src/js/engine/components';
import { Player } from '../../src/js/entities/player';
import { AbilitySystem } from '../../src/js/engine/systems';

const createGameStub = () => {
  const screen = { width: 800, height: 600 };
  return {
    app: { renderer: { screen }, screen },
    entities: [],
    spawnEffect: vi.fn(),
    spawnPlayerBullet: vi.fn(() => null)
  };
};

describe('AbilitySystem integration basics', () => {
  let game;
  let eventBus;
  let inputService;
  let abilitySystem;
  let uiService;

  beforeEach(() => {
    vi.clearAllMocks();
    game = createGameStub();
    eventBus = { emit: vi.fn(), on: vi.fn(), off: vi.fn() };
    inputService = {
      registerCommand: vi.fn(() => vi.fn()),
      getAxisValue: vi.fn(() => 0),
      isActionActive: vi.fn(() => false)
    };
    uiService = {
      updateAbilityCooldown: vi.fn(),
      showMessage: vi.fn()
    };
    abilitySystem = new AbilitySystem(game, eventBus, inputService, uiService);
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

    game.entities = [player];

    abilitySystem.update([player], 60);

    const transform = player.getComponent(Transform);
    expect(transform.position.y).toBe(60);
    expect(transform.position.x).toBe(400);
    expect(abilityState.timer).toBeCloseTo(abilityState.cooldown, 5);
    expect(abilityState.queued).toBe(false);

    const teleportUpdate = uiService.updateAbilityCooldown.mock.calls.find(([name]) => name === 'teleport');
    expect(teleportUpdate).toBeTruthy();
    expect(teleportUpdate[1].timer).toBeGreaterThan(0);
    expect(uiService.showMessage).toHaveBeenCalledWith('Teleport!', '#66ccff');
  });
});
