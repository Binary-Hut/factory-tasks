const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('task creation reads the live Factory registry and keeps a bundled fallback', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../api/tasks.js'), 'utf8');
  assert.ok(source.includes('async function loadRegistry(token)'));
  assert.ok(source.includes('contents/.factory/projects.json?ref=main'));
  assert.ok(source.includes('return bundledRegistry'));
  assert.ok(source.includes('const registry = await loadRegistry(session.token)'));
  assert.ok(source.includes("find((item) => item.repository === repository)"));
});
