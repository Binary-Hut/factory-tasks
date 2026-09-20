const { test, expect } = require('@playwright/test');
const path = require('path');

const CONSOLE_URL = 'file://' + path.resolve(__dirname, '../console/index.html');

function mockGitHub(page, { failed = false } = {}) {
  return page.route('https://api.github.com/**', async (route) => {
    const url = route.request().url();

    if (url.includes('/actions/runs')) {
      const workflow_runs = [
        {
          name: 'Run Tests',
          head_branch: 'main',
          status: 'completed',
          conclusion: failed ? 'failure' : 'success',
          html_url: 'https://github.com/example/tests'
        },
        {
          name: 'Verify Production Site',
          head_branch: 'main',
          status: 'completed',
          conclusion: 'success',
          html_url: 'https://github.com/example/production'
        }
      ];

      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ workflow_runs })
      });
    }

    if (url.includes('/pulls?')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify([
          {
            number: 7,
            title: 'Example pull request',
            html_url: 'https://github.com/example/pr/7'
          }
        ])
      });
    }

    if (url.includes('/issues?')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify([
          {
            number: 6,
            title: 'Factory Console MVP',
            html_url: 'https://github.com/example/issues/6'
          }
        ])
      });
    }

    return route.fulfill({
      status: 404,
      contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: '{}'
    });
  });
}

test('console renders a healthy factory in plain language', async ({ page }) => {
  await mockGitHub(page);
  await page.goto(CONSOLE_URL);

  await expect(page.locator('h1')).toHaveText('Factory Console');
  await expect(page.locator('#health-title')).toHaveText('All systems healthy');
  await expect(page.locator('#health-detail')).toContainText('both passed');
});

test('console shows open work and friendly automation names', async ({ page }) => {
  await mockGitHub(page);
  await page.goto(CONSOLE_URL);

  await expect(page.locator('#open-work')).toContainText('Factory Console MVP');
  await expect(page.locator('#open-work')).toContainText('Example pull request');
  await expect(page.locator('#recent-runs')).toContainText('Automated tests');
  await expect(page.locator('#recent-runs')).toContainText('Live-site check');
  await expect(page.locator('#recent-runs')).toContainText('Passed');
});

test('console surfaces failed critical checks as needing attention', async ({ page }) => {
  await mockGitHub(page, { failed: true });
  await page.goto(CONSOLE_URL);

  await expect(page.locator('#health-title')).toHaveText('Needs attention');
  await expect(page.locator('#health-detail')).toContainText('failed');
});


test('console includes the owner-facing New Project surface', async ({ page }) => {
  await mockGitHub(page);
  await page.goto(CONSOLE_URL);

  await expect(page.getByRole('heading', { name: 'New project' })).toBeVisible();
  await expect(page.locator('#project-name')).toHaveAttribute('placeholder', 'Student Practice Tracker');
  await expect(page.locator('#create-project-btn')).toHaveText('Create project');
});

test('console points advanced controls at the Binary Hut factory repository', async ({ page }) => {
  await mockGitHub(page);
  await page.goto(CONSOLE_URL);

  await expect(page.getByRole('link', { name: 'Advanced' }))
    .toHaveAttribute('href', 'https://github.com/Binary-Hut/factory-tasks');
});


test('console source keeps all gated task lifecycle controls wired into task cards', async ({ page }) => {
  await page.goto(CONSOLE_URL);
  const source = await page.locator('html').evaluate(() => document.documentElement.innerHTML);
  expect(source).toContain('Start planning (');
  expect(source).toContain('Approve development');
  expect(source).toContain('Start development (1 AI call)');
  expect(source).toContain('Prepare review (no AI)');
  expect(source).toContain('Start review (1 AI call)');
  expect(source).toContain('Merge approved change');
  expect(source).toContain('reviewState + plan + approve + develop + retry + prepareReview + review + correction + reviewRetry + merge');
  expect(source).toContain('Retry Developer (1 AI call)');
  expect(source).toContain('Retry Reviewer (1 AI call)');
  expect(source).toContain('Start correction (1 AI call)');
});


test('Console exposes explicit project Planner settings', async ({ page }) => {
  const source = require('node:fs').readFileSync(require('node:path').resolve(__dirname, '../console/index.html'), 'utf8');
  expect(source).toContain('Save agent settings');
  expect(source).toContain('class="planner-setting"');
  expect(source).toContain('/api/project-settings');
  expect(source).toContain('agentOptions("planner"');
  expect(source).toContain('agent_catalog');
});


test('Console exposes catalog-driven Developer and Reviewer settings', async ({ page }) => {
  const source = require('node:fs').readFileSync(require('node:path').resolve(__dirname, '../console/index.html'), 'utf8');
  expect(source).toContain('class="developer-setting"');
  expect(source).toContain('class="reviewer-setting"');
  expect(source).toContain('agentOptions("developer"');
  expect(source).toContain('agentOptions("reviewer"');
});

test('Console shows task agent ownership, AI usage, and project budgets', async ({ page }) => {
  const source = require('node:fs').readFileSync(require('node:path').resolve(__dirname, '../console/index.html'), 'utf8');
  expect(source).toContain('AI calls recorded');
  expect(source).toContain('current_agent');
  expect(source).toContain('AI budget: Developer');
});
