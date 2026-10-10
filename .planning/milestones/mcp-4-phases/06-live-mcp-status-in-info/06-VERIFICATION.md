---
phase: 06-live-mcp-status-in-info
verified: 2026-10-09T23:44:46Z
status: passed
score: 10/10 must-haves verified
covered_files:
  - .planning/phases/06-live-mcp-status-in-info/06-01-PLAN.md
  - .planning/phases/06-live-mcp-status-in-info/06-01-SUMMARY.md
  - .planning/phases/06-live-mcp-status-in-info/06-02-PLAN.md
  - .planning/phases/06-live-mcp-status-in-info/06-02-SUMMARY.md
  - .planning/phases/06-live-mcp-status-in-info/06-03-PLAN.md
  - .planning/phases/06-live-mcp-status-in-info/06-03-SUMMARY.md
  - docs/output-catalog.md
  - extensions/pi-claude-marketplace/edge/handlers/plugin/info.ts
  - extensions/pi-claude-marketplace/edge/register.ts
  - extensions/pi-claude-marketplace/edge/types.ts
  - extensions/pi-claude-marketplace/index.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/info-mcp-status.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
  - extensions/pi-claude-marketplace/platform/mcp-status.ts
  - extensions/pi-claude-marketplace/shared/notification-grammar.ts
  - extensions/pi-claude-marketplace/shared/notification-types.ts
  - tests/integration/mcp-status-conformance.test.ts
  - tests/integration/pi-mcp-adapter-peer.ts
  - tests/orchestrators/plugin/info-mcp-status.test.ts
  - tests/platform/mcp-status.test.ts
covered_digest: "v3:sha256:a43c64ea72eeae6a8e29be9ada0a087b74b5f09cd550e9dd07cfdbba3455938f"
re_verification: "scoped; baseline 1b1e39a3; head 3df6309c"
behavior_unverified: 0
overrides_applied: 0
---

# Phase 6: Live MCP status in info Verification Report

