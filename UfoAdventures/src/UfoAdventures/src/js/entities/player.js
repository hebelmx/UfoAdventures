class PlayerController extends Component {
    constructor() {
        super('PlayerController');
        this.moveSpeed = 200;
        this.isGrounded = false;
        this.facingRight = true;
        this.health = 100;
        this.maxHealth = 100;
    }

    update(deltaTime) {
        if (!Game.instance) return;
        
        const input = Game.instance.getInput();
        const transform = this.entity.getComponent('Transform');
        const motion = this.entity.getComponent('Motion');
        
        if (!transform || !motion) return;

        // Movement input
        let horizontal = 0;
        if (input.isKeyPressed('KeyA') || input.isKeyPressed('ArrowLeft')) {
            horizontal = -1;
        }
        if (input.isKeyPressed('KeyD') || input.isKeyPressed('ArrowRight')) {
            horizontal = 1;
        }

        // Apply horizontal movement
        if (horizontal !== 0) {
            motion.acceleration.x = horizontal * 800;
            
            if (horizontal > 0 && !this.facingRight) {
                this.facingRight = true;
                const sprite = this.entity.getComponent('Sprite');
                if (sprite) sprite.flipX = false;
            } else if (horizontal < 0 && this.facingRight) {
                this.facingRight = false;
                const sprite = this.entity.getComponent('Sprite');
                if (sprite) sprite.flipX = true;
            }
        } else {
            motion.acceleration.x = 0;
            motion.velocity.x *= 0.85; // friction
        }

        // Limit horizontal speed
        motion.velocity.x = Math.max(-this.moveSpeed, Math.min(this.moveSpeed, motion.velocity.x));

        // Jump input
        if ((input.isKeyPressed('KeyW') || input.isKeyPressed('ArrowUp') || input.isKeyPressed('Space')) && this.isGrounded) {
            motion.velocity.y = -400;
            this.isGrounded = false;
        }

        // Simple ground collision
        const groundLevel = 500;
        if (transform.position.y >= groundLevel) {
            transform.position.y = groundLevel;
            if (motion.velocity.y > 0) {
                motion.velocity.y = 0;
                this.isGrounded = true;
            }
        } else {
            // Apply gravity
            motion.velocity.y += 800 * deltaTime;
        }

        // Attack input
        if (input.isKeyPressed('KeyJ') || input.isMouseButtonPressed(0)) {
            this.performAttack();
        }
    }

    performAttack() {
        // Simple attack - damage nearby enemies
        const transform = this.entity.getComponent('Transform');
        const enemies = Game.instance.findEntitiesByTag('enemy');
        
        enemies.forEach(enemy => {
            if (!enemy.active) return;
            
            const enemyPos = enemy.getComponent('Transform').position;
            const distance = Vector2.distance(transform.position, enemyPos);
            
            if (distance <= 80) {
                const health = enemy.getComponent('Health');
                if (health) {
                    const isDead = health.takeDamage(50);
                    if (isDead) {
                        // Handle enemy death
                    }
                }
            }
        });
    }
}

function createPlayer(x, y) {
    const player = Game.instance.createEntity()
        .addComponent(new Transform(new Vector2(x, y)))
        .addComponent(new Motion())
        .addComponent(new Health(100))
        .addComponent(new Sprite(createPlaceholderImage(64, 64, '#00ff00'), 64, 64))
        .addComponent(new Collider('rectangle', 32))
        .addComponent(new PlayerController())
        .addTag('player');

    return player;
}