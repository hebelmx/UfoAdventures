export class Component {
    entity: Entity | null = null;
}

export type ComponentConstructor<T extends Component = Component> = new (...args: any[]) => T;

export class Entity {
    private readonly components = new Map<ComponentConstructor, Component>();
    isRemoved = false;

    addComponent<T extends Component>(component: T): T {
        this.components.set(component.constructor as ComponentConstructor, component);
        component.entity = this;
        return component;
    }

    getComponent<T extends Component>(ctor: ComponentConstructor<T>): T | undefined {
        return this.components.get(ctor) as T | undefined;
    }

    hasComponent<T extends Component>(ctor: ComponentConstructor<T>): boolean {
        return this.components.has(ctor);
    }

    removeComponent<T extends Component>(ctor: ComponentConstructor<T>): void {
        const component = this.components.get(ctor);
        if (component) {
            component.entity = null;
            this.components.delete(ctor);
        }
    }

    clear(): void {
        this.components.forEach((component) => {
            component.entity = null;
        });
        this.components.clear();
    }
}

export abstract class System {
    abstract update(entities: Entity[], delta: number): void;
    destroy?(): void;
}
