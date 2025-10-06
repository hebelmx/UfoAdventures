import { Scene, SceneManager } from '../engine/scene-manager';
import { ServiceLocator } from '../engine/service-locator';
import { MissionService, Mission, MissionObjective } from '../engine/mission-service';
import { ProgressionService } from '../engine/progression-service';
import { AudioService } from '../engine/audio-service';
import { RunSummary } from '../engine/mission-service';
import type { SceneTransitions } from '../ui/scene-transitions';
import { UiService } from '../engine/ui-service';

interface MainMenuElements {
    header: HTMLElement | null;
    list: HTMLElement | null;
    title: HTMLElement | null;
    description: HTMLElement | null;
    objectives: HTMLElement | null;
    rewards: HTMLElement | null;
    leaderboard: HTMLElement | null;
    launchButton: HTMLButtonElement | null;
    leaderboardButton: HTMLButtonElement | null;
    campaignButton: HTMLButtonElement | null;
    arcadeButton: HTMLButtonElement | null;
    trainingButton: HTMLButtonElement | null;
    portalEscapeButton?: HTMLButtonElement | null;
    optionsButton: HTMLButtonElement | null;
    creditsButton: HTMLButtonElement | null;
    leaderboardSceneButton: HTMLButtonElement | null;
}

interface UIHandler {
    element: HTMLElement;
    handler: () => void;
}

const createEmptyMainMenuElements = (): MainMenuElements => ({
    header: null,
    list: null,
    title: null,
    description: null,
    objectives: null,
    rewards: null,
    leaderboard: null,
    launchButton: null,
    leaderboardButton: null,
    campaignButton: null,
    arcadeButton: null,
    trainingButton: null,
    portalEscapeButton: null,
    optionsButton: null,
    creditsButton: null,
    leaderboardSceneButton: null
});

export class MainMenuScene extends Scene {
    private _missions: Mission[] = [];
    private _allMissions: Mission[] = [];
    private _selectedMissionId: string | null = null;
    private _elements: MainMenuElements = createEmptyMainMenuElements();
    private readonly _cardHandlers: UIHandler[] = [];
    private readonly _uiHandlers: UIHandler[] = [];
    private _missionKeydownHandler: ((event: KeyboardEvent) => void) | null = null;
    private _missionService: MissionService | null = null;
    private _progressionService: ProgressionService | null = null;
    private _sceneTransitions: SceneTransitions | null = null;
    constructor(services: ServiceLocator) {
        super('main-menu', services);
        this._uiService = this.services.optional<UiService>('uiService');
    }

    private _setOverlayVisible(visible: boolean): void {
        this._uiService?.setOverlayVisible('mainMenuOverlay', visible);
        if (visible) {
            this._focusSelectedMission();
        }
    }


