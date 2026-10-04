---
phase: 02-adapter-file-delivery
verified: 2026-10-04T00:52:29Z
status: gaps_found
score: 5/5 roadmap success criteria verified (73 plan truths: 68 test-backed, 5 backstop; 11 judgment-tier prohibitions flagged for human review)
covered_files:
  - .planning/phases/02-adapter-file-delivery/02-01-PLAN.md
  - .planning/phases/02-adapter-file-delivery/02-01-SUMMARY.md
  - .planning/phases/02-adapter-file-delivery/02-02-PLAN.md
  - .planning/phases/02-adapter-file-delivery/02-02-SUMMARY.md
  - .planning/phases/02-adapter-file-delivery/02-03-PLAN.md
  - .planning/phases/02-adapter-file-delivery/02-03-SUMMARY.md
  - .planning/phases/02-adapter-file-delivery/02-04-PLAN.md
  - .planning/phases/02-adapter-file-delivery/02-04-SUMMARY.md
  - .planning/phases/02-adapter-file-delivery/02-05-PLAN.md
  - .planning/phases/02-adapter-file-delivery/02-05-SUMMARY.md
  - .planning/phases/02-adapter-file-delivery/02-06-PLAN.md
  - .planning/phases/02-adapter-file-delivery/02-06-SUMMARY.md
  - .planning/phases/02-adapter-file-delivery/02-07-PLAN.md
  - .planning/phases/02-adapter-file-delivery/02-07-SUMMARY.md
  - .planning/phases/02-adapter-file-delivery/02-08-PLAN.md
  - .planning/phases/02-adapter-file-delivery/02-08-SUMMARY.md
  - extensions/pi-claude-marketplace/bridges/mcp/adapter-doc.ts
  - extensions/pi-claude-marketplace/bridges/mcp/adapter-entry.ts
  - extensions/pi-claude-marketplace/bridges/mcp/collision-ancestors.ts
  - extensions/pi-claude-marketplace/bridges/mcp/collision-slots.ts
  - extensions/pi-claude-marketplace/bridges/mcp/safe-set.ts
  - extensions/pi-claude-marketplace/bridges/mcp/stage.ts
  - extensions/pi-claude-marketplace/bridges/mcp/types.ts
  - extensions/pi-claude-marketplace/bridges/mcp/unstage.ts
  - extensions/pi-claude-marketplace/orchestrators/import/execute.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-disable-cascade.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/prune-rollback.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/prune.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-replace.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/backfill.ts
  - extensions/pi-claude-marketplace/orchestrators/types.ts
  - extensions/pi-claude-marketplace/persistence/locations.ts
  - extensions/pi-claude-marketplace/shared/atomic-json.ts
  - extensions/pi-claude-marketplace/shared/errors-bridges.ts
  - extensions/pi-claude-marketplace/shared/notification-dispatch.ts
  - package.json
covered_digest: "v2:sha256:aa634353dd8037e0aa052f8b399d71a103404cb983cd5edd20f924b60ba00e62"
behavior_unverified: 0
gaps:
  - truth: "Install, update, reinstall and uninstall never lose anything the user wrote in mcp-adapter.json (phase goal), including a marker-less override stub under one of the plugin's server names"
    status: failed
    reason: "D-02-10 absorbs the stub: non-carried fields are deleted without notice and the absorbed disabled flag leaves with our entry on uninstall. The operator chose to fix it in this milestone (D-02-21)."
    artifacts:
      - path: "extensions/pi-claude-marketplace/bridges/mcp/stage.ts"
        issue: "stub absorption copies carried fields only and drops the stub (around lines 219-233)"
      - path: "extensions/pi-claude-marketplace/bridges/mcp/adapter-doc.ts"
        issue: "withPluginServers removes the stub (around line 259)"
      - path: "extensions/pi-claude-marketplace/bridges/mcp/unstage.ts"
        issue: "unstage removes our entry with nothing to restore"
    missing:
      - "Keep the absorbed stub verbatim and inert inside the _piClaudeMarketplace marker subobject; carry it through update and reinstall"
      - "Write the kept stub back as a marker-less entry on uninstall and every unstage"
      - "Warn once at install naming the stub fields that stop applying (closed-catalog amendment in docs/output-catalog.md)"
      - "Prove the adapter ignores everything under _piClaudeMarketplace against the pinned pi-mcp-adapter 5.0.0"
  - truth: "Source comments cite requirement IDs, never milestone decision IDs (02-CONTEXT.md convention)"
    status: partial
    reason: "Review-fix commits added D-02-19 / D-02-20 to source comments and test titles; v1.20 D-02-0x IDs already exist in source with other meanings."
    artifacts:
      - path: "extensions/pi-claude-marketplace/orchestrators/plugin/prune-rollback.ts"
        issue: "cites D-02-19 / D-02-20"
      - path: "tests/orchestrators/plugin/prune-rollback.test.ts"
        issue: "test titles cite D-02-19 / D-02-20"
    missing:
      - "Replace every D-02-19 / D-02-20 citation in extensions/ and tests/ (rg -n 'D-02-(19|20)' extensions tests) with requirement IDs (NFR-3 for the rollback restore, AFILE-04 for comment preservation)"
