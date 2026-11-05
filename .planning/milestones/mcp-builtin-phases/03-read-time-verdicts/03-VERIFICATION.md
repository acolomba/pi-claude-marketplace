---
phase: 03-read-time-verdicts
verified: 2026-11-05T09:00:00Z
status: passed
score: 5/5 must-haves verified
covered_files:
  - ".planning/phases/03-read-time-verdicts/03-01-PLAN.md"
  - ".planning/phases/03-read-time-verdicts/03-01-SUMMARY.md"
  - ".planning/phases/03-read-time-verdicts/03-02-PLAN.md"
  - ".planning/phases/03-read-time-verdicts/03-02-SUMMARY.md"
  - ".planning/phases/03-read-time-verdicts/03-03-PLAN.md"
  - ".planning/phases/03-read-time-verdicts/03-03-SUMMARY.md"
  - ".planning/phases/03-read-time-verdicts/03-04-PLAN.md"
  - ".planning/phases/03-read-time-verdicts/03-04-SUMMARY.md"
  - ".planning/phases/03-read-time-verdicts/03-05-PLAN.md"
  - ".planning/phases/03-read-time-verdicts/03-05-SUMMARY.md"
  - ".planning/phases/03-read-time-verdicts/03-06-PLAN.md"
  - ".planning/phases/03-read-time-verdicts/03-06-SUMMARY.md"
  - ".planning/phases/03-read-time-verdicts/03-07-PLAN.md"
  - ".planning/phases/03-read-time-verdicts/03-07-SUMMARY.md"
  - ".planning/phases/03-read-time-verdicts/03-08-PLAN.md"
  - ".planning/phases/03-read-time-verdicts/03-08-SUMMARY.md"
  - ".planning/phases/03-read-time-verdicts/03-09-PLAN.md"
  - ".planning/phases/03-read-time-verdicts/03-09-SUMMARY.md"
  - "extensions/pi-claude-marketplace/domain/mcp-implementation.ts"
  - "extensions/pi-claude-marketplace/domain/mcp-resolution.ts"
  - "extensions/pi-claude-marketplace/domain/plugin-resolver.ts"
  - "extensions/pi-claude-marketplace/edge/register.ts"
  - "extensions/pi-claude-marketplace/orchestrators/edge-deps.ts"
  - "extensions/pi-claude-marketplace/orchestrators/mcp/recorded-servers.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/info.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/list-installed-row.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/mcp-verdict-read.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/mcp-verdict.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/plugin-state-classifier.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts"
  - "extensions/pi-claude-marketplace/orchestrators/reconcile/convergence.ts"
  - "extensions/pi-claude-marketplace/orchestrators/reconcile/mcp-migration.ts"
  - "extensions/pi-claude-marketplace/orchestrators/reconcile/pending.ts"
  - "extensions/pi-claude-marketplace/shared/completion-cache.ts"
  - "extensions/pi-claude-marketplace/shared/concerns/soft-dep.ts"
  - "extensions/pi-claude-marketplace/shared/notify-reasons.ts"
  - "features/mcp-server/companion-missing.feature"
  - "features/mcp-server/implementation-switch.feature"
  - "features/mcp-server/verdict-apply.feature"
  - "features/mcp-server/verdict-fetch.feature"
  - "features/mcp-server/verdict-info.feature"
  - "features/mcp-server/verdict-install.feature"
  - "features/mcp-server/verdict-list.feature"
  - "features/mcp-server/verdict-markers.feature"
  - "features/mcp-server/verdict-update.feature"
covered_digest: "v4:sha256:23dfdb30999a51bcff6419f39c8867526e8f6d70c11b10cb563709a7c8322590"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: passed
  previous_score: 5/5
  gaps_closed: []
  gaps_remaining: []
  regressions: []
---

# Phase 3: Read-Time Verdicts — Verification

**Phase goal:** A plugin's available or partially available state, each
server's verdict, the markers, and `--partial` consent follow the active
implementation, computed at read time from neutral records, so a switch never
asks the user for anything and a Pi with no MCP support tells the user what to
turn on.

**Status:** passed. **Score:** 5/5 ROADMAP success criteria verified, 0
behavior-unverified, 0 overrides, 0 gaps, 0 human-verification items.
**Re-verification:** Yes, milestone-close re-check on the combined tree (HEAD
ca56636). The earlier report was written at 6775599 and went stale only
because later phases edited covered files.

