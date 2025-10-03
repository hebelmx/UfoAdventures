export interface MissionObjective {
    id?: string;
    type: 'eliminate' | 'defeatBoss' | 'timeUnder' | 'survive' | 'damageUnder';
    count?: number;
    seconds?: number;
    amount?: number;
    label?: string;
}

export interface MissionScoring {
    baseScore?: number;
    enemyKill?: number;
    bossBonus?: number;
    hitPenalty?: number;
    timeBonus?: {
        threshold: number;
        perSecond: number;
    };
    objectiveBonus?: number;
}

export interface Mission {
    id: string;
    name: string;
    mode: string;
    description?: string;
    objectives: MissionObjective[];
    scoring: MissionScoring;
    rewards: Record<string, unknown>;
}

export interface MissionConfig {
    list: Mission[];
    default?: string;
}

export interface RunTelemetry {
    startTime?: number;
    endTime?: number;
    durationSeconds?: number;
    enemyKills?: number;
    bossDefeated?: boolean;
    damageTaken?: number;
    abilitiesUsed?: { [key: string]: number };
    livesLost?: number;
    playerDefeated?: boolean;
    flags?: Record<string, unknown>;
}

export interface ObjectiveResult {
    id: string;
    label: string;
    completed: boolean;
    required?: number;
    progress?: number;
    metric?: number;
    target?: number;
}

export interface RunSummary {
    id: string;
    missionId: string;
    missionName: string;
    mode: string;
    outcome: string;
    reason: string | null;
    callsign?: string;
    score: number;
    startTime: number | null;
    endTime: number | null;
    durationSeconds: number;
    enemyKills: number;
    bossDefeated: boolean;
    damageTaken: number;
    abilitiesUsed?: { [key: string]: number };
    livesLost?: number;
    objectiveResults: ObjectiveResult[];
    rewards: Record<string, unknown>;
    flags: Record<string, unknown>;
    timestamp: number;
}

export class MissionService {
    private readonly _missions: Map<string, Mission> = new Map();
    private _defaultId: string | null = null;

    configure(config: Partial<MissionConfig> = {}): void {
        const list = Array.isArray(config.list) ? config.list : [];
        this._missions.clear();

        list.forEach(entry => {
            if (!entry || !entry.id) {
                return;
            }
            const normalized: Mission = {
                id: entry.id,
                name: entry.name,
                mode: entry.mode,
                description: entry.description,
                objectives: Array.isArray(entry.objectives) ? entry.objectives.map(obj => ({ ...obj })) : [],
                scoring: { ...entry.scoring },
                rewards: { ...(entry.rewards || {}) }
            };
            this._missions.set(entry.id, normalized);
        });

        if (this._missions.size === 0) {
            this._defaultId = null;
            return;
        }

        const configuredDefault = config.default && this._missions.has(config.default)
            ? config.default
            : null;
        this._defaultId = configuredDefault || list[0].id;
    }

    getAll(): Mission[] {
        return Array.from(this._missions.values());
    }

    getById(id: string): Mission | null {
        return id ? this._missions.get(id) || null : null;
    }

    getDefault(): Mission | null {
        return this._defaultId ? this._missions.get(this._defaultId) || null : null;
    }

    resolveMission(params: { missionId?: string, mode?: string } = {}): Mission | null {
        const explicit = params.missionId ? this.getById(params.missionId) : null;
        if (explicit) {
            return explicit;
        }

        if (params.mode) {
            const match = this.getAll().find(mission => mission.mode === params.mode);
            if (match) {
                return match;
            }
        }

        return this.getDefault();
    }

    evaluateObjectives(mission: Mission, telemetry: RunTelemetry = {}): ObjectiveResult[] {
        if (!mission) {
            return [];
        }

        const objectives = Array.isArray(mission.objectives) ? mission.objectives : [];
        return objectives.map(objective => this._evaluateObjective(objective, telemetry));
    }

