---
status: resolved
---

# GSD Debug Knowledge Base

Resolved debug sessions. Used by `gsd-debugger` to surface known-pattern hypotheses at the start of new investigations.

`status: resolved` is bookkeeping, not a session state: `audit-open` treats every
top-level `.md` under `.planning/debug/` as a debug session, and this file is the
knowledge base itself. The marker keeps it out of the open-session count.

---

## test-suite-hang-phase79 — npm run check hangs indefinitely with a varying stall point after auth threading
- **Date:** 2026-07-11
- **Error patterns:** npm run check hang, node --test never exits, varying stall point, test suite hang, ref'd timer, device flow poll loop, sleepMs, high concurrency race, worker event loop kept alive
- **Root cause:** The test mock `makeMockDeviceFlowHttp` (tests/helpers/device-flow-mock.ts) defaulted `deviceCode.interval` to 5, contradicting its own header comment (tests use `interval: 0` to spin the poll loop synchronously). A test that drove `onAuthRequired()` without an explicit `deviceCode` inherited `interval: 5`, so `runPollLoop` in domain/github-auth.ts fired a REAL, ref'd `sleepMs(5000ms)` (node:timers/promises) before consuming the queued result. The ref'd timer held an isolated node:test worker's event loop alive; under the saturated 16-way `npm run check` pool this intermittently pushed the run past the timeout and, with poll-loop scheduling variability, surfaced as an indefinite hang with a varying stall point. Serial and low-concurrency runs passed, which is the signature of a high-concurrency real-timer/handle race (not a deterministic single-file leak).
- **Fix:** Changed the mock default `deviceCode.interval` from 5 to 0, aligning it with the helper's documented intent. Removes the accidental real sleep and hardens every future test that drives the poll loop without an explicit deviceCode. No `--test-force-exit` band-aid. Byte-frozen device-flow tests unaffected (they override deviceCode explicitly or never reach runPollLoop).
- **Files changed:** tests/helpers/device-flow-mock.ts
---

## disabled-partial-record-unrecognized — disabling a partially installed plugin produces a record no surface recognizes as disabled
- **Date:** 2026-08-07 diagnosed, 2026-08-09 fixed, 2026-08-11 live-verified
- **Error patterns:** disable has no effect, plugin still shows as installed after disable, enable reports already enabled, disable is not idempotent, reconcile re-plans a disable forever, update re-stages a disabled plugin, silently wrong branch with no error
- **Root cause:** The disabled-detection predicate `compatibility.installable && !enabled` was duplicated across four files (plugin-state-classifier.ts, enable-disable.ts, reconcile/plan.ts, plugin/update.ts). It was written when `installable: false` implied soft-degradation, a state the disable orchestrator was assumed never to produce. Partial installs broke that assumption: a partial install always persists `installable: false`, and the disable path has no `installable` gate, so disabling a partially installed plugin writes a record whose two fields make it invisible to every consumer. Because `installable: true` had become equivalent to an empty `unsupported` set, the conjunct excluded exactly one shape — the partial-disabled record — and nothing else. Five surfaces then took a silently wrong branch, with zero errors, which is why it went unnoticed. Latent since partial installs landed.
- **Fix:** Collapsed the four copies into one definition, `isRecordedButDisabled` in persistence/state-io.ts, keyed only on `enabled`. The dropped conjunct was not load-bearing: `enabled: false` is written only by the disable orchestrator, and the schema migration backfills `enabled: true` for legacy records. The truth-table cell that had pinned the wrong behavior as intended was corrected rather than left green. A drift gate inverted from "the twin has the right body" to "no twin survives" now blocks a fifth copy, and it catches the operator-adjacent, destructured, bracket-access, and `Boolean()`-coercion spellings.
- **Generalizable lesson:** A guard whose two conditions have silently become mutually exclusive is worse than a redundant one — it excludes exactly one reachable shape and reports no error. When a feature makes a field's meaning shift (here, `installable: false` going from "soft-degraded" to "also partially installed"), audit every predicate that reads it, not just the ones the feature touched.
- **Files changed:** persistence/state-io.ts, orchestrators/plugin-state-classifier.ts, orchestrators/plugin/enable-disable.ts, orchestrators/reconcile/plan.ts, orchestrators/plugin/update.ts, tests/orchestrators/reconcile/plan.test.ts
---