**Phase Goal:** `/claude:plugin info` tells the user what state each plugin MCP server is in, as the adapter reports it, and says plainly when it does not know.
**Verified:** 2026-10-09
**Status:** passed
**Re-verification:** No, initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SC1/ASTAT-01: info shows each written server's adapter state from `pi-mcp-adapter/status/v1`, without importing the adapter or connecting servers | VERIFIED | `platform/mcp-status.ts` subscribes once via `events.on` (the `PiEventSource` port is on-only; no `.emit(` and no adapter import under `extensions/`). `index.ts:77` builds `createMcpStatusTracker(pi.events)` and threads it through `EdgeDeps.mcpStatus` -> `register.ts:98` -> `edge/handlers/plugin/info.ts:76` -> `getPluginInfo` -> `withServerStatus` (`info.ts` single-block and fan-out) -> `withMcpServerStatus`. The renderer `mcpEntryText` prints `entry.status` first inside the parentheses. Tests pass: `tests/orchestrators/plugin/info.test.ts`, `tests/index.test.ts`, `tests/edge/handlers/plugin/info.test.ts` (256/256). |
| 2 | SC2: a lazy server not yet connected shows its resting state, not a failure | VERIFIED | `RUNTIME_STATUS_TOKENS` maps `cached` -> `cached, connects on first use` and `not-connected` -> `not connected`; `failed` only from the adapter's own `failed`. Owner test matrix `ASTAT-01: ... answering <answer> reads <token>` passes. |
| 3 | SC3/ASTAT-02: no snapshot, the empty shutdown snapshot, an absent adapter, a malformed or wrong-version payload, and an unknown status show an explicit unknown, not a guess | VERIFIED | `readSnapshot` returns `undefined` for an invalid payload or an empty `servers` list; every payload replaces `latest`; `lookup` returns `no-snapshot` / `unrecognized`, both mapped to `status unknown`; an unlisted key is `not loaded`. `tests/platform/mcp-status.test.ts` (invalid replaces valid, throwing getter, status mutated after the check) passes. Conformance test with the real adapter's shutdown snapshot passes. |
| 4 | SC4/ASTAT-02: every new token is a closed-catalog amendment and the catalog gates pass | VERIFIED | `McpServerStatus` is a ten-member union in `notification-types.ts`. `docs/output-catalog.md` carries the token table (~L2597-2607) and byte-locked states `installed-with-mcp-not-loaded`, `installed-both-scopes-mcp-overridden` and the status-bearing states. Catalog contract, parser and `notify-closed-set-locks` tests pass; the full `npm run check` was green on HEAD `3aafdfe3` (cited, not re-run). |
| 5 | Shadow rule (D-06-09): same plugin in both scopes gives the project row the state and the user row `overridden by project scope`; no snapshot gives both `status unknown`; a disabled, non-listing or unreadable project record does not override | VERIFIED | `projectOverrides` + `stampEntries` in `info-mcp-status.ts` (the no-snapshot rule precedes the shadow rule). `info.test.ts` ASTAT-01/02 cases at L7324-7493 (fan-out, `--scope user`, unparseable project `state.json`, disabled record, different server, no snapshot) pass. |
| 6 | `--scope user` reads the project record read-only (prohibition: no write, no file or directory created) | VERIFIED | `readProjectInstallRecord` calls `loadState(..., { persistMigration: false })` inside `try`/`catch` (`state-io.ts:526` gates the write). The unparseable-`state.json` test asserts the directory still holds only `state.json` and the bytes are unchanged. The test tier is wired, so the prohibition is not treated as unverified. |
| 7 | Severity unchanged and no extra detail (D-06-04/05/10); `(disabled)` and not-installed rows, unresolved components, left-out and unrecorded servers show no state; `requires: ... (missing)` keeps its bytes | VERIFIED | `withMcpServerStatus` returns the block untouched unless the row is installed or partially-installed with resolved components and a record; stamped entries skip `unsupportedFeature` and servers the record does not list. Owner tests at `info-mcp-status.test.ts` L131-249 pass; the catalog 2710-2719 state keeps the `(missing)` line. |
| 8 | Prohibitions: no rendering of payload text; no stale or guessed state; no publishing or connecting; no persistence | VERIFIED | Tokens come only from closed maps; the schema reads only `version`, `servers[].name` and `servers[].status`. Names are used only as Map keys. The factory test mocks the bus strictly (`tests/index.test.ts:279`, only `on`). No file is written by the tracker. `06-SECURITY.md` has `threats_open: 0`. |
| 9 | Conformance with pi-mcp-adapter 5.1.0: its own channel and version, the real install keys in both scopes, the empty shutdown snapshot | VERIFIED | Ran `tests/integration/mcp-status-conformance.test.ts` under a temp HOME/PI_CODING_AGENT_DIR with `PI_MCP_ADAPTER_ROOT` at a 5.1.0 copy (`/var/tmp/mcp4-p4-08/adapter/...`): 3/3 pass, 0 skipped. The first adapter copy tried was 5.0.0 and correctly failed on the peer range. The full check also ran this suite. |
| 10 | Drift guard pins the adapter's status union, channel and snapshot version | VERIFIED | The third conformance case passes against `dist/types.d.ts`, which holds the 7-status union, `"pi-mcp-adapter/status/v1"` and version `1`. |

**Score:** 10/10 truths verified (0 present, behavior-unverified)

### Requirements Coverage

| Requirement | Source Plans | Status | Evidence |
|-------------|--------------|--------|----------|
| ASTAT-01 | 06-01, 06-02, 06-03 | SATISFIED | Truths 1, 2, 5, 6, 7, 9, 10. Marked `[x]` and Complete in REQUIREMENTS.md. |
| ASTAT-02 | 06-01, 06-02, 06-03 | SATISFIED | Truths 3, 4, 9. Marked `[x]` and Complete in REQUIREMENTS.md. |

No orphaned requirements: REQUIREMENTS.md maps only ASTAT-01 and ASTAT-02 to Phase 6, and all three plans claim both.

### Anti-Patterns Found

