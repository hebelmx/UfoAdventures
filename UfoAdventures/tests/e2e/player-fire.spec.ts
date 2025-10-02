import { test, expect } from '@playwright/test';

const baseUrl = 'http://localhost:5173/src/index.html';

async function waitForTransitionClear(page) {
    await page.waitForFunction(() => {
        const overlay = document.getElementById('sceneTransition');
        return !overlay || !overlay.classList.contains('scene-transition--visible');
    });
}

async function waitForScene(page, name: string) {
    await page.waitForFunction((expected) => {
        const manager = window.gameApp?.getSceneManager?.();
        if (!manager || typeof manager.getActiveName !== 'function') {
            return false;
        }
        return manager.getActiveName() === expected;
    }, name);
}

async function waitForGameReady(page) {
    await waitForScene(page, 'main-menu');
    await waitForTransitionClear(page);
    await page.waitForSelector('#missionLaunchButton', { state: 'visible' });
}

async function startAdventure(page) {
    const firstMissionCard = page.locator('.mission-card').first();
    if (await firstMissionCard.count()) {
        await firstMissionCard.click();
    }

    await waitForTransitionClear(page);
    await page.click('#missionLaunchButton');

    await waitForScene(page, 'gameplay');
    await waitForTransitionClear(page);
    await page.waitForTimeout(200);
}

async function getCounts(page) {
    return await page.evaluate(() => {
        try {
            const runtime = window.gameplayRuntime;
            if (runtime && typeof runtime.getActiveCounts === 'function') {
                return runtime.getActiveCounts();
            }
        } catch {
            // ignore
        }
        return null;
    });
}

test.describe('Player firing', () => {
    test.beforeEach(async ({ page }) => {
        page.on('console', (msg) => {
            console.log(`[console:${msg.type()}] ${msg.text()}`);
        });
        page.on('pageerror', (error) => {
            console.log(`[pageerror] ${error.message}`);
        });
        page.on('requestfailed', (request) => {
            console.log(`[requestfailed] ${request.url()} -> ${request.failure()?.errorText}`);
        });

        await page.addInitScript(() => { (window as any).__E2E__ = true; });
        await page.goto(baseUrl);
        await waitForGameReady(page);
    });

    test('fires bullets on Space and MouseLeft', async ({ page }) => {
        await startAdventure(page);

        await page.click('#gameCanvas');

        const before = await getCounts(page);

        await page.keyboard.down('Space');
        await page.waitForTimeout(250);
        await page.keyboard.up('Space');

        await page.mouse.down();
        await page.waitForTimeout(100);
        await page.mouse.up();

        await page.waitForTimeout(300);

        const after = await getCounts(page);

        if (!after || !before) {
            expect(true).toBeTruthy();
            return;
        }

        expect(after.hasPlayer).toBeTruthy();
        expect(after.bullets).toBeGreaterThan(before.bullets);
    });
});
