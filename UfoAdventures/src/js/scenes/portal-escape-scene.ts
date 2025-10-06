import { Scene } from '../engine/scene-manager';
import { ServiceLocator } from '../engine/service-locator';
import { EventBus } from '../engine/event-bus';
import { UiService } from '../engine/ui-service';
import { GameplayRuntime } from '../gameplay-runtime';
import { Entity } from '../engine/core';
import { Transform, Sprite, Motion, Collider, Health } from '../engine/components';
import * as PIXI from 'pixi.js';

interface Collectible {
    entity: Entity;
    type: 'key' | 'timeBall';
    value: number;
    collected: boolean;
}

export class PortalEscapeScene extends Scene {
    private _keysRequired = 3;
    private _keysCollected = 0;
    private _timeBonus = 0;
    private _timeRemaining = 60; // 60 seconds
    private _gameStartTime = 0;
    private _collectibles: Collectible[] = [];
    private _portalOpen = false;
    private _gameWon = false;
    private _gameLost = false;
    private _off: (() => void) | null = null;
    private _runtime: GameplayRuntime | null = null;

    constructor(services: ServiceLocator) {
        super('portal-escape', services);
    }

    async onEnter(): Promise<void> {
        const bus = this.services.optional<EventBus>('eventBus');
        if (bus) {
            this._off = bus.on('collectible:key', () => this._handleKeyCollected());
            bus.on('collectible:timeBall', (payload: any) => this._handleTimeBallCollected(payload));
            bus.on('portal:enter', () => this._handlePortalEnter());
        }

        await this._setupGameplay();
        this._gameStartTime = Date.now();
    }

    async onExit(): Promise<void> {
        if (this._off) {
            try { this._off(); } catch {}
            this._off = null;
        }
        
        if (this._runtime) {
            this._runtime.destroy();
            this._runtime = null;
        }
        
        await super.onExit();
    }

    update(delta: number): void {
        if (this._runtime && !this._gameWon && !this._gameLost) {
            this._runtime.update(delta);
            this._updateTimer(delta);
            this._checkWinLoseConditions();
        }
    }

    render(interpolation: number): void {
        if (this._runtime) {
            this._runtime.render(interpolation);
        }
    }

    private async _setupGameplay(): Promise<void> {
        // Create a minimal gameplay runtime for the portal escape
        const canvas = document.createElement('canvas');
        canvas.width = 800;
        canvas.height = 600;
        
        const app = new PIXI.Application({
            view: canvas,
            width: 800,
            height: 600,
            backgroundColor: 0x001122
        });

        this._runtime = new GameplayRuntime(app, this.services);
        
        // Create player
        const player = this._createPlayer();
        this._runtime.addEntity(player);

        // Spawn collectibles
        this._spawnCollectibles();

        // Create portal (initially closed)
        this._createPortal();
    }

    private _createPlayer(): Entity {
        const player = new Entity();
        player.addComponent(new Transform({ x: 400, y: 500 }));
        
        const sprite = new Sprite(PIXI.Texture.WHITE);
        sprite.sprite.width = 32;
        sprite.sprite.height = 32;
        sprite.sprite.tint = 0x00ff00;
        player.addComponent(sprite);
        
        player.addComponent(new Motion({ x: 0, y: 0 }));
        player.addComponent(new Collider(16));
        player.addComponent(new Health(100));
        
        return player;
    }

    private _spawnCollectibles(): void {
        // Spawn keys
        for (let i = 0; i < this._keysRequired; i++) {
            const key = this._createCollectible('key', 1, 100 + i * 200, 150 + Math.random() * 200);
            this._collectibles.push(key);
            this._runtime?.addEntity(key.entity);
        }

        // Spawn time balls
        for (let i = 0; i < 5; i++) {
            const timeBall = this._createCollectible('timeBall', 10, 150 + i * 120, 300 + Math.random() * 150);
            this._collectibles.push(timeBall);
            this._runtime?.addEntity(timeBall.entity);
        }
    }

    private _createCollectible(type: 'key' | 'timeBall', value: number, x: number, y: number): Collectible {
        const entity = new Entity();
        entity.addComponent(new Transform({ x, y }));
        
        const sprite = new Sprite(PIXI.Texture.WHITE);
        sprite.sprite.width = 20;
        sprite.sprite.height = 20;
        sprite.sprite.tint = type === 'key' ? 0xffff00 : 0x00ffff;
        entity.addComponent(sprite);
        
        entity.addComponent(new Collider(10));
        
        return { entity, type, value, collected: false };
    }

