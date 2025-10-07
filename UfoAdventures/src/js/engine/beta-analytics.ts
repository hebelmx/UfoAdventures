import { EventBus } from './event-bus';
import { BetaAnalytics, BetaFeedback } from './beta-feedback-system';

export interface AnalyticsEvent {
    type: string;
    data: Record<string, unknown>;
    timestamp: number;
    sessionId: string;
}

export interface PerformanceAlert {
    type: 'fps-drop' | 'memory-warning' | 'frame-time-spike' | 'error-rate-high';
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    data: Record<string, unknown>;
    timestamp: number;
}

export interface UserSession {
    sessionId: string;
    startTime: number;
    endTime?: number;
    duration: number;
    scenesVisited: string[];
    deaths: number;
    enemiesKilled: number;
    abilitiesUsed: Record<string, number>;
    weaponsUsed: Record<string, number>;
    performanceMetrics: {
        averageFps: number;
        minFps: number;
        maxFps: number;
        averageMemoryUsage: number;
        maxMemoryUsage: number;
        errorCount: number;
    };
    feedbackSubmitted: number;
    completionRate: number;
    satisfactionScore?: number;
}

export class BetaAnalytics {
    private readonly eventBus: EventBus | null;
    private readonly sessionId: string;
    private events: AnalyticsEvent[] = [];
    private performanceAlerts: PerformanceAlert[] = [];
    private userSessions: Map<string, UserSession> = new Map();
    private isEnabled: boolean = false;
    private batchSize: number = 50;
    private flushInterval: number = 30000; // 30 seconds
    private flushTimer: number | null = null;

    constructor(eventBus: EventBus | null) {
        this.eventBus = eventBus;
        this.sessionId = this.generateSessionId();
        this.setupEventListeners();
        this.startFlushTimer();
    }

    enable(): void {
        this.isEnabled = true;
        console.log('Beta Analytics enabled');
        this.eventBus?.emit('analytics:enabled', { sessionId: this.sessionId });
    }

    disable(): void {
        this.isEnabled = false;
        console.log('Beta Analytics disabled');
        this.eventBus?.emit('analytics:disabled', { sessionId: this.sessionId });
    }

    trackEvent(type: string, data: Record<string, unknown> = {}): void {
        if (!this.isEnabled) return;

        const event: AnalyticsEvent = {
            type,
            data,
            timestamp: Date.now(),
            sessionId: this.sessionId
        };

        this.events.push(event);
        this.eventBus?.emit('analytics:event-tracked', event);

        // Check for batch flush
        if (this.events.length >= this.batchSize) {
            this.flushEvents();
        }
    }

    trackPerformanceAlert(alert: PerformanceAlert): void {
        if (!this.isEnabled) return;

        this.performanceAlerts.push(alert);
        this.eventBus?.emit('analytics:performance-alert', alert);

        // Log critical alerts
        if (alert.severity === 'critical') {
            console.error('Critical performance alert:', alert);
        }
    }

    trackUserSession(session: UserSession): void {
        this.userSessions.set(session.sessionId, session);
        this.eventBus?.emit('analytics:session-tracked', session);
    }

