---
phase: quick-260618-t0n
plan: 01
status: complete
subsystem: edge-surface
tags: [breaking-change, command-rename, public-api, notify-catalog]

# Dependency graph
requires:
  - phase: v1.13 (Phase 63)
    provides: the v1.13 hook-bridge codebase carrying the `/claude:plugin preview` surface
provides:
  - `/claude:plugin pending` CLI surface (renamed from `preview`)
  - `pendingReconcile` / `makePendingHandler` / `PendingReconcileOptions` symbols
  - `reconcile-pending-empty` NotificationMessage discriminator
  - `Pending: next reload will apply 0 actions.` catalog-locked advisory body
affects: [edge-router, edge-handlers, reconcile-orchestrator, notify-catalog, docs]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Command rename via `git mv` for file moves (preserves blame history)"
    - "Catalog UAT walks docs/output-catalog.md HTML annotations; section-header renames in docs must move in lockstep with notify-kind discriminator renames in source + fixture map"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/edge/router.ts
    - extensions/pi-claude-marketplace/edge/register.ts
    - extensions/pi-claude-marketplace/edge/handlers/tools.ts
    - extensions/pi-claude-marketplace/edge/handlers/plugin/preview.ts → pending.ts (renamed)
    - extensions/pi-claude-marketplace/orchestrators/reconcile/preview.ts → pending.ts (renamed)
    - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/list.ts
    - extensions/pi-claude-marketplace/persistence/config-write-back.ts
    - extensions/pi-claude-marketplace/shared/notify.ts
    - tests/edge/handlers/plugin/preview.test.ts → pending.test.ts (renamed)
    - tests/orchestrators/reconcile/preview.test.ts → pending.test.ts (renamed)
    - tests/edge/router.test.ts
    - tests/edge/completions/provider.test.ts
    - tests/architecture/catalog-uat.test.ts
    - tests/architecture/notify-grammar-invariant.test.ts
    - tests/architecture/notify-types.test.ts
    - tests/architecture/no-orchestrator-network.test.ts
    - tests/orchestrators/reconcile/notify.test.ts
    - tests/orchestrators/reconcile/plan.test.ts
    - tests/shared/notify-v2.test.ts
    - docs/messaging-style-guide.md
    - docs/output-catalog.md
    - CHANGELOG.md

key-decisions:
  - "Scope: rename the user-facing CLI command + every symbol named after it (files, functions, types, notification kind). Leave incidental descriptive uses of the word `preview` (e.g. the `dry-run preview pattern` comment in enable-disable.ts) untouched -- those are pattern names, not command references."
  - "Catalog advisory body line rewritten from `Preview: next reload will apply 0 actions.` to `Pending: next reload will apply 0 actions.` -- mirrors the rename and is the byte-equality target the catalog UAT walks against."
  - "Two commits: source+tests in one (the breaking change), docs+CHANGELOG in the second."

patterns-established:
  - "After a notify-variant kind rename, both the discriminator literal in source AND the catalog UAT fixture map key AND the `## ## /claude:plugin <verb>` section header in docs/output-catalog.md must move in lockstep -- otherwise the catalog UAT fixture-walk gate red-fails with `[MISSING FIXTURE] section=...`."

requirements-completed: []
---

# Pending Command Rename Summary

## Goal

Rename `/claude:plugin preview` → `/claude:plugin pending`. Propagate
through the dispatch surface, the file/symbol layout that follows the
command name, the notification-kind catalog, and the user-facing docs.

## Outcome

- `npm run check` green at every commit boundary.
- 2297 unit tests + 16 integration tests pass.
- Catalog UAT byte-equality gate satisfied against the renamed advisory.
- `git log --follow` continues to track both renamed source/test files via
  `git mv`.

## What was renamed

| Surface | Before | After |
|---------|--------|-------|
| CLI verb | `/claude:plugin preview` | `/claude:plugin pending` |
| Handler file | `edge/handlers/plugin/preview.ts` | `edge/handlers/plugin/pending.ts` |
| Orchestrator file | `orchestrators/reconcile/preview.ts` | `orchestrators/reconcile/pending.ts` |
| Handler factory | `makePreviewHandler` | `makePendingHandler` |
| Orchestrator entry | `previewReconcile` | `pendingReconcile` |
| Options bundle | `PreviewReconcileOptions` | `PendingReconcileOptions` |
| Notification kind | `reconcile-preview-empty` | `reconcile-pending-empty` |
| Empty-message type | `ReconcilePreviewEmptyMessage` | `ReconcilePendingEmptyMessage` |
| Projection builder | `buildReconcilePreviewNotification` | `buildReconcilePendingNotification` |
| Catalog body line | `Preview: next reload will apply 0 actions.` | `Pending: next reload will apply 0 actions.` |
| Catalog section | `## /claude:plugin preview` | `## /claude:plugin pending` |

## What was NOT renamed

- The `dry-run preview pattern` comment in
  `orchestrators/plugin/enable-disable.ts:51` -- this is a generic pattern
  name (the "dry-run preview" pattern), not a reference to the command.
- Historical CHANGELOG entries (`## [0.5.0]`) that introduce the
  `preview` command -- history is history.

## Commits

1. `refactor: rename \`preview\` command to \`pending\`` -- source + tests.
2. `docs: record \`preview\` → \`pending\` command rename` -- docs + CHANGELOG `[Unreleased]` entry.
