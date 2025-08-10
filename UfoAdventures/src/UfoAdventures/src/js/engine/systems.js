// File: /UfoAdventures/UfoAdventures/src/js/engine/systems.js

class System {
    constructor() {
        this.entities = [];
        this.enabled = true;
    }

    addEntity(entity) {
        if (!this.entities.includes(entity)) {
            this.entities.push(entity);
        }
    }

    removeEntity(entity) {
        const index = this.entities.indexOf(entity);
        if (index > -1) {
            this.entities.splice(index, 1);
        }
    }

    getEntitiesWithComponents(...componentTypes) {
        return this.entities.filter(entity => 
            entity.active && 
            componentTypes.every(type => entity.hasComponent(type))
        );
    }

    update(deltaTime) {
        // Override in derived classes
    }

    render(ctx) {
        // Override in derived classes
    }
}

class PhysicsSystem extends System {
    update(deltaTime) {
        const entities = this.getEntitiesWithComponents('Transform', 'Motion');
        
        entities.forEach(entity => {
            const transform = entity.getComponent('Transform');
            const motion = entity.getComponent('Motion');
            
            motion.velocity.x += motion.acceleration.x * deltaTime;
            motion.velocity.y += motion.acceleration.y * deltaTime;
            
            motion.velocity.x *= motion.drag;
            motion.velocity.y *= motion.drag;
            
            const speed = motion.velocity.magnitude();
            if (speed > motion.maxSpeed) {
                motion.velocity.normalize();
                motion.velocity.x *= motion.maxSpeed;
                motion.velocity.y *= motion.maxSpeed;
            }
            
            transform.position.x += motion.velocity.x * deltaTime;
            transform.position.y += motion.velocity.y * deltaTime;
            
            transform.rotation += motion.angularVelocity * deltaTime;
        });
    }
}

class RenderSystem extends System {
    constructor(canvas) {
        super();
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.camera = {
            position: new Vector2(),
            zoom: 1.0
        };
    }

    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.ctx.save();
        this.ctx.translate(-this.camera.position.x, -this.camera.position.y);
        this.ctx.scale(this.camera.zoom, this.camera.zoom);
        
        const entities = this.getEntitiesWithComponents('Transform', 'Sprite');
        
        entities.sort((a, b) => {
            const spriteA = a.getComponent('Sprite');
            const spriteB = b.getComponent('Sprite');
            return (spriteA.depth || 0) - (spriteB.depth || 0);
        });
        
        entities.forEach(entity => {
            this.renderEntity(entity);
        });
        
        this.ctx.restore();
    }

    renderEntity(entity) {
        const transform = entity.getComponent('Transform');
        const sprite = entity.getComponent('Sprite');
        
        if (!sprite.visible || sprite.alpha <= 0) return;
        
        this.ctx.save();
        
        this.ctx.translate(transform.position.x, transform.position.y);
        this.ctx.rotate(transform.rotation);
        this.ctx.scale(
            transform.scale.x * (sprite.flipX ? -1 : 1),
            transform.scale.y * (sprite.flipY ? -1 : 1)
        );
        
        this.ctx.globalAlpha = sprite.alpha;
        
        if (sprite.image.complete) {
            this.ctx.drawImage(
                sprite.image,
                -sprite.width / 2, -sprite.height / 2,
                sprite.width, sprite.height
            );
        }
        
        this.ctx.restore();
    }
}