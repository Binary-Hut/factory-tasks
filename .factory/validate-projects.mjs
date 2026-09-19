import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function readJson(file) {
  const full = path.join(root, file);
  try {
    return JSON.parse(fs.readFileSync(full, 'utf8'));
  } catch (error) {
    throw new Error(`${file}: ${error.message}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function isSlug(value) {
  return typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

const registry = readJson('.factory/projects.json');
const template = readJson('.factory/project-template.json');

assert(registry.schema_version === 1, 'projects.json: unsupported schema_version');
assert(template.schema_version === 1, 'project-template.json: unsupported schema_version');
assert(Array.isArray(registry.projects), 'projects.json: projects must be an array');

const allowedTypes = new Set(template.allowed_project_types || []);
const allowedDeployments = new Set(template.allowed_deployments || []);
const ids = new Set();
const repos = new Set();

for (const project of registry.projects) {
  assert(isSlug(project.id), `project id must be a lowercase slug: ${project.id}`);
  assert(typeof project.name === 'string' && project.name.trim(), `${project.id}: name is required`);
  assert(typeof project.repository === 'string' && /^[^/]+\/[^/]+$/.test(project.repository),
    `${project.id}: repository must be owner/name`);
  assert(allowedTypes.has(project.project_type),
    `${project.id}: unsupported project_type "${project.project_type}"`);
  assert(['active', 'paused', 'archived', 'provisioning'].includes(project.lifecycle_status),
    `${project.id}: invalid lifecycle_status`);

  assert(project.deployment && allowedDeployments.has(project.deployment.provider),
    `${project.id}: unsupported deployment provider`);

  assert(project.agents && typeof project.agents === 'object',
    `${project.id}: agents configuration is required`);
  for (const role of ['planner', 'developer', 'reviewer']) {
    assert(typeof project.agents[role] === 'string' && project.agents[role],
      `${project.id}: agents.${role} is required`);
  }

  assert(project.ai_budget && typeof project.ai_budget === 'object',
    `${project.id}: ai_budget is required`);
  for (const key of ['developer_calls_per_stage', 'reviewer_calls_per_stage', 'automatic_retries']) {
    const value = project.ai_budget[key];
    assert(Number.isInteger(value) && value >= 0,
      `${project.id}: ai_budget.${key} must be a non-negative integer`);
  }

  assert(!ids.has(project.id), `duplicate project id: ${project.id}`);
  assert(!repos.has(project.repository), `duplicate repository: ${project.repository}`);
  ids.add(project.id);
  repos.add(project.repository);
}

assert(template.security?.browser_write_tokens_allowed === false,
  'project-template.json: browser write tokens must remain disabled');
assert(template.security?.central_server_credential_required_for_repo_creation === true,
  'project-template.json: repo creation must require a trusted server credential');

const copyFiles = template.starter_files?.copy_from_factory || [];
const generatedFiles = template.starter_files?.generate_for_project || [];
const configuredFiles = template.starter_files?.configure_per_project || [];

for (const file of [...copyFiles, ...generatedFiles, ...configuredFiles]) {
  assert(typeof file === 'string' && file.length > 0, 'starter file entries must be non-empty strings');
}

const overlap = [...copyFiles, ...generatedFiles, ...configuredFiles]
  .filter((file, index, all) => all.indexOf(file) !== index);
assert(overlap.length === 0, `starter file groups overlap: ${[...new Set(overlap)].join(', ')}`);

console.log(`Factory registry valid: ${registry.projects.length} project(s).`);
console.log(`Shared starter files: ${copyFiles.length}; generated: ${generatedFiles.length}; configured: ${configuredFiles.length}.`);
