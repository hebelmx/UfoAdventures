class Component {
    constructor(type) {
        this.type = type;
        this.enabled = true;
        this.entity = null;
    }
}

class Transform extends Component {
    constructor(position = new Vector2(), rotation = 0, scale = new Vector2(1, 1)) {
        super('Transform');
        this.position = position;
        this.rotation = rotation;
        this.scale = scale;
        this.parent = null;
    }

    get worldPosition() {
        if (this.parent) {
            return Vector2.add(this.parent.worldPosition, this.position);
        }
        return this.position.copy();
    }
}

class Motion extends Component {
    constructor() {
        super('Motion');
        this.velocity = new Vector2();
        this.acceleration = new Vector2();
        this.angularVelocity = 0;
        this.maxSpeed = 300;
        this.drag = 0.95;
    }
}

class Health extends Component {
    constructor(maxHealth = 100) {
        super('Health');
        this.maxHealth = maxHealth;
        this.currentHealth = maxHealth;
        this.isInvulnerable = false;
        this.invulnerabilityTime = 0;
    }

    takeDamage(amount) {
        if (this.isInvulnerable) return false;
        
        this.currentHealth -= amount;
        this.currentHealth = Math.max(0, this.currentHealth);
        
        this.isInvulnerable = true;
        this.invulnerabilityTime = 0.5;
        
        return this.currentHealth <= 0;
    }

    heal(amount) {
        this.currentHealth = Math.min(this.maxHealth, this.currentHealth + amount);
    }

    update(deltaTime) {
        if (this.isInvulnerable) {
            this.invulnerabilityTime -= deltaTime;
            if (this.invulnerabilityTime <= 0) {
                this.isInvulnerable = false;
            }
        }
    }
}

class Sprite extends Component {
    constructor(imageSrc, width = 64, height = 64) {
        super('Sprite');
        this.image = new Image();
        this.image.src = imageSrc;
        this.width = width;
        this.height = height;
        this.currentFrame = 0;
        this.frameCount = 1;
        this.animationSpeed = 0.1;
        this.animationTimer = 0;
        this.flipX = false;
        this.flipY = false;
        this.alpha = 1.0;
        this.visible = true;
        this.animations = {};
        this.currentAnimation = null;
    }

    addAnimation(name, frames, speed = 0.1, loop = true) {
        this.animations[name] = {
            frames: frames,
            speed: speed,
            loop: loop,
            currentFrame: 0,
            timer: 0
        };
    }

    playAnimation(name) {
        if (this.animations[name] && this.currentAnimation !== name) {
            this.currentAnimation = name;
            this.animations[name].currentFrame = 0;
            this.animations[name].timer = 0;
        }
    }

    update(deltaTime) {
        if (this.currentAnimation && this.animations[this.currentAnimation]) {
            const anim = this.animations[this.currentAnimation];
            anim.timer += deltaTime;
            
            if (anim.timer >= anim.speed) {
                anim.timer = 0;
                anim.currentFrame++;
                
                if (anim.currentFrame >= anim.frames.length) {
                    if (anim.loop) {
                        anim.currentFrame = 0;
                    } else {
                        anim.currentFrame = anim.frames.length - 1;
                        this.currentAnimation = null;
                    }
                }
                
                this.currentFrame = anim.frames[anim.currentFrame];
            }
        }
    }
}

class Collider extends Component {
    constructor(type = 'circle', size = 32) {
        super('Collider');
        this.type = type;
        this.size = size;
        this.width = size;
        this.height = size;
        this.offset = new Vector2();
        this.isTrigger = false;
        this.layer = 'default';
    }

    getBounds(transform) {
        const pos = Vector2.add(transform.worldPosition, this.offset);
        
        if (this.type === 'circle') {
            return {
                type: 'circle',
                x: pos.x,
                y: pos.y,
                radius: this.size * Math.max(transform.scale.x, transform.scale.y)
            };
        } else {
            return {
                type: 'rectangle',
                x: pos.x - (this.width * transform.scale.x) / 2,
                y: pos.y - (this.height * transform.scale.y) / 2,
                width: this.width * transform.scale.x,
                height: this.height * transform.scale.y
            };
        }
    }
}