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
                motion.velocity.y = vertical * motion.speed;\r\n\r\n                if (entity.hasComponent(PlayerAbilities)) {\r\n                    const abilities = entity.getComponent(PlayerAbilities);\r\n                    const vx = motion.velocity.x;\r\n                    const vy = motion.velocity.y;\r\n                    if (Math.abs(vx) > 0.05 || Math.abs(vy) > 0.05) {\r\n                        const magnitude = Math.sqrt(vx * vx + vy * vy) || 1;\r\n                        abilities.lastDirection = { x: vx / magnitude, y: vy / magnitude };\r\n                    }\r\n                }
            }

            if (entity.hasComponent(Weapon)) {
                const weapon = entity.getComponent(Weapon);
                const isActive = this.input ? this.input.isActionActive('attackPrimary') : false;
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

        const direction = abilities.lastDirection || { x: 0, y: -1 };
        const magnitude = Math.sqrt(direction.x * direction.x + direction.y * direction.y) || 1;
        const normalized = { x: direction.x / magnitude, y: direction.y / magnitude };
        const distance = 140;
        const screen = this._getScreen();

        transform.position.x = this._clamp(transform.position.x + normalized.x * distance, 30, screen.width - 30);
        transform.position.y = this._clamp(transform.position.y + normalized.y * distance, 30, screen.height - 30);

        state.timer = state.cooldown;
        state.queued = false;

        if (typeof showMessage === 'function') {
            showMessage('Teleport!', '#66ccff');
        }

        if (this.eventBus) {
            this.eventBus.emit('ability:teleport', { player, direction: normalized });
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
                const enemy = this._createEnemy(template, pos, spawn.altitude);
                this.game.addEntity(enemy);
            });
        });
    }

    _createEnemy(template, positionRatio, altitude) {
        const screen = this._getScreen();
        const spawnX = screen.width * positionRatio;
        const spawnY = typeof altitude === 'number' ? altitude : -50;

        const enemy = new Entity();
        enemy.addComponent(new Transform({ x: spawnX, y: spawnY }));
        enemy.addComponent(new Sprite(PIXI.Assets.get(template.texture)));
        enemy.addComponent(new Motion({ x: 0, y: template.verticalSpeed || 2 }));
        enemy.addComponent(new Enemy());
        enemy.addComponent(new Collider(20));

        const behaviorConfig = Object.assign({}, template, { originX: spawnX });
        enemy.addComponent(new EnemyBehavior(behaviorConfig));

        return enemy;
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
            weapon.fireTimer += delta / 60;

            if (!weapon.isShooting || weapon.fireTimer < weapon.fireRate) {
                return;
            }

            weapon.fireTimer = 0;

            const bullet = new Entity();
            bullet.addComponent(new Transform({ x: transform.position.x, y: transform.position.y - 20 }));
            const spriteComponent = new Sprite(PIXI.Texture.WHITE);
            spriteComponent.sprite.width = 5;
            spriteComponent.sprite.height = 12;
            spriteComponent.sprite.tint = 0xffff88;
            bullet.addComponent(spriteComponent);
            bullet.addComponent(new Motion({ x: 0, y: -12 }));
            bullet.addComponent(new Bullet());
            bullet.addComponent(new Collider(5));

            this.game.addEntity(bullet);

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
    }

    update(entities, delta) {
        const bullets = entities.filter(e => e.hasComponent(Bullet) && !e.isRemoved);
        const enemies = entities.filter(e => e.hasComponent(Enemy) && !e.isRemoved);
        const bosses = entities.filter(e => e.hasComponent(Boss) && !e.isRemoved);
        const enemyProjectiles = entities.filter(e => e.hasComponent(EnemyBullet) && !e.isRemoved);
        const player = entities.find(e => e.hasComponent(Player) && !e.isRemoved);

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

        if (player) {
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
    }

    _isColliding(entityA, entityB) {
        const transformA = entityA.getComponent(Transform);
        const transformB = entityB.getComponent(Transform);
        const colliderA = entityA.getComponent(Collider);
        const colliderB = entityB.getComponent(Collider);

        if (!transformA || !transformB || !colliderA || !colliderB) {
            return false;
        }

        const dx = transformA.position.x - transformB.position.x;
        const dy = transformA.position.y - transformB.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        return distance < colliderA.radius + colliderB.radius;
    }

    _handleBulletHitsEnemy(bullet, enemy) {
        bullet.isRemoved = true;
        enemy.isRemoved = true;
        this._emitDamage(enemy, bullet, 10, enemy.getComponent(Health), 'projectile');
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
        const deltaSeconds = delta / 60;

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











