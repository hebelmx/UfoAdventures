import { SaveRecord } from './save-service';

export interface SaveMigration {
    version: number;
    migrate: (data: unknown) => unknown;
}

export class SaveMigrationService {
    private migrations: SaveMigration[] = [];

    constructor() {
        this.registerDefaultMigrations();
    }

    registerMigration(migration: SaveMigration): void {
        this.migrations.push(migration);
        this.migrations.sort((a, b) => a.version - b.version);
    }

    migrate(data: unknown, fromVersion: number, toVersion: number): unknown {
        if (fromVersion >= toVersion) {
            return data;
        }

        let currentData = data;
        for (const migration of this.migrations) {
            if (migration.version > fromVersion && migration.version <= toVersion) {
                currentData = migration.migrate(currentData);
            }
        }
        return currentData;
    }

    private registerDefaultMigrations(): void {
        // Example migration from version 1 to 2
        this.registerMigration({
            version: 2,
            migrate: (data: unknown) => {
                if (typeof data === 'object' && data !== null) {
                    const obj = data as Record<string, unknown>;
                    // Example: Add new field with default value
                    if (!('version' in obj)) {
                        obj.version = 2;
                    }
                }
                return data;
            }
        });

        // Example migration from version 2 to 3
        this.registerMigration({
            version: 3,
            migrate: (data: unknown) => {
                if (typeof data === 'object' && data !== null) {
                    const obj = data as Record<string, unknown>;
                    // Example: Rename field
                    if ('oldField' in obj) {
                        obj.newField = obj.oldField;
                        delete obj.oldField;
                    }
                }
                return data;
            }
        });
    }
}
