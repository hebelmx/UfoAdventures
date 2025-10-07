import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConfigService } from '../../src/js/engine/config-service';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Config Watchers', () => {
    let configService: ConfigService;

    beforeEach(() => {
        vi.clearAllMocks();
        
        // Mock schema loading
        mockFetch
            .mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({
                    $schema: 'http://json-schema.org/draft-07/schema#',
                    type: 'object',
                    properties: {
                        test: { type: 'string' }
                    }
                })
            })
            .mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({})
            })
            .mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({})
            })
            .mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({})
            })
            .mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({})
            });

        configService = new ConfigService('/config/game-config.json');
    });

    describe('watcher registration', () => {
        it('should register and call watchers on config load', async () => {
            const watcher1 = vi.fn();
            const watcher2 = vi.fn();

            configService.addWatcher(watcher1);
            configService.addWatcher(watcher2);

            const config = { test: 'value' };
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(config)
            });

            await configService.load();

            expect(watcher1).toHaveBeenCalledWith(config);
            expect(watcher2).toHaveBeenCalledWith(config);
        });

        it('should return unsubscribe function', async () => {
            const watcher = vi.fn();
            const unsubscribe = configService.addWatcher(watcher);

            const config1 = { test: 'value1' };
            const config2 = { test: 'value2' };

            mockFetch
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve(config1)
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve(config2)
                });

            await configService.load();
            expect(watcher).toHaveBeenCalledWith(config1);

            unsubscribe();
            await configService.reload();
            expect(watcher).toHaveBeenCalledTimes(1); // Should not be called again
        });

        it('should handle multiple unsubscribes gracefully', () => {
            const watcher = vi.fn();
            const unsubscribe = configService.addWatcher(watcher);

            unsubscribe();
            unsubscribe(); // Should not throw
        });
    });

    describe('watcher error handling', () => {
        it('should handle watcher errors gracefully', async () => {
            const errorWatcher = vi.fn().mockImplementation(() => {
                throw new Error('Watcher error');
            });
            const normalWatcher = vi.fn();

            configService.addWatcher(errorWatcher);
            configService.addWatcher(normalWatcher);

            const config = { test: 'value' };
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(config)
            });

            // Should not throw
            await expect(configService.load()).resolves.toBeDefined();

            expect(errorWatcher).toHaveBeenCalledWith(config);
            expect(normalWatcher).toHaveBeenCalledWith(config);
        });
    });

    describe('config change callback', () => {
        it('should call config change callback on load', async () => {
            const onConfigChange = vi.fn();
            const service = new ConfigService('/test.json', { onConfigChange });

            const config = { test: 'value' };
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(config)
            });

            await service.load();
            expect(onConfigChange).toHaveBeenCalledWith(config);
        });

        it('should call config change callback on reload', async () => {
            const onConfigChange = vi.fn();
            const service = new ConfigService('/test.json', { onConfigChange });

            const config1 = { test: 'value1' };
            const config2 = { test: 'value2' };

            mockFetch
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve(config1)
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve(config2)
                });

            await service.load();
            expect(onConfigChange).toHaveBeenCalledWith(config1);

            await service.reload();
            expect(onConfigChange).toHaveBeenCalledWith(config2);
            expect(onConfigChange).toHaveBeenCalledTimes(2);
        });
    });

    describe('watcher lifecycle', () => {
        it('should maintain watchers across reloads', async () => {
            const watcher = vi.fn();
            configService.addWatcher(watcher);

            const config1 = { test: 'value1' };
            const config2 = { test: 'value2' };

            mockFetch
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve(config1)
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve(config2)
                });

            await configService.load();
            expect(watcher).toHaveBeenCalledWith(config1);

            await configService.reload();
            expect(watcher).toHaveBeenCalledWith(config2);
            expect(watcher).toHaveBeenCalledTimes(2);
        });

        it('should not call watchers when validation is disabled', async () => {
            const service = new ConfigService('/test.json', { validateOnLoad: false });
            const watcher = vi.fn();
            service.addWatcher(watcher);

            const config = { test: 'value' };
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(config)
            });

            await service.load();
            expect(watcher).toHaveBeenCalledWith(config);
        });
    });

    describe('supplemental config watchers', () => {
        it('should notify watchers when supplemental config is loaded', async () => {
            const watcher = vi.fn();
            configService.addWatcher(watcher);

            const mainConfig = { application: { screen: { width: 800, height: 600 } } };
            const supplementalConfig = { enemies: [{ id: 'scout', health: 50 }] };

            mockFetch
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve(mainConfig)
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve(supplementalConfig)
                });

            await configService.load();
            expect(watcher).toHaveBeenCalledWith(mainConfig);

            await configService._loadSupplemental('/enemies.json', 'enemies');
            
            // Should be called again with updated config
            expect(watcher).toHaveBeenCalledTimes(2);
            expect(watcher).toHaveBeenLastCalledWith(
                expect.objectContaining({
                    application: mainConfig.application,
                    enemies: supplementalConfig.enemies
                })
            );
        });
    });

    describe('watcher cleanup', () => {
        it('should clean up watchers when service is destroyed', () => {
            const watcher = vi.fn();
            const unsubscribe = configService.addWatcher(watcher);

            // Simulate cleanup
            unsubscribe();

            // Watcher should be removed
            expect(configService['_watchers']).toHaveLength(0);
        });

        it('should handle watcher removal during iteration', async () => {
            const watcher1 = vi.fn();
            const watcher2 = vi.fn().mockImplementation(() => {
                // Remove watcher1 during iteration
                configService['_watchers'] = configService['_watchers'].filter(w => w !== watcher1);
            });

            configService.addWatcher(watcher1);
            configService.addWatcher(watcher2);

            const config = { test: 'value' };
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(config)
            });

            // Should not throw
            await expect(configService.load()).resolves.toBeDefined();

            expect(watcher1).toHaveBeenCalledWith(config);
            expect(watcher2).toHaveBeenCalledWith(config);
        });
    });
});
