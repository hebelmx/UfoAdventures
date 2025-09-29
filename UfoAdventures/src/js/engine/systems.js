class RenderSystem extends System {
    constructor(app) {
        super();
        this.app = app;
    }

    update(entities, delta) {
        entities.forEach(entity => {
            if (entity.hasComponent(Transform) && entity.hasComponent(Sprite)) {
                const transform = entity.getComponent(Transform);
                const sprite = entity.getComponent(Sprite).sprite;

                sprite.x = transform.position.x;
                sprite.y = transform.position.y;
                sprite.rotation = transform.rotation;
                sprite.scale.x = transform.scale.x;
                sprite.scale.y = transform.scale.y;
            }
        });
    }
}

class PlayerInputSystem extends System {
    constructor(inputService) {
        super();
        this.input = inputService || null;
    }

    update(entities, delta) {
        entities.forEach(entity => {
            if (entity.hasComponent(Motion)) {
                const motion = entity.getComponent(Motion);
                const horizontal = this.input ? this.input.getAxisValue('moveX') : 0;
                const vertical = this.input ? this.input.getAxisValue('moveY') : 0;

                motion.velocity.x = horizontal * motion.speed;
                motion.velocity.y = vertical * motion.speed;

                if (entity.hasComponent(PlayerAbilities)) {
                    const abilities = entity.getComponent(PlayerAbilities);
                    const vx = motion.velocity.x;
                    const vy = motion.velocity.y;
                    if (Math.abs(vx) > 0.05 || Math.abs(vy) > 0.05) {
                        const magnitude = Math.sqrt(vx * vx + vy * vy) || 1;
                        abilities.lastDirection = { x: vx / magnitude, y: vy / magnitude };
                    }
                }

                if (entity.hasComponent(PlayerAbilities)) {
                    const abilities = entity.getComponent(PlayerAbilities);
                    const vx = motion.velocity.x;
                    const vy = motion.velocity.y;
                    if (Math.abs(vx) > 0.05 || Math.abs(vy) > 0.05) {
                        const magnitude = Math.sqrt(vx * vx + vy * vy) || 1;
                        abilities.lastDirection = { x: vx / magnitude, y: vy / magnitude };
                    }
                }
            }

            if (entity.hasComponent(Weapon)) {
                const weapon = entity.getComponent(Weapon);
                const isActive = this.input ? this.input.isActionActive('attackPrimary') : false;
                if (isActive && !weapon.isShooting) {
                    weapon.justActivated = true;
                }
                weapon.isShooting = !!isActive;
            }
        });
    }
}

class EnemyBehaviorSystem extends System {
    constructor(game) {
        super();
        this.game = game;
    }

    update(entities, delta) {
        const deltaSeconds = delta / 60;
        const screen = this._getScreen();

        entities.forEach(entity => {
            if (!entity.hasComponent(EnemyBehavior) || !entity.hasComponent(Enemy)) {
                return;
            }

            const behavior = entity.getComponent(EnemyBehavior);
            const transform = entity.getComponent(Transform);
            const motion = entity.getComponent(Motion);

            if (!transform || !motion) {
                return;
            }

            behavior.elapsed += deltaSeconds;
            if (behavior.originX === null) {
                behavior.originX = transform.position.x;
            }

            switch (behavior.pattern) {
                case 'sine': {
                    const frequency = behavior.frequency || 1.2;
                    const amplitude = behavior.amplitude || 80;
                    const angle = behavior.elapsed * frequency * Math.PI * 2;
                    transform.position.x = behavior.originX + Math.sin(angle) * amplitude;
                    motion.velocity.x = 0;
                    motion.velocity.y = behavior.verticalSpeed || 2;
                    break;
                }
                case 'swoop': {
                    const diveDuration = 1.2;
                    const climbDuration = 0.9;
                    const cycle = diveDuration + climbDuration + 1.2;
                    const time = behavior.elapsed % cycle;

                    if (time < diveDuration) {
                        motion.velocity.y = behavior.diveSpeed || 4.5;
                    } else if (time < diveDuration + climbDuration) {
                        motion.velocity.y = behavior.climbSpeed || -3.2;
                    } else {
                        motion.velocity.y = behavior.verticalSpeed || 2;
                    }

                    const drift = behavior.horizontalDrift || 0;
                    motion.velocity.x = drift;
                    break;
                }
                case 'strafe':
                default: {
                    behavior.direction = behavior.direction || (Math.random() > 0.5 ? 1 : -1);
                    const margin = 60;
                    const speed = behavior.horizontalSpeed || 3;
                    if (transform.position.x < margin) {
                        behavior.direction = 1;
                    } else if (transform.position.x > (screen.width - margin)) {
                        behavior.direction = -1;
                    }
                    motion.velocity.x = speed * behavior.direction;
                    motion.velocity.y = behavior.verticalSpeed || 2;
                    break;
                }
            }
        });
    }

