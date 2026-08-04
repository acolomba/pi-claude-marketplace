---
phase: 90-session-environment-initialization
verified: 2026-08-04T00:00:00Z
status: gaps_found
score: 19/20 must-haves verified
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: "human_needed"
  previous_score: 13/13
  gaps_closed:
    - "G-90-3 half A (D-90-06): a bin-shipping plugin now resolves installable and installs by default with no --partial required."
    - "G-90-3 half B (D-90-05): the per-kind fallback now renders the truthful {unsupported component} token instead of mislabeling a dropped non-carve-out component kind as {unsupported source}, on the install-failure, list, and info surfaces for the partially-available/upgradable/installed arms."
  gaps_remaining:
    - "SURF-01 byte-identical reason claim does not hold for a plugin that resolves to the structural `unavailable` arm and also carries a `contains <non-carve-out-kind>` note -- install diverges from list/info for the same plugin (new gap surfaced by this re-verification, introduced by the D-90-05 fix itself)."
  regressions: []
gaps:
  - truth: "The {unsupported component} reason is byte-identical across the install-failure, list, and info surfaces for the same plugin, sourced through the single shared narrowUnsupportedKinds/kindToReason seam (SURF-01)."
    status: partial
    reason: "True for the tested partially-available/partially-upgradable/partially-installed arm (kind-axis: narrowUnsupportedKinds/kindToReason agree across install/list/info, pinned by tests/orchestrators/plugin/cross-surface-reason-parity.test.ts PER_KIND_PARITY_CASES). Diverges for a plugin resolving to the structural `unavailable` arm (D-64-07 structural precedence) that ALSO carries a `contains <non-carve-out-kind>` note (e.g. a broken mcpServers reference plus a themes/ dir). list/info route that note through shared/probe-classifiers.ts::classifyResolverNote, which has no `contains <kind>` arm and falls through to the permissive `unsupported source` catch-all. install's orchestrators/plugin/install.ts::narrowResolverReasons routes the SAME note through narrowUnsupportedKinds via manifestFieldTokenFromNote/MANIFEST_FIELD_NOTE_PREFIX, yielding `unsupported component`. The two surfaces render different reason sets for the same plugin. This is not a hypothesis -- it is documented as an unresolved WARNING in the phase's own code review (90-REVIEW.md, reviewed 2026-08-04T02:10:21Z, commit 735d8931, status: issues_found, finding WR-01), and independently re-derived here by tracing both classifier functions line-by-line; no fix commit exists after the review (735d8931 is HEAD)."
    artifacts:
      - path: "extensions/pi-claude-marketplace/shared/probe-classifiers.ts"
        issue: "classifyResolverNote (the note/source axis consumed by list/info via narrowResolverNotes) has no `contains <kind>` arm; a non-carve-out kind's contains-note falls through to `unsupported source`, diverging from install's kind-axis routing for the identical note when the plugin also carries a structural defect."
      - path: "extensions/pi-claude-marketplace/orchestrators/plugin/install.ts"
        issue: "narrowResolverReasons (lines ~2283-2287) routes ANY `contains <kind>` note through narrowUnsupportedKinds regardless of which resolver arm produced it, crossing the structural-vs-partially-available boundary that docs/output-catalog.md:1489 documents as the intended architecture (\"the structural arm sources reasons via narrowResolverNotes ... the partially-available arm via narrowUnsupportedKinds\")."
    missing:
      - "Decide the single truthful axis for a `contains <kind>` note on the structural unavailable arm and make classifyResolverNote and narrowResolverReasons agree -- 90-REVIEW.md WR-01 proposes two options: (1) add a `contains <kind>` arm to classifyResolverNote that delegates to the same per-kind mapping, or (2) stop install's note handler from routing contains-notes through narrowUnsupportedKinds when the throw came from the unavailable arm."
      - "Add a `contains monitors` / multi-kind case to tests/orchestrators/plugin/cross-surface-reason-parity.test.ts's note-table (PARITY_CASES, currently only pins `contains lspServers` and a generic `some other unsupported source detail`) so the note-axis vs install-axis agreement on the unavailable arm is pinned, not just the kind-axis vs install-axis agreement on the partially-available arm."
---

# Phase 90: Session environment initialization Verification Report

**Phase Goal:** A skill or command script launched through Pi's bash tool sees the Claude Code session environment variables -- exactly as it would under Claude Code -- because the extension sets them on Pi's live `process.env` at session start and Pi's bash tool builds every child env fresh at each spawn. Establishes `CLAUDECODE=1`, `CLAUDE_CODE_SESSION_ID`, the pi-only `CLAUDE_SESSION_ID` shim, and appends each installed enabled plugin's `<pluginRoot>/bin` to `process.env.PATH` (PENV-01).

