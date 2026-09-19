const test = require('node:test');
const assert = require('node:assert/strict');

const {
  encryptSession,
  decryptSession,
  isConfigured
} = require('../api/_lib/auth');
const {
  slugify,
  validateProjectRequest
} = require('../api/_lib/project');

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
