import { describe, it, expect, beforeEach } from 'vitest';
import { SaveMigrationService } from '../../src/js/engine/save-migration';

describe('SaveMigrationService', () => {
    let migrationService: SaveMigrationService;

    beforeEach(() => {
        migrationService = new SaveMigrationService();
    });

    describe('Default Migrations', () => {
        it('should apply version 2 migration', () => {
            const data = { score: 100, level: 5 };
            const result = migrationService.migrate(data, 1, 2);

            expect(result).toEqual({
                score: 100,
                level: 5,
                version: 2
            });
        });

        it('should apply version 3 migration', () => {
            const data = { score: 100, level: 5, oldField: 'value' };
            const result = migrationService.migrate(data, 2, 3);

            expect(result).toEqual({
                score: 100,
                level: 5,
                newField: 'value'
            });
        });

        it('should apply multiple migrations in sequence', () => {
            const data = { score: 100, level: 5 };
            const result = migrationService.migrate(data, 1, 3);

            expect(result).toEqual({
                score: 100,
                level: 5,
                version: 2,
                newField: undefined
            });
        });
    });

    describe('Custom Migrations', () => {
        it('should register and apply custom migration', () => {
            const data = { score: 100, level: 5 };

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

        it('should handle multiple custom migrations', () => {
            const data = { score: 100, level: 5 };

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

        it('should sort migrations by version', () => {
            const data = { score: 100, level: 5 };

            // Register migrations out of order
            migrationService.registerMigration({
                version: 5,
                migrate: (data: unknown) => {
                    if (typeof data === 'object' && data !== null) {
                        const obj = data as Record<string, unknown>;
                        obj.field5 = 'migrated5';
                    }
                    return data;
                }
            });

            migrationService.registerMigration({
                version: 4,
                migrate: (data: unknown) => {
                    if (typeof data === 'object' && data !== null) {
                        const obj = data as Record<string, unknown>;
                        obj.field4 = 'migrated4';
                    }
                    return data;
                }
            });

            const result = migrationService.migrate(data, 3, 5);

            expect(result).toEqual({
                score: 100,
                level: 5,
                field4: 'migrated4',
                field5: 'migrated5'
            });
        });
    });

    describe('Edge Cases', () => {
        it('should handle no migration needed', () => {
            const data = { score: 100, level: 5 };
            const result = migrationService.migrate(data, 3, 3);

            expect(result).toEqual(data);
        });

        it('should handle downgrade (no migration)', () => {
            const data = { score: 100, level: 5 };
            const result = migrationService.migrate(data, 3, 2);

            expect(result).toEqual(data);
        });

        it('should handle null data', () => {
            const result = migrationService.migrate(null, 1, 2);

            expect(result).toBeNull();
        });

        it('should handle undefined data', () => {
            const result = migrationService.migrate(undefined, 1, 2);

            expect(result).toBeUndefined();
        });

        it('should handle primitive data', () => {
            const result = migrationService.migrate('test', 1, 2);

            expect(result).toBe('test');
        });
    });
});
