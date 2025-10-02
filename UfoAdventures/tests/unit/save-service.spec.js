import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { transpileModule, ModuleKind, ScriptTarget } from 'typescript';
import { describe, expect, beforeAll, it } from 'vitest';

const projectRoot = resolve(process.cwd());

const sandbox = {
    console,
    setTimeout,
    clearTimeout,
    window: {},
    performance: { now: () => Date.now() },
    module: { exports: {} },
    exports: {}
};

sandbox.window = sandbox;
sandbox.indexedDB = undefined;
sandbox.window.localStorage = (() => {
    const store = new Map();
    const keys = [];
    return {
        get length() {
            return keys.length;
        },
        key(index) {
            return keys[index] ?? null;
        },
        getItem(key) {
            return store.has(key) ? store.get(key) : null;
        },
        setItem(key, value) {
            if (!store.has(key)) {
                keys.push(key);
            }
            store.set(key, String(value));
        },
        removeItem(key) {
            const idx = keys.indexOf(key);
            if (idx !== -1) {
                keys.splice(idx, 1);
            }
            store.delete(key);
        }
    };
})();

const loadScript = (relativePath) => {
    const filePath = resolve(projectRoot, relativePath);
    const code = readFileSync(filePath, 'utf8');
    const { outputText } = transpileModule(code, {
        compilerOptions: {
            module: ModuleKind.CommonJS,
            target: ScriptTarget.ES2019,
            moduleResolution: 2,
            esModuleInterop: true
        },
        fileName: filePath
    });
    vm.runInNewContext(outputText, sandbox, { filename: filePath });
};

const evaluate = (expression) => vm.runInNewContext(expression, sandbox);

describe('SaveService basics', () => {
    let SaveService;

    beforeAll(() => {
        loadScript('src/js/engine/save-service.ts');
        SaveService = sandbox.module.exports.SaveService || sandbox.exports.SaveService;
    });

    it('persists and retrieves data via fallback storage', async () => {
        const service = new SaveService({ dbName: 'spec-db', storeName: 'tests' });
        await service.ready();

        await service.save('alpha', { value: 42 });
        const result = await service.load('alpha');
        expect(result).toEqual({ value: 42 });

        await service.save('alpha', { value: 84 });
        const updated = await service.load('alpha');
        expect(updated).toEqual({ value: 84 });

        const list = await service.list();
        expect(Array.isArray(list)).toBe(true);
        expect(list.find(entry => entry.key === 'alpha').value.value).toBe(84);

        await service.delete('alpha');
        const afterDelete = await service.load('alpha');
        expect(afterDelete).toBeNull();
    });
});


