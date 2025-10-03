import { Scene, SceneManager } from '../engine/scene-manager';
import { setOverlayVisible } from '../ui/overlay-helpers';
import { ServiceLocator } from '../engine/service-locator';
import { ProgressionService } from '../engine/progression-service';
import { RunSummary } from '../engine/mission-service';
import { SceneTransitions } from '../ui/scene-transitions';

interface UIHandler {
    element: HTMLElement;
    handler: () => void;
}

export class ArcadeScene extends Scene {
    private _overlay: HTMLElement | null = null;
    private readonly _handlers: UIHandler[] = [];
    private readonly _missionId = 'gauntlet-proving';
    private _progressionService: ProgressionService | null = null;
    private _sceneTransitions: SceneTransitions | null = null;

    constructor(services: ServiceLocator) {
        super('arcade', services);
    }

    async onEnter(): Promise<void> {
        this._overlay = document.getElementById('arcadeOverlay');
        setOverlayVisible(this._overlay, true, '#arcadeStartButton');
        this._progressionService = this.services.resolve<ProgressionService>('progressionService');
        if (this._progressionService) {
            await this._progressionService.ready();
        }
        this._sceneTransitions = this.services.optional<SceneTransitions>('sceneTransitions');
        this._renderPreview();
        this._bind();
    }

    async onExit(): Promise<void> {
        this._unbind();
        setOverlayVisible(this._overlay, false);
        this._overlay = null;
        this._progressionService = null;
        this._sceneTransitions = null;
        await super.onExit();
    }

    private _bind(): void {
        const startButton = document.getElementById('arcadeStartButton');
        if (startButton) {
            const handler = () => this._startArcade();
            startButton.addEventListener('click', handler);
            this._handlers.push({ element: startButton, handler });
        }

        const backButton = document.getElementById('arcadeBackButton');
        if (backButton) {
            const handler = () => this._close();
            backButton.addEventListener('click', handler);
            this._handlers.push({ element: backButton, handler });
        }
    }

    private _unbind(): void {
        while (this._handlers.length) {
            const { element, handler } = this._handlers.pop()!;
            try {
                element.removeEventListener('click', handler);
            } catch (error) {
                console.warn('ArcadeScene: failed to remove handler', error);
            }
        }
    }

    private _renderPreview(): void {
        const container = document.getElementById('arcadeLeaderboardPreview');
        if (!container || !this._progressionService) {
            return;
        }
        container.innerHTML = '';
        const runs = this._progressionService.getRuns(this._missionId, 5);
        if (!runs.length) {
            container.textContent = 'No arcade runs recorded yet. Be the first ace pilot!';
            return;
        }
        const table = document.createElement('table');
        table.className = 'results-table';
        const thead = document.createElement('thead');
        thead.innerHTML = '<tr><th>#</th><th>Callsign</th><th>Score</th><th>Time</th></tr>';
        table.appendChild(thead);
        const tbody = document.createElement('tbody');
        runs.forEach((run, index) => {
            const row = document.createElement('tr');
            const rankCell = document.createElement('td');
            rankCell.textContent = String(index + 1);
            row.appendChild(rankCell);
            const callCell = document.createElement('td');
            callCell.textContent = run.callsign ?? 'Anon';
            row.appendChild(callCell);
            const scoreCell = document.createElement('td');
            scoreCell.textContent = String(run.score ?? 0);
            row.appendChild(scoreCell);
            const timeCell = document.createElement('td');
            timeCell.textContent = this._formatDuration(run.durationSeconds);
            row.appendChild(timeCell);
            tbody.appendChild(row);
        });
        table.appendChild(tbody);
        container.appendChild(table);
    }

    private _startArcade(): void {
        if (this._sceneTransitions && typeof this._sceneTransitions.isActive === 'function' && this._sceneTransitions.isActive()) {
            return;
        }
        const sceneManager = this.services.resolve<SceneManager>('sceneManager');
        sceneManager.replace('gameplay', {
            missionId: this._missionId,
            mode: 'arcade',
            options: { arcade: true }
        }).catch(error => {
            console.error('ArcadeScene: failed to start arcade gameplay', error);
        });
    }

    private _close(): void {
        if (this._sceneTransitions && typeof this._sceneTransitions.isActive === 'function' && this._sceneTransitions.isActive()) {
            return;
        }
        const sceneManager = this.services.resolve<SceneManager>('sceneManager');
        sceneManager.pop();
    }

    private _formatDuration(seconds?: number): string {
        if (!Number.isFinite(seconds)) {
            return '0s';
        }
        const total = Math.max(0, seconds!);
        const mins = Math.floor(total / 60);
        const secs = Math.round(total % 60);
        if (mins <= 0) {
            return `${secs}s`;
        }
        return `${mins}m ${secs}s`;
    }
}