const { test, expect } = require('@playwright/test');

const LIVE_URL = process.env.LIVE_URL || 'https://factory-tasks-eta.vercel.app';

test.beforeEach(async ({ page }) => {
  await page.goto(LIVE_URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('production site loads and shows the app title', async ({ page }) => {
  await expect(page.locator('h1')).toHaveText('Factory Tasks');
});

test('production: can add a task', async ({ page }) => {
  await page.fill('#task-input', 'Production check');
  await page.click('#add-btn');
  await expect(page.locator('.task-text')).toHaveText('Production check');
});

test('production: can mark a task complete', async ({ page }) => {
  await page.fill('#task-input', 'Production check');
  await page.click('#add-btn');
  await page.click('.task input[type="checkbox"]');
  await expect(page.locator('.task')).toHaveClass(/done/);
});

test('production: can delete a task', async ({ page }) => {
  await page.fill('#task-input', 'Production check');
  await page.click('#add-btn');
  await page.click('.delete-btn');
  await expect(page.locator('.task')).toHaveCount(0);
});


test('production: Factory Console route loads', async ({ page }) => {
  await page.goto(LIVE_URL + '/console/');
  await expect(page.locator('h1')).toHaveText('Factory Console');
});