    getAnalyticsSummary(): {
        totalEvents: number;
        totalSessions: number;
        averageSessionDuration: number;
        performanceAlerts: number;
        criticalAlerts: number;
        topAbilities: Array<{ ability: string; count: number }>;
        topWeapons: Array<{ weapon: string; count: number }>;
        averageFps: number;
        averageMemoryUsage: number;
    } {
        const sessions = Array.from(this.userSessions.values());
        const totalSessions = sessions.length;
        const averageSessionDuration = totalSessions > 0 
            ? sessions.reduce((sum, s) => sum + s.duration, 0) / totalSessions 
            : 0;

        const allAbilities: Record<string, number> = {};
        const allWeapons: Record<string, number> = {};
        let totalFps = 0;
        let totalMemory = 0;
        let fpsCount = 0;
        let memoryCount = 0;

        sessions.forEach(session => {
            Object.entries(session.abilitiesUsed).forEach(([ability, count]) => {
                allAbilities[ability] = (allAbilities[ability] || 0) + count;
            });
            Object.entries(session.weaponsUsed).forEach(([weapon, count]) => {
                allWeapons[weapon] = (allWeapons[weapon] || 0) + count;
            });
            totalFps += session.performanceMetrics.averageFps;
            totalMemory += session.performanceMetrics.averageMemoryUsage;
            fpsCount++;
            memoryCount++;
        });

        const topAbilities = Object.entries(allAbilities)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
            .map(([ability, count]) => ({ ability, count }));

        const topWeapons = Object.entries(allWeapons)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
            .map(([weapon, count]) => ({ weapon, count }));

        const criticalAlerts = this.performanceAlerts.filter(a => a.severity === 'critical').length;

        return {
            totalEvents: this.events.length,
            totalSessions,
            averageSessionDuration,
            performanceAlerts: this.performanceAlerts.length,
            criticalAlerts,
            topAbilities,
            topWeapons,
            averageFps: fpsCount > 0 ? totalFps / fpsCount : 0,
            averageMemoryUsage: memoryCount > 0 ? totalMemory / memoryCount : 0
        };
    }

    getPerformanceReport(): {
        averageFps: number;
        minFps: number;
        maxFps: number;
        averageMemoryUsage: number;
        maxMemoryUsage: number;
        errorRate: number;
        alerts: PerformanceAlert[];
    } {
        const sessions = Array.from(this.userSessions.values());
        if (sessions.length === 0) {
            return {
                averageFps: 0,
                minFps: 0,
                maxFps: 0,
                averageMemoryUsage: 0,
                maxMemoryUsage: 0,
                errorRate: 0,
                alerts: []
            };
        }

        const fpsValues = sessions.map(s => s.performanceMetrics.averageFps);
        const memoryValues = sessions.map(s => s.performanceMetrics.averageMemoryUsage);
        const errorCounts = sessions.map(s => s.performanceMetrics.errorCount);

        return {
            averageFps: fpsValues.reduce((sum, fps) => sum + fps, 0) / fpsValues.length,
            minFps: Math.min(...fpsValues),
            maxFps: Math.max(...fpsValues),
            averageMemoryUsage: memoryValues.reduce((sum, mem) => sum + mem, 0) / memoryValues.length,
            maxMemoryUsage: Math.max(...memoryValues),
            errorRate: errorCounts.reduce((sum, errors) => sum + errors, 0) / sessions.length,
            alerts: [...this.performanceAlerts]
        };
    }

    getUserBehaviorReport(): {
        mostVisitedScenes: Array<{ scene: string; visits: number }>;
        averageDeathsPerSession: number;
        averageEnemiesKilledPerSession: number;
        completionRate: number;
        satisfactionScore: number;
    } {
        const sessions = Array.from(this.userSessions.values());
        if (sessions.length === 0) {
            return {
                mostVisitedScenes: [],
                averageDeathsPerSession: 0,
                averageEnemiesKilledPerSession: 0,
                completionRate: 0,
                satisfactionScore: 0
            };
        }

        const sceneVisits: Record<string, number> = {};
        let totalDeaths = 0;
        let totalEnemiesKilled = 0;
        let totalCompletionRate = 0;
        let totalSatisfactionScore = 0;
        let satisfactionCount = 0;

        sessions.forEach(session => {
            session.scenesVisited.forEach(scene => {
                sceneVisits[scene] = (sceneVisits[scene] || 0) + 1;
            });
            totalDeaths += session.deaths;
            totalEnemiesKilled += session.enemiesKilled;
            totalCompletionRate += session.completionRate;
            if (session.satisfactionScore !== undefined) {
                totalSatisfactionScore += session.satisfactionScore;
                satisfactionCount++;
            }
        });

        const mostVisitedScenes = Object.entries(sceneVisits)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 10)
            .map(([scene, visits]) => ({ scene, visits }));

