---
status: resolved
trigger: "@.planning/milestones/behavioral-gaps-HANDOFF.md — open blocker: parallel adapter-profile flakes"
created: 2026-11-08
updated: 2026-11-08T21:29
---

# Debug: adapter-profile parallel flakes

## Symptoms

- **Expected:** `npm run check` passes; the cucumber adapter profile (default `--parallel 8`) passes all ~1,779 scenarios on the final `features/behavioral-gaps` tree.
- **Actual:** 10 to 18 scenarios fail per run, a different set each run, at low load (load average ~8). Every failure passes when rerun alone or in a small group. Failing kinds: new-session loads (no SessionStart hook run, no skill offered), autoupdate in a new session, autoapply, `--local` or dependency commands. Builtin profile (152/152), direct coverage, and `test:modules` pass.
- **Errors:** scenario assertion failures (hook output / skill missing after a new session's load); no crash reported.
- **Timeline:** appeared once the merged suite exceeded ~1,720 scenarios. Single-run measurements (adapter, `--parallel 8`):

| Tree | Result |
| --- | --- |
| Phase 15 branch (Phase 1 head plus scenarios) | 1659/1659 |
| Phase 3, 8, 12 branches (each alone) | 1670, 1651, 1644, all passed |
| `d8af83f0` (milestone after 9 merges) | 1718/1718 |
| `5a03d5a1` (after the Phase 10 merge) | 14 failed of 1727 |
| `0611ad11` (after Phase 5) | 18 failed of 1732 |
| Phase 6 branch (contains `d8af83f0` but not Phase 10) | 10 failed of 1732 |
| Phase 4 branch (everything but Phase 2) | 6 failed of 1770 |
| final tree | 16, then 13 failed of 1779 |
| final tree without `hook/session-end.feature` | 16 failed |
| final tree without `plugin/model-tools.feature` | 10 failed |

  No single merge is the cause; rate looks probabilistic past ~1,720 scenarios. Single runs per tree cannot prove a tree clean.
- **Reproduction:** run the cucumber adapter profile (`npm run test:cucumber:profile` / the adapter leg of `test:cucumber`) on the final tree with default `--parallel 8`.

## Environment notes

- No leftover test processes found; `/tmp` inodes at 12%; 19 `/tmp/pi-cm-*` dirs left behind; `/tmp/jiti` is 124 MB.
- Phase 1 recorded `/tmp/jiti` as shared by terminal Pis (child brief section 9).
- Subagent tests must use a hermetic home — never touch the real `~/.pi/agent`.

## Suspects (from handoff)

1. Shared `/tmp/jiti` compile cache under concurrent Pi starts.
2. Per-worker HOME switching in `features/support/isolated-pi-home.ts` (BeforeAll and Before) against long scenarios.
3. Leaked `/tmp/pi-cm-*` sandboxes.

## Suggested plan (from handoff)

1. Run the final tree's adapter profile three times for a base rate, then `d8af83f0` three times to confirm it is really clean.
2. Read one failing scenario's whole output (all steps) to see why a new session's load gave no hooks or skills.
3. Test the suspects.

## Current Focus

- status: RESOLVED. The user confirmed the fix on 2026-11-08. The fix is committed as `d04a5106`. The two side issues went to `.planning/BACKLOG.md` as AMIGTRUST-01 and WORKERHOMEDIR-01.
- hypothesis: the worker's shared Pi caches "project untrusted" for its whole life. Pi's main.js keeps `projectTrustByCwd`, a process-lifetime Map keyed by cwd, and sets it the first time a runtime (a new session) starts while the cwd holds a trust-requiring resource (`.pi/settings.json`, `.pi/mcp.json`, ...). In RPC mode with no trust.json entry that decision is `false`. The shared Pi's cwd never changes, so every later scenario in that worker that needs project trust (project skills, project hooks, project autoapply) fails. A shared-Pi scenario that writes `<cwd>/.pi/mcp.json` and then starts a new session (legacy-move.feature:206) is the candidate poisoner.
- bug_class: Bohrbug once the order is fixed (order-dependent test pollution across scenarios in one worker); looks like a Heisenbug only because the order is random
- test: run legacy-move.feature:206 then autoapply.feature:447 in defined order in one worker
- expecting: autoapply.feature:447 fails with the effective value from the user local file (project files excluded as untrusted); alone it passes
- next_action: none. The session is closed. The open questions are AMIGTRUST-01 and WORKERHOMEDIR-01 in `.planning/BACKLOG.md`.
- reasoning_checkpoint:
  - hypothesis: "legacy-move.feature:206 runs in the shared Pi, writes `<project>/.pi/mcp.json`, and starts a new session; Pi (RPC, no trust entry, defaultProjectTrust ask, no UI) decides the project is untrusted and caches that in `projectTrustByCwd` for the process life; Before() only empties files, so every later trust-gated scenario in that worker reads an untrusted project."
  - confirming_evidence:
    - "runs 1 and 2: every failure in the one worker that ran legacy-move:206, every failure after it, none before; 7 other workers clean"
    - "the autoapply failures match `statusOrReport`'s untrusted branch field for field"
    - "ordered pair fails, reverse order passes, with --parallel 1"
    - "Pi main.js: `projectTrustByCwd` read before trust.json, set only when trust-requiring resources exist"
  - falsification_test: "with the shared Pi replaced after a trust-deciding session, a full adapter run still shows failures clustered in one worker after legacy-move:206, or the ordered pair still fails"
  - fix_rationale: "the leak is Pi process memory that emptying cannot reach; a new process is the only reset for it, and the existing replaced-Pi path already gives one. Detecting with Pi's own exported predicate at the request that builds the runtime catches every poisoner, not only legacy-move:206, and keeps each scenario's own trust semantics as Pi gives them."
  - blind_spots: "a runtime that an extension builds through its command context (ctx.newSession/fork/switchSession/reload) bypasses PiProcess.request; no product or harness extension calls those today. A Pi upgrade that renames the cache or the predicate keeps working (the predicate is public API)."
  - candidate_causes:
    - "code (harness): reset contract misses Pi's in-memory trust cache -- CONFIRMED"
    - "code (product): trust read from a stale per-process value in the extension -- ruled out, the extension reads ctx.isProjectTrusted() per event, which is Pi's runtime value"
    - "environment: /tmp/jiti cache, load, leaked /tmp/pi-cm-* dirs -- ruled out (see Eliminated)"
    - "data: a trust.json `false` entry or project file left by an earlier scenario -- ruled out, Before() empties and asserts the sandbox, and the reproduction fails right after a clean reset"
  - and_gate: "yes, two conditions together: (1) a shared-Pi scenario starts a session while the project holds a trust-requiring resource with no trust entry, AND (2) a trust-sensitive scenario runs later in the same worker. Random order makes (2) likely but not certain, which is why single runs looked probabilistic."

## Evidence

- timestamp: 2026-11-08T20:40
  checked: knowledge base (Phase 0; MemPalace not used)
  found: keyword match on "project-scope SessionStart never fires" -> project-scope-sessionstart-never-dispatches (hydration wired only into resources_discover). That fix is in the tree, and its failure is deterministic per scenario, not order-dependent.
  implication: not this bug; kept as a rejected candidate.

- timestamp: 2026-11-08T20:44
  checked: process list during an adapter run
  found: cucumber 13.3.0 runs `--parallel 8` as worker THREADS in one process (lib/runtime/parallel/adapter.js uses node:worker_threads, env copied per worker). A probe confirmed that in a worker thread `os.homedir()` returns the real process HOME (/home/acolomba) even after the worker sets `process.env.HOME`; `os.tmpdir()` follows the worker's `process.env.TMPDIR`.
  implication: per-worker HOME switching is isolated at the JS level only; native homedir lookups in worker code see the real home. Side finding, not tied to the flake yet.

- timestamp: 2026-11-08T20:44
  checked: base-rate run 1, final tree (02d1ae7d), adapter profile, --parallel 8, seed 989055 (scratchpad runs/final-1.ndjson, final-1.log)
  found: 7 of 1779 failed, exit 1, 5m05s wall. ALL 7 failures are in worker 5, at its scenario ordinals #142, #157, #168, #169, #178, #196, #205 (of 206). Every other worker: 0 failures. Worker 5's first 141 scenarios all passed.
  implication: not a load or timing flake. Something early in worker 5 poisoned the worker's long-lived state, and only some later scenarios are sensitive to it.

- timestamp: 2026-11-08T20:47
  checked: the two autoapply failures (autoapply.feature:447 and :504) field by field against orchestrators/reconcile/autoapply-setting.ts
  found: #142 (user local true, project base false) reported effective true from the user local file; #169 (autoapply on --scope project) listed the project file with value true but reported effective false with no source. `statusOrReport` computes the effective value from user files only when `opts.projectTrusted` is false.
  implication: both readings are exactly what an UNTRUSTED project gives. The other failures (project skills missing after a new session, autoapply, import into the project) are also trust-gated paths (T-02-17, D-LOC-01).

- timestamp: 2026-11-08T20:50
  checked: Pi 1.5.0 dist/main.js createRuntime, dist/core/project-trust.js, dist/core/trust-manager.js
  found: main.js keeps `const projectTrustByCwd = new Map()` for the process lifetime. createRuntime uses `cachedProjectTrust = projectTrustByCwd.get(cwd)` before anything else, and only when no cached value exists AND `hasTrustRequiringProjectResources(cwd)` is true does it resolve trust and `projectTrustByCwd.set(cwd, trusted)`. resolveProjectTrusted with no trust.json decision, default `defaultProjectTrust: "ask"`, and no UI (RPC) returns false. Trust-requiring resources: `<cwd>/.pi/{settings.json,mcp.json,extensions,skills,prompts,themes,SYSTEM.md,APPEND_SYSTEM.md}` or `.agents/skills` in cwd or any ancestor.
  implication: one new session in the shared Pi while the sandbox project holds such a file, with no trust entry, caches "untrusted" for the sandbox cwd until that Pi process exits. Before() empties the sandbox but cannot clear Pi's in-memory cache.

- timestamp: 2026-11-08T20:52
  checked: worker 5's sequence before #142 (worker_seq.py)
  found: #92 was legacy-move.feature:206 "A load moves a plugin's servers out of the project's mcp.json into the project's mcp-adapter.json", a shared-Pi scenario that writes `<cwd>/.pi/mcp.json` (no trust entry) and then starts a new session.
  implication: candidate poisoner. To confirm with an ordered two-scenario run.

- timestamp: 2026-11-08T20:51
  checked: ordered two-scenario runs, one worker (`--parallel 1 --order defined`), adapter profile (runs/exp1, runs/exp2)
  found: legacy-move.feature:206 then autoapply.feature:447 -> autoapply fails with the exact production diff (enabled true, source user claude-plugins.local.json). Reverse order (autoapply first) -> both pass. Before() of the second scenario emptied the sandbox and its own state assertions passed.
  implication: CONFIRMED order-dependent pollution through the shared Pi process, deterministic once ordered. The only state that survives Before() between those two scenarios is the shared Pi's process memory (its worker's sandbox is emptied and checked), which is where Pi's `projectTrustByCwd` lives.

