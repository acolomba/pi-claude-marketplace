---
phase: 01-pi-1-0-floor-and-adapter-only-detection
verified: 2026-10-03T02:00:00Z
status: passed
score: 5/5 must-haves verified
covered_files:
  - .planning/phases/01-pi-1-0-floor-and-adapter-only-detection/01-01-PLAN.md
  - .planning/phases/01-pi-1-0-floor-and-adapter-only-detection/01-01-SUMMARY.md
  - .planning/phases/01-pi-1-0-floor-and-adapter-only-detection/01-02-PLAN.md
  - .planning/phases/01-pi-1-0-floor-and-adapter-only-detection/01-02-SUMMARY.md
  - .planning/phases/01-pi-1-0-floor-and-adapter-only-detection/01-03-PLAN.md
  - .planning/phases/01-pi-1-0-floor-and-adapter-only-detection/01-03-SUMMARY.md
  - .planning/phases/01-pi-1-0-floor-and-adapter-only-detection/01-04-PLAN.md
  - .planning/phases/01-pi-1-0-floor-and-adapter-only-detection/01-04-SUMMARY.md
  - .planning/phases/01-pi-1-0-floor-and-adapter-only-detection/01-05-PLAN.md
  - .planning/phases/01-pi-1-0-floor-and-adapter-only-detection/01-05-SUMMARY.md
  - .planning/phases/01-pi-1-0-floor-and-adapter-only-detection/01-06-PLAN.md
  - .planning/phases/01-pi-1-0-floor-and-adapter-only-detection/01-06-SUMMARY.md
  - .planning/phases/01-pi-1-0-floor-and-adapter-only-detection/01-07-PLAN.md
  - .planning/phases/01-pi-1-0-floor-and-adapter-only-detection/01-07-SUMMARY.md
  - .planning/phases/01-pi-1-0-floor-and-adapter-only-detection/01-08-PLAN.md
  - .planning/phases/01-pi-1-0-floor-and-adapter-only-detection/01-08-SUMMARY.md
  - .planning/phases/01-pi-1-0-floor-and-adapter-only-detection/01-09-PLAN.md
  - .planning/phases/01-pi-1-0-floor-and-adapter-only-detection/01-09-SUMMARY.md
  - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
  - extensions/pi-claude-marketplace/platform/pi-api.ts
  - extensions/pi-claude-marketplace/shared/concerns/soft-dep.ts
  - extensions/pi-claude-marketplace/shared/notification-grammar.ts
  - extensions/pi-claude-marketplace/shared/notify-context.ts
  - package-lock.json
  - package.json
  - scripts/pi.sh
  - tests/architecture/peer-floor.test.ts
  - tests/e2e/_rpc.ts
  - tests/e2e/adapter-detection-rpc.test.ts
  - tests/e2e/install-soft-deps.test.ts
  - tests/integration/pi-subagents-peer.ts
  - tests/live-uat/README.md
  - tests/live-uat/openai-stub-server.mjs
  - tests/live-uat/stop-canary.mjs
  - tests/platform/pi-api.test.ts
covered_digest: "v2:sha256:02d77bb47e40a2fd76011a10827e03659e3b95c2dd3c905d4b0884463fce7be5"
behavior_unverified: 0
overrides_applied: 0
---

# Phase 1: Pi 1.0 floor and adapter-only detection Verification Report

