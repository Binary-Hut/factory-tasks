const bundledRegistry = require('../.factory/projects.json');
const { readSession } = require('../lib/factory-auth');
const agentCatalog = require('../.factory/agents.json');
const deploymentCatalog = require('../.factory/deployments.json');

async function liveRegistry(req) {
  const session = readSession(req);
  const headers = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2026-03-10' };
  if (session?.token) headers.Authorization = `Bearer ${session.token}`;
  const response = await fetch('https://api.github.com/repos/Binary-Hut/factory-tasks/contents/.factory/projects.json?ref=main', { headers });
  if (!response.ok) throw new Error('Live registry unavailable');
  const data = await response.json();
  return JSON.parse(Buffer.from(String(data.content || '').replace(/\n/g, ''), 'base64').toString('utf8'));
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let registry = bundledRegistry;
  try { registry = await liveRegistry(req); } catch (_) {
    // The bundled registry keeps the Console usable during a temporary GitHub API failure.
  }

  const projects = Array.isArray(registry.projects) ? registry.projects : [];
  return res.status(200).json({
    schema_version: registry.schema_version || 1,
    agent_catalog: agentCatalog,
    deployment_catalog: deploymentCatalog,
    projects: projects.map((project) => ({
      id: project.id,
      name: project.name,
      repository: project.repository,
      project_type: project.project_type,
      lifecycle_status: project.lifecycle_status,
      deployment: project.deployment || { provider: 'none' },
      agents: project.agents || {},
      ai_budget: project.ai_budget || {}
    }))
  });
};
