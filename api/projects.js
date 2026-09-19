const { getConfig, isConfigured, readSession } = require('../lib/factory-auth');
const { validateProjectRequest, repositoryDescription, projectDocs } = require('../lib/factory-project');

const SOURCE_REPO = 'MusicalHut/factory-tasks';
const COPY_FILES = [
  'AI_POLICY.md',
  '.ai/WORKFLOW_STATE.md',
  '.ai/BRANCH_OWNERSHIP.md',
  '.ai/roles/PLANNER.md',
  '.ai/roles/DEVELOPER.md',
  '.ai/roles/REVIEWER.md'
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
  const owner = getConfig().owner;

  if (!session || session.login.toLowerCase() !== owner.toLowerCase()) {
    return res.status(401).json({ error: 'Sign in with the authorized GitHub account first.' });
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
    createdRepo = await github('https://api.github.com/user/repos', session.token, {
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
    await createFile(owner, project.slug, 'README.md', base64(docs['README.md']), session.token);

    for (const [path, content] of Object.entries(docs)) {
      if (path === 'README.md') continue;
      await createFile(owner, project.slug, path, base64(content), session.token);
    }

    await createFile(
      owner,
      project.slug,
      '.factory/project.json',
      base64(JSON.stringify({
        schema_version: 1,
        created_by: 'factory-console',
        project
      }, null, 2) + '\n'),
      session.token
    );

    for (const path of COPY_FILES) {
      const content = await sourceFile(path, session.token);
      await createFile(owner, project.slug, path, content, session.token);
    }

    return res.status(201).json({
      ok: true,
      project,
      repository: createdRepo.full_name,
      repository_url: createdRepo.html_url,
      next: 'Repository created. Planning can begin; no AI agent was started automatically.'
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
