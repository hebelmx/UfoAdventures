// UI-related functions
let ui = {};

function initializeUI() {
    ui.healthFill = document.getElementById('healthFill');
    ui.comboFill = document.getElementById('comboFill');
    ui.comboCount = document.getElementById('comboCount');
    ui.livesDisplay = document.getElementById('livesDisplay');
    ui.bossHealthBar = document.getElementById('bossHealthBar');
    ui.bossHealthFill = document.getElementById('bossHealthFill');
    ui.damageLog = document.getElementById('damageLog');
    ui.abilityCombo = document.getElementById('abilityCombo');
    ui.abilityTeleport = document.getElementById('abilityTeleport');
    ui.damageLog = document.getElementById('damageLog');
}

document.addEventListener('DOMContentLoaded', function() {
    initializeUI();
});

function updateHealthDisplay(current, max) {
    if (!ui.healthFill) {
        return;
    }

    const percentage = Math.max(0, Math.min(100, (100 * current / max)));
    ui.healthFill.style.width = percentage + '%';
}

function flashHealthBar() {
    if (!ui.healthFill) {
        return;
    }

    ui.healthFill.classList.remove('flash');
    void ui.healthFill.offsetWidth;
    ui.healthFill.classList.add('flash');
}

function updateBossHealthDisplay(current, max) {
    if (!ui.bossHealthFill) {
        return;
    }

    const percentage = Math.max(0, Math.min(100, (100 * current / max)));
    ui.bossHealthFill.style.width = percentage + '%';
}

function flashBossHealthBar() {
    if (!ui.bossHealthFill) {
        return;
    }

    ui.bossHealthFill.classList.remove('flash');
    void ui.bossHealthFill.offsetWidth;
    ui.bossHealthFill.classList.add('flash');
}

function updateComboDisplay(combo) {
    if (ui.comboCount) {
        ui.comboCount.textContent = combo;
    }
}

function updateLivesDisplay(lives) {
    if (!ui.livesDisplay) {
        return;
    }

    ui.livesDisplay.innerHTML = '';
    for (let i = 0; i < lives; i++) {
        const icon = document.createElement('div');
        icon.className = 'life-icon';
        ui.livesDisplay.appendChild(icon);
    }
}

function addDamageLogEntry(entry) {
    if (!ui.damageLog) {
        return;
    }

    const limit = 8;
    while (ui.damageLog.children.length >= limit) {
        ui.damageLog.removeChild(ui.damageLog.firstChild);
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

    const source = entry.source ? ' via ' + entry.source : '';
    const remaining = typeof entry.remainingHealth === 'number'
        ? ' (' + Math.max(0, Math.round(entry.remainingHealth)) + ' hp left)'
        : '';

    row.textContent = '[' + (entry.target || 'Unknown') + '] -' + entry.amount + source + remaining;
    ui.damageLog.appendChild(row);
    ui.damageLog.scrollTop = ui.damageLog.scrollHeight;
}

function updateAbilityCooldown(name, state) {
    if (!state) {
        return;
    }

    let fill = null;
    if (name === 'comboBreaker') {
        fill = ui.abilityCombo;
    } else if (name === 'teleport') {
        fill = ui.abilityTeleport;
    }

    if (!fill) {
        return;
    }

    const cooldown = state.cooldown || 0;
    const remaining = Math.max(0, state.timer || 0);

    if (!cooldown) {
        fill.style.width = '100%';
        fill.classList.add('ready');
        return;
    }

    const ratio = Math.max(0, Math.min(1, remaining / cooldown));
    const percent = 100 - ratio * 100;
    fill.style.width = percent + '%';

    if (remaining <= 0.05) {
        fill.classList.add('ready');
    } else {
        fill.classList.remove('ready');
    }
}
function showMessage(text, color = 'white') {
    const messages = document.getElementById('gameMessages');
    if (messages) {
        const msg = document.createElement('div');
        msg.className = 'message';
        msg.style.color = color;
        msg.textContent = text;
        messages.appendChild(msg);
        setTimeout(() => { msg.remove(); }, 3000);
    }
}

