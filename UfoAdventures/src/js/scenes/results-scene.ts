import { Scene, SceneManager } from '../engine/scene-manager';
import { setOverlayVisible } from '../ui/overlay-helpers';
import { ServiceLocator } from '../engine/service-locator';
import { MissionService, Mission, RunSummary, RunTelemetry, ObjectiveResult } from '../engine/mission-service';
import { ProgressionService } from '../engine/progression-service';


import { showMessage } from '../ui';
import type { GameResultsRequest } from '../engine/event-payloads';

interface UIHandler {
    element: HTMLElement;
    handler: (event: Event) => void;
}

interface ResultsSceneParams {
    outcome?: string;
    reason?: string | null;
    missionId?: string | null;
    mode?: string | null;
    summary?: RunSummary | null;
    details?: unknown;
    options?: unknown;
}

export class ResultsScene extends Scene {
    private _overlay: HTMLElement | null = null;
    private readonly _handlers: UIHandler[] = [];
    private _formHandler: ((event: Event) => void) | null = null;
    private _lastParams: ResultsSceneParams = {};
    private _missionService: MissionService | null = null;
    private _progressionService: ProgressionService | null = null;
    private _mission: Mission | null = null;
    private _summary: RunSummary | null = null;
    private _leaderboardSaved = false;
    private readonly _uiService: UiService | null;

    constructor(services: ServiceLocator) {
        super('results', services);
        this._uiService = services.optional<UiService>('uiService');
    }

    async onEnter(params: ResultsSceneParams = {}): Promise<void> {
        this._lastParams = params;
        this._missionService = this.services.resolve<MissionService>('missionService');
        this._progressionService = this.services.resolve<ProgressionService>('progressionService');
        if (this._progressionService) {
            await this._progressionService.ready();
        }

        this._overlay = document.getElementById('resultsOverlay');
        setOverlayVisible(this._overlay, true, '#resultsCallsign');

        this._mission = this._resolveMission(params);
        this._summary = this._resolveSummary(params, this._mission);
        this._leaderboardSaved = false;

        this._renderContent();
        this._bindButtons();
    }

    async onExit(): Promise<void> {
        this._unbindButtons();
        setOverlayVisible(this._overlay, false);
        this._overlay = null;

        this._mission = null;
        this._summary = null;
        this._missionService = null;
        this._progressionService = null;

        await super.onExit();
    }

    private _resolveMission(params: ResultsSceneParams): Mission | null {
        if (params.summary?.missionId) {
            const mission = this._missionService!.getById(params.summary.missionId);
            if (mission) {
                return mission;
            }
        }
        if (params.missionId) {
            const mission = this._missionService!.getById(params.missionId);
            if (mission) {
                return mission;
            }
        }
        return this._missionService!.getDefault();
    }

    private _resolveSummary(params: ResultsSceneParams, mission: Mission | null): RunSummary | null {
        if (params.summary) {
            return { ...params.summary };
        }

        if (!mission) {
            return null;
        }

        const telemetry: RunTelemetry = {
            startTime: Date.now(),
            endTime: Date.now(),
            durationSeconds: 0,
            enemyKills: 0,
            damageTaken: 0,
            bossDefeated: false,
            playerDefeated: params.outcome === 'defeat',
            abilitiesUsed: {},
            livesLost: 0
        };

        const objectiveResults = this._missionService!.evaluateObjectives(mission, telemetry);
        const score = this._missionService!.calculateScore(mission, telemetry, objectiveResults);

        return {
            id: `${mission.id}:${Date.now()}`,
            missionId: mission.id,
            missionName: mission.name,
            mode: mission.mode,
            outcome: params.outcome || 'complete',
            reason: params.reason || null,
            score,
            startTime: telemetry.startTime ?? null,
            endTime: telemetry.endTime ?? null,
            durationSeconds: telemetry.durationSeconds ?? 0,
            enemyKills: telemetry.enemyKills ?? 0,
            bossDefeated: telemetry.bossDefeated ?? false,
            damageTaken: telemetry.damageTaken ?? 0,
            abilitiesUsed: telemetry.abilitiesUsed ?? {},
            livesLost: telemetry.livesLost ?? 0,
            objectiveResults,
            rewards: mission.rewards || {},
            flags: params.details && typeof params.details === 'object' ? { details: params.details } : {},
            timestamp: Date.now()
        };
    }

