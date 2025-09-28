const { test, expect } = require('@playwright/test');

const waitForGameplayScene = async (page) => {
  await page.waitForFunction(() => {
    return window.gameApp &&
      window.gameApp.sceneManager &&
      window.gameApp.sceneManager.getActiveName &&
      window.gameApp.sceneManager.getActiveName() === 'gameplay';
  });
};

test.describe('UFO Adventures', () => {
  test('loads main menu and enters gameplay', async ({ page }) => {
    await page.goto('/index.html');

    await expect(page.locator('#loadingScreen .loading-text')).toHaveText(/Select a mission/i, {
      timeout: 30_000,
    });

    const startButton = page.locator('#startGameButton');
    await expect(startButton).toBeVisible();
    await startButton.click();

    await waitForGameplayScene(page);
    await expect(page.locator('#loadingScreen')).toBeHidden();

    const initialX = await page.evaluate(() => {
      const runtime = window.gameApp.sceneManager.getActiveScene().runtime;
      const playerEntity = runtime.entities.find((entity) => entity.hasComponent && entity.hasComponent(Player));
      if (!playerEntity) {
        throw new Error('Player entity not found');
      }
      return playerEntity.getComponent(Transform).position.x;
    });

    await page.keyboard.down('ArrowRight');
    await page.waitForFunction((startX) => {
      const runtime = window.gameApp.sceneManager.getActiveScene().runtime;
      const playerEntity = runtime.entities.find((entity) => entity.hasComponent && entity.hasComponent(Player));
      if (!playerEntity) {
        return false;
      }
      return playerEntity.getComponent(Transform).position.x > startX;
    }, initialX);
    await page.keyboard.up('ArrowRight');

    const movedX = await page.evaluate(() => {
      const runtime = window.gameApp.sceneManager.getActiveScene().runtime;
      const playerEntity = runtime.entities.find((entity) => entity.hasComponent && entity.hasComponent(Player));
      return playerEntity.getComponent(Transform).position.x;
    });

    expect(movedX).toBeGreaterThan(initialX);
  });
});