overrides_applied: 0
human_verification:
  - test: "Decide whether D-02-10 stub absorption is an accepted exception to the goal's 'never lose anything the user wrote' (review IN-01, deferred with no carrier)"
    expected: "Either record an override/decision that a marker-less stub under one of the plugin's server names is consumed by install (non-carried fields such as env are dropped, and the absorbed disabled flag leaves with the entry on uninstall), or open a BACKLOG/phase item for a notice or stub restore"
    why_human: "The behavior is a recorded operator decision (D-02-10) but contradicts the literal phase goal wording; only the operator can accept the trade-off"
  - test: "Review the 11 judgment-tier prohibitions (02-01..02-08 must_haves.prohibitions); the verifier's non-authoritative verdict is that every one holds (evidence in the Prohibitions table)"
    expected: "Operator confirms each prohibition is honored, or names the one that is not"
    why_human: "Prohibitions carry no test-tier verification field; per the verifier contract a judgment-tier must-NOT is never silently passed"
---

# Phase 2: Adapter-file delivery Verification Report

**Phase Goal:** Install, update, reinstall and uninstall keep a plugin's MCP servers as marked entries in `<scopeRoot>/mcp-adapter.json`, and never lose or corrupt anything the user or the adapter wrote in that file.
**Verified:** 2026-10-04T00:52:29Z
**Status:** human_needed
**Re-verification:** No (initial verification)

## Goal Achievement