    private _renderContent(): void {
        const outcome = this._summary?.outcome || this._lastParams.outcome || 'complete';
        const titleEl = document.getElementById('resultsTitle');
        const summaryEl = document.getElementById('resultsSummary');
        const detailEl = document.getElementById('resultsDetail');

        if (titleEl) {
            titleEl.textContent = outcome === 'defeat' ? 'Mission Failed' : 'Mission Complete';
        }

        if (summaryEl) {
            const missionName = this._mission ? this._mission.name : 'Mission';
            const reason = this._summary?.reason || this._lastParams.reason || '';
            const reasonText = reason ? ` • ${reason}` : '';
            summaryEl.textContent = missionName + reasonText;
        }

        this._renderObjectives();
        this._renderStats();
        this._renderLeaderboard();

        if (detailEl) {
            detailEl.textContent = '';
        }

        const form = document.getElementById('resultsSubmissionForm') as HTMLFormElement;
        if (form) {
            form.reset();
        }

        const submitButton = document.getElementById('resultsSubmitButton') as HTMLButtonElement;
        if (submitButton) {
            submitButton.disabled = !this._summary;
        }
    }

    private _renderObjectives(): void {
        const listEl = document.getElementById('resultsObjectives');
        if (!listEl) {
            return;
        }

        listEl.innerHTML = '';
        const objectives = this._summary?.objectiveResults || [];
        if (!objectives.length) {
            const item = document.createElement('li');
            item.className = 'results-objective';
            item.textContent = 'No objectives tracked for this mission.';
            listEl.appendChild(item);
            return;
        }

        objectives.forEach(obj => {
            const item = document.createElement('li');
            item.className = `results-objective${obj.completed ? '' : ' results-objective--failed'}`;
            item.textContent = obj.label || obj.id;
            listEl.appendChild(item);
        });
    }

    private _renderStats(): void {
        const container = document.getElementById('resultsStats');
        if (!container) {
            return;
        }

        container.innerHTML = '';
        const summary = this._summary;
        const mission = this._mission;

        const stats = [
            { label: 'Score', value: summary?.score ?? 0 },
            { label: 'Duration', value: this._formatDuration(summary?.durationSeconds) },
            { label: 'Enemies Down', value: summary?.enemyKills ?? 0 },
            { label: 'Damage Taken', value: summary?.damageTaken ?? 0 },
            { label: 'Lives Lost', value: summary?.livesLost ?? 0 },
            { label: 'Boss Defeated', value: summary?.bossDefeated ? 'Yes' : 'No' },
            { label: 'Mode', value: summary?.mode || mission?.mode || this._lastParams.mode || 'adventure' },
            { label: 'Abilities Used', value: this._formatAbilitySummary(summary?.abilitiesUsed) }
        ];

        stats.forEach(stat => {
            const card = document.createElement('div');
            card.className = 'results-stat';
            const label = document.createElement('span');
            label.textContent = stat.label;
            const value = document.createElement('span');
            value.textContent = String(stat.value);
            card.appendChild(label);
            card.appendChild(value);
            container.appendChild(card);
        });
    }

    private _renderLeaderboard(): void {
        const table = document.getElementById('resultsLeaderboard');
        if (!table) {
            return;
        }
        const tbody = table.querySelector('tbody');
        if (!tbody) {
            return;
        }

        tbody.innerHTML = '';
        if (!this._mission || !this._progressionService) {
            return;
        }

        const runs = this._progressionService.getRuns(this._mission.id, 10);
        runs.forEach((run, index) => {
            const row = document.createElement('tr');
            const rank = document.createElement('td');
            rank.textContent = String(index + 1);
            const callsign = document.createElement('td');
            callsign.textContent = run.callsign ?? 'Anon';
            const score = document.createElement('td');
            score.textContent = (run.score ?? 0).toLocaleString();
            const time = document.createElement('td');
            time.textContent = this._formatDuration(run.durationSeconds);
            const outcome = document.createElement('td');
            outcome.textContent = run.outcome || '—';
            row.appendChild(rank);
            row.appendChild(callsign);
            row.appendChild(score);
            row.appendChild(time);
            row.appendChild(outcome);
            tbody.appendChild(row);
        });
    }