None blocking. No TBD, FIXME or XXX markers in the phase's source files. Review findings: WR-01 fixed in `03a4104e` (the code now reads each field once and re-checks that it is a string); IN-01 and IN-02 are open info items by design (a defensive own-key guard, and a comment that is slightly inexact about `servers`), neither affecting behavior.

### Deferred Items

The live deferred-session reading (`status unknown` until the first MCP use, then a live state; D-06-06a) cannot be observed here without a real Pi session. It is carried by Phase 7 ROADMAP success criterion 2 (ADOC-02 live UAT), which names it explicitly. It is not raised as a human item for this phase.

### Human Verification Required

None.

## Gaps Summary

No gaps. All four roadmap success criteria and the plan-level truths, key links and prohibitions hold in the code. Targeted runs: 197/197 on the owner and catalog suites, 256/256 on the info, index and edge-handler suites, and 3/3 on the 5.1.0 conformance suite. `npm run check` (exit 0 on `3aafdfe3`, adapter 5.1.0 conformance included) is cited, not re-run.

---

_Verified: 2026-10-09_
_Verifier: Claude (gsd-verifier)_

## Re-verification (2026-10-09)

**Scope:** scoped re-verification. Baseline `aa25cd0b`, head `51ebbc07`. The earlier findings above stand and are unchanged.
**Trigger:** `verification.status` read `stale` because Phase 7 edited two files in `covered_files`.

### Changed covered files since the baseline

| File | Commit | What changed (`git diff aa25cd0b HEAD`) |
|------|--------|------------------------------------------|
| `extensions/pi-claude-marketplace/platform/mcp-status.ts` | `58c5a007` | One line, a doc comment only: "pi-mcp-adapter 5.1.0 reports" became "5.2.0". No code, type or schema change. Confirmed comment-only. |
| `docs/output-catalog.md` | `b71469da`, `58c5a007` | One prose paragraph under the status token table: "5.1.0" became "5.2.0" and one sentence was added (a server the reload move wrote into `mcp-adapter.json` in this session reads `not loaded` until the next `/reload`, D-05-15). The token table and every byte-locked state block are untouched. |

No other file in `covered_files` changed. `git diff aa25cd0b HEAD --stat` over `extensions/pi-claude-marketplace/{shared,edge,orchestrators}`, `index.ts`, `tests/platform`, `tests/orchestrators`, `tests/integration/mcp-status-conformance.test.ts` and `tests/integration/pi-mcp-adapter-peer.ts` is empty. Other changes in the range (`bridges/mcp/adapter-doc.ts` comment, `peer-floor`, `adapter-entry` and `mcp-override-lifecycle` tests, live-UAT files) are outside this phase's covered files and its truths.

The added catalog sentence is consistent with the code: `lookup` answers `not loaded` for a key the usable snapshot does not list, and a server written to `mcp-adapter.json` in this session is not in the adapter's snapshot until the adapter re-reads its config on `/reload`. Catalog contract and parser tests pass (below).

### Per-truth result

