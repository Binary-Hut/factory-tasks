const { getConfig, isConfigured, readSession } = require('../lib/factory-auth');
const registry = require('../.factory/projects.json');
const agentCatalog = require('../.factory/agents.json');

async function github(url, token, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2026-03-10', ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) { const error = new Error(data.message || `GitHub returned ${response.status}`); error.status = response.status; throw error; }
  return data;
}

async function requireSuccessfulActions(repository, headSha, token) {
  const runs = await github(`https://api.github.com/repos/${repository}/actions/runs?head_sha=${encodeURIComponent(headSha)}&per_page=100`, token);
  const relevant = (runs.workflow_runs || []).filter((run) => ['Run Tests', 'Branch Collision Guard'].includes(run.name));
  const latest = new Map();
  for (const run of relevant) {
    const previous = latest.get(run.name);
    if (!previous || new Date(run.created_at) > new Date(previous.created_at)) latest.set(run.name, run);
  }
  for (const name of ['Run Tests', 'Branch Collision Guard']) {
    const run = latest.get(name);
    if (!run) { const error = new Error(`${name} has not run for the current pull-request commit.`); error.status = 409; throw error; }
    if (run.status !== 'completed' || run.conclusion !== 'success') {
      const error = new Error(`${name} must complete successfully before merge.`); error.status = 409; throw error;
    }
  }
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
  const branchMatch = branch.match(/^task\/(\d+)-[a-zA-Z0-9][a-zA-Z0-9._-]*$/);
  const planMatch = planPath.match(/^\.ai\/tasks\/(\d+)-[a-zA-Z0-9][a-zA-Z0-9._-]*\.md$/);
  if (!branchMatch || !planMatch || branchMatch[1] !== planMatch[1] || branch.includes('..') || planPath.includes('..')) {
    return res.status(400).json({ error: 'Invalid or mismatched task workspace.' });
  }
  if (!['start-planning', 'approve-development', 'start-development', 'retry-development', 'prepare-review', 'start-review', 'retry-review', 'start-correction', 'merge'].includes(action)) return res.status(400).json({ error: 'Unsupported lifecycle action.' });

  try {
    if (action === 'start-planning') {
      const project = (registry.projects || []).find((item) => item.repository === repository);
      const planner = (agentCatalog.roles?.planner?.options || []).find((option) => option.id === project?.agents?.planner);
      if (!planner || planner.kind !== 'ai' || !planner.workflow) return res.status(409).json({ error: 'This project is not configured for an automated Planner.' });
      const file = await github(`https://api.github.com/repos/${repository}/contents/${planPath}?ref=${encodeURIComponent(branch)}`, session.token);
      const text = Buffer.from(file.content, 'base64').toString('utf8');
      if (!text.includes('Status: NEEDS_PLANNING')) return res.status(409).json({ error: 'This task does not need planning.' });
      await dispatchWithLock(repository, branch, planPath, 'planning', planner.workflow, { branch, plan_path: planPath, model: planner.model || '' }, session.token);
      return res.status(202).json({ ok: true, status: 'PLANNING_DISPATCHED', next: 'One explicitly approved Planner AI call was requested. Development remains blocked until you approve the resulting plan.' });
    }

    if (action === 'merge') {
      const prNumber = Number(body.pr_number);
      if (!Number.isInteger(prNumber) || prNumber < 1) return res.status(400).json({ error: 'A valid pull request is required for merge.' });
      const pr = await github(`https://api.github.com/repos/${repository}/pulls/${prNumber}`, session.token);
      if (pr.head.ref !== branch || pr.state !== 'open') return res.status(409).json({ error: 'The pull request does not match this active task branch.' });
      const labels = (await github(`https://api.github.com/repos/${repository}/issues/${prNumber}/labels`, session.token)).map((label) => label.name);
      if (!labels.includes('ai-review-ready')) return res.status(409).json({ error: 'Independent review has not approved this pull request.' });
      await requireSuccessfulActions(repository, pr.head.sha, session.token);
      const combined = await github(`https://api.github.com/repos/${repository}/commits/${pr.head.sha}/status`, session.token);
      if (combined.state === 'failure' || combined.state === 'error' || combined.state === 'pending') return res.status(409).json({ error: 'A commit status is not passing yet.' });
      const merged = await github(`https://api.github.com/repos/${repository}/pulls/${prNumber}/merge`, session.token, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ merge_method: 'squash' })
      });
      if (!merged.merged) return res.status(409).json({ error: merged.message || 'GitHub did not merge this pull request.' });
      return res.status(200).json({ ok: true, status: 'MERGED', sha: merged.sha, next: 'Code merged. Deployment remains a separate explicit stage.' });
    }

    if (action === 'prepare-review') {
      const file = await github(`https://api.github.com/repos/${repository}/contents/${planPath}?ref=${encodeURIComponent(branch)}`, session.token);
      const text = Buffer.from(file.content, 'base64').toString('utf8');
      if (!text.includes('Status: READY_FOR_REVIEW')) return res.status(409).json({ error: 'Deterministic validation has not marked this task ready for review.' });
      const repo = await github(`https://api.github.com/repos/${repository}`, session.token);
      const owner = repository.split('/')[0];
      const existing = await github(`https://api.github.com/repos/${repository}/pulls?state=open&head=${encodeURIComponent(owner + ':' + branch)}`, session.token);
      if (existing[0]) return res.status(200).json({ ok: true, status: 'REVIEW_PR_READY', pr_number: existing[0].number, url: existing[0].html_url, next: 'Existing pull request is ready for independent review.' });
      const issueNumber = Number(branchMatch[1]);
      let title = `Factory task #${issueNumber || ''}`.trim();
      if (issueNumber) {
        try { const issue = await github(`https://api.github.com/repos/${repository}/issues/${issueNumber}`, session.token); title = issue.title || title; } catch {}
      }
      const created = await github(`https://api.github.com/repos/${repository}/pulls`, session.token, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, head: branch, base: repo.default_branch, body: `Factory-generated pull request for the validated task workspace.\n\n${issueNumber ? `Closes #${issueNumber}\n\n` : ''}Independent review and deterministic checks are required before merge.` })
      });
      return res.status(201).json({ ok: true, status: 'REVIEW_PR_CREATED', pr_number: created.number, url: created.html_url, next: 'Pull request created. Independent review has not started yet.' });
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
