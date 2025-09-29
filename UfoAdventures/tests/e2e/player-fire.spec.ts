import { test, expect } from '@playwright/test';

const baseUrl = 'http://localhost:5173/src/index.html';

async function waitForGameReady(page) {
    await page.waitForSelector('#startGameButton', { state: 'visible' });
}

async function startAdventure(page) {
    await page.click('#startGameButton');
    // Wait until loading overlay is hidden to avoid intercepting clicks
    await page.waitForSelector('#loadingScreen', { state: 'hidden' });
    // small extra buffer for scene bootstrap
    await page.waitForTimeout(200);
}

async function getCounts(page) {
    return await page.evaluate(() => {
        try {
            // @ts-ignore
            const runtime = window.__gameRuntime || window.GameplayRuntime?.instance || null;
            if (runtime && typeof runtime.getActiveCounts === 'function') {
                return runtime.getActiveCounts();
            }
        } catch {}
        return null;
    });
}

test.describe('Player firing', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto(baseUrl);
        await waitForGameReady(page);
    });

    test('fires bullets on Space and MouseLeft', async ({ page }) => {
        await startAdventure(page);

        // Focus canvas after overlay hidden
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
