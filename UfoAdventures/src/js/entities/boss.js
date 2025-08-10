function createTarakBoss(x, y) {
    const boss = Game.instance.createEntity()
        .addComponent(new Transform(new Vector2(x, y), 0, new Vector2(2, 2)))
        .addComponent(new Motion())
        .addComponent(new Health(3000))
        .addComponent(new Sprite(createPlaceholderImage(256, 256, '#ff0000'), 256, 256))
        .addComponent(new Collider('circle', 128))
        .addComponent(new BossAI())
        .addTag('boss')
        .addTag('enemy');
    return boss;
}