    _getScreen() {
        const renderer = this.game.app.renderer;
        return renderer ? renderer.screen : this.game.app.screen;
    }
}

class MovementSystem extends System {
    update(entities, delta) {
        entities.forEach(entity => {
            if (entity.hasComponent(Transform) && entity.hasComponent(Motion)) {
                const transform = entity.getComponent(Transform);
                const motion = entity.getComponent(Motion);

                transform.position.x += motion.velocity.x * delta;
                transform.position.y += motion.velocity.y * delta;
            }
        });
    }
}



class AbilitySystem extends System {
    constructor(game, eventBus, inputService) {
        super();
        this.game = game;
        this.eventBus = eventBus || null;
        this.inputService = inputService || null;
        this._handlers = [];
        this._revertTimers = new WeakMap();
        this._bindInput();
    }

    destroy() {
        while (this._handlers.length) {
            const off = this._handlers.pop();
            try {
                if (typeof off === 'function') {
                    off();
                }
            } catch (error) {
                console.error('AbilitySystem: failed to unregister command', error);
            }
        }

        if (this._revertTimers) {
            this._revertTimers.forEach(timer => {
                try { clearTimeout(timer); } catch (error) {}
            });
            this._revertTimers = new WeakMap();
        }
    }

    update(entities, delta) {
        const player = this._getPlayer(entities);
        if (!player || !player.hasComponent(PlayerAbilities)) {
            return;
        }

        const abilities = player.getComponent(PlayerAbilities);
        const deltaSeconds = delta / 60;
        const comboState = abilities.states.comboBreaker || null;
        const teleportState = abilities.states.teleport || null;

        if (comboState && comboState.timer > 0) {
            comboState.timer = Math.max(0, comboState.timer - deltaSeconds);
        }

        if (teleportState && teleportState.timer > 0) {
            teleportState.timer = Math.max(0, teleportState.timer - deltaSeconds);
        }

        this._updateLastDirection(player, abilities);

        if (comboState && comboState.queued) {
            this._executeComboBreaker(player, comboState);
        }

        if (teleportState && teleportState.queued) {
            this._executeTeleport(player, abilities, teleportState);
        }

        if (typeof updateAbilityCooldown === 'function') {
            updateAbilityCooldown('comboBreaker', comboState);
            updateAbilityCooldown('teleport', teleportState);
        }
    }

    _bindInput() {
        if (!this.inputService || typeof this.inputService.registerCommand !== 'function') {
            return;
        }

        this._handlers.push(this.inputService.registerCommand('comboBreaker', () => {
            this._queueAbility('comboBreaker');
        }, { trigger: 'down' }));

        this._handlers.push(this.inputService.registerCommand('teleport', () => {
            this._queueAbility('teleport');
        }, { trigger: 'down' }));
    }

    _queueAbility(name) {
        const player = this._getPlayer(this.game.entities);
        if (!player || !player.hasComponent(PlayerAbilities)) {
            return;
        }

        const abilities = player.getComponent(PlayerAbilities);
        const state = abilities.states[name];
        if (!state) {
            return;
        }

        if (state.timer > 0) {
            if (typeof showMessage === 'function') {
                const label = name === 'teleport' ? 'Teleport ready in ' : 'Combo breaker ready in ';
                showMessage(label + state.timer.toFixed(1) + 's', '#99a0ff');
            }
            return;
        }

        state.queued = true;
    }

