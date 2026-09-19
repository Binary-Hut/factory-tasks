# Multi-Agent Branch Ownership

This file defines how multiple AI agents may work in parallel without editing the
same code at the same time.

## Core rule

**One task branch has one modifying agent at a time.**

Planner and Reviewer agents are read-only for production code. The Developer is
the only agent allowed to modify product/test files for that task.

## Branch model

Use one feature branch per task:

```text
main
├── feature/task-a
├── feature/task-b
└── feature/task-c
```

Different Developers may work at the same time only when their branches do not
change the same files.

## Role ownership

### Planner
- May read repository files.
- May create/update the task plan only.
- Must not edit production or test code.

### Developer
- Owns the feature branch while status is `DEVELOPING`.
- Is the only AI agent allowed to edit production/test files on that branch.
- Must stop if another open feature PR already changes one of the same files.

### Reviewer
- Read-only for product/test code.
- Reviews the completed diff.
- Must not implement its own fixes.
- If changes are required, return the task to a Developer stage.

### Deterministic automation
- Tests, collision checks, deployment checks, and formatting checks are not AI
  agents and may run concurrently.

## File collision rule

Two open feature pull requests must not modify the same file at the same time.

Examples:

- PR A changes `index.html`, PR B changes `README.md` -> parallel work is OK.
- PR A changes `index.html`, PR B also changes `index.html` -> stop one branch
  before continuing.
- PR A changes `tests/tasks.spec.js`, PR B changes the same test file -> conflict;
  serialize the work.

The GitHub `Branch Collision Guard` workflow checks this automatically.

## Shared infrastructure files

Changes to shared factory files should normally be isolated from feature work:

- `.github/workflows/**`
- `AI_POLICY.md`
- `AGENTS.md`
- `.ai/roles/**`
- `.ai/WORKFLOW_STATE.md`
- `.ai/BRANCH_OWNERSHIP.md`

Use a dedicated infrastructure branch when changing these files while feature
branches are active.

## Pause and handoff

When a Developer pauses because of rate limits, model limits, or failure:

- keep the same task branch;
- keep the same task plan;
- set the task state according to `.ai/WORKFLOW_STATE.md`;
- do not automatically assign a different Developer model;
- resume only after explicit owner approval.

If the owner deliberately changes Developer models, the new model must continue
on the same branch and read the current diff before editing anything.

## Parallelism rule

Safe:
```text
feature/task-a -> Codex Developer
feature/task-b -> another Developer
feature/task-c -> Planner or Reviewer
```

Only when the modifying branches do not overlap files.

Unsafe:
```text
feature/task-a -> Codex editing index.html
feature/task-b -> another model editing index.html
```

## Human-readable summary

- Different task + different files = parallel is fine.
- Same file = one branch at a time.
- Same task = one Developer at a time.
- Planner/Reviewer = read-only for application code.
