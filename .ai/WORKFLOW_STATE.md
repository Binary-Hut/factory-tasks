# AI Workflow State Model

This file defines the safe pause/resume states used by Factory Tasks.

The purpose is to prevent one model from taking over another model's unfinished work,
prevent repeated AI calls, and make every handoff visible in GitHub.

## Task states

Each task plan under `.ai/tasks/` must contain one `Status:` line using one of
these values:

- `PLANNING` — the Planner is defining scope and acceptance criteria.
- `READY_FOR_DEVELOPMENT` — the plan is approved and may be implemented once.
- `DEVELOPING` — a Developer run has started.
- `PAUSED_AI_FAILURE` — the AI stage failed or became unavailable; do not switch
  models automatically and do not retry automatically.
- `READY_FOR_RETRY` — the owner has explicitly approved one more attempt.
- `READY_FOR_REVIEW` — implementation passed deterministic source tests.
- `REVIEWING` — an independent AI review has started.
- `CHANGES_REQUIRED` — the Reviewer found concrete issues.
- `READY_TO_MERGE` — review and deterministic checks passed.
- `MERGED` — approved code is on the default branch; production remains a
  separate owner action when a provider is configured.
- `DEPLOYING` — an explicitly approved production workflow is running.
- `DONE` — merged and production verification completed, or merged with no
  production provider configured.

## Safe transitions

```text
PLANNING
  -> READY_FOR_DEVELOPMENT
  -> DEVELOPING
       -> READY_FOR_REVIEW
       -> PAUSED_AI_FAILURE

PAUSED_AI_FAILURE
  -> READY_FOR_RETRY        (owner approval only)

READY_FOR_RETRY
  -> DEVELOPING

READY_FOR_REVIEW
  -> REVIEWING
       -> READY_TO_MERGE
       -> CHANGES_REQUIRED
       -> PAUSED_AI_FAILURE

CHANGES_REQUIRED
  -> READY_FOR_DEVELOPMENT  (after the plan/fix scope is explicitly updated)

READY_TO_MERGE
  -> MERGED
       -> DEPLOYING  (owner approval only)
            -> DONE
       -> DONE        (no deployment provider)
```

## Pause/resume rules

- Never replace a paused model with another model automatically.
- Never resume because a time window probably expired.
- A paused stage stays paused until the owner explicitly changes it to
  `READY_FOR_RETRY` or otherwise approves the next action.
- Preserve the same branch and task plan when resuming.
- The next agent must read the existing plan and current diff before acting.
- A retry is a new AI call and counts toward the task budget in `AI_POLICY.md`.
- If the allowed budget is exhausted, use `NEEDS_HUMAN_REVIEW` in the GitHub
  discussion/issue rather than making more AI calls.

## Branch ownership

- One task = one feature branch.
- Only the active Developer may modify product/test files on that branch.
- Planner and Reviewer are read-only with respect to production code.
- Do not create a second branch merely because a model hit a rate limit.
- Do not let two Developer agents work on the same files concurrently.

## Reviewer state

The Gemini reviewer is armed only by the `ready-for-ai-review` label.
That label represents explicit permission for one review call.

After one review run, the workflow removes the label automatically.
A failed or rate-limited review therefore stays paused until the owner explicitly
re-adds the label.

## Human meaning

In simple terms:

- READY = an agent may start.
- ACTIVE = one agent owns the stage.
- PAUSED = stop spending and wait.
- RETRY = the owner explicitly allows one more attempt.
- DONE = the next stage may begin.