### Observable Truths (ROADMAP success criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Install writes marked entries into `<Pi agent dir>/mcp-adapter.json` / `<cwd>/.pi/mcp-adapter.json`; uninstall removes exactly those entries; NFR-10 write set, `locations.ts` and containment gates name the file (AFILE-01) | ✓ VERIFIED | `locations.ts:66,212,293` `mcpAdapterJsonPath = path.join(scopeRoot, "mcp-adapter.json")`; `stage.ts:182,285` reads/writes only that path; `unstage.ts:148-176` removes marker-matched entries from it (and same-plugin legacy `mcp.json` entries, D-02-12). AGENTS.md:65, PROJECT.md:910, PRD NFR-10/SC-2/AS-8 name the file; `tests/persistence/locations.test.ts` and `tests/architecture/config-state-write-seams.test.ts:233` pin it. Tests `AFILE-01: install writes ... keeps foreign keys` (asserts no `mcp.json` created) and `AFILE-01: uninstall removes only the plugin's marked entries` pass. Independent probe: uninstall left `settings`, `imports`, `claudePlugins`, user server `mine` and unknown key `zzz` intact, removed only `srv`/`other`. |
| 2 | Comments/trailing commas/BOM file installs fine and keeps `settings`, `imports`, `claudePlugins`, user servers; unparseable file refuses with a typed error and keeps exact bytes; comment loss warned once (AFILE-02, AFILE-04) | ✓ VERIFIED | `adapter-doc.ts:153-177` = BOM strip + `strip-json-comments@5.0.3` (`trailingCommas: true`) + `JSON.parse`, cross-checked against the real `pi-mcp-adapter@5.0.0` tarball (shasum `6c20461d...` matches the test pin): `utils.ts:9-15` `parseJsonWithComments` is byte-for-byte the same grammar. `parseJsonc` throws `McpConfigFileError` with no cause (parser text dropped). Probe: `{"a": sk-secret}` refused, bytes kept, message has no secret. Notice seam `notification-dispatch.ts:250` is called from 15 orchestrator sites (install, update, reinstall, uninstall, prune, enable/disable, marketplace remove/update, import, reconcile); byte-locked to `docs/output-catalog.md:4149,4161` by `tests/architecture/mcp-config-notices.test.ts`. Test `AFILE-04: install over a commented mcp-adapter.json shows the comments-removed notice once` asserts the second install shows none. |
| 3 | Legacy `mcp-servers` key: our entries go under it and user servers keep loading (AFILE-03) | ✓ VERIFIED | `adapter-doc.ts:175` selects the first present key, matching the adapter's own disable-writer rule (`config.ts:1724` in pi-mcp-adapter 5.0.0) and its loader (`raw.mcpServers ?? raw["mcp-servers"]`, `config.ts:1289`); `withPluginServers` adds a new key only when absent. Tests `AFILE-03: an mcp-servers-only file gets the entry under mcp-servers` and adapter-doc AFILE-03 cases pass. Probe: entries landed under `mcp-servers`, no `mcpServers` key added. |
| 4 | Full-definition collisions reported naming the winning source under nine-source later-wins precedence; partial entries are overrides (AFILE-05, closes MCPSRC-01) | ✓ VERIFIED | `collision-slots.ts:86-104` source order matches `getConfigSources` in the real adapter (`config.ts:668-815`: shared-global, agents-global, agents-nested-global, pi-mcp-global, pi-global, ancestors, shared-project, pi-mcp-project, pi-project). `isFullDefinition` matches the adapter's `mergeServerMaps` string `command`/`url`/`socket` transport test. `stage.ts:108-130` throws `McpServerCollisionError(name, owningPath, winningPath)`. Ancestor opt-in only from user-global sources (`collision-ancestors.ts`, matching adapter `config.ts:746`). Probe: full def in `<cwd>/.mcp.json` refused naming both paths; a `{disabled:true}` partial in the same file did not block. BACKLOG MCPSRC-01 marked CLOSED. |
| 5 | A user override in our entry (e.g. `disabled: true`) survives update and reinstall; closed carried set recorded and pinned against `ServerEntry` (AFILE-06) | ✓ VERIFIED | `adapter-entry.ts:17-27` module-private `CARRIED_FIELDS` (9 fields, = D-02-06). `stage.ts:223-229` passes `{...ours, ...overlays}` as `previous`; update (`update-swap.ts:320`) and reinstall (`reinstall-replace.ts:442`) prepare before any unstage, so the previous entry is visible. The test's 34 vendored `ServerEntry` keys match the real `types.ts:438-525` exactly (34, same order). Tests `AFILE-06: a disabled plugin MCP server stays disabled through update` / `... through reinstall` pass. Probe: `disabled` + `excludeTools` survived a command change; a stub's `env` was not copied (D-02-10). |

**Score:** 5/5 roadmap truths verified (0 present-but-behavior-unverified)

### Plan must-haves (02-01..02-08)

All 68 non-backstop truths across the eight plans map to code and to passing tests (see Behavioral Spot-Checks). The backstop (concurrency) truths:

