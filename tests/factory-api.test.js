const test = require('node:test');
const assert = require('node:assert/strict');

const {
  encryptSession,
  decryptSession,
  getConfig,
  isConfigured
} = require('../lib/factory-auth');
const {
  slugify,
  validateProjectRequest,
  repositoryDescription,
  projectDocs
} = require('../lib/factory-project');

const SECRET = 'this-is-a-test-session-secret-with-enough-length';

test('project request validation normalizes a safe repository slug', () => {
  const result = validateProjectRequest({
    name: 'Student Practice Tracker',
    description: 'Track student practice submissions and tutor feedback.',
    project_type: 'web-app',
    developer_calls: 1,
    reviewer_calls: 1
  });

  assert.equal(result.ok, true);
  assert.equal(result.project.slug, 'student-practice-tracker');
  assert.equal(result.project.ai_budget.automatic_retries, 0);
});

test('project request rejects excessive AI-call budgets', () => {
  const result = validateProjectRequest({
    name: 'Safe Project',
    description: 'A sufficiently detailed project description for validation.',
    project_type: 'web-app',
    developer_calls: 10,
    reviewer_calls: 1
  });

  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /Developer AI-call budget/);
});

test('slugify removes unsafe repository-name characters', () => {
  assert.equal(slugify('  My Project!!! 2026  '), 'my-project-2026');
});

test('encrypted session round-trips and expires', () => {
  const start = 1_000_000;
  const encrypted = encryptSession({ token: 'secret-token', login: 'MusicalHut' }, SECRET, start);

  const live = decryptSession(encrypted, SECRET, start + 1000);
  assert.equal(live.login, 'MusicalHut');
  assert.equal(live.token, 'secret-token');

  const expired = decryptSession(encrypted, SECRET, start + (9 * 60 * 60 * 1000));
  assert.equal(expired, null);
});

test('encrypted session rejects tampering', () => {
  const encrypted = encryptSession({ token: 'secret-token', login: 'MusicalHut' }, SECRET);
  const tampered = encrypted.slice(0, -2) + 'aa';
  assert.equal(decryptSession(tampered, SECRET), null);
});

test('factory configuration separates the authorized user from the destination organization', () => {
  const config = getConfig({
    GITHUB_OAUTH_CLIENT_ID: 'client',
    GITHUB_OAUTH_CLIENT_SECRET: 'secret',
    FACTORY_SESSION_SECRET: SECRET,
    FACTORY_GITHUB_OWNER: 'MusicalHut',
    FACTORY_GITHUB_ORGANIZATION: 'Binary-Hut'
  });

  assert.equal(config.owner, 'MusicalHut');
  assert.equal(config.organization, 'Binary-Hut');
});

test('factory configuration defaults new repositories to Binary Hut', () => {
  assert.equal(getConfig({}).organization, 'Binary-Hut');
});

test('provisioning configuration requires all server-side secrets', () => {
  assert.equal(isConfigured({
    GITHUB_OAUTH_CLIENT_ID: 'client',
    GITHUB_OAUTH_CLIENT_SECRET: 'secret',
    FACTORY_SESSION_SECRET: SECRET
  }), true);

  assert.equal(isConfigured({
    GITHUB_OAUTH_CLIENT_ID: 'client',
    GITHUB_OAUTH_CLIENT_SECRET: '',
    FACTORY_SESSION_SECRET: SECRET
  }), false);
});


test('generated project agent rules are project-neutral', () => {
  const validation = validateProjectRequest({
    name: 'Tutor Mobile Companion',
    description: 'A mobile companion for tutors to manage lesson workflows.',
    project_type: 'mobile-app',
    developer_calls: 1,
    reviewer_calls: 1
  });

  assert.equal(validation.ok, true);
  const docs = projectDocs(validation.project);
  assert.match(docs['AGENTS.md'], /Project type: mobile-app/);
  assert.match(docs['AGENTS.md'], /do not assume a static site, web framework, backend, database, or mobile stack in advance/i);
  assert.doesNotMatch(docs['AGENTS.md'], /Keep the app as a single/);
  assert.doesNotMatch(docs['AGENTS.md'], /Do not create a mobile app/);
  assert.match(docs['AGENTS.md'], /AI_POLICY\.md/);
});


test('project request accepts detailed briefs longer than the old 500-character limit', () => {
  const result = validateProjectRequest({
    name: 'Detailed Project',
    description: 'Build a detailed project with clear requirements. '.repeat(30),
    project_type: 'web-app',
    developer_calls: 1,
    reviewer_calls: 1
  });

  assert.equal(result.ok, true);
  assert.ok(result.project.description.length > 500);
});

