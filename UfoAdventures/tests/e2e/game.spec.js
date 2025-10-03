const { test, expect } = require('@playwright/test');

test.describe('UFO Adventures', () => {
  test('boot status', async ({ page }) => {
    await page.addInitScript(() => { window.__E2E__ = true; });
    await page.goto('/index.html');

    const status = await page.evaluate(() => {
      const app = window.gameApp ?? window.__devHandles?.gameApp;
      return {
        hasGameApp: typeof app !== 'undefined' && app !== null,
        hasGameApplicationClass: typeof GameApplication !== 'undefined',
        hasSceneManager: !!app?.getSceneManager?.()
      };
    });
    console.log(status);
  });
});