| Backstop truth | Evidence | Status |
|----------------|----------|--------|
| Every MCP config write is one `atomicWriteJson`; ops serialize on the state lock | `stage.ts:285`, `unstage.ts:119`; `tests/shared/atomic-json.test.ts` passes | ✓ VERIFIED |
| A refusal performs no write | Byte-equality assertions in `AFILE-02: an MCP install over an unparseable mcp-adapter.json fails and keeps its bytes`; probe | ✓ VERIFIED |
| Server key re-derived per read, never persisted | `readMcpConfigDoc` computes `serverKey` per call; no state field holds it | ✓ VERIFIED |
| Collision walk reads once per stage; carry-forward reads at prepare (accepted windows) | Statements of accepted limitation, documented in `collision-slots.ts` header and plan 02-03; nothing to prove beyond the code shape | ✓ VERIFIED (accepted limitation) |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `bridges/mcp/adapter-doc.ts` | JSONC reader, key selection, partition, next-doc | ✓ VERIFIED | 287 lines, imports `strip-json-comments`; used by stage, unstage, collision-slots |
| `bridges/mcp/adapter-entry.ts` | Stamping + closed carry-forward | ✓ VERIFIED | Used by `stage.ts:223` |
| `bridges/mcp/collision-slots.ts` / `collision-ancestors.ts` | Nine-source walk, ancestor trust | ✓ VERIFIED | `walkMcpSources` used by `stage.ts:113` |
| `persistence/locations.ts` | `mcpAdapterJsonPath` | ✓ VERIFIED | |
| `shared/errors-bridges.ts` | `McpConfigFileError`, `McpServerCollisionError.winningPath`, `McpUnstagePartialError` | ✓ VERIFIED | |
| `shared/notification-dispatch.ts` | `McpConfigNotice`, `notifyMcpConfigNotices` | ✓ VERIFIED | 15 call sites |
| `tests/architecture/mcp-config-notices.test.ts` | Byte lock to catalog | ✓ VERIFIED | |
| `docs/output-catalog.md` | Two new catalog states | ✓ VERIFIED | lines 4149, 4161 |

`gsd-tools verify.artifacts`: 22/22 pass across all eight plans.

### Key Link Verification

`gsd-tools verify.key-links`: 19/20 by literal pattern. The one miss is 02-01's `readMcpConfigDoc\(locations\.mcpAdapterJsonPath`: plan 02-04 (D-02-14) routed the read through `readTargetConfig(locations.mcpAdapterJsonPath, ...)` (`stage.ts:182`), which calls `readMcpConfigDoc(filePath, ADAPTER_SERVER_KEYS)` (`stage.ts:152`). WIRED, by a different call shape.

| From | To | Via | Status |
|------|----|-----|--------|
| `install-outcome.ts` | `stage.ts` | `replacePreparedMcp` / `rollbackMcpReplacement` (D-02-11 byte restore) | ✓ WIRED (`:972`, `:992`) |
| `update-swap.ts` | `stage.ts` | `prepareStageMcpServers` before commit; notices taken only after commit | ✓ WIRED (`:320`, `:1148-1149`) |
| `reinstall-replace.ts` | `stage.ts` | replace/rollback/finalize handles | ✓ WIRED |
| `marketplace/shared.ts` | `unstage.ts` | `cascadeUnstagePlugin` reads `mcpResult.notices` / `written` | ✓ WIRED |
| `prune-rollback.ts` | `locations.ts` | snapshots `mcpAdapterJsonPath` and `mcpJsonPath`; D-02-19/20 restore | ✓ WIRED (`:359`, `:368`) |
| reconcile/import/marketplace update | `notification-dispatch.ts` | one seam call after the cascade | ✓ WIRED |

### Data-Flow Trace (Level 4)

| Artifact | Data | Source | Real data | Status |
|----------|------|--------|-----------|--------|
| `StageMcpCommitResult.notices` | `comments-dropped` | `config.hadComments` from the bytes read in prepare | Yes | ✓ FLOWING |
| `UnstageOutcome.mcpConfigNotices` | unstage notices | `unstageMcpServers` -> `cascadeUnstagePlugin` -> orchestrator outcome | Yes | ✓ FLOWING |
| Carried fields | previous entry | `partitionServers(...).ours/overlays` from the live file | Yes | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| MCP bridge, notices seam, locations, errors suites | `node --test tests/bridges/mcp/*.test.ts tests/architecture/mcp-config-notices.test.ts tests/persistence/locations.test.ts tests/shared/errors-bridges.test.ts` | 230/230 pass | ✓ PASS |
| AFILE-tagged install/update/reinstall/uninstall cases | `node --test --test-name-pattern="AFILE-0" <4 orchestrator files>` | 37/37 pass | ✓ PASS |
| AFILE/D-02 cases in import, marketplace, enable-disable, cascades, prune, reconcile, backfill, atomic-json, dispatch | `node --test --test-name-pattern="AFILE-0\|D-02-1" <15 files>` | 66/66 pass | ✓ PASS |
| Prune rollback (D-02-19/20 restore and races) | `node --test tests/orchestrators/plugin/prune-rollback.test.ts` | 44/44 pass | ✓ PASS |
| Independent end-to-end probe of stage/update/collision/unstage/refusal on a BOM+comments+trailing-comma `mcp-servers` file (hermetic HOME, `/tmp/afile-probe/probe.ts`) | `node /tmp/afile-probe/probe.ts` | All expected outcomes (see truths 1-5) | ✓ PASS |
| Grammar, precedence and `ServerEntry` cross-check against the real `pi-mcp-adapter@5.0.0` tarball (`npm pack` to `/tmp`) | source diff by inspection | shasum matches pin; grammar, source order, transport test, disable-writer key rule, 34 keys all match | ✓ PASS |
| Phase 1 regression | `node --test tests/architecture/peer-floor.test.ts tests/platform/pi-api.test.ts tests/shared/concerns/soft-dep.test.ts` | 85/85 pass; detection sources unchanged since Phase 1 | ✓ PASS |
| Full `npm run check` on HEAD 7fd15b22 | orchestrator run, `tmp/check02.log` | typecheck, lint and fallow passed; at format:check when this report was written; `CHECK_EXIT` pending | ? PENDING (orchestrator reconciles) |