test('project request rejects only unreasonably large transport payloads', () => {
  const result = validateProjectRequest({
    name: 'Oversized Project',
    description: 'x'.repeat(50001),
    project_type: 'web-app',
    developer_calls: 1,
    reviewer_calls: 1
  });

  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /too large to process safely/i);
});


test('repository metadata stays short while generated docs preserve the full brief', () => {
  const longBrief = 'Practice timer requirement with musical design and detailed behavior. '.repeat(20);
  const result = validateProjectRequest({
    name: 'Practice Timer',
    description: longBrief,
    project_type: 'web-app',
    developer_calls: 1,
    reviewer_calls: 1
  });

  assert.equal(result.ok, true);
  const shortDescription = repositoryDescription(result.project);
  assert.ok(shortDescription.length <= 300);
  assert.ok(shortDescription.endsWith('…'));

  const docs = projectDocs(result.project);
  assert.ok(docs['PROJECT_REQUEST.md'].includes(longBrief.trim()));
  assert.ok(docs['PRODUCT.md'].includes(longBrief.trim()));
});

test('project template provisions the core factory workflow set', () => {
  const template = require('../.factory/project-template.json');
  const copied = template.starter_files.copy_from_factory.join('\n');
  assert.match(copied, /codex-feature-developer\.yml/);
  assert.match(copied, /gemini-review\.yml/);
  assert.match(copied, /branch-collision-guard\.yml/);
  assert.match(copied, /workflows\/test\.yml/);
  assert.deepEqual(template.security.oauth_scopes_required, ['public_repo', 'workflow']);
});

test('OAuth workflow permission is part of the project provisioning contract', () => {
  const template = require('../.factory/project-template.json');
  assert.ok(template.security.oauth_scopes_required.includes('workflow'));
});


test('project provisioner targets the Binary Hut organization endpoint', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const source = fs.readFileSync(path.resolve(__dirname, '../api/projects.js'), 'utf8');

  assert.match(source, /api\.github\.com\/orgs\/\$\{encodeURIComponent\(organization\)\}\/repos/);
  assert.doesNotMatch(source, /api\.github\.com\/user\/repos/);
  assert.match(source, /Binary-Hut\/factory-tasks/);
});


test('Developer workflow accepts explicitly approved correction state', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const source = fs.readFileSync(path.resolve(__dirname, '../.factory/workflows/codex-feature-developer.yml'), 'utf8');
  assert.match(source, /READY_FOR_CORRECTION/);
});

test('paid AI dispatch locks are scoped to the current plan generation', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const source = fs.readFileSync(path.resolve(__dirname, '../api/task-actions.js'), 'utf8');
  assert.match(source, /const generation = String\(plan\.sha/);
  assert.doesNotMatch(source, /acquireDispatchLock\(repository, branch, planPath, 'correction'.*\n.*const updated/s);
});


test('merge gate requires successful deterministic GitHub Actions for the PR head', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const source = fs.readFileSync(path.resolve(__dirname, '../api/task-actions.js'), 'utf8');
  assert.match(source, /actions\/runs\?head_sha=/);
  assert.match(source, /\['Run Tests', 'Branch Collision Guard'\]/);
  assert.match(source, /run\.status !== 'completed' \|\| run\.conclusion !== 'success'/);
  assert.match(source, /combined\.state === 'pending'/);
});


test('lifecycle actions require a single-task branch and matching plan workspace', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const source = fs.readFileSync(path.resolve(__dirname, '../api/task-actions.js'), 'utf8');
  assert.match(source, /branchMatch = branch\.match/);
  assert.match(source, /planMatch = planPath\.match/);
  assert.match(source, /branchMatch\[1\] !== planMatch\[1\]/);
  assert.match(source, /branch\.includes\('\.\.'\)/);
  assert.match(source, /planPath\.includes\('\.\.'\)/);
});


test('new project provisioning registers the repository and includes the Tester role', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const source = fs.readFileSync(path.resolve(__dirname, '../api/projects.js'), 'utf8');
  const template = require('../.factory/project-template.json');
  assert.match(source, /async function registerProject/);
  assert.match(source, /await registerProject\(project, createdRepo\.full_name, session\.token\)/);
  assert.match(source, /\.ai\/roles\/TESTER\.md/);
  assert.ok(template.starter_files.copy_from_factory.includes('.ai/roles/TESTER.md'));
});


