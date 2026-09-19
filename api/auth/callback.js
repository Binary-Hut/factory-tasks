const {
  SESSION_COOKIE,
  STATE_COOKIE,
  SESSION_MS,
  parseCookies,
  cookie,
  encryptSession,
  getConfig,
  isConfigured
} = require('../../lib/factory-auth');

async function githubJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2026-03-10',
      ...(options.headers || {})
    }
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data.error_description || data.message || `GitHub returned ${response.status}`;
    throw new Error(message);
  }
  return data;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!isConfigured()) {
    return res.status(503).send('Factory sign-in is not configured yet.');
  }

  const config = getConfig();
  const cookies = parseCookies(req.headers.cookie || '');
  const state = String(req.query.state || '');
  const code = String(req.query.code || '');

  if (!state || !code || !cookies[STATE_COOKIE] || state !== cookies[STATE_COOKIE]) {
    return res.status(400).send('GitHub sign-in could not be verified. Please start again from the Factory Console.');
  }

  try {
    const baseUrl = process.env.FACTORY_BASE_URL || `https://${req.headers.host}`;
    const redirectUri = new URL('/api/auth/callback', baseUrl).toString();

    const token = await githubJson('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        redirect_uri: redirectUri
      })
    });

    if (!token.access_token) {
      throw new Error('GitHub did not return an access token.');
    }

    const user = await githubJson('https://api.github.com/user', {
      headers: { 'Authorization': `Bearer ${token.access_token}` }
    });

    if (String(user.login || '').toLowerCase() !== config.owner.toLowerCase()) {
      return res.status(403).send('This GitHub account is not authorized to operate this Factory Console.');
    }

    const session = encryptSession({
      token: token.access_token,
      login: user.login,
      scopes: String(token.scope || '').split(',').map((value) => value.trim()).filter(Boolean)
    }, config.sessionSecret);

    res.setHeader('Set-Cookie', [
      cookie(SESSION_COOKIE, session, { maxAge: Math.floor(SESSION_MS / 1000) }),
      cookie(STATE_COOKIE, '', { maxAge: 0 })
    ]);

    return res.redirect(302, '/console/?signed_in=1');
  } catch (error) {
    return res.status(502).send(`GitHub sign-in failed: ${error.message}`);
  }
};
