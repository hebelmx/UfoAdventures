class Transform extends Component {
    constructor(position = { x: 0, y: 0 }, rotation = 0, scale = { x: 1, y: 1 }) {
        super();
        this.position = position;
        this.rotation = rotation;
        this.scale = scale;
    }
}

class Sprite extends Component {
    constructor(input) {
        super();
        if (input && (input instanceof PIXI.Sprite || input instanceof PIXI.AnimatedSprite)) {
            this.sprite = input;
            if (this.sprite.anchor?.set) {
                this.sprite.anchor.set(0.5);
            } else if (this.sprite.anchor) {
                this.sprite.anchor.x = this.sprite.anchor.x ?? 0.5;
                this.sprite.anchor.y = this.sprite.anchor.y ?? 0.5;
            }
        } else {
            const texture = input || PIXI.Texture.WHITE;
            this.sprite = new PIXI.Sprite(texture);
            this.sprite.anchor.set(0.5);
        }
    }
}

class Motion extends Component {
    constructor(velocity = { x: 0, y: 0 }, speed = 5) {
        super();
        this.velocity = velocity;
        this.speed = speed;
    }
}

class Enemy extends Component {
    constructor() {
        super();
    }
}

class EnemyBehavior extends Component {
    constructor(config = {}) {
        super();
        this.pattern = config.pattern || 'sine';
        this.amplitude = config.amplitude ?? 80;
        this.frequency = config.frequency ?? 1.4;
        this.verticalSpeed = config.verticalSpeed ?? 2;
        this.diveSpeed = config.diveSpeed ?? 4;
        this.climbSpeed = config.climbSpeed ?? -3;
        this.horizontalSpeed = config.horizontalSpeed ?? 2.5;
        this.horizontalDrift = config.horizontalDrift ?? 0;
        this.originX = config.originX ?? null;
        this.elapsed = 0;
    }
}

class Weapon extends Component {
    constructor(fireRate = 0.5, isShooting = false) {
        super();
        this.fireRate = fireRate;
        this.isShooting = isShooting;
        this.fireTimer = 0;
    }
}

class Bullet extends Component {
    constructor() {
        super();
    }
}

class EnemyBullet extends Component {
    constructor() {
        super();
    }
}

class Collider extends Component {
    constructor(radius = 10) {
        super();
        this.radius = radius;
    }
}

class Health extends Component {
    constructor(health = 100) {
        super();
        this.health = health;
        this.max = health;
    }
}

class PlayerAbilities extends Component {
    constructor(options = {}) {
        super();
        const comboCooldown = options.comboBreakerCooldown ?? 5;
        const teleportCooldown = options.teleportCooldown ?? 3;
        this.states = {
            comboBreaker: { cooldown: comboCooldown, timer: 0, queued: false },
            teleport: { cooldown: teleportCooldown, timer: 0, queued: false }
        };
        this.lastDirection = { x: 0, y: -1 };
    }
}

class Boss extends Component {
    constructor() {
        super();
    }
}

class BossPhase extends Component {
    constructor(phases = [], maxHealth = 500) {
        super();
        this.phases = Array.isArray(phases) ? phases.slice() : [];
        this.maxHealth = maxHealth;
        this.currentIndex = 0;
        this.fireTimer = 0;
        this.spiralOffset = 0;
    }

    update(currentHealth) {
        if (!this.phases.length || !this.maxHealth) {
            return null;
        }

        const ratio = Math.max(0, currentHealth) / this.maxHealth;
        for (let i = 0; i < this.phases.length; i++) {
            const threshold = typeof this.phases[i].threshold === 'number' ? this.phases[i].threshold : 1;
            if (ratio <= threshold) {
                if (i !== this.currentIndex) {
                    this.currentIndex = i;
                    this.fireTimer = 0;
                    return this.phases[i];
                }
                return null;
            }
        }

        return null;
    }

    getCurrent() {
        return this.phases[this.currentIndex] || null;
    }
}
