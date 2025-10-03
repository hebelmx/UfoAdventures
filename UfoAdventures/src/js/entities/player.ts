import { Component } from '../engine/core';
import { Health } from '../engine/components';

export class Player extends Component {
    combo = 0;
    lives = 3;

    takeDamage(amount: number): void {
        const damage = Number.isFinite(amount) ? amount : 0;
        if (!this.entity || damage <= 0) {
            return;
        }
        const healthComponent = this.entity.getComponent(Health);
        if (!healthComponent) {
            return;
        }
        healthComponent.health = Math.max(0, healthComponent.health - damage);
    }

    updateCombo(delta: number): void {
        if (!Number.isFinite(delta)) {
            return;
        }
        this.combo += delta;
    }

    updateLives(delta: number): void {
        if (!Number.isFinite(delta)) {
            return;
        }
        this.lives += delta;
    }
}