    _executeComboBreaker(player, state) {
        const playerComponent = player.getComponent(Player);
        if (playerComponent) {
            playerComponent.combo = 0;
        }

        state.timer = state.cooldown;
        state.queued = false;

        const transform = player.getComponent(Transform);
        if (transform) {
            this.game.spawnEffect({
                position: { x: transform.position.x, y: transform.position.y },
                tint: 0xffaa33,
                alpha: 0.95,
                lifeTime: 0.4,
                fade: 1.2,
                scale: 1.2,
                animation: 'comboBreaker'
            });
        }

        this._playPlayerAnimation(player, 'comboBreaker', { revertAfter: 600 });

        if (typeof updateComboDisplay === 'function') {
            updateComboDisplay(0);
        }

        if (typeof showMessage === 'function') {
            showMessage('Combo breaker unleashed!', '#ffaa33');
        }

        if (this.eventBus) {
            this.eventBus.emit('ability:combo-breaker', { player });
        }
    }

    _executeTeleport(player, abilities, state) {
        if (!state) {
            return;
        }

        const transform = player.getComponent(Transform);
        if (!transform) {
            state.queued = false;
            return;
        }

        const origin = { x: transform.position.x, y: transform.position.y };
        const direction = abilities.lastDirection || { x: 0, y: -1 };
        const magnitude = Math.sqrt(direction.x * direction.x + direction.y * direction.y) || 1;
        const normalized = { x: direction.x / magnitude, y: direction.y / magnitude };
        const distance = 140;
        const screen = this._getScreen();

        transform.position.x = this._clamp(transform.position.x + normalized.x * distance, 30, screen.width - 30);
        transform.position.y = this._clamp(transform.position.y + normalized.y * distance, 30, screen.height - 30);

        state.timer = state.cooldown;
        state.queued = false;

        this._playPlayerAnimation(player, 'teleport', { revertAfter: 400 });

        this.game.spawnEffect({
            position: origin,
            tint: 0x66ccff,
            alpha: 0.7,
            lifeTime: 0.25,
            fade: 1.5,
            scale: 0.9,
            animation: 'teleport-trail'
        });
        this.game.spawnEffect({
            position: { x: transform.position.x, y: transform.position.y },
            tint: 0xffffff,
            alpha: 0.8,
            lifeTime: 0.3,
            fade: 1.8,
            scale: 1.0,
            animation: 'teleport-arrive'
        });

        if (typeof showMessage === 'function') {
            showMessage('Teleport!', '#66ccff');
        }

        if (this.eventBus) {
            this.eventBus.emit('ability:teleport', { player, direction: normalized });
        }
    }

    _playPlayerAnimation(player, animation, options = {}) {
        if (!player || !player.hasComponent(Sprite)) {
            return;
        }
        const sprite = player.getComponent(Sprite).sprite;
        if (sprite instanceof PIXI.AnimatedSprite) {
            if (typeof sprite.gotoAndPlay === 'function') {
                try {
                    sprite.gotoAndPlay(animation);
                } catch (error) {
                    if (typeof sprite.play === 'function') {
                        sprite.play(animation);
                    }
                }
            } else if (typeof sprite.play === 'function') {
                sprite.play(animation);
            }
            if (typeof options.speed === 'number') {
                sprite.animationSpeed = options.speed;
            }
        }

        if (options.revertAfter) {
            const existing = this._revertTimers.get(player);
            if (existing) {
                clearTimeout(existing);
            }
            const timer = setTimeout(() => {
                this._revertTimers.delete(player);
                this._playPlayerAnimation(player, options.revertTo || 'idle');
            }, options.revertAfter);
            this._revertTimers.set(player, timer);
        }
    }

