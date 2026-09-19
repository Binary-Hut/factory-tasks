# ROADMAP.md — Factory Tasks

Each phase is small on purpose. Do not start a phase before the previous one
is confirmed working.

- [x] **Phase 1 — Build the basic app**
  Single-file task manager (add / complete / delete), running locally,
  with starter documentation.

- [x] **Phase 2 — Add GitHub**
  The project is under version control so every change is tracked and
  recoverable.

- [x] **Phase 3 — Add automated tests**
  Playwright covers core task behavior, including regression checks such as
  deleting one task without deleting the others.

- [x] **Phase 4 — Add automated checks (CI)**
  GitHub Actions automatically runs source-code tests on changes to main and
  on pull requests.

- [x] **Phase 5 — Deploy to Vercel**
  The app is live on Vercel.

- [x] **Phase 6 — Automated browser verification of the live site**
  A separate production workflow tests the deployed website.

- [x] **Phase 6.5 — AI budget, retry, and safety controls**
  AI_POLICY.md defines cost limits, retry limits, escalation rules, and
  multi-agent boundaries. Automatic repair is capped at one AI attempt.
  Production verification remains deterministic and does not invoke AI.

- [x] **Phase 7 — Controlled bug experiments**
  Intentional delete bugs were introduced. The pipeline detected them,
  triggered a low-cost Codex repair, validated the fix, and restored the app.

- [x] **Phase 8 — Separate AI roles**
  Introduce a minimal multi-agent structure before adding orchestration tools.

  Start with only these roles:

  1. **Planner**
     - Converts a plain-English request into a small implementation plan.
     - Defines acceptance criteria.
     - Does not write production code.
     - Suggested model: stronger reasoning model, used only when needed.

  2. **Developer**
     - Implements the approved plan on a feature branch.
     - Keeps changes small and scoped.
     - Reads AI_POLICY.md, AGENTS.md, PRODUCT.md, and ARCHITECTURE.md.
     - Suggested model: capable mid-cost coding model.

  3. **Reviewer**
     - Reviews the resulting diff independently.
     - Checks scope, regressions, unnecessary complexity, and policy violations.
     - Should preferably use a different model family from the Developer.
     - Does not rewrite the feature unless the review identifies a concrete issue.

  Deterministic automation remains responsible for:
  - running tests
  - CI
  - build/deployment
  - production verification

  Phase 8 is complete when one small feature can move through:
  request → plan → branch → implementation → review → tests → merge.

- [x] **Phase 9 — Safe task state, budgets, and parallel branch ownership**
  Tasks can pause/resume without automatic retries, one modifying agent owns a
  task at a time, and the branch collision guard prevents overlapping file edits.
  AI call budgets and explicit reviewer arming limit accidental spend.

- [ ] **Phase 9.5 — Task registry**
  Keep a simple GitHub-backed record of task state, branch, agent ownership,
  AI calls used, and result. This becomes the data model for the owner UI.

- [ ] **Phase 10 — Factory Console MVP**
  Build our own non-technical control surface over the GitHub factory.
  Start with Dashboard, New Task, Task Details, and state-aware approval actions.
  GitHub remains the source of truth; the console must not duplicate orchestration
  state. Vibe Kanban/OpenHands may be optional execution tools later, not the
  foundation of the owner interface.

- [ ] **Phase 11 — First productive Musical Hut project**
  Reuse this factory structure for a small real business tool, such as a
  Student Practice Tracker, while preserving the same cost and safety controls.
