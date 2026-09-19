# Issue #8 — New Project Provisioning Foundation

Status: READY_FOR_REVIEW
Role owner: Planner
Branch: `feature/project-provisioning-foundation`

## Goal

Create the safe, reusable foundation that will later let the Factory Console
create new software projects automatically.

## In scope

- Central project registry format.
- Project request/template manifest.
- Clear split between shared factory files and project-specific generated files.
- Deterministic validation with no new dependency.
- A dedicated CI check for registry/template changes.
- No repository creation yet.
- No credentials or secrets.

## Out of scope

- Creating a new external GitHub repository.
- Vercel project creation.
- Browser-side GitHub write access.
- GitHub tokens or other secrets.
- Direct Console UI changes while PR #7 is open.
- Automatically invoking Planner/Developer/Reviewer models.

## Acceptance criteria

- Managed projects have a simple machine-readable registry.
- A new project request has required fields for name, slug, type, deployment,
  model roles, and AI-call budget.
- Shared starter files are explicitly listed.
- Project-specific files are marked for generation rather than copied blindly.
- Invalid registry/template data fails a deterministic check.
- Validation uses Node built-ins only.
- A GitHub Action runs the validation when the foundation files change.

## Files

- `.factory/projects.json`
- `.factory/project-template.json`
- `.factory/README.md`
- `.factory/validate-projects.mjs`
- `.github/workflows/project-registry-check.yml`

## Handoff

The foundation is implemented and ready for independent review after its
deterministic registry check passes.