| # | Truth | Touched by | Result | Evidence |
|---|-------|------------|--------|----------|
| 1 | SC1/ASTAT-01 adapter state in info, no adapter import | `mcp-status.ts` comment only | VERIFIED | Code unchanged. `mcp-status.test.ts`, `info.test.ts`, `index.test.ts`, `edge/handlers/plugin/info.test.ts` pass (328/328 with the other two files). |
| 2 | SC2 lazy server shows resting state | none | VERIFIED | Untouched. `info-mcp-status.test.ts` matrix passes. |
| 3 | SC3/ASTAT-02 explicit unknown | doc paragraph (wording only) | VERIFIED | Tracker code unchanged. Platform tests pass. Conformance test with real 5.2.0 shutdown snapshot passes. Phase 7 canary (`07-VERIFICATION.md` truth 2) saw `(status unknown)` in a fresh deferred session, then `(connected)` after first MCP use on a real adapter 5.2.0 and Pi 1.0.0: this also covers the deferred-session reading (D-06-06a). |
| 4 | SC4 closed-catalog amendment, gates pass | `docs/output-catalog.md` prose | VERIFIED | Token table and byte-locked blocks identical to the baseline. `catalog-contract`, `catalog-parser`, `notify-closed-set-locks`, `closed-set-enrollment`, `notify-grammar-invariant`, `notify-stamp-coverage`, `notify-producer-wire-coverage` and related architecture tests pass (151 tests). Full gate green (below). |
| 5 | Shadow rule D-06-09 | none | VERIFIED | `info-mcp-status.ts`, `info.ts` unchanged. Info suites pass. |
| 6 | `--scope user` read-only on the project record | none | VERIFIED | Untouched. The unparseable-`state.json` test passes in `info.test.ts`. |
| 7 | Severity unchanged, no state on disabled/not-installed rows | none | VERIFIED | Untouched. Owner tests pass. |
| 8 | Prohibitions: no payload text, no stale/guessed state, no publish, no persistence | `mcp-status.ts` comment only | VERIFIED | Code unchanged. `index.test.ts` strict bus mock (only `on`) and the platform tests pass. |
| 9 | Conformance with the adapter | adapter version moved 5.1.0 to 5.2.0 | VERIFIED | Originally proven on 5.1.0. Re-run at HEAD against pi-mcp-adapter 5.2.0 (`PI_MCP_ADAPTER_ROOT=/var/tmp/mcp4-p7-research/a520/node_modules/pi-mcp-adapter`, `package.json` version `5.2.0`): 3/3 pass, 0 skipped. The channel, version and union are unchanged in 5.2.0. |
| 10 | Drift guard on status union, channel, snapshot version | adapter 5.2.0 | VERIFIED | Third conformance case passes against 5.2.0 `dist/types.d.ts`. |

Score: 10/10 still hold. No gaps. `behavior_unverified: 0`, no overrides.

### Commands run (all with `TMPDIR=/var/tmp/mcp4-reverify-p6`)

| Command | Exit | Result |
|---------|------|--------|
| `git log --oneline aa25cd0b..HEAD -- docs/output-catalog.md extensions/pi-claude-marketplace/platform/mcp-status.ts` | 0 | `b71469da`, `58c5a007` |
| `git diff aa25cd0b HEAD -- extensions/pi-claude-marketplace/platform/mcp-status.ts docs/output-catalog.md` | 0 | comment-only and prose-only, as described above |
| `PI_MCP_ADAPTER_ROOT=<5.2.0> node --test tests/integration/mcp-status-conformance.test.ts` | 0 | 3 pass, 0 fail, 0 skipped |
| `node --test tests/platform/mcp-status.test.ts tests/orchestrators/plugin/info-mcp-status.test.ts tests/orchestrators/plugin/info.test.ts tests/index.test.ts tests/edge/handlers/plugin/info.test.ts` | 0 | 328 pass, 0 fail |
| `node --test tests/architecture/{closed-set-enrollment,notify-closed-set-locks,notify-grammar-invariant,notify-stamp-coverage,notify-producer-wire-coverage}.test.ts tests/architecture/catalog-uat` | 0 | 51 pass, 0 fail |
| `node --test tests/architecture/catalog-uat/catalog-contract.test.ts tests/architecture/catalog-uat/catalog-parser.test.ts tests/architecture/{partial-vocabulary-guard,mcp-migration-notice,mcp-config-notices}.test.ts` | 0 | 100 pass, 0 fail |
| `gsd-tools query verification.fingerprint ...` | 0 | refreshed `covered_digest` (all 15 implementation, test and doc entries unchanged in the list) |

### Full-gate evidence (supplied by the orchestrator, not re-run here)

`npm run check` on HEAD `51ebbc07` (clean tree), Node v26.11.0, `PI_MCP_ADAPTER_ROOT` = pi-mcp-adapter 5.2.0, `TMPDIR=/var/tmp/mcp4-check-tmp`: exit 0 (typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, test:unpaired, test:integration, test:coverage:direct:all; merged `coverage/direct.lcov`, 269 records).

### Re-verification verdict

Status stays `passed`. The only changes were an adapter-version word in a doc comment and in one catalog paragraph, plus one added catalog sentence that matches the code. The deferred-session reading is now also evidenced by the Phase 7 live canary.

