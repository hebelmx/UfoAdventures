// UI-related functions
let ui = {};

function initializeUI() {
    ui.healthFill = document.getElementById('healthFill');
    ui.comboFill = document.getElementById('comboFill');
    ui.comboCount = document.getElementById('comboCount');
    ui.livesDisplay = document.getElementById('livesDisplay');
    ui.bossHealthBar = document.getElementById('bossHealthBar');
    ui.bossHealthFill = document.getElementById('bossHealthFill');
}

document.addEventListener('DOMContentLoaded', function() {
    initializeUI();
});

function updateHealthDisplay(current, max) {
    if (ui.healthFill) {
        ui.healthFill.style.width = (100 * current / max) + '%';
    }
}

function updateBossHealthDisplay(current, max) {
    if (ui.bossHealthFill) {
        ui.bossHealthFill.style.width = (100 * current / max) + '%';
    }
}

function updateComboDisplay(combo) {
    if (ui.comboCount) {
        ui.comboCount.textContent = combo;
    }
}

function updateLivesDisplay(lives) {
    if (ui.livesDisplay) {
        ui.livesDisplay.innerHTML = '';
        for (let i = 0; i < lives; i++) {
            const icon = document.createElement('div');
            icon.className = 'life-icon';
            ui.livesDisplay.appendChild(icon);
        }
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
