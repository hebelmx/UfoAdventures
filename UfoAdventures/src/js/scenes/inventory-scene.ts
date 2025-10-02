import { Scene, SceneManager } from '../engine/scene-manager';
import { ServiceLocator } from '../engine/service-locator';

interface UIHandler {
    element: HTMLElement;
    handler: () => void;
}

interface InventoryItem {
    name: string;
}

export class InventoryScene extends Scene {
    private _overlay: HTMLElement | null = null;
    private readonly _handlers: UIHandler[] = [];
    private _mode = 'adventure';

    constructor(services: ServiceLocator) {
        super('inventory', services);
    }

    async onEnter(params: { mode?: string, inventory?: InventoryItem[] } = {}): Promise<void> {
        this._mode = params.mode || this._mode;
        this._overlay = document.getElementById('inventoryOverlay');
        if (this._overlay) {
            this._overlay.style.display = 'flex';
        }

        this._renderInventory(params.inventory || []);
        this._bindButtons();
    }

    async onExit(): Promise<void> {
        this._unbindButtons();
        if (this._overlay) {
            this._overlay.style.display = 'none';
            this._overlay = null;
        }

        await super.onExit();
    }

    private _renderInventory(items: InventoryItem[]): void {
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

    private _bindButtons(): void {
        const sceneManager = this.services.resolve<SceneManager>('sceneManager');

        const close = document.getElementById('inventoryCloseButton') as HTMLButtonElement | null;
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

    private _unbindButtons(): void {
        while (this._handlers.length) {
            const { element, handler } = this._handlers.pop()!;
            element.removeEventListener('click', handler);
            (element as HTMLButtonElement).disabled = false;
        }
    }
}