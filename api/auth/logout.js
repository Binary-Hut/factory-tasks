const { SESSION_COOKIE, STATE_COOKIE, cookie } = require('../../lib/factory-auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Set-Cookie', [
    cookie(SESSION_COOKIE, '', { maxAge: 0 }),
    cookie(STATE_COOKIE, '', { maxAge: 0 })
  ]);
  return res.status(200).json({ ok: true });
};
