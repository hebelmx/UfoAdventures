// Entry point: DOMContentLoaded, startGame, startBossFight, startEnemyDemo
function startGame() {
    if (gameState.gameStarted) return;
    gameState.gameStarted = true;
    gameState.level = 'adventure';
    gameState.game = new Game('gameCanvas');
    gameState.game.physicsSystem = new PhysicsSystem();
    gameState.game.renderSystem = new RenderSystem(gameState.game.canvas);
    gameState.game.systems.push(gameState.game.physicsSystem);
    gameState.game.systems.push(gameState.game.renderSystem);
    setupGameEvents();
    setupDemoLevel();
    gameState.game.start();
    document.getElementById('loadingScreen').style.display = 'none';
}

function startBossFight() {
    if (gameState.gameStarted) return;
    gameState.gameStarted = true;
    gameState.level = 'boss';
    gameState.game = new Game('gameCanvas');
    gameState.game.physicsSystem = new PhysicsSystem();
    gameState.game.renderSystem = new RenderSystem(gameState.game.canvas);
    gameState.game.systems.push(gameState.game.physicsSystem);
    gameState.game.systems.push(gameState.game.renderSystem);
    setupGameEvents();
    setupBossLevel();
    gameState.game.start();
    document.getElementById('loadingScreen').style.display = 'none';
    document.getElementById('bossHealthBar').style.display = '';
}

function startEnemyDemo() {
    if (gameState.gameStarted) return;
    gameState.gameStarted = true;
    gameState.level = 'enemyDemo';
    gameState.game = new Game('gameCanvas');
    gameState.game.physicsSystem = new PhysicsSystem();
    gameState.game.renderSystem = new RenderSystem(gameState.game.canvas);
    gameState.game.systems.push(gameState.game.physicsSystem);
    gameState.game.systems.push(gameState.game.renderSystem);
    setupGameEvents();
    setupEnemyShowcase();
    gameState.game.start();
    document.getElementById('loadingScreen').style.display = 'none';
}

document.addEventListener('DOMContentLoaded', function() {
    // Optionally, attach button listeners here if not using inline onclick
});
