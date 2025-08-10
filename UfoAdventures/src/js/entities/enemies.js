function createDogus(x, y) {
    const enemy = Game.instance.createEntity()
        .addComponent(new Transform(new Vector2(x, y), 0, new Vector2(0.8, 0.8)))
        .addComponent(new Motion())
        // Add more components as needed
        .addTag('enemy');
    return enemy;
}

function createOctopusCreature(x, y) {
    const enemy = Game.instance.createEntity()
        // Add components as needed
        .addTag('enemy');
    return enemy;
}

function createWimidir(x, y) {
    const enemy = Game.instance.createEntity()
        // Add components as needed
        .addTag('enemy');
    return enemy;
}

function createAmidogus(x, y) {
    const enemy = Game.instance.createEntity()
        // Add components as needed
        .addTag('enemy');
    return enemy;
}