- timestamp: 2026-11-08T20:57
  checked: base-rate run 2, final tree, unfixed (runs/final-2.ndjson)
  found: 9 of 1779 failed, ALL in worker 0, all after its #36, which was again legacy-move.feature:206. Worker 0's #23 "A new session clones and installs a git-source plugin that a project config declares when autoapply is on" passed before the poisoner; the same kind (#41) failed after it.
  implication: two of two base-rate runs: one poisoner, failures confined to its worker and to the scenarios after it.

- timestamp: 2026-11-08T20:58
  checked: history of the poisoner
  found: legacy-move.feature:206 came in ca62abea, which reached the branch with the merge dd580cba "Merge the legacy mcp move coverage" (11:56). The phase branches measured clean (Phase 15, 3, 8, 12, each alone off the Phase 1 head) lack it; every failing tree has it. d8af83f0 has it too: with ~210 scenarios per worker and ~6% trust-sensitive, a poisoner lands with no sensitive scenario after it in roughly 1 run in 12, so its single 1718/1718 run was luck, not a clean tree.
  implication: the "~1,720 scenarios" threshold is the merge that added the poisoner, not suite size.

- timestamp: 2026-11-08T20:59
  checked: fix applied (PiProcess records a runtime-building request sent while Pi's own `hasTrustRequiringProjectResources(cwd)` holds; Before() replaces such a shared Pi); ordered reproduction re-run (runs/exp3-fixed)
  found: legacy-move.feature:206 then autoapply.feature:447 -> 2 passed (exit 0); the second scenario's Before() took ~2 s for the Pi replacement. Without the fix the same order failed (runs/exp1).
  implication: the fix removes the leak at its mechanism; revert-to-fail already shown.

- timestamp: 2026-11-08T21:03
  checked: full adapter run with the fix, random seed 754239 (runs/fixed-1)
  found: 1779/1779 passed, exit 0, 5m06s (baseline 5m05s). One shared-Pi replacement in the whole run (before_durations.py: one Before() > 0.5 s, right after legacy-move:206 in worker 2, #193).
  implication: no regression, no measurable cost. Weak on its own, because the poisoner landed late in its worker.

- timestamp: 2026-11-08T21:05
  checked: deterministic sweep, one worker, defined order: legacy-move:206 followed by all 14 distinct scenarios that failed in runs 1 and 2 (runs/sweep-fixed, runs/sweep-reverted)
  found: with the fix 15/15 passed. With the Before() condition reverted to `!run.pi.idle`: 14 failed, only the poisoner passed.
  implication: revert-and-reconfirm passes over every observed failure, not only one.

- timestamp: 2026-11-08T21:06
  checked: manual mutant at the detection site: "new_session" removed from RUNTIME_REQUESTS (runs/mutant-m1.log), then restored (runs/restored.log)
  found: mutant: legacy-move:206, autoapply:447, skill/listing:6 -> 2 failed. Restored: 3 passed.
  implication: the detection, not only the replacement, is load-bearing; the ordered reproduction kills a mutant at the fix site.

- timestamp: 2026-11-08T21:09
  checked: d8af83f0 in a temporary worktree (scratchpad wt-d8af, node_modules symlinked; same package files as HEAD), one worker, defined order (runs/d8af-sweep.log, runs/d8af-control.log)
  found: legacy-move:206 then skill/listing:6, autoapply:7, remove:630 -> 3 failed. Same four with the poisoner last -> 4 passed.
  implication: d8af83f0 carries the same latent order dependency; its 1718/1718 single run was a lucky order. Replaces the "d8af83f0 three times" base-rate plan with a deterministic proof.

- timestamp: 2026-11-08T21:13
  checked: full adapter run with the fix and run 1's seed, `--order random:989055` (runs/fixed-2)
  found: 1779/1779 passed, exit 0, 5m06s. The poisoner ran in worker 6 at #109 of 215, with 106 scenarios after it (run 1, same seed, unfixed: 7 failures after it); one shared-Pi replacement in the run.
  implication: the seed that failed now passes with the poisoner mid-worker.

## Eliminated

- hypothesis: load / timing flake (parallel contention, slow starts, timeouts)
  evidence: run 1 put all 7 failures in one worker, all after its scenario #141; seven other workers ran the same mix at the same load with 0 failures; the failing steps are value mismatches that complete in 0.01-0.15 s, not timeouts.
  timestamp: 2026-11-08T20:51

- hypothesis: shared /tmp/jiti compile cache under concurrent Pi starts
  evidence: a cache race would hit Pi starts in any worker and show as start errors; the failures are in steady-state shared-Pi sessions of one worker and reproduce with --parallel 1 and two scenarios.
  timestamp: 2026-11-08T20:51

- hypothesis: leaked /tmp/pi-cm-* sandboxes
  evidence: they belong to earlier runs' roots, which no Pi of a new run uses (each run makes a new mkdtemp root); the ordered reproduction runs in a fresh root.
  timestamp: 2026-11-08T20:51

- hypothesis: per-worker HOME switching in features/support/isolated-pi-home.ts against long scenarios
  evidence: the reproduction fails with --parallel 1 (one worker, no concurrent HOME switch), and the sweep passes once only the shared Pi is replaced, with isolated-pi-home.ts unchanged. (Separate observation: worker threads share the process HOME for native `os.homedir()`; no failing path used it.)
  timestamp: 2026-11-08T21:06

## Resolution

- root_cause: The harness reuses one shared Pi per cucumber worker and resets it by emptying the sandbox and starting a new session. Pi 1.5.0 keeps a process-lifetime trust cache by directory (`projectTrustByCwd` in dist/main.js), set the first time a runtime is built while the project holds a trust-requiring resource. legacy-move.feature:206 (added by the legacy mcp move merge dd580cba) writes `<project>/.pi/mcp.json` in the shared Pi and starts a new session, so the shared Pi decides "untrusted" (no trust entry, no UI) and keeps it. Every later trust-gated scenario in that worker (project skills, project hooks, project autoapply, the effective autoapply value) then sees an untrusted project. AND-gate: needs the poisoner plus a later trust-sensitive scenario in the same worker.
- fix: `features/lib/pi-process.ts`: PiProcess keeps its cwd and records, in `request()`, a `new_session`/`switch_session`/`fork`/`clone` sent while Pi's own exported `hasTrustRequiringProjectResources(cwd)` holds (`decidedProjectTrust`). `features/support/pi-process.ts`: Before() replaces the shared Pi when `!run.pi.idle || run.pi.decidedProjectTrust`. `.agents/skills/cucumber/rules/world-and-stand-ins.md`: the reset rule and the trust section name this case.
- oracle_type: specified (the scenario tables state the expected values; the failing reads were the untrusted values)
- verification:
  - target_test: { result: pass, detail: "ordered pair legacy-move:206 -> autoapply:447 passes (runs/exp3-fixed); sweep of the poisoner plus all 14 observed failures 15/15 (runs/sweep-fixed)" }
  - mutation_check: { result: pass, reason_if_skipped: "no Stryker for features/; manual mutant instead", mutant_killed: "dropping new_session from RUNTIME_REQUESTS -> 2 of 3 fail (runs/mutant-m1.log)" }
  - no_op_deletion: { result: pass, deletion_justified_by_rca: n/a, detail: "the diff adds a detection and one replacement condition; nothing removed or short-circuited" }
  - adjacent_tests: { result: pass, suites_run: ["adapter full run seed 754239: 1779/1779 (runs/fixed-1)", "adapter full run seed 989055 (run 1's seed): 1779/1779 (runs/fixed-2)", "npm run check: exit 0 on 02d1ae7d plus the uncommitted 3-file diff, Node v26.13.0 -- check:static (typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, check:features), test:unpaired, test:integration, cucumber adapter 1779/1779 (seed 116341), builtin 153/153, direct coverage 352 records (runs/npm-check.log)"] }
  - revert_and_reconfirm: { result: pass, bug_returned_on_revert: true, fixed_on_reapply: true, detail: "Before() reverted to `!run.pi.idle` -> sweep 14 failed (runs/sweep-reverted); restored -> 3/3 (runs/restored.log)" }
  - guardrail_verdict: accepted
- files_changed: [features/lib/pi-process.ts, features/support/pi-process.ts, .agents/skills/cucumber/rules/world-and-stand-ins.md]
- commit: d04a5106 fix(features): replace the shared Pi after it decides project trust
- human_verification: confirmed fixed by the user, 2026-11-08
- prevention:
  - why_not_caught: "none (no gate existed for this class). The shared-Pi reset in `Before()` asserts the emptied sandbox and the session payload. Nothing checked the state that a new session leaves in Pi's process memory. Random order and one run per tree made the order dependency look like a load flake."
  - guard: "`PiProcess.decidedProjectTrust` (`features/lib/pi-process.ts`) and the replacement condition in `Before()` (`features/support/pi-process.ts`), plus the reset rule in `.agents/skills/cucumber/rules/world-and-stand-ins.md`, which tells future harness authors that emptying cannot clear in-memory state. No committed scenario pins the order. The ordered pair (legacy-move:206, then autoapply:447, `--parallel 1 --order defined`) is the manual reproduction."
- follow_ups: [AMIGTRUST-01 (the AMIG-01 move runs in an untrusted project), WORKERHOMEDIR-01 (`os.homedir()` in worker threads)]
