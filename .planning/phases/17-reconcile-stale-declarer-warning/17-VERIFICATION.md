---
phase: 17-reconcile-stale-declarer-warning
verified: 2026-10-23T14:30:00Z
status: passed
score: 7/7 must-haves verified
covered_files:
  - .planning/phases/17-reconcile-stale-declarer-warning/17-01-PLAN.md
  - .planning/phases/17-reconcile-stale-declarer-warning/17-01-SUMMARY.md
  - docs/dependency-resolution.md
  - docs/json-output.md
  - docs/output-catalog.md
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-declaration-read.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-index.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/dependency-verdict.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts
  - features/marketplace/remove.feature
  - features/marketplace/update.feature
  - features/plugin/reconcile.feature
  - features/plugin/reinstall.feature
  - features/plugin/uninstall.feature
  - features/plugin/update.feature
covered_digest: "v3:sha256:a63e6fe96fe94e3e8075824b5c77e8afd29357e2a8420acb6b70bc93dd39a45a"
behavior_unverified: 0
overrides_applied: 0
---

# Phase 17: Reconcile Stale-Declarer Warning Verification Report

**Phase Goal:** A new session tells the truth about a plugin that is still installed but whose marketplace no longer describes it.
**Requirement:** REC-05
**Verified:** 2026-10-23T14:30:00Z
**Status:** passed
**Re-verification:** No (initial verification)

The change was uncommitted when verification started. The orchestrator committed it as `2bdc399d` (`fix(reconcile): warn about a plugin whose dependencies cannot be read`) during the run. After that commit the working tree has no tracked changes, so the commit is the tree that was checked.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | ROADMAP SC1: a plugin that its marketplace catalog dropped is reported at each new session as a `warning` row with `{not in manifest}` and a cause chain, and it keeps working | VERIFIED | `dependency-index.ts` `readRecordDeclarations`: `declared.kind === "absent"` produces `unreadableDeclarer(key, "not in manifest", "not declared by its marketplace")`. `dependency-verdict.ts:313` passes the failure arm through unchanged. `apply.ts` `reportUnreadableDeclarer` pushes `plugin-declarer-unreadable` with `verdict.reason` and `verdict.cause`. `notify.ts` renders it as `status: "failed"`, `reasons: [reason]`, `cause`, `severity: "warning"`, `needsReload: false`. `plan.ts:433` `isHeldByUnsatisfiedDependency` returns false when `verdict.ok` is false, so nothing is disabled. Behavioral proof: the new `reconcile.feature` scenario "Every new session warns about an installed plugin that its catalog no longer offers and keeps it working" runs two new sessions in a real Pi process. Each session asserts the warning severity, the tally (failures 0, warnings 1), `{not in manifest}`, the cause chain, and that `/skill:demo-skill` is still offered. Passed in a focused run. |
| 2 | ROADMAP SC2: a plugin whose marketplace manifest is invalid is reported the same way with `{invalid manifest}` | VERIFIED | `manifestLoadFailure` maps `InvalidMarketplaceManifestError` to `"invalid manifest"` with the phrase "its marketplace manifest is invalid". The new scenario "Every new session warns about an installed plugin whose marketplace manifest is invalid and keeps it working" asserts the same row shape on two consecutive sessions, and that the skill is still offered. Passed. Note: the cucumber step makes the manifest invalid against the schema (`invalidateManifest(..., "schema-invalid")`). Malformed JSON takes the same code path but has no feature of its own (see WR-02 below). |
| 3 | ROADMAP SC3: `npm run check` stays green | VERIFIED | The orchestrator reports `npm run check` exit 0 on this tree on 2026-10-23: static checks, unit, integration, 704 cucumber scenarios, and direct coverage. As instructed, it was not re-run here. Focused checks run here as corroboration: `npx tsc --noEmit` exit 0; six unit files (205 tests) passed; the REC-05/D-05-07/D-05-16/RECON-04 tests in `apply.test.ts` (8) passed; the six pinned features (196 scenarios) passed. |
| 4 | PLAN (D-05): the walk's failure arm carries a required closed-set `reason`, chosen by the branch that picks the cause phrase | VERIFIED | `DeclarerReadFailure = Extract<Reason, "not in manifest" \| "invalid manifest" \| "unreadable manifest">`. `reason` is required on `ScopeDeclarationIndexResult`, `ScopeDeclarationDetailResult`, and `ScopeSatisfactionVerdict`. Each `unreadableDeclarer` call passes the token and the phrase together. After the WR-01 fix, an own manifest that was refused carries `ownManifest: true` (`OwnManifestRefusal`) and maps to `unreadable manifest`, which matches its "cannot be read" phrase. A rejected `dependencies` value maps to `invalid manifest`. No token is chosen from message text. |
| 5 | PLAN (D-02/D-03): a new outcome kind is rendered `(failed) {<reason>}` at `warning`, with the walk's cause and no reload | VERIFIED | `PluginDeclarerUnreadableOutcome` is in `PerEntryOutcome`. Both notify switches name the kind, and `tsc` would fail on a missing arm. `notify-stamp-coverage.test.ts`, `notify.test.ts`, and `apply-outcomes.test.ts` (`satisfies` plus `@ts-expect-error` proofs) all pass. |
| 6 | PLAN (D-06): the target rows of uninstall, marketplace remove, update, and reinstall keep `{unreadable}` | VERIFIED | `grep "failed \| unreadable" features` finds only command target rows: `remove.feature:588`, `uninstall.feature:230`, `update.feature:181`, `reinstall.feature:103,140`, plus the unrelated EISDIR row at `update-rollback.feature:29`. Each of the first four carries the "cannot read the dependencies of ..." cause, and none sits after a "starts a new pi session" step. |
| 7 | PLAN (D-08): the row is emitted every session while the fault lasts, at most once per pass, and the plugin's skills stay offered | VERIFIED | The verdict is rebuilt on every pass (`apply.ts:291`) and nothing is stored. Both new scenarios assert the row in a second session. The single-emit check is narrowed to `SUPPRESSING_DECLARER_KINDS` (failed and uninstalled rows) and now runs after `applyBackfillForScopeIsolated`. The `apply.test.ts` case "REC-05: a declarer this pass disables still gets the warning that the check was lost" passes. |