_Re-verified: see `verified:` in the frontmatter_
_Verifier: Claude (gsd-verifier)_

## Re-verification (2026-10-10)

**Scope:** scoped re-verification. Baseline `1b1e39a3`, head `3df6309c`. The earlier findings above stand and are unchanged.
**Trigger:** `verification.status` read `stale` because Phase 8 (clear milestone debt) edited covered files.

### Changed covered files since the baseline

| File | Commit | What changed (`git diff 1b1e39a3 HEAD`) |
|------|--------|------------------------------------------|
| `extensions/pi-claude-marketplace/orchestrators/plugin/info-mcp-status.ts` | `10d7cb26` | `statusToken` lost its `Object.hasOwn` fallback (review IN-01) and now returns `RUNTIME_STATUS_TOKENS[answer]` directly. The guard moved up: `platform/mcp-status.ts` `lookup` already returns only a member of the closed seven (`isRuntimeStatus`, an own-key check) or `"unrecognized"`, and the types rule out anything else. |
| `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts` | Phase 8 own-key sweep | Plugin-record reads use `ownValue(...)` (`buildBlock`, `readProjectInstallRecord`, both `withServerStatus` call sites). `withCompanionRequirements` now counts only MCP entries with no `unsupportedFeature` for the `pi-mcp-adapter` requirement, so a server a partial install leaves out needs no adapter. Doc comment updated to match. |
| `extensions/pi-claude-marketplace/platform/mcp-status.ts` | `10d7cb26` | Comment only (review IN-02): now says each server's `name` and `status` is read once and re-checked. No code change. |
| `tests/orchestrators/plugin/info-mcp-status.test.ts` | `10d7cb26` | Removed the three `constructor` / `toString` / `__proto__` reader-answer tests and the now-unused type import. The hostile-status case is still covered at the reader: `tests/platform/mcp-status.test.ts` (a status turning into `"constructor"` answers `unrecognized`). |
| `tests/integration/pi-mcp-adapter-peer.ts` | Phase 8 | Peer loader gained `mcp-auth-fetch` and `config` modules and typed interfaces for the entry conformance tests. The status conformance test's use (`types`) is unchanged. |
| `docs/output-catalog.md` | Phase 8 | Prose only, in enable, MCP override and migration sections. The status token table, `installed-with-mcp-not-loaded` and the status-bearing byte-locked states are untouched. |
| `06-REVIEW-DISPOSITION.md` | `10d7cb26` | IN-01 and IN-02 moved from `open` to `fixed`. Not a covered file. |

No other covered file changed (`edge/`, `index.ts`, `shared/notification-*.ts`, `mcp-status-conformance.test.ts`, `tests/platform/mcp-status.test.ts`).

### Per-truth result