    async onEnter(): Promise<void> {
        if (typeof window !== 'undefined' && window.__E2E__) {
            console.info('MainMenuScene: onEnter invoked');
        }

        this._uiService?.setOverlayVisible('loadingScreen', false);

        this._setOverlayVisible(true);

        if (typeof window !== 'undefined' && window.__E2E__) {
            console.info('MainMenuScene: overlay activated for E2E');
        }

        const audioService = this.services.optional<AudioService>('audioService');
        if (audioService) {
            audioService.playMusic('music_main_theme', { loop: true });
        }



        this._elements = {
            header: this._uiService?.getElement('missionHeader'),
            list: this._uiService?.getElement('missionList'),
            title: this._uiService?.getElement('missionTitle'),
            description: this._uiService?.getElement('missionDescription'),
            objectives: this._uiService?.getElement('missionObjectiveList'),
            rewards: this._uiService?.getElement('missionRewards'),
            leaderboard: this._uiService?.getElement('missionLeaderboardPreview'),
            launchButton: this._uiService?.getElement<HTMLButtonElement>('missionLaunchButton'),
            leaderboardButton: this._uiService?.getElement<HTMLButtonElement>('missionLeaderboardButton'),
            campaignButton: this._uiService?.getElement<HTMLButtonElement>('menuCampaignButton'),
            arcadeButton: this._uiService?.getElement<HTMLButtonElement>('menuArcadeButton'),
            trainingButton: this._uiService?.getElement<HTMLButtonElement>('menuTrainingButton'),
            portalEscapeButton: this._uiService?.getElement<HTMLButtonElement>('menuPortalEscapeButton'),
            optionsButton: this._uiService?.getElement<HTMLButtonElement>('menuOptionsButton'),
            creditsButton: this._uiService?.getElement<HTMLButtonElement>('menuCreditsButton'),
            leaderboardSceneButton: this._uiService?.getElement<HTMLButtonElement>('menuLeaderboardSceneButton')
        };

        this._uiService?.setTextContent('missionHeader', 'Select a mission to begin');

        this._missionService = this.services.resolve<MissionService>('missionService');
        this._progressionService = this.services.resolve<ProgressionService>('progressionService');
        this._sceneTransitions = this.services.optional<SceneTransitions>('sceneTransitions');

        this._allMissions = this._missionService.getAll();
        this._missions = this._allMissions.filter(mission => mission.mode === 'adventure' || mission.mode === 'boss');
        if (!this._missions.length) {
            this._missions = [{
                id: 'adventure',
                name: 'Free Flight',
                mode: 'adventure',
                description: 'Take to the skies in free play mode.',
                objectives: [],
                scoring: {},
                rewards: {}
            } as Mission];
        }

        const defaultMission = this._missionService.getDefault() || this._missions[0] || null;
        this._selectedMissionId = defaultMission ? defaultMission.id : null;

        this._renderMissionList();
        this._focusSelectedMission();
        this._renderPreview();
        this._bindPrimaryButtons();
    }

    async onExit(): Promise<void> {
        this._teardownMissionNavigation();
        this._teardownMissionCards();
        this._teardownUIHandlers();
        this._missions = [];
        this._allMissions = [];
        this._selectedMissionId = null;

        if (this._elements.header) {
            this._elements.header.textContent = 'Preparing mission data...';
        }


        this._setOverlayVisible(false);

        this._elements = createEmptyMainMenuElements();
        this._missionService = null;
        this._progressionService = null;
        this._sceneTransitions = null;

        await super.onExit();
    }

    private _bindPrimaryButtons(): void {
        const sceneManager = this.services.resolve<SceneManager>('sceneManager');

        if (this._elements.launchButton) {
            const handler = () => {
                const mission = this._getSelectedMission();
                if (!mission) {
                    return;
                }
                this._elements.launchButton!.disabled = true;
                sceneManager.change('gameplay', { mode: mission.mode, missionId: mission.id }).catch((error) => {
                    console.error('Failed to start mission', mission.id, error);
                    this._elements.launchButton!.disabled = false;
                });
            };
            this._elements.launchButton.disabled = false;
            this._elements.launchButton.addEventListener('click', handler);
            this._uiHandlers.push({ element: this._elements.launchButton, handler });
        }

        if (this._elements.leaderboardButton) {
            const handler = () => {
                if (!this._elements.leaderboard) {
                    return;
                }
                const isCollapsed = this._elements.leaderboard.classList.toggle('mission-leaderboard--collapsed');
                const mission = this._getSelectedMission();
                this._renderMissionLeaderboard(mission, isCollapsed);
                this._elements.leaderboardButton!.textContent = isCollapsed ? 'View Leaderboard' : 'Hide Leaderboard';
            };
            this._elements.leaderboardButton.addEventListener('click', handler);
            this._uiHandlers.push({ element: this._elements.leaderboardButton, handler });
        }

        this._bindNavigation();
    }