## async-rewake-lane-inert — an asyncRewake hook handler never spawns its async child in a live session
- **Date:** 2026-08-04 diagnosed, 2026-08-11 closed as no-defect
- **Error patterns:** hook edit has no effect, asyncRewake never spawns, only the sync lane runs, hooks.json change ignored after /reload, no error and no marker file, live behavior disagrees with the marketplace source
- **Root cause:** Not a code defect. Install stages a plugin's parsed hooks config to `<scope>/pi-claude-marketplace/hooks/<slug>/hooks.json`, and the event router hydrates ONLY from that staged copy. `/reload` re-reads the staged copy; only install, reinstall, and update rewrite it. The investigation had edited the MARKETPLACE SOURCE 14 minutes after install and reloaded, so routing kept executing the first fixture attempt faithfully — a sync-only PreToolUse bucket plus an asyncRewake handler parked on Stop, where it is inert by design. Zero errors because nothing failed.
- **Fix:** None needed in product code. Re-stage the fixture (reinstall or update the plugin) so the staged copy carries the intended config. A seam test through the unmodified production path confirmed the corrected config spawns both children with full env parity, 2/2.
- **Generalizable lesson:** `/reload` reads staged artifacts, not sources. Any UAT that edits a plugin's source mid-session must reinstall before reloading, or it will measure the previous install. A "feature is inert" symptom with no error is more often a stale staged artifact than a broken lane — compare the staged file's mtime against the record's `installedAt` before suspecting the code.
- **Files changed:** none
---

