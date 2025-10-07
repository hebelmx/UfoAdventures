import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SaveService } from '../../src/js/engine/save-service';
import { SaveMigrationService } from '../../src/js/engine/save-migration';

describe('SaveService Migration and Checksum (Simple)', () => {
    let saveService: SaveService;
    let mockLocalStorage: any;

    beforeEach(() => {
        // Mock localStorage
        mockLocalStorage = {
            getItem: vi.fn(),
            setItem: vi.fn(),
            removeItem: vi.fn(),
            key: vi.fn(),
            length: 0
        };

        // Mock window
        Object.defineProperty(window, 'localStorage', {
            value: mockLocalStorage,
            writable: true
        });

        // Mock IndexedDB to be null to force fallback to localStorage
        Object.defineProperty(window, 'indexedDB', {
            value: null,
            writable: true
        });

        saveService = new SaveService({
            enableChecksums: true,
            version: 3
        });
    });

    describe('Checksum Calculation', () => {
        it('should calculate consistent checksums', () => {
            const data1 = { score: 100, level: 5 };
            const data2 = { score: 100, level: 5 };
            const data3 = { score: 101, level: 5 };

            const checksum1 = saveService['_calculateChecksum'](data1);
            const checksum2 = saveService['_calculateChecksum'](data2);
            const checksum3 = saveService['_calculateChecksum'](data3);

            expect(checksum1).toBe(checksum2);
            expect(checksum1).not.toBe(checksum3);
            expect(typeof checksum1).toBe('string');
        });

        it('should handle different data types', () => {
            const stringData = 'test string';
            const numberData = 42;
            const arrayData = [1, 2, 3];
            const nullData = null;

            const stringChecksum = saveService['_calculateChecksum'](stringData);
            const numberChecksum = saveService['_calculateChecksum'](numberData);
            const arrayChecksum = saveService['_calculateChecksum'](arrayData);
            const nullChecksum = saveService['_calculateChecksum'](nullData);

            expect(typeof stringChecksum).toBe('string');
            expect(typeof numberChecksum).toBe('string');
            expect(typeof arrayChecksum).toBe('string');
            expect(typeof nullChecksum).toBe('string');
        });
    });

    describe('Fallback Storage with Checksums', () => {
        it('should save with checksum in localStorage', () => {
            const key = 'test-save';
            const data = { score: 100, level: 5 };

            saveService.save(key, data);

            // Check that setItem was called with the actual save data (not the probe)
            expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
                expect.stringContaining('UFOAdventures:saves:test-save'),
                expect.stringMatching(/"checksum":"[a-f0-9-]+"/)
            );
        });

        it('should load and validate checksum from localStorage', () => {
            const key = 'test-save';
            const data = { score: 100, level: 5 };
            const checksum = saveService['_calculateChecksum'](data);

            // Mock localStorage to return valid data with checksum
            mockLocalStorage.getItem.mockReturnValue(JSON.stringify({
                key,
                value: data,
                version: 3,
                checksum,
                timestamp: Date.now()
            }));

            const result = saveService.load(key);

            expect(result).resolves.toEqual(data);
        });

        it('should throw error on checksum mismatch in localStorage', () => {
            const key = 'test-save';
            const data = { score: 100, level: 5 };
            const wrongChecksum = 'wrong-checksum';

            // Mock localStorage to return data with wrong checksum
            mockLocalStorage.getItem.mockReturnValue(JSON.stringify({
                key,
                value: data,
                version: 3,
                checksum: wrongChecksum,
                timestamp: Date.now()
            }));

            expect(saveService.load(key)).rejects.toThrow('Checksum validation failed');
        });
    });

    describe('Migration in Fallback Storage', () => {
        it('should migrate data from older version', () => {
            const key = 'test-save';
            const oldData = { score: 100, level: 5 };

            // Mock localStorage to return old version data
            mockLocalStorage.getItem.mockReturnValue(JSON.stringify({
                key,
                value: oldData,
                version: 1,
                timestamp: Date.now()
            }));

            const result = saveService.load(key);

            // Should resolve with migrated data
            expect(result).resolves.toEqual(expect.objectContaining({
                version: 2
            }));

            // Should save migrated data back
            expect(mockLocalStorage.setItem).toHaveBeenCalled();
        });

        it('should handle data without version', () => {
            const key = 'test-save';
            const data = { score: 100, level: 5 };

            // Mock localStorage to return data without version
            mockLocalStorage.getItem.mockReturnValue(JSON.stringify({
                key,
                value: data,
                timestamp: Date.now()
            }));

            const result = saveService.load(key);

            expect(result).resolves.toEqual(data);
        });
    });

    describe('Migration Service Integration', () => {
        it('should use migration service for data migration', () => {
            const migrationService = saveService['_migrationService'];
            const data = { score: 100, level: 5 };

            // Register a test migration
            migrationService.registerMigration({
                version: 4,
                migrate: (data: unknown) => {
                    if (typeof data === 'object' && data !== null) {
                        const obj = data as Record<string, unknown>;
                        obj.migrated = true;
                    }
                    return data;
                }
            });

            const result = migrationService.migrate(data, 3, 4);

            expect(result).toEqual({
                score: 100,
                level: 5,
                migrated: true
            });
        });
    });

    describe('Configuration Options', () => {
        it('should disable checksums when configured', () => {
            const saveServiceNoChecksums = new SaveService({
                enableChecksums: false,
                version: 3
            });

            const key = 'test-save';
            const data = { score: 100, level: 5 };

            saveServiceNoChecksums.save(key, data);

            // Should not include checksum in saved data
            expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
                expect.stringContaining(key),
                expect.not.stringMatching(/"checksum"/)
            );
        });

        it('should use custom version', () => {
            const saveServiceCustomVersion = new SaveService({
                version: 5
            });

            const key = 'test-save';
            const data = { score: 100, level: 5 };

            saveServiceCustomVersion.save(key, data);

            expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
                expect.stringContaining(key),
                expect.stringMatching(/"version":5/)
            );
        });
    });
});
