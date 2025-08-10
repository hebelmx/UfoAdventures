class Entity {
    constructor() {
        this.components = new Map();
        this.isRemoved = false;
    }

    addComponent(component) {
        this.components.set(component.constructor, component);
        component.entity = this;
    }

    getComponent(componentClass) {
        return this.components.get(componentClass);
    }

    hasComponent(componentClass) {
        return this.components.has(componentClass);
    }
}

class Component {
    constructor() {
        this.entity = null;
    }
}

class System {
    update(entities, delta) {
        throw new Error('System.update() must be implemented');
    }
}