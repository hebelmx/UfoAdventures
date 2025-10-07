import { EventBus } from './event-bus';
import { SaveService } from './save-service';

export interface BetaFeedback {
    id: string;
    category: 'bug' | 'suggestion' | 'balance' | 'performance' | 'ui' | 'audio' | 'other';
    severity: 'low' | 'medium' | 'high' | 'critical';
    title: string;
    description: string;
    stepsToReproduce?: string;
    expectedBehavior?: string;
    actualBehavior?: string;
    browserInfo: BrowserInfo;
    gameState: GameState;
    timestamp: number;
    sessionId: string;
    playerId?: string;
}

export interface BrowserInfo {
    userAgent: string;
    platform: string;
    language: string;
    screenResolution: string;
    viewportSize: string;
    timezone: string;
}

export interface GameState {
    currentScene: string;
    gameMode: string;
    difficulty: string;
    playerHealth: number;
    playerMana: number;
    currentWeapon: string;
    activeAbilities: string[];
    performanceMetrics: PerformanceMetrics;
}

export interface PerformanceMetrics {
    fps: number;
    frameTime: number;
    memoryUsage: number;
    entitiesCount: number;
    systemsCount: number;
}

export interface BetaAnalytics {
    sessionId: string;
    startTime: number;
    endTime?: number;
    duration: number;
    scenesVisited: string[];
    deaths: number;
    enemiesKilled: number;
    abilitiesUsed: Record<string, number>;
    weaponsUsed: Record<string, number>;
    performanceHistory: PerformanceMetrics[];
    errors: string[];
    feedbackSubmitted: number;
}

export class BetaFeedbackSystem {
    private readonly eventBus: EventBus | null;
    private readonly saveService: SaveService | null;
    private readonly sessionId: string;
    private readonly playerId: string;
    private analytics: BetaAnalytics;
    private feedbackQueue: BetaFeedback[] = [];
    private isEnabled: boolean = false;
    private performanceMonitor: PerformanceMonitor | null = null;

    constructor(eventBus: EventBus | null, saveService: SaveService | null) {
        this.eventBus = eventBus;
        this.saveService = saveService;
        this.sessionId = this.generateSessionId();
        this.playerId = this.getOrCreatePlayerId();
        this.analytics = this.initializeAnalytics();
        this.performanceMonitor = new PerformanceMonitor();
        
        this.setupEventListeners();
        this.setupKeyboardShortcuts();
        this.startPerformanceMonitoring();
    }

    enable(): void {
        this.isEnabled = true;
        console.log('Beta Feedback System enabled');
        this.eventBus?.emit('beta:feedback-enabled', { sessionId: this.sessionId });
    }

    disable(): void {
        this.isEnabled = false;
        console.log('Beta Feedback System disabled');
        this.eventBus?.emit('beta:feedback-disabled', { sessionId: this.sessionId });
    }

    submitFeedback(feedback: Omit<BetaFeedback, 'id' | 'browserInfo' | 'gameState' | 'timestamp' | 'sessionId' | 'playerId'>): void {
        if (!this.isEnabled) {
            console.warn('Beta Feedback System is not enabled');
            return;
        }

        const fullFeedback: BetaFeedback = {
            ...feedback,
            id: this.generateFeedbackId(),
            browserInfo: this.getBrowserInfo(),
            gameState: this.getCurrentGameState(),
            timestamp: Date.now(),
            sessionId: this.sessionId,
            playerId: this.playerId
        };

        this.feedbackQueue.push(fullFeedback);
        this.analytics.feedbackSubmitted++;

        // Emit event for immediate processing
        this.eventBus?.emit('beta:feedback-submitted', fullFeedback);

        // Try to send immediately
        this.sendFeedback(fullFeedback);

        console.log('Beta feedback submitted:', fullFeedback.id);
    }

    reportBug(title: string, description: string, severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'): void {
        this.submitFeedback({
            category: 'bug',
            severity,
            title,
            description
        });
    }

    reportPerformanceIssue(description: string, severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'): void {
        this.submitFeedback({
            category: 'performance',
            severity,
            title: 'Performance Issue',
            description
        });
    }

    reportBalanceIssue(description: string, severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'): void {
        this.submitFeedback({
            category: 'balance',
            severity,
            title: 'Balance Issue',
            description
        });
    }

    submitSuggestion(title: string, description: string): void {
        this.submitFeedback({
            category: 'suggestion',
            severity: 'low',
            title,
            description
        });
    }

    trackEvent(eventType: string, data: Record<string, unknown> = {}): void {
        if (!this.isEnabled) return;

        this.eventBus?.emit('beta:event-tracked', {
            eventType,
            data,
            timestamp: Date.now(),
            sessionId: this.sessionId
        });
    }

    trackDeath(location: string, cause: string): void {
        this.analytics.deaths++;
        this.trackEvent('death', { location, cause });
    }

