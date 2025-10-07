import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConfigService } from '../../src/js/engine/config-service';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Config Schema Validation', () => {
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
                    required: ['application', 'assets'],
                    properties: {
                        application: {
                            type: 'object',
                            required: ['screen'],
                            properties: {
                                screen: {
                                    type: 'object',
                                    required: ['width', 'height', 'backgroundColor'],
                                    properties: {
                                        width: { type: 'number', minimum: 100 },
                                        height: { type: 'number', minimum: 100 },
                                        backgroundColor: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' }
                                    }
                                }
                            }
                        },
                        assets: {
                            type: 'array',
                            items: {
                                type: 'object',
                                required: ['alias', 'src'],
                                properties: {
                                    alias: { type: 'string', minLength: 1 },
                                    src: { type: 'string', minLength: 1 }
                                }
                            }
                        }
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

    describe('valid configuration', () => {
        it('should validate complete valid configuration', async () => {
            const validConfig = {
                application: {
                    screen: {
                        width: 800,
                        height: 600,
                        backgroundColor: '#0f192a'
                    }
                },
                assets: [
                    { alias: 'player', src: 'images/player.png' },
                    { alias: 'enemy', src: 'images/enemy.png' }
                ]
            };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(validConfig)
            });

            await configService.load();
            expect(configService.isValid()).toBe(true);
            expect(configService.getValidationErrors()).toHaveLength(0);
        });
    });

    describe('invalid configuration', () => {
        it('should reject configuration with missing required fields', async () => {
            const invalidConfig = {
                application: {
                    screen: {
                        width: 800,
                        height: 600
                        // Missing backgroundColor
                    }
                },
                assets: []
            };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(invalidConfig)
            });

            await configService.load();
            expect(configService.isValid()).toBe(false);
            expect(configService.getValidationErrors().length).toBeGreaterThan(0);
        });

        it('should reject configuration with invalid screen dimensions', async () => {
            const invalidConfig = {
                application: {
                    screen: {
                        width: 50, // Below minimum
                        height: 600,
                        backgroundColor: '#0f192a'
                    }
                },
                assets: []
            };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(invalidConfig)
            });

            await configService.load();
            expect(configService.isValid()).toBe(false);
            expect(configService.getValidationErrors()).toContain(
                expect.stringContaining('width')
            );
        });

        it('should reject configuration with invalid background color format', async () => {
            const invalidConfig = {
                application: {
                    screen: {
                        width: 800,
                        height: 600,
                        backgroundColor: 'invalid-color'
                    }
                },
                assets: []
            };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(invalidConfig)
            });

            await configService.load();
            expect(configService.isValid()).toBe(false);
            expect(configService.getValidationErrors()).toContain(
                expect.stringContaining('backgroundColor')
            );
        });

        it('should reject configuration with invalid assets', async () => {
            const invalidConfig = {
                application: {
                    screen: {
                        width: 800,
                        height: 600,
                        backgroundColor: '#0f192a'
                    }
                },
                assets: [
                    { alias: '', src: 'images/player.png' }, // Empty alias
                    { alias: 'enemy' } // Missing src
                ]
            };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(invalidConfig)
            });

            await configService.load();
            expect(configService.isValid()).toBe(false);
            expect(configService.getValidationErrors().length).toBeGreaterThan(0);
        });
    });

    describe('section validation', () => {
        it('should validate assets section independently', () => {
            const validAssets = [
                { alias: 'player', src: 'images/player.png' },
                { alias: 'enemy', src: 'images/enemy.png' }
            ];

            const invalidAssets = [
                { alias: '', src: 'images/player.png' }, // Empty alias
                { alias: 'enemy' } // Missing src
            ];

            expect(configService.validateSection('assets', validAssets)).toBe(true);
            expect(configService.validateSection('assets', invalidAssets)).toBe(false);
        });

        it('should handle missing schema gracefully', () => {
            const result = configService.validateSection('nonexistent', { test: 'value' });
            expect(result).toBe(true); // Should return true when schema is missing
        });
    });

    describe('validation error handling', () => {
        it('should call validation error callback with errors', async () => {
            const onValidationError = vi.fn();
            const service = new ConfigService('/test.json', { onValidationError });

            const invalidConfig = {
                application: {
                    screen: {
                        width: 50, // Invalid
                        height: 600,
                        backgroundColor: '#0f192a'
                    }
                },
                assets: []
            };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(invalidConfig)
            });

            await service.load();
            expect(onValidationError).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.stringContaining('width')
                ])
            );
        });

        it('should provide detailed error messages', async () => {
            const invalidConfig = {
                application: {
                    screen: {
                        width: 50,
                        height: 600,
                        backgroundColor: 'invalid'
                    }
                },
                assets: [
                    { alias: '', src: 'test.png' }
                ]
            };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(invalidConfig)
            });

            await configService.load();
            const errors = configService.getValidationErrors();
            
            expect(errors.length).toBeGreaterThan(0);
            expect(errors.some(error => error.includes('width'))).toBe(true);
            expect(errors.some(error => error.includes('backgroundColor'))).toBe(true);
            expect(errors.some(error => error.includes('alias'))).toBe(true);
        });
    });

    describe('configuration reloading', () => {
        it('should re-validate on reload', async () => {
            const validConfig = {
                application: {
                    screen: {
                        width: 800,
                        height: 600,
                        backgroundColor: '#0f192a'
                    }
                },
                assets: []
            };

            const invalidConfig = {
                application: {
                    screen: {
                        width: 50, // Invalid
                        height: 600,
                        backgroundColor: '#0f192a'
                    }
                },
                assets: []
            };

            mockFetch
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve(validConfig)
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve(invalidConfig)
                });

            await configService.load();
            expect(configService.isValid()).toBe(true);

            await configService.reload();
            expect(configService.isValid()).toBe(false);
        });
    });
});
