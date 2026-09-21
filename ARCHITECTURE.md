# ARCHITECTURE.md — Factory Tasks

## In plain English

Factory Tasks is one file: `index.html`. That single file contains the
page's layout, its styling, and its logic, all together. When you open it
in a browser, everything the app needs is already inside it — nothing else
is downloaded or contacted.

When you add, check off, or delete a task, the app writes the current list
of tasks into a small storage locker built into your browser (this is called
`localStorage`). Next time you open the page in that same browser, it reads
the list back out. There is no server involved and no internet connection
required after the page has loaded once.

Think of it like a sticky note pad that lives inside your browser, on your
one device.

## Technical detail

- **Language:** HTML, CSS, and vanilla JavaScript (no framework, no build step, no npm packages)
- **File:** `index.html` — self-contained
- **Storage:** Browser `localStorage`, under the key `factory-tasks-v1`
- **Data shape:** an array of task objects, each `{ id, text, done }`
- **No backend, no API, no database**
- **Deployment:** Vercel, through a separate owner-approved production workflow. The root app remains a static file, so the product itself has no runtime backend dependency

## Why this architecture

This is the simplest architecture that can support the required features
(add / complete / delete) while staying:
- Free to run
- Trivial for an AI coding agent to read in full and edit safely
- Free of hidden failure points (no server to crash, no API to time out, no
  database to misconfigure)

## What would change this architecture

Only a deliberate, owner-approved decision to add one of the PRODUCT.md
"out of scope" items should introduce a backend, a database, or a framework.
Until then, all future work should stay inside this single-file model
(or split into a small number of plain files if `index.html` becomes too
large to read comfortably — see AGENTS.md).


## Factory Console control plane

The owner-facing Factory Console is separate from the Factory Tasks product at
the site root. The root task manager remains a static localStorage application.

The Console may use small Vercel serverless functions under `api/` for
owner-approved factory administration. This exception exists because privileged
actions such as creating GitHub repositories cannot safely be performed in
browser JavaScript.

Current control-plane rules:

- GitHub OAuth Client Secret and session secret are server-side environment variables.
- The browser never receives a reusable GitHub write credential.
- The signed-in session is encrypted and stored in an HttpOnly, Secure cookie.
- Only the configured GitHub owner account may provision projects.
- Project creation does not automatically run a paid AI model.
- No database is required; GitHub remains the source of truth.
- Factory Console OAuth requests the public-repository and workflow permissions needed to provision repositories and their GitHub Actions workflows.
- New projects are created in the configured Binary Hut organization while the authorized owner identity remains a separate setting.
- Project lifecycle state is derived from GitHub branches, task plans, pull requests, reviews, dispatch locks, and workflow results rather than duplicated in a separate database.
- Production deployment is a separate owner-confirmed action. For Vercel, each repository carries non-secret `.factory/deployment.json` metadata while the reusable workflow resolves project/account IDs at runtime. The GitHub workflow requires a server-side `VERCEL_TOKEN`; missing credentials, project access, or public-production access are surfaced as setup requirements rather than source-test failures.
