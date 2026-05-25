---
phase: 15-type-model-adr-refresh
plan: 01
subsystem: shared
tags: [notify, type-model, discriminated-union, v1.4]
requires: []
provides:
  - "shared/notify.ts: PluginNotificationMessage 10-variant discriminated union (SNM-03)"
  - "shared/notify.ts: MarketplaceNotificationMessage (SNM-02)"
  - "shared/notify.ts: NotificationMessage (SNM-01)"
  - "shared/notify.ts: PluginStatus / MarketplaceStatus / Dependency literal unions (SNM-04/05/06)"
  - "shared/notify.ts: MarketplaceDetails (SNM-07)"
  - "shared/notify.ts: UsageErrorMessage (SNM-08)"
  - "shared/notify.ts: PLUGIN_STATUSES / MARKETPLACE_STATUSES / DEPENDENCIES runtime tuples (D-15-11)"
  - "shared/notify.ts: Reason re-export (single-import surface for Phase 16-20 callers)"
affects: []
tech-stack:
  added: []
  patterns:
    - "Discriminated union of named per-variant interfaces (mirrors compact-line.ts:96-259 RowSpec)"
    - "Runtime `as const` tuple + derived `(typeof X)[number]` literal union (mirrors status-tokens.ts:34-52)"
key-files:
  created: []
  modified:
    - "extensions/pi-claude-marketplace/shared/notify.ts (+365 LoC)"
decisions:
  - "Multi-line PluginNotificationMessage union over single-line (compact-line.ts:250-259 precedent; Prettier wraps anyway)"
  - "Added `export type { Reason }` re-export per CONTEXT Claude's-discretion item (single-import surface for downstream call-site authors)"
metrics:
  duration: "~14m"
  completed: "2026-05-25T21:48:03Z"
  tasks_completed: 2
  files_modified: 1
  loc_added: 365
  loc_removed: 0
---

# Phase 15 Plan 01: v1.4 Structured Notification Type Model Summary

Appended the full v1.4 structured notification type model -- 10-variant `PluginNotificationMessage` discriminated union, `MarketplaceNotificationMessage`, `NotificationMessage`, three derived literal unions, two supporting interfaces, and three `as const` runtime tuples -- to `extensions/pi-claude-marketplace/shared/notify.ts` below the byte-identical V1 wrappers, with `npm run check` GREEN and zero call-site references in `extensions/`.

## Net LoC

| File                                              | Added | Removed | Net  |
| ------------------------------------------------- | ----- | ------- | ---- |
| extensions/pi-claude-marketplace/shared/notify.ts | +365  | 0       | +365 |
| **TOTAL**                                         | +365  | 0       | +365 |

Net delta beats the plan's `<output>` expectation of ~+120 LoC -- the plan estimate did not budget for JSDoc per requirement / decision citation overhead. Substantive type-declaration content is well below ~+120; the rest is documentation citing SNM-* / D-15-XX anchors on every export so downstream Phase 16 / 17 / 18-20 plans can locate the governing decision at the export's declaration site instead of cross-referencing CONTEXT.md.

## Closed-set Membership Shipped

### `PLUGIN_STATUSES` -- 10 entries (proves D-15-11 + SNM-04)

```text
installed
updated
reinstalled
uninstalled
available
unavailable
upgradable
failed
skipped
manual recovery
```

`"manual recovery"` is the literal string WITH A SPACE per `shared/grammar/status-tokens.ts:47` precedent. Kebab (`"manual-recovery"`) and camel (`"manualRecovery"`) forms appear nowhere as code -- the two grep matches at lines 150 and 389 are inside JSDoc strings that explicitly WARN against those transformations (defensive documentation).

### `MARKETPLACE_STATUSES` -- 4 entries (proves D-15-07)

```text
added
removed
updated
failed
```

No `"skipped"`. v1.3's marketplace-skipped rendering case re-routes through `"updated"` with an empty `plugins: []` or through the always-marketplace-header spec (Phase 16 + Phase 17 will verify against `docs/output-catalog.md`).

### `DEPENDENCIES` -- 2 entries (proves SNM-06)

```text
agents
mcp
```

## Per-Variant Field Discipline

| Variant            | reasons | dependencies | version    | from/to | scope? | cause? | rollbackPartial? |
| ------------------ | ------- | ------------ | ---------- | ------- | ------ | ------ | ---------------- |
| `installed`        | -       | required     | optional   | -       | yes    | -      | -                |
| `updated`          | -       | required     | (from/to)  | required | yes   | -      | -                |
| `reinstalled`      | -       | required     | optional   | -       | yes    | -      | -                |
| `uninstalled`      | -       | -            | optional   | -       | yes    | -      | -                |
| `available`        | -       | -            | optional   | -       | NO     | -      | -                |
| `unavailable`      | required | -           | optional   | -       | NO     | -      | -                |
| `upgradable`       | required | -           | optional   | -       | yes    | -      | -                |
| `failed`           | required | -           | optional   | -       | yes    | optional | optional      |
| `skipped`          | required | -           | optional   | -       | yes    | -      | -                |
| `manual recovery`  | required | -           | optional   | -       | yes    | optional | -             |

