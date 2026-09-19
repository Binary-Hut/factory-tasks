# Issue #4 — Incomplete Task Counter

Status: READY_FOR_DEVELOPMENT
Role owner: Planner
Branch: `feature/incomplete-task-counter`

## Goal
Show the user how many tasks are currently incomplete, in the form
"N tasks remaining", so they can see remaining work at a glance.

## In scope
- Display a text counter (e.g. "2 tasks remaining") showing the number of
  tasks where `done === false`.
- Recalculate and re-render the counter every time the task list changes:
  on add, on toggling complete/incomplete, and on delete.
- Correct singular/plural wording: "1 task remaining" vs "2 tasks remaining"
  vs "0 tasks remaining".
- Counter is derived from the existing `tasks` array in memory/localStorage
  at render time — no new storage key.

## Out of scope
- Counting or displaying completed tasks separately.
- Filtering, sorting, or grouping tasks by completion status.
- Any new persisted value, dependency, framework, backend, or API call.
- Changing the existing empty-state message ("No tasks yet...").

## Acceptance criteria
- With 0 tasks, the counter reads "0 tasks remaining".
- Adding a task increases the count by 1 and updates the counter text.
- Checking a task as done decreases the count by 1.
- Un-checking a completed task increases the count by 1.
- Deleting an incomplete task decreases the count by 1; deleting a completed
  task does not change the count.
- With exactly 1 incomplete task, the counter reads "1 task remaining"
  (singular), not "1 tasks remaining".
- After a page reload, the counter reflects the correct count restored from
  `localStorage`.
- No new dependencies, frameworks, or files beyond `index.html` are
  introduced; `AI_POLICY.md` and `AGENTS.md` constraints are respected.

## Likely files to change
- `index.html` only:
  - Add a small element (e.g. a `<p id="task-counter">`) near the task list.
  - Add a `renderCounter()` (or equivalent) step called from the existing
    `render()` function, computing the incomplete count from `tasks`.

## Tests to add or update
- `tests/tasks.spec.js` — add cases for:
  - Counter shows "0 tasks remaining" with no tasks.
  - Counter shows "1 task remaining" after adding one task (singular form).
  - Counter shows "2 tasks remaining" after adding a second task.
  - Counter decrements when a task is marked done, and increments again
    when un-marked.
  - Counter is unaffected when a completed task is deleted, and decrements
    when an incomplete task is deleted.
  - Counter value is correct after `page.reload()`.

## Risks or questions
- None blocking. Only minor implementation detail left to the Developer:
  exact placement/styling of the counter element, as long as it doesn't
  alter existing markup relied on by current tests (`.task`, `.task-text`,
  `#task-list`, `.delete-btn`, checkbox selector).

## Handoff
The plan is approved and ready for development.
The Developer must implement only this approved plan.
