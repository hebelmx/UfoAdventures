class BossAI extends Component {
    constructor() {
        super('BossAI');
        this.speed = 30;
        this.attackCooldown = 3;
        this.lastAttackTime = 0;
        this.phase = 1;
    }

    update(deltaTime) {
        this.lastAttackTime -= deltaTime;
        
        const transform = this.entity.getComponent('Transform');
        const motion = this.entity.getComponent('Motion');
        const health = this.entity.getComponent('Health');
        
        if (!transform || !motion || !health) return;

        // Phase transitions
        const healthPercent = health.currentHealth / health.maxHealth;
        if (healthPercent <= 0.66 && this.phase === 1) {
            this.phase = 2;
            if (Game.eventBus) {
                Game.eventBus.emit('bossPhaseChanged', { phase: 2 });
            }
        } else if (healthPercent <= 0.33 && this.phase === 2) {
            this.phase = 3;
            if (Game.eventBus) {
                Game.eventBus.emit('bossPhaseChanged', { phase: 3 });
            }
        }

        const player = Game.instance.findEntityByTag('player');
        if (player) {
            const playerPos = player.getComponent('Transform').position;
            const distance = Vector2.distance(transform.position, playerPos);
            
            // Move towards player
            if (distance > 100) {
                const direction = Vector2.normalize(Vector2.subtract(playerPos, transform.position));
                motion.velocity.x = direction.x * this.speed;
                motion.velocity.y = direction.y * this.speed;
            } else {
                motion.velocity.x *= 0.9;
                motion.velocity.y *= 0.9;
            }

            // Attack
            if (this.lastAttackTime <= 0 && distance <= 200) {
                this.performAttack();
                this.lastAttackTime = this.attackCooldown;
            }
        }

        // Keep boss on screen
        transform.position.x = Math.max(128, Math.min(672, transform.position.x));
        transform.position.y = Math.max(128, Math.min(472, transform.position.y));
    }

    performAttack() {
        if (Game.eventBus) {
            Game.eventBus.emit('bossAttackStarted', { attack: 'fire_breath' });
        }
        
        // Damage player if close
        const transform = this.entity.getComponent('Transform');
        const player = Game.instance.findEntityByTag('player');
        
        if (player) {
            const playerPos = player.getComponent('Transform').position;
            const distance = Vector2.distance(transform.position, playerPos);
            
            if (distance <= 150) {
                const playerHealth = player.getComponent('Health');
                if (playerHealth) {
                    playerHealth.takeDamage(50);
                }
            }
        }
    }
}