    private _createPortal(): void {
        const portal = new Entity();
        portal.addComponent(new Transform({ x: 400, y: 100 }));
        
        const sprite = new Sprite(PIXI.Texture.WHITE);
        sprite.sprite.width = 60;
        sprite.sprite.height = 60;
        sprite.sprite.tint = 0x8800ff;
        sprite.sprite.alpha = 0.3; // Initially dim
        portal.addComponent(sprite);
        
        portal.addComponent(new Collider(30));
        
        this._runtime?.addEntity(portal);
    }

    private _updateTimer(delta: number): void {
        this._timeRemaining -= delta / 60;
        
        const ui = this.services.optional<UiService>('uiService');
        if (ui) {
            const timeText = `Time: ${Math.max(0, Math.ceil(this._timeRemaining))}`;
            ui.setTextContent('portalTime', timeText);
            
            const keysText = `Keys: ${this._keysCollected}/${this._keysRequired}`;
            ui.setTextContent('portalKeys', keysText);
            
            if (this._timeBonus > 0) {
                const bonusText = `Bonus: +${this._timeBonus}s`;
                ui.setTextContent('portalBonus', bonusText);
            }
        }
    }

    private _checkWinLoseConditions(): void {
        if (this._timeRemaining <= 0 && !this._gameWon) {
            this._gameLost = true;
            this._handleGameLost();
        }
    }

    private _handleKeyCollected(): void {
        this._keysCollected += 1;
        const ui = this.services.optional<UiService>('uiService');
        
        if (ui) {
            ui.showMessage(`Key collected! (${this._keysCollected}/${this._keysRequired})`, '#c4ff6b');
        }
        
        if (this._keysCollected >= this._keysRequired && !this._portalOpen) {
            this._portalOpen = true;
            this._openPortal();
        }
    }

    private _handleTimeBallCollected(payload: any): void {
        this._timeBonus += payload.value || 10;
        this._timeRemaining += payload.value || 10;
        
        const ui = this.services.optional<UiService>('uiService');
        if (ui) {
            ui.showMessage(`+${payload.value || 10}s bonus!`, '#00ffff');
        }
    }

    private _handlePortalEnter(): void {
        if (this._portalOpen && !this._gameWon) {
            this._gameWon = true;
            this._handleGameWon();
        }
    }

    private _openPortal(): void {
        const ui = this.services.optional<UiService>('uiService');
        if (ui) {
            ui.showMessage('Portal opened! Enter to escape!', '#8800ff');
        }
        
        // Make portal visible and active
        const portal = this._runtime?.getEntities().find(e => 
            e.getComponent(Transform)?.position.x === 400 && 
            e.getComponent(Transform)?.position.y === 100
        );
        
        if (portal) {
            const sprite = portal.getComponent(Sprite);
            if (sprite) {
                sprite.sprite.alpha = 1.0;
                sprite.sprite.tint = 0xff00ff;
            }
        }
    }

    private _handleGameWon(): void {
        const finalTime = Math.max(0, this._timeRemaining);
        const totalScore = this._keysCollected * 1000 + this._timeBonus * 100 + finalTime * 10;
        
        const ui = this.services.optional<UiService>('uiService');
        if (ui) {
            ui.showMessage(`Escape successful! Score: ${totalScore}`, '#00ff00');
        }
        
        // Transition to results scene after delay
        setTimeout(() => {
            this.services.resolve('sceneManager').push('results', { 
                victory: true, 
                score: totalScore,
                timeRemaining: finalTime,
                keysCollected: this._keysCollected
            });
        }, 3000);
    }

    private _handleGameLost(): void {
        const ui = this.services.optional<UiService>('uiService');
        if (ui) {
            ui.showMessage('Time\'s up! Portal escape failed!', '#ff0000');
        }
        
        // Transition to results scene after delay
        setTimeout(() => {
            this.services.resolve('sceneManager').push('results', { 
                victory: false, 
                score: this._keysCollected * 100,
                timeRemaining: 0,
                keysCollected: this._keysCollected
            });
        }, 3000);
    }
}


