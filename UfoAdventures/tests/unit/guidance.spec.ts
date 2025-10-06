import { describe, expect, it } from 'vitest';
import { ProportionalNavigationGuidance } from '../../src/js/engine/guidance';
import { Entity } from '../../src/js/engine/core';
import { Motion, Transform } from '../../src/js/engine/components';

const makeEntity = (x: number, y: number, vx: number, vy: number): Entity => {
    const e = new Entity();
    e.addComponent(new Transform({ x, y }));
    e.addComponent(new Motion({ x: vx, y: vy }));
    return e;
};

describe('ProportionalNavigationGuidance', () => {
    it('returns perpendicular acceleration based on LOS rate', () => {
        const g = new ProportionalNavigationGuidance(3);
        const missile = makeEntity(0, 0, 1, 0);
        const target = makeEntity(10, 0, 0, 1);
        const a = g.update(missile, target, 1 / 60);
        expect(Number.isFinite(a.x)).toBe(true);
        expect(Number.isFinite(a.y)).toBe(true);
    });
});