    private _teardownUIHandlers(): void {
        while (this._uiHandlers.length) {
            const { element, handler } = this._uiHandlers.pop()!;
            try {
                element.removeEventListener('click', handler);
            } catch (error) {
                console.warn('MainMenuScene: failed to remove handler', error);
            }
        }
    }

    private _teardownMissionNavigation(): void {
        const list = this._elements.list;
        if (list && this._missionKeydownHandler) {
            list.removeEventListener('keydown', this._missionKeydownHandler);
        }

        if (list) {
            list.removeAttribute('role');
            const cards = list.querySelectorAll<HTMLButtonElement>('.mission-card');
            cards.forEach(card => {
                card.tabIndex = -1;
                card.setAttribute('aria-selected', 'false');
                card.setAttribute('aria-pressed', 'false');
                card.removeAttribute('aria-current');
            });
        }

        this._missionKeydownHandler = null;
    }

    private _teardownMissionCards(): void {
        while (this._cardHandlers.length) {
            const { element, handler } = this._cardHandlers.pop()!;
            try {
                element.removeEventListener('click', handler);
            } catch (error) {
                console.warn('MainMenuScene: failed to remove mission handler', error);
            }
        }
    }

    private _renderMissionList(): void {
        const listEl = this._elements.list;
        if (!listEl) {
            return;
        }

        listEl.innerHTML = '';
        this._teardownMissionCards();

        if (!this._missions.length) {
            const empty = document.createElement('div');
            empty.className = 'mission-card';
            empty.textContent = 'No missions available.';
            listEl.appendChild(empty);
            return;
        }

        this._missions.forEach(mission => {
            const button = document.createElement('button');
            button.type = 'button';
            const isSelected = mission.id === this._selectedMissionId;
            button.className = 'mission-card' + (isSelected ? ' mission-card--active' : '');
            button.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
            button.setAttribute('aria-selected', isSelected ? 'true' : 'false');
            button.setAttribute('role', 'option');
            button.tabIndex = isSelected ? 0 : -1;
            button.dataset.missionId = mission.id;

            const name = document.createElement('h4');
            name.textContent = mission.name;
            const description = document.createElement('p');
            description.textContent = mission.description ?? 'No briefing available yet.';

            button.appendChild(name);
            button.appendChild(description);

            const handler = () => {
                this._selectedMissionId = mission.id;
                this._renderMissionList();
                this._focusSelectedMission();
                this._renderPreview();
            };

            button.addEventListener('click', handler);
            listEl.appendChild(button);
            this._cardHandlers.push({ element: button, handler });
        });
    }

    private _focusSelectedMission(): void {
        const list = this._elements.list;
        if (!list) {
            return;
        }

        const cards = Array.from(list.querySelectorAll<HTMLButtonElement>('.mission-card'));
        if (!cards.length) {
            return;
        }

        if (!this._selectedMissionId && cards[0]?.dataset.missionId) {
            this._selectedMissionId = cards[0].dataset.missionId ?? null;
        }

        let selectedIndex = this._selectedMissionId
            ? cards.findIndex(card => card.dataset.missionId === this._selectedMissionId)
            : 0;

        if (selectedIndex < 0) {
            selectedIndex = 0;
            const fallbackId = cards[0]?.dataset.missionId;
            if (fallbackId) {
                this._selectedMissionId = fallbackId;
            }
        }

        list.setAttribute('role', 'listbox');

        let selectedCard: HTMLButtonElement | null = null;
        cards.forEach((card, index) => {
            const isSelected = index === selectedIndex;
            card.tabIndex = isSelected ? 0 : -1;
            card.setAttribute('aria-selected', isSelected ? 'true' : 'false');
            card.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
            if (isSelected) {
                card.setAttribute('aria-current', 'true');
                selectedCard = card;
            } else {
                card.removeAttribute('aria-current');
            }
        });

        const focusTarget = selectedCard as HTMLButtonElement | null;
        focusTarget?.focus({ preventScroll: true });

        if (!this._missionKeydownHandler) {
            this._missionKeydownHandler = (event: KeyboardEvent) => {
                if (this._sceneTransitions?.isActive()) {
                    return;
                }

                const target = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>('.mission-card');
                if (!target) {
                    return;
                }

                const buttons = Array.from(list.querySelectorAll<HTMLButtonElement>('.mission-card'));
                if (!buttons.length) {
                    return;
                }

                const currentIndex = buttons.indexOf(target);
                if (currentIndex === -1) {
                    return;
                }

                const key = event.key;
                const lowerKey = key.length === 1 ? key.toLowerCase() : key;

                const move = (delta: number) => {
                    event.preventDefault();
                    const nextIndex = (currentIndex + delta + buttons.length) % buttons.length;
                    const nextCard = buttons[nextIndex];
                    if (nextCard) {
                        nextCard.click();
                    }
                };

                if (key === 'ArrowDown' || key === 'ArrowRight' || lowerKey === 's' || lowerKey === 'd') {
                    move(1);
                    return;
                }

                if (key === 'ArrowUp' || key === 'ArrowLeft' || lowerKey === 'w' || lowerKey === 'a') {
                    move(-1);
                    return;
                }

                if (key === 'Enter') {
                    event.preventDefault();
                    target.click();
                }
            };

            list.addEventListener('keydown', this._missionKeydownHandler);
        }
    }

