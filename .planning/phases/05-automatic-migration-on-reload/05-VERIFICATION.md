---
phase: 05-automatic-migration-on-reload
verified: 2026-10-09T23:44:34Z
re_verification: "scoped; baseline 6f4d2d7c; head 51ebbc07"
status: passed
score: 4/4 must-haves verified
covered_files:
  - ".planning/phases/05-automatic-migration-on-reload/05-01-PLAN.md"
  - ".planning/phases/05-automatic-migration-on-reload/05-01-SUMMARY.md"
  - ".planning/phases/05-automatic-migration-on-reload/05-02-PLAN.md"
  - ".planning/phases/05-automatic-migration-on-reload/05-02-SUMMARY.md"
  - ".planning/phases/05-automatic-migration-on-reload/05-03-PLAN.md"
  - ".planning/phases/05-automatic-migration-on-reload/05-03-SUMMARY.md"
  - ".planning/phases/05-automatic-migration-on-reload/05-04-PLAN.md"
  - ".planning/phases/05-automatic-migration-on-reload/05-04-SUMMARY.md"
  - ".planning/phases/05-automatic-migration-on-reload/05-05-PLAN.md"
  - ".planning/phases/05-automatic-migration-on-reload/05-05-SUMMARY.md"
  - "docs/mcp-compatibility.md"
  - "docs/output-catalog.md"
  - "extensions/pi-claude-marketplace/bridges/mcp/index.ts"
  - "extensions/pi-claude-marketplace/bridges/mcp/legacy.ts"
  - "extensions/pi-claude-marketplace/bridges/mcp/marker.ts"
  - "extensions/pi-claude-marketplace/bridges/mcp/stage.ts"
  - "extensions/pi-claude-marketplace/bridges/mcp/types.ts"
  - "extensions/pi-claude-marketplace/domain/mcp-server-features.ts"
  - "extensions/pi-claude-marketplace/domain/resolver-types.ts"
  - "extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/git-source-probe.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-replace.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts"
  - "extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts"
  - "extensions/pi-claude-marketplace/orchestrators/reconcile/mcp-migration.ts"
  - "extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts"
  - "extensions/pi-claude-marketplace/shared/notification-dispatch.ts"
  - "extensions/pi-claude-marketplace/transaction/with-state-guard.ts"
  - "tests/architecture/mcp-migration-notice.test.ts"
  - "tests/bridges/mcp/legacy.test.ts"
  - "tests/integration/mcp-legacy-sweep.test.ts"
  - "tests/integration/mcp-migration.test.ts"
  - "tests/integration/mcp-tool-rules.test.ts"
  - "tests/orchestrators/reconcile/mcp-migration.test.ts"
covered_digest: "v3:sha256:234b466f959f6166a36634853396cfe7ac9f3bd3ae2687e6f3bf49f0467559cf"
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Read the drafted migration notice wording in docs/output-catalog.md (summary lines, section headers, the cost line, the left-in-place, removed and unfinished rows, the tool-rules warning) and as rendered by tests/integration/mcp-migration.test.ts."
    expected: "The operator accepts the closed-catalog wording, or amends it. Two flagged readings need a ruling: a non-scope collision source names only its file basename (05-04-SUMMARY), and leftovers are reported for every removed legacy entry (05-03-SUMMARY)."
    why_human: "Executors marked every new row as a draft for operator review. No test can judge whether the text reads well to a user."
    result: "passed 2026-10-09: operator accepted the wording; leftovers accepted as built; a non-scope collision source now renders as a home-relative path (79e71b25)"
---

# Phase 5: Automatic migration on /reload Verification Report

**Phase Goal:** A user who upgrades gets every installed plugin's MCP servers moved from `mcp.json` into `mcp-adapter.json`, in their final shape, by `/reload` alone, with no server lost, none duplicated, and a clear account of what the rename costs them.
**Verified:** 2026-10-09
**Status:** passed (human verification accepted by the operator 2026-10-09)
**Re-verification:** No, initial verification

The full `npm run check` gate passed (exit 0) on HEAD `163921cd` in this checkout just before verification. It was not re-run. Targeted tests were run under a temp `HOME` and `PI_CODING_AGENT_DIR` (and the suites use `withHermeticEnvironment`).

## Goal Achievement

