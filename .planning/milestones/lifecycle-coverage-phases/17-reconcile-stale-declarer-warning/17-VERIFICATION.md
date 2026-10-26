---
phase: 17-reconcile-stale-declarer-warning
verified: 2026-10-23T14:05:26Z
status: passed
score: 8/8 must-haves verified
covered_files:
  - .planning/phases/17-reconcile-stale-declarer-warning/17-01-PLAN.md
  - .planning/phases/17-reconcile-stale-declarer-warning/17-01-SUMMARY.md
  - .planning/phases/17-reconcile-stale-declarer-warning/17-CONTEXT.md
  - .planning/phases/17-reconcile-stale-declarer-warning/17-REVIEW-FIX.md
  - docs/dependency-resolution.md
  - docs/json-output.md
  - docs/output-catalog.md
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-declaration-read.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-index.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/dependency-verdict.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts
  - extensions/pi-claude-marketplace/shared/probe-classifiers.ts
  - features/marketplace/remove.feature
  - features/marketplace/update.feature
  - features/plugin/reconcile.feature
  - features/plugin/reinstall.feature
  - features/plugin/uninstall.feature
  - features/plugin/update.feature
  - features/step_definitions/marketplace/publishing.steps.ts
  - test/orchestrators/plugin/dependency-index.test.ts
covered_digest: "v3:sha256:e023ad6d9b6f8fb033a2b0eab07a8e09fccfa6e8ea8b8e3815038d2be853fd20"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: passed
  previous_score: 7/7
  gaps_closed: []
  gaps_remaining: []
  regressions: []
  reason: "D-11 (user decision on review WR-02) changed the marketplace-manifest tokens after the initial verification of 2bdc399d/981d3685"
---

# Phase 17: Reconcile Stale-Declarer Warning Verification Report

**Phase Goal:** A new session tells the truth about a plugin that is still installed but whose marketplace no longer describes it.
**Requirement:** REC-05
**Verified:** 2026-10-23T14:05:26Z
**Status:** passed
**Re-verification:** Yes. The previous report passed on commits `2bdc399d` and `981d3685`. This run checks the D-11 change on top of them. It started as uncommitted work and was committed during the run as `f85cc546` (`fix(reconcile): name a manifest fault as list and info do`); its diffstat matches the working-tree diff that was checked, and the source tree is clean against it. The planning edits (SUMMARY, CONTEXT, REVIEW-FIX) are still uncommitted.

**What changed (D-11, CONTEXT.md):** a marketplace manifest that fails to load now takes the token of `shared/probe-classifiers.ts::narrowProbeError`, the classifier `list` and `info` use. Malformed JSON is `{unparseable}`, schema-invalid is `{invalid manifest}`, missing (ENOENT/ENOTDIR) is `{source missing}`, EACCES/EPERM is `{permission denied}`, and anything else is `{unreadable}`. A catalog drop stays `{not in manifest}`, a rejected `dependencies` value stays `{invalid manifest}`, an unusable own manifest stays `{unreadable manifest}`. The cause phrases are unchanged.

**`npm run check`:** not run here, as instructed. The orchestrating session runs it on this tree and reports the result. This report's `passed` status assumes that run is green. If it fails, treat SC3 as failed and this phase as `gaps_found`.

