import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SaveService } from '../../src/js/engine/save-service';
import { SaveMigrationService } from '../../src/js/engine/save-migration';

describe('SaveService Migration and Checksum', () => {
    let saveService: SaveService;
    let mockIndexedDB: any;
    let mockLocalStorage: any;

    beforeEach(() => {
        // Mock IndexedDB
        mockIndexedDB = {
            open: vi.fn(() => ({
                onsuccess: null,
                onerror: null,
                onupgradeneeded: null,
                result: {
                    createObjectStore: vi.fn(),
                    transaction: vi.fn(() => ({
                        objectStore: vi.fn(() => ({
                            put: vi.fn(),
                            get: vi.fn(() => ({
                                onsuccess: null,
                                onerror: null,
                                result: null
                            })),
                            delete: vi.fn(),
                            clear: vi.fn(),
                            openCursor: vi.fn(() => ({
                                onsuccess: null,
                                onerror: null,
                                result: null
                            }))
                        })),
                        oncomplete: null,
                        onabort: null,
                        onerror: null
                    }))
                }
            }))
        };

        // Mock localStorage
        mockLocalStorage = {
            getItem: vi.fn(),
            setItem: vi.fn(),
            removeItem: vi.fn(),
            key: vi.fn(),
            length: 0
        };

        // Mock window
        Object.defineProperty(window, 'indexedDB', {
            value: mockIndexedDB,
            writable: true
        });

        Object.defineProperty(window, 'localStorage', {
            value: mockLocalStorage,
            writable: true
        });

        saveService = new SaveService({
            enableChecksums: true,
            version: 3
        });
    });

    describe('Checksum Validation', () => {
        it('should calculate and validate checksums', async () => {
            const testData = { score: 100, level: 5 };
            const key = 'test-save';

            // Mock successful IndexedDB operations
            const mockRequest = {
                onsuccess: null,
                onerror: null,
                result: null
            };
            mockIndexedDB.open().result.transaction().objectStore().get.mockReturnValue(mockRequest);

            // Save data
            await saveService.save(key, testData);

            // Verify checksum was calculated
            expect(mockIndexedDB.open().result.transaction().objectStore().put).toHaveBeenCalledWith(
                expect.objectContaining({
                    key,
                    value: testData,
                    version: 3,
                    checksum: expect.any(String)
                })
            );
        });

        it('should throw error on checksum mismatch', async () => {
            const key = 'test-save';
            const originalData = { score: 100, level: 5 };
            const tamperedData = { score: 999, level: 5 };

            // Mock IndexedDB to return tampered data
            const mockRequest = {
                onsuccess: null,
                onerror: null,
                result: {
                    key,
                    value: tamperedData,
                    version: 3,
                    checksum: 'original-checksum'
                }
            };
            mockIndexedDB.open().result.transaction().objectStore().get.mockReturnValue(mockRequest);

            // Simulate successful IndexedDB read
            mockRequest.onsuccess = () => {
                mockRequest.result = {
                    key,
                    value: tamperedData,
                    version: 3,
                    checksum: 'original-checksum'
                };
            };

            await expect(saveService.load(key)).rejects.toThrow('Checksum validation failed');
        });
    });

    describe('Migration', () => {
        it('should migrate data from older versions', async () => {
            const key = 'test-save';
            const oldData = { score: 100, level: 5 };
            const migratedData = { score: 100, level: 5, version: 2 };

            // Mock IndexedDB to return old version data
            const mockRequest = {
                onsuccess: null,
                onerror: null,
                result: {
                    key,
                    value: oldData,
                    version: 1
                }
            };
            mockIndexedDB.open().result.transaction().objectStore().get.mockReturnValue(mockRequest);

            // Simulate successful IndexedDB read
            mockRequest.onsuccess = () => {
                mockRequest.result = {
                    key,
                    value: oldData,
                    version: 1
                };
            };

            const result = await saveService.load(key);

            // Verify data was migrated
            expect(result).toEqual(expect.objectContaining({
                version: 2
            }));

            // Verify migrated data was saved
            expect(mockIndexedDB.open().result.transaction().objectStore().put).toHaveBeenCalledWith(
                expect.objectContaining({
                    key,
                    version: 3,
                    checksum: expect.any(String)
                })
            );
        });

        it('should handle data without version', async () => {
            const key = 'test-save';
            const data = { score: 100, level: 5 };

            // Mock IndexedDB to return data without version
            const mockRequest = {
                onsuccess: null,
                onerror: null,
                result: {
                    key,
                    value: data
                }
            };
            mockIndexedDB.open().result.transaction().objectStore().get.mockReturnValue(mockRequest);

            // Simulate successful IndexedDB read
            mockRequest.onsuccess = () => {
                mockRequest.result = {
                    key,
                    value: data
                };
            };

            const result = await saveService.load(key);

            // Verify data was loaded without migration
            expect(result).toEqual(data);
        });
    });

    describe('Fallback Storage', () => {
        it('should handle checksum validation in fallback storage', () => {
            const key = 'test-save';
            const data = { score: 100, level: 5 };
            const checksum = saveService['_calculateChecksum'](data);

            // Mock localStorage to return data with checksum
            mockLocalStorage.getItem.mockReturnValue(JSON.stringify({
                key,
                value: data,
                version: 3,
                checksum
            }));

            const result = saveService.load(key);

            // Verify data was loaded successfully
            expect(result).resolves.toEqual(data);
        });

        it('should handle checksum mismatch in fallback storage', () => {
            const key = 'test-save';
            const data = { score: 100, level: 5 };
            const wrongChecksum = 'wrong-checksum';

            // Mock localStorage to return data with wrong checksum
            mockLocalStorage.getItem.mockReturnValue(JSON.stringify({
                key,
                value: data,
                version: 3,
                checksum: wrongChecksum
            }));

            expect(saveService.load(key)).rejects.toThrow('Checksum validation failed');
        });
    });

    describe('Migration Service', () => {
        it('should register and apply migrations', () => {
            const migrationService = new SaveMigrationService();
            const data = { score: 100, level: 5 };

            // Register a custom migration
            migrationService.registerMigration({
                version: 4,
                migrate: (data: unknown) => {
                    if (typeof data === 'object' && data !== null) {
                        const obj = data as Record<string, unknown>;
                        obj.newField = 'migrated';
                    }
                    return data;
                }
            });

            const result = migrationService.migrate(data, 3, 4);

            expect(result).toEqual({
                score: 100,
                level: 5,
                newField: 'migrated'
            });
        });

        it('should handle multiple migrations', () => {
            const migrationService = new SaveMigrationService();
            const data = { score: 100, level: 5 };

            // Register multiple migrations
            migrationService.registerMigration({
                version: 4,
                migrate: (data: unknown) => {
                    if (typeof data === 'object' && data !== null) {
                        const obj = data as Record<string, unknown>;
                        obj.field1 = 'migrated1';
                    }
                    return data;
                }
            });

            migrationService.registerMigration({
                version: 5,
                migrate: (data: unknown) => {
                    if (typeof data === 'object' && data !== null) {
                        const obj = data as Record<string, unknown>;
                        obj.field2 = 'migrated2';
                    }
                    return data;
                }
            });

            const result = migrationService.migrate(data, 3, 5);

            expect(result).toEqual({
                score: 100,
                level: 5,
                field1: 'migrated1',
                field2: 'migrated2'
            });
        });
    });
});
