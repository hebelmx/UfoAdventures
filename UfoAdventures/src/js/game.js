// Game state, setupGameEvents, setupDemoLevel, setupBossLevel, setupEnemyShowcase, createBackground
let gameState = {
    game: null,
    gameStarted: false,
    level: 'menu',
    score: 0,
    gameTime: 0,
    enemySpawner: null
};

function setupGameEvents() {
    // Add event listeners for game events (boss phase, etc)
    if (Game.eventBus) {
        Game.eventBus.on('bossPhaseChanged', (data) => {
            showMessage('Boss Phase ' + data.phase + '!', '#ff3333');
        });
        Game.eventBus.on('bossAttackStarted', (data) => {
            showMessage('Boss uses ' + data.attack + '!', '#ffaa00');
        });
    }
}

function setupDemoLevel() {
    // Add player, enemies, etc for demo
    createPlayer(200, 500);
    createDogus(400, 500);
    createDogus(600, 500);
}

function setupBossLevel() {
    // Add player and boss
    createPlayer(200, 500);
    createTarakBoss(600, 300);
}

function setupEnemyShowcase() {
    // Add player and various enemies
    createPlayer(200, 500);
    createDogus(400, 500);
    createOctopusCreature(500, 500);
    createWimidir(600, 500);
    createAmidogus(700, 500);
}

function createBackground() {
    // Optionally add background entities
}
