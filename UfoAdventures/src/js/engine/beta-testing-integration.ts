import { EventBus } from './event-bus';
import { SaveService } from './save-service';
import { BetaFeedbackSystem } from './beta-feedback-system';
import { BetaAnalytics } from './beta-analytics';
import { PerformanceProfiler } from './performance-profiler';

export interface BetaTestingConfig {
    enabled: boolean;
    feedbackEnabled: boolean;
    analyticsEnabled: boolean;
    performanceMonitoring: boolean;
    autoReportErrors: boolean;
    autoReportPerformance: boolean;
    feedbackEndpoint?: string;
    analyticsEndpoint?: string;
    sessionTimeout: number;
    maxEventsPerSession: number;
}

export interface BetaTestingSession {
    sessionId: string;
    startTime: number;
    endTime?: number;
    duration: number;
    config: BetaTestingConfig;
    feedbackCount: number;
    analyticsEvents: number;
    performanceAlerts: number;
    errors: number;
}

export class BetaTestingIntegration {
    private readonly eventBus: EventBus | null;
    private readonly saveService: SaveService | null;
    private readonly performanceProfiler: PerformanceProfiler | null;
    private feedbackSystem: BetaFeedbackSystem | null = null;
    private analytics: BetaAnalytics | null = null;
    private config: BetaTestingConfig;
    private session: BetaTestingSession | null = null;
    private isInitialized: boolean = false;

    constructor(
        eventBus: EventBus | null,
        saveService: SaveService | null,
        performanceProfiler: PerformanceProfiler | null,
        config: Partial<BetaTestingConfig> = {}
    ) {
        this.eventBus = eventBus;
        this.saveService = saveService;
        this.performanceProfiler = performanceProfiler;
        this.config = this.mergeConfig(config);
    }

    async initialize(): Promise<void> {
        if (this.isInitialized) {
            console.warn('BetaTestingIntegration already initialized');
            return;
        }

        try {
            // Initialize feedback system
            if (this.config.feedbackEnabled) {
                this.feedbackSystem = new BetaFeedbackSystem(this.eventBus, this.saveService);
                this.feedbackSystem.enable();
            }

            // Initialize analytics
            if (this.config.analyticsEnabled) {
                this.analytics = new BetaAnalytics(this.eventBus);
                this.analytics.enable();
            }

            // Start new session
            this.startSession();

            // Setup global error handling
            this.setupGlobalErrorHandling();

            // Setup performance monitoring
            if (this.config.performanceMonitoring) {
                this.setupPerformanceMonitoring();
            }

            // Setup UI elements
            this.setupBetaUI();

            this.isInitialized = true;
            console.log('Beta Testing Integration initialized successfully');

            this.eventBus?.emit('beta:initialized', {
                sessionId: this.session?.sessionId,
                config: this.config
            });

        } catch (error) {
            console.error('Failed to initialize Beta Testing Integration:', error);
            throw error;
        }
    }

    destroy(): void {
        if (!this.isInitialized) return;

        try {
            // End current session
            this.endSession();

            // Cleanup systems
            if (this.feedbackSystem) {
                this.feedbackSystem.disable();
                this.feedbackSystem = null;
            }

            if (this.analytics) {
                this.analytics.disable();
                this.analytics.destroy();
                this.analytics = null;
            }

            // Remove UI elements
            this.removeBetaUI();

            this.isInitialized = false;
            console.log('Beta Testing Integration destroyed');

        } catch (error) {
            console.error('Error destroying Beta Testing Integration:', error);
        }
    }

    getFeedbackSystem(): BetaFeedbackSystem | null {
        return this.feedbackSystem;
    }

    getAnalytics(): BetaAnalytics | null {
        return this.analytics;
    }

    getSession(): BetaTestingSession | null {
        return this.session;
    }

    getConfig(): BetaTestingConfig {
        return { ...this.config };
    }

    updateConfig(newConfig: Partial<BetaTestingConfig>): void {
        this.config = this.mergeConfig(newConfig);
        
        // Update systems based on new config
        if (this.feedbackSystem) {
            if (this.config.feedbackEnabled) {
                this.feedbackSystem.enable();
            } else {
                this.feedbackSystem.disable();
            }
        }

        if (this.analytics) {
            if (this.config.analyticsEnabled) {
                this.analytics.enable();
            } else {
                this.analytics.disable();
            }
        }

        this.eventBus?.emit('beta:config-updated', this.config);
    }

    private startSession(): void {
        const sessionId = this.generateSessionId();
        this.session = {
            sessionId,
            startTime: Date.now(),
            duration: 0,
            config: this.config,
            feedbackCount: 0,
            analyticsEvents: 0,
            performanceAlerts: 0,
            errors: 0
        };

        // Set session timeout
        if (this.config.sessionTimeout > 0) {
            setTimeout(() => {
                this.endSession();
            }, this.config.sessionTimeout);
        }

        this.eventBus?.emit('beta:session-started', this.session);
    }

    private endSession(): void {
        if (!this.session) return;

        this.session.endTime = Date.now();
        this.session.duration = this.session.endTime - this.session.startTime;

        // Update session stats
        if (this.feedbackSystem) {
            this.session.feedbackCount = this.feedbackSystem.getFeedbackQueue().length;
        }

        if (this.analytics) {
            const summary = this.analytics.getAnalyticsSummary();
            this.session.analyticsEvents = summary.totalEvents;
            this.session.performanceAlerts = summary.performanceAlerts;
        }

        this.eventBus?.emit('beta:session-ended', this.session);

        // Save session data
        this.saveSessionData();

        this.session = null;
    }