    _updateLastDirection(player, abilities) {
        if (!player.hasComponent(Motion)) {
            return;
        }
        const motion = player.getComponent(Motion);
        const vx = motion.velocity.x;
        const vy = motion.velocity.y;
        if (Math.abs(vx) > 0.05 || Math.abs(vy) > 0.05) {
            const magnitude = Math.sqrt(vx * vx + vy * vy) || 1;
            abilities.lastDirection = { x: vx / magnitude, y: vy / magnitude };
        }
    }

    _getPlayer(entities) {
        return entities.find(entity => entity.hasComponent(Player)) || null;
    }

    _getScreen() {
        const renderer = this.game.app.renderer;
        return renderer ? renderer.screen : this.game.app.screen;
    }

    _clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }
}


class EffectLifetimeSystem extends System {
    constructor(game) {
        super();
        this.game = game;
    }

    update(entities, delta) {
        const deltaSeconds = delta / 60;
        entities.forEach(entity => {
            if (entity.poolId !== 'effect') {
                return;
            }

            if (typeof entity.lifeTime === 'number') {
                entity.lifeTime -= deltaSeconds;
                if (entity.lifeTime <= 0) {
                    entity.isRemoved = true;
                }
            }

            if (typeof entity.fadeRate === 'number') {
                const sprite = entity.getComponent(Sprite)?.sprite;
                if (sprite) {
                    const nextAlpha = sprite.alpha - entity.fadeRate * deltaSeconds;
                    sprite.alpha = nextAlpha > 0 ? nextAlpha : 0;
                }
            }
        });
    }
}

class EnemySpawningSystem extends System {
    constructor(game, config = {}) {
        super();
        this.game = game;
        this.templates = this._buildTemplateMap(config.templates);
        this.waves = Array.isArray(config.waves) && config.waves.length ? config.waves : this._defaultWaves();
        this.waveIndex = 0;
        this.elapsed = 0;
    }

