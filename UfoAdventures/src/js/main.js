let game;

window.addEventListener('load', async () => {
    game = new Game();
    await game.loadAssets(); // Wait for assets to load
    document.getElementById('startGameButton').addEventListener('click', () => {
        console.log('Start Adventure button clicked!');
        game.start('adventure');
    });
    document.getElementById('startBossFightButton').addEventListener('click', () => {
        console.log('Start Boss Fight button clicked!');
        game.start('boss');
    });
    document.getElementById('startEnemyDemoButton').addEventListener('click', () => {
        console.log('Start Enemy Demo button clicked!');
        game.start('enemyDemo');
    });
});