### Probe Execution

Step 7c: no `scripts/*/tests/probe-*.sh` declared or present for this phase. SKIPPED.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| AFILE-01 | 02-01, 02-02 | Marked entries in `mcp-adapter.json`; uninstall removes exactly those; NFR-10 | ✓ SATISFIED | Truth 1 |
| AFILE-02 | 02-01, 02-04 | Adapter grammar; typed refusal; foreign keys survive | ✓ SATISFIED | Truth 2 |
| AFILE-03 | 02-01 | `mcp-servers` honored | ✓ SATISFIED | Truth 3 |
| AFILE-04 | 02-04..02-08 | Comment loss warned once | ✓ SATISFIED | Truth 2; 15 seam call sites |
| AFILE-05 | 02-02 | Nine-source later-wins; partial = override | ✓ SATISFIED | Truth 4 |
| AFILE-06 | 02-03 | Overrides survive update/reinstall; closed set | ✓ SATISFIED | Truth 5 |

All six IDs appear in plan frontmatter and in REQUIREMENTS.md (lines 52-66, traceability 169-174). No orphaned requirement.

### Decisions D-02-01..20

All honored in code, with these notes: D-02-15 is a BACKLOG item (MCPOVR-01, `BACKLOG.md:3750`); D-02-18 keeps marker-keyed unstage for multi-member cascades (WR-06 skipped by decision); D-02-19/20 implemented in `prune-rollback.ts:206-270` with the documented compare-then-write window; Phase 3 hand-off on `requestTimeoutMs` is recorded in ROADMAP Phase 3 Notes; IN-02 (stale legacy entries) is carried in ROADMAP Phase 5 Notes.

### Prohibitions (judgment tier, non-authoritative verifier verdict)

| Prohibition | Verdict | Evidence |
|-------------|---------|----------|
| Never touch adapter cache/keyring/OAuth/approval files | Holds | Only writes: `atomicWriteJson` to `mcpAdapterJsonPath`/`mcpJsonPath`; collision walk is read-only |
| Never surface raw JSON parser text | Holds | `adapter-doc.ts:115-122` drops the error, no cause; test + probe |
| Never shadow a user server via a new key or overwrite a same-named user entry | Holds | key selection rule; `theirs` collision; CR-01 fix in `assertNoMcpCollisions` |
| Never silently shadow a user server in any of the nine sources | Holds | Truth 4 |
| Project file cannot opt into ancestor discovery | Holds | `configuredAncestorRoots` reads global reads only |
| Never copy credential-bearing fields | Holds | `CARRIED_FIELDS` excludes them; probe `env` not copied |
| Never drop comments silently (install/update/reinstall/uninstall/prune/remove/enable/disable/cascades/reload/import/marketplace update) — 5 statements | Holds | Notices on every rewrite path including failure arms; restored-byte paths emit none |

