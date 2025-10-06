import { Scene } from '../engine/scene-manager';
import { ServiceLocator } from '../engine/service-locator';
import { EventBus } from '../engine/event-bus';
import { UiService } from '../engine/ui-service';

export class PortalEscapeScene extends Scene {
    private _keysRequired = 3;
    private _keysCollected = 0;
    private _off: (() => void) | null = null;

    constructor(services: ServiceLocator) {
        super('portal-escape', services);
    }

    async onEnter(): Promise<void> {
        const bus = this.services.optional<EventBus>('eventBus');
        if (bus) {
            this._off = bus.on('collectible:key', () => this._handleKeyCollected());
        }
    }

    async onExit(): Promise<void> {
        if (this._off) {
            try { this._off(); } catch {}
            this._off = null;
        }
        await super.onExit();
    }

    private _handleKeyCollected(): void {
        this._keysCollected += 1;
        const ui = this.services.optional<UiService>('uiService');
        // Update a HUD label if present, otherwise show a transient message
        if (ui) {
            const text = `Keys: ${this._keysCollected}/3`;
            ui.setTextContent('portalKeys', text);
            ui.showMessage(text, '#c4ff6b');
        }
        if (this._keysCollected >= this._keysRequired) {
            const bus = this.services.optional<EventBus>('eventBus');
            bus?.emit('portal:open', { keys: this._keysCollected });
        }
    }
}


