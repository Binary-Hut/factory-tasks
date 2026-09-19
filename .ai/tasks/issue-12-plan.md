# Issue #12 — Generic New Project provisioning

Status: READY_FOR_REVIEW

## Goal
Prevent new projects from inheriting Factory Tasks sample-app restrictions.

## Changes
- Generate project-specific, architecture-neutral `AGENTS.md`.
- Keep shared `AI_POLICY.md` and role/safety documents copied from the factory.
- Align `.factory/project-template.json` with what the current provisioner actually installs.
- Add deterministic coverage for a mobile-app project to catch static-app restrictions.

## Safety
- No paid AI call is required to implement or test this change.
- No repository is provisioned as part of the test.
- Project creation remains owner-authenticated and does not auto-start an AI agent.