        return {
            mostVisitedScenes,
            averageDeathsPerSession: totalDeaths / sessions.length,
            averageEnemiesKilledPerSession: totalEnemiesKilled / sessions.length,
            completionRate: totalCompletionRate / sessions.length,
            satisfactionScore: satisfactionCount > 0 ? totalSatisfactionScore / satisfactionCount : 0
        };
    }

    exportData(): {
        events: AnalyticsEvent[];
        performanceAlerts: PerformanceAlert[];
        userSessions: UserSession[];
        summary: ReturnType<typeof this.getAnalyticsSummary>;
        performanceReport: ReturnType<typeof this.getPerformanceReport>;
        behaviorReport: ReturnType<typeof this.getUserBehaviorReport>;
        exportTimestamp: number;
    } {
        return {
            events: [...this.events],
            performanceAlerts: [...this.performanceAlerts],
            userSessions: Array.from(this.userSessions.values()),
            summary: this.getAnalyticsSummary(),
            performanceReport: this.getPerformanceReport(),
            behaviorReport: this.getUserBehaviorReport(),
            exportTimestamp: Date.now()
        };
    }

    clearData(): void {
        this.events = [];
        this.performanceAlerts = [];
        this.userSessions.clear();
        console.log('Analytics data cleared');
    }

    private setupEventListeners(): void {
        if (!this.eventBus) return;

        // Listen for game events
        this.eventBus.on('combat:damage', (event) => {
            this.trackEvent('combat-damage', event);
        });

        this.eventBus.on('combat:enemy-defeated', (event) => {
            this.trackEvent('enemy-defeated', event);
        });

        this.eventBus.on('ability:used', (event) => {
            this.trackEvent('ability-used', event);
        });

        this.eventBus.on('scene:changed', (event) => {
            this.trackEvent('scene-changed', event);
        });

        this.eventBus.on('player:death', (event) => {
            this.trackEvent('player-death', event);
        });

        this.eventBus.on('game:session-start', (event) => {
            this.trackEvent('session-start', event);
        });

        this.eventBus.on('game:session-end', (event) => {
            this.trackEvent('session-end', event);
        });

        // Listen for performance events
        this.eventBus.on('performance:frame-drop', (event) => {
            this.trackPerformanceAlert({
                type: 'fps-drop',
                severity: event.fps < 20 ? 'critical' : event.fps < 30 ? 'high' : 'medium',
                message: `Frame rate dropped to ${event.fps} FPS`,
                data: event,
                timestamp: Date.now()
            });
        });

        this.eventBus.on('performance:memory-warning', (event) => {
            this.trackPerformanceAlert({
                type: 'memory-warning',
                severity: event.memoryUsage > 200 ? 'critical' : 'high',
                message: `Memory usage high: ${event.memoryUsage}MB`,
                data: event,
                timestamp: Date.now()
            });
        });

        this.eventBus.on('error:javascript', (event) => {
            this.trackPerformanceAlert({
                type: 'error-rate-high',
                severity: 'medium',
                message: `JavaScript error: ${event.message}`,
                data: event,
                timestamp: Date.now()
            });
        });
    }

    private startFlushTimer(): void {
        this.flushTimer = window.setInterval(() => {
            if (this.events.length > 0) {
                this.flushEvents();
            }
        }, this.flushInterval);
    }

    private async flushEvents(): Promise<void> {
        if (this.events.length === 0) return;

        const eventsToFlush = this.events.splice(0, this.batchSize);
        
        try {
            await this.sendEventsToServer(eventsToFlush);
            console.log(`Flushed ${eventsToFlush.length} analytics events`);
        } catch (error) {
            console.warn('Failed to flush analytics events:', error);
            // Re-add events to queue for retry
            this.events.unshift(...eventsToFlush);
        }
    }

    private async sendEventsToServer(events: AnalyticsEvent[]): Promise<void> {
        const response = await fetch('/api/analytics', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                sessionId: this.sessionId,
                events,
                timestamp: Date.now()
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
    }

    private generateSessionId(): string {
        return `analytics-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    destroy(): void {
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
            this.flushTimer = null;
        }
        
        // Flush remaining events
        if (this.events.length > 0) {
            this.flushEvents();
        }
    }
}
