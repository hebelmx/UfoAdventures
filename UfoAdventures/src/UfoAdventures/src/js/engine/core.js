// This file contains the core game loop and initialization logic. It manages the game state and orchestrates the update and render cycles.

class Game {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        
        this.entities = [];
        this.systems = [];
        this.isRunning = false;
        this.lastTime = 0;
    }

    start() {
        this.isRunning = true;
        this.lastTime = performance.now();
        this.gameLoop();
    }

    stop() {
        this.isRunning = false;
    }

    gameLoop(currentTime = performance.now()) {
        if (!this.isRunning) return;

        const deltaTime = (currentTime - this.lastTime) / 1000;
        this.lastTime = currentTime;

        this.update(deltaTime);
        this.render();

        requestAnimationFrame((time) => this.gameLoop(time));
    }

    update(deltaTime) {
        this.systems.forEach(system => {
            if (system.enabled) {
                system.update(deltaTime);
            }
        });

        this.entities.forEach(entity => {
            if (entity.active) {
                entity.components.forEach(component => {
                    if (component.enabled && component.update) {
                        component.update(deltaTime);
                    }
                });
            }
        });

        this.entities = this.entities.filter(entity => entity.active);
    }

    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.systems.forEach(system => system.render(this.ctx));
    }

    addEntity(entity) {
        this.entities.push(entity);
        this.systems.forEach(system => system.addEntity(entity));
    }

    addSystem(system) {
        this.systems.push(system);
    }
}

// Export the Game class for use in other modules
export default Game;