**`npm run check` result (recorded by the phase session, 2026-10-23):** exit 0 on the tree committed as `f85cc546`: static checks, unit, integration, cucumber 705/705 scenarios, direct coverage merged (280 records).

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | ROADMAP SC1: a plugin that its catalog dropped is reported at each new session as a `warning` row with `{not in manifest}` and a cause chain, and it keeps working | VERIFIED (regression check) | D-11 leaves the `declared.kind === "absent"` arm untouched (`dependency-index.ts`, `unreadableDeclarer(key, "not in manifest", ...)`). The two-session scenario in `reconcile.feature` passed in the focused run below. |
| 2 | ROADMAP SC2: a plugin whose marketplace manifest is invalid is reported the same way with `{invalid manifest}` | VERIFIED for a schema-invalid manifest; superseded by D-11 for malformed JSON | Schema-invalid: `loadMarketplaceManifestUncached` throws `InvalidMarketplaceManifestError("marketplace.json schema invalid: ...")` with no cause (`domain/manifest.ts:141`), so `narrowProbeError` returns `invalid manifest`. The `reconcile.feature` scenario "...whose marketplace manifest is invalid..." (step `has become invalid`, schema-invalid) and the two `breaks the manifest schema` rows of the `update.feature` outline assert `invalid manifest`; all pass. The new unit case "REC-05: a schema-invalid marketplace manifest ends the walk as an invalid manifest" passes. Malformed JSON: the loader wraps the `SyntaxError` as `cause` (`manifest.ts:125`), so the token is now `unparseable`. That departs from the ROADMAP text, and D-11 records it as the user's decision ("supersedes ... the ROADMAP text that named only `{invalid manifest}`"). |
| 3 | ROADMAP SC3: `npm run check` stays green | VERIFIED (focused); full gate reported by the orchestrating session | Not re-run here. Focused checks on this tree: `npx tsc --noEmit` exit 0; `dependency-index.test.ts` plus `probe-classifiers.test.ts` 68/68 passed; seven features (209 scenarios, 2482 steps) passed. |
| 4 | PLAN (D-05, amended by D-11): the walk's failure arm carries a required closed-set `reason`, chosen by the branch, never from message text | VERIFIED | `DeclarerReadFailure = Extract<Reason, "not in manifest" \| "invalid manifest" \| "unreadable manifest"> \| ReturnType<typeof narrowProbeError>`. The manifest-load catch is now `unreadableDeclarer(key, narrowProbeError(err), manifestLoadPhrase(err))` (`dependency-index.ts:242`). `narrowProbeError` and `manifestLoadPhrase` both branch on class and errno code, not on message text. `tsc` passes, so every consumer of the widened type (`dependency-verdict.ts:108`, `apply-outcomes.ts:469`) accepts the new tokens. |
| 5 | D-11: the shared classifier is reused, not duplicated | VERIFIED | `dependency-index.ts:70` imports `narrowProbeError` from `shared/probe-classifiers.ts`. The old `manifestLoadFailure` token ladder is gone. What remains, `manifestLoadPhrase`, picks only the cause phrase, which D-11 keeps unchanged. No second token ladder exists in the module. The same function serves `list-candidate-row.ts`, `plugin/info.ts`, `marketplace/info.ts`, `fetch.ts`, `pending.ts`, and `apply-outcomes.ts`. |
| 6 | D-11: the token mapping holds end to end | VERIFIED | Unit (`dependency-index.test.ts` `LOAD_FAILURES`): ENOENT and ENOTDIR → `source missing`; malformed (typed error with `SyntaxError` cause) → `unparseable`; schema-invalid → `invalid manifest`; EACCES → `permission denied`; a generic `Error` → `unreadable`. Each case keeps its old cause phrase. EPERM is covered by `probe-classifiers.test.ts`. Features: the new `reconcile.feature` scenario "...whose marketplace manifest is not valid json and keeps it working" asserts `failed \| unparseable` at warning severity, tally 0 failures / 1 warning, the cause "...its marketplace manifest is invalid", and `/skill:demo-skill` still offered, over two new sessions. The `update.feature` outline "An invalid refreshed manifest leaves installed plugins unchanged" gains a `declarer reason` column: `unparseable` for the two `is not valid json` rows, `invalid manifest` for the two `breaks the manifest schema` rows. Both pass. |
| 7 | PLAN (D-02/D-03/D-06): the new outcome renders `(failed) {<reason>}` at `warning` with the cause and no reload; command target rows keep `{unreadable}` | VERIFIED (regression check) | `apply-outcomes.ts`, `notify.ts`, and `apply.ts` are not in the D-11 diff. The `remove`, `uninstall`, `update`, and `reinstall` features passed in the focused run. |
| 8 | PLAN (D-08): the row returns every session while the fault lasts, at most once per pass, and the skills stay offered | VERIFIED (regression check) | `apply.ts` is unchanged. The new malformed-JSON scenario asserts the row in a second session and the skill still offered in both. |

**Score:** 8/8 truths verified (0 present-but-behavior-unverified). The full `npm run check` verdict comes from the orchestrating session.

### Pinned feature rows (D-11)

| Feature | Row | Token | Matches D-11 |
| --- | --- | --- | --- |
| `features/plugin/reconcile.feature:234-261` (new) | malformed JSON, two sessions | `unparseable` | Yes |
| `features/plugin/reconcile.feature:~205` | schema-invalid, two sessions | `invalid manifest` | Yes |
| `features/plugin/reconcile.feature:~172` | catalog drop, two sessions | `not in manifest` | Yes |
| `features/marketplace/update.feature:925-937` | `is not valid json` x2 / `breaks the manifest schema` x2 | `unparseable` / `invalid manifest` | Yes |
| `remove.feature`, `uninstall.feature`, `plugin/update.feature` | declarer `lib`, schema-invalid (step `has become invalid`) | `invalid manifest` | Yes |

### Required Artifacts

