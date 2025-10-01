class BehaviorTreeService {
    constructor() {
        this._trees = new Map();
    }

    configure(config = {}) {
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

    getTree(id) {
        if (!id) {
            return null;
        }
        const cached = this._trees.get(id);
        return cached ? this._clone(cached) : null;
    }

    has(id) {
        return this._trees.has(id);
    }

    _clone(value) {
        try {
            return JSON.parse(JSON.stringify(value));
        } catch (error) {
            return value;
        }
    }
}

window.BehaviorTreeService = BehaviorTreeService;
