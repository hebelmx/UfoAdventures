import {
    initializeUI,
    updateHealthDisplay as coreUpdateHealthDisplay,
    flashHealthBar as coreFlashHealthBar,
    updateBossHealthDisplay as coreUpdateBossHealthDisplay,
    flashBossHealthBar as coreFlashBossHealthBar,
    updateComboDisplay as coreUpdateComboDisplay,
    updateLivesDisplay as coreUpdateLivesDisplay,
    addDamageLogEntry as coreAddDamageLogEntry,
    updateAbilityCooldown as coreUpdateAbilityCooldown,
    setHudMode as coreSetHudMode,
    showMessage as coreShowMessage,
    type AbilityName,
    type AbilityState,
    type DamageLogEntry,
    type HudMode
} from '../ui';

export type { AbilityName, AbilityState, DamageLogEntry, HudMode } from '../ui';

export class UiService {
    private initialized = false;

    constructor() {
        this.initialize();
    }

    initialize(): void {
        if (this.initialized) {
            return;
        }
        initializeUI();
        this.initialized = true;
    }

    private ensureInitialized(): void {
        if (!this.initialized) {
            this.initialize();
        }
    }

    updateHealth(current: number, max: number): void {
        this.ensureInitialized();
        coreUpdateHealthDisplay(current, max);
    }

    flashPlayerHealth(): void {
        this.ensureInitialized();
        coreFlashHealthBar();
    }

    updateBossHealth(current: number, max: number): void {
        this.ensureInitialized();
        coreUpdateBossHealthDisplay(current, max);
    }

    flashBossHealth(): void {
        this.ensureInitialized();
        coreFlashBossHealthBar();
    }

    setBossHealthVisible(visible: boolean): void {
        if (typeof document === 'undefined') {
            return;
        }
        const bar = document.getElementById('bossHealthBar');
        if (bar) {
            bar.style.display = visible ? 'block' : 'none';
        }
    }

    updateCombo(combo: number): void {
        this.ensureInitialized();
        coreUpdateComboDisplay(combo);
    }

    updateLives(lives: number): void {
        this.ensureInitialized();
        coreUpdateLivesDisplay(lives);
    }

    addDamageLogEntry(entry: DamageLogEntry): void {
        this.ensureInitialized();
        coreAddDamageLogEntry(entry);
    }

    updateAbilityCooldown(name: AbilityName, state: AbilityState | null): void {
        this.ensureInitialized();
        coreUpdateAbilityCooldown(name, state);
    }

    setHudMode(mode: HudMode): void {
        this.ensureInitialized();
        coreSetHudMode(mode);
    }

    showMessage(text: string, color = 'white'): void {
        this.ensureInitialized();
        coreShowMessage(text, color);
    }
}