| Artifact | Status | Details |
| --- | --- | --- |
| `orchestrators/plugin/dependency-index.ts` | VERIFIED | Widened `DeclarerReadFailure`; `narrowProbeError` call; `manifestLoadPhrase` keeps the cause phrases |
| `features/plugin/reconcile.feature` | VERIFIED | Malformed-JSON scenario passes |
| `features/step_definitions/marketplace/publishing.steps.ts` | VERIFIED | New step `the manifest of the marketplace {string} is no longer valid json` calls the existing `invalidateManifest(..., "malformed")`. All lower case, per the cucumber rules |
| `features/marketplace/update.feature` | VERIFIED | `declarer reason` Examples column |
| `test/orchestrators/plugin/dependency-index.test.ts` | VERIFIED | Six load-failure cases, one per D-11 token |
| `docs/output-catalog.md`, `docs/dependency-resolution.md` | VERIFIED | Both name the shared tokens. The catalog lists all five plus the `dependencies` and own-manifest tokens. `dependency-resolution.md` gives examples ("such as"). The catalog example block (`{not in manifest}`) is unchanged and still valid. `docs/json-output.md` already lists `unparseable`, `source missing`, `permission denied`, and `unreadable` in `Reason` |
| `17-CONTEXT.md` D-11, `17-REVIEW-FIX.md`, `17-01-SUMMARY.md` | VERIFIED | D-11 recorded; WR-02 moved to fixed (8/8, `all_fixed`); SUMMARY follow-up section added; `## Threat Flags` present |

### Key Link Verification

| From | To | Via | Status |
| --- | --- | --- | --- |
| `loadMarketplaceManifest` throw | `narrowProbeError` | `dependency-index.ts:242` catch | WIRED |
| `readRecordDeclarations` failure | `buildScopeSatisfactionVerdict` → `reportUnreadableDeclarer` → rendered row | unchanged chain (see the initial report) | WIRED (the new feature scenario proves it end to end) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Typecheck | `npx tsc --noEmit` | exit 0 | PASS |
| Walk tokens and the shared classifier | `node --test test/orchestrators/plugin/dependency-index.test.ts test/shared/probe-classifiers.test.ts` | 68/68 passed | PASS |
| Pinned and affected features | `npx cucumber-js` on `plugin/reconcile`, `marketplace/update`, `marketplace/info`, `marketplace/remove`, `plugin/uninstall`, `plugin/update`, `plugin/reinstall` (sandboxed HOME) | 209/209 scenarios passed | PASS |
| New malformed-JSON scenario, by name | `npx cucumber-js features/plugin/reconcile.feature --name "not valid json and keeps it working"` | 1/1 passed | PASS |
| `update.feature` outline, by name | `--name "An invalid refreshed manifest"` | 4/4 passed | PASS |

### Probe Execution

Not applicable. The phase declares no probes.

### Requirements Coverage

| Requirement | Source Plan | Status | Evidence |
| --- | --- | --- | --- |
| REC-05 | 17-01 | SATISFIED (with D-11) | Truths 1, 2, 6, 8. REQUIREMENTS.md still names only `{not in manifest}` or `{invalid manifest}` and shows `Pending`; the orchestrator owns those files. |

No requirement is orphaned.

### Anti-Patterns Found

None. The D-11 diff adds no TBD, FIXME, XXX, TODO, HACK, or placeholder markers. T-17-01 holds: the cause is still a fixed phrase, never the error's message.

### Human Verification Required

None.

### Gaps Summary

No gaps. WR-02 is resolved by D-11, and the malformed-JSON test gap is closed by the new `reconcile.feature` scenario and the `update.feature` column. The items below are decisions, text updates, or later work. None of them is a failure of REC-05.

## For the user

- Requirement text: ROADMAP Phase 17 SC2 and REQUIREMENTS.md REC-05 still name only `{invalid manifest}`. Add the D-11 tokens (or a pointer to D-11) when you mark REC-05 complete.
- Write-path parity: for malformed JSON, `marketplace update` (and `add`) still report their own row as `{invalid manifest}`, while the next session's declarer row now says `{unparseable}`. `update.feature:925-937` shows both in one scenario. Decide whether the write path should also adopt `narrowProbeError`, or accept the split.
- STALE-DECLARER-01 remainder (deferred): the walk still fails closed on the first unreadable declarer per scope, so only one declarer is reported and the scope's load-time check is skipped. It has no carrier phase: schedule it or confirm it stays in the backlog.
- D-02 assumption: the row uses the `(failed)` status at `warning` for a plugin that still works, because `installed` in the cascade implies a reload and has no cause slot. Confirm `(failed)` reads right to you.
- Upstream parity: Claude Code 2.1.309 reports this as a plugin load error (`Plugin <id> not found in marketplace <mp>`). Here it is a warning with a token and a cause, per your decision. Change the wording only if you want it closer to upstream.
- Stale backlog text: `.planning/BACKLOG.md` STALE-DECLARER-01 still describes `(failed) {unreadable}` at error severity. Update it to the REC-05 warning shape.
- Pre-existing double emission: every lasting reconcile row, this one included, appears twice per new session. Decide whether that deserves a backlog entry.

---

_Verified: 2026-10-23T14:05:26Z_
_Verifier: Claude (gsd-verifier)_
