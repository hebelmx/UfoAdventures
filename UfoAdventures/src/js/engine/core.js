// Vector2, Entity, System, EventBus, InputManager, Game
// ...existing code...

class Vector2 {
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    }
    static add(a, b) { return new Vector2(a.x + b.x, a.y + b.y); }
    static subtract(a, b) { return new Vector2(a.x - b.x, a.y - b.y); }
    static multiply(v, scalar) { return new Vector2(v.x * scalar, v.y * scalar); }
    static distance(a, b) { const dx = a.x - b.x, dy = a.y - b.y; return Math.sqrt(dx * dx + dy * dy); }
    static normalize(v) { const mag = Math.sqrt(v.x * v.x + v.y * v.y); return mag > 0 ? new Vector2(v.x / mag, v.y / mag) : new Vector2(0, 0); }
    magnitude() { return Math.sqrt(this.x * this.x + this.y * this.y); }
    normalize() { const mag = this.magnitude(); if (mag > 0) { this.x /= mag; this.y /= mag; } return this; }
    copy() { return new Vector2(this.x, this.y); }
}

class Entity {
    constructor(id = Entity.generateId()) {
        this.id = id;
        this.components = new Map();
        this.active = true;
        this.tags = new Set();
    }
    static generateId() { return Math.random().toString(36).substr(2, 9); }
    addComponent(component) { component.entity = this; this.components.set(component.type, component); return this; }
    getComponent(type) { return this.components.get(type); }
    hasComponent(type) { return this.components.has(type); }
    removeComponent(type) { const component = this.components.get(type); if (component) { component.entity = null; this.components.delete(type); } return this; }
    addTag(tag) { this.tags.add(tag); return this; }
    hasTag(tag) { return this.tags.has(tag); }
    destroy() { this.active = false; this.components.clear(); this.tags.clear(); }
}

class System {
    constructor() { this.entities = []; this.enabled = true; }
    addEntity(entity) { if (!this.entities.includes(entity)) { this.entities.push(entity); } }
    removeEntity(entity) { const index = this.entities.indexOf(entity); if (index > -1) { this.entities.splice(index, 1); } }
    getEntitiesWithComponents(...componentTypes) { return this.entities.filter(entity => entity.active && componentTypes.every(type => entity.hasComponent(type))); }
    update(deltaTime) {}
    render(ctx) {}
}

class EventBus {
    constructor() { this.events = new Map(); }
    on(eventType, callback) { if (!this.events.has(eventType)) { this.events.set(eventType, []); } this.events.get(eventType).push(callback); }
    off(eventType, callback) { if (this.events.has(eventType)) { const callbacks = this.events.get(eventType); const index = callbacks.indexOf(callback); if (index > -1) { callbacks.splice(index, 1); } } }
    emit(eventType, data) { if (this.events.has(eventType)) { this.events.get(eventType).forEach(callback => { try { callback(data); } catch (error) { console.error(`Error in event callback for ${eventType}:`, error); } }); } }
}

class InputManager {
    constructor(canvas) {
        this.canvas = canvas;
        this.keys = new Map();
        this.mouse = { position: new Vector2(), buttons: new Map(), wheel: 0 };
        this.setupEventListeners();
    }
    setupEventListeners() {
        window.addEventListener('keydown', (e) => { this.keys.set(e.code, true); });
        window.addEventListener('keyup', (e) => { this.keys.set(e.code, false); });
        this.canvas.addEventListener('mousemove', (e) => { const rect = this.canvas.getBoundingClientRect(); this.mouse.position.x = e.clientX - rect.left; this.mouse.position.y = e.clientY - rect.top; });
        this.canvas.addEventListener('mousedown', (e) => { this.mouse.buttons.set(e.button, true); e.preventDefault(); });
        this.canvas.addEventListener('mouseup', (e) => { this.mouse.buttons.set(e.button, false); e.preventDefault(); });
    }
    isKeyPressed(keyCode) { return this.keys.get(keyCode) || false; }
    isMouseButtonPressed(button) { return this.mouse.buttons.get(button) || false; }
    getMousePosition() { return this.mouse.position.copy(); }
}

class Game {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.entities = [];
        this.systems = [];
        this.eventBus = new EventBus();
        this.inputManager = new InputManager(this.canvas);
        this.isRunning = false;
        this.lastTime = 0;
        this.gameState = 'menu';
        Game.instance = this;
        Game.eventBus = this.eventBus;
    }
    addEntity(entity) { this.entities.push(entity); this.systems.forEach(system => system.addEntity(entity)); return entity; }
    removeEntity(entity) { const index = this.entities.indexOf(entity); if (index > -1) { this.entities.splice(index, 1); this.systems.forEach(system => system.removeEntity(entity)); } }
    findEntityByTag(tag) { return this.entities.find(entity => entity.hasTag(tag)); }
    findEntitiesByTag(tag) { return this.entities.filter(entity => entity.hasTag(tag)); }
    start() { this.isRunning = true; this.lastTime = performance.now(); this.gameLoop(); }
    stop() { this.isRunning = false; }
    gameLoop(currentTime = performance.now()) {
        if (!this.isRunning) return;
        const deltaTime = (currentTime - this.lastTime) / 1000;
        this.lastTime = currentTime;
        this.systems.forEach(system => { if (system.enabled) { system.update(deltaTime); } });
        this.entities.forEach(entity => { if (entity.active) { entity.components.forEach(component => { if (component.enabled && component.update) { component.update(deltaTime); } }); } });
        this.entities = this.entities.filter(entity => { if (!entity.active) { this.systems.forEach(system => system.removeEntity(entity)); return false; } return true; });
        if (this.renderSystem && this.renderSystem.render) this.renderSystem.render();
        requestAnimationFrame((time) => this.gameLoop(time));
    }
    createEntity() { return new Entity(); }
    getCanvas() { return this.canvas; }
    getInput() { return this.inputManager; }
}
