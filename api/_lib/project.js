const ALLOWED_TYPES = new Set([
  'static-web',
  'web-app',
  'api-service',
  'mobile-app',
  'other'
]);

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function asInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : fallback;
}

function validateProjectRequest(input = {}) {
  const name = String(input.name || '').trim();
  const description = String(input.description || '').trim();
  const slug = slugify(input.slug || name);
  const projectType = String(input.project_type || 'web-app');
  const developerCalls = asInteger(input.developer_calls, 1);
  const reviewerCalls = asInteger(input.reviewer_calls, 1);

  const errors = [];

  if (name.length < 2 || name.length > 80) {
    errors.push('Project name must be between 2 and 80 characters.');
  }
  if (!slug || slug.length < 2) {
    errors.push('Project name must produce a valid repository name.');
  }
  if (description.length < 10 || description.length > 500) {
    errors.push('Description must be between 10 and 500 characters.');
  }
  if (!ALLOWED_TYPES.has(projectType)) {
    errors.push('Unsupported project type.');
  }
  if (developerCalls < 0 || developerCalls > 3) {
    errors.push('Developer AI-call budget must be between 0 and 3.');
  }
  if (reviewerCalls < 0 || reviewerCalls > 3) {
    errors.push('Reviewer AI-call budget must be between 0 and 3.');
  }

  return {
    ok: errors.length === 0,
    errors,
    project: {
      name,
      slug,
      description,
      project_type: projectType,
      deployment: 'none',
      agents: {
        planner: 'manual-claude',
        developer: 'codex',
        reviewer: 'gemini'
      },
      ai_budget: {
        developer_calls_per_stage: developerCalls,
        reviewer_calls_per_stage: reviewerCalls,
        automatic_retries: 0
      }
    }
  };
}

function projectDocs(project) {
  const title = project.name;
  return {
    'README.md': `# ${title}\n\n${project.description}\n\nThis repository was created by the Musical Hut Software Factory.\n`,
    'PRODUCT.md': `# PRODUCT.md — ${title}\n\n## Product goal\n\n${project.description}\n\n## Initial scope\n\nThe first planning task must convert this request into explicit user stories, acceptance criteria, and out-of-scope items before development begins.\n`,
    'ARCHITECTURE.md': `# ARCHITECTURE.md — ${title}\n\nArchitecture is intentionally not pre-selected. The Planner must propose the simplest architecture that satisfies PRODUCT.md and the owner must approve any backend, database, authentication, payments, or paid external service.\n`,
    'ROADMAP.md': `# ROADMAP.md — ${title}\n\n- [ ] Phase 1 — Clarify product requirements\n- [ ] Phase 2 — Approve architecture and testing strategy\n- [ ] Phase 3 — Build the smallest working MVP\n- [ ] Phase 4 — Independent review and deterministic verification\n- [ ] Phase 5 — Owner approval and deployment\n`,
    'PROJECT_REQUEST.md': `# Original project request\n\n**Name:** ${title}\n\n**Type:** ${project.project_type}\n\n**Description:** ${project.description}\n\n**Planner:** ${project.agents.planner}\n**Developer:** ${project.agents.developer}\n**Reviewer:** ${project.agents.reviewer}\n\n**Developer AI calls per stage:** ${project.ai_budget.developer_calls_per_stage}\n**Reviewer AI calls per stage:** ${project.ai_budget.reviewer_calls_per_stage}\n**Automatic retries:** 0\n`
  };
}

module.exports = {
  ALLOWED_TYPES,
  slugify,
  validateProjectRequest,
  projectDocs
};
