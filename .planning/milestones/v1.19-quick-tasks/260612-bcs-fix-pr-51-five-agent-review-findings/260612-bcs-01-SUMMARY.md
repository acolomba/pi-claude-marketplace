---
quick_task: 260612-bcs-fix-pr-51-five-agent-review-findings
sub_plan: 01
type: execute
wave: 1
requirements:
  - I1
  - I2
  - I5
  - S2
  - S3
status: complete
commit: d552ccd
---

# Sub-plan 01: I1 / I2 / I5 / S2 / S3 (catalog-amending findings)

## Closure summary

All five catalog-amending findings from PR #51 closed in a single atomic
Conventional Commit (`d552ccd`). The catalog-uat byte gate stays GREEN --
existing fixtures unchanged; two new fixtures added to document the new
rendered shapes.

## Per-finding closure

### I1 - Orchestrated partial marketplace-remove cascade

- **Source change:** `RemoveMarketplaceOutcome` gains a `partial` arm
  carrying `unstaged: readonly string[]` AND `failed: readonly {name, reason}[]`.
  `emitPartialFailure` returns this shape in orchestrated mode.
- **Apply change:** `applyMarketplaceRemoves` (via the new `foldRemoveOutcome`
  helper) renders one row per plugin -- ○ `(uninstalled)` for unstaged, ⊘
  `(failed) {reason}` for failed -- plus a bare `(failed)` mp header via the
  new `mp-remove-partial` outcome kind.
- **Catalog amendment:** new `partial-marketplace-remove` state under
  `reconcile-applied-cascade` in `docs/output-catalog.md` + matching fixture
  in `tests/architecture/catalog-uat.test.ts`.
- **Test:** `I1 / PR #51: orchestrated partial remove returns { status: 'partial' }...`
  in `tests/orchestrators/marketplace/remove.test.ts`.

### I2 - Autoupdate write-back skips surfaced honestly

- **Source change:** `writeAutoupdateBack` now returns
  `{ skipped: readonly string[] }`; `flipOneScope` propagates skipped names;
  `setMarketplaceAutoupdate` demotes skipped entries from success rows to
  `(failed) {not found}` rows (closed-set reason; no new tokens). Orchestrated
  mode runs the same skip detection dry (no disk write).
- **Catalog amendment:** none -- the new failure path uses the existing
  `MpFailed` shape and `not found` reason. Caller order preserves cascade
  byte form so no existing fixture is affected.
- **Test:** `I2 / PR #51: write-back skipped (unsynthesizable source) renders a failed row...`
  in `tests/orchestrators/marketplace/autoupdate.test.ts`.

### I5 - loadConfig diagnostic threaded through cause trailer

- **Source change:** New `redactAbsolutePaths(text: string): string` helper
  exported from `shared/notify.ts` (collapses POSIX / Windows / UNC absolute
  paths to basename while preserving JSON-pointer schema keys like
  `/marketplaces`). `InvalidBlockOutcome` gains optional `cause?: Error`.
  `readPassForScope` builds the cause from `outcome.base.error` /
  `outcome.local.error` after redaction; the reconcile projection (`notify.ts`
  `invalid-block` case) attaches a synthetic `PluginFailedMessage` child
  carrying the cause -- SNM-10 pattern, since marketplace headers cannot
  carry a cause.
- **Catalog amendment:** new `invalid-config-row-with-cause` state under
  `reconcile-applied-cascade` in `docs/output-catalog.md` + matching fixture
  in `tests/architecture/catalog-uat.test.ts`. Existing `invalid-config-row`
  fixture stays byte-identical (no cause).
- **Test:** `I5 / PR #51: schema-invalid claude-plugins.json -- cause trailer carries the granular schema-key detail...`
  in `tests/orchestrators/reconcile/apply.test.ts`.
- **Scope note:** I5 was wired at `reconcile/apply.ts:152-169` (the easiest
  consumer surface per the plan). Other consumer surfaces listed in
  CONTEXT.md (`reconcile/preview.ts`, `enable-disable.ts`, `install.ts`,
  `uninstall.ts`, `marketplace/remove.ts`, `marketplace/autoupdate.ts`,
  `migrate-config.ts`) already synthesize their own error messages with
  basename-only -- threading raw `result.error` there is a follow-up that
  can land byte-stably (no synthetic-child rendering at those sites).