    private setupGlobalErrorHandling(): void {
        // JavaScript errors
        window.addEventListener('error', (event) => {
            if (this.config.autoReportErrors) {
                this.reportError(event.error, 'JavaScript Error');
            }
            this.session && this.session.errors++;
        });

        // Unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            if (this.config.autoReportErrors) {
                this.reportError(new Error(event.reason), 'Unhandled Promise Rejection');
            }
            this.session && this.session.errors++;
        });

        // Game-specific errors
        this.eventBus?.on('error:game', (event) => {
            if (this.config.autoReportErrors) {
                this.reportError(new Error(event.message), 'Game Error');
            }
            this.session && this.session.errors++;
        });
    }

    private setupPerformanceMonitoring(): void {
        if (!this.performanceProfiler) return;

        // Monitor performance every 5 seconds
        setInterval(() => {
            const summary = this.performanceProfiler.getSummary();
            
            // Check for performance issues
            if (summary.metrics.length > 0) {
                const fpsMetric = summary.metrics.find(m => m.label === 'fps');
                if (fpsMetric && fpsMetric.average < 30) {
                    this.reportPerformanceIssue(`Low FPS: ${fpsMetric.average}`, 'high');
                }

                const frameTimeMetric = summary.metrics.find(m => m.label === 'frame (ms)');
                if (frameTimeMetric && frameTimeMetric.average > 33) { // 30 FPS threshold
                    this.reportPerformanceIssue(`High frame time: ${frameTimeMetric.average}ms`, 'medium');
                }
            }

            // Check for memory issues
            if (summary.measurements) {
                Object.entries(summary.measurements).forEach(([key, measurement]) => {
                    if (measurement.averageMs > 16) { // 60 FPS threshold
                        this.reportPerformanceIssue(`Slow system: ${key} (${measurement.averageMs}ms)`, 'medium');
                    }
                });
            }

        }, 5000);
    }

    private setupBetaUI(): void {
        // Add beta indicator
        const betaIndicator = document.createElement('div');
        betaIndicator.className = 'beta-indicator';
        betaIndicator.textContent = 'BETA TESTING';
        betaIndicator.id = 'beta-indicator';
        document.body.appendChild(betaIndicator);

        // Add hotkeys help
        const hotkeysHelp = document.createElement('div');
        hotkeysHelp.className = 'beta-hotkeys';
        hotkeysHelp.id = 'beta-hotkeys';
        hotkeysHelp.innerHTML = `
            <h4>Beta Testing Hotkeys</h4>
            <div class="hotkey">
                <span>F1</span>
                <span class="key">Feedback Form</span>
            </div>
            <div class="hotkey">
                <span>F2</span>
                <span class="key">Quick Bug Report</span>
            </div>
            <div class="hotkey">
                <span>F3</span>
                <span class="key">Performance Report</span>
            </div>
        `;
        document.body.appendChild(hotkeysHelp);

        // Add status bar
        const statusBar = document.createElement('div');
        statusBar.className = 'beta-status-bar';
        statusBar.id = 'beta-status-bar';
        statusBar.innerHTML = `
            <div class="status-item">
                <div class="status-indicator"></div>
                <span>Beta Testing Active</span>
            </div>
            <div class="status-item">
                <span>Session: ${this.session?.sessionId || 'Unknown'}</span>
            </div>
            <div class="status-item">
                <span>Feedback: ${this.session?.feedbackCount || 0}</span>
            </div>
        `;
        document.body.appendChild(statusBar);

        // Add CSS
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'src/css/beta-feedback.css';
        document.head.appendChild(link);
    }

    private removeBetaUI(): void {
        // Remove beta UI elements
        const elements = [
            'beta-indicator',
            'beta-hotkeys',
            'beta-status-bar'
        ];

        elements.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.remove();
            }
        });

        // Remove CSS
        const link = document.querySelector('link[href="src/css/beta-feedback.css"]');
        if (link) {
            link.remove();
        }
    }

    private reportError(error: Error, context: string): void {
        if (!this.feedbackSystem) return;

        this.feedbackSystem.reportBug(
            `${context}: ${error.message}`,
            `Error: ${error.message}\nStack: ${error.stack}\nContext: ${context}`,
            'high'
        );
    }

    private reportPerformanceIssue(description: string, severity: 'low' | 'medium' | 'high' | 'critical'): void {
        if (!this.feedbackSystem || !this.config.autoReportPerformance) return;

        this.feedbackSystem.reportPerformanceIssue(description, severity);
    }

    private async saveSessionData(): Promise<void> {
        if (!this.session || !this.saveService) return;

        try {
            await this.saveService.save(`beta-session-${this.session.sessionId}`, this.session);
        } catch (error) {
            console.warn('Failed to save beta session data:', error);
        }
    }

    private mergeConfig(config: Partial<BetaTestingConfig>): BetaTestingConfig {
        return {
            enabled: true,
            feedbackEnabled: true,
            analyticsEnabled: true,
            performanceMonitoring: true,
            autoReportErrors: true,
            autoReportPerformance: true,
            sessionTimeout: 0, // No timeout
            maxEventsPerSession: 1000,
            ...config
        };
    }

    private generateSessionId(): string {
        return `beta-session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
}
