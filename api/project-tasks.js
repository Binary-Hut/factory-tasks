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
  if (!response.ok) {
    const error = new Error(data.message || `GitHub returned ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return data;
}

function authorized(req) {
  if (!isConfigured()) return null;
  const session = readSession(req);
  const config = getConfig();
  return session && session.login.toLowerCase() === config.owner.toLowerCase() ? session : null;
}

function registered(repository) {
  return (registry.projects || []).some((item) => item.repository === repository);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const session = authorized(req);
  if (!session) return res.status(401).json({ error: 'Sign in with the authorized GitHub account first.' });

  const repository = String(req.query?.repository || '').trim();
  if (!registered(repository)) return res.status(400).json({ error: 'Choose a registered factory project.' });

  try {
    const issues = await github(`https://api.github.com/repos/${repository}/issues?state=open&per_page=30&sort=updated&direction=desc`, session.token);
    return res.status(200).json({
      repository,
      tasks: issues.filter((item) => !item.pull_request).map((item) => ({
        number: item.number,
        title: item.title,
        url: item.html_url,
        updated_at: item.updated_at,
        labels: (item.labels || []).map((label) => label.name)
      }))
    });
  } catch (error) {
    return res.status(502).json({ error: 'Could not load project tasks.', detail: error.message });
  }
};
