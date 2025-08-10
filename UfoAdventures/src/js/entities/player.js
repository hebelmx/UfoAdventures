class Player extends Component {
    constructor() {
        super();
        this.combo = 0;
        this.lives = 3;
    }

    takeDamage(amount) {
        const healthComponent = this.entity.getComponent(Health);
        if (healthComponent) {
            healthComponent.health -= amount;
            if (healthComponent.health < 0) {
                healthComponent.health = 0;
            }
        }
    }

    updateCombo(amount) {
        this.combo += amount;
    }

    updateLives(amount) {
        this.lives += amount;
    }
}