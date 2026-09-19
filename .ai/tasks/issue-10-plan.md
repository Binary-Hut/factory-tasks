# Issue #10 — Secure GitHub Sign-in and New Project Creation

Status: READY_FOR_REVIEW
Role owner: Developer
Branch: `feature/secure-project-provisioning`

## Goal

Allow the non-technical owner to sign in with GitHub and create a new,
factory-ready public repository from the Factory Console.

## Security decisions

- OAuth web flow; no GitHub write token in browser JavaScript.
- OAuth Client Secret exists only in Vercel environment variables.
- Session payload is AES-256-GCM encrypted in an HttpOnly cookie.
- Session cookie is Secure and SameSite=Lax.
- Only `FACTORY_GITHUB_OWNER` may provision.
- Request only `public_repo` scope in this first version.
- New repositories are public in this first version.
- No paid AI call is triggered by project creation.
- No Vercel project is created automatically yet.

## Required environment variables

- `GITHUB_OAUTH_CLIENT_ID`
- `GITHUB_OAUTH_CLIENT_SECRET`
- `FACTORY_SESSION_SECRET`
- `FACTORY_GITHUB_OWNER` (optional; defaults to MusicalHut)

## Acceptance criteria

- Console can report whether secure provisioning is configured.
- Owner can start GitHub OAuth and return to the Console.
- A non-owner GitHub account is rejected.
- New Project form validates input before provisioning.
- Authenticated owner can create a public GitHub repository.
- Repository receives factory safety/role files plus project-specific docs.
- No browser-accessible GitHub credential is introduced.
- Deterministic unit tests cover validation and encrypted sessions.
- Existing task-manager and Console health views remain functional.


## Handoff

Implementation is complete on the feature branch. The live create action will
remain unavailable until the owner completes the one-time OAuth/Vercel secret
setup after merge. No secret is committed to GitHub.