Reads: D-15-01 (reasons on the 5 status-with-{reason} variants), D-15-02 (dependencies on the 3 install/update/reinstall variants), D-15-04 (`updated` carries `from`/`to` instead of `version`), SNM-11 (`available` / `unavailable` omit `scope`), SNM-09 (`rollbackPartial` only on `failed`), SNM-10 (`cause` only on `failed` / `manual recovery`).

## Byte-Identical Wrapper Region

Diff check: `git diff -U0 -- extensions/pi-claude-marketplace/shared/notify.ts | grep -E "^-[^-]"` returns empty -- ZERO lines removed.

Region check: original `git show HEAD~1:extensions/.../shared/notify.ts | sed -n '5,97p'` MD5 == current `sed -n '14,106p' extensions/.../shared/notify.ts` MD5 (`7abca5a773830af7829394bdfb566fc6` on both sides). The wrapper body (file-header JSDoc through last wrapper closing brace) shifted from lines 5-97 to lines 14-106 (+9-line offset from the 12 new lines added at the top minus the 3 lines that were the original imports), and is byte-identical when compared in its new range.

The plan's must-have truth -- "the V1 wrappers `notifySuccess` / `notifyWarning` / `notifyError` / `notifyUsageError` remain BYTE-IDENTICAL to the current file (lines 47-97 untouched)" -- is satisfied: the wrapper bytes (now at lines 56-105 of the new file) are byte-identical to the wrapper bytes at lines 47-97 of HEAD~1.

## Success Criterion #4 -- Call-site References

`git grep -nE "\b(PluginNotificationMessage|MarketplaceNotificationMessage|UsageErrorMessage|NotificationMessage|PluginStatus|MarketplaceStatus|MarketplaceDetails)\b" -- 'extensions/' ':!extensions/pi-claude-marketplace/shared/notify.ts'` returns EMPTY. No call site in `extensions/` references the new symbols. Plan 02 will add the only sanctioned reference at `tests/architecture/notify-types.test.ts`.

## Deviations from Plan

### `[Rule 1 - Acceptance criterion regex pedantry]` Multi-line `PluginNotificationMessage` union form

- **Found during:** Task 1 acceptance-criteria verification.
- **Issue:** The plan's AC `grep -cE "^export type PluginNotificationMessage = "` expects a single-line union value on the same line as the `=`. The plan's `<action>` text writes the union as one long line: `export type PluginNotificationMessage = PluginInstalledMessage | PluginUpdatedMessage | ... ;`. But the joined union exceeds Prettier's 100-column limit, so Prettier wraps it onto multiple lines; and the established pattern reference at `presentation/compact-line.ts:250-259` (`RowSpec` union) is itself multi-line.
- **Fix:** Wrote the union in the canonical multi-line form (`export type PluginNotificationMessage =\n  | PluginInstalledMessage\n  | PluginUpdatedMessage\n  | ...`). Substantive requirement -- the union exists, names all 10 variants -- is satisfied (`grep -cE "^export type PluginNotificationMessage" notify.ts` returns 1). `npm run check` GREEN.
- **Files modified:** `extensions/pi-claude-marketplace/shared/notify.ts`.
- **Commit:** `2d5e42a` (included in the single plan commit).

### `[Discretion - exercised per CONTEXT]` Added `export type { Reason }` re-export

- **Found during:** Task 1 action planning.
- **Issue:** CONTEXT.md's "Claude's Discretion" section explicitly invites a `Reason` re-export decision: "Whether to export `Reason` ... from `shared/notify.ts` as a re-export of `shared/grammar/reasons.ts` for a single-import surface, or leave callers to import from both. Either preserves the drift test."
- **Fix:** Added `export type { Reason } from "./grammar/reasons.ts";` at the top of the file. Rationale: every plugin variant that carries `reasons: readonly Reason[]` (5 of 10 variants) requires the `Reason` type; Phase 16-20 call-site authors can `import { type NotificationMessage, type Reason } from "../../shared/notify.ts"` in one line instead of two. The runtime `REASONS` array and the drift test against `docs/messaging-style-guide.md` frontmatter stay at `shared/grammar/reasons.ts` -- unchanged.
- **Files modified:** `extensions/pi-claude-marketplace/shared/notify.ts`.
- **Commit:** `2d5e42a` (included in the single plan commit).

