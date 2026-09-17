# ROADMAP.md — Factory Tasks

Each phase is small on purpose. Do not start a phase before the previous one
is confirmed working.

- [x] **Phase 1 — Build the basic app**
  Single-file task manager (add / complete / delete), running locally,
  with starter documentation (this set of files).

- [ ] **Phase 2 — Add GitHub**
  Put the project under version control so every change is tracked and
  recoverable.

- [ ] **Phase 3 — Add automated tests**
  Add simple logic tests (does adding a task work, does deleting work) and
  a basic automated browser test.

- [ ] **Phase 4 — Add automated checks (CI)**
  Automatically run the tests every time a change is made, before it's
  allowed to go live.

- [ ] **Phase 5 — Deploy to Vercel**
  Make the app reachable via a real public web address.

- [ ] **Phase 6 — Automated browser verification of the live site**
  A robot opens the real deployed website and confirms it still works,
  after every deployment.

- [ ] **Phase 7 — Controlled bug experiments**
  Intentionally introduce a bug and observe whether the pipeline detects,
  diagnoses, fixes, retests, and redeploys automatically.

- [ ] **Phase 8 — Multiple AI roles**
  Introduce separate roles (Product Manager, Architect, Developer, Reviewer,
  QA, Bug Fixer) only once the simpler pipeline is well understood.