Flagged: unverified-prohibition, human review recommended (see Human Verification 2).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (76 phase-touched files) | - | TBD/FIXME/XXX/TODO/HACK | none found | - |
| `orchestrators/plugin/prune-rollback.ts`, `prune.ts`, `marketplace/shared.ts`, `bridges/mcp/unstage.ts`, `types.ts`, `shared/errors-bridges.ts`, `shared/atomic-json.ts` (+ tests) | various | Source comments cite milestone decision IDs `D-02-19` / `D-02-20` | ℹ️ Info | 02-CONTEXT.md says source comments cite requirement IDs, never `D-02-NN`, because v1.20 `D-02-0x` IDs already exist in source with other meanings (e.g. `edge/handlers/plugin/uninstall.ts:25`). No collision today for 19/20, but the convention is broken by the review-fix commits |
| `bridges/mcp/stage.ts:219-233`, `adapter-doc.ts:259` | - | Stub absorption drops non-carried stub fields with no notice (review IN-01) | ⚠️ Warning | See Human Verification 1 |

Other deferred review Info items (IN-03 helper drift `ENOTDIR`, IN-04 over-refusal of a non-object `mcp-servers` beside `mcpServers`, IN-05, IN-06, IN-08, IN-09) are safe-side or cosmetic and do not threaten the goal.

### Human Verification Required

### 1. Stub absorption vs "never lose" (IN-01 / D-02-10)

**Test:** In a project, with a user-scope plugin `p` whose server `srv` is disabled by `/mcp-adapter disable` (the adapter writes `{"disabled": true}` into `<cwd>/.pi/mcp-adapter.json`, since its writer always targets the project file), add any extra field to that stub (for example `env`), then install `p` at project scope, then uninstall it.
**Expected (current code):** install absorbs the stub: `disabled` is carried into the marked entry, other fields are deleted with no notice; uninstall removes the marked entry, so the project-level disable is gone and the user-scope server loads again in this project.
**Why human:** This is exactly what D-02-10 decided, but the phase goal says the file must never lose anything the user wrote. The review deferred IN-01 with no carrier (not in BACKLOG or a later phase). The operator should either accept it with an override, for example:

```yaml
overrides:
  - must_have: "never lose or corrupt anything the user or the adapter wrote in that file"
    reason: "D-02-10: a marker-less stub under one of the plugin's server names is absorbed by install (carried fields only); dropping its other fields and losing it on uninstall is accepted"
    accepted_by: "acolomba"
    accepted_at: "<ISO timestamp>"
```

or file a BACKLOG item next to MCPOVR-01 (notice on absorption, or restore the stub's carried fields as a marker-less stub on uninstall).

### 2. Judgment-tier prohibitions

**Test:** Read the Prohibitions table above against the code it cites.
**Expected:** Every prohibition holds.
**Why human:** No prohibition carries a test-tier verification; the verifier's verdict is non-authoritative by contract.

### Deferred to later phases (not gaps)

- Live adapter loading of the written entries: Phase 7 live UAT (ADOC-02). Phase 2 criteria are proven against the adapter's real 5.0.0 grammar, precedence and `ServerEntry`.
- IN-02 stale legacy `mcp.json` entries after update/reinstall: ROADMAP Phase 5 Notes.
- `requestTimeoutMs` translate-vs-carry interaction: ROADMAP Phase 3 Notes.

### Gaps Summary

**Operator review (2026-10-04):** the prohibitions table is approved; every prohibition holds. Human item 1 became a gap: the operator chose to fix stub absorption in this milestone under D-02-21 (preserve the stub inert in the marker, restore it on uninstall, warn at install). The D-02-NN source-comment convention breach is a second, partial gap. The full `npm run check` passed on 7fd15b22 (`tmp/check02.log`, CHECK_EXIT=0).

No blocking gaps. All five roadmap success criteria and all six AFILE requirements are met by wired, tested code, and the critical contracts (grammar, nine-source order, transport test, server-key rule, 34-key `ServerEntry`) were cross-checked against the real `pi-mcp-adapter@5.0.0` package rather than the summaries. Status is `human_needed` for two reasons: the D-02-10 stub-absorption behavior conflicts with the goal's literal "never lose" wording and has no recorded acceptance or carrier, and the judgment-tier prohibitions need operator sign-off. The full `npm run check` result is pending in the orchestrator (typecheck, lint and fallow were already green in `tmp/check02.log`).

---

_Verified: 2026-10-04T00:52:29Z_
_Verifier: Claude (gsd-verifier)_