    calculateScore(mission: Mission, telemetry: RunTelemetry = {}, objectiveResults: ObjectiveResult[] | null = null): number {
        if (!mission) {
            return 0;
        }

        const scoring = mission.scoring || {};
        let score = scoring.baseScore || 0;

        if (scoring.enemyKill && telemetry.enemyKills) {
            score += scoring.enemyKill * telemetry.enemyKills;
        }

        if (scoring.bossBonus && telemetry.bossDefeated) {
            score += scoring.bossBonus;
        }

        const hitPenalty = scoring.hitPenalty || 0;
        if (hitPenalty && telemetry.damageTaken) {
            score -= hitPenalty * Math.round(telemetry.damageTaken / 10);
        }

        const timeBonus = scoring.timeBonus;
        if (timeBonus && timeBonus.threshold && timeBonus.perSecond && telemetry.durationSeconds) {
            const delta = Math.max(0, timeBonus.threshold - telemetry.durationSeconds);
            score += delta * timeBonus.perSecond;
        }

        const objectives = objectiveResults || this.evaluateObjectives(mission, telemetry);
        const fulfilled = objectives.filter(obj => obj.completed);
        if (fulfilled.length && scoring.objectiveBonus) {
            score += fulfilled.length * scoring.objectiveBonus;
        }

        return Math.max(0, Math.round(score));
    }

    buildRunSummary({ mission, telemetry = {}, outcome = 'complete', reason = null, timestamp = Date.now() }: { mission: Mission, telemetry: RunTelemetry, outcome?: string, reason?: string | null, timestamp?: number }): RunSummary | null {
        if (!mission) {
            return null;
        }

        const objectiveResults = this.evaluateObjectives(mission, telemetry);
        const score = this.calculateScore(mission, telemetry, objectiveResults);

        return {
            id: `${mission.id}:${timestamp}`,
            missionId: mission.id,
            missionName: mission.name,
            mode: mission.mode,
            outcome,
            reason,
            score,
            startTime: telemetry.startTime || null,
            endTime: telemetry.endTime || null,
            durationSeconds: telemetry.durationSeconds || 0,
            enemyKills: telemetry.enemyKills || 0,
            bossDefeated: !!telemetry.bossDefeated,
            damageTaken: telemetry.damageTaken || 0,
            abilitiesUsed: telemetry.abilitiesUsed || {},
            livesLost: telemetry.livesLost || 0,
            objectiveResults,
            rewards: mission.rewards || {},
            flags: telemetry.flags || {},
            timestamp
        };
    }

    private _evaluateObjective(objective: MissionObjective, telemetry: RunTelemetry): ObjectiveResult {
        const base: ObjectiveResult = {
            id: objective.id || objective.type,
            label: objective.label || this._labelForObjective(objective),
            completed: false
        };

        switch (objective.type) {
            case 'eliminate': {
                const required = objective.count || 0;
                const progress = telemetry.enemyKills || 0;
                base.required = required;
                base.progress = progress;
                base.completed = progress >= required && required > 0;
                break;
            }
            case 'defeatBoss': {
                base.completed = !!telemetry.bossDefeated;
                break;
            }
            case 'timeUnder': {
                const target = objective.seconds || 0;
                const duration = telemetry.durationSeconds || Infinity;
                base.metric = duration;
                base.target = target;
                base.completed = duration <= target && duration > 0;
                break;
            }
            case 'survive': {
                const target = objective.seconds || 0;
                const duration = telemetry.durationSeconds || 0;
                base.metric = duration;
                base.target = target;
                base.completed = duration >= target && !telemetry.playerDefeated;
                break;
            }
            case 'damageUnder': {
                const amount = objective.amount || 0;
                const damage = telemetry.damageTaken || Infinity;
                base.metric = damage;
                base.target = amount;
                base.completed = damage <= amount;
                break;
            }
            default: {
                base.completed = false;
                break;
            }
        }

        return base;
    }

    private _labelForObjective(objective: MissionObjective): string {
        switch (objective.type) {
            case 'eliminate':
                return 'Eliminate hostiles';
            case 'defeatBoss':
                return 'Defeat boss';
            case 'timeUnder':
                return 'Beat the clock';
            case 'survive':
                return 'Survive';
            case 'damageUnder':
                return 'Minimise damage';
            default:
                return 'Objective';
        }
    }
}
