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
    constructor() {
        super();
        this.keys = {};

        window.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
        });

        window.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });
    }

    update(entities, delta) {
        entities.forEach(entity => {
            if (entity.hasComponent(Motion)) {
                const motion = entity.getComponent(Motion);

                if (this.keys['ArrowLeft'] || this.keys['KeyA']) {
                    motion.velocity.x = -motion.speed;
                } else if (this.keys['ArrowRight'] || this.keys['KeyD']) {
                    motion.velocity.x = motion.speed;
                } else {
                    motion.velocity.x = 0;
                }

                if (this.keys['ArrowUp'] || this.keys['KeyW']) {
                    motion.velocity.y = -motion.speed;
                } else if (this.keys['ArrowDown'] || this.keys['KeyS']) {
                    motion.velocity.y = motion.speed;
                } else {
                    motion.velocity.y = 0;
                }
            }

            if (entity.hasComponent(Weapon)) {
                const weapon = entity.getComponent(Weapon);
                if (this.keys['Space']) {
                    weapon.isShooting = true;
                } else {
                    weapon.isShooting = false;
                }
            }
        });
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

class EnemySpawningSystem extends System {
    constructor(game) {
        super();
        this.game = game;
        this.spawnInterval = 2; // seconds
        this.spawnTimer = 0;
    }

    update(entities, delta) {
        this.spawnTimer += delta / 60; // convert delta to seconds

        if (this.spawnTimer >= this.spawnInterval) {
            this.spawnTimer = 0;

            const enemy = new Entity();
            const x = Math.random() * (this.game.app.screen.width - 50) + 25;
            enemy.addComponent(new Transform({ x, y: -50 }));

            const enemyType = Math.random() > 0.5 ? 'amidogus' : 'blade';
            enemy.addComponent(new Sprite(PIXI.Assets.get(enemyType)));
            enemy.addComponent(new Motion({ x: 0, y: 2 }));
            enemy.addComponent(new Enemy());
            enemy.addComponent(new Collider(20));

            this.game.entities.push(enemy);
            this.game.app.stage.addChild(enemy.getComponent(Sprite).sprite);
        }
    }
}

class ShootingSystem extends System {
    constructor(game) {
        super();
        this.game = game;
    }

    update(entities, delta) {
        entities.forEach(entity => {
            if (entity.hasComponent(Weapon)) {
                const weapon = entity.getComponent(Weapon);
                const transform = entity.getComponent(Transform);

                weapon.fireTimer += delta / 60;

                if (weapon.isShooting && weapon.fireTimer >= weapon.fireRate) {
                    weapon.fireTimer = 0;

                    const bullet = new Entity();
                    bullet.addComponent(new Transform({ x: transform.position.x, y: transform.position.y - 20 }));
                    bullet.addComponent(new Sprite(PIXI.Texture.WHITE));
                    bullet.getComponent(Sprite).sprite.width = 5;
                    bullet.getComponent(Sprite).sprite.height = 10;
                    bullet.addComponent(new Motion({ x: 0, y: -10 }));
                    bullet.addComponent(new Bullet());
                    bullet.addComponent(new Collider(5));

                    this.game.entities.push(bullet);
                    this.game.app.stage.addChild(bullet.getComponent(Sprite).sprite);
                }
            }
        });
    }
}

class CollisionSystem extends System {
    constructor(game) {
        super();
        this.game = game;
    }

    update(entities, delta) {
        const bullets = entities.filter(e => e.hasComponent(Bullet));
        const enemies = entities.filter(e => e.hasComponent(Enemy));
        const player = entities.find(e => e.hasComponent(Player));

        bullets.forEach(bullet => {
            enemies.forEach(enemy => {
                if (this.isColliding(bullet, enemy)) {
                    this.handleCollision(bullet, enemy);
                }
            });
        });

        if (player) {
            enemies.forEach(enemy => {
                if (this.isColliding(player, enemy)) {
                    this.handleCollision(player, enemy);
                }
            });
        }
    }

    isColliding(entityA, entityB) {
        const transformA = entityA.getComponent(Transform);
        const transformB = entityB.getComponent(Transform);
        const colliderA = entityA.getComponent(Collider);
        const colliderB = entityB.getComponent(Collider);

        const dx = transformA.position.x - transformB.position.x;
        const dy = transformA.position.y - transformB.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        return distance < colliderA.radius + colliderB.radius;
    }

    handleCollision(entityA, entityB) {
        if (entityA.hasComponent(Bullet) && entityB.hasComponent(Enemy)) {
            entityA.isRemoved = true;
            entityB.isRemoved = true;
        } else if (entityA.hasComponent(Player) && entityB.hasComponent(Enemy)) {
            const player = entityA.getComponent(Player);
            player.takeDamage(10);
            entityB.isRemoved = true;
        } else if (entityA.hasComponent(Bullet) && entityB.hasComponent(Boss)) {
            const bossHealth = entityB.getComponent(Health);
            bossHealth.health -= 10;
            entityA.isRemoved = true;

            if (bossHealth.health <= 0) {
                entityB.isRemoved = true;
            }
        } else if (entityA.hasComponent(Player) && entityB.hasComponent(EnemyBullet)) {
            const player = entityA.getComponent(Player);
            player.takeDamage(10);
            entityB.isRemoved = true;
        }
    }

    removeEntity(entity) {
        const index = this.game.entities.indexOf(entity);
        if (index > -1) {
            this.game.entities.splice(index, 1);
        }

        if (entity.hasComponent(Sprite)) {
            this.game.app.stage.removeChild(entity.getComponent(Sprite).sprite);
        }
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
            updateHealthDisplay(health.health, 100); // Assuming max health is 100 for display
            updateComboDisplay(player.combo);
            updateLivesDisplay(player.lives);
        }

        // Boss health bar handling
        const bossEntity = entities.find(e => e.hasComponent(Boss));
        const bossBarEl = document.getElementById('bossHealthBar');
        if (bossEntity) {
            const bossHealth = bossEntity.getComponent(Health);
            const max = bossHealth.max || bossHealth.health;
            updateBossHealthDisplay(bossHealth.health, max);
            if (bossBarEl) bossBarEl.style.display = 'block';
        } else {
            if (bossBarEl) bossBarEl.style.display = 'none';
        }
    }
}

