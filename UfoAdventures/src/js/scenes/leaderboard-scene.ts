class LeaderboardScene extends Scene {
    constructor(services) {
        super('leaderboard', services);
        this._overlay = null;
        this._missionSelect = null;
        this._tableBody = null;
        this._handlers = [];
        this._missions = [];
        this._progressionService = null;
    }

    async onEnter() {
        this._overlay = document.getElementById('leaderboardOverlay');
        this._missionSelect = document.getElementById('leaderboardMissionSelect');
        const table = document.getElementById('leaderboardTable');
        this._tableBody = table ? table.querySelector('tbody') : null;

        if (this._overlay) {
            this._overlay.style.display = 'flex';
        }

        const missionService = this.services.resolve('missionService');
        this._progressionService = this.services.resolve('progressionService');
        this._missions = missionService.getAll();
        this._renderMissionOptions();
        const initialMission = this._missionSelect && this._missionSelect.value ? this._missionSelect.value : (this._missions[0]?.id || null);
        if (this._missionSelect && !this._missionSelect.value && initialMission) {
            this._missionSelect.value = initialMission;
        }
        this._renderLeaderboard(initialMission);
        this._bind();
    }

    async onExit() {
        this._unbind();
        if (this._overlay) {
            this._overlay.style.display = 'none';
        }
        this._overlay = null;
        this._missionSelect = null;
        this._tableBody = null;
        this._missions = [];
        this._progressionService = null;
        await super.onExit();
    }

    _bind() {
        if (this._missionSelect) {
            const handler = () => this._renderLeaderboard(this._missionSelect.value);
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

    _unbind() {
        while (this._handlers.length) {
            const { element, handler, type } = this._handlers.pop();
            try {
                element.removeEventListener(type || 'click', handler);
            } catch (error) {
                console.warn('LeaderboardScene: failed to remove handler', error);
            }
        }
    }

    _renderMissionOptions() {
        if (!this._missionSelect) {
            return;
        }
        const current = this._missionSelect.value;
        this._missionSelect.innerHTML = '';
        this._missions.forEach(mission => {
            const option = document.createElement('option');
            option.value = mission.id;
            option.textContent = mission.name;
            if (current && current === mission.id) {
                option.selected = true;
            }
            this._missionSelect.appendChild(option);
        });
    }

    _renderLeaderboard(missionId) {
        if (!this._tableBody || !this._progressionService) {
            return;
        }
        const runs = this._progressionService.getRuns(missionId, 20);
        this._tableBody.innerHTML = '';
        if (!runs.length) {
            const row = document.createElement('tr');
            const cell = document.createElement('td');
            cell.colSpan = 5;
            cell.textContent = 'No recorded runs yet.';
            row.appendChild(cell);
            this._tableBody.appendChild(row);
            return;
        }
        runs.forEach((run, index) => {
            const row = document.createElement('tr');

            const rankCell = document.createElement('td');
            rankCell.textContent = String(index + 1);
            row.appendChild(rankCell);

            const callsignCell = document.createElement('td');
            callsignCell.textContent = run.callsign || 'Anon';
            row.appendChild(callsignCell);

            const scoreCell = document.createElement('td');
            scoreCell.textContent = run.score != null ? run.score : 0;
            row.appendChild(scoreCell);

            const timeCell = document.createElement('td');
            timeCell.textContent = this._formatDuration(run.durationSeconds);
            row.appendChild(timeCell);

            const outcomeCell = document.createElement('td');
            outcomeCell.textContent = run.outcome || '—';
            row.appendChild(outcomeCell);

            this._tableBody.appendChild(row);
        });
    }

    _formatDuration(seconds) {
        if (!Number.isFinite(seconds)) {
            return '0s';
        }
        const total = Math.max(0, seconds);
        const mins = Math.floor(total / 60);
        const secs = Math.round(total % 60);
        if (mins <= 0) {
            return secs + 's';
        }
        return mins + 'm ' + secs + 's';
    }

    _close() {
        const sceneManager = this.services.resolve('sceneManager');
        sceneManager.pop();
    }
}

