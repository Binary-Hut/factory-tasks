const { getConfig, isConfigured, readSession } = require('../lib/factory-auth');
const bundledRegistry = require('../.factory/projects.json');
const deploymentCatalog = require('../.factory/deployments.json');

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
  if (!response.ok) {
    const error = new Error(data.message || `GitHub returned ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return data;
}

async function loadRegistry(token) {
  try {
    const file = await github('https://api.github.com/repos/Binary-Hut/factory-tasks/contents/.factory/projects.json?ref=main', token);
    return JSON.parse(Buffer.from(String(file.content || '').replace(/\n/g, ''), 'base64').toString('utf8'));
  } catch (_) {
    return bundledRegistry;
  }
}

function sameOrigin(req) {
  const origin = req.headers.origin;
  const site = req.headers['sec-fetch-site'];
  if (site && !['same-origin', 'same-site', 'none'].includes(site)) return false;
  if (!origin) return site === 'same-origin' || site === 'same-site' || site === 'none';
  return origin === `https://${req.headers.host}` || origin === `http://${req.headers.host}`;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!sameOrigin(req)) return res.status(403).json({ error: 'Cross-origin deployment requests are not allowed.' });
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

  try {
    const registry = await loadRegistry(session.token);
    const project = (registry.projects || []).find((item) => item.repository === repository);
    if (!project) return res.status(404).json({ error: 'Registered project not found.' });
    const provider = deploymentCatalog.providers?.[project.deployment?.provider];
    if (!provider?.workflow) return res.status(409).json({ error: 'This project has no approved production deployment provider.' });
    const repo = await github(`https://api.github.com/repos/${repository}`, session.token);
    const branch = await github(`https://api.github.com/repos/${repository}/branches/${encodeURIComponent(repo.default_branch)}`, session.token);
    const requestPath = '.factory/deploy-request.json';
    let current = null;
    try {
      current = await github(`https://api.github.com/repos/${repository}/contents/${requestPath}?ref=${encodeURIComponent(repo.default_branch)}`, session.token);
    } catch (error) {
      if (error.status !== 404) throw error;
    }
    const request = {
      schema_version: 1,
      provider: project.deployment.provider,
      source_sha: branch.commit.sha,
      requested_at: new Date().toISOString(),
      requested_by: session.login
    };
    const update = {
      message: `Approve production deployment for ${branch.commit.sha.slice(0, 12)}`,
      content: Buffer.from(JSON.stringify(request, null, 2) + '\n').toString('base64'),
      branch: repo.default_branch
    };
    if (current?.sha) update.sha = current.sha;
    await github(`https://api.github.com/repos/${repository}/contents/${requestPath}`, session.token, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(update)
    });
    return res.status(202).json({
      ok: true,
      status: 'DEPLOYMENT_DISPATCHED',
      provider: project.deployment.provider,
      next: 'Production deployment was recorded in GitHub and explicitly requested. The deterministic workflow will verify the live response and will not retry automatically.'
    });
  } catch (error) {
    return res.status(error.status || 502).json({ error: 'Could not start production deployment.', detail: error.message });
  }
};
