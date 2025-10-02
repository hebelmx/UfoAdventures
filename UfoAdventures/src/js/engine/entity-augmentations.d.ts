export {};

import { Transform, Motion, Collider, Health, PlayerAbilities, EnemyBehavior, Weapon, Bullet, EnemyBullet, Sprite } from './components';

declare module './core' {
    interface Entity {
        transform?: Transform;
        motion?: Motion;
        collider?: Collider;
        health?: Health;
        abilities?: PlayerAbilities;
        enemyBehavior?: EnemyBehavior;
        weapon?: Weapon;
        bullet?: Bullet;
        enemyBullet?: EnemyBullet;
        sprite?: Sprite;
        poolId?: string;
        spawnCooldown?: number;
        spawnTimer?: number;
        removeOnCleanup?: boolean;
        spawnedBy?: string;
        waveId?: string;
        _stasisPaused?: boolean;
        [key: string]: unknown;
    }
}