**Verified:** 2026-08-04
**Status:** gaps_found
**Re-verification:** Yes -- after gap closure (plan 90-02, closing UAT gap G-90-3)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Bash child sees `CLAUDECODE=1` whenever loaded (SENV-01) | VERIFIED | `shared/session-env.ts` `applySessionEnv`/`claudeSessionEnvFor` sets `CLAUDECODE: "1"`; wired via `pi.on("session_start", ...)` in `index.ts`. `node --test tests/shared/session-env.test.ts` -- 17/17 pass (re-run this pass; count grew from round-1's 5 because Phase 91 added `claudeSessionEnvFor` producer tests -- no regression). |
| 2 | Bash child sees `CLAUDE_CODE_SESSION_ID` = `ctx.sessionManager.getSessionId()`, refreshed every `session_start` (SENV-02) | VERIFIED | Same module/wiring; overwrite-on-every-call confirmed by test. |
| 3 | `CLAUDE_SESSION_ID` = same value (SENV-03 pi-only shim) | VERIFIED | Same module; distinct-keys-same-value test passes. |
| 4 | Non-interference: exactly the three named keys are touched | VERIFIED | `applySessionEnv: touches exactly the three named keys and nothing else` passes. |
| 5 | Distinct keys never merge/collide | VERIFIED | Mutation-independence assertion in the same test file passes. |
| 6 | Empty `getSessionId()` assigned verbatim without throwing (backstop) | VERIFIED | `empty input assigns empty string verbatim without throwing` passes. |
| 7 | Fixed statement order; order-independent (distinct keys) | VERIFIED | Static: three sequential, unconditional, non-conflicting assignments in `claudeSessionEnvFor`. |
| 8 | Each enabled plugin's `<resolvedSource>/bin` (both scopes) on PATH, appended not prepended, added even if absent (PENV-01) | VERIFIED | `orchestrators/plugin-path.ts::collectBinDirs` + `shared/session-env.ts::applyPathLedger`; `node --test tests/shared/plugin-path.test.ts` -- all pass (append-not-prepend, add-when-absent-no-fs-stat, both-scope end-to-end test with real `state.json` fixtures). |
| 9 | Deterministic order (user before project, stable within scope); byte-identical on repeat | VERIFIED | `orchestrators/plugin-path.ts`: `[...collectBinDirs(userState), ...collectBinDirs(projState)]`; asserted by test. |
| 10 | Duplicate bin dirs deduplicated; repeated recompute idempotent | VERIFIED | `dedupes a fresh dir already present and is idempotent` passes (ledger threaded back in). |
| 11 | Zero enabled plugins empties the ledger; single plugin appends exactly one entry | VERIFIED | Test passes. |
| 12 | Reload-durable ledger cleanup: recompute removes exactly its own prior entries, no stale leak (D-90-01) | VERIFIED | `reload-durable cleanup removes an uninstalled plugin via the ledger` passes. |
| 13 | Malformed `state.json` swallowed + debug-logged; `resources_discover` returns normally (NFR-2 backstop) | VERIFIED | `recomputePluginPath` throw on malformed state confirmed by unit test; `index.ts` wraps the call in its own try/catch routed through `hookDebugLog`. |
| 14 | A bin-only plugin resolves `installable` (not `partially-available`) and installs by default; no `--partial` required (D-90-06, closes G-90-3 half A) | VERIFIED | `domain/resolver.ts`: `"bin"` removed from `UNSUPPORTED_COMPONENT_KINDS` and its convention probe deleted. `node --test tests/domain/resolver-strict.test.ts tests/domain/resolver-loose.test.ts` pass with the new bin-installable assertions in both strict and loose mode; regression rows for `monitors`/`themes`/`outputStyles`/`settings`/`lspServers` still resolve `partially-available`. |
| 15 | A plugin declaring `bin` via entry/manifest field also resolves installable with no `contains bin` note | VERIFIED | Same resolver test files, entry-declared-`bin` case. |
| 16 | A dropped non-carve-out unsupported kind renders `{unsupported component}` (not `{unsupported source}`) on the partially-available/upgradable/installed arms, byte-identical across list/info/install (D-90-05) | VERIFIED | `shared/notify.ts` REASONS includes `"unsupported component"`; `shared/probe-classifiers.ts::kindToReason` fallback retargeted; `shared/notify-reasons.ts` `UNSUPPORTED_REASONS` updated. `node --test tests/shared/probe-classifiers.test.ts tests/orchestrators/plugin/cross-surface-reason-parity.test.ts` -- `PER_KIND_PARITY_CASES` (monitors/themes, kind-axis vs install-axis) pass; `catalog-uat.test.ts` byte-equality for the touched fenced blocks passes. |
| 17 | The `{unsupported component}` reason is byte-identical across install-failure, list, and info surfaces for the same plugin (SURF-01) | **FAILED (partial)** | True for the tested partially-* arm. **Fails** for a plugin that ALSO resolves to the structural `unavailable` arm and carries a `contains <non-carve-out-kind>` note: `classifyResolverNote` (list/info's note-axis classifier, `shared/probe-classifiers.ts:130-153`) has no `contains <kind>` arm and falls through to `unsupported source`; `narrowResolverReasons` (install's classifier, `orchestrators/plugin/install.ts:2283-2287`) routes the identical note through `narrowUnsupportedKinds`, yielding `unsupported component`. Confirmed as an unresolved finding in the phase's own code review (see Code Review section) and independently re-derived by tracing both functions -- see gap entry in frontmatter. |
| 18 | Carve-outs unchanged: `lspServers`->`{lsp}`, `hooks`->`{unsupported hooks}`; source/note-axis fallback (`narrowResolverNotes`, install's empty-input default) still `{unsupported source}` | VERIFIED | `PHOOK-05` tests (hooks carve-out) and `lsp` carve-out tests pass unchanged; install's `narrowResolverReasons([])` empty-input default retained per test. |
| 19 | `REASONS` grows by exactly one member (`unsupported component`); `_ReasonsCoverageProof` stays total; closed-set length lock reflects 38 | VERIFIED | `shared/notify.ts` REASONS tuple inspected -- `unsupported component` inserted immediately after `unsupported source`, no reorder. `tests/architecture/notify-closed-set-locks.test.ts` length lock bumped to 38 with a D-90-05 rationale comment; `npm run typecheck` clean per SUMMARY (coverage proof compiles). |
| 20 | `docs/output-catalog.md` and the PRD describe `bin` as runtime-honored (PENV-01) and the partially-* reason vocabulary as `{unsupported component}`; vocabulary-guard presence checks stay green | VERIFIED | `docs/output-catalog.md` lines 139/398/1489 updated to `{unsupported component}` for the partially-* arms; structural-unavailable (line 502) and marketplace-source (lines 1176/1236/1245) examples correctly retain `{unsupported source}`. `docs/prd/pi-claude-marketplace-prd.md` lines 92/118/1037 describe `bin` as PATH-honored at runtime rather than an unsupported/dropped kind. `node --test tests/architecture/partial-vocabulary-guard.test.ts` passes (re-run this pass). |

**Score:** 19/20 truths verified (0 present-but-behavior-unverified; 1 FAILED/partial -- see gap above)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `extensions/pi-claude-marketplace/shared/session-env.ts` | `applySessionEnv`, `PATH_LEDGER_ENV`, `applyPathLedger` (pure) | VERIFIED | Present, exports match, pure functions have no `process.env`/`fs` access. |
| `extensions/pi-claude-marketplace/orchestrators/plugin-path.ts` | `collectBinDirs`, `recomputePluginPath` (I/O shell) | VERIFIED | Present; `collectBinDirs` now guards `resolvedSource` via `asAbsolutePluginRoot` (WR-01 hardening from the round-1 review-fix cycle, unrelated to this round's WR-01 finding). |
| `extensions/pi-claude-marketplace/domain/resolver.ts` | `bin` removed from `UNSUPPORTED_COMPONENT_KINDS` + convention probe | VERIFIED | Confirmed by direct grep and code read; T-02-25 closed-list comment updated with a D-90-06 rationale. |
| `extensions/pi-claude-marketplace/shared/probe-classifiers.ts` | `kindToReason` fallback retargeted to `unsupported component` | VERIFIED (with the SURF-01 gap noted above) | `UnsupportedReason` widened; `kindToReason` fallback confirmed by read; `classifyResolverNote` note-axis catch-all intentionally left on `unsupported source` -- correct for the tested scope, but this is exactly the seam where the SURF-01 divergence lives. |
| `extensions/pi-claude-marketplace/shared/notify.ts` / `notify-reasons.ts` | `unsupported component` REASONS member, coverage-proof home | VERIFIED | Confirmed by grep; insertion position correct (adjacent to `unsupported source`, no reorder). |
| `docs/output-catalog.md`, `docs/prd/pi-claude-marketplace-prd.md` | bin runtime-honored prose, `{unsupported component}` vocabulary | VERIFIED | Confirmed by direct read of the touched lines. |
| `tests/shared/session-env.test.ts`, `tests/shared/plugin-path.test.ts` | SENV/PENV coverage | VERIFIED | 17/17 and full plugin-path suite pass, re-run in this verification pass. |
| `tests/domain/resolver-strict.test.ts`, `tests/domain/resolver-loose.test.ts`, `tests/shared/probe-classifiers.test.ts`, `tests/orchestrators/plugin/cross-surface-reason-parity.test.ts`, `tests/architecture/notify-closed-set-locks.test.ts`, `tests/architecture/catalog-uat.test.ts`, `tests/architecture/partial-vocabulary-guard.test.ts` | Gap-closure coverage | VERIFIED (green) but INCOMPLETE per the SURF-01 gap | All 196 assertions across these 7 files pass under `node --test`, re-run in this verification pass -- but the suite does not include the `contains monitors` case against the note-axis classifier that would have caught the SURF-01 divergence (confirmed absent by grep of `PARITY_CASES`). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `index.ts` `session_start` handler | `applySessionEnv` | direct call, try/catch (WR-02) | WIRED | Confirmed present; regression test for throw-swallow passes. |
| `index.ts` `resources_discover` handler (after `applyReconcile`) | `recomputePluginPath(event.cwd)` | direct call, own try/catch, `hookDebugLog` | WIRED | Confirmed present and correctly ordered. |
| `recomputePluginPath` | `loadState` (both scopes) -> `collectBinDirs` -> `applyPathLedger` -> `process.env.PATH`/`PI_CLAUDE_MARKETPLACE_PATH` | direct calls | WIRED | Confirmed by direct read of `orchestrators/plugin-path.ts`. |
| resolver `decideResolution` | bin-only plugin -> empty `partial.unsupported` -> `installable` arm | direct | WIRED | Confirmed by passing resolver-strict/loose tests. |
| `kindToReason` non-carve-out fallback | `narrowUnsupportedKinds` -> list/info rows AND install's `narrowResolverReasons` (kind-axis, SURF-01) | shared seam | WIRED for the kind-axis input path | Confirmed for `unsupported[]`-sourced input (the tested partially-* case). NOT symmetric for note-axis (`contains <kind>` string) input on the structural `unavailable` arm -- see gap. |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| SENV-01 | 90-01-PLAN.md | `CLAUDECODE=1` whenever loaded | SATISFIED | Truths #1, #4, #6, #7. |
| SENV-02 | 90-01-PLAN.md | `CLAUDE_CODE_SESSION_ID` fresh per session_start | SATISFIED | Truth #2. |
| SENV-03 | 90-01-PLAN.md | `CLAUDE_SESSION_ID` pi-only shim | SATISFIED | Truths #3, #5. |
| PENV-01 | 90-01-PLAN.md, 90-02-PLAN.md | Enabled plugin `<pluginRoot>/bin` on PATH; runtime append/dedupe/idempotent/reload-durable; bin installs by default at Claude Code parity | SATISFIED | Truths #8-15. The SURF-01 gap (#17) lives in the reason-token surface -- a plan-level must-have of 90-02, not itself a formal REQUIREMENTS.md ID -- and does not affect PENV-01's PATH-injection behavior, only the accuracy of an install-failure message for an unrelated (structurally-broken) plugin shape. |

No orphaned requirements -- REQUIREMENTS.md maps exactly SENV-01/02/03 and PENV-01 to Phase 90, and all four appear in a plan's `requirements` frontmatter and are covered by an executed task.

**Documentation bookkeeping note (non-blocking):** REQUIREMENTS.md's checkboxes/traceability table still show SENV-01/02/03 as `[ ]` / "Pending" while PENV-01 is `[x]` / "Complete" (only PENV-01 was flipped during the 90-02 gap-closure commit `5654e485`). This is inconsistent with the codebase state -- SENV-01/02/03 are fully implemented and tested per 90-01 -- but per the established project convention (carried forward from the round-1 report) this field is normally updated at phase-complete/milestone-close and is not itself a codebase gap.

### Anti-Patterns Found

None matching `TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER|not yet implemented` in the phase's modified/created files (re-run of the round-1 grep across the 90-02 diff; no new hits).

One unresolved **code-review WARNING** functions as a de-facto anti-pattern gate failure: see Code Review below and the gap entry in frontmatter.

### Code Review

`90-REVIEW.md` (commit `735d8931`, reviewed 2026-08-04T02:10:21Z, post-gap-closure re-review): **status `issues_found`** -- 0 critical, 1 warning (WR-01, the SURF-01 cross-surface divergence documented as the gap above), 2 info (IN-01 empty-PATH-segment stripping, IN-02 delimiter-in-bin-dir edge case -- both accepted-risk / benign per the review). No `90-REVIEW-FIX.md` exists for this review iteration (the only `90-REVIEW-FIX.md` in the phase directory is dated for the round-1/iteration-2 review, predating the 90-02 gap-closure commits) -- confirming WR-01 has had zero remediation attempts since it was raised. HEAD is the review-report commit itself; no follow-up commit exists.

### Test Suite Status

- `node --test tests/shared/session-env.test.ts tests/shared/plugin-path.test.ts` -- re-run in this verification pass, all pass (17 + full plugin-path suite, 0 fail).
- `node --test tests/domain/resolver-strict.test.ts tests/domain/resolver-loose.test.ts tests/shared/probe-classifiers.test.ts tests/orchestrators/plugin/cross-surface-reason-parity.test.ts tests/architecture/notify-closed-set-locks.test.ts tests/architecture/catalog-uat.test.ts tests/architecture/partial-vocabulary-guard.test.ts` -- re-run in this verification pass, 196/196 pass, 0 fail.
- Per 90-02-SUMMARY.md (trusted for the parts independently spot-checked above): full unit suite (`npm test`) 3232 pass, 0 fail, 1 pre-existing skip; `npm run check` typecheck/ESLint/Prettier/unit green; integration 16/18 pass, the 2 failures are the documented pre-existing `pi-subagents` global-peer environmental cases, unrelated to this phase's files.
- Working tree is clean at HEAD (`735d8931`); no uncommitted changes.

### Human Verification Required

Not applicable to the frontmatter (`status: gaps_found` takes precedence over `human_needed` per the decision tree), but documented here because it is still an open item that must be resolved before this phase can reach `passed`, independent of the SURF-01 gap above:

**90-UAT.md Test 3 retest is still pending.** Round-1 UAT (`90-UAT.md`, `f0106ece`) recorded Test 3 as `issue` (G-90-3). Plan 90-02 closed the underlying code defects (D-90-06, D-90-05) and its own verification block explicitly carries a live-Pi human check to `/gsd-verify-work`:
- Install a plugin whose plugin root has only a `bin/` directory; confirm it installs by DEFAULT (no `--partial`, no `(partially-available)` row).
- Confirm a plugin declaring a non-carve-out unsupported kind renders `{unsupported component}` (not `{unsupported source}`).

Neither `90-UAT.md` nor any other phase artifact records this retest having been performed against a live Pi session -- `90-UAT.md` still shows its original round-1 result (`issue`, G-90-3) with no update, and no commit after `f0106ece` touches that file. The automated evidence (resolver + reason-token unit tests, Task 1 and Task 2 of 90-02) is green and consistent with the expected live behavior, but per this phase's own verification contract the live-Pi confirmation is required and outstanding.

### Gaps Summary

Two things must be resolved before Phase 90 can reach `passed`:

1. **SURF-01 cross-surface reason divergence (code gap, this report's `gaps:` entry).** The D-90-05 reason-token fix introduced a new, narrow-but-real inconsistency: a plugin that is BOTH structurally `unavailable` (a broken manifest reference, malformed hooks.json, etc.) AND carries a `contains <non-carve-out-kind>` note (e.g. `contains monitors`) renders `{unsupported source}` on `list`/`info` but `{unsupported component}` (in addition) on the install-failure surface -- for the identical plugin. This is confirmed unresolved on HEAD by the phase's own code review (`90-REVIEW.md`, WR-01, `status: issues_found`, no fix commit since). It does not affect SENV-01/02/03 or PENV-01's core PATH-injection behavior; it affects the accuracy of an install-failure message for an edge-case plugin shape.
2. **Live-Pi retest of UAT Test 3 (human verification, still outstanding).** The automated gap-closure evidence is solid, but the phase's own plan explicitly requires a live-Pi confirmation before declaring G-90-3 closed, and no record of that retest exists.

Everything else -- the four requirement IDs' core behavior (SENV-01/02/03, PENV-01), the D-90-06 bin reclassification, the D-90-05 reason-token fix for its tested scope, the catalog/PRD reconciliation, and the two round-1 live-UAT items (session-env visibility, plugin-bin PATH install/uninstall/reload cycle) -- is verified against the actual codebase and green.

---

_Verified: 2026-08-04_
_Verifier: Claude (gsd-verifier)_