    private _bindNavigation(): void {
        this._bindNavButton(this._elements.campaignButton, () => this._showCampaign());
        this._bindNavButton(this._elements.arcadeButton, () => this._openScene('arcade'));
        this._bindNavButton(this._elements.trainingButton, () => this._openScene('training'));
        this._bindNavButton(this._elements.portalEscapeButton as HTMLButtonElement | null, () => this._openScene('portal-escape'));
        this._bindNavButton(this._elements.optionsButton, () => this._openScene('options'));
        this._bindNavButton(this._elements.creditsButton, () => this._openScene('credits'));
        this._bindNavButton(this._elements.leaderboardSceneButton, () => this._openScene('leaderboard'));
    }

    private _showCampaign(): void {
        if (this._elements.leaderboard) {
            this._elements.leaderboard.classList.add('mission-leaderboard--collapsed');
        }
        this._uiService?.setTextContent('missionLeaderboardButton', 'View Leaderboard');
        const campaignMissions = this._allMissions.filter(mission => mission.mode === 'adventure' || mission.mode === 'boss');
        this._missions = campaignMissions.length ? campaignMissions : this._missions;
        const defaultMission = this._missionService!.getDefault() || this._missions[0];
        if (defaultMission) {
            this._selectedMissionId = defaultMission.id;
        }
        if (!defaultMission && this._missions.length) {
            this._selectedMissionId = this._missions[0].id;
        }
        this._renderMissionList();
        this._focusSelectedMission();
        this._renderPreview();
    }

