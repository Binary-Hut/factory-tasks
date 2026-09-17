# Factory Tasks

A very simple task manager: add a task, mark it done, delete it. Built as a
test project for learning an AI-assisted software development pipeline.

See also: [PRODUCT.md](./PRODUCT.md) (what this is and isn't),
[ARCHITECTURE.md](./ARCHITECTURE.md) (how it works),
[AGENTS.md](./AGENTS.md) (rules for AI agents editing this repo),
[ROADMAP.md](./ROADMAP.md) (phased plan).

## How to run it

There is nothing to install. Open `index.html` in any web browser
(double-click the file, or drag it into a browser window).

## How to use it

1. Type a task into the text box and click **Add** (or press Enter)
2. Click the checkbox next to a task to mark it done or not done
3. Click the **×** next to a task to delete it

Your tasks are saved automatically in your browser. They will still be
there next time you open the file in the same browser on the same device.

## How to test it (manual, for now)

1. Add a task called "Test 1" — confirm it appears in the list
2. Click its checkbox — confirm it gets a strikethrough
3. Click its checkbox again — confirm the strikethrough goes away
4. Click the × next to it — confirm it disappears from the list
5. Add three tasks, refresh the page — confirm all three are still there

(Automated tests are planned for a later phase — see ROADMAP.md.)

## How to deploy it

Not yet set up — this is a later phase (see ROADMAP.md, Phase 5). For now,
the app runs entirely from the local `index.html` file.