class BossAISystem extends System {
    constructor(game) {
        super();
        this.game = game;
    }

    update(entities, delta) {
        entities.forEach(entity => {
            if (entity.hasComponent(Boss)) {
                const transform = entity.getComponent(Transform);
                const motion = entity.getComponent(Motion);

                if (transform.position.x < 100) {
                    motion.velocity.x = motion.speed;
                } else if (transform.position.x > 700) {
                    motion.velocity.x = -motion.speed;
                }
            }
        });
    }
}

class BossShootingSystem extends System {
    constructor(game) {
        super();
        this.game = game;
        this.fireRate = 1; // seconds
        this.fireTimer = 0;
    }

    update(entities, delta) {
        this.fireTimer += delta / 60;

        if (this.fireTimer >= this.fireRate) {
            this.fireTimer = 0;

            entities.forEach(entity => {
                if (entity.hasComponent(Boss)) {
                    const transform = entity.getComponent(Transform);

                    const bullet = new Entity();
                    bullet.addComponent(new Transform({ x: transform.position.x, y: transform.position.y + 50 }));
                    bullet.addComponent(new Sprite(PIXI.Texture.WHITE));
                    bullet.getComponent(Sprite).sprite.width = 10;
                    bullet.getComponent(Sprite).sprite.height = 10;
                    bullet.addComponent(new Motion({ x: 0, y: 5 }));
                    bullet.addComponent(new EnemyBullet());
                    bullet.addComponent(new Collider(5));

                    this.game.entities.push(bullet);
                    this.game.app.stage.addChild(bullet.getComponent(Sprite).sprite);
                }
            });
        }
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
            if (entity.isRemoved) {
                if (entity.hasComponent(Sprite)) {
                    this.game.app.stage.removeChild(entity.getComponent(Sprite).sprite);
                }
                entities.splice(i, 1);
            }
        }
    }
}