    trackEnemyKill(enemyType: string, weapon: string): void {
        this.analytics.enemiesKilled++;
        this.analytics.weaponsUsed[weapon] = (this.analytics.weaponsUsed[weapon] || 0) + 1;
        this.trackEvent('enemy-killed', { enemyType, weapon });
    }

    trackAbilityUsed(ability: string): void {
        this.analytics.abilitiesUsed[ability] = (this.analytics.abilitiesUsed[ability] || 0) + 1;
        this.trackEvent('ability-used', { ability });
    }

    trackSceneChange(scene: string): void {
        if (!this.analytics.scenesVisited.includes(scene)) {
            this.analytics.scenesVisited.push(scene);
        }
        this.trackEvent('scene-change', { scene });
    }

    trackError(error: Error, context: string = ''): void {
        const errorInfo = {
            message: error.message,
            stack: error.stack,
            context,
            timestamp: Date.now()
        };
        
        this.analytics.errors.push(JSON.stringify(errorInfo));
        this.trackEvent('error', errorInfo);
    }

    getAnalytics(): BetaAnalytics {
        return { ...this.analytics };
    }

    getFeedbackQueue(): BetaFeedback[] {
        return [...this.feedbackQueue];
    }

    clearFeedbackQueue(): void {
        this.feedbackQueue = [];
    }

    private setupEventListeners(): void {
        if (!this.eventBus) return;

        // Listen for game events to track analytics
        this.eventBus.on('combat:damage', (event) => {
            if (event.target === 'player') {
                this.trackEvent('player-damaged', event);
            }
        });

        this.eventBus.on('combat:enemy-defeated', (event) => {
            this.trackEnemyKill(event.enemyType, event.weapon || 'unknown');
        });

        this.eventBus.on('ability:used', (event) => {
            this.trackAbilityUsed(event.ability);
        });

        this.eventBus.on('scene:changed', (event) => {
            this.trackSceneChange(event.scene);
        });

        // Listen for performance issues
        this.eventBus.on('performance:frame-drop', (event) => {
            this.reportPerformanceIssue(`Frame drop detected: ${event.fps} FPS`, 'medium');
        });

        this.eventBus.on('performance:memory-warning', (event) => {
            this.reportPerformanceIssue(`Memory usage high: ${event.memoryUsage}MB`, 'high');
        });
    }

    private setupKeyboardShortcuts(): void {
        document.addEventListener('keydown', (event) => {
            if (!this.isEnabled) return;

            // F1 - Open feedback form
            if (event.key === 'F1') {
                event.preventDefault();
                this.openFeedbackForm();
            }

            // F2 - Quick bug report
            if (event.key === 'F2') {
                event.preventDefault();
                this.openQuickBugReport();
            }

            // F3 - Performance report
            if (event.key === 'F3') {
                event.preventDefault();
                this.openPerformanceReport();
            }
        });
    }

    private startPerformanceMonitoring(): void {
        if (!this.performanceMonitor) return;

        setInterval(() => {
            const metrics = this.performanceMonitor!.getMetrics();
            this.analytics.performanceHistory.push(metrics);

            // Keep only last 100 performance samples
            if (this.analytics.performanceHistory.length > 100) {
                this.analytics.performanceHistory.shift();
            }

            // Check for performance issues
            if (metrics.fps < 30) {
                this.eventBus?.emit('performance:frame-drop', { fps: metrics.fps });
            }

            if (metrics.memoryUsage > 100) { // 100MB threshold
                this.eventBus?.emit('performance:memory-warning', { memoryUsage: metrics.memoryUsage });
            }
        }, 1000); // Check every second
    }

    private openFeedbackForm(): void {
        // Create and show feedback form modal
        const modal = this.createFeedbackModal();
        document.body.appendChild(modal);
    }

    private openQuickBugReport(): void {
        const description = prompt('Quick bug report - describe the issue:');
        if (description) {
            this.reportBug('Quick Bug Report', description);
        }
    }

    private openPerformanceReport(): void {
        const metrics = this.performanceMonitor?.getMetrics();
        const description = `Current performance: ${metrics?.fps} FPS, ${metrics?.memoryUsage}MB memory`;
        this.reportPerformanceIssue(description);
    }

