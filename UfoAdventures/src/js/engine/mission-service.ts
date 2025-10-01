class MissionService {
    constructor() {
        this._missions = new Map();
        this._defaultId = null;
    }

    configure(config = {}) {
        const list = Array.isArray(config.list) ? config.list : [];
        this._missions.clear();

        list.forEach(entry => {
            if (!entry || !entry.id) {
                return;
            }
            const normalized = Object.assign({}, entry);
            normalized.objectives = Array.isArray(entry.objectives) ? entry.objectives.map(obj => Object.assign({}, obj)) : [];
            normalized.scoring = Object.assign({}, entry.scoring);
            normalized.rewards = Object.assign({}, entry.rewards);
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

    getAll() {
        return Array.from(this._missions.values());
    }

    getById(id) {
        return id ? this._missions.get(id) || null : null;
    }

    getDefault() {
        return this._defaultId ? this._missions.get(this._defaultId) || null : null;
    }

    resolveMission(params = {}) {
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

    evaluateObjectives(mission, telemetry = {}) {
        if (!mission) {
            return [];
        }

        const objectives = Array.isArray(mission.objectives) ? mission.objectives : [];
        return objectives.map(objective => this._evaluateObjective(objective, telemetry));
    }

    calculateScore(mission, telemetry = {}, objectiveResults = null) {
        if (!mission) {
            return 0;
        }

        const scoring = mission.scoring || {};
        let score = Number.isFinite(scoring.baseScore) ? scoring.baseScore : 0;

        if (Number.isFinite(scoring.enemyKill) && Number.isFinite(telemetry.enemyKills)) {
            score += scoring.enemyKill * telemetry.enemyKills;
        }

        if (Number.isFinite(scoring.bossBonus) && telemetry.bossDefeated) {
            score += scoring.bossBonus;
        }

        const hitPenalty = Number.isFinite(scoring.hitPenalty) ? scoring.hitPenalty : 0;
        if (hitPenalty && Number.isFinite(telemetry.damageTaken)) {
            score -= hitPenalty * Math.round(telemetry.damageTaken / 10);
        }

        const timeBonus = scoring.timeBonus || null;
        if (timeBonus && Number.isFinite(timeBonus.threshold) && Number.isFinite(timeBonus.perSecond) && Number.isFinite(telemetry.durationSeconds)) {
            const delta = Math.max(0, timeBonus.threshold - telemetry.durationSeconds);
            score += delta * timeBonus.perSecond;
        }

        const objectives = Array.isArray(objectiveResults) ? objectiveResults : this.evaluateObjectives(mission, telemetry);
        const fulfilled = objectives.filter(obj => obj.completed);
        if (fulfilled.length && Number.isFinite(scoring.objectiveBonus)) {
            score += fulfilled.length * scoring.objectiveBonus;
        }

        return Math.max(0, Math.round(score));
    }

    buildRunSummary({ mission, telemetry = {}, outcome = 'complete', reason = null, timestamp = Date.now() }) {
        if (!mission) {
            return null;
        }

        const objectiveResults = this.evaluateObjectives(mission, telemetry);
        const score = this.calculateScore(mission, telemetry, objectiveResults);

        return {
            id: mission.id + ':' + timestamp,
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

    _evaluateObjective(objective = {}, telemetry = {}) {
        const base = {
            id: objective.id || objective.type || 'objective',
            label: objective.label || this._labelForObjective(objective),
            completed: false
        };

        switch (objective.type) {
            case 'eliminate': {
                const required = Number.isFinite(objective.count) ? objective.count : 0;
                const progress = Number.isFinite(telemetry.enemyKills) ? telemetry.enemyKills : 0;
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
                const target = Number.isFinite(objective.seconds) ? objective.seconds : 0;
                const duration = Number.isFinite(telemetry.durationSeconds) ? telemetry.durationSeconds : Infinity;
                base.metric = duration;
                base.target = target;
                base.completed = duration <= target && duration > 0;
                break;
            }
            case 'survive': {
                const target = Number.isFinite(objective.seconds) ? objective.seconds : 0;
                const duration = Number.isFinite(telemetry.durationSeconds) ? telemetry.durationSeconds : 0;
                base.metric = duration;
                base.target = target;
                base.completed = duration >= target && !telemetry.playerDefeated;
                break;
            }
            case 'damageUnder': {
                const amount = Number.isFinite(objective.amount) ? objective.amount : 0;
                const damage = Number.isFinite(telemetry.damageTaken) ? telemetry.damageTaken : Infinity;
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

    _labelForObjective(objective = {}) {
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

window.MissionService = MissionService;

