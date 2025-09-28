class InventoryScene extends Scene {
    constructor(services) {
        super('inventory', services);
        this._overlay = null;
        this._handlers = [];
        this._mode = 'adventure';
    }

    async onEnter(params = {}) {
        this._mode = params.mode || this._mode;
        this._overlay = document.getElementById('inventoryOverlay');
        if (this._overlay) {
            this._overlay.style.display = 'flex';
        }

        this._renderInventory(params.inventory || []);
        this._bindButtons();
    }

    async onExit() {
        this._unbindButtons();
        if (this._overlay) {
            this._overlay.style.display = 'none';
            this._overlay = null;
        }

        await super.onExit();
    }

    _renderInventory(items) {
        const list = document.getElementById('inventoryList');
        if (!list) {
            return;
        }

        list.innerHTML = '';

        if (!items.length) {
            const empty = document.createElement('li');
            empty.textContent = 'No items collected yet.';
            empty.className = 'inventory-empty';
            list.appendChild(empty);
            return;
        }

        items.forEach((item) => {
            const li = document.createElement('li');
            li.textContent = item.name || String(item);
            list.appendChild(li);
        });
    }

    _bindButtons() {
        const sceneManager = this.services.resolve('sceneManager');

        const close = document.getElementById('inventoryCloseButton');
        if (close) {
            const handler = async () => {
                close.disabled = true;
                try {
                    await sceneManager.pop();
                } catch (error) {
                    console.error('InventoryScene: failed to close', error);
                    close.disabled = false;
                }
            };
            close.addEventListener('click', handler);
            this._handlers.push({ element: close, handler });
        }
    }

    _unbindButtons() {
        while (this._handlers.length) {
            const { element, handler } = this._handlers.pop();
            element.removeEventListener('click', handler);
            element.disabled = false;
        }
    }
}
