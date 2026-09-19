const {
  STATE_COOKIE,
  cookie,
  randomState,
  getConfig,
  isConfigured
} = require('../../lib/factory-auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!isConfigured()) {
    return res.redirect(302, '/console/?setup=required');
  }

  const config = getConfig();
  const state = randomState();
  const baseUrl = process.env.FACTORY_BASE_URL || `https://${req.headers.host}`;
  const callback = new URL('/api/auth/callback', baseUrl).toString();

  const authorize = new URL('https://github.com/login/oauth/authorize');
  authorize.searchParams.set('client_id', config.clientId);
  authorize.searchParams.set('redirect_uri', callback);
  authorize.searchParams.set('scope', 'public_repo');
  authorize.searchParams.set('state', state);

  res.setHeader('Set-Cookie', cookie(STATE_COOKIE, state, { maxAge: 600 }));
  return res.redirect(302, authorize.toString());
};
