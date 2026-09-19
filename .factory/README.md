# Factory Project Registry

This directory is the machine-readable control layer for projects managed by
the Factory Console.

GitHub remains the source of truth. No secret is stored here.

## Files

- `projects.json` — projects currently known to the factory.
- `project-template.json` — required project fields and the starter-file plan.
- `validate-projects.mjs` — deterministic validation using Node.js only.

## New-project flow

The future Factory Console will collect a simple request:

1. project name
2. short description
3. project type
4. deployment preference
5. Planner / Developer / Reviewer choices
6. AI-call budget

A trusted server-side action will then:

1. validate the request,
2. create the GitHub repository,
3. install the factory starter files,
4. generate project-specific PRODUCT / ARCHITECTURE / ROADMAP files,
5. configure the selected workflow preset,
6. register the project in `projects.json`,
7. optionally connect deployment.

The browser must never contain a GitHub write token.

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
Actions secrets in each project repository in the current personal-account setup.
A future organization-level setup can centralize those secrets across repositories.
