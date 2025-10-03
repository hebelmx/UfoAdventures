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

async function waitForMainMenu(page: Page) {
    await waitForOverlayVisible(page, '#mainMenuOverlay');
    await waitForTransitionClear(page);
    await page.waitForSelector('.mission-card', { state: 'visible' });
}

async function launchAdventure(page: Page) {
    const firstMission = page.locator('.mission-card').first();
    if (await firstMission.count()) {
        await firstMission.click();
    }

    await page.click('#missionLaunchButton');
    await waitForOverlayHidden(page, '#mainMenuOverlay');
    await waitForTransitionClear(page);
}

async function waitForRuntimeReady(page: Page) {
    await page.waitForFunction(() => {
        const runtime = window.gameplayRuntime ?? window.__devHandles?.gameplayRuntime;
        if (!runtime) {
            return false;
        }
        return typeof runtime.getAbilitySnapshot === 'function' && typeof runtime.getActiveCounts === 'function';
    }, { timeout: 15_000 });
}

async function getAbilitySnapshot(page: Page) {
    return page.evaluate(() => {
        const runtime = window.gameplayRuntime ?? window.__devHandles?.gameplayRuntime;
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

        await page.addInitScript(() => { window.__E2E__ = true; });
        await page.goto(BASE_URL);
        await waitForMainMenu(page);
    });

    test('pause menu toggles via Escape', async ({ page }) => {
        await launchAdventure(page);
        await waitForRuntimeReady(page);

        await page.keyboard.press('Escape');

        await waitForOverlayVisible(page, '#pauseOverlay');
        await page.click('#pauseResumeButton');
        await waitForOverlayHidden(page, '#pauseOverlay');
        await waitForTransitionClear(page);
    });

    test('shield and stasis helpers available', async ({ page }) => {
        await launchAdventure(page);
        await waitForRuntimeReady(page);

        const initial = await getAbilitySnapshot(page);
        expect(initial).not.toBeNull();

        await page.keyboard.press('KeyO');
        await page.waitForTimeout(150);
        const shieldSnapshot = await getAbilitySnapshot(page);
        expect(shieldSnapshot).not.toBeNull();

        await page.keyboard.press('KeyP');
        await page.waitForTimeout(250);
        const stasisSnapshot = await getAbilitySnapshot(page);
        expect(stasisSnapshot).not.toBeNull();
        expect((stasisSnapshot?.stasisPaused ?? 0)).toBeGreaterThanOrEqual(0);
    });
});
