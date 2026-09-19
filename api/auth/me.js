const { getConfig, isConfigured, readSession } = require('../../lib/factory-auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const configured = isConfigured();
  const session = configured ? readSession(req) : null;
  const owner = getConfig().owner;

  return res.status(200).json({
    configured,
    authenticated: Boolean(session && session.login.toLowerCase() === owner.toLowerCase()),
    login: session?.login || null,
    owner
  });
};
