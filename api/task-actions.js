const { getConfig, isConfigured, readSession } = require('../lib/factory-auth');
const registry = require('../.factory/projects.json');

async function github(url, token, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2026-03-10', ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) { const error = new Error(data.message || `GitHub returned ${response.status}`); error.status = response.status; throw error; }
  return data;
}

async function acquireDispatchLock(repository, branch, planPath, stage, token) {
  const safe = branch.replace(/[^a-zA-Z0-9._-]+/g, '-');
  const plan = await github(`https://api.github.com/repos/${repository}/contents/${planPath}?ref=${encodeURIComponent(branch)}`, token);
  const generation = String(plan.sha || '').slice(0, 12);
  const path = `.ai/locks/${safe}-${stage}-${generation}.json`;
  try {
    await github(`https://api.github.com/repos/${repository}/contents/${path}?ref=${encodeURIComponent(branch)}`, token);
    const error = new Error('This AI stage has already been dispatched. Wait for its current run to finish before taking another action.');
    error.status = 409; throw error;
  } catch (error) {
    if (error.status === 409) throw error;
    if (error.message && !/404|Not Found/i.test(error.message)) throw error;
  }
  await github(`https://api.github.com/repos/${repository}/contents/${path}`, token, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: `Lock ${stage} AI dispatch`, content: Buffer.from(JSON.stringify({ stage, branch, plan_path: planPath, created_at: new Date().toISOString() }, null, 2)).toString('base64'), branch })
  });
  return path;
}

async function releaseDispatchLock(repository, branch, path, token) {
  try {
    const file = await github(`https://api.github.com/repos/${repository}/contents/${path}?ref=${encodeURIComponent(branch)}`, token);
    await github(`https://api.github.com/repos/${repository}/contents/${path}`, token, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Release failed AI dispatch lock', sha: file.sha, branch })
    });
  } catch (_) {
    // Best effort only: retaining the lock is safer than risking a duplicate paid dispatch.
  }
}