    private _renderPreview(): void {
        const mission = this._getSelectedMission();
        const launchButton = this._elements.launchButton;
        if (!mission) {
            if (launchButton) {
                launchButton.disabled = true;
                launchButton.setAttribute('aria-disabled', 'true');
            }
            return;
        }
        if (launchButton) {
            launchButton.disabled = false;
            launchButton.removeAttribute('aria-disabled');
        }

        this._uiService?.setTextContent('missionTitle', mission.name);
        this._uiService?.setTextContent('missionDescription', mission.description ?? 'Awaiting briefing.');

        if (this._elements.objectives) {
            this._elements.objectives.innerHTML = '';
            const objectives = Array.isArray(mission.objectives) ? mission.objectives : [];
            if (!objectives.length) {
                const item = document.createElement('li');
                item.textContent = 'No mission objectives specified.';
                this._elements.objectives.appendChild(item);
            } else {
                objectives.forEach(obj => {
                    const item = document.createElement('li');
                    const label = obj.label || obj.type || 'Objective';
                    const detail = this._describeObjective(obj);
                    item.textContent = detail ? `${label} - ${detail}` : label;
                    this._elements.objectives!.appendChild(item);
                });
            }
        }

        if (this._elements.rewards) {
            this._elements.rewards.innerHTML = '';
            const rewards = mission.rewards || {};
            const entries = Object.entries(rewards);
            if (!entries.length) {
                this._uiService?.setTextContent('missionRewards', 'Rewards classified');
            } else {
                entries.forEach(([key, value]) => {
                    const pill = document.createElement('span');
                    const formatted = typeof value === 'number' ? value.toLocaleString() : String(value);
                    pill.textContent = `${key.toUpperCase()}: ${formatted}`;
                    this._elements.rewards!.appendChild(pill);
                });
            }
        }

        if (this._elements.leaderboard) {
            this._renderMissionLeaderboard(mission, true);
            this._elements.leaderboard.classList.add('mission-leaderboard--collapsed');
        }

        this._uiService?.setTextContent('missionLeaderboardButton', 'View Leaderboard');
    }

    private _renderMissionLeaderboard(mission: Mission | null, compact = false): void {
        const container = this._elements.leaderboard;
        if (!container || !mission) {
            return;
        }

        container.innerHTML = '';

        const header = document.createElement('h4');
        header.textContent = 'Top Runs';
        container.appendChild(header);

        const runs = this._progressionService ? this._progressionService.getRuns(mission.id, compact ? 5 : 10) : [];
        if (!runs.length) {
            const empty = document.createElement('p');
            empty.textContent = 'No recorded runs yet.';
            container.appendChild(empty);
            return;
        }

        const list = document.createElement('ul');
        runs.forEach((run, index) => {
            const item = document.createElement('li');
            const rank = document.createElement('span');
            rank.textContent = String(index + 1).padStart(2, '0');
            const detail = document.createElement('span');
            const callsign = run.callsign ?? 'Anon';
            const score = (run.score ?? 0).toLocaleString();
            detail.textContent = `${callsign} - ${score}`;
            item.appendChild(rank);
            item.appendChild(detail);
            list.appendChild(item);
        });
        container.appendChild(list);
    }

    private _describeObjective(objective: MissionObjective): string {
        if (!objective) {
            return '';
        }

        switch (objective.type) {
            case 'eliminate':
                if (Number.isFinite(objective.count)) {
                    return `${objective.count} targets`;
                }
                return '';
            case 'timeUnder':
            case 'survive':
                if (Number.isFinite(objective.seconds)) {
                    return this._formatSeconds(objective.seconds!);
                }
                return '';
            case 'damageUnder':
                if (Number.isFinite(objective.amount)) {
                    return `<= ${objective.amount} dmg`;
                }
                return '';
            case 'defeatBoss':
            default:
                return '';
        }
    }

    private _formatSeconds(value: number): string {
        if (!Number.isFinite(value)) {
            return '';
        }
        const minutes = Math.floor(value / 60);
        const seconds = Math.round(value % 60);
        return `${minutes}m ${seconds}s`;
    }

    private _getSelectedMission(): Mission | null {
        return this._missions.find(mission => mission.id === this._selectedMissionId) || this._missions[0] || null;
    }

    private _bindNavButton(element: HTMLButtonElement | null, handler: () => void): void {
        if (!element || typeof handler !== 'function') {
            return;
        }
        const wrapped = () => {
            if (this._sceneTransitions?.isActive()) {
                return;
            }
            handler();
        };
        element.addEventListener('click', wrapped);
        this._uiHandlers.push({ element, handler: wrapped });
    }

    private _openScene(name: string): void {
        const sceneManager = this.services.resolve<SceneManager>('sceneManager');
        sceneManager.push(name, undefined, undefined, 'fade').catch(error => {
            console.error(`MainMenuScene: failed to open scene ${name}`, error);
        });
    }
}










