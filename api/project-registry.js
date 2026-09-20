const registry = require('../.factory/projects.json');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const projects = Array.isArray(registry.projects) ? registry.projects : [];
  return res.status(200).json({
    schema_version: registry.schema_version || 1,
    projects: projects.map((project) => ({
      id: project.id,
      name: project.name,
      repository: project.repository,
      project_type: project.project_type,
      lifecycle_status: project.lifecycle_status,
      deployment: project.deployment || { provider: 'none' },
      agents: project.agents || {}
    }))
  });
};
