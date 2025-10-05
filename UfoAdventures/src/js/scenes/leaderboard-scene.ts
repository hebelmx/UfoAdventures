import { Scene, SceneManager } from '../engine/scene-manager';
import { setOverlayVisible } from '../ui/overlay-helpers';
import { ServiceLocator } from '../engine/service-locator';
import { MissionService, Mission } from '../engine/mission-service';
import { ProgressionService } from '../engine/progression-service';
import { RunSummary } from '../engine/mission-service';

interface UIHandler {
    element: HTMLElement;
    handler: (event: Event) => void;
    type?: string;
}

export class LeaderboardScene extends Scene {
    private _overlay: HTMLElement | null = null;
    private _missionSelect: HTMLSelectElement | null = null;
    private _tableBody: HTMLTableSectionElement | null = null;
    private readonly _handlers: UIHandler[] = [];
    private _missions: Mission[] = [];
    private _progressionService: ProgressionService | null = null;

    constructor(services: ServiceLocator) {
        super('leaderboard', services);
    }

    async onEnter(): Promise<void> {
        this._overlay = document.getElementById('leaderboardOverlay');
        this._missionSelect = document.getElementById('leaderboardMissionSelect') as HTMLSelectElement;
        const table = document.getElementById('leaderboardTable');
        this._tableBody = table ? table.querySelector('tbody') : null;

        setOverlayVisible(this._overlay, true, '#leaderboardMissionSelect');

        const missionService = this.services.resolve<MissionService>('missionService');
        this._progressionService = this.services.resolve<ProgressionService>('progressionService');
        this._missions = missionService.getAll();
        this._renderMissionOptions();
        const initialMission = this._missionSelect && this._missionSelect.value ? this._missionSelect.value : (this._missions[0]?.id || null);
        if (this._missionSelect && !this._missionSelect.value && initialMission) {
            this._missionSelect.value = initialMission;
        }
        this._renderLeaderboard(initialMission);
        this._bind();
    }

    async onExit(): Promise<void> {
        this._unbind();
        setOverlayVisible(this._overlay, false);
        this._overlay = null;
        this._missionSelect = null;
        this._tableBody = null;
        this._missions = [];
        this._progressionService = null;
        await super.onExit();
    }

    private _bind(): void {
        if (this._missionSelect) {
            const handler = () => this._renderLeaderboard(this._missionSelect!.value);
            this._missionSelect.addEventListener('change', handler);
            this._handlers.push({ element: this._missionSelect, handler, type: 'change' });
        }

        const closeButton = document.getElementById('leaderboardCloseButton');
        if (closeButton) {
            const handler = () => this._close();
            closeButton.addEventListener('click', handler);
            this._handlers.push({ element: closeButton, handler });
        }
    }

    private _unbind(): void {
        while (this._handlers.length) {
            const { element, handler, type } = this._handlers.pop()!;
            try {
                element.removeEventListener(type || 'click', handler);
            } catch (error) {
                console.warn('LeaderboardScene: failed to remove handler', error);
            }
        }
    }

    private _renderMissionOptions(): void {
        const select = this._missionSelect;
        if (!select) {
            return;
        }
        const current = select.value;
        select.innerHTML = '';
        this._missions.forEach(mission => {
            const option = document.createElement('option');
            option.value = mission.id;
            option.textContent = mission.name;
            if (current && current === mission.id) {
                option.selected = true;
            }
            select.appendChild(option);
        });
    }
    private _renderLeaderboard(missionId: string | null): void {
        const tableBody = this._tableBody;
        const progression = this._progressionService;
        if (!tableBody || !progression) {
            return;
        }
        const runs = missionId ? progression.getRuns(missionId, 20) : [];
        tableBody.innerHTML = '';
        if (!runs.length) {
            const row = document.createElement('tr');
            const cell = document.createElement('td');
            cell.colSpan = 5;
            cell.textContent = 'No recorded runs yet.';
            row.appendChild(cell);
            tableBody.appendChild(row);
            return;
        }
        runs.forEach((run, index) => {
            const row = document.createElement('tr');

            const rankCell = document.createElement('td');
            rankCell.textContent = String(index + 1);
            row.appendChild(rankCell);

            const callsignCell = document.createElement('td');
            callsignCell.textContent = run.callsign ?? 'Anon';
            row.appendChild(callsignCell);

            const scoreCell = document.createElement('td');
            scoreCell.textContent = String(run.score ?? 0);
            row.appendChild(scoreCell);

            const timeCell = document.createElement('td');
            timeCell.textContent = this._formatDuration(run.durationSeconds);
            row.appendChild(timeCell);

            const outcomeCell = document.createElement('td');
            outcomeCell.textContent = run.outcome || '�';
            row.appendChild(outcomeCell);

            tableBody.appendChild(row);
        });
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

    private _close(): void {
        const sceneManager = this.services.resolve<SceneManager>('sceneManager');
        sceneManager.pop(undefined, undefined, 'fade');
    }
}
