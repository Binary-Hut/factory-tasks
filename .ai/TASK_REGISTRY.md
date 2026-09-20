# TASK_REGISTRY.md — Factory Task Registry

This is the human-readable source of truth for active factory work.

The future Factory Console should read this information and present it as simple
cards and buttons. GitHub remains the underlying source of truth.

## Status meanings

- `PLANNING` — plan is being prepared.
- `READY_FOR_DEVELOPMENT` — approved to build.
- `DEVELOPING` — Developer currently owns the task branch.
- `PAUSED_AI_FAILURE` — stopped safely; no automatic retry.
- `READY_FOR_RETRY` — owner explicitly approved another attempt.
- `READY_FOR_REVIEW` — implementation and deterministic tests passed.
- `REVIEWING` — independent review is running.
- `CHANGES_REQUIRED` — review found concrete changes.
- `READY_TO_MERGE` — checks/review passed and human may merge.
- `MERGED` — approved code merged; production is still a separate action.
- `DEPLOYING` — the owner explicitly started the configured production workflow.
- `DONE` — merged and production verification completed.

## Completed experiment

| Task | State | Branch | Planner | Developer | Reviewer | AI calls | Result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Issue #4 — Incomplete Task Counter | DONE | feature/incomplete-task-counter | Claude | Codex | Gemini | Planner 1 / Developer 1 / Reviewer 1 | Merged + production verified |

## Active tasks

No active product task.

## Registry rules

1. One task has one task plan and one feature branch.
2. Only one modifying Developer may own a task at a time.
3. AI call budgets follow `AI_POLICY.md`.
4. File collisions follow `.ai/BRANCH_OWNERSHIP.md`.
5. Pause/resume follows `.ai/WORKFLOW_STATE.md`.
6. GitHub Actions/tests/deployment remain deterministic wherever possible.
7. The Factory Console is a control surface, not a replacement source of truth.
