const { test, expect } = require('@playwright/test');

test.describe('UFO Adventures', () => {
  test('boot status', async ({ page }) => {
    await page.addInitScript(() => { window.__E2E__ = true; });
    await page.goto('/index.html');

    const status = await page.evaluate(() => ({
      hasGameApp: typeof window.gameApp !== 'undefined',
      hasGameApplicationClass: typeof GameApplication !== 'undefined',
      hasSceneManager: window.gameApp?.sceneManager ? true : false
    }));
    console.log(status);
  });
});
