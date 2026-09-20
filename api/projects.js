const { getConfig, isConfigured, readSession } = require('../lib/factory-auth');
const { validateProjectRequest, repositoryDescription, projectDocs } = require('../lib/factory-project');

const SOURCE_REPO = 'Binary-Hut/factory-tasks';
const COPY_FILES = [
  ['AI_POLICY.md', 'AI_POLICY.md'],
  ['.ai/WORKFLOW_STATE.md', '.ai/WORKFLOW_STATE.md'],
  ['.ai/BRANCH_OWNERSHIP.md', '.ai/BRANCH_OWNERSHIP.md'],
  ['.ai/roles/PLANNER.md', '.ai/roles/PLANNER.md'],
  ['.ai/roles/DEVELOPER.md', '.ai/roles/DEVELOPER.md'],
  ['.ai/roles/REVIEWER.md', '.ai/roles/REVIEWER.md'],
  ['.ai/roles/TESTER.md', '.ai/roles/TESTER.md'],
  ['.factory/workflows/test.yml', '.github/workflows/test.yml'],
  ['.factory/workflows/branch-collision-guard.yml', '.github/workflows/branch-collision-guard.yml'],
  ['.factory/workflows/codex-feature-developer.yml', '.github/workflows/codex-feature-developer.yml'],
  ['.factory/workflows/gemini-review.yml', '.github/workflows/gemini-review.yml']
];

async function github(url, token, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Accept': 'application/vnd.github+json',
      'Authorization': `Bearer ${token}`,
      'X-GitHub-Api-Version': '2026-03-10',
      ...(options.headers || {})
    }
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || `GitHub returned ${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

async function createFile(owner, repo, path, contentBase64, token) {
  return github(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path.split('/').map(encodeURIComponent).join('/')}`,
    token,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `Factory setup: add ${path}`,
        content: contentBase64
      })
    }
  );
}

async function sourceFile(path, token) {
  const data = await github(
    `https://api.github.com/repos/${SOURCE_REPO}/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=main`,
    token
  );
  if (!data.content) throw new Error(`Factory source file is unavailable: ${path}`);
  return String(data.content).replace(/\n/g, '');
}

async function registerProject(project, repository, token) {
  const path = '.factory/projects.json';
  const data = await github(`https://api.github.com/repos/${SOURCE_REPO}/contents/${path}?ref=main`, token);
  const registry = JSON.parse(Buffer.from(String(data.content || '').replace(/\n/g, ''), 'base64').toString('utf8'));
  if ((registry.projects || []).some((item) => item.repository === repository)) return;
  registry.projects.push({
    id: project.slug,
    name: project.name,
    repository,
    project_type: project.project_type,
    lifecycle_status: 'active',
    deployment: { provider: project.deployment || 'none', live_url: null },
    agents: project.agents,
    ai_budget: project.ai_budget
  });
  await github(`https://api.github.com/repos/${SOURCE_REPO}/contents/${path}`, token, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: `Register factory project: ${project.name}`,
      content: Buffer.from(JSON.stringify(registry, null, 2) + '\n').toString('base64'),
      sha: data.sha,
      branch: 'main'
    })
  });
}

function base64(text) {
  return Buffer.from(text, 'utf8').toString('base64');
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!isConfigured()) {
    return res.status(503).json({
      error: 'Secure project provisioning is not configured yet.'
    });
  }

  const session = readSession(req);
  const config = getConfig();
  const authorizedLogin = config.owner;
  const organization = config.organization;

  if (!session || session.login.toLowerCase() !== authorizedLogin.toLowerCase()) {
    return res.status(401).json({ error: 'Sign in with the authorized GitHub account first.' });
  }

  if (!Array.isArray(session.scopes) || !session.scopes.includes('workflow')) {
    return res.status(403).json({
      error: 'Reconnect GitHub once to allow the factory to install GitHub Actions workflows.'
    });
  }

  let body = req.body || {};
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ error: 'Invalid JSON request.' });
    }
  }

  const validation = validateProjectRequest(body);
  if (!validation.ok) {
    return res.status(400).json({
      error: 'Please correct the project details.',
      details: validation.errors
    });
  }

  const project = validation.project;
  let createdRepo = null;

  try {
    createdRepo = await github(`https://api.github.com/orgs/${encodeURIComponent(organization)}/repos`, session.token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: project.slug,
        description: repositoryDescription(project),
        private: false,
        auto_init: false,
        has_issues: true,
        has_projects: false,
        has_wiki: false
      })
    });

    const docs = projectDocs(project);

    // README is intentionally first: GitHub's Contents API can initialize an
    // empty repository when the first file is created.
    await createFile(organization, project.slug, 'README.md', base64(docs['README.md']), session.token);

    for (const [path, content] of Object.entries(docs)) {
      if (path === 'README.md') continue;
      await createFile(organization, project.slug, path, base64(content), session.token);
    }

    await createFile(
      organization,
      project.slug,
      '.factory/project.json',
      base64(JSON.stringify({
        schema_version: 1,
        created_by: 'factory-console',
        project
      }, null, 2) + '\n'),
      session.token
    );

    for (const [sourcePath, destinationPath] of COPY_FILES) {
      const content = await sourceFile(sourcePath, session.token);
      await createFile(organization, project.slug, destinationPath, content, session.token);
    }

    await registerProject(project, createdRepo.full_name, session.token);

    return res.status(201).json({
      ok: true,
      project,
      repository: createdRepo.full_name,
      repository_url: createdRepo.html_url,
      next: 'Repository created, registered in Factory, and configured with factory workflows. Planning can begin; no AI agent was started automatically.'
    });
  } catch (error) {
    const validationDetails = Array.isArray(error.data?.errors)
      ? error.data.errors
          .map((item) => typeof item === 'string' ? item : item?.message || item?.code || item?.field)
          .filter(Boolean)
          .slice(0, 3)
      : [];

    const response = {
      error: error.status === 422
        ? 'GitHub could not create this project. The repository name may already exist.'
        : 'Project provisioning stopped before completion.',
      detail: error.message
    };

    if (validationDetails.length) {
      response.validation_details = validationDetails;
    }

    if (createdRepo?.html_url) {
      response.repository_url = createdRepo.html_url;
      response.recovery = 'The repository was created but setup was incomplete. Do not create a duplicate; resume setup on this repository.';
    }

    return res.status(error.status === 422 ? 409 : 502).json(response);
  }
};
