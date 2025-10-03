import { describe, it, beforeEach, afterEach, expect } from 'vitest';
import { initializeUI, updateHealthDisplay, updateAbilityCooldown, setHudMode, addDamageLogEntry } from '../../src/js/ui';

describe('HUD UI helpers', () => {
    beforeEach(() => {
        document.body.innerHTML = [
            '<div id="healthFill"></div>',
            '<div id="comboFill"></div>',
            '<span id="comboCount"></span>',
            '<div id="livesDisplay"></div>',
            '<div id="bossHealthBar"></div>',
            '<div id="bossHealthFill"></div>',
            '<div id="damageLog"></div>',
            '<div id="abilityCombo"></div>',
            '<div id="abilityTeleport"></div>',
            '<div id="abilityShield"></div>',
            '<div id="abilityStasis"></div>'
        ].join('');
        initializeUI();
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('updates health bar width based on current health', () => {
        updateHealthDisplay(75, 100);
        const fill = document.getElementById('healthFill') as HTMLElement;
        expect(fill.style.width).toBe('75%');
    });

    it('marks abilities as ready when cooldown expires', () => {
        updateAbilityCooldown('shield', { cooldown: 5, timer: 0 });
        const shield = document.getElementById('abilityShield') as HTMLElement;
        expect(shield.classList.contains('ready')).toBe(true);
    });

    it('switches HUD mode and clears damage log in training mode', () => {
        addDamageLogEntry({ type: 'enemy', amount: 10, target: 'Drone' });
        setHudMode('training');
        expect(document.body.classList.contains('hud-mode-training')).toBe(true);
        const log = document.getElementById('damageLog') as HTMLElement;
        expect(log.children.length).toBe(0);
    });
});