test('project template provisions an explicitly dispatched Planner workflow', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const template = require('../.factory/project-template.json');
  const source = fs.readFileSync(path.resolve(__dirname, '../api/task-actions.js'), 'utf8');
  const workflow = fs.readFileSync(path.resolve(__dirname, '../.factory/workflows/gemini-planner.yml'), 'utf8');
  assert.ok(template.starter_files.copy_from_factory.includes('.factory/workflows/gemini-planner.yml -> .github/workflows/gemini-planner.yml'));
  assert.match(source, /action === 'start-planning'/);
  assert.match(source, /configuredAgent\(project, 'planner'\)/);
  assert.match(source, /planner\.workflow/);
  assert.match(source, /model: planner\.model/);
  assert.match(source, /async function loadRegistry/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /Status: READY_FOR_APPROVAL/);
  assert.match(workflow, /gemini_model: \$\{\{ inputs\.model \}\}/);
});


test('project agent settings are owner-authenticated, same-origin, and Planner allowlisted', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const source = fs.readFileSync(path.resolve(__dirname, '../api/project-settings.js'), 'utf8');
  const registry = fs.readFileSync(path.resolve(__dirname, '../api/project-registry.js'), 'utf8');
  assert.match(source, /sameOrigin\(req\)/);
  assert.match(source, /session\.login\.toLowerCase\(\) !== config\.owner\.toLowerCase\(\)/);
  assert.match(source, /agentCatalog\.roles\?\.\[role\]\?\.options/);
  assert.match(source, /sha: file\.sha/);
  assert.match(registry, /async function liveRegistry/);
  const catalog = require('../.factory/agents.json');
  assert.ok(Array.isArray(catalog.roles.planner.options));
  assert.ok(catalog.roles.planner.options.some((option) => option.id === 'gemini' && option.model));
});


test('merge approval is bound to the exact PR head reviewed by the independent reviewer', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const actions = fs.readFileSync(path.resolve(__dirname, '../api/task-actions.js'), 'utf8');
  const tasks = fs.readFileSync(path.resolve(__dirname, '../api/project-tasks.js'), 'utf8');
  const workflow = fs.readFileSync(path.resolve(__dirname, '../.factory/workflows/gemini-review.yml'), 'utf8');
  assert.match(workflow, /factory-reviewed-sha:%s/);
  assert.match(workflow, /REVIEWED_SHA:/);
  assert.match(actions, /requireReviewForHead\(repository, prNumber, pr\.head\.sha/);
  assert.match(actions, /comment\.user\?\.login === 'github-actions\[bot\]'/);
  assert.match(tasks, /if \(!currentReview\) review = 'STALE'/);
});


test('project provisioning rejects cross-origin browser requests before mutation', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const source = fs.readFileSync(path.resolve(__dirname, '../api/projects.js'), 'utf8');
  assert.match(source, /function sameOrigin\(req\)/);
  assert.match(source, /sec-fetch-site/);
  assert.match(source, /if \(!sameOrigin\(req\)\)/);
  assert.match(source, /Cross-origin project provisioning is not allowed/);
});


test('project task discovery uses the live registry with a bundled fallback', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const source = fs.readFileSync(path.resolve(__dirname, '../api/project-tasks.js'), 'utf8');
  assert.match(source, /async function loadRegistry\(token\)/);
  assert.match(source, /\.factory\/projects\.json\?ref=main/);
  assert.match(source, /return bundledRegistry/);
  assert.match(source, /registered\(registry, repository\)/);
});


test('Developer and Reviewer dispatch use the extensible agent catalog', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const actions = fs.readFileSync(path.resolve(__dirname, '../api/task-actions.js'), 'utf8');
  const settings = fs.readFileSync(path.resolve(__dirname, '../api/project-settings.js'), 'utf8');
  const developer = fs.readFileSync(path.resolve(__dirname, '../.factory/workflows/codex-feature-developer.yml'), 'utf8');
  const reviewer = fs.readFileSync(path.resolve(__dirname, '../.factory/workflows/gemini-review.yml'), 'utf8');
  assert.match(settings, /developer: String\(body\.developer/);
  assert.match(settings, /reviewer: String\(body\.reviewer/);
  assert.match(actions, /configuredAgent\(project, 'developer'\)/);
  assert.match(actions, /configuredAgent\(project, 'reviewer'\)/);
  assert.match(actions, /model: developer\.model/);
  assert.match(actions, /model: reviewer\.model/);
  assert.match(developer, /model: \$\{\{ inputs\.model \}\}/);
  assert.match(reviewer, /gemini_model: \$\{\{ inputs\.model \}\}/);
  assert.doesNotMatch(reviewer, /pull_request:\s*\n/);
});
