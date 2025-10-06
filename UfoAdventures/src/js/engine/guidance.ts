import { Entity } from './core';
import { Motion, Transform, Vector2Like } from './components';

export interface GuidanceSystem {
    update(missile: Entity, target: Entity, deltaSeconds: number): Vector2Like;
}

export class ProportionalNavigationGuidance implements GuidanceSystem {
    private readonly navigationConstant: number;

    constructor(navigationConstant = 3) {
        this.navigationConstant = navigationConstant;
    }

    update(missile: Entity, target: Entity, deltaSeconds: number): Vector2Like {
        const mT = missile.getComponent(Transform);
        const mM = missile.getComponent(Motion);
        const tT = target.getComponent(Transform);
        const tM = target.getComponent(Motion);
        if (!mT || !mM || !tT || !tM) {
            return { x: 0, y: 0 };
        }

        const rx = tT.position.x - mT.position.x;
        const ry = tT.position.y - mT.position.y;
        const rvx = tM.velocity.x - mM.velocity.x;
        const rvy = tM.velocity.y - mM.velocity.y;

        const rangeSq = Math.max(1e-3, rx * rx + ry * ry);
        const losRate = (rx * rvy - ry * rvx) / rangeSq;

        // Command acceleration perpendicular to line-of-sight
        const invLen = 1 / Math.max(1e-3, Math.sqrt(rangeSq));
        const nx = rx * invLen;
        const ny = ry * invLen;
        const px = -ny; // perpendicular
        const py = nx;

        const accel = this.navigationConstant * losRate;
        return { x: px * accel, y: py * accel };
    }
}


