---
phase: 01-pi-1-0-floor-and-adapter-only-detection
verified: 2026-10-10T00:00:00Z
status: passed
score: 5/5 must-haves verified
re_verification: "scoped; baseline 1b1e39a3; head 3df6309c"
covered_files:
  - .github/workflows/lint.yml
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
  - AGENTS.md
  - README.md
  - docs/workflows-compatibility.md
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
covered_digest: "v3:sha256:9540abdad5c113601b5edc70cd4398065d4c35ac210ddc0d17fc647b5541e415"
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

---

## Re-verification (2026-10-09)

**Scope:** scoped re-verification. Baseline `25c8c717` (the commit that wrote the report above), head `51ebbc07` on `features/mcp-4`. The report read `stale` because later phases of the milestone and two merges of `origin/main` edited files in its `covered_files`. The original findings above stand as written. This section judges each truth against the tree at head, as amended.

**Status:** passed, 5/5. No truth lost its support. No gap, no new human-verification item, no override.

### Changed files

Files in `covered_files` that changed between the baseline and head (`git diff --stat 25c8c717 HEAD`):

| File | What changed since the baseline |
| ---- | ------------------------------- |
| `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts` | +261 lines: MCP server lines by Claude name, unset and withheld variables, adapter status (ANAME-07, AVAR, ASTAT-01), project-override mark; main merges (#238, #246) |
| `extensions/pi-claude-marketplace/platform/pi-api.ts` | comment rename; adds the `PiEventSource` interface (ASTAT-01). `hasLoadedPiMcpAdapter` and its helpers are byte-identical |
| `extensions/pi-claude-marketplace/shared/notification-grammar.ts` | adds `appendMcpLine`, `mcpEntryText`, `variablePart`; decision-ID renames in comments. `appendRequiresLine` is unchanged |
| `package.json`, `package-lock.json` | adapter peer `>=5.0.0` -> `>=5.1.0` (D-04-12) -> `>=5.2.0 <6` (D-07-07); main's dependency bumps; `strip-json-comments`; the `check` script restructure (#236) |
| `scripts/pi.sh` | pins adapter 5.2.0 and engine 3.14.0 (#248); adds `-e builtin:tool-search` |
| `tests/architecture/peer-floor.test.ts` | adapter range assertions follow the amended floor |
| `tests/e2e/install-soft-deps.test.ts` | reads `mcp-adapter.json` under the generated Claude-name key |
| `tests/integration/pi-subagents-peer.ts` | generic identity, floor and loader code moved to `tests/integration/optional-peer.ts`; the pi-subagents API is unchanged |
| `tests/live-uat/README.md` | adds the MCP adapter canary, a 3.14.0 storage-canary run and the 3.14.0 install line; the 2026-10-02 Stop and agent-failure evidence is untouched |
| `tests/live-uat/openai-stub-server.mjs` | +119 lines: scripted plugin-MCP tool call for the new adapter canary |
| `tests/live-uat/stop-canary.mjs` | +2 lines: a no-op `events.on` on the fake Pi (ASTAT-01); assertions unchanged |

Also changed since the baseline and cited below: `README.md` (adapter floor line), `AGENTS.md` (NFR-4 value unchanged), `.github/workflows/lint.yml` (fallow SHA unchanged). Unchanged since the baseline: `shared/concerns/soft-dep.ts`, `shared/notify-context.ts`, `tests/e2e/_rpc.ts`, `tests/e2e/adapter-detection-rpc.test.ts`, `tests/platform/pi-api.test.ts`.

### Per-truth result

| # | Truth (as amended) | Touched by | Result | Evidence |
| - | ------------------ | ---------- | ------ | -------- |
| 1 | Peer floor `>=1.0.0`, dev deps `^1.0.0`, FLOOR-01 pins the literal, `npm run check` passes with the typing and peer-test fixes (PIFL-01, PIFL-04) | `package.json`, `package-lock.json`, `peer-floor.test.ts` | VERIFIED (amended: the type-member pins gate was removed upstream) | `package.json` peer `@earendil-works/pi-coding-agent` is `>=1.0.0`, devDependencies are `^1.0.0` for it and for `pi-tui`; the lock holds 1.0.0 for both and its root peers mirror `package.json`. `peer-floor.test.ts` runs green. The orchestrator's `npm run check` on head exits 0. The `lint:type-members` gate this report cited no longer exists: main's #236 deleted `scripts/check-unused-type-members.*` and its `package.json` entries (quick task 261004-u7n removed the gate), so the "pins re-derived" clause is superseded, not broken. `typecheck` inside `npm run check` passes against Pi 1.0 types. |
| 2 | devDependencies latest except TypeScript `^6.0.3`; `no-unsafe-enum-assignment` fixed in code; fallow action SHA matches fallow; `engines.node` and NFR-4 agree (PIFL-05, PIFL-06) | `package.json`, `package-lock.json`; `lint.yml` (not covered, read for the SHA) | VERIFIED | Lock: fallow 3.31.0, prettier 3.9.9, typescript-eslint 8.71.0, sonarjs 4.2.2, globals 17.13.0, import-x 4.17.1, typescript 6.0.3. `lint.yml` still pins `fallow-rs/fallow@71369f80... # v3.31.0`. `engines.node` is `^22.22.2 \|\| ^24.15.0 \|\| >=26.0.0` in `package.json` and the lock root; `AGENTS.md:59` and `.planning/PROJECT.md:946` state the same NFR-4 value. No `eslint-disable` or config override in `extensions`, `tests` or `eslint.config.js` names `no-unsafe-enum-assignment`. Lint is part of the green full gate. |
| 3 | pi-subagents `>=0.74.0` and pi-mcp-adapter optional peers, adapter not a devDependency, both pi-subagents peer tests run zero-skip at 0.74.0 via `PI_SUBAGENTS_ROOT`, README states the adapter floor (PIFL-02, PIFL-03; amended by D-04-12 to 5.1.0 and by D-07-07 to `>=5.2.0 <6`; README drops the peer-gap line) | `package.json`, `package-lock.json`, `peer-floor.test.ts`, `pi-subagents-peer.ts`, `README.md` | VERIFIED as amended | Peers at head: pi-subagents `>=0.74.0`, pi-mcp-adapter `>=5.2.0 <6`, both `optional: true` in `peerDependenciesMeta`; the adapter is absent from dependencies, devDependencies and lock packages. `peer-floor.test.ts` asserts `>=5.2.0 <6` and the lock mirror, and passes. `README.md:40-42` states "5.2.0 or a later 5.x release" and "Pi's built-in MCP support does not satisfy this requirement"; the `pi-ai` peer-gap line is gone, as D-04-12 says. Own run: scratch `pi-subagents@0.74.0`, `PI_SUBAGENTS_ROOT=...`, `provenance-invisibility` and `skill-path-resolution`: pass 2, fail 0, skipped 0, diagnostic "pi-subagents 0.74.0". The loader refactor into `optional-peer.ts` kept the public functions and behavior. |
| 4 | Stop canary and workflow-engine canary pass live on Pi 1.0; `scripts/pi.sh` pins the three versions (PIFL-07; engine amended 3.13.1 -> 3.14.0 by quick task 261006-kr1 / PR #248; adapter 5.0.0 -> 5.2.0 by D-04-12 and D-07-07) | `scripts/pi.sh`, `tests/live-uat/README.md`, `stop-canary.mjs`, `openai-stub-server.mjs` | VERIFIED as amended; live canaries not re-run | `scripts/pi.sh:111-115` pins `pi-mcp-adapter@5.2.0`, `pi-subagents@0.74.0`, `@quintinshaw/pi-dynamic-workflows@3.14.0`; `bash -n scripts/pi.sh` exits 0; it adds `-e builtin:tool-search` with the reason in a comment. The live-uat README keeps the verbatim 2026-10-02 pi 1.0.0 evidence: agent-failure canary (line 118, engine 3.13.1) and Stop canary (line 382: `pi exited with code 0`, exactly 8 blocks, exit 1 through the documented cap-trip routing, plus the exit-2 regression control at line 413). The engine move is recorded by a storage-canary run at engine 3.14.0 dated 2026-10-06 (line 211: W0 to W5 for both scopes, "all assertions proven; exit 0"). The `stop-canary.mjs` diff only adds a no-op `events.on` to the fake Pi, so its assertions are unchanged. `docs/workflows-compatibility.md` grades 3.14.0 as runtime-measured and tells readers to use 3.14.0 or newer. The agent-failure canary has no 3.14.0 run recorded; the 3.14.0 change is the storage root and result delivery (engine PRs #232, #238), which the storage canary covers. I ran no live canary (the brief bans `pi.sh`, `pi` and live canaries). |
| 5 | With only Pi's built-in MCP active, install, list and info mark MCP as needing pi-mcp-adapter, proven by a built-in-only negative test; an adapter with `disableProxyTool` or from a fork is detected via its `mcp-adapter` command (ADET-01, ADET-02) | `platform/pi-api.ts`, `notification-grammar.ts`, `info.ts`, `install-soft-deps.test.ts` | VERIFIED | `hasLoadedPiMcpAdapter` at head is unchanged: it counts an extension command named `mcp-adapter[:n]` or an adapter `sourceInfo.source`; a bare `mcp` tool and Pi's built-in MCP do not count; each arm is guarded alone. `appendRequiresLine` (`notification-grammar.ts:1415-1428`) and `withCompanionRequirements` / `softDepStatus(opts.pi)` (`info.ts:2972,3090`) are intact. The info MCP changes add a separate `mcp:` line beside `requires:`. The only edit to `install-soft-deps.test.ts` is the on-disk key it reads (`mcp-adapter.json`, generated Claude-name key); every matrix case still asserts the marker. Own e2e run against the real Pi 1.0 CLI: 15/15 pass, 0 skipped, including built-in only, built-in disabled, `disableProxyTool` command-only, fork, `mcp-adapter:1/:2` and the foreign `mcp` tool. Unit suites: 411 pass, 0 fail. |

**Score:** 5/5 truths verified, 0 behavior-unverified.

### Commands run

All runs used `TMPDIR=/var/tmp/mcp4-reverify-p1`. Nothing could write the real `~/.pi/agent`: the repo tests use hermetic homes, and no `pi`, `scripts/pi.sh` or live canary ran.

| Command | Exit | Result |
| ------- | ---- | ------ |
| `git log --oneline 25c8c717..HEAD -- <file>` and `git diff` / `git diff --stat 25c8c717 HEAD` over the 12 listed files plus `soft-dep.ts`, `notify-context.ts`, `_rpc.ts`, `adapter-detection-rpc.test.ts`, `pi-api.test.ts`, `README.md`, `AGENTS.md`, `lint.yml` | 0 | full diffs read for `pi-api.ts`, `package.json`, `scripts/pi.sh`, `peer-floor.test.ts`, `install-soft-deps.test.ts`, `stop-canary.mjs`, `pi-subagents-peer.ts`, `notification-grammar.ts`, `README.md`, `AGENTS.md`, `lint.yml`; `info.ts` and the live-uat README read selectively |
| `node --test tests/platform/pi-api.test.ts tests/architecture/peer-floor.test.ts tests/shared/concerns/soft-dep.test.ts tests/shared/notification-grammar.test.ts tests/orchestrators/plugin/info.test.ts` | 0 | tests 411, pass 411, fail 0, skipped 0 |
| `PI_CM_E2E_REF=pinned node --test tests/e2e/adapter-detection-rpc.test.ts tests/e2e/install-soft-deps.test.ts` (works offline here) | 0 | tests 15, pass 15, fail 0, skipped 0 |
| `npm install --prefix /var/tmp/mcp4-reverify-p1/subagents pi-subagents@0.74.0 --ignore-scripts --omit=peer --no-audit --no-fund` | 0 | 0.74.0 in a scratch prefix outside the repo; the global peer is 0.47.1, so without it the peer tests would skip |
| `PI_SUBAGENTS_ROOT=/var/tmp/mcp4-reverify-p1/subagents/node_modules/pi-subagents node --test tests/integration/provenance-invisibility.test.ts tests/integration/skill-path-resolution.test.ts` | 0 | tests 2, pass 2, fail 0, skipped 0, "pi-subagents 0.74.0" |
| `bash -n scripts/pi.sh` | 0 | syntax ok |
| `node --check tests/live-uat/stop-canary.mjs` | 0 | syntax ok |
| `node .claude/gsd-core/bin/gsd-tools.cjs query verification.fingerprint <phase dir> <files>` | 0 | `covered_files` and `covered_digest` in the frontmatter copied verbatim |

`PI_MCP_ADAPTER_ROOT` pointed at the 5.2.0 install for the unit and e2e runs; none of the targeted files needs it.

### Full-gate evidence

The orchestrator ran `npm run check` on HEAD `51ebbc07` (clean tree) in this session: Node v26.11.0, `PI_MCP_ADAPTER_ROOT` = pi-mcp-adapter 5.2.0, `TMPDIR=/var/tmp/mcp4-check-tmp`. Exit 0: typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, test:unpaired, test:integration, test:coverage:direct:all (merged `coverage/direct.lcov`, 269 records). Cited, not re-run.

### Notes

- ROADMAP success criterion 4 still names adapter 5.0.0 and engine 3.13.1 in its text. Criterion 3 carries the inline "amended by D-04-12 / D-07-07" note; criterion 4 does not. The pins moved by recorded decisions (D-04-12, D-07-07, quick task 261006-kr1), so it is judged as amended. The ROADMAP line could carry the same inline note. Documentation residue only.
- The earlier `.planning/PROJECT.md` warning (old `{requires pi-mcp}` token at the former lines 883 and 885) was not re-checked. That file carries uncommitted orchestrator edits, and the brief says to ignore them.
- `human_verification`: none before, none now.

_Re-verified: 2026-10-09_
_Verifier: Claude (gsd-verifier)_

---

## Re-verification (2026-10-10)

**Scope:** scoped re-verification. Baseline `1b1e39a3` (the commit that last wrote this report), head `3df6309c` on `features/mcp-4`. The report read `stale` because Phase 8 (clear milestone debt) edited files in its `covered_files`. Earlier sections stand as written. This section judges each truth against the tree at head, as amended (ROADMAP Phase 1 criterion 4 and PIFL-07 now carry the D-04-12, D-07-07 and quick task 261006-kr1 notes).

**Status:** passed, 5/5. No truth lost its support. No gap, no new human-verification item, no override.

### Changed files

Files in `covered_files` that changed between the baseline and head (`git diff --stat 1b1e39a3 HEAD`):

| File | What changed since the baseline |
| ---- | ------------------------------- |
| `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts` | own-key reads of install records through `ownValue` (D-08-07); `withCompanionRequirements` now counts only MCP servers that the install writes (`unsupportedFeature === undefined`), so a server a partial install leaves out no longer asks for the adapter |
| `extensions/pi-claude-marketplace/shared/notify-context.ts` | `dispatchRow` casts the selected render arm once, to `RenderFn<PluginNotificationMessage>`, instead of casting twice; same runtime behavior |
| `extensions/pi-claude-marketplace/platform/pi-api.ts` | comment reflow on `hasLoadedPiMcpAdapter`; code unchanged |
| `README.md` | pi-subagents line states 0.74.0 (closes review IN-03); MCP naming and agent-conversion prose; adapter floor line (5.2.0 or a later 5.x) unchanged |
| `scripts/pi.sh` | default-home session dir: a pre-set `PI_CODING_AGENT_SESSION_DIR` is kept when the home is the default; help text; the three pins are unchanged (adapter 5.2.0, pi-subagents 0.74.0, engine 3.14.0) |
| `tests/e2e/adapter-detection-rpc.test.ts` | `inventoryEntries` fails on a non-array inventory field instead of returning `[]`; `readPid` rejects a non-positive or non-integer PID; the group-sentinel case registers cleanup only when the PID file exists |
| `tests/live-uat/openai-stub-server.mjs` | request and server `error` handlers |
| `tests/live-uat/stop-canary.mjs` | `getCommands: () => []` on the fake Pi; a comment on the repeated spawn block; assertions unchanged |

Unchanged since the baseline (diff empty): `package.json`, `package-lock.json`, `AGENTS.md`, `.github/workflows/lint.yml`, `shared/concerns/soft-dep.ts`, `shared/notification-grammar.ts`, `tests/architecture/peer-floor.test.ts`, `tests/e2e/_rpc.ts`, `tests/e2e/install-soft-deps.test.ts`, `tests/integration/pi-subagents-peer.ts`, `tests/live-uat/README.md`, `tests/platform/pi-api.test.ts`, `docs/workflows-compatibility.md`.

### Per-truth result

| # | Truth (as amended) | Touched by | Result | Evidence |
| - | ------------------ | ---------- | ------ | -------- |
| 1 | Peer floor `>=1.0.0`, dev deps `^1.0.0`, FLOOR-01 pins the literal, `npm run check` passes (PIFL-01, PIFL-04) | none of its files | VERIFIED | `package.json` and the lock are byte-identical to the baseline; peers read `@earendil-works/pi-coding-agent >=1.0.0`, devDependency `^1.0.0`. `peer-floor.test.ts` passes. The orchestrator's `npm run check` on HEAD `6199bc53`+ exited 0 (later commits are planning docs). The `lint:type-members` pins clause stays superseded as recorded on 2026-10-09. |
| 2 | devDependencies latest except TypeScript `^6.0.3`; rule fixed in code; fallow action SHA matches; `engines.node` and NFR-4 agree (PIFL-05, PIFL-06) | `notify-context.ts` (the `dispatchRow` cast) | VERIFIED | `package.json`, lock, `lint.yml` and `AGENTS.md` unchanged; `engines.node` is `^22.22.2 \|\| ^24.15.0 \|\| >=26.0.0`. The `dispatchRow` edit still reads the render map through a `Readonly<Record<string, unknown>>` view and adds one cast with a stated reason; no `eslint-disable` was added. Lint is part of the green full gate. `notify-context` tests pass. |
| 3 | pi-subagents `>=0.74.0` and pi-mcp-adapter optional peers (amended: adapter `>=5.2.0 <6`), adapter not a devDependency, both pi-subagents peer tests run zero-skip at 0.74.0, README states the adapter floor (PIFL-02, PIFL-03) | `README.md` | VERIFIED as amended | `package.json` unchanged: `pi-subagents >=0.74.0`, `pi-mcp-adapter >=5.2.0 <6`, both optional. `README.md` still states "5.2.0 or a later 5.x release" and that Pi's built-in MCP does not satisfy it; it now also states pi-subagents 0.74.0 or newer. Own run with `PI_SUBAGENTS_ROOT` at 0.74.0: pass 2, fail 0, skipped 0. |
| 4 | Stop canary and workflow-engine canary pass live on Pi 1.0; `scripts/pi.sh` pins the three versions (PIFL-07, amended: adapter 5.2.0, engine 3.14.0) | `scripts/pi.sh`, `stop-canary.mjs`, `openai-stub-server.mjs` | VERIFIED as amended; live canaries not re-run | The pins at `scripts/pi.sh:111-115` are unchanged. The Phase 8 edit changes only where the default home keeps its session dir; `bash -n` exits 0. The canary edits add a `getCommands` stub on the fake Pi (the factory now reads the command list) and error handlers on the stub server; `node --check` passes on both and no canary assertion changed. The recorded live evidence in `tests/live-uat/README.md` is untouched. I ran no live canary and no `pi` or `scripts/pi.sh` (the brief bans them). |
| 5 | With only Pi's built-in MCP active, install, list and info mark MCP as needing pi-mcp-adapter, proven by a built-in-only negative test; `disableProxyTool` and fork adapters are detected through their `mcp-adapter` command (ADET-01, ADET-02) | `info.ts`, `pi-api.ts`, `adapter-detection-rpc.test.ts`, `notify-context.ts` | VERIFIED | `hasLoadedPiMcpAdapter` is code-identical (comment reflow only). In `info.ts` the `requires:` line is still stamped by `withCompanionRequirements` from the one `softDepStatus` snapshot; the new condition only drops servers that a partial install leaves out, which is correct (nothing writes them, so nothing needs the adapter) and leaves every installable server's marker intact. The e2e harness got stricter (a non-array inventory and an empty PID now fail instead of passing silently), so the 15/15 result is a stronger proof than before. Own run against the real Pi 1.0 CLI: 15/15 pass, 0 skipped, covering built-in only, built-in disabled, `disableProxyTool` command-only, fork, `mcp-adapter:1/:2`, a foreign `mcp` tool. Unit suites: 448 pass, 0 fail. |

**Score:** 5/5 truths verified, 0 behavior-unverified.

### Commands run

All runs used `TMPDIR=/var/tmp/mcp4-reverify-p1`. The tests use hermetic homes; no `pi`, `scripts/pi.sh` or live canary ran, and the real `~/.pi/agent` was neither read nor written.

| Command | Exit | Result |
| ------- | ---- | ------ |
| `git diff --stat 1b1e39a3 HEAD -- <covered files>` and `git diff` over the eight changed files plus `README.md` | 0 | 8 files changed (85 insertions, 39 deletions); full diffs read |
| `node --test tests/platform/pi-api.test.ts tests/architecture/peer-floor.test.ts tests/shared/concerns/soft-dep.test.ts tests/shared/notification-grammar.test.ts tests/orchestrators/plugin/info.test.ts tests/shared/notify-context.test.ts tests/shared/own-key.test.ts` | 0 | tests 448, pass 448, fail 0, skipped 0 |
| `PI_CM_E2E_REF=pinned node --test tests/e2e/adapter-detection-rpc.test.ts tests/e2e/install-soft-deps.test.ts` | 0 | tests 15, pass 15, fail 0, skipped 0 |
| `PI_SUBAGENTS_ROOT=/var/tmp/mcp4-reverify-p1/subagents/node_modules/pi-subagents node --test tests/integration/provenance-invisibility.test.ts tests/integration/skill-path-resolution.test.ts` | 0 | tests 2, pass 2, fail 0, skipped 0, "pi-subagents 0.74.0" |
| `bash -n scripts/pi.sh`; `node --check` on `stop-canary.mjs` and `openai-stub-server.mjs` | 0 | syntax ok |
| `node .claude/gsd-core/bin/gsd-tools.cjs query verification.fingerprint <phase dir> <files>` | 0 | `covered_files` and `covered_digest` in the frontmatter copied verbatim |

Full gate: the orchestrator's `npm run check` on HEAD `6199bc53`+ exited 0 (cited, not re-run).

_Re-verified: 2026-10-10_
_Verifier: Claude (gsd-verifier)_