**Phase Goal:** A user on Pi 1.0 can install the extension and every existing feature still works there. A plugin's MCP component reports pi-mcp-adapter as missing unless the adapter itself is loaded, even when Pi's built-in MCP is active.
**Verified:** 2026-10-03
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths (ROADMAP success criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Peer floor `>=1.0.0`, dev deps `^1.0.0` for pi-coding-agent and pi-tui, FLOOR-01 pins the literal; `npm run check` passes with the 0.99 typing/peer-test fixes re-implemented and `types.d.ts` pins re-derived (PIFL-01, PIFL-04) | VERIFIED | `package.json` peer `>=1.0.0`, devDeps `^1.0.0`; lock and `node_modules` hold 1.0.0 for both. `tests/architecture/peer-floor.test.ts` asserts `">=1.0.0"` and lock sync. `npm run lint:type-members` re-run on the post-review tree: "Unused type member gate passed" (pins now point at Pi 1.0 `types.d.ts:525`). Orchestrator gate `npm run check` CHECK_EXIT=0 (tmp/phase1-gate-check.log:11201). Shared `tests/platform/pi-inventory-seed.ts` carries `exposure: "direct"`. |
| 2 | Every devDependency latest except TypeScript `^6.0.3`; `no-unsafe-enum-assignment` fixed in code; fallow action SHA matches bumped fallow; `engines.node` is the real floor and NFR-4 agrees in AGENTS.md and PROJECT.md (PIFL-05, PIFL-06) | VERIFIED | Lock versions match the approved set (fallow 3.31.0, prettier 3.9.9, typescript-eslint 8.71.0, sonarjs 4.2.2, globals 17.13.0, import-x 4.17.1). `lint.yml:56` pins `fallow-rs/fallow@71369f80... # v3.31.0`. `dispatchRow` reads the render map through a `Readonly<Record<string, unknown>>` view; no `eslint-disable` or config override mentions the rule. `engines.node` = `^22.22.2 \|\| ^24.15.0 \|\| >=26.0.0` in package.json, lock root, AGENTS.md:59, PROJECT.md:893, PRD NFR-4 row, STACK.md. Note: `npm outdated` now shows eslint 10.12.0, published 2026-10-02T20:08Z, after the bump commit (16:33Z); not a gap. |
| 3 | pi-subagents `>=0.74.0` and pi-mcp-adapter `>=5.0.0` optional peers, adapter not a devDependency; both pi-subagents peer tests run zero-skip against 0.74.0 via `PI_SUBAGENTS_ROOT`; README states adapter floor and `pi-ai` gap (PIFL-02, PIFL-03) | VERIFIED | `peerDependenciesMeta` marks both optional; peer-floor tests assert adapter absent from dependencies, devDependencies and lock packages. Independent run: installed pi-subagents@0.74.0 into a scratch prefix, `PI_SUBAGENTS_ROOT=... node --test provenance-invisibility + skill-path-resolution` gives pass 2, fail 0, skipped 0, diagnostic "pi-subagents 0.74.0". Floor is `semver.minVersion` of the declared peer (IN-05), `PI_SUBAGENTS_ROOT` that names nothing or another package throws (IN-07). README:40-42 states adapter 5.0.0+, that built-in MCP does not satisfy it, and the upstream `pi-ai` peer gap. |
| 4 | Stop canary (re-run) and workflow-engine canaries pass live on Pi 1.0 with engine 3.13.1; `scripts/pi.sh` pins adapter 5.0.0, pi-subagents 0.74.0, engine 3.13.1 (PIFL-07) | VERIFIED | `scripts/pi.sh:106-108` pins the three versions; `bash -n` ok. `tests/live-uat/README.md` records verbatim 2026-10-02 runs on pi 1.0.0: agent-failure canary A0-A3 PASS at engine 3.13.1 plus `--invert` control exit 1; storage canary W0-W5 for both scopes, exit 0, plus controls; Stop canary on the keyless stub (8 blocks, 8 `agent_settled`, pi exit code 0) with both refuse-controls and the exit-2 regression control. The Stop canary's exit 1 is its documented, expected headless routing (cap-trip warning needs `ctx.ui.notify`, which print mode no-ops), kept apart from exit 2 per IN-10. `docs/workflows-compatibility.md` re-graded to 3.13.1. Live canaries were not re-run by the verifier (instructed). |
| 5 | With only Pi's built-in MCP active, install, list and info mark MCP as needing pi-mcp-adapter, proven by a built-in-only negative test; adapter with `disableProxyTool` or from a fork still detected via its `mcp-adapter` command (ADET-01, ADET-02) | VERIFIED | `platform/pi-api.ts` `hasLoadedPiMcpAdapter`: extension command named `mcp-adapter[:n]` or adapter `sourceInfo.source`; bare `mcp` tool no longer counts; each arm guarded separately. Review fix WR-01 restricts to `source === "extension"`. Re-ran `tests/e2e/adapter-detection-rpc.test.ts` + `install-soft-deps.test.ts` against the real Pi 1.0 CLI: 15/15 pass, 0 skipped (built-in only, built-in disabled, command-only/`disableProxyTool`, fork, `mcp-adapter:1/:2`, foreign `mcp` tool). Unit/grammar/info suites (382 tests) pass. Old token absent: only `.planning/PROJECT.md:883,885` still carry `{requires pi-mcp}` (see Anti-Patterns). Info `requires:` line implemented (`notification-grammar.ts:1375-1388`, `info.ts:2905`) and catalogued (`docs/output-catalog.md:2559-2676`). |

**Score:** 5/5 truths verified (0 behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `package.json` / `package-lock.json` | floors, optional peers, engines | VERIFIED | values above; lock root mirrors peers and engines |
| `platform/pi-api.ts` | adapter-only probe | VERIFIED | substantive, wired through `softDepStatus` to notification dispatch and info |
| `shared/concerns/soft-dep.ts`, `notification-grammar.ts`, `notification-types.ts` | `{requires pi-mcp-adapter}` marker, info `requires:` | VERIFIED | token renamed everywhere in source, tests and docs (46 files name the new token) |
| `tests/e2e/_rpc.ts`, `adapter-detection-rpc.test.ts` | real-Pi RPC proof | VERIFIED | ran, 7/7 pass; evidence checks added by WR-02/WR-03 fixes |
| `tests/integration/pi-subagents-peer.ts` | shared loader, floor from package.json | VERIFIED | used by both peer tests |
| `tests/live-uat/stop-canary.mjs`, `openai-stub-server.mjs`, `README.md` | re-run canary, stub, evidence | VERIFIED | fallow marker on stub; evidence blocks end in an exit line |
| `scripts/pi.sh` | pins and private Pi home | VERIFIED | CR-01 fix (cd50c39b) defaults the home to `<prefix>/home` |

### Key Link Verification

| From | To | Via | Status |
|------|----|-----|--------|
| `softDepStatus(pi)` | install/list rows | `notification-dispatch.ts` probe snapshot, rendered by grammar | WIRED (e2e matrix proves end to end on real Pi) |
| `softDepStatus(pi)` | info `requires:` line | `orchestrators/plugin/info.ts` stamps entries, renderer formats | WIRED |
| peer test floor | `package.json` peer range | `readPeerFloor()` (`semver.minVersion`) | WIRED |
| `peer-floor.test.ts` | `package.json` and lock | `PACKAGE_JSON_REL` / `PACKAGE_LOCK_REL` | WIRED |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Real-Pi adapter detection matrix | `PI_CM_E2E_REF=pinned node --test tests/e2e/adapter-detection-rpc.test.ts tests/e2e/install-soft-deps.test.ts` | 15 pass, 0 fail, 0 skipped | PASS |
| Probe, peer floor, soft-dep, grammar, info suites | `node --test tests/platform/pi-api.test.ts tests/architecture/peer-floor.test.ts tests/shared/concerns/soft-dep.test.ts tests/shared/notification-grammar.test.ts tests/orchestrators/plugin/info.test.ts` | 382 pass, 0 fail | PASS |
| pi-subagents zero-skip at 0.74.0 | scratch `npm install pi-subagents@0.74.0`, `PI_SUBAGENTS_ROOT=... node --test` on the two peer tests | 2 pass, 0 skipped | PASS |
| Type-member contract pins | `npm run lint:type-members` | gate passed, 4 recorded exceptions | PASS |
| `scripts/pi.sh` syntax | `bash -n scripts/pi.sh` | ok | PASS |

The full `npm run check` and `npm run test:e2e` were not re-run; the orchestrator's logs show CHECK_EXIT=0 and E2E_EXIT=0 on the post-plan tree, and the review-fix commits (probe `source === "extension"`, e2e evidence checks, `pi.sh`, peer-floor optional assertion) were covered by the targeted re-runs above.

### Probe Execution

SKIPPED -- the phase declares no `probe-*.sh` scripts.

### Requirements Coverage

| Requirement | Source Plan(s) | Status | Evidence |
|-------------|----------------|--------|----------|
| PIFL-01 | 01-01 | SATISFIED | Truth 1 |
| PIFL-02 | 01-01, 01-03 | SATISFIED | Truth 3 (own zero-skip run) |
| PIFL-03 | 01-01 | SATISFIED | Truth 3 |
| PIFL-04 | 01-01, 01-03 | SATISFIED | Truth 1 (pins gate passes; peer fixes in shared loader) |
| PIFL-05 | 01-01 | SATISFIED | Truth 2 |
| PIFL-06 | 01-01 | SATISFIED | Truth 2 |
| PIFL-07 | 01-09 | SATISFIED | Truth 4 |
| ADET-01 | 01-04, 01-05, 01-06, 01-07, 01-08 | SATISFIED | Truth 5 |
| ADET-02 | 01-02, 01-05, 01-06, 01-08 | SATISFIED | Truth 5 |

All nine IDs appear in at least one PLAN `requirements:` field; no orphaned requirement. REQUIREMENTS.md marks all nine Complete and carries the D-01-05 and D-01-18 amendments.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `.planning/PROJECT.md` | 883, 885 | Still states the old detection rule ("probed via `mcp` tool name OR ...") and the old `{requires pi-mcp}` token | Warning | D-01-20 intended no document to keep the old detection rule. Planning-doc residue only; no code or user-facing doc affected. Fix with a one-line edit. |
| `tests/integration/pi-subagents-peer.ts` / peer tests | -- | `TODO` about CI never installing pi-subagents | Info | Note about a known CI gap (the peer tests skip in CI), not an unreferenced debt marker (`TBD`/`FIXME`/`XXX`). No `TBD`/`FIXME`/`XXX` found in changed files. |
| `README.md` | 39 | pi-subagents line does not state the new 0.74.0 floor (review IN-03, open) | Info | PIFL-02/03 do not require it; adapter floor is stated. |
| `.planning/phases/01-.../01-REVIEW-DISPOSITION.md` | -- | 11 Info findings (IN-01..IN-11) left open, e.g. three local `toolInfo` helpers remain (IN-05) | Info | Recorded and non-blocking; none breaks a must-have. |
| `tests/live-uat/README.md` | -- | Stop human-checklist wording predates the headless cap drive (deferred-items.md) | Info | Wording only; STOP-07 cap-trip warning remains an interactive item from an earlier milestone, outside this phase's requirements. |

### Human Verification Required

None. The Stop canary's cap-trip warning item is a pre-existing interactive checklist entry that this phase did not introduce and that PIFL-07 does not require.

### Gaps Summary

No gaps. The phase goal holds in the codebase: the extension declares and runs against Pi 1.0 (typecheck, lint, pins gate, real-Pi smoke and RPC e2e all green), and the MCP soft dependency is satisfied only by the adapter's own extension command or source, with Pi's built-in MCP and a foreign `mcp` tool verified as "missing" on real Pi 1.0 for install, list and info. One warning for the operator: update `.planning/PROJECT.md` lines 883 and 885 to the new detection rule and `{requires pi-mcp-adapter}` token.

---

_Verified: 2026-10-03_
_Verifier: Claude (gsd-verifier)_
