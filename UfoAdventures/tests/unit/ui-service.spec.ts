import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../../src/js/ui', () => ({
    initializeUI: vi.fn(),
    updateHealthDisplay: vi.fn(),
    flashHealthBar: vi.fn(),
    updateBossHealthDisplay: vi.fn(),
    flashBossHealthBar: vi.fn(),
    updateComboDisplay: vi.fn(),
    updateLivesDisplay: vi.fn(),
    addDamageLogEntry: vi.fn(),
    updateAbilityCooldown: vi.fn(),
    setHudMode: vi.fn(),
    showMessage: vi.fn()
}));

import {
    initializeUI,
    updateHealthDisplay,
    flashHealthBar,
    updateBossHealthDisplay,
    flashBossHealthBar,
    updateComboDisplay,
    updateLivesDisplay,
    addDamageLogEntry,
    updateAbilityCooldown,
    setHudMode,
    showMessage
} from '../../src/js/ui';

import { UiService } from '../../src/js/engine/ui-service';

describe('UiService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('initializes UI lazily before delegating', () => {
        const service = new UiService();

        service.updateHealth(75, 100);

        expect(initializeUI).toHaveBeenCalledTimes(1);
        expect(updateHealthDisplay).toHaveBeenCalledWith(75, 100);
    });

    it('delegates to wrapped helpers', () => {
        const service = new UiService();

        service.flashPlayerHealth();
        expect(flashHealthBar).toHaveBeenCalledTimes(1);

        service.updateBossHealth(50, 200);
        expect(updateBossHealthDisplay).toHaveBeenCalledWith(50, 200);

        service.flashBossHealth();
        expect(flashBossHealthBar).toHaveBeenCalledTimes(1);

        service.updateCombo(12);
        expect(updateComboDisplay).toHaveBeenCalledWith(12);

        service.updateLives(3);
        expect(updateLivesDisplay).toHaveBeenCalledWith(3);

        const entry = { amount: 10, type: 'enemy' } as any;
        service.addDamageLogEntry(entry);
        expect(addDamageLogEntry).toHaveBeenCalledWith(entry);

        const abilityState = { cooldown: 2, timer: 1 } as any;
        service.updateAbilityCooldown('teleport', abilityState);
        expect(updateAbilityCooldown).toHaveBeenCalledWith('teleport', abilityState);

        service.setHudMode('arcade');
        expect(setHudMode).toHaveBeenCalledWith('arcade');

        service.showMessage('hello', '#fff');
        expect(showMessage).toHaveBeenCalledWith('hello', '#fff');
    });
});
