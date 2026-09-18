# AGENTS.md — Rules for AI agents working on Factory Tasks

This file is for any AI coding agent (Claude, GPT, Gemini, etc.) making
changes to this repository. Follow these rules exactly. The owner is
non-technical and relies on these rules to keep the project safe and simple.

Before doing any work, read `AI_POLICY.md`. Its cost, retry, escalation, and
multi-agent limits are mandatory and take precedence for AI automation.

## Hard rules — never do these without explicit owner approval

- Do not add authentication, login, or user accounts
- Do not add payments
- Do not add email, SMS, or WhatsApp integrations
- Do not call any external API
- Do not add a database (SQL or NoSQL)
- Do not add a frontend framework (React, Vue, Svelte, etc.)
- Do not add a build step, bundler, or package manager dependency unless the
  owner has explicitly approved it for a specific, named reason
- Do not create a mobile app
- Do not add AI features inside the app itself

## Required behavior

- Keep the app as a single `index.html` file for as long as reasonably possible
- If a change requires splitting into multiple files, keep the total file
  count small and explain why in the pull request / change description
- Write plain, readable code. Add comments only where they genuinely help
  understanding — do not over-comment
- Before making a change, check AI_POLICY.md for cost/retry/safety limits
- Before making a change, check PRODUCT.md to confirm the change is in scope
- Before making an architectural change, check ARCHITECTURE.md
- After making a change, update ROADMAP.md if a phase was completed
- Every change should be small enough that its effect can be described to a
  non-technical owner in 2-3 plain-language sentences

## Testing expectations

- Any change to task add/complete/delete logic should be verifiable by a
  simple manual or automated check: add a task, mark it done, delete it,
  confirm the list updates correctly
- As automated testing is introduced (see ROADMAP.md), all new logic changes
  should include or update a corresponding test

## When in doubt

If a request is ambiguous, or would require breaking any hard rule above,
stop and ask the owner in plain language rather than guessing.
