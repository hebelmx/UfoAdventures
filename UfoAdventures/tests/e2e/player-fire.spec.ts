import { test, expect, Page } from '@playwright/test';

const BASE_URL = '/index.html';

async function waitForTransitionClear(page: Page) {
    await page.waitForFunction(() => {
        const overlay = document.getElementById('sceneTransition');
        return !overlay || !overlay.classList.contains('scene-transition--visible');
    });
}

async function waitForOverlayVisible(page: Page, selector: string) {
    await page.waitForFunction((targetSelector) => {
        const element = document.querySelector<HTMLElement>(targetSelector);
        if (!element) {
            return false;
        }
        const style = window.getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden') {
            return false;
        }
        return element.getAttribute('aria-hidden') !== 'true';
    }, selector);
}

async function waitForOverlayHidden(page: Page, selector: string) {
    await page.waitForFunction((targetSelector) => {
        const element = document.querySelector<HTMLElement>(targetSelector);
        if (!element) {
            return true;
        }
        if (element.getAttribute('aria-hidden') === 'true') {
            return true;
        }
        const style = window.getComputedStyle(element);
        return style.display === 'none' || style.visibility === 'hidden';
    }, selector);
}

async function waitForGameReady(page: Page) {
    await waitForOverlayVisible(page, '#mainMenuOverlay');
    await waitForTransitionClear(page);
    await page.waitForSelector('#missionLaunchButton', { state: 'visible' });
}

async function startAdventure(page: Page) {
    const firstMissionCard = page.locator('.mission-card').first();
    if (await firstMissionCard.count()) {
        await firstMissionCard.click();
    }

    await waitForTransitionClear(page);
    await page.click('#missionLaunchButton');

    await waitForOverlayHidden(page, '#mainMenuOverlay');
    await waitForTransitionClear(page);
    await page.waitForTimeout(200);
}

async function waitForRuntimeReady(page: Page) {
    await page.waitForFunction(() => {
        const runtime = window.gameplayRuntime ?? window.__devHandles?.gameplayRuntime;
        if (!runtime) {
            return false;
        }
        return typeof runtime.getActiveCounts === 'function';
    }, { timeout: 15_000 });
}

async function getCounts(page: Page) {
    return await page.evaluate(() => {
        try {
            const runtime = window.gameplayRuntime ?? window.__devHandles?.gameplayRuntime;
            if (runtime && typeof runtime.getActiveCounts === 'function') {
                return runtime.getActiveCounts();
            }
        } catch {
            // ignore
        }
        return null;
    });
}

async function performFireSequence(page: Page): Promise<void> {
    await page.keyboard.down('Space');
    await page.waitForTimeout(220);
    await page.keyboard.up('Space');

    await page.mouse.down();
    await page.waitForTimeout(140);
    await page.mouse.up();
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

        await page.addInitScript(() => { window.__E2E__ = true; });
        await page.goto(BASE_URL);
        await waitForGameReady(page);
    });

    test('gameplay runtime exposes firing counts', async ({ page }) => {
        await startAdventure(page);
        await waitForRuntimeReady(page);

        await page.click('#gameCanvas');

        let before = await getCounts(page);
        if (!before) {
            await waitForRuntimeReady(page);
            before = await getCounts(page);
        }

        for (let attempt = 0; attempt < 3; attempt += 1) {
            await performFireSequence(page);
            await page.waitForTimeout(220);
        }

        const after = await getCounts(page);

        expect(before).not.toBeNull();
        expect(after).not.toBeNull();
        expect(after?.hasPlayer).toBeTruthy();
        expect((after?.bullets ?? 0)).toBeGreaterThanOrEqual(before?.bullets ?? 0);
    });
});
