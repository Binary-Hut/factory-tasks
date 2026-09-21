const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

test('local LLM is a first-class independent agent option for all AI roles', () => {
  const catalog = JSON.parse(read('.factory/agents.json'));
  for (const role of ['planner', 'developer', 'reviewer']) {
    const option = catalog.roles[role].options.find((item) => item.id === 'local-llm');
    expect(option).toBeTruthy();
    expect(option.provider).toBe('local');
    expect(option.runtime_model).toBe(true);
    expect(option.workflow).toMatch(/^local-llm-(planner|developer|review)\.yml$/);
  }
});

test('local LLM client uses native local adapters and no OpenAI dependency', () => {
  const source = read('.factory/local-llm-client.mjs');
  expect(source).toContain("adapter === 'ollama'");
  expect(source).toContain("adapter === 'generic-http'");
  expect(source).toContain("'/api/chat'");
  expect(source).toContain("JSON.stringify({ model, prompt })");
  expect(source).not.toContain('api.openai.com');
  expect(source).not.toContain('OPENAI_API_KEY');
  expect(source).not.toContain('@openai');
});

test('local agent workflows run only on the dedicated self-hosted runner label', () => {
  for (const file of [
    '.factory/workflows/local-llm-planner.yml',
    '.factory/workflows/local-llm-developer.yml',
    '.factory/workflows/local-llm-review.yml'
  ]) {
    const source = read(file);
    expect(source).toContain('runs-on: [self-hosted, factory-local-llm]');
    expect(source).toContain('LOCAL_LLM_MODEL');
    expect(source).toContain('LOCAL_LLM_ADAPTER');
    expect(source).not.toContain('OPENAI_API_KEY');
    expect(source).not.toContain('GEMINI_API_KEY');
  }
});

test('new projects receive local-agent workflows and local client', () => {
  const provisioner = read('api/projects.js');
  expect(provisioner).toContain(".factory/local-llm-client.mjs");
  expect(provisioner).toContain("local-llm-planner.yml");
  expect(provisioner).toContain("local-llm-developer.yml");
  expect(provisioner).toContain("local-llm-review.yml");

  const template = JSON.parse(read('.factory/project-template.json'));
  const copy = template.starter_files.copy_from_factory.join('\n');
  expect(copy).toContain('.factory/local-llm-client.mjs');
  expect(copy).toContain('local-llm-planner.yml');
  expect(copy).toContain('local-llm-developer.yml');
  expect(copy).toContain('local-llm-review.yml');
});

test('lifecycle accepts a runtime-configured local model without hardcoding a model name', () => {
  const actions = read('api/task-actions.js');
  expect(actions).toContain('runtime_model');
  expect(actions).toContain("developer.runtime_model ? '' : developer.model");
  expect(actions).toContain("reviewer.runtime_model ? '' : reviewer.model");
});
