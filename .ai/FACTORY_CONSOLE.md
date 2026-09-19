# FACTORY_CONSOLE.md — Non-Technical Factory Console

## Purpose

Provide a simple owner-facing interface over the GitHub-based software factory.
The owner should not need to understand branches, workflow run IDs, YAML, commits,
or GitHub Actions for normal operation.

GitHub remains the source of truth. The console reads state from GitHub and sends
explicit approved actions back to GitHub.

## MVP screens

### 1. Dashboard

Show large task cards grouped into:

- Needs your attention
- Planning
- Building
- Waiting for review
- Ready to merge
- Live / Done

Each card should show only:

- task name
- plain-English status
- current agent
- AI calls used / allowed
- test status
- preview availability
- one clear next action

### 2. New Task

A plain-English box:

> What would you like to build or change?

The console creates the underlying task record/issue. It must not immediately
spend AI budget without an explicit workflow action.

### 3. Task Details

Show:

- request
- plan
- current stage
- Planner / Developer / Reviewer
- branch (under Advanced)
- changed files (under Advanced)
- AI calls used
- test result
- reviewer result
- preview link when available
- production state after merge

### 4. Owner actions

Only show actions valid for the current state:

- Approve Plan
- Start Build
- Pause
- Approve Retry
- Send for Review
- Approve & Merge
- Open Preview

Dangerous or costly actions require confirmation.

## Plain-English status translations

| Factory state | Owner sees |
| --- | --- |
| PLANNING | Preparing the plan |
| READY_FOR_DEVELOPMENT | Plan ready for your approval |
| DEVELOPING | Building |
| PAUSED_AI_FAILURE | Stopped safely — needs your attention |
| READY_FOR_RETRY | Retry approved |
| READY_FOR_REVIEW | Build complete — ready for review |
| REVIEWING | Independent review in progress |
| CHANGES_REQUIRED | Changes requested |
| READY_TO_MERGE | Ready for your approval |
| DONE | Live |

## Failure messages

Do not show a raw workflow failure as the primary message.

Example:

**Developer could not finish. No retry was attempted and no additional AI cost
was incurred. Review the reason and approve a retry only if you want to continue.**

Technical logs belong under an **Advanced details** section.

## Architecture

```text
Factory Console
      |
      v
GitHub task registry / issues / PR state
      |
      v
GitHub Actions
      |
      +--> Planner
      +--> Developer
      +--> deterministic tests
      +--> Reviewer
      |
      v
Vercel preview / production
```

The console must not become a second source of truth.

## Authentication

Authentication is deliberately deferred for the prototype. Do not expose a
write-capable public console without authentication. The first UI may be
read-only or locally operated while the control API/auth design is decided.

## MVP success criteria

The owner can understand the state of a task without opening GitHub Actions and
can identify the next safe action from the console.

The first implementation should prove the UI/state mapping before adding complex
agent orchestration.
