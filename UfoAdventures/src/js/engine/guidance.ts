import { Entity } from './core';
import { Motion, Transform, Vector2Like } from './components';

export interface GuidanceSystem {
    update(missile: Entity, target: Entity, deltaSeconds: number): Vector2Like;
}

export class ProportionalNavigationGuidance implements GuidanceSystem {
    private readonly navigationConstant: number;
    private readonly maxAcceleration: number;

    constructor(navigationConstant = 3, maxAcceleration = 50) {
        this.navigationConstant = navigationConstant;
        this.maxAcceleration = maxAcceleration;
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
        const clampedAccel = Math.min(Math.abs(accel), this.maxAcceleration) * Math.sign(accel);
        
        return { x: px * clampedAccel, y: py * clampedAccel };
    }
}

export class PurePursuitGuidance implements GuidanceSystem {
    private readonly lookAheadTime: number;
    private readonly maxAcceleration: number;

    constructor(lookAheadTime = 1.0, maxAcceleration = 30) {
        this.lookAheadTime = lookAheadTime;
        this.maxAcceleration = maxAcceleration;
    }

    update(missile: Entity, target: Entity, deltaSeconds: number): Vector2Like {
        const mT = missile.getComponent(Transform);
        const mM = missile.getComponent(Motion);
        const tT = target.getComponent(Transform);
        const tM = target.getComponent(Motion);
        if (!mT || !mM || !tT || !tM) {
            return { x: 0, y: 0 };
        }

        // Predict target position
        const predictedX = tT.position.x + tM.velocity.x * this.lookAheadTime;
        const predictedY = tT.position.y + tM.velocity.y * this.lookAheadTime;

        // Calculate desired velocity towards predicted position
        const dx = predictedX - mT.position.x;
        const dy = predictedY - mT.position.y;
        const distance = Math.max(1e-3, Math.sqrt(dx * dx + dy * dy));
        
        const desiredSpeed = Math.min(distance / this.lookAheadTime, 200);
        const desiredVx = (dx / distance) * desiredSpeed;
        const desiredVy = (dy / distance) * desiredSpeed;

        // Calculate acceleration needed to reach desired velocity
        const accelX = (desiredVx - mM.velocity.x) / this.lookAheadTime;
        const accelY = (desiredVy - mM.velocity.y) / this.lookAheadTime;

        // Clamp acceleration
        const accelMagnitude = Math.sqrt(accelX * accelX + accelY * accelY);
        if (accelMagnitude > this.maxAcceleration) {
            const scale = this.maxAcceleration / accelMagnitude;
            return { x: accelX * scale, y: accelY * scale };
        }

        return { x: accelX, y: accelY };
    }
}

export class InterceptGuidance implements GuidanceSystem {
    private readonly maxAcceleration: number;
    private readonly maxIterations: number;

    constructor(maxAcceleration = 40, maxIterations = 5) {
        this.maxAcceleration = maxAcceleration;
        this.maxIterations = maxIterations;
    }

    update(missile: Entity, target: Entity, deltaSeconds: number): Vector2Like {
        const mT = missile.getComponent(Transform);
        const mM = missile.getComponent(Motion);
        const tT = target.getComponent(Transform);
        const tM = target.getComponent(Motion);
        if (!mT || !mM || !tT || !tM) {
            return { x: 0, y: 0 };
        }

        // Calculate intercept point
        const interceptPoint = this._calculateInterceptPoint(mT, mM, tT, tM);
        if (!interceptPoint) {
            return { x: 0, y: 0 };
        }

        // Calculate desired velocity towards intercept point
        const dx = interceptPoint.x - mT.position.x;
        const dy = interceptPoint.y - mT.position.y;
        const distance = Math.max(1e-3, Math.sqrt(dx * dx + dy * dy));
        
        const missileSpeed = Math.sqrt(mM.velocity.x * mM.velocity.x + mM.velocity.y * mM.velocity.y);
        const desiredSpeed = Math.max(missileSpeed, 100);
        const desiredVx = (dx / distance) * desiredSpeed;
        const desiredVy = (dy / distance) * desiredSpeed;

        // Calculate acceleration
        const accelX = (desiredVx - mM.velocity.x) * 2; // Simple proportional control
        const accelY = (desiredVy - mM.velocity.y) * 2;

        // Clamp acceleration
        const accelMagnitude = Math.sqrt(accelX * accelX + accelY * accelY);
        if (accelMagnitude > this.maxAcceleration) {
            const scale = this.maxAcceleration / accelMagnitude;
            return { x: accelX * scale, y: accelY * scale };
        }

        return { x: accelX, y: accelY };
    }

    private _calculateInterceptPoint(
        mT: Transform, mM: Motion, tT: Transform, tM: Motion
    ): { x: number; y: number } | null {
        let interceptX = tT.position.x;
        let interceptY = tT.position.y;
        
        for (let i = 0; i < this.maxIterations; i++) {
            const dx = interceptX - mT.position.x;
            const dy = interceptY - mT.position.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < 1e-3) break;
            
            const missileSpeed = Math.sqrt(mM.velocity.x * mM.velocity.x + mM.velocity.y * mM.velocity.y);
            const timeToIntercept = distance / Math.max(missileSpeed, 1);
            
            interceptX = tT.position.x + tM.velocity.x * timeToIntercept;
            interceptY = tT.position.y + tM.velocity.y * timeToIntercept;
        }
        
        return { x: interceptX, y: interceptY };
    }
}


