function createPlayer(x, y) {
    const player = Game.instance.createEntity()
        .addComponent(new Transform(new Vector2(x, y)))
        .addComponent(new Motion())
        .addComponent(new Health(100))
        .addComponent(new Sprite(createPlaceholderImage(64, 64, '#00ff00'), 64, 64))
        .addComponent(new Collider('rectangle', 32))
        .addComponent(new PlayerController())
        .addTag('player');
    return player;
}