    update(entities, delta) {
        const deltaSeconds = delta / 60;
        this.elapsed += deltaSeconds;

        while (this.waveIndex < this.waves.length) {
            const wave = this.waves[this.waveIndex];
            const trigger = wave.delay || 0;
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

    _spawnWave(wave) {
        if (!wave || !Array.isArray(wave.spawns)) {
            return;
        }

        wave.spawns.forEach(spawn => {
            const template = this.templates.get(spawn.template);
            if (!template) {
                console.warn('EnemySpawningSystem: template not found', spawn.template);
                return;
            }

            const count = Math.max(1, spawn.count || 1);
            const positions = this._resolvePositions(count, spawn);

            positions.forEach(pos => {

                const screen = this._getScreen();

                const spawnX = screen.width * pos;

                const spawnY = typeof spawn.altitude === 'number' ? spawn.altitude : -50;

                this.game.spawnEnemyFromTemplate(template, {

                    positionRatio: pos,

                    position: { x: spawnX, y: spawnY },

                    altitude: spawn.altitude

                });

            });

        });

    }



    _resolvePositions(count, spawn) {
        if (Array.isArray(spawn.positions) && spawn.positions.length) {
            return spawn.positions.slice(0, count);
        }

        const spread = Math.min(1, Math.max(0.1, spawn.spread || 0.6));
        const offset = Math.min(1, Math.max(0, spawn.offset || 0.5));
        const start = offset - spread / 2;
        const step = spread / Math.max(1, count - 1);

        const positions = [];
        for (let i = 0; i < count; i++) {
            positions.push(Math.min(0.95, Math.max(0.05, start + step * i)));
        }
        return positions;
    }

    _buildTemplateMap(templates = []) {
        const map = new Map();
        templates.forEach(tpl => {
            if (tpl && tpl.id) {
                map.set(tpl.id, tpl);
            }
        });
        if (!map.size) {
            map.set('default', { id: 'default', texture: 'blade', pattern: 'sine', verticalSpeed: 2, amplitude: 80, frequency: 1.2 });
        }
        return map;
    }

    _defaultWaves() {
        return [
            { delay: 0, spawns: [{ template: 'default', count: 3, spread: 0.6 }] },
            { delay: 7, spawns: [{ template: 'default', count: 4, spread: 0.8 }] }
        ];
    }

    _getScreen() {
        const renderer = this.game.app.renderer;
        return renderer ? renderer.screen : this.game.app.screen;
    }
}

class ShootingSystem extends System {
    constructor(game, eventBus) {
        super();
        this.game = game;
        this.eventBus = eventBus || null;
    }

    update(entities, delta) {
        entities.forEach(entity => {
            if (!entity.hasComponent(Weapon) || !entity.hasComponent(Transform)) {
                return;
            }

            const weapon = entity.getComponent(Weapon);
            const transform = entity.getComponent(Transform);
            // delta is already in seconds; accumulate directly
            weapon.fireTimer += delta;

            const justActivated = !!weapon.justActivated;
            if (justActivated) {
                weapon.justActivated = false;
            }

            const canFire = justActivated || (weapon.isShooting && weapon.fireTimer >= weapon.fireRate);
            if (!canFire) {
                return;
            }

            weapon.fireTimer = 0;

            const bullet = this.game.spawnPlayerBullet({ x: transform.position.x, y: transform.position.y - 20 }, { x: 0, y: -12 }, { tint: 0xffff88 });



            if (!bullet) {

                return;

            }



            if (this.eventBus) {
                this.eventBus.emit('combat:projectile-fired', {
                    origin: entity,
                    projectile: bullet
                });
            }
        });
    }
}


class CollisionSystem extends System {
    constructor(game, eventBus) {
        super();
        this.game = game;
        this.eventBus = eventBus || null;
        this._playerDefeated = false;
        this._defeatedBosses = new WeakSet();
        this._grid = new SpatialGrid({ cellSize: 160 });
    }

    update(entities, delta) {
        this._grid.clear();

        const bullets = [];
        const enemies = [];
        let player = null;

        for (const entity of entities) {
            if (entity.isRemoved) {
                continue;
            }

            if (entity.hasComponent(Player)) {
                player = entity;
                this._insertIntoGrid(entity);
                continue;
            }

            if (entity.hasComponent(Bullet)) {
                bullets.push(entity);
                this._insertIntoGrid(entity);
                continue;
            }

            if (entity.hasComponent(EnemyBullet) || entity.hasComponent(Boss)) {
                this._insertIntoGrid(entity);
                continue;
            }

            if (entity.hasComponent(Enemy)) {
                enemies.push(entity);
                this._insertIntoGrid(entity);
            }
        }

        const playerBounds = player ? this._computeBounds(player) : null;

        bullets.forEach(bullet => {
            const bulletBounds = this._computeBounds(bullet);
            if (!bulletBounds) {
                return;
            }
            const candidates = this._grid.query(bulletBounds);

            candidates.forEach(candidate => {
                if (candidate === bullet || candidate.isRemoved) {
                    return;
                }

                if (candidate.hasComponent(Enemy) && this._isColliding(bullet, candidate)) {
                    this._handleBulletHitsEnemy(bullet, candidate);
                } else if (candidate.hasComponent(Boss) && this._isColliding(bullet, candidate)) {
                    this._handleBulletHitsBoss(bullet, candidate);
                }
            });
        });

        if (player && playerBounds) {
            const playerCandidates = this._grid.query(playerBounds);

            playerCandidates.forEach(candidate => {
                if (candidate === player || candidate.isRemoved) {
                    return;
                }

                if (candidate.hasComponent(Enemy) && this._isColliding(player, candidate)) {
                    this._handleEnemyHitsPlayer(candidate, player);
                } else if (candidate.hasComponent(EnemyBullet) && this._isColliding(player, candidate)) {
                    this._handleProjectileHitsPlayer(candidate, player);
                }
            });
        }
    }

    _computeBounds(entity) {
        if (!entity.hasComponent(Transform) || !entity.hasComponent(Collider)) {
            return null;
        }

        const transform = entity.getComponent(Transform);
        const collider = entity.getComponent(Collider);
        const radius = collider.radius || 0;

        return {
            minX: transform.position.x - radius,
            minY: transform.position.y - radius,
            maxX: transform.position.x + radius,
            maxY: transform.position.y + radius
        };
    }

    _insertIntoGrid(entity) {
        const bounds = this._computeBounds(entity);
        if (!bounds) {
            return;
        }
        this._grid.insert(entity, bounds);
    }

    getDiagnostics() {
        if (!this._grid) {
            return { cells: 0, entities: 0 };
        }
        return {
            cells: this._grid.cellCount(),
            entities: this._grid.entityCount()
        };
    }

    _handleBulletHitsEnemy(bullet, enemy) {
        bullet.isRemoved = true;
        enemy.isRemoved = true;
        this._emitDamage(enemy, bullet, 10, enemy.getComponent(Health), 'projectile');

        // VFX: bullet impact at collision
        const bulletTransform = bullet.getComponent(Transform);
        if (bulletTransform && this.game && typeof this.game.spawnEffect === 'function') {
            this.game.spawnEffect({
                position: { x: bulletTransform.position.x, y: bulletTransform.position.y },
                alpha: 0.9,
                lifeTime: 0.2,
                fade: 1.5,
                scale: 1.0,
                animation: 'bullet-impact'
            });
        }
    }

    _handleBulletHitsBoss(bullet, boss) {
        const health = boss.getComponent(Health);
        if (!health) {
            return;
        }

        bullet.isRemoved = true;
        health.health -= 10;
        if (health.health < 0) {
            health.health = 0;
        }

        this._emitDamage(boss, bullet, 10, health, 'projectile');

        // VFX: bullet impact at boss
        const bulletTransform = bullet.getComponent(Transform);
        if (bulletTransform && this.game && typeof this.game.spawnEffect === 'function') {
            this.game.spawnEffect({
                position: { x: bulletTransform.position.x, y: bulletTransform.position.y },
                alpha: 0.95,
                lifeTime: 0.25,
                fade: 1.6,
                scale: 1.0,
                animation: 'bullet-impact'
            });
        }

        if (health.health <= 0 && !this._defeatedBosses.has(boss)) {
            this._defeatedBosses.add(boss);
            boss.isRemoved = true;

            if (typeof showMessage === 'function') {
                showMessage('Boss defeated!', '#66ff88');
            }

            if (this.eventBus) {
                this.eventBus.emit('game:request-results', {
                    outcome: 'victory',
                    reason: 'boss-defeated',
                    mode: this.game.mode || 'adventure',
                    options: this.game.sceneOptions || {}
                });
            }
        }
    }

    _handleEnemyHitsPlayer(enemy, player) {
        enemy.isRemoved = true;
        this._damagePlayer(player, 10, 'collision');
    }

    _handleProjectileHitsPlayer(projectile, player) {
        projectile.isRemoved = true;
        this._damagePlayer(player, 10, 'projectile');
    }

    _damagePlayer(playerEntity, amount, source) {
        const playerComponent = playerEntity.getComponent(Player);
        const health = playerEntity.getComponent(Health);

        if (!playerComponent || !health) {
            return;
        }

        health.health -= amount;
        if (health.health < 0) {
            health.health = 0;
        }

        this._emitDamage(playerEntity, null, amount, health, source);

        if (typeof showMessage === 'function') {
            showMessage('Hit! Shields dropping.', '#ff6666');
        }

        if (health.health <= 0) {
            if (playerComponent.lives > 1) {
                playerComponent.lives -= 1;
                health.health = 100;

                const transform = playerEntity.getComponent(Transform);
                const screen = this._getScreen();
                if (transform) {
                    transform.position.x = screen.width / 2;
                    transform.position.y = screen.height - 80;
                }

                if (typeof showMessage === 'function') {
                    showMessage('Life lost! ' + playerComponent.lives + ' remaining.', '#ffbb55');
                }
            } else if (!this._playerDefeated) {
                this._playerDefeated = true;
                playerEntity.isRemoved = true;

                if (this.eventBus) {
                    this.eventBus.emit('game:request-results', {
                        outcome: 'defeat',
                        reason: 'player-destroyed',
                        mode: this.game.mode || 'adventure',
                        options: this.game.sceneOptions || {}
                    });
                }
            }
        }
    }

    _emitDamage(target, source, amount, healthComponent, damageSource) {
        if (!this.eventBus) {
            return;
        }

        this.eventBus.emit('combat:damage', {
            target,
            source,
            amount,
            remainingHealth: healthComponent ? healthComponent.health : undefined,
            damageSource: damageSource || 'projectile'
        });
    }

    _getScreen() {
        const renderer = this.game.app.renderer;
        return renderer ? renderer.screen : this.game.app.screen;
    }
}

class UISystem extends System {
    constructor(game) {
        super();
        this.game = game;
    }

    update(entities, delta) {
        const playerEntity = entities.find(e => e.hasComponent(Player));
        if (playerEntity) {
            const player = playerEntity.getComponent(Player);
            const health = playerEntity.getComponent(Health);
            updateHealthDisplay(health.health, health.max || 100);
            updateComboDisplay(player.combo);
            updateLivesDisplay(player.lives);
        }

        const bossEntity = entities.find(e => e.hasComponent(Boss));
        const bossBarEl = document.getElementById('bossHealthBar');
        if (bossEntity) {
            const bossHealth = bossEntity.getComponent(Health);
            const max = bossHealth.max || 500;
            updateBossHealthDisplay(bossHealth.health, max);
            if (bossBarEl) {
                bossBarEl.style.display = 'block';
            }
        } else if (bossBarEl) {
            bossBarEl.style.display = 'none';
        }
    }
}

class BossAISystem extends System {
    constructor(game) {
        super();
        this.game = game;
    }

    update(entities, delta) {
        const screen = this._getScreen();

        entities.forEach(entity => {
            if (!entity.hasComponent(Boss) || !entity.hasComponent(Motion) || !entity.hasComponent(Transform)) {
                return;
            }

            const motion = entity.getComponent(Motion);
            const transform = entity.getComponent(Transform);
            const health = entity.getComponent(Health);
            const phaseComp = entity.hasComponent(BossPhase) ? entity.getComponent(BossPhase) : null;
            let currentPhase = null;

            if (phaseComp && health) {
                const changedPhase = phaseComp.update(health.health);
                currentPhase = phaseComp.getCurrent();
                if (changedPhase && changedPhase.message && typeof showMessage === 'function') {
                    showMessage(changedPhase.message, '#66ccff');
                }

            // VFX: boss phase transition summon glyph
            if (changedPhase && this.game && typeof this.game.spawnEffect === 'function') {
                this.game.spawnEffect({
                    position: { x: transform.position.x, y: transform.position.y },
                    alpha: 0.9,
                    lifeTime: 0.5,
                    fade: 1.8,
                    scale: 1.2,
                    animation: 'boss-summon'
                });
            }
            } else if (phaseComp) {
                currentPhase = phaseComp.getCurrent();
            }

            const horizontalSpeed = currentPhase && currentPhase.horizontalSpeed ? currentPhase.horizontalSpeed : (motion.speed || 2);
            entity._direction = entity._direction || 1;
            if (transform.position.x < 80) {
                entity._direction = 1;
            } else if (transform.position.x > screen.width - 80) {
                entity._direction = -1;
            }

            motion.velocity.x = horizontalSpeed * entity._direction;
            motion.velocity.y = currentPhase && typeof currentPhase.verticalDrift === 'number' ? currentPhase.verticalDrift : 0;
        });
    }

    _getScreen() {
        const renderer = this.game.app.renderer;
        return renderer ? renderer.screen : this.game.app.screen;
    }
}

class BossShootingSystem extends System {
    constructor(game) {
        super();
        this.game = game;
    }

    update(entities, delta) {
        // delta is already in seconds per GameApplication._tick
        const deltaSeconds = delta;

        entities.forEach(entity => {
            if (!entity.hasComponent(Boss) || !entity.hasComponent(Transform)) {
                return;
            }

            const phaseComp = entity.hasComponent(BossPhase) ? entity.getComponent(BossPhase) : null;
            const phase = phaseComp ? phaseComp.getCurrent() : null;
            const fireRate = phase && phase.fireRate ? phase.fireRate : 1;

            if (phaseComp) {
                phaseComp.fireTimer += deltaSeconds;
                if (phaseComp.fireTimer < fireRate) {
                    return;
                }
                phaseComp.fireTimer = 0;
            } else {
                this._fallbackTimer = (this._fallbackTimer || 0) + deltaSeconds;
                if (this._fallbackTimer < fireRate) {
                    return;
                }
                this._fallbackTimer = 0;
            }

            this._spawnProjectiles(entity, phase);
        });
    }

    _spawnProjectiles(entity, phase) {
        const transform = entity.getComponent(Transform);
        const pattern = phase && phase.pattern ? phase.pattern : 'spread';
        const projectiles = [];

        switch (pattern) {
            case 'burst':
                projectiles.push({ vx: 0, vy: 6 });
                projectiles.push({ vx: 1.5, vy: 5.4 });
                projectiles.push({ vx: -1.5, vy: 5.4 });
                projectiles.push({ vx: 2.4, vy: 5.0 });
                projectiles.push({ vx: -2.4, vy: 5.0 });
                break;
            case 'spiral': {
                const steps = 6;
                const offset = phase ? (phase.spiralOffset || 0) : 0;
                for (let i = 0; i < steps; i++) {
                    const angle = offset + (Math.PI * 2 * i) / steps;
                    projectiles.push({ vx: Math.cos(angle) * 4, vy: Math.sin(angle) * 4 + 3 });
                }
                if (phase) {
                    phase.spiralOffset = (offset + 0.6) % (Math.PI * 2);
                }
                break;
            }
            case 'beam': {
                if (this.game && typeof this.game.spawnEffect === 'function' && transform) {
                    this.game.spawnEffect({
                        position: { x: transform.position.x, y: transform.position.y + 60 },
                        alpha: 0.95,
                        lifeTime: 0.6,
                        fade: 1.6,
                        scale: { x: 1.0, y: 1.0 },
                        animation: 'beam_attack'
                    });
                }
                break;
            }
            case 'spread':
            default:
                projectiles.push({ vx: 0, vy: 6 });
                projectiles.push({ vx: 1.2, vy: 5.4 });
                projectiles.push({ vx: -1.2, vy: 5.4 });
                break;
        }

        projectiles.forEach(velocity => {
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

class BoundaryCleanupSystem extends System {
    constructor(game) {
        super();
        this.game = game;
        this.padding = 80;
    }

    update(entities, delta) {
        const screen = this._getScreen();

        entities.forEach(entity => {
            if (!entity.hasComponent(Transform)) {
                return;
            }

            if (entity.hasComponent(Player)) {
                return;
            }

            const position = entity.getComponent(Transform).position;
            if (position.x < -this.padding || position.x > screen.width + this.padding ||
                position.y < -this.padding || position.y > screen.height + this.padding) {
                entity.isRemoved = true;
            }
        });
    }

    _getScreen() {
        const renderer = this.game.app.renderer;
        return renderer ? renderer.screen : this.game.app.screen;
    }
}

class CleanupSystem extends System {
    constructor(game) {
        super();
        this.game = game;
    }

    update(entities, delta) {
        for (let i = entities.length - 1; i >= 0; i--) {
            const entity = entities[i];
            if (!entity.isRemoved) {
                continue;
            }

            if (entity.poolId) {
                this.game.releaseEntity(entity, i);
                continue;
            }

            if (entity.hasComponent(Sprite)) {
                const sprite = entity.getComponent(Sprite).sprite;
                if (sprite.parent) {
                    sprite.parent.removeChild(sprite);
                }
            }

            entities.splice(i, 1);
        }
    }
}

