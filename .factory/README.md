# Factory Project Registry

This directory is the machine-readable control layer for projects managed by
the Factory Console.

GitHub remains the source of truth. No secret is stored here.

## Files

- `projects.json` — projects currently known to the factory.
- `project-template.json` — required project fields and the starter-file plan.
- `validate-projects.mjs` — deterministic validation using Node.js only.

## New-project flow

The Factory Console collects a simple request:

1. project name
2. short description
3. project type
4. deployment preference
5. Planner / Developer / Reviewer choices
6. AI-call budget

A trusted server-side action then:

1. validate the request,
2. create the GitHub repository,
3. install the factory starter files,
4. generate project-specific PRODUCT / ARCHITECTURE / ROADMAP files,
5. configure the selected workflow preset,
6. register the project in `projects.json`,
7. register the selected deployment provider so production can later be started through a separate owner-confirmed action.

## Explicit production deployment

Projects configured for Vercel receive `vercel-production.yml` plus a project-local
`.factory/deployment.json`. The Console starts production only after a separate
owner confirmation; merging does not invoke production automatically.

The workflow reads the approved source SHA from `.factory/deploy-request.json`,
reads the Vercel project name from `.factory/deployment.json`, and resolves the
Vercel project/account IDs at runtime. Shared workflows therefore contain no
project-specific Vercel IDs or account names.

A `VERCEL_TOKEN` GitHub Actions secret is still required. The workflow creates or
links the named Vercel project if it does not yet exist. When
`.factory/deployment.json` declares `"production_access": "public"`, the workflow
applies that policy through Vercel's project API before deployment by disabling
Vercel Authentication for that project. It then deploys the exact approved commit,
verifies public reachability, and runs the optional project-specific
`.factory/verify-production.sh` contract.

Missing credentials, inaccessible Vercel projects, and public-access protection are
classified by the Factory Console as setup requirements rather than source-code
failures. Secrets remain outside the repository and browser.

## Why shared and generated files are separated

Files such as AI safety policy and branch-ownership rules can be copied from the
factory standard.

Files such as PRODUCT.md and ARCHITECTURE.md describe one specific application,
so they must be generated for that project instead of copied from another app.

This prevents accidental inheritance of unrelated product requirements.


## Project workflow bootstrap

New projects receive project-neutral GitHub Actions workflows for deterministic tests,
branch-collision protection, one explicitly started Codex development call, and one
explicitly armed Gemini review call.

The Factory Console OAuth session must include both `public_repo` and `workflow`.
GitHub requires the `workflow` OAuth scope when an OAuth app adds or updates files
under `.github/workflows/`.

Project creation itself never starts a paid AI agent. AI credentials remain GitHub
Actions secrets can now be centralized at the Binary Hut organization level and granted to the public project repositories that need them. The Factory Console creates new repositories inside Binary Hut; the authorized OAuth user remains separate from the destination organization.

## Generic deterministic test contract

Implemented projects use `.factory/test.sh` as the single CI entry point for deterministic validation. The shared workflows do not assume Node, npm, Playwright, Python, mobile, or any other stack. Each project's script is responsible for installing or invoking only the tooling approved for that project and returning a non-zero exit code on failure.

Planning-only repositories may temporarily omit the script. Before an implementation can advance to review, the developer workflow requires the script to exist and pass.


## Independent local LLM agents

The Factory supports a first-class `local-llm` agent choice for Planner,
Developer, and Reviewer. This path does not require OpenAI, Gemini, Claude, or
any other cloud AI provider.

Local inference runs on a GitHub self-hosted runner carrying the dedicated
`factory-local-llm` label. Keep that runner isolated and low-privilege, and
limit it to the repositories that should be allowed to execute local-agent jobs.

Per project, configure repository variables:

- `LOCAL_LLM_ADAPTER` — `ollama` or `generic-http` (defaults to `ollama`).
- `LOCAL_LLM_MODEL` — the local model name understood by the selected runtime.
- `OLLAMA_BASE_URL` — optional; defaults to `http://127.0.0.1:11434`.
- `LOCAL_LLM_HTTP_URL` — required only for the generic local HTTP adapter.

If the generic HTTP endpoint needs authentication, store it only as the
`LOCAL_LLM_HTTP_TOKEN` Actions secret. The generic adapter uses a Factory-owned
local protocol: POST JSON `{"model":"...","prompt":"..."}` and expects
`{"text":"..."}`. It is not an OpenAI protocol dependency.

Selecting a local agent never starts it automatically. The same owner approval
gates, AI-call accounting, deterministic tests, review requirements, and
no-automatic-retry policy apply exactly as they do to cloud agents.
