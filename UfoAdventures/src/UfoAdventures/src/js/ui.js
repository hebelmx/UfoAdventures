// This file manages the user interface elements, including health bars, combo counters, and game messages.

const ui = {
    healthFill: null,
    comboFill: null,
    comboCount: null,
    livesDisplay: null,
    bossHealthBar: null,
    bossHealthFill: null,
    bossName: null,
    gameMessages: null,
};

function initializeUI() {
    ui.healthFill = document.getElementById('healthFill');
    ui.comboFill = document.getElementById('comboFill');
    ui.comboCount = document.getElementById('comboCount');
    ui.livesDisplay = document.getElementById('livesDisplay');
    ui.bossHealthBar = document.getElementById('bossHealthBar');
    ui.bossHealthFill = document.getElementById('bossHealthFill');
    ui.bossName = document.getElementById('bossName');
    ui.gameMessages = document.getElementById('gameMessages');
}

function updateHealth(currentHealth, maxHealth) {
    const healthPercentage = (currentHealth / maxHealth) * 100;
    ui.healthFill.style.width = healthPercentage + '%';
}

function updateCombo(comboCount) {
    ui.comboCount.textContent = comboCount;
    const comboPercentage = (comboCount / 100) * 100; // Assuming 100 is the max combo
    ui.comboFill.style.width = comboPercentage + '%';
}

function updateLives(lives) {
    ui.livesDisplay.innerHTML = '';
    for (let i = 0; i < lives; i++) {
        const lifeIcon = document.createElement('div');
        lifeIcon.className = 'life-icon';
        ui.livesDisplay.appendChild(lifeIcon);
    }
}

function updateBossHealth(currentHealth, maxHealth) {
    const bossHealthPercentage = (currentHealth / maxHealth) * 100;
    ui.bossHealthFill.style.width = bossHealthPercentage + '%';
}

function displayGameMessage(message) {
    const messageElement = document.createElement('div');
    messageElement.className = 'message';
    messageElement.textContent = message;
    ui.gameMessages.appendChild(messageElement);
    
    setTimeout(() => {
        messageElement.remove();
    }, 3000); // Message disappears after 3 seconds
}

// Wait for DOM to load
document.addEventListener('DOMContentLoaded', initializeUI);