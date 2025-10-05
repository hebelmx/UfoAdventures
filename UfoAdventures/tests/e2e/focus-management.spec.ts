
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

test.describe('Focus Management', () => {
    test.beforeEach(async ({ page }) => {
        page.on('console', msg => console.log(`[console:${msg.type()}] ${msg.text()}`));
        page.on('pageerror', error => console.log(`[pageerror] ${error.message}`));
        page.on('requestfailed', request => console.log(`[requestfailed] ${request.url()} -> ${request.failure()?.errorText}`));

        await page.addInitScript(() => { window.__E2E__ = true; });
        await page.goto(BASE_URL);
        await waitForMainMenu(page);
    });

    test('should focus resume button on pause', async ({ page }) => {
        await launchAdventure(page);
        await waitForRuntimeReady(page);

        await page.keyboard.press('Escape');
        await waitForOverlayVisible(page, '#pauseOverlay');

        const resumeButton = page.locator('#pauseResumeButton');
        await expect(resumeButton).toBeFocused();
    });

    test('should focus music select on options', async ({ page }) => {
        await page.click('#menuOptionsButton');
        await waitForOverlayVisible(page, '#optionsOverlay');

        const musicSelect = page.locator('#optionsMusic');
        await expect(musicSelect).toBeFocused();
    });

    test('should focus return button on inventory', async ({ page }) => {
        await launchAdventure(page);
        await waitForRuntimeReady(page);

        await page.keyboard.press('i');
        await waitForOverlayVisible(page, '#inventoryOverlay');

        const returnButton = page.locator('#inventoryCloseButton');
        await expect(returnButton).toBeFocused();
    });
});