## What later phases changed on the covered surface

| Change | Plan | Effect on Phase 3 truths |
|---|---|---|
| `classifyInstalledForImplementation` and the `InstalledRecordView` type in `list-installed-row.ts`; `candidateFor` moved to `plugin-state-classifier.ts`; `upgradeCandidate` no longer exported | 06-03 (970f5e2) | `list` and completion share one classification. The `list` row still reads `readRecordMcpVerdict` and `candidateFor` (the active implementation's view of the candidate), so MREC-03 holds. The disabled short-circuit still precedes any verdict read. |
| `edge-deps.ts` classifies installed completion rows through that helper for the resolver's implementation; `completion-cache.ts` stamps the plugin index with the implementation (schemaVersion 7); `edge/register.ts` passes the lookup's implementation | 06-03 | Replaces accepted P3-DC-22 ("completions read the stored verdict"). Completions now agree with `list` under each implementation. This is stricter than Phase 3 required, not a regression. |
| `LegacyServersSource.locations` is required; `isPluginRootContained` refuses a plugin root outside its owning clone root (UF-1, NFR-10) before the legacy reader reads any file; refusal reads as `unreadable`, so the stored verdict stands | 06-REVIEW-FIX | Every caller passes `locations` (info, list helper, update-swap, convergence, dependency-move, install-flow-results x2, mcp-migration). Typecheck is required to enforce this; the gate passed. MREC-02 fall-back semantics are unchanged. |
| `info.ts` passes `locations` into `readInstalledRecord` | 06 | Wiring only. `verdict-info.feature` re-run green. |
| `update-swap.ts` drops `updateAgentImplementation` and stages the agent grant form from `args.mcpImplementation` | Phase 4/6 | Grant form only. The neutral record write (`compatibilityBasis = "neutral"`, line 946) and `partialDegradeOf` are intact. |
| `mcp-verdict-read.ts`, `convergence.ts`, `mcp-migration.ts` | 06 | Only `locations` threading, as above. |

## Observable truths

| # | Truth | Status | Evidence on the current tree |
|---|---|---|---|
| 1 | `list`, `info`, `install`, `update`, `pending`, `apply` compute state against the active implementation; an `sse` plugin is available under the adapter and partially available under built-in with no reinstall; stored compatibility no longer depends on the implementation at install (MREC-03) | VERIFIED | `plugin-resolver.ts` writes `compatibilityBasis: "neutral"` (line 763); `install-outcome.ts:1671`, `update-preflight.ts:860,928`, `update-swap.ts:946`, and `mcp-migration.ts:578` write it too. `resolutionFor` (plugin-resolver.ts:797-810) is the per-implementation view. `effectiveMcpCompatibility` in `domain/mcp-implementation.ts` joins the record with the active implementation. `list` goes through `classifyInstalledForImplementation` and `readRecordMcpVerdict`. `verdict-list.feature` (including the `@own-implementation` switch scenario) and `implementation-switch.feature`, `verdict-apply.feature` pass under both profiles. |
| 2 | `info` shows each server's verdict for the active implementation with its reason tokens (MREC-04) | VERIFIED | `info.ts` reads through `readRecordMcpVerdict` and `resolutionFor`. `verdict-info.feature` passes under both profiles (blocked `sse` under built-in, written server under the adapter). |
| 3 | With no active implementation, a plugin with MCP servers stays `installed` with `{requires mcp}`, `{requires pi-mcp-adapter}`, or `{requires builtin mcp}`; no `--partial`; Pi settings never written (MREC-05) | VERIFIED | `MCP_NAME_TABLE` in `soft-dep.ts:133-` has a `none` row per run-every shape with `missing: true`. `install-outcome.ts:865` builds `consentView` through `resolutionFor`; record-driven callers pass `"none"`. `companion-missing.feature` passes and asserts the Pi settings text is unchanged. A grep for `settings.json` writes finds only the Claude settings reader in `import/settings.ts`; no write path to Pi settings exists. |
| 4 | `--partial` consent only on a user-run install or update against the active implementation; enable, apply, reinstall, import, and cascades never ask because of a switch (MREC-06) | VERIFIED | `consentView` is a required field (`install-outcome.ts:241`). The user-run install passes the run's implementation (`install-flow-cascade-context.ts:167`); `install-flow-results.ts:531`, `install-cascade.ts:1470`, and `enable-disable.ts:448,1034` pass `"none"`. Update uses `partialDegradeOf` (update-swap.ts:1800) with the new-degrade baseline; `convergence.ts:489` uses `candidateDrops` with the baseline; `dependency-move.ts:171` uses `recordDegradeBaselineReader`. `verdict-install`, `verdict-update`, `verdict-apply` features pass under both profiles. |
| 5 | `sse` under built-in shows `{unsupported mcp, requires pi-mcp-adapter}` and `requires: pi-mcp-adapter (missing)`; a server neither runs shows `{unsupported mcp}` only; owned rows pass under both profiles; new reasons drafted as CHANGELOG parent lines (MREC-07) | VERIFIED | Byte-exact rows in `verdict-list.feature`, `verdict-markers.feature`, `verdict-info.feature` pass under both profiles. The parent lines are now applied: `CHANGELOG.md:11` documents the three MCP markers; `docs/json-output.md:949` lists `requires mcp` and `requires builtin mcp` in `Reason`; `docs/output-catalog.md:69` documents the marker rule. |

## Requirements coverage

| ID | Status | Evidence |
|---|---|---|
| MREC-03 | SATISFIED | Truth 1; later `classifyInstalledForImplementation` keeps the read-time rule and extends it to completion. |
| MREC-04 | SATISFIED | Truth 2. |
| MREC-05 | SATISFIED | Truth 3. |
| MREC-06 | SATISFIED | Truth 4. |
| MREC-07 | SATISFIED | Truth 5; CHANGELOG and `docs/json-output.md` edits are in the tree. |

REQUIREMENTS.md marks all five `[x]` and traceability `Complete`. No orphaned
requirements for Phase 3.

## Behavioral spot-checks (this run)

| Check | Command | Result |
|---|---|---|
| Phase 3 unit suites (14 files: list-installed-row, mcp-verdict-read, mcp-verdict, plugin-state-classifier, info, install-outcome, update-swap, edge-deps, recorded-servers, convergence, mcp-migration, pending, mcp-implementation, plugin-resolver) | `node --test --test-reporter=tap <files>` | 1343 pass, 0 fail, exit 0 |
| Owned verdict features, adapter profile (list, info, markers, companion-missing, install, update, apply, fetch) | `cucumber-js --profile adapter <files>` | 36/36 scenarios, 469/469 steps (seed 690640) |
| Owned verdict features, builtin profile | `cucumber-js --profile builtin <files>` | 27/27 scenarios, 339/339 steps (seed 227586) |
| Switch, lifecycle, and invalid-configs features, adapter | `cucumber-js --profile adapter ...` | 21/21 scenarios, 295/295 steps |
| Same three features, builtin | `cucumber-js --profile builtin ...` | 18/18 scenarios, 219/219 steps |

Combined-tree gate evidence supplied by the caller (not re-run here):
`npm run check` exit 0 on 71a37c4 (cucumber adapter 1603/1603, builtin
133/133), `test:modules` exit 0 on 2b6f2f4, CI run 41967152313 success on
2b6f2f4. HEAD differs from those commits only in `.planning/`.

## Anti-patterns

No `TBD`, `FIXME`, or `XXX` in any covered source file. No stub or hollow
data path found: the row, info, completion, convergence, and consent paths
all read `readRecordMcpVerdict` or its baseline reader, which read the stored
record offline.

## Human verification required

None.

## Advisory notes

- P3-DC-22 is superseded by plan 06-03, which makes completions per
  implementation. The Phase 3 text that says completions read the stored
  verdict is outdated and should not be read as current behavior.
- P3-DC-122 (the `pending` versus `apply` preview mismatch, which predates the
  phase) and P3-DC-112 (a user-run `update` keeps today's consent rules)
  remain accepted decisions and are not re-litigated.
- `01-FROZEN.md` interface 3 text ("An install writes a new record without the
  basis") is outdated: install writes `compatibilityBasis: "neutral"`. This is
  already recorded as a Phase 6 parent line.

---

_Verified: 2026-11-05T09:00:00Z_
_Verifier: Claude (gsd-verifier)_
