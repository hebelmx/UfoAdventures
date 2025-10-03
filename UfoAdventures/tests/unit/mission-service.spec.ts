import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { MissionService } from '../../src/js/engine/mission-service';
import type { MissionConfig, Mission } from '../../src/js/engine/mission-service';

const configPath = join(process.cwd(), 'src', 'config', 'game-config.json');
const gameConfig = JSON.parse(readFileSync(configPath, 'utf8')) as { missions: MissionConfig };

describe('MissionService scoring alignment', () => {
    let missionService: MissionService;
    let mission: Mission | null;

    beforeAll(() => {
        missionService = new MissionService();
        missionService.configure(gameConfig.missions);
        mission = missionService.getById('operation-first-contact');
        expect(mission).not.toBeNull();
    });

    it('rewards full completion for Operation First Contact', () => {
        const telemetry = {
            enemyKills: 35,
            bossDefeated: true,
            damageTaken: 60,
            durationSeconds: 195
        };
        const score = missionService.calculateScore(mission!, telemetry);
        expect(score).toBe(4118);
    });

    it('penalises missed objectives and damage taken', () => {
        const telemetry = {
            enemyKills: 35,
            bossDefeated: false,
            damageTaken: 120,
            durationSeconds: 240
        };
        const score = missionService.calculateScore(mission!, telemetry);
        expect(score).toBe(2556);

        const objectives = missionService.evaluateObjectives(mission!, telemetry);
        const byId = (id: string) => objectives.find(obj => obj.id === id);

        expect(byId('clear-wave')?.completed).toBe(true);
        expect(byId('defeat-boss')?.completed).toBe(false);
        expect(byId('time-check')?.completed).toBe(false);
    });
});