| # | Truth | Touched by | Result | Evidence |
|---|-------|------------|--------|----------|
| 1 | SC1/ASTAT-01 adapter state in info, no adapter import | `info.ts` own-key reads | VERIFIED | Wiring unchanged: tracker -> `EdgeDeps.mcpStatus` -> handler -> `getPluginInfo` -> `withServerStatus`. The two call sites now pass `ownValue(record.plugins, plugin)`, the same record for a normal name. Info, index, handler and platform suites pass. |
| 2 | SC2 lazy server shows resting state | `info-mcp-status.ts` | VERIFIED | `RUNTIME_STATUS_TOKENS` is unchanged (`cached` -> `cached, connects on first use`, `not-connected` -> `not connected`). The `answering <answer> reads <token>` matrix passes. |
| 3 | SC3/ASTAT-02 explicit unknown | `statusToken`, `mcp-status.ts` comment | VERIFIED | `no-snapshot` and `unrecognized` still map to `status unknown`, `unlisted` to `not loaded`. The removed own-key fallback guarded an input the closed `lookup` type and `isRuntimeStatus` already exclude; the reader test with a status turning into `"constructor"` answers `unrecognized`. Conformance shutdown snapshot passes. |
| 4 | SC4 closed-catalog amendment, gates pass | `docs/output-catalog.md` prose | VERIFIED | Token table and status-bearing blocks identical to the baseline. Catalog contract, parser, closed-set, grammar, stamp, wire-coverage, partial-vocabulary, migration and config-notice suites pass (132 tests). Full gate green (below). |
| 5 | Shadow rule D-06-09 | `info.ts` own-key reads | VERIFIED | `projectOverrides` / `stampEntries` unchanged. `readProjectInstallRecord` still returns the project record for the shadow rule via `ownValue`. Fan-out, `--scope user`, disabled, different-server and no-snapshot cases pass in `info.test.ts`. |
| 6 | `--scope user` read-only on the project record | `info.ts` | VERIFIED | `loadState(..., { persistMigration: false })` inside `try`/`catch` is unchanged; only the lookups after it use `ownValue`. The unparseable-`state.json` test passes. |
| 7 | Severity unchanged, no state on disabled/not-installed rows, `(missing)` bytes kept | `withCompanionRequirements` | VERIFIED | `withMcpServerStatus` is unchanged. The companion-requirement change affects only the `requires: pi-mcp-adapter` decision (a left-out server alone no longer adds it), not severity or status stamping; the `(missing)` line bytes in the catalog are unchanged. Owner tests pass. |
| 8 | Prohibitions: no payload text, no stale/guessed state, no publish, no persistence | `mcp-status.ts` comment | VERIFIED | Code unchanged. `index.test.ts` strict bus mock (only `on`) and platform tests pass. Tokens still come only from closed maps. |
| 9 | Conformance with the adapter | `pi-mcp-adapter-peer.ts` | VERIFIED | Re-run against pi-mcp-adapter 5.2.0 (`PI_MCP_ADAPTER_ROOT=/var/tmp/mcp4-p7-research/a520/node_modules/pi-mcp-adapter`): 3/3 pass, 0 skipped. |
| 10 | Drift guard on status union, channel, snapshot version | `pi-mcp-adapter-peer.ts` | VERIFIED | Third conformance case passes against 5.2.0 `dist/types.d.ts`. |

Score: 10/10 still hold. No truth lost support. No gaps. `behavior_unverified: 0`, no overrides.

### Commands run (all with `TMPDIR=/var/tmp/mcp4-reverify-06`)

| Command | Exit | Result |
|---------|------|--------|
| `git diff --stat 1b1e39a3 HEAD -- <covered files>` | 0 | 6 covered files plus the disposition file, as in the table |
| `git diff 1b1e39a3 HEAD -- <changed covered files>` | 0 | as described above |
| `node --test tests/platform/mcp-status.test.ts tests/orchestrators/plugin/info-mcp-status.test.ts tests/orchestrators/plugin/info.test.ts tests/index.test.ts tests/edge/handlers/plugin/info.test.ts` | 0 | 329 pass, 0 fail |
| `PI_MCP_ADAPTER_ROOT=<5.2.0> node --test tests/integration/mcp-status-conformance.test.ts` | 0 | 3 pass, 0 fail, 0 skipped |
| `node --test tests/architecture/catalog-uat/{catalog-contract,catalog-parser}.test.ts tests/architecture/{closed-set-enrollment,notify-closed-set-locks,notify-grammar-invariant,notify-stamp-coverage,notify-producer-wire-coverage,partial-vocabulary-guard,mcp-migration-notice,mcp-config-notices}.test.ts` | 0 | 132 pass, 0 fail |
| `gsd-tools query verification.fingerprint ...` | 0 | refreshed `covered_digest` (same 20-entry list) |

### Full-gate evidence (supplied by the orchestrator, not re-run here)

`npm run check` on HEAD `6199bc53` or later: exit 0. Commits after it are planning-docs only.

### Re-verification verdict

Status stays `passed`. Phase 8 removed one redundant own-key fallback (the guard lives in the reader), switched record reads to `ownValue`, narrowed the adapter-requirement count to supported MCP servers, and edited catalog prose. None of the ASTAT truths lost support.

_Verifier: Claude (gsd-verifier)_
