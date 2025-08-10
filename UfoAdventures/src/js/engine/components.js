class Transform extends Component {
    constructor(position = { x: 0, y: 0 }, rotation = 0, scale = { x: 1, y: 1 }) {
        super();
        this.position = position;
        this.rotation = rotation;
        this.scale = scale;
    }
}

class Sprite extends Component {
    constructor(texture) {
        super();
        this.sprite = new PIXI.Sprite(texture);
        this.sprite.anchor.set(0.5);
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
    }
}

class Boss extends Component {
    constructor() {
        super();
    }
}