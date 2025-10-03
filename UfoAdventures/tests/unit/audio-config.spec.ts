import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

type AudioTrack = {
    alias: string;
    src: string;
    loop?: boolean;
    volume?: number;
};

type AudioConfig = {
    music?: AudioTrack[];
    sfx?: AudioTrack[];
};

const configPath = join(process.cwd(), 'src', 'config', 'audio-config.json');
const audioConfig = JSON.parse(readFileSync(configPath, 'utf8')) as AudioConfig;

const musicAliases = new Set((audioConfig.music || []).map(track => track.alias));
const sfxAliases = new Set((audioConfig.sfx || []).map(track => track.alias));

const requiredMusic = ['music_main_theme', 'music_boss_encounter', 'music_results'];
const requiredSfx = [
    'sfx_player_fire',
    'sfx_enemy_fire',
    'sfx_combo_breaker',
    'sfx_teleport',
    'sfx_player_damage',
    'sfx_enemy_damage',
    'sfx_boss_phase_shift',
    'sfx_boss_defeated',
    'sfx_results_success',
    'sfx_results_failure'
];

describe('audio configuration', () => {
    it('lists all runtime music aliases', () => {
        requiredMusic.forEach(alias => {
            expect(musicAliases.has(alias)).toBe(true);
        });
        expect(musicAliases.size).toBe(requiredMusic.length);
    });

    it('provides SFX cues for runtime events', () => {
        requiredSfx.forEach(alias => {
            expect(sfxAliases.has(alias)).toBe(true);
        });
        expect(sfxAliases.size).toBeGreaterThanOrEqual(requiredSfx.length);
    });

    it('assigns volume levels between 0 and 1 for each track', () => {
        const allTracks = [
            ...(audioConfig.music || []),
            ...(audioConfig.sfx || [])
        ];
        allTracks.forEach(track => {
            expect(typeof track.alias).toBe('string');
            expect(typeof track.src).toBe('string');
            if (typeof track.volume === 'number') {
                expect(track.volume).toBeGreaterThanOrEqual(0);
                expect(track.volume).toBeLessThanOrEqual(1);
            }
        });
    });
});
