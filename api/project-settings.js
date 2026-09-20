const { getConfig, isConfigured, readSession } = require('../lib/factory-auth');

const SOURCE_REPO = 'Binary-Hut/factory-tasks';
const REGISTRY_PATH = '.factory/projects.json';
const ALLOWED_PLANNERS = new Set(['manual-claude', 'gemini']);

async function github(url, token, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2026-03-10', ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) { const error = new Error(data.message || `GitHub returned ${response.status}`); error.status = response.status; throw error; }
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
  if (!sameOrigin(req)) return res.status(403).json({ error: 'Cross-origin settings changes are not allowed.' });
  if (!isConfigured()) return res.status(503).json({ error: 'Factory authentication is not configured.' });
  const session = readSession(req);
  const config = getConfig();
  if (!session || session.login.toLowerCase() !== config.owner.toLowerCase()) return res.status(401).json({ error: 'Sign in with the authorized GitHub account first.' });

  let body = req.body || {};
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { return res.status(400).json({ error: 'Invalid JSON request.' }); } }
  const repository = String(body.repository || '').trim();
  const planner = String(body.planner || '').trim();
  if (!ALLOWED_PLANNERS.has(planner)) return res.status(400).json({ error: 'Choose a supported Planner configuration.' });

  try {
    const file = await github(`https://api.github.com/repos/${SOURCE_REPO}/contents/${REGISTRY_PATH}?ref=main`, session.token);
    const registry = JSON.parse(Buffer.from(String(file.content || '').replace(/\n/g, ''), 'base64').toString('utf8'));
    const project = (registry.projects || []).find((item) => item.repository === repository);
    if (!project) return res.status(404).json({ error: 'Registered project not found.' });
    project.agents = { ...(project.agents || {}), planner };
    await github(`https://api.github.com/repos/${SOURCE_REPO}/contents/${REGISTRY_PATH}`, session.token, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: `Configure Planner for ${project.name}`, content: Buffer.from(JSON.stringify(registry, null, 2) + '\n').toString('base64'), sha: file.sha, branch: 'main' })
    });
    return res.status(200).json({ ok: true, repository, agents: project.agents, next: planner === 'gemini' ? 'Gemini planning is enabled, but each Planner call still requires explicit owner confirmation.' : 'Planning remains manual; no Planner AI call can start from the Console.' });
  } catch (error) {
    return res.status(error.status || 502).json({ error: 'Could not update project agent settings.', detail: error.message });
  }
};