**Score:** 7/7 truths verified (0 present-but-behavior-unverified)

### Pinned feature rows (decision consistency)

| Feature | New-session row | Consistent with the decision |
| --- | --- | --- |
| `features/marketplace/update.feature:~811` | `demo` dropped from the catalog: `failed \| not in manifest` at warning, with the cause | Yes |
| `features/marketplace/update.feature:~918` (outline over `<scope>`) | invalid manifest: `failed \| invalid manifest` at warning, with the cause | Yes |
| `features/marketplace/remove.feature:~594` | declarer `lib`: `invalid manifest` at warning, with the cause. The command's own row at :588 keeps `{unreadable}` (D-06) | Yes |
| `features/plugin/uninstall.feature:~233` | declarer `lib`: `invalid manifest` at warning. The target row `app` at :230 keeps `{unreadable}` | Yes |
| `features/plugin/update.feature:~181` | declarer `lib`: `invalid manifest` at warning. The target row at :181 keeps `{unreadable}` | Yes |
| `features/plugin/reinstall.feature` | No new-session row to re-pin. Its new sessions (lines 29, 152, 172, 206) involve no unreadable declarer. Its two `{unreadable}` rows (:103, :140) are reinstall's own command rows (D-06). The SUMMARY's claim is confirmed | Yes |
| `features/plugin/reconcile.feature:172-232` | Two new scenarios (`{not in manifest}`, `{invalid manifest}`), each over two sessions, with the skill still offered | Yes |

Each pinned session shows two `reconcile-applied-cascade` payloads. This was already true before the change: the step definition says "Pi reports a lasting reconcile failure twice", and the old error rows were also pinned twice.

### Required Artifacts

| Artifact | Status | Details |
| --- | --- | --- |
| `orchestrators/plugin/dependency-index.ts` | VERIFIED | Has the token type, the required `reason`, and `manifestLoadFailure` |
| `orchestrators/plugin/dependency-declaration-read.ts` | VERIFIED | `OwnManifestRefusal` with the `ownManifest: true` discriminant |
| `orchestrators/reconcile/dependency-verdict.ts` | VERIFIED | `reason` on the failure arm, passed through at :313 |
| `orchestrators/reconcile/apply-outcomes.ts` | VERIFIED | `PluginDeclarerUnreadableOutcome` is in the union |
| `orchestrators/reconcile/apply.ts` | VERIFIED | `reportUnreadableDeclarer` pushes the new kind; narrowed suppression; runs after the backfill |
| `orchestrators/reconcile/notify.ts` | VERIFIED | Warning `failed` row with the cause |
| `features/plugin/reconcile.feature` | VERIFIED | Contains `not in manifest`; both scenarios pass |
| `docs/output-catalog.md` state `reconcile-dependency-declarer-unreadable` | VERIFIED | The catalog-UAT tests pass at 292 states |

### Key Link Verification

