const crypto = require('node:crypto');

const SESSION_COOKIE = 'factory_session';
const STATE_COOKIE = 'factory_oauth_state';
const SESSION_MS = 8 * 60 * 60 * 1000;

function parseCookies(header = '') {
  const result = {};
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) result[key] = decodeURIComponent(value);
  }
  return result;
}

function cookie(name, value, { maxAge, httpOnly = true } = {}) {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'Secure',
    'SameSite=Lax'
  ];
  if (httpOnly) parts.push('HttpOnly');
  if (Number.isInteger(maxAge)) parts.push(`Max-Age=${maxAge}`);
  return parts.join('; ');
}

function sessionKey(secret) {
  if (!secret || secret.length < 24) {
    throw new Error('FACTORY_SESSION_SECRET must contain at least 24 characters');
  }
  return crypto.createHash('sha256').update(secret).digest();
}

function encryptSession(payload, secret, now = Date.now()) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', sessionKey(secret), iv);
  const body = Buffer.from(JSON.stringify({
    ...payload,
    exp: now + SESSION_MS
  }));
  const encrypted = Buffer.concat([cipher.update(body), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    iv.toString('base64url'),
    tag.toString('base64url'),
    encrypted.toString('base64url')
  ].join('.');
}

function decryptSession(value, secret, now = Date.now()) {
  try {
    const [ivText, tagText, encryptedText] = String(value || '').split('.');
    if (!ivText || !tagText || !encryptedText) return null;

    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      sessionKey(secret),
      Buffer.from(ivText, 'base64url')
    );
    decipher.setAuthTag(Buffer.from(tagText, 'base64url'));

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedText, 'base64url')),
      decipher.final()
    ]);
    const payload = JSON.parse(decrypted.toString('utf8'));

    if (!payload.exp || payload.exp <= now) return null;
    if (!payload.token || !payload.login) return null;
    return payload;
  } catch {
    return null;
  }
}

function randomState() {
  return crypto.randomBytes(24).toString('base64url');
}

function getConfig(env = process.env) {
  return {
    clientId: env.GITHUB_OAUTH_CLIENT_ID || '',
    clientSecret: env.GITHUB_OAUTH_CLIENT_SECRET || '',
    sessionSecret: env.FACTORY_SESSION_SECRET || '',
    owner: env.FACTORY_GITHUB_OWNER || 'MusicalHut'
  };
}

function isConfigured(env = process.env) {
  const config = getConfig(env);
  return Boolean(
    config.clientId &&
    config.clientSecret &&
    config.sessionSecret.length >= 24
  );
}

function readSession(req, env = process.env) {
  if (!isConfigured(env)) return null;
  const cookies = parseCookies(req.headers.cookie || '');
  return decryptSession(cookies[SESSION_COOKIE], getConfig(env).sessionSecret);
}

module.exports = {
  SESSION_COOKIE,
  STATE_COOKIE,
  SESSION_MS,
  parseCookies,
  cookie,
  encryptSession,
  decryptSession,
  randomState,
  getConfig,
  isConfigured,
  readSession
};
