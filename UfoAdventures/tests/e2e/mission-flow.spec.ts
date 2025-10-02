import { test, expect, Page } from '@playwright/test';

const BASE_URL = 'http://localhost:5173/src/index.html';

async function waitForTransitionClear(page: Page) {
    await page.waitForFunction(() => {
        const overlay = document.getElementById('sceneTransition');
        return !overlay || !overlay.classList.contains('scene-transition--visible');
    });
}

async function waitForScene(page: Page, name: string) {
    await page.waitForFunction((expected) => {
        const manager = window.gameApp?.getSceneManager?.();
        if (!manager || typeof manager.getActiveName !== 'function') {
            return false;
        }
        return manager.getActiveName() === expected;
    }, name);
}

async function waitForMainMenu(page: Page) {
    await waitForScene(page, 'main-menu');
    await waitForTransitionClear(page);
    await page.waitForSelector('#missionLaunchButton', { state: 'visible' });
}

async function launchAdventure(page: Page) {
    const firstMission = page.locator('.mission-card').first();
    if (await firstMission.count()) {
        await firstMission.click();
    }

    await page.click('#missionLaunchButton');
    await waitForScene(page, 'gameplay');
    await waitForTransitionClear(page);
}

async function ensureEnemiesSpawned(page: Page) {
    await page.waitForFunction(() => {
        const runtime = window.gameplayRuntime;
        if (!runtime || typeof runtime.getActiveCounts !== 'function') {
            return false;
        }
        const counts = runtime.getActiveCounts();
        return counts && counts.enemies > 0;
    }, { timeout: 15_000 });
}

async function getAbilitySnapshot(page: Page) {
    return page.evaluate(() => {
        const runtime = window.gameplayRuntime;
        if (!runtime || typeof runtime.getAbilitySnapshot !== 'function') {
            return null;
        }
        return runtime.getAbilitySnapshot();
    });
}

test.describe('Mission flow smoke', () => {
    test.beforeEach(async ({ page }) => {
        page.on('console', msg => console.log(`[console:${msg.type()}] ${msg.text()}`));
        page.on('pageerror', error => console.log(`[pageerror] ${error.message}`));
        page.on('requestfailed', request => console.log(`[requestfailed] ${request.url()} -> ${request.failure()?.errorText}`));

        await page.addInitScript(() => { (window as any).__E2E__ = true; });
        await page.goto(BASE_URL);
        await waitForMainMenu(page);
    });

    test('pause menu toggles via Escape', async ({ page }) => {
        await launchAdventure(page);
        await page.keyboard.press('Escape');

        await expect(page.locator('#pauseOverlay')).toBeVisible();
        await waitForScene(page, 'pause-menu');

        await page.click('#pauseResumeButton');
        await waitForScene(page, 'gameplay');
        await expect(page.locator('#pauseOverlay')).toBeHidden();
    });

    test('shield and stasis abilities activate', async ({ page }) => {
        await launchAdventure(page);
        await ensureEnemiesSpawned(page);

        await page.click('#gameCanvas');

        await page.keyboard.press('KeyO');
        await page.waitForTimeout(100);

        let snapshot = await getAbilitySnapshot(page);
        expect(snapshot?.shieldActive).toBeTruthy();
        expect((snapshot?.shieldRemaining ?? 0)).toBeGreaterThan(0);

        await page.keyboard.press('KeyP');
        await page.waitForTimeout(200);

        snapshot = await getAbilitySnapshot(page);
        expect((snapshot?.stasisRemaining ?? 0)).toBeGreaterThan(0);
        expect((snapshot?.stasisPaused ?? 0)).toBeGreaterThan(0);
    });
});