    private createFeedbackModal(): HTMLElement {
        const modal = document.createElement('div');
        modal.className = 'beta-feedback-modal';
        modal.innerHTML = `
            <div class="beta-feedback-content">
                <h3>Beta Feedback</h3>
                <form id="beta-feedback-form">
                    <div class="form-group">
                        <label for="feedback-category">Category:</label>
                        <select id="feedback-category" required>
                            <option value="bug">Bug Report</option>
                            <option value="suggestion">Suggestion</option>
                            <option value="balance">Balance Issue</option>
                            <option value="performance">Performance</option>
                            <option value="ui">UI/UX</option>
                            <option value="audio">Audio</option>
                            <option value="other">Other</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="feedback-severity">Severity:</label>
                        <select id="feedback-severity" required>
                            <option value="low">Low</option>
                            <option value="medium" selected>Medium</option>
                            <option value="high">High</option>
                            <option value="critical">Critical</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="feedback-title">Title:</label>
                        <input type="text" id="feedback-title" required>
                    </div>
                    <div class="form-group">
                        <label for="feedback-description">Description:</label>
                        <textarea id="feedback-description" rows="4" required></textarea>
                    </div>
                    <div class="form-group">
                        <label for="feedback-steps">Steps to Reproduce (optional):</label>
                        <textarea id="feedback-steps" rows="3"></textarea>
                    </div>
                    <div class="form-actions">
                        <button type="submit">Submit Feedback</button>
                        <button type="button" id="cancel-feedback">Cancel</button>
                    </div>
                </form>
            </div>
        `;

        // Add event listeners
        modal.querySelector('#beta-feedback-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleFeedbackFormSubmit(modal);
        });

        modal.querySelector('#cancel-feedback')?.addEventListener('click', () => {
            document.body.removeChild(modal);
        });

        return modal;
    }

    private handleFeedbackFormSubmit(modal: HTMLElement): void {
        const form = modal.querySelector('#beta-feedback-form') as HTMLFormElement;
        const formData = new FormData(form);

        this.submitFeedback({
            category: formData.get('feedback-category') as any,
            severity: formData.get('feedback-severity') as any,
            title: formData.get('feedback-title') as string,
            description: formData.get('feedback-description') as string,
            stepsToReproduce: formData.get('feedback-steps') as string || undefined
        });

        document.body.removeChild(modal);
    }

    private sendFeedback(feedback: BetaFeedback): void {
        // Try to send via save service first
        if (this.saveService) {
            this.saveService.save(`beta-feedback-${feedback.id}`, feedback)
                .catch(error => {
                    console.warn('Failed to save feedback locally:', error);
                    this.sendFeedbackToServer(feedback);
                });
        } else {
            this.sendFeedbackToServer(feedback);
        }
    }

    private async sendFeedbackToServer(feedback: BetaFeedback): Promise<void> {
        try {
            const response = await fetch('/api/beta-feedback', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(feedback)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            console.log('Feedback sent to server successfully');
        } catch (error) {
            console.warn('Failed to send feedback to server:', error);
            // Keep in queue for retry
        }
    }

    private generateSessionId(): string {
        return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    private generateFeedbackId(): string {
        return `feedback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    private getOrCreatePlayerId(): string {
        let playerId = localStorage.getItem('ufo-adventures-player-id');
        if (!playerId) {
            playerId = `player-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            localStorage.setItem('ufo-adventures-player-id', playerId);
        }
        return playerId;
    }

    private initializeAnalytics(): BetaAnalytics {
        return {
            sessionId: this.sessionId,
            startTime: Date.now(),
            duration: 0,
            scenesVisited: [],
            deaths: 0,
            enemiesKilled: 0,
            abilitiesUsed: {},
            weaponsUsed: {},
            performanceHistory: [],
            errors: [],
            feedbackSubmitted: 0
        };
    }

    private getBrowserInfo(): BrowserInfo {
        return {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            language: navigator.language,
            screenResolution: `${screen.width}x${screen.height}`,
            viewportSize: `${window.innerWidth}x${window.innerHeight}`,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        };
    }

    private getCurrentGameState(): GameState {
        // This would be populated by the game runtime
        return {
            currentScene: 'unknown',
            gameMode: 'unknown',
            difficulty: 'unknown',
            playerHealth: 0,
            playerMana: 0,
            currentWeapon: 'unknown',
            activeAbilities: [],
            performanceMetrics: this.performanceMonitor?.getMetrics() || {
                fps: 0,
                frameTime: 0,
                memoryUsage: 0,
                entitiesCount: 0,
                systemsCount: 0
            }
        };
    }
}

class PerformanceMonitor {
    private lastFrameTime: number = 0;
    private frameCount: number = 0;
    private fps: number = 0;

    getMetrics(): PerformanceMetrics {
        const now = performance.now();
        const frameTime = now - this.lastFrameTime;
        this.lastFrameTime = now;
        this.frameCount++;

        // Calculate FPS every 60 frames
        if (this.frameCount % 60 === 0) {
            this.fps = Math.round(1000 / frameTime);
        }

        return {
            fps: this.fps,
            frameTime: frameTime,
            memoryUsage: this.getMemoryUsage(),
            entitiesCount: 0, // Would be populated by game runtime
            systemsCount: 0   // Would be populated by game runtime
        };
    }

    private getMemoryUsage(): number {
        if ('memory' in performance) {
            return Math.round((performance as any).memory.usedJSHeapSize / 1024 / 1024);
        }
        return 0;
    }
}