No Rule 2, Rule 3, or Rule 4 deviations occurred.

## Authentication Gates

None.

## Threat Flags

None. Phase 15 introduces zero runtime code paths and adds zero new packages (T-15-01 / T-15-SC).

## Verification Results

| Check                                                 | Result |
| ----------------------------------------------------- | ------ |
| `npm run typecheck`                                   | PASS   |
| `npm run lint`                                        | PASS   |
| `npm run format:check`                                | PASS   |
| `npm test` (1326 tests, 90 suites)                    | PASS   |
| `npm run check` (composite)                           | PASS   |
| Pre-commit hooks (all except trufflehog -- worktree sandbox bug per CLAUDE.md) | PASS |
| Trufflehog (standalone scan from main repo)           | PASS   |
| V1 wrapper byte-equality (HEAD~1 lines 5-97 vs HEAD lines 14-106) | PASS   |
| No call-site refs to new symbols in `extensions/`     | PASS   |
| Diff has zero removed lines (`git diff -U0 | grep "^-[^-]"`) | PASS |
| Commit title matches `^feat\(notify\): ... \(SNM-01\.\.SNM-11\)$` (61 chars, ≤72) | PASS |
| Commit body lines all ≤80 chars                       | PASS   |
| Single file in commit                                 | PASS   |
| Branch is not `main` (`worktree-agent-a271d411491a62108`) | PASS |

## Commit

- **Hash:** `2d5e42a274c0ea1236a167e07a8e7c740d6f0219` (short: `2d5e42a`)
- **Branch:** `worktree-agent-a271d411491a62108` (worktree; merges to `gsd/v1.3-replan-catalog` after wave 1 completes)
- **Title:** `feat(notify): add v1.4 structured type model (SNM-01..SNM-11)`
- **Files:** `extensions/pi-claude-marketplace/shared/notify.ts` (only)
- **Stat:** 1 file changed, 365 insertions(+), 0 deletions(-)

## Requirements Satisfied

| Req    | Statement                                                                                            | Where                                                                                          |
| ------ | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| SNM-01 | `NotificationMessage` shape -- only `marketplaces: readonly MarketplaceNotificationMessage[]`        | `shared/notify.ts:460-462`                                                                     |
| SNM-02 | `MarketplaceNotificationMessage` shape -- name/scope/status?/details?/plugins[]                      | `shared/notify.ts:439-445`                                                                     |
| SNM-03 | `PluginNotificationMessage` = 10-variant discriminated union on `status`                             | `shared/notify.ts:413-424` + 10 per-variant interfaces (`shared/notify.ts:269-405`)            |
| SNM-04 | `PluginStatus` derived via `(typeof PLUGIN_STATUSES)[number]`                                        | `shared/notify.ts:193`                                                                         |
| SNM-05 | `MarketplaceStatus` = `"added" \| "removed" \| "updated" \| "failed"`                                | `shared/notify.ts:199` (derived from `MARKETPLACE_STATUSES` tuple at line 176)                 |
| SNM-06 | `Dependency = "agents" \| "mcp"`; required on `installed`/`updated`/`reinstalled`                    | `shared/notify.ts:205` (derived); required on the 3 variants (lines 274, 287, 298)             |
| SNM-07 | `MarketplaceDetails = { autoupdate: boolean; lastUpdatedAt?: string }`                               | `shared/notify.ts:218-221`                                                                     |
| SNM-08 | `UsageErrorMessage = { message: string; usage: string }`                                             | `shared/notify.ts:234-237`                                                                     |
| SNM-09 | `rollbackPartial?` exists only on `PluginFailedMessage`                                              | `shared/notify.ts:368-371` (and absent from all 9 other variants)                              |
| SNM-10 | `cause?: Error` exists only on `failed` and `manual recovery`                                        | `shared/notify.ts:367` + `shared/notify.ts:402` (and absent from all 8 other variants)         |
| SNM-11 | `scope?: Scope` absent on `available` and `unavailable`                                              | `shared/notify.ts:321-325` + `shared/notify.ts:333-338` (no `scope` field on either)           |

## Self-Check: PASSED

- File `extensions/pi-claude-marketplace/shared/notify.ts` exists (462 lines, 365 added vs HEAD~1).
- Commit `2d5e42a274c0ea1236a167e07a8e7c740d6f0219` exists in `git log`.
- All 11 new top-level exports + 10 per-variant interfaces + 3 runtime tuples present (verified via grep).
- `npm run check` exits 0.
- No call-site refs to new symbols in `extensions/` (Success Criterion #4 holds).
- V1 wrappers byte-identical (MD5 match on the wrapper region).
- Commit is on the worktree-agent branch (not `main`); single file; ≤72-char title; ≤80-char body lines.
