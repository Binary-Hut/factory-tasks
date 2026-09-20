const { getConfig, isConfigured, readSession } = require('../lib/factory-auth');
const registry = require('../.factory/projects.json');

async function github(url, token, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2026-03-10', ...(options.headers || {}) }
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
  return origin === `https://${req.headers.host}` || origin === `http://${req.headers.host}`;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed' }); }
  if (!sameOrigin(req)) return res.status(403).json({ error: 'Cross-origin lifecycle actions are not allowed.' });
  if (!isConfigured()) return res.status(503).json({ error: 'Factory authentication is not configured.' });
  const session = readSession(req);
  const config = getConfig();
  if (!session || session.login.toLowerCase() !== config.owner.toLowerCase()) return res.status(401).json({ error: 'Sign in with the authorized GitHub account first.' });

  let body = req.body || {};
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { return res.status(400).json({ error: 'Invalid JSON request.' }); } }
  const repository = String(body.repository || '').trim();
  const branch = String(body.branch || '').trim();
  const planPath = String(body.plan_path || '').trim();
  const action = String(body.action || '').trim();
  if (!(registry.projects || []).some((p) => p.repository === repository)) return res.status(400).json({ error: 'Choose a registered factory project.' });
  if (!/^task\/[a-zA-Z0-9._/-]+$/.test(branch) || !/^\.ai\/tasks\/[a-zA-Z0-9._/-]+\.md$/.test(planPath)) return res.status(400).json({ error: 'Invalid task workspace.' });
  if (!['approve-development', 'start-development'].includes(action)) return res.status(400).json({ error: 'Unsupported lifecycle action.' });

  try {
    if (action === 'start-development') {
      const file = await github(`https://api.github.com/repos/${repository}/contents/${planPath}?ref=${encodeURIComponent(branch)}`, session.token);
      const text = Buffer.from(file.content, 'base64').toString('utf8');
      if (!text.includes('Status: READY_FOR_DEVELOPMENT')) return res.status(409).json({ error: 'This task is not approved for development.' });
      await github(`https://api.github.com/repos/${repository}/actions/workflows/codex-feature-developer.yml/dispatches`, session.token, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ref: branch, inputs: { branch, plan_path: planPath } })
      });
      return res.status(202).json({ ok: true, status: 'DEVELOPMENT_DISPATCHED', next: 'One approved Developer AI run was requested. Automatic retry remains disabled.' });
    }

    const file = await github(`https://api.github.com/repos/${repository}/contents/${planPath}?ref=${encodeURIComponent(branch)}`, session.token);
    const text = Buffer.from(file.content, 'base64').toString('utf8');
    if (!text.includes('Status: READY_FOR_APPROVAL')) return res.status(409).json({ error: 'This plan is not ready for approval yet.' });
    const updated = text.replace('Status: READY_FOR_APPROVAL', 'Status: READY_FOR_DEVELOPMENT');
    await github(`https://api.github.com/repos/${repository}/contents/${planPath}`, session.token, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Approve task plan for development', content: Buffer.from(updated).toString('base64'), sha: file.sha, branch })
    });
    return res.status(200).json({ ok: true, status: 'READY_FOR_DEVELOPMENT', next: 'Plan approved. Development has not started yet.' });
  } catch (error) {
    return res.status(502).json({ error: 'Could not approve this task.', detail: error.message });
  }
};
