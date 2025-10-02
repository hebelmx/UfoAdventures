interface UiElements {
    healthFill: HTMLElement | null;
    comboFill: HTMLElement | null;
    comboCount: HTMLElement | null;
    livesDisplay: HTMLElement | null;
    bossHealthBar: HTMLElement | null;
    bossHealthFill: HTMLElement | null;
    damageLog: HTMLElement | null;
    abilityCombo: HTMLElement | null;
    abilityTeleport: HTMLElement | null;
    abilityShield: HTMLElement | null;
    abilityStasis: HTMLElement | null;
}

export interface DamageLogEntry {
    type: 'player' | 'boss' | 'enemy' | (string & {});
    target?: string;
    amount: number;
    source?: string;
    remainingHealth?: number;
}

export interface AbilityState {
    cooldown?: number;
    timer?: number;
}

export type AbilityName = 'comboBreaker' | 'teleport' | 'shield' | 'stasisField';

export type HudMode = 'default' | 'training' | 'arcade';

const ui: UiElements = {
    healthFill: null,
    comboFill: null,
    comboCount: null,
    livesDisplay: null,
    bossHealthBar: null,
    bossHealthFill: null,
    damageLog: null,
    abilityCombo: null,
    abilityTeleport: null,
    abilityShield: null,
    abilityStasis: null
};

type AbilityElementKey = 'abilityCombo' | 'abilityTeleport' | 'abilityShield' | 'abilityStasis';

const ABILITY_UI_MAP: Record<AbilityName, AbilityElementKey> = {
    comboBreaker: 'abilityCombo',
    teleport: 'abilityTeleport',
    shield: 'abilityShield',
    stasisField: 'abilityStasis'
};

function queryElement(id: string): HTMLElement | null {
    if (typeof document === 'undefined') {
        return null;
    }
    return document.getElementById(id);
}

export function initializeUI(): void {
    ui.healthFill = queryElement('healthFill');
    ui.comboFill = queryElement('comboFill');
    ui.comboCount = queryElement('comboCount');
    ui.livesDisplay = queryElement('livesDisplay');
    ui.bossHealthBar = queryElement('bossHealthBar');
    ui.bossHealthFill = queryElement('bossHealthFill');
    ui.damageLog = queryElement('damageLog');
    ui.abilityCombo = queryElement('abilityCombo');
    ui.abilityTeleport = queryElement('abilityTeleport');
    ui.abilityShield = queryElement('abilityShield');
    ui.abilityStasis = queryElement('abilityStasis');
}

if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        initializeUI();
    });
}

export function updateHealthDisplay(current: number, max: number): void {
    if (!ui.healthFill || !Number.isFinite(current) || !Number.isFinite(max) || max <= 0) {
        return;
    }

    const percentage = Math.max(0, Math.min(100, (100 * current) / max));
    ui.healthFill.style.width = `${percentage}%`;
}

export function flashHealthBar(): void {
    if (!ui.healthFill) {
        return;
    }

    ui.healthFill.classList.remove('flash');
    void ui.healthFill.offsetWidth;
    ui.healthFill.classList.add('flash');
}

export function updateBossHealthDisplay(current: number, max: number): void {
    if (!ui.bossHealthFill || !Number.isFinite(current) || !Number.isFinite(max) || max <= 0) {
        return;
    }

    const percentage = Math.max(0, Math.min(100, (100 * current) / max));
    ui.bossHealthFill.style.width = `${percentage}%`;
}

export function flashBossHealthBar(): void {
    if (!ui.bossHealthFill) {
        return;
    }

    ui.bossHealthFill.classList.remove('flash');
    void ui.bossHealthFill.offsetWidth;
    ui.bossHealthFill.classList.add('flash');
}

export function updateComboDisplay(combo: number): void {
    if (!ui.comboCount || !Number.isFinite(combo)) {
        return;
    }

    ui.comboCount.textContent = String(Math.max(0, Math.floor(combo)));
}

export function updateLivesDisplay(lives: number): void {
    if (!ui.livesDisplay || !Number.isFinite(lives)) {
        return;
    }

    ui.livesDisplay.innerHTML = '';
    const total = Math.max(0, Math.floor(lives));
    for (let i = 0; i < total; i += 1) {
        const icon = document.createElement('div');
        icon.className = 'life-icon';
        ui.livesDisplay.appendChild(icon);
    }
}

export function addDamageLogEntry(entry: DamageLogEntry): void {
    if (!ui.damageLog) {
        return;
    }

    const limit = 8;
    while (ui.damageLog.children.length >= limit) {
        const firstChild = ui.damageLog.firstElementChild;
        if (!firstChild) {
            break;
        }
        ui.damageLog.removeChild(firstChild);
    }

    const row = document.createElement('div');
    row.className = 'damage-entry';

    if (entry.type === 'player') {
        row.classList.add('damage-entry--player');
    } else if (entry.type === 'boss') {
        row.classList.add('damage-entry--boss');
    } else if (entry.type === 'enemy') {
        row.classList.add('damage-entry--enemy');
    }

    const source = entry.source ? ` via ${entry.source}` : '';
    const remaining = typeof entry.remainingHealth === 'number'
        ? ` (${Math.max(0, Math.round(entry.remainingHealth))} hp left)`
        : '';

    const target = entry.target || 'Unknown';
    row.textContent = `[${target}] -${entry.amount}${source}${remaining}`;
    ui.damageLog.appendChild(row);
    ui.damageLog.scrollTop = ui.damageLog.scrollHeight;
}

export function updateAbilityCooldown(name: AbilityName, state: AbilityState | null): void {
    if (!state) {
        return;
    }

    const elementKey = ABILITY_UI_MAP[name];
    const fill = elementKey ? ui[elementKey] : null;
    if (!fill) {
        return;
    }

    const cooldown = Number.isFinite(state.cooldown) ? Math.max(0, state.cooldown || 0) : 0;
    const remaining = Number.isFinite(state.timer) ? Math.max(0, state.timer || 0) : 0;

    if (!cooldown) {
        fill.style.width = '100%';
        fill.classList.add('ready');
        return;
    }

    const ratio = Math.max(0, Math.min(1, remaining / cooldown));
    const percent = 100 - ratio * 100;
    fill.style.width = `${percent}%`;

    if (remaining <= 0.05) {
        fill.classList.add('ready');
    } else {
        fill.classList.remove('ready');
    }
}

export function setHudMode(mode: HudMode): void {
    if (typeof document === 'undefined') {
        return;
    }

    const body = document.body;
    if (!body) {
        return;
    }

    body.classList.remove('hud-mode-training', 'hud-mode-arcade');
    if (mode === 'training') {
        body.classList.add('hud-mode-training');
        if (ui.damageLog) {
            ui.damageLog.innerHTML = '';
        }
    } else if (mode === 'arcade') {
        body.classList.add('hud-mode-arcade');
    }
}

export function showMessage(text: string, color: string = 'white'): void {
    if (typeof document === 'undefined') {
        return;
    }

    const messages = document.getElementById('gameMessages');
    if (!messages) {
        return;
    }

    const msg = document.createElement('div');
    msg.className = 'message';
    msg.style.color = color;
    msg.textContent = text;
    messages.appendChild(msg);
    window.setTimeout(() => {
        msg.remove();
    }, 3000);
}
