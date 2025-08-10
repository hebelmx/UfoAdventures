class Enemy {
    constructor(type, x, y) {
        this.type = type;
        this.transform = new Transform(new Vector2(x, y));
        this.motion = new Motion();
        this.health = new Health(this.getHealth());
        this.sprite = new Sprite(this.getSprite(), 32, 32);
        this.collider = new Collider('circle', 16);
        this.ai = this.getAI();

        this.entity = new Entity();
        this.entity.addComponent(this.transform);
        this.entity.addComponent(this.motion);
        this.entity.addComponent(this.health);
        this.entity.addComponent(this.sprite);
        this.entity.addComponent(this.collider);
        this.entity.addComponent(this.ai);
        this.entity.addTag('enemy');
    }

    getHealth() {
        switch (this.type) {
            case 'dogus':
                return 50;
            case 'octopus_creature':
                return 80;
            case 'wimidir':
                return 100;
            default:
                return 50;
        }
    }

    getSprite() {
        switch (this.type) {
            case 'dogus':
                return createPlaceholderImage(32, 32, '#ffff00');
            case 'octopus_creature':
                return createPlaceholderImage(32, 32, '#ff00ff');
            case 'wimidir':
                return createPlaceholderImage(32, 32, '#00ffff');
            default:
                return createPlaceholderImage(32, 32, '#ffffff');
        }
    }

    getAI() {
        switch (this.type) {
            case 'dogus':
                return new EnemyAI();
            case 'octopus_creature':
                return new EnemyAI(); // Placeholder for specific AI
            case 'wimidir':
                return new EnemyAI(); // Placeholder for specific AI
            default:
                return new EnemyAI();
        }
    }
}

function createEnemy(type, x, y) {
    return new Enemy(type, x, y).entity;
}