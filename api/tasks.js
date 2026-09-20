const { getConfig, isConfigured, readSession } = require('../lib/factory-auth');
const registry = require('../.factory/projects.json');

async function github(url, token, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2026-03-10',
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || `GitHub returned ${response.status}`);
  return data;
}

function sameOrigin(req) {
  const origin = req.headers.origin;
  const site = req.headers['sec-fetch-site'];
  if (site && !['same-origin', 'same-site', 'none'].includes(site)) return false;
  if (!origin) return site === 'same-origin' || site === 'same-site' || site === 'none';
  const host = req.headers.host;
  return origin === `https://${host}` || origin === `http://${host}`;
}

function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'change';
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!sameOrigin(req)) return res.status(403).json({ error: 'Cross-origin task creation is not allowed.' });
  if (!isConfigured()) return res.status(503).json({ error: 'Factory authentication is not configured.' });

  const session = readSession(req);
  const config = getConfig();
  if (!session || session.login.toLowerCase() !== config.owner.toLowerCase()) {
    return res.status(401).json({ error: 'Sign in with the authorized GitHub account first.' });
  }

  let body = req.body || {};
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { return res.status(400).json({ error: 'Invalid JSON request.' }); }
  }
  const repository = String(body.repository || '').trim();
  const request = String(body.request || '').trim();
  const project = (registry.projects || []).find((item) => item.repository === repository);
  if (!project) return res.status(400).json({ error: 'Choose a registered factory project.' });
  if (request.length < 5 || request.length > 50000) return res.status(400).json({ error: 'Task request must be between 5 and 50,000 characters.' });

  const title = request.replace(/\s+/g, ' ').slice(0, 80);
  const issueBody = [
    '## Owner request', '', request, '',
    '## Factory instruction', '',
    'Plan this as a small, testable task. Follow AI_POLICY.md, AGENTS.md, PRODUCT.md, ARCHITECTURE.md, and the factory workflow.',
    'Do not start a paid AI stage automatically. Stop at the appropriate owner approval gate.'
  ].join('\n');

  try {
    const issue = await github(`https://api.github.com/repos/${repository}/issues`, session.token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, body: issueBody })
    });

    const repo = await github(`https://api.github.com/repos/${repository}`, session.token);
    const base = await github(`https://api.github.com/repos/${repository}/git/ref/heads/${repo.default_branch}`, session.token);
    const branch = `task/${issue.number}-${slugify(title)}`;
    await github(`https://api.github.com/repos/${repository}/git/refs`, session.token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: base.object.sha })
    });

    const planPath = `.ai/tasks/${issue.number}-${slugify(title)}.md`;
    const plan = [
      `# Task #${issue.number} — ${title}`, '',
      'Status: NEEDS_PLANNING', '',
      `Issue: #${issue.number}`, '',
      '## Owner request', '', request, '',
      '## Plan', '', 'Pending planner stage.', '',
      '## Acceptance criteria', '', 'Pending planner stage.', '',
      '## Approval', '', 'Development must not start until this plan is explicitly approved.'
    ].join('\n');
    await github(`https://api.github.com/repos/${repository}/contents/${planPath}`, session.token, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `Prepare task #${issue.number} for planning`,
        content: Buffer.from(plan).toString('base64'),
        branch
      })
    });

    return res.status(201).json({
      ok: true, repository, issue_number: issue.number, issue_url: issue.html_url,
      branch, plan_path: planPath, status: 'NEEDS_PLANNING',
      next: 'Task prepared for planning. No paid AI agent was started.'
    });
  } catch (error) {
    return res.status(502).json({ error: 'Task creation failed.', detail: error.message });
  }
};