async function dispatchWithLock(repository, branch, planPath, stage, workflow, inputs, token) {
  const lockPath = await acquireDispatchLock(repository, branch, planPath, stage, token);
  try {
    await github(`https://api.github.com/repos/${repository}/actions/workflows/${workflow}/dispatches`, token, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ref: branch, inputs })
    });
  } catch (error) {
    await releaseDispatchLock(repository, branch, lockPath, token);
    throw error;
  }
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
  if (!['approve-development', 'start-development', 'retry-development', 'start-review', 'retry-review', 'start-correction', 'merge'].includes(action)) return res.status(400).json({ error: 'Unsupported lifecycle action.' });

  try {
    if (action === 'merge') {
      const prNumber = Number(body.pr_number);
      if (!Number.isInteger(prNumber) || prNumber < 1) return res.status(400).json({ error: 'A valid pull request is required for merge.' });
      const pr = await github(`https://api.github.com/repos/${repository}/pulls/${prNumber}`, session.token);
      if (pr.head.ref !== branch || pr.state !== 'open') return res.status(409).json({ error: 'The pull request does not match this active task branch.' });
      const labels = (await github(`https://api.github.com/repos/${repository}/issues/${prNumber}/labels`, session.token)).map((label) => label.name);
      if (!labels.includes('ai-review-ready')) return res.status(409).json({ error: 'Independent review has not approved this pull request.' });
      const combined = await github(`https://api.github.com/repos/${repository}/commits/${pr.head.sha}/status`, session.token);
      if (combined.state === 'failure' || combined.state === 'error') return res.status(409).json({ error: 'Required checks are not passing.' });
      const merged = await github(`https://api.github.com/repos/${repository}/pulls/${prNumber}/merge`, session.token, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ merge_method: 'squash' })
      });
      if (!merged.merged) return res.status(409).json({ error: merged.message || 'GitHub did not merge this pull request.' });
      return res.status(200).json({ ok: true, status: 'MERGED', sha: merged.sha, next: 'Code merged. Deployment remains a separate explicit stage.' });
    }

    if (action === 'start-correction') {
      const prNumber = Number(body.pr_number);
      if (!Number.isInteger(prNumber) || prNumber < 1) return res.status(400).json({ error: 'A valid pull request is required for correction.' });
      const pr = await github(`https://api.github.com/repos/${repository}/pulls/${prNumber}`, session.token);
      if (pr.head.ref !== branch || pr.state !== 'open') return res.status(409).json({ error: 'The pull request does not match this active task branch.' });
      const labels = (await github(`https://api.github.com/repos/${repository}/issues/${prNumber}/labels`, session.token)).map((label) => label.name);
      if (!labels.includes('ai-review-changes-required')) return res.status(409).json({ error: 'Independent review has not requested changes.' });
      const file = await github(`https://api.github.com/repos/${repository}/contents/${planPath}?ref=${encodeURIComponent(branch)}`, session.token);
      const text = Buffer.from(file.content, 'base64').toString('utf8');
      if (!text.includes('Status: READY_FOR_REVIEW')) return res.status(409).json({ error: 'This task is not in the review stage.' });
      const updated = text.replace('Status: READY_FOR_REVIEW', 'Status: READY_FOR_CORRECTION');
      await github(`https://api.github.com/repos/${repository}/contents/${planPath}`, session.token, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Authorize one review correction pass', content: Buffer.from(updated).toString('base64'), sha: file.sha, branch })
      });
      await dispatchWithLock(repository, branch, planPath, 'correction', 'codex-feature-developer.yml', { branch, plan_path: planPath }, session.token);
      return res.status(202).json({ ok: true, status: 'CORRECTION_DISPATCHED', next: 'One explicitly approved Developer correction call was requested. Tests and independent re-review are still required.' });
    }

    if (action === 'retry-review') {
      const prNumber = Number(body.pr_number);
      if (!Number.isInteger(prNumber) || prNumber < 1) return res.status(400).json({ error: 'A valid pull request is required for review retry.' });
      const pr = await github(`https://api.github.com/repos/${repository}/pulls/${prNumber}`, session.token);
      if (pr.head.ref !== branch || pr.state !== 'open') return res.status(409).json({ error: 'The pull request does not match this active task branch.' });
      const labels = (await github(`https://api.github.com/repos/${repository}/issues/${prNumber}/labels`, session.token)).map((label) => label.name);
      if (!labels.includes('ai-review-paused')) return res.status(409).json({ error: 'The Reviewer is not paused after a technical failure.' });
      await dispatchWithLock(repository, branch, planPath, 'review-retry', 'gemini-review.yml', { pr_number: String(prNumber) }, session.token);
      return res.status(202).json({ ok: true, status: 'REVIEW_RETRY_DISPATCHED', next: 'One explicitly approved Reviewer retry was requested. No further retry will happen automatically.' });
    }

    if (action === 'start-review') {
      const prNumber = Number(body.pr_number);
      if (!Number.isInteger(prNumber) || prNumber < 1) return res.status(400).json({ error: 'A valid pull request is required for review.' });
      const file = await github(`https://api.github.com/repos/${repository}/contents/${planPath}?ref=${encodeURIComponent(branch)}`, session.token);
      const text = Buffer.from(file.content, 'base64').toString('utf8');
      if (!text.includes('Status: READY_FOR_REVIEW')) return res.status(409).json({ error: 'Deterministic validation has not marked this task ready for review.' });
      const pr = await github(`https://api.github.com/repos/${repository}/pulls/${prNumber}`, session.token);
      if (pr.head.ref !== branch || pr.state !== 'open') return res.status(409).json({ error: 'The pull request does not match this active task branch.' });
      await dispatchWithLock(repository, branch, planPath, 'review', 'gemini-review.yml', { pr_number: String(prNumber) }, session.token);
      return res.status(202).json({ ok: true, status: 'REVIEW_DISPATCHED', next: 'One independent Reviewer AI run was requested. Automatic retry remains disabled.' });
    }

    if (action === 'retry-development') {
      const file = await github(`https://api.github.com/repos/${repository}/contents/${planPath}?ref=${encodeURIComponent(branch)}`, session.token);
      const text = Buffer.from(file.content, 'base64').toString('utf8');
      if (!text.includes('Status: PAUSED_AI_FAILURE')) return res.status(409).json({ error: 'This task is not paused after an AI failure.' });
      const updated = text.replace('Status: PAUSED_AI_FAILURE', 'Status: READY_FOR_RETRY');
      await github(`https://api.github.com/repos/${repository}/contents/${planPath}`, session.token, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Authorize one explicit Developer retry', content: Buffer.from(updated).toString('base64'), sha: file.sha, branch })
      });
      await dispatchWithLock(repository, branch, planPath, 'development-retry', 'codex-feature-developer.yml', { branch, plan_path: planPath }, session.token);
      return res.status(202).json({ ok: true, status: 'RETRY_DISPATCHED', next: 'One explicitly approved Developer retry was requested. No further retry will happen automatically.' });
    }

    if (action === 'start-development') {
      const file = await github(`https://api.github.com/repos/${repository}/contents/${planPath}?ref=${encodeURIComponent(branch)}`, session.token);
      const text = Buffer.from(file.content, 'base64').toString('utf8');
      if (!text.includes('Status: READY_FOR_DEVELOPMENT')) return res.status(409).json({ error: 'This task is not approved for development.' });
      await dispatchWithLock(repository, branch, planPath, 'development', 'codex-feature-developer.yml', { branch, plan_path: planPath }, session.token);
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
    return res.status(502).json({ error: 'Could not complete this lifecycle action.', detail: error.message });
  }
};