### Observable Truths (ROADMAP success criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `/reload` moves each installed plugin's marked `mcp.json` entries into `mcp-adapter.json` in the fresh-install shape, no reinstall; a second `/reload` changes no bytes in either file or `state.json` (AMIG-01) | VERIFIED | `migrateLegacyMcpEntries` (`orchestrators/reconcile/mcp-migration.ts`) re-stages through `prepareStageMcpServers` and `commitPreparedMcp`. It is called from `applyReconcileWithReader` in `apply.ts` per scope, after the read pass and before `applyPlan`. `index.ts` omits `migrateMcpEntries`, so production uses the real step. Integration test "moves an installed plugin's mcp.json entry..." asserts the adapter bytes equal the fresh-install oracle even with hand edits in the legacy entry. "after the move another /reload changes no bytes and sends no notice" compares `mcp.json`, `mcp-adapter.json` and `state.json` bytes. Both pass. |
| 2 | A failure between the adapter write and the `mcp.json` removal loses no server; the next `/reload` finishes with no duplicate; a fault-injection test asserts the write order (AMIG-01, AMIG-02) | VERIFIED | Write order in `migrateLocked` is adapter, then state, then project stubs, then `mcp.json`. Unit tests assert the logged write order `["mcp-adapter.json","state.json","mcp.json"]` and `["mcp-adapter.json","mcp.json"]`. They also assert crash-once in each of `commitPreparedMcp`, `saveState` and `removeLegacyMcpEntries` converges to the uninterrupted bytes, and the half-done state finishes with no adapter write. Integration "a filesystem refusal between the two writes loses no server and the next reload finishes the move" passes. 130 unit and architecture tests pass. |
| 3 | One migration notice lists each `old -> new` name, says the rename needs a new sign-in and project re-approval, and carries the reload hint (AMIG-03) | VERIFIED (wording is a draft, see Human Verification) | `notifyMcpMigration` runs once after both scopes, before the reconcile cascade, and renders nothing when there are no rows. Integration tests assert the exact text: `srv -> plugin_hello_srv_ (hello) [project]`, the cost line (sign in again to OAuth servers, approve project servers again, old names may still show until reload) and `/reload to pick up changes`. One notice covers both scopes with project rows first. Severity is `info` when all moved. |
| 4 | A marked legacy entry with no owning install record stays in `mcp.json` with a warning (AMIG-04) | VERIFIED | `ownerAction` calls `reportUnowned` when no record exists in this scope. A user-scope record does not own a project entry. A plan-installed owner is swept instead of warned. Three integration tests pass. |

**Score:** 4/4 truths verified, 0 behavior-unverified.

Plan-level truths (D-05-02 and D-05-11 left-in-place rows; D-05-04, D-05-06 and D-05-07 removals and the partial record; D-05-05 permission-rule warning; D-05-08 and D-05-10 staging-path sweeps with byte rollback) are covered by passing integration tests: git cold-clone then warm retry, undeclared and unsupported servers removed with the record made partial, malformed MCP config removing all entries, old-name stub removal, panel copy removal with the user's own server kept, and the tool-rules test.

### Required Artifacts and Key Links

| Artifact / link | Status | Details |
|---|---|---|
| `orchestrators/reconcile/mcp-migration.ts` (776 lines) | VERIFIED | Substantive: owner resolution, offline source read, stage, record update, legacy removal, stub clearing. |
| `bridges/mcp/legacy.ts` (`readLegacyMcpOwners`, `removeLegacyMcpEntries`, project stub removal) | VERIFIED | Imported and used by `mcp-migration.ts` and `update-swap.ts`. |
| `bridges/mcp/stage.ts` staging-path sweep | VERIFIED | Calls `removeLegacyMcpEntries` after the adapter write, with ordered byte restore. `reinstall-replace.ts`, `update-swap.ts` and `install-outcome.ts` carry the sweep and rollback. |
| `orchestrators/plugin/git-source-probe.ts` (`makeRecordedShaPresenceProbe`) | VERIFIED | fs-only probe keyed on the recorded sha. `mcp-migration.ts` never names the git surface (NFR-5). |
| `apply.ts` to `migrateLegacyMcpEntries` to `notifyMcpMigration` | WIRED | `migrateScopeIsolated` turns any throw into a `stopped` row (NFR-2); the notice is sent even when reconcile has no outcomes. |
| `shared/notification-dispatch.ts` `notifyMcpMigration` | VERIFIED | Row folding, sort and severity; pinned by `tests/architecture/mcp-migration-notice.test.ts`. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Migration, sweep and tool-rules integration | `node --test tests/integration/mcp-migration.test.ts tests/integration/mcp-legacy-sweep.test.ts tests/integration/mcp-tool-rules.test.ts` (temp HOME) | 18 pass, 0 fail | PASS |
| Migration unit, legacy bridge and notice pin | `node --test tests/orchestrators/reconcile/mcp-migration.test.ts tests/bridges/mcp/legacy.test.ts tests/architecture/mcp-migration-notice.test.ts` (temp HOME) | 130 pass, 0 fail | PASS |
| Full gate | `npm run check` on HEAD `163921cd` (cited, not re-run) | exit 0 | PASS |