## project-scope-sessionstart-never-dispatches — a project-scope plugin's SessionStart hooks never fire on the session that starts them
- **Date:** 2026-08-14 (found in review of external PR #127, which carried the diagnosis and the fix)
- **Error patterns:** project-scope hook never fires, SessionStart works at user scope but not project scope, hook only works after a second /reload, empty routing bucket with no error, hooks.json staged correctly but handler never spawns
- **Root cause:** Pi emits `session_start` BEFORE `resources_discover` (`agent-session.js:1761-1762`, and the same order on `/reload` at `2070-2071`), but project-scope hook-cache hydration was wired only into the `resources_discover` handler. The factory runs at extension-load time with `cwd = homedir()`, so it resolves project scope against `<homedir>/.pi/...` and finds nothing. At `SessionStart` dispatch the routing bucket therefore held user-scope entries only. `session_start` is the ONLY dispatch surface that fires before `resources_discover`, so no other Claude event was affected.
- **Fix:** `registerHooksBridge` wraps its own `session_start` registration — hydrate project scope against `ctx.cwd`, rebuild the routing tables, ensure the project `_shared` dir when a project-scope entry exists, then delegate. Failures route through `hookDebugLog` so a hydrate error cannot block dispatch. Placement inside the bridge (not `index.ts`) is deliberate: Pi runs one extension's handlers for an event in registration order (`runner.js:583`), so an `index.ts` hydrate would depend on sitting above the `await registerHooksBridge(...)` line.
- **Generalizable lesson:** A deferred initialization is only correct for events that fire after the point it was deferred TO. Wiring project-scope hydrate to `resources_discover` silently excluded the one event that precedes it. When deferring setup to "the first event that carries X", enumerate which events fire before that one and confirm none of them need X. The proximate cause here was a research-time guess recorded as fact — "`session_start`'s ctx does not obviously carry cwd" — when `ExtensionContext.cwd` is populated for every event (`types.d.ts:216`, `runner.js:473-475`); an unverified "does not obviously" belongs in a question, not a design.
- **Files changed:** bridges/hooks/event-router.ts, index.ts, tests/integration/hooks-dispatch-end-to-end.test.ts
---

## pr-145-sonar-violations — Sonar reports duplicate imports in two orchestrators
- **Date:** 2026-08-29
- **Error patterns:** Sonar `typescript:S3863`, duplicate imports, four open PR issues
- **Root cause:** Two orchestrator files repeated import declarations from the same local `shared.ts` module.
- **Fix:** Consolidated each set of duplicate `./shared.ts` imports into one declaration.
- **Files changed:** extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts, extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts
- **Why not caught:** No local gate enforces Sonar `typescript:S3863`. The PR analysis found the duplicate imports.
- **Recurrence guard:** Sonar `typescript:S3863` finds duplicate imports. This entry records the pattern for future Phase-0 recall.
---

## marketplace-add-http-errors — marketplace add exposes raw HTTP clone errors
- **Date:** 2026-08-29
- **Error patterns:** `HTTP Error: 404 Not Found`, raw extension error, missing repository, transient HTTP failure
- **Root cause:** Marketplace add used a transport-only classifier that did not classify repository absence or transient HTTP status codes.
- **Fix:** Added an opt-in source-access classifier for marketplace add. It maps 404/410 to source missing and transient statuses to network unreachable.
- **Files changed:** extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts, extensions/pi-claude-marketplace/shared/git-failure-classifiers.ts, tests/orchestrators/marketplace/add.test.ts, tests/shared/git-failure-classifiers.test.ts
- **Why not caught:** No marketplace-add test covered non-authentication HTTP clone errors.
- **Recurrence guard:** D-76-09 tests pin marketplace-add mappings. Shared-classifier tests protect other callers' fallthrough behavior.
---

## adapter-profile-parallel-flakes — cucumber adapter profile fails a different 7 to 18 scenarios each parallel run
- **Date:** 2026-11-08
- **Error patterns:** cucumber parallel flake, different scenarios fail each run, passes when rerun alone, no SessionStart hook run after new session, project skill missing, autoapply effective value from the user file, project scope treated as untrusted, failures appear past a suite size, shared Pi per worker, order-dependent
- **Root cause:** The harness reuses one shared Pi per cucumber worker. `Before()` resets it by emptying the sandbox and starting a new session. Pi 1.5.0 keeps a process-lifetime trust cache by directory (`projectTrustByCwd` in `dist/main.js`). Pi sets it the first time it builds a runtime while the project holds a trust-requiring resource (`.pi/settings.json`, `.pi/mcp.json`, `.pi/skills`, ...). With no `trust.json` entry, `defaultProjectTrust: "ask"`, and no UI (RPC), the decision is `false`. `features/mcp-server/legacy-move.feature:206` writes `<project>/.pi/mcp.json` in the shared Pi and starts a new session. After that, every trust-gated scenario later in the same worker (project skills, project hooks, project autoapply, the effective autoapply value) saw an untrusted project. It is an AND-gate: the poisoner plus a later trust-sensitive scenario in the same worker. Random order made it look probabilistic. The "~1,720 scenarios" threshold was the merge that added the poisoner, not suite size.
- **Fix:** `PiProcess` (`features/lib/pi-process.ts`) keeps its cwd. In `request()` it records a `new_session`, `switch_session`, `fork`, or `clone` request sent while Pi's own exported `hasTrustRequiringProjectResources(cwd)` holds (`decidedProjectTrust`). `Before()` (`features/support/pi-process.ts`) replaces the shared Pi when `!run.pi.idle || run.pi.decidedProjectTrust`. Commit `d04a5106`.
- **Generalizable lesson:** Before you blame load, group the failures of a parallel run by worker and by ordinal within the worker. If every failure sits in one worker, after one scenario, the cause is order-dependent pollution in a long-lived process, not timing. Then confirm with `--parallel 1 --order defined` on the suspect pair, in both orders. A reset that empties files cannot clear a cache that the process under test keeps in memory by cwd. Only a new process clears it.
- **Files changed:** features/lib/pi-process.ts, features/support/pi-process.ts, .agents/skills/cucumber/rules/world-and-stand-ins.md
- **Why not caught:** None (no gate existed for this class). The shared-Pi reset asserts the emptied sandbox and the session payload, not state in Pi's process memory. Each tree got one run, which cannot prove an order-dependent suite clean.
- **Recurrence guard:** `PiProcess.decidedProjectTrust` and the replacement condition in `Before()`, plus the reset rule in `.agents/skills/cucumber/rules/world-and-stand-ins.md`. No committed scenario pins the order. The manual reproduction is legacy-move:206 then autoapply:447 with `--parallel 1 --order defined`.
---

## ci-hook-kill-no-effect — hook timeout, /reload, and reap kill only the shell, so the hook script survives (CI-only)
- **Date:** 2026-11-10
- **Error patterns:** CI-only failure, passes locally, ubuntu-26.04, dash, `sh -c` forks, `these hook processes are still running`, next session start timed out, json mode did not exit within 25000 ms, SessionEnd budget has no effect, SIGTERM ignored, SIGKILL never sent, `close` never fires, grandchild holds stdout, orphan reap kills wrong pid, process group
- **Root cause(s):** Both hook lanes signalled only the pid they spawned, and a shell-form hook runs as `/bin/sh -c '<command>'`. Ubuntu 26.04's dash 0.5.12 forks for that command (every shell does for `a || b`, `a; b`, or a pipe), so the spawned pid was the shell and the hook script its child. The SessionEnd SIGTERM, the `/reload` SIGKILL, and the orphan reap's SIGKILL ended only the shell; the script kept the shell's stdout open and ran on; AND the SIGKILL leg guarded on the shell's exit only, and the async lane cancelled it on `exit`, so a group member that ignored SIGTERM never got SIGKILL.
- **Fix:** Hooks spawn `detached` off Windows (each leads its own process group) and `bridges/hooks/process-group.ts` (`asGroupLeader`) sends every signal to `-pid` with a fallback to the child; the reap SIGKILLs `-pid` then `pid`. Once the ladder's SIGTERM fired, its SIGKILL follows after the 5 s grace while the group has a member (`ChildLike.groupAlive`, `cancel()` keeps the leg). Harness: the cucumber release stops lifecycle hook scripts by pid file, because stopping Pi's group no longer reaches them. Decision D-BG-211. Commits ab30ad88, 1ca1478c.
- **Generalizable lesson:** When a kill "has no effect" on one host only, check what `/bin/sh -c` does there before blaming load: probe `spawn(cmd, [], {shell: true})` and compare `child.pid` with the script's `$$`. A test command that forks under every shell (`script.sh || true`) reproduces it on any host. Signal process groups, not pids, for anything run through a shell.
- **Files changed:** extensions/pi-claude-marketplace/bridges/hooks/process-group.ts, extensions/pi-claude-marketplace/bridges/hooks/exec-timer.ts, extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts, extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts, features/hook/async.feature, features/hook/session-end.feature, features/lib/hook-files.ts, features/lib/pi-process.ts, features/support/world.ts, test/bridges/hooks/process-group.test.ts, test/bridges/hooks/exec-timer.test.ts, test/bridges/hooks/dispatch-exec.test.ts, test/bridges/hooks/async-rewake/registry.test.ts, CHANGELOG.md, .planning/PROJECT.md, .planning/BACKLOG.md
- **Why not caught:** The behavioral suite ran only on a host whose sh execs a lone `-c` command, and no scenario used a command that forks under every shell. The unit doubles' `kill` was the only signal path, and the registry harness reported a fixed exit state. BACKLOG HKDR-01 named the gap without a gate.
- **Recurrence guard:** The `|| true` scenarios in features/hook/async.feature (dead-Pi reap, reload, "A background hook process that ignores SIGTERM stops at its timeout") and the `["||","true"]` rows (plain and `sigterm ignore`) of both SessionEnd outlines in features/hook/session-end.feature; unit pins in test/bridges/hooks/process-group.test.ts and the group cases of exec-timer, dispatch-exec, and registry tests. Remaining gaps: BACKLOG HKDR-01.
---