    private _bindButtons(): void {
        const sceneManager = this.services.resolve<SceneManager>('sceneManager');

        this._hookButton('resultsMenuButton', async (button) => {
            (button as HTMLButtonElement).disabled = true;
            try {
                await sceneManager.replace('main-menu', undefined, undefined, 'fade');
            } catch (error) {
                console.error('ResultsScene: failed to return to menu', error);
                (button as HTMLButtonElement).disabled = false;
            }
        });

        this._hookButton('resultsRetryButton', async (button) => {
            (button as HTMLButtonElement).disabled = true;
            try {
                const missionId = this._mission ? this._mission.id : (this._lastParams.missionId || null);
                await sceneManager.replace('gameplay', {
                    missionId,
                    mode: this._lastParams.mode || null,
                    options: this._lastParams.options || {}
                }, undefined, 'fade');
            } catch (error) {
                console.error('ResultsScene: failed to restart gameplay', error);
                (button as HTMLButtonElement).disabled = false;
            }
        });

        const form = document.getElementById('resultsSubmissionForm');
        if (form) {
            this._formHandler = (event) => {
                event.preventDefault();
                this._handleRunSubmission();
            };
            form.addEventListener('submit', this._formHandler);
        }
    }

    private _hookButton(id: string, handler: (button: HTMLElement) => void): void {
        const element = document.getElementById(id);
        if (!element) {
            console.warn('ResultsScene: button not found', id);
            return;
        }

        const wrapped = (event: Event) => handler(element);
        element.addEventListener('click', wrapped);
        (element as HTMLButtonElement).disabled = false;
        this._handlers.push({ element, handler: wrapped });
    }

    private _unbindButtons(): void {
        while (this._handlers.length) {
            const { element, handler } = this._handlers.pop()!;
            element.removeEventListener('click', handler);
            (element as HTMLButtonElement).disabled = false;
        }

        const form = document.getElementById('resultsSubmissionForm');
        if (form && this._formHandler) {
            form.removeEventListener('submit', this._formHandler);
        }
        this._formHandler = null;
    }

    private _handleRunSubmission(): void {
        if (this._leaderboardSaved || !this._mission || !this._summary) {
            return;
        }

        const input = document.getElementById('resultsCallsign') as HTMLInputElement;
        const submitButton = document.getElementById('resultsSubmitButton') as HTMLButtonElement;
        const callsign = input ? (input.value || '').trim() : '';
        const normalizedCallsign = callsign || 'Anon';

        const runRecord: RunSummary = {
            ...this._summary,
            callsign: normalizedCallsign,
            timestamp: Date.now()
        };

        try {
            const recorded = this._progressionService!.recordRun(runRecord);
            this._leaderboardSaved = true;
            if (recorded) {
                this._summary = { ...recorded };
            }
            if (submitButton) {
                submitButton.disabled = true;
            }
            if (input) {
                input.value = normalizedCallsign;
            }
            this._renderLeaderboard();
            this._uiService?.showMessage('Run saved to leaderboard!', '#6bffb8');
        } catch (error) {
            console.error('ResultsScene: failed to record run', error);
            this._uiService?.showMessage('Unable to save run. Check console for details.', '#ff8686');
        }
    }

    private _formatDuration(seconds?: number): string {
        if (!Number.isFinite(seconds)) {
            return '0s';
        }
        const totalSeconds = Math.max(0, seconds!);
        const mins = Math.floor(totalSeconds / 60);
        const secs = Math.round(totalSeconds % 60);
        if (mins <= 0) {
            return `${secs}s`;
        }
        return `${mins}m ${secs}s`;
    }

    private _formatAbilitySummary(abilities: { [key: string]: number } = {}): string {
        const entries = Object.entries(abilities || {});
        if (!entries.length) {
            return '—';
        }
        return entries.map(([name, count]) => `${name}: ${count}`).join(', ');
    }
}
