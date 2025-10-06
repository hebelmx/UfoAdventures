import { System, Entity } from './core';
import { EventBus } from './event-bus';
import { AbilityGameContext, EffectSpawnOptions } from './combat-types';
import { MagicInventory, PlayerAbilities, Sprite, Transform } from './components';

export class MagicSystem extends System {
    private readonly game: AbilityGameContext;
    private readonly eventBus: EventBus | null;

    constructor(game: AbilityGameContext, eventBus: EventBus | null) {
        super();
        this.game = game;
        this.eventBus = eventBus ?? null;
    }

    update(entities: Entity[], delta: number): void {
        const deltaSeconds = delta / 60;
        entities.forEach(entity => {
            const inv = entity.getComponent(MagicInventory) ?? null;
            if (!inv) {
                return;
            }
            if (inv.globalCooldown > 0) {
                inv.globalCooldown = Math.max(0, inv.globalCooldown - deltaSeconds);
            }

            const abilities = entity.getComponent(PlayerAbilities) ?? null;
            if (!abilities) {
                return;
            }

            // Shield: if queued and ready, consume mana, apply HUD effect
            const shield = abilities.states['shield'];
            if (shield?.queued && !shield.active && inv.globalCooldown === 0 && inv.manaPoints >= (abilities.states['shield'].strength ?? 20)) {
                shield.queued = false;
                shield.active = true;
                shield.remaining = shield.duration ?? 4;
                inv.manaPoints = Math.max(0, inv.manaPoints - (abilities.states['shield'].strength ?? 20));
                inv.globalCooldown = 0.25;
                this._spawnShieldEffect(entity);
                this.eventBus?.emit('magic:shield');
            }

            if (shield?.active) {
                shield.remaining = Math.max(0, (shield.remaining ?? 0) - deltaSeconds);
                if (shield.remaining <= 0) {
                    shield.active = false;
                }
            }

            // Stasis: pause nearby entities briefly
            const stasis = abilities.states['stasisField'] ?? null;
            if (stasis?.queued && inv.globalCooldown === 0 && inv.manaPoints >= 10) {
                stasis.queued = false;
                stasis.active = true;
                stasis.remaining = stasis.duration ?? 2;
                inv.manaPoints = Math.max(0, inv.manaPoints - 10);
                inv.globalCooldown = 0.5;
                this._spawnStasisEffect(entity);
                this.eventBus?.emit('magic:stasis');
            }
            if (stasis?.active) {
                stasis.remaining = Math.max(0, (stasis.remaining ?? 0) - deltaSeconds);
                if (stasis.remaining <= 0) {
                    stasis.active = false;
                }
            }
        });
    }

    private _spawnShieldEffect(entity: Entity): void {
        const transform = entity.getComponent(Transform) ?? null;
        const position = transform ? { x: transform.position.x, y: transform.position.y } : { x: 0, y: 0 };
        const options: EffectSpawnOptions = { position, alpha: 0.8, scale: 1.2 };
        this.game.spawnEffect?.(options);
    }

    private _spawnStasisEffect(entity: Entity): void {
        const transform = entity.getComponent(Transform) ?? null;
        const position = transform ? { x: transform.position.x, y: transform.position.y } : { x: 0, y: 0 };
        const options: EffectSpawnOptions = { position, alpha: 0.7, scale: 1.4 };
        this.game.spawnEffect?.(options);
    }
}