### Requirements Coverage

| Requirement | Source Plans | Status | Evidence |
|---|---|---|---|
| AMIG-01 | 05-01, 05-02, 05-03, 05-04, 05-05 | SATISFIED | Truths 1 and 2; staging-path sweeps and removal arms. |
| AMIG-02 | 05-03, 05-05 | SATISFIED | Write order asserted; crash convergence in all three failure points. |
| AMIG-03 | 05-01, 05-02, 05-04, 05-05 | SATISFIED | Truth 3. |
| AMIG-04 | 05-04 | SATISFIED | Truth 4. |

All four IDs appear in the plan frontmatter, in REQUIREMENTS.md (marked Complete) and in the ROADMAP phase block. No orphaned requirements.

### Anti-Patterns Found

No `TBD`, `FIXME` or `XXX` in the 41 files changed since the plan commit. No stubs found. The 8 open review items (IN-01 to IN-08) are Info severity and open by design per `05-REVIEW-DISPOSITION.md`; WR-01 to WR-04 are fixed.

### Housekeeping Note

ROADMAP.md line 31 still shows the Phase 5 summary checkbox as `[ ]` while the plan list shows 5/5 executed. The orchestrator's phase-complete step should tick it.

### Human Verification Required

1. **Notice wording review**
   - **Test:** Read the new closed-catalog text in `docs/output-catalog.md` for the migration notice (summary lines, headers, cost line, left-in-place, removed and unfinished rows) and the tool-rules warning.
   - **Expected:** The operator accepts or amends the wording. Rule on the two flagged readings: a non-scope collision source shows only the file basename, and leftovers are reported for every removed legacy entry.
   - **Why human:** Executors marked the wording as a draft for operator review, and no test judges readability.

A live Pi upgrade plus `/reload` was not run here. The integration suites drive the same `createApplyReconcile` entry point that `index.ts` uses, so no separate live item is listed.

### Gaps Summary

No gaps. The phase goal is achieved in code and proven by passing tests. The only open item is the operator's review of draft notice wording.

---

_Verified: 2026-10-09_
_Verifier: Claude (gsd-verifier)_

## Operator Validation (2026-10-09)

- The drafted notice wording is accepted as written.
- Leftovers: accepted as built. Cleanup runs for every legacy entry the
  operation removes, with one config-notice line each, and no "kept" line
  for a user's own server.
- Collision source: a source outside the four scope files and the project
  `.mcp.json` now renders as a home-relative path (`~/.config/mcp/mcp.json`)
  instead of its basename, never an absolute path. Fixed in `79e71b25`
  (100% direct coverage for `mcp-migration.ts`; commit hook green). The
  covered digest above was recomputed with `verification.fingerprint` over
  the same covered files after that commit.

## Re-verification (2026-10-09)

Scoped re-verification. Baseline `6f4d2d7c`, head `51ebbc07`. `verification.status` had read `stale` because phases 6 and 7 edited files in `covered_files`. The original findings above are kept unchanged.

### Changed files in `covered_files` since the baseline

| File | Commits | What changed |
|------|---------|--------------|
| `docs/mcp-compatibility.md` | 85ed037b, 6d2abdbb, b71469da, 135b0ed8, fdbcd56a, e073d337, 99cae0d3 | Phase 7 docs: Upgrading, "Entries that stay in mcp.json", Server status in info, Divergences. Describes the migration; adds no behavior. |
| `docs/output-catalog.md` | 58c5a007, b71469da (info status rows) | Diff touches only the `plugin info` section (new MCP status states, `(status unknown)` and `(connected)` suffixes on existing info blocks). The migration notice blocks ("moved", "left in", "removed", "stopped", "old settings removed", tool-rules warning) are untouched. |
| `tests/integration/mcp-migration.test.ts` | fd9c887b | Two added lines: an import of `noStatusSnapshot` and `mcpStatus: noStatusSnapshot()` passed to `getPluginInfo` in the "removes an undeclared server..." test. No assertion removed or changed. |

No production file in `covered_files` changed. Outside the list, `bridges/mcp/adapter-doc.ts` (comment only, 5.1.0 to 5.2.0) and `tests/bridges/mcp/adapter-entry.test.ts` (adapter floor constants) changed; neither carries a phase 5 truth. `orchestrators/plugin/info.ts` and the new `info-mcp-status.ts` changed for Phase 6 and are not part of the migration path.

