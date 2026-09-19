const { test, expect } = require('@playwright/test');
const path = require('path');

const appPath = 'file://' + path.join(__dirname, '..', 'index.html');

test.beforeEach(async ({ page }) => {
  await page.goto(appPath);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('can add a task', async ({ page }) => {
  await page.fill('#task-input', 'Buy milk');
  await page.click('#add-btn');
  await expect(page.locator('.task-text')).toHaveText('Buy milk');
});

test('can mark a task complete', async ({ page }) => {
  await page.fill('#task-input', 'Buy milk');
  await page.click('#add-btn');
  await page.click('.task input[type="checkbox"]');
  await expect(page.locator('.task')).toHaveClass(/done/);
});

test('can un-mark a completed task', async ({ page }) => {
  await page.fill('#task-input', 'Buy milk');
  await page.click('#add-btn');
  const checkbox = page.locator('.task input[type="checkbox"]');
  await checkbox.click();
  await checkbox.click();
  await expect(page.locator('.task')).not.toHaveClass(/done/);
});

test('can delete a task', async ({ page }) => {
  await page.fill('#task-input', 'Buy milk');
  await page.click('#add-btn');
  await page.click('.delete-btn');
  await expect(page.locator('.task')).toHaveCount(0);
});

test('deleting one task does not delete others', async ({ page }) => {
  await page.fill('#task-input', 'Task A');
  await page.click('#add-btn');
  await page.fill('#task-input', 'Task B');
  await page.click('#add-btn');
  await page.fill('#task-input', 'Task C');
  await page.click('#add-btn');
  await page.locator('.task', { hasText: 'Task B' }).locator('.delete-btn').click();
  await expect(page.locator('.task')).toHaveCount(2);
  await expect(page.locator('.task-text', { hasText: 'Task A' })).toBeVisible();
  await expect(page.locator('.task-text', { hasText: 'Task C' })).toBeVisible();
  await expect(page.locator('.task-text', { hasText: 'Task B' })).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.task-text')).toHaveText(['Task A', 'Task C']);
});

test('counter shows 0 tasks remaining with no tasks', async ({ page }) => {
  await expect(page.locator('#task-counter')).toHaveText('0 tasks remaining');
});

test('counter updates when adding and marking tasks', async ({ page }) => {
  await page.fill('#task-input', 'First');
  await page.click('#add-btn');
  await expect(page.locator('#task-counter')).toHaveText('1 task remaining');

  await page.fill('#task-input', 'Second');
  await page.click('#add-btn');
  await expect(page.locator('#task-counter')).toHaveText('2 tasks remaining');

  await page.locator('.task').first().locator('input[type="checkbox"]').click();
  await expect(page.locator('#task-counter')).toHaveText('1 task remaining');

  await page.locator('.task').first().locator('input[type="checkbox"]').click();
  await expect(page.locator('#task-counter')).toHaveText('2 tasks remaining');
});

test('counter unaffected when deleting completed task but decrements when deleting incomplete', async ({ page }) => {
  await page.fill('#task-input', 'A');
  await page.click('#add-btn');
  await page.fill('#task-input', 'B');
  await page.click('#add-btn');

  await page.locator('.task', { hasText: 'A' }).locator('input[type="checkbox"]').click();
  await expect(page.locator('#task-counter')).toHaveText('1 task remaining');

  await page.locator('.task', { hasText: 'A' }).locator('.delete-btn').click();
  await expect(page.locator('#task-counter')).toHaveText('1 task remaining');

  await page.locator('.task', { hasText: 'B' }).locator('.delete-btn').click();
  await expect(page.locator('#task-counter')).toHaveText('0 tasks remaining');
});

test('counter persists after reload', async ({ page }) => {
  await page.fill('#task-input', 'Persist');
  await page.click('#add-btn');
  await expect(page.locator('#task-counter')).toHaveText('1 task remaining');
  await page.reload();
  await expect(page.locator('#task-counter')).toHaveText('1 task remaining');
});
