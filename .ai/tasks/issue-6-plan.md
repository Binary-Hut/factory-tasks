# Issue #6 — Factory Console MVP

Status: READY_FOR_DEVELOPMENT
Role owner: Planner
Branch: `feature/factory-console-mvp`

## Goal

Create a simple, non-technical dashboard at `/console/` so the owner can
understand the software factory without reading GitHub Actions logs.

## In scope

- Static dashboard page under `console/index.html`.
- Read public repository status from the GitHub REST API.
- Show plain-language overall health.
- Show open issues and pull requests.
- Show recent automation runs with friendly names/statuses.
- Show links to the live app and advanced GitHub view.
- Provide a simple New Task form that opens a pre-filled GitHub issue.
- Keep the existing root task-manager app unchanged.
- Add deterministic Playwright coverage for the console.

## Out of scope

- Login/authentication.
- Storing GitHub credentials in the browser.
- Direct merge/retry/approve buttons.
- Starting paid AI agents from the browser.
- Database, backend, framework, or new dependency.
- Replacing GitHub as source of truth.

## Acceptance criteria

- Visiting `/console/` shows a plain-language Factory Console.
- Overall health is derived from the latest main-branch source-test and
  production-verification runs.
- Recent automation is displayed as Passed, Running, Skipped, or Needs attention.
- Open issues and PRs are listed in a non-technical format.
- New Task accepts plain-English text and opens a pre-filled GitHub issue.
- The existing root app remains unchanged.
- CI runs console tests in addition to the existing source tests.

## Likely files to change

- `console/index.html`
- `tests/console.spec.js`
- `.github/workflows/test.yml`
- `ROADMAP.md`
- this plan file

## Tests

- Console page renders.
- Healthy test + production runs show "All systems healthy".
- Failed latest critical run shows "Needs attention".
- Open work is rendered.
- Recent automation uses friendly names/statuses.

## Risks / notes

- GitHub's unauthenticated public API has rate limits. This MVP makes only a few
  requests per refresh and is intended for one owner.
- Secure write actions will require a server-side layer later; browser-side
  GitHub tokens are explicitly forbidden.