| From | To | Via | Status |
| --- | --- | --- | --- |
| `readRecordDeclarations` | `buildScopeDeclarationDetail` | `if (!read.ok) return read` (dependency-index.ts:300/324) | WIRED |
| `buildScopeDeclarationDetail` | `buildScopeSatisfactionVerdict` | `if (!detail.ok) return detail` (dependency-verdict.ts:313) | WIRED |
| `buildScopeSatisfactionVerdict` | `readResult.verdict` | apply.ts:291 | WIRED |
| `readResult.verdict` | `reportUnreadableDeclarer` | per-scope loop after the backfill | WIRED |
| `plugin-declarer-unreadable` | rendered row | `applyOutcomeToBlock` → `applyPluginOutcomeToBlock` | WIRED |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Typecheck | `npx tsc --noEmit` | exit 0 | PASS |
| Walk, read, verdict, notify, outcome proofs, stamp coverage | `node --test` on 6 files | 205/205 passed | PASS |
| REC-05 apply cases | `node --test --test-name-pattern="REC-05\|D-05-07\|D-05-16\|RECON-04" apply.test.ts` | 8/8 passed | PASS |
| Six pinned features | `npx cucumber-js` on the 6 features (sandboxed HOME) | 196/196 scenarios passed | PASS |

### Probe Execution

Not applicable. The phase declares no probes.

### Requirements Coverage

| Requirement | Source Plan | Status | Evidence |
| --- | --- | --- | --- |
| REC-05 | 17-01 | SATISFIED | Truths 1, 2, 7. The REQUIREMENTS.md checkbox and traceability row still say `Pending`. The orchestrator updates those. |

No requirement is orphaned. REQUIREMENTS.md maps only REC-05 to Phase 17.

### Anti-Patterns Found

None. The lines this commit adds contain no TBD, FIXME, XXX, TODO, HACK, or placeholder markers. T-17-01 holds: the cause is the walk's fixed-phrase `Error`, built without `{ cause }`.

### Human Verification Required

None. The two new cucumber scenarios drive a real Pi process through two sessions and assert the rendered row, the severity, the tally, the cause, and the skill that is still offered.

### Gaps Summary

No gaps. The open review item (WR-02) and the deferred remainder of STALE-DECLARER-01 are decisions or later work, not failures of REC-05. They are listed below.

## For the user

- WR-02, cross-surface token parity: for the same marketplace fault, the stale-declarer row and `list`/`info` (`narrowProbeError`) use different tokens. Malformed JSON shows `{invalid manifest}` here but `{unparseable}` there; a missing manifest shows `{unreadable manifest}` versus `{source missing}`; EACCES/EPERM shows `{unreadable manifest}` versus `{permission denied}`. Schema-invalid shows `{invalid manifest}` on both. Decide whether to adopt `narrowProbeError`'s tokens (which conflicts with the decision text naming `{invalid manifest}`), or keep the three-token set and record why it overrides D-48-B/SC#1.
- STALE-DECLARER-01 remainder (deferred): the walk still fails closed on the first unreadable declarer for the whole scope. Only one declarer is reported per pass, and the load-time check skips every plugin in that scope until it is fixed. Narrowing to per-record has to be weighed against both `buildScopeDeclarationDetail` (LOAD-01) and `buildScopeDeclarationIndex` (the uninstall dependents guard). It has no carrier phase in the ROADMAP: schedule it or confirm it stays in the backlog.
- D-02 assumption: the row keeps the `(failed)` status at `warning` severity, not `(installed)`. The reason is that `installed` in the applied cascade means a realized transition that requests a reload and has no cause slot. Confirm that `(failed)` reads right to you for a plugin that is still working.
- Upstream parity: Claude Code 2.1.309 reports this condition as a plugin load error (`Plugin <id> not found in marketplace <mp>`) every load. Here it is a warning with a token and a cause, per your 2026-10-23 decision. No action is needed unless you want the wording closer to upstream.
- Stale backlog text: `.planning/BACKLOG.md` STALE-DECLARER-01 still describes the row as `(failed) {unreadable}` at error severity. Update it to the REC-05 warning shape when you next edit the backlog.
- Pre-existing (not a regression): every lasting reconcile row, this warning included, shows up twice per new session (the step definition says "Pi reports a lasting reconcile failure twice"). Decide whether that double emission is worth a backlog entry now that this row appears every session.
- Test gap (minor): malformed-JSON marketplace manifests are covered only at the walk level (`dependency-index.test.ts:489` pins `invalid manifest`). No feature renders that case on the stale-declarer row; add one once WR-02 is settled.

---

_Verified: 2026-10-23T14:30:00Z_
_Verifier: Claude (gsd-verifier)_
