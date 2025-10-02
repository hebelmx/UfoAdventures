import type { BehaviorTreeNodeDefinition } from './combat-types';

export class BehaviorTreeService {
    private readonly _trees: Map<string, BehaviorTreeNodeDefinition> = new Map();

    configure(config: Record<string, BehaviorTreeNodeDefinition> = {}): void {
        this._trees.clear();
        const entries = config || {};
        Object.keys(entries).forEach(id => {
            if (!id) {
                return;
            }
            const node = this._clone(entries[id]);
            if (node && typeof node === 'object') {
                this._trees.set(id, node);
            }
        });
    }

    getTree(id: string): BehaviorTreeNodeDefinition | null {
        if (!id) {
            return null;
        }
        const cached = this._trees.get(id);
        return cached ? this._clone(cached) : null;
    }

    has(id: string): boolean {
        return this._trees.has(id);
    }

    private _clone<T>(value: T): T {
        try {
            return JSON.parse(JSON.stringify(value));
        } catch (error) {
            return value;
        }
    }
}