### Per-truth re-check

| # | Truth (as amended) | Touched by | Result | Evidence |
|---|--------------------|-----------|--------|----------|
| 1 | `/reload` moves marked entries into `mcp-adapter.json` in the fresh-install shape; a second `/reload` changes no bytes (AMIG-01). No ROADMAP amendment marker on this criterion. | Only the two-line `mcpStatus` seed in `mcp-migration.test.ts` (fd9c887b); production code untouched. | HOLDS | `git show fd9c887b` shows the test edit is additive. Integration suite (18 tests) passes at HEAD, including the fresh-install oracle and no-byte-change reload tests. The Phase 7 live canary (`07-VERIFICATION.md` truth 2) saw the migration finish in one reload on adapter 5.2.0 (M1 notice, M3 `mcp.json` has no marked entry, `mcp-adapter.json` holds `plugin_echo_echo_`). |
| 2 | A failure between adapter write and `mcp.json` removal loses no server; next `/reload` finishes with no duplicate; write order asserted (AMIG-01, AMIG-02). | None. | HOLDS | `orchestrators/reconcile/mcp-migration.ts`, `bridges/mcp/legacy.ts` and their tests have no diff since the baseline. 131 unit/architecture tests pass (was 130; the extra test came with the operator-ruling commit `79e71b25`, already inside the baseline fingerprint window). Integration "a filesystem refusal between the two writes..." passes. |
| 3 | One migration notice with `old -> new` rows, the rename-cost line, and the reload hint (AMIG-03). Wording accepted by the operator (human_verification result kept). | `docs/output-catalog.md`, `docs/mcp-compatibility.md` (docs only). | HOLDS | The `Plugin MCP servers moved ...` catalog blocks (`output-catalog.md` lines 4367-4420) are not in the diff. `tests/architecture/mcp-migration-notice.test.ts` (the byte-equality gate between catalog blocks and the renderer) passes. `mcp-compatibility.md` Upgrading quotes the notice's first line and one row, both matching the catalog. |
| 4 | A marked legacy entry with no owning record stays in `mcp.json` with a warning (AMIG-04). | None. | HOLDS | No production or test diff. Unowned-entry integration tests pass. `mcp-compatibility.md` "Entries that stay in mcp.json" lists the no-owner row with the matching remedy. |

Test assertion weakening: none found. `git show fd9c887b -- tests/integration/mcp-migration.test.ts` is two insertions and no deletions.

### Commands run

Environment: `TMPDIR=/var/tmp/mcp4-reverify-p5`, `PI_MCP_ADAPTER_ROOT=/var/tmp/mcp4-p7-research/a520/node_modules/pi-mcp-adapter` (5.2.0). Repo tests use hermetic homes.

| Command | Exit | Result |
|---------|------|--------|
| `git log --oneline 6f4d2d7c..HEAD -- docs/mcp-compatibility.md docs/output-catalog.md tests/integration/mcp-migration.test.ts` | 0 | 10 commits listed above |
| `git diff 6f4d2d7c HEAD -- docs/output-catalog.md` / `-- docs/mcp-compatibility.md` / `git show fd9c887b -- tests/integration/mcp-migration.test.ts` | 0 | as summarised above |
| `node --test tests/integration/mcp-migration.test.ts tests/integration/mcp-legacy-sweep.test.ts tests/integration/mcp-tool-rules.test.ts` | 0 | 18 pass, 0 fail |
| `node --test tests/orchestrators/reconcile/mcp-migration.test.ts tests/bridges/mcp/legacy.test.ts tests/architecture/mcp-migration-notice.test.ts` | 0 | 131 pass, 0 fail |
| `node .claude/gsd-core/bin/gsd-tools.cjs query verification.fingerprint ...` | 0 | `covered_files` and `covered_digest` copied verbatim into the frontmatter; `tests/bridges/mcp/legacy.test.ts` added because the truth 2 evidence rests on it |

Full gate (cited, run by the orchestrator in this session): `npm run check` on HEAD `51ebbc07`, clean tree, Node v26.11.0, pi-mcp-adapter 5.2.0, `TMPDIR=/var/tmp/mcp4-check-tmp`: exit 0 (typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, test:unpaired, test:integration, test:coverage:direct:all; merged `coverage/direct.lcov`, 269 records). Not re-run here.

### Result

All four truths still hold at HEAD. Status stays `passed`. No gaps.
