class Game {
    constructor() {
        this.app = new PIXI.Application({
            width: 800,
            height: 600,
            backgroundColor: 0x1099bb,
            view: document.getElementById('gameCanvas'),
        });

        // this.loader = PIXI.Loader.shared; // Removed
        // this.resources = this.loader.resources; // Removed
        this.entities = [];
        this.systems = [];
        this.loaded = false;
    }

    async loadAssets() {
        try {
            PIXI.Assets.reset();
            console.log('Loading player asset...');
            await PIXI.Assets.load({ src: 'images/Sprites/1_Tarak.png', alias: 'player' });
            console.log('Player asset loaded.');

            console.log('Loading amidogus asset...');
            await PIXI.Assets.load({ src: 'images/Statics/02_Amidogus.png', alias: 'amidogus' });
            console.log('Amidogus asset loaded.');

            console.log('Loading blade asset...');
            await PIXI.Assets.load({ src: 'images/Statics/01_Blade.png', alias: 'blade' });
            console.log('Blade asset loaded.');

            console.log('Loading background asset...');
            await PIXI.Assets.load({ src: 'images/aliendescending.jpg', alias: 'background' });
            console.log('Background asset loaded.');

            this.loaded = true;
            console.log('All assets loaded successfully.');
        } catch (error) {
            console.error('Error loading assets:', error);
            this.loaded = false;
        }
    }

    start(mode) {
        if (!this.loaded) {
            return;
        }

        this.mode = mode;

        // Hide loading screen
        document.getElementById('loadingScreen').style.display = 'none';

        // Create background
        const background = new PIXI.Sprite(PIXI.Assets.get('background'));
        this.app.stage.addChild(background);

        // Clear existing entities and systems
        this.entities.forEach(entity => {
            if (entity.hasComponent(Sprite)) {
                this.app.stage.removeChild(entity.getComponent(Sprite).sprite);
            }
        });
        this.entities = [];
        this.systems = [];

        // Create systems
        this.systems.push(new PlayerInputSystem());
        this.systems.push(new MovementSystem());
        this.systems.push(new ShootingSystem(this));
        this.systems.push(new CollisionSystem(this));
        this.systems.push(new UISystem(this));
        this.systems.push(new RenderSystem(this.app));
        this.systems.push(new CleanupSystem(this));

        // Create entities based on game mode
        if (mode === 'adventure') {
            this.setupAdventureMode();
        } else if (mode === 'boss') {
            this.setupBossMode();
        } else if (mode === 'enemyDemo') {
            this.setupEnemyDemoMode();
        }

        // Start the game loop
        this.app.ticker.add(delta => this.gameLoop(delta));
    }

    setupAdventureMode() {
        // Create the player
        const player = this._createPlayerEntity();
        this.entities.push(player);

        // Add entities to the stage
        this.entities.forEach(entity => {
            if (entity.hasComponent(Sprite)) {
                this.app.stage.addChild(entity.getComponent(Sprite).sprite);
            }
        });

        // Add enemy spawning system
        this.systems.push(new EnemySpawningSystem(this));
    }

    setupBossMode() {
        // Create the player
        const player = this._createPlayerEntity();
        this.entities.push(player);

        // Create the boss
        const boss = new Entity();
        boss.addComponent(new Transform({ x: 400, y: 100 }));
        boss.addComponent(new Sprite(PIXI.Assets.get('amidogus')));
        boss.getComponent(Sprite).sprite.width = 100;
        boss.getComponent(Sprite).sprite.height = 100;
        boss.addComponent(new Motion({ x: 2, y: 0 }));
        boss.addComponent(new Collider(50));
        boss.addComponent(new Health(500));
        boss.addComponent(new Boss());
        this.entities.push(boss);

        // Add entities to the stage
        this.entities.forEach(entity => {
            if (entity.hasComponent(Sprite)) {
                this.app.stage.addChild(entity.getComponent(Sprite).sprite);
            }
        });

        // Add boss AI systems
        this.systems.push(new BossAISystem(this));
        this.systems.push(new BossShootingSystem(this));
    }

    setupEnemyDemoMode() {
        // Create the player
        const player = this._createPlayerEntity();
        this.entities.push(player);

        // Add entities to the stage
        this.entities.forEach(entity => {
            if (entity.hasComponent(Sprite)) {
                this.app.stage.addChild(entity.getComponent(Sprite).sprite);
            }
        });

        // Add enemy spawning system
        this.systems.push(new EnemySpawningSystem(this));
    }

    _createPlayerEntity() {
        const player = new Entity();
        player.addComponent(new Transform({ x: 400, y: 500 }));
        player.addComponent(new Sprite(PIXI.Assets.get('player')));
        player.getComponent(Sprite).sprite.width = 50;
        player.getComponent(Sprite).sprite.height = 50;
        player.addComponent(new Motion());
        player.addComponent(new Weapon());
        player.addComponent(new Collider(20));
        player.addComponent(new Health(100));
        player.addComponent(new Player());
        return player;
    }

    gameLoop(delta) {
        this.systems.forEach(system => {
            system.update(this.entities, delta);
        });
    }
}