### S2 - Reconcile-driven postCommitWarnings surfaced

- **Source change:** `PluginInstalledOutcome` gains optional
  `postCommitWarnings?: readonly string[]`. `applyPluginInstalls`
  propagates from `installPlugin`'s outcome. New `notifyDiagnostic(ctx,
  header, lines)` seam exported from `shared/notify.ts` -- the sanctioned
  side-channel for post-cascade hygiene warnings (the ONLY documented
  exception to RECON-04's single-emit discipline). `applyReconcile` calls
  `surfacePostCommitWarnings` after the cascade.
- **Catalog amendment:** none -- `notifyDiagnostic` fires plain-text under a
  separate notify call; the cascade body itself is byte-identical to today.
- **Test:** `S2 / PR #51: reconcile cascade surfaces InstallPluginOutcome.postCommitWarnings...`
  in `tests/orchestrators/reconcile/apply.test.ts` (structural -- pins the
  outcome shape carries warnings; the surfacing helper is small and obvious).

### S3 - Read-pass throw attribution

- **Source change:** New `MigrateConfigSaveError` class wraps any throw
  inside `migrateFirstRunConfig` so the per-scope catch in `applyReconcile`
  can attribute the failure row to `claude-plugins.json` (the actual failing
  file) instead of `state.json`. The catch also threads the underlying
  cause's redacted message into the new `InvalidBlockOutcome.cause` field so
  the operator sees WHY the save failed.
- **Catalog amendment:** none -- the existing `invalid-config-row` fixture
  already uses `claude-plugins.json` (the post-fix attribution). No new
  fixture for the state.json arm because `WR-01` already covers the corrupt
  state.json case byte-for-byte.
- **Test:** `S3 / PR #51: read-pass throw on saveConfig (claude-plugins.json EACCES) attributes the failed row to claude-plugins.json basename, not state.json`
  in `tests/orchestrators/reconcile/apply.test.ts`.

## Files modified

| File                                                                 | Change                                                                              |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `extensions/.../orchestrators/marketplace/remove.ts`                 | I1 partial arm on `RemoveMarketplaceOutcome` + orchestrated emit.                  |
| `extensions/.../orchestrators/marketplace/autoupdate.ts`             | I2 skipped-name propagation + failed-row demotion.                                  |
| `extensions/.../orchestrators/reconcile/apply.ts`                    | I1 fold helper, I5 cause threading, S2 side-channel surfacing, S3 wrapping.        |
| `extensions/.../orchestrators/reconcile/apply-outcomes.ts`           | I1 `mp-remove-partial` kind; I5 optional `cause` on `InvalidBlockOutcome`; S2 `postCommitWarnings` on `PluginInstalledOutcome`. |
| `extensions/.../orchestrators/reconcile/notify.ts`                   | I1 / I5 projection arms.                                                            |
| `extensions/.../shared/notify.ts`                                    | New `redactAbsolutePaths` + `notifyDiagnostic` helpers.                            |
| `docs/output-catalog.md`                                             | New `invalid-config-row-with-cause` + `partial-marketplace-remove` catalog states. |
| `tests/architecture/catalog-uat.test.ts`                             | Matching fixtures for the two new catalog states.                                  |
| `tests/orchestrators/marketplace/remove.test.ts`                     | I1 RED-then-GREEN test.                                                             |
| `tests/orchestrators/marketplace/autoupdate.test.ts`                 | I2 RED-then-GREEN test.                                                             |
| `tests/orchestrators/reconcile/apply.test.ts`                        | I5 / S2 / S3 RED-then-GREEN tests.                                                  |

## Verification

- `npm run check`: GREEN (typecheck + ESLint + Prettier + 1815 tests + 10
  integration tests).
- `tests/architecture/catalog-uat.test.ts`: GREEN -- byte gate holds; new
  fixtures pair with new catalog annotations on both forward + inverse
  walks.
- Pre-commit hooks: GREEN (no `--no-verify`).
- One Conventional Commit (`d552ccd`), title 69 chars (≤72), longest body
  line 74 chars (≤80).

## Out of scope (other sub-plans)

- C1 / I3 / I4 (enable-disable.ts) -- Plan 02.
- I6 / Y7 / S4 / S6 -- Plan 03.
- Type-design cuts (Y1..Y6) -- Plans 04, 05.
- Comments/docs cleanup -- Plan 07.
