# PRODUCT.md — Factory Tasks

## What this product is

Factory Tasks is a single-page task manager. A user can:

1. Add a task
2. Mark a task as completed or not completed
3. Delete a task

Tasks are saved in the browser only (using `localStorage`). There is no server
and no shared database — each browser has its own separate task list.

## Why this product exists

Factory Tasks is intentionally trivial. Its purpose is NOT to be a useful app.
Its purpose is to be a small, stable "test subject" for building and learning
an AI-driven software development pipeline (requirements → code → tests →
deploy → verify → repeat).

## Explicitly out of scope (do not add without the owner's explicit request)

- Login / authentication
- Payments
- Email or WhatsApp notifications
- Any external API calls
- A real database (Postgres, MongoDB, etc.)
- A mobile app
- AI features inside the app itself
- Any framework (React, Vue, etc.) or build tooling
- Multi-device sync / accounts

If a future task or idea would require any of the above, stop and ask the
owner before proceeding — do not silently add complexity.
