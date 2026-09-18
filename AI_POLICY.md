# AI_POLICY.md — AI Cost, Retry, and Safety Policy

This file defines the operating limits for all AI agents working on Factory Tasks.
Every AI agent must read this file before making changes.

The owner is non-technical. The goal is to keep automation useful, predictable,
and inexpensive.

## Default operating mode

- Prefer deterministic automation over AI whenever possible.
- Use AI only for tasks that genuinely require reasoning, diagnosis, planning,
  implementation, or review.
- For routine bug fixing, use the cheapest capable model first.
- Default repair reasoning effort: low.
- Keep prompts, context, and file reads narrowly scoped to the task.

## Automatic repair limits

- Maximum automatic AI repair attempts per failing incident: 1.
- Maximum automatic model escalations per incident: 0.
- Do not retry a failed AI repair automatically.
- Do not let an AI-generated repair trigger another automatic AI repair.
- If the one allowed repair attempt fails validation, stop automation and
  require human review.
- If main has changed since the original failure, skip the repair rather than
  spending AI credits on stale code.

## Cost controls

- Do not run broad repository reviews during an auto-fix.
- Do not read unrelated files.
- Do not reinstall tools or rerun full test suites inside the AI step unless
  necessary for diagnosis.
- Reuse existing CI failure output whenever possible.
- Production verification must not invoke an AI model automatically.
- Documentation-only or configuration-only failures should not invoke an AI
  repair unless explicitly enabled later.
- Do not use premium/high-cost models automatically.
- Any future model escalation policy must be explicitly approved by the owner.

## Human approval required for

- Architecture changes
- New dependencies
- New frameworks
- Database creation or migration
- Authentication or user-account systems
- Payment systems
- External API integrations
- Secrets or credential changes
- Changes to deployment providers or infrastructure
- Changes that materially broaden product scope
- Enabling more than one automatic AI repair attempt
- Enabling automatic escalation to a more expensive model

## Multi-agent rules

- Maximum AI agents actively modifying the same task: 2.
- Agents should work on separate branches or isolated workspaces when practical.
- Do not allow two agents to edit the same files concurrently.
- Prefer role specialization over duplicated work.
- Suggested roles:
  - Planner: converts a request into acceptance criteria.
  - Developer: implements the change.
  - Reviewer: reviews the diff independently.
  - Test runner / production verifier: deterministic automation, not an LLM.
- Do not create chains where multiple agents repeatedly review one another.

## Branch and main-branch rules

- Keep main stable.
- Human-authored feature work should normally happen on a branch.
- Automated bug repair may update main only after deterministic source tests
  pass in the repair workflow.
- An automated repair commit must never trigger another automatic AI repair.
- If deterministic validation fails after an AI edit, stop and surface the
  failure instead of retrying.

## Failure policy

If automation cannot safely continue within the limits above:

1. Stop.
2. Preserve the failure information.
3. Do not spend more AI credits automatically.
4. Surface the problem for human review.
5. Do not guess or make unrelated changes.

## Current Factory Tasks defaults

- Automatic repair model: gpt-5-mini
- Automatic repair reasoning effort: low
- Automatic repair attempts: 1
- Automatic model escalation: disabled
- Production auto-fix: disabled
- Maximum modifying AI agents on one task: 2

These defaults may be changed only with explicit owner approval.
