---
status: diagnosed
trigger: "UAT G-91-2: asyncRewake:true PreToolUse handler never spawns its async child in a live Pi session (HENV-02)"
created: 2026-08-04T00:00:00Z
updated: 2026-08-04T00:00:00Z
---

## Current Focus

ROOT CAUSE CONFIRMED — investigation complete (diagnose-only mode; no fix applied).

reasoning_checkpoint:
  hypothesis: "The async child never spawned because the routing bucket never contained an asyncRewake PreToolUse handler: the event router hydrates from the STAGED scope-dir copy of hooks.json, which still held the first (Stop-based) fixture attempt; the UAT edited the marketplace source and ran /reload, which re-reads the staged copy, not the source"
  confirming_evidence:
    - "Staged file tmp/pi-uat/agent/pi-claude-marketplace/hooks/env-observe/hooks.json (mtime == state.json installedAt 2026-08-04T23:59:02Z) contains PreToolUse:[sync] + Stop:[asyncRewake] — NOT the sync+async PreToolUse pair"
    - "Marketplace source mtime 2026-08-05T00:12:51Z — edited 14 min AFTER install, never re-staged"
    - "event-router.ts:604 hydrate reads path.join(loc.hooksDir, slug, 'hooks.json') — the staged copy; /reload -> registerHooksBridge -> hydrateCacheFromDisk reads only that path"
    - "Throwaway seam test, experiment A: parsing the ACTUAL staged file through the real parse/cache/rebuild/dispatch path yields exactly 1 spawn (sync, no marker) — reproduces the live observation"
    - "Experiment B: parsing the ACTUAL edited marketplace file through the same path yields 2 spawns; the async spawn carries PI_CLAUDE_MARKETPLACE_REWAKE_DISPATCH + CLAUDECODE=1 + both session-id keys — the product code path is correct and HENV-02 env parity holds"
  falsification_test: "Experiment B failing (no async spawn with the corrected config) would have proven a product bug in the lane; it passed 2/2"
  fix_rationale: "No code fix needed for the lane; the UAT gap closes by re-staging the fixture (reinstall/update) and re-running the live check"
  blind_spots: "Live-Pi behaviors not reproducible in the seam test (Pi's own tool_call emission, /reload ordering) — but the sync lane firing live proves that plumbing works; the only delta between lanes was bucket content"
  candidate_causes:
    - "code: parse/supportability strips asyncRewake handler — ELIMINATED (source read + experiment B)"
    - "code: reduceBucket short-circuit before the async entry — ELIMINATED (noop continues; experiment B)"
    - "data/config: stale staged hooks.json in the scope dir — CONFIRMED"
    - "environment: PI_CLAUDE_MARKETPLACE_DEBUG unset — only hides logs; not causal"
  and_gate: "no — single root cause. The stale staged content fully explains zero async spawns (its only asyncRewake handler sits on Stop, inert by design D-87-04); no second simultaneous condition required."

## Symptoms

expected: "With a plugin hooks.json declaring two handlers in one PreToolUse matcher group — one plain command handler, one with asyncRewake: true — a single agent tool call produces TWO child processes: the sync child (dispatch-exec spawnAndCollect) and the async child (registry.ts spawnAndRegister, env includes PI_CLAUDE_MARKETPLACE_REWAKE_DISPATCH=<dispatchId>)."
actual: "'still absent' — only the sync child ever runs. Fixture plugin env-observe (path-source marketplace tmp/henv-uat-mkt, installed into sandbox Pi home tmp/pi-uat/agent, session cwd tmp/work, Pi 0.80.10) logs each child's env to tmp/henv-uat/env.log. After editing hooks.json to the sync+async pair, running /reload, and triggering an agent bash tool call, the log gained ONLY the lane=sync event=PreToolUse block. The async child never executed. Sync lane otherwise fully correct (all three HENV keys present and fresh across /new)."
errors: "None surfaced — every failure arm in this path is a silent hookDebugLog (stderr only when PI_CLAUDE_MARKETPLACE_DEBUG=1, which was not set in the live session)."
reproduction: "Test 2 in .planning/phases/91-hook-environment-parity/91-UAT.md. Live fixture on disk at tmp/henv-uat-mkt/ (hooks.json has the sync+async PreToolUse pair). Sandbox Pi home: tmp/pi-uat/agent/pi-claude-marketplace/state.json (plugin installed, enabled, resources.hooks: [env-observe])."
started: "Discovered during phase 91 UAT, 2026-08-04."

## Eliminated

- hypothesis: pi undefined at wiring (event-router.ts:862)
  evidence: Orchestrator pre-diagnosis — event-router threads pi at wiring
  timestamp: 2026-08-04 (pre-diagnosis, to be re-verified only if suspects 1-3 come up clean)
- hypothesis: handlerDecl field stripping in flattenPluginIntoBuckets
  evidence: Orchestrator pre-diagnosis — event-router.ts:487-505 passes the raw parsed handler
  timestamp: 2026-08-04 (pre-diagnosis)
- hypothesis: version-floor gate / trust gate blocks async lane
  evidence: Orchestrator pre-diagnosis — no such gate in source
  timestamp: 2026-08-04 (pre-diagnosis)
- hypothesis: fixture script error
  evidence: Sync lane uses the same script and logs fine
  timestamp: 2026-08-04 (pre-diagnosis)
- hypothesis: Stop-event async inertness explains the gap
  evidence: First fixture attempt used Stop, which is inert BY DESIGN (D-87-04); the repro was rebuilt on PreToolUse and STILL fails — this is the actual gap
  timestamp: 2026-08-04 (pre-diagnosis)

## Evidence

- timestamp: 2026-08-04
  checked: .planning/debug/knowledge-base.md
  found: One entry (test-suite-hang-phase79, real-timer race in test mock) — no keyword overlap with async-rewake/hooks routing
  implication: No known-pattern hypothesis; proceed with fresh investigation
- timestamp: 2026-08-04
  checked: Fixture hooks.json at tmp/henv-uat-mkt/plugins/env-observe/hooks/hooks.json
  found: Valid JSON; PreToolUse group with two type:command handlers, second has "asyncRewake": true; both use absolute-path bash command
  implication: Fixture declaration is well-formed; the drop happens in code, not in the fixture
- timestamp: 2026-08-04
  checked: domain/components/hooks.ts (parseHooksConfig / partitionHooks / partitionGroupHandlers)
  found: Schema is lenient (additionalProperties true, asyncRewake admitted as any value); partitionGroupHandlers keeps every type:"command" handler BY REFERENCE ({...group, hooks: keptHandlers}) — asyncRewake field survives parse intact
  implication: Suspect 1 (parse/supportability strip) ELIMINATED at the source level
- timestamp: 2026-08-04
  checked: STAGED hooks.json at tmp/pi-uat/agent/pi-claude-marketplace/hooks/env-observe/hooks.json vs marketplace source, plus mtimes
  found: |
    STAGED copy (mtime 2026-08-04 19:59:02 -0400 == state.json installedAt 23:59:02.718Z UTC) contains the FIRST fixture attempt:
    PreToolUse: [sync handler only]; Stop: [async handler with asyncRewake:true].
    MARKETPLACE source (mtime 20:12:51 -0400, ~14 min AFTER install) contains the second attempt: PreToolUse group with the sync+async pair.
    env.log lane=sync blocks at 20:05, 20:14, 20:31 — all consistent with the staged PreToolUse sync handler; zero lane=async blocks.
  implication: The staged copy was never refreshed after the fixture edit. The routing bucket for PreToolUse only ever contained the sync handler; the asyncRewake handler sat in the Stop bucket, which is inert by design (D-87-04, collectBucketOutcomes degrades asyncRewake to noop).
- timestamp: 2026-08-04
  checked: event-router.ts hydrate path (hydrateScopeFromState:594-617, tryHydrateOnePlugin:619-677)
  found: "hooksJsonPath = path.join(loc.hooksDir, slug, 'hooks.json')" — hydrate reads the STAGED scope-dir copy (loc.hooksDir = <scope>/pi-claude-marketplace/hooks/), never the marketplace resolvedSource. /reload re-enters registerHooksBridge -> hydrateCacheFromDisk -> reads the staged copy. Only install/reinstall/update re-stage (stage.ts write + readAndCachePluginHooks).
  implication: /reload picking up a marketplace-source edit is impossible by design; the live repro procedure (edit source + /reload, no reinstall) cannot exercise the new async PreToolUse handler
- timestamp: 2026-08-04
  checked: dispatch.ts reduceBucket (lines 180-232) and compositeHandlerFor; dispatch-exec.ts async arm (line 182); async-rewake/registry.ts spawnAndRegister (line 231)
  found: reduceBucket has NO asyncRewake filter; a sync handler returning noop continues iteration; dispatchHookExec routes asyncRewake===true to spawnAndRegister with pi threaded from compositeHandlerFor; spawnAndRegister narrows isDispatchableEvent(PreToolUse)=true and spawns with MARKER_ENV=dispatchId + claudeSessionEnvFor
  implication: Suspects 3 and 4 have no visible defect in source; decisive experiment must confirm both spawns fire with the corrected config
- timestamp: 2026-08-04
  checked: "Decisive experiment: throwaway node:test (scratchpad, not committed) driving readAndCachePluginHooks -> rebuildRoutingTables -> compositeHandlerFor('PreToolUse') with a shared spawn spy on BOTH _setSpawnForTest seams (dispatch-exec + registry), against the two real on-disk files"
  found: |
    Experiment A (ACTUAL stale staged file): PreToolUse bucket = 1 entry (sync), Stop bucket = 1 entry (asyncRewake:true); exactly 1 spawn fired, env lacks PI_CLAUDE_MARKETPLACE_REWAKE_DISPATCH. PASS — reproduces the live symptom exactly.
    Experiment B (ACTUAL edited marketplace file): PreToolUse bucket = 2 entries, second keeps asyncRewake:true; 2 spawns fired — one sync (no marker), one async with PI_CLAUDE_MARKETPLACE_REWAKE_DISPATCH set; BOTH spawn envs carry CLAUDECODE=1, CLAUDE_CODE_SESSION_ID and CLAUDE_SESSION_ID equal to the session id. PASS.
  implication: "The async-rewake lane and its HENV-02 env parity are CORRECT in this branch's source. The live failure is fully explained by the stale staged copy: the routing table never contained an asyncRewake PreToolUse handler."

## Resolution

root_cause: |
  Stale staged hooks.json, not a code defect. Install stages a plugin's parsed
  hooks config to <scope>/pi-claude-marketplace/hooks/<slug>/hooks.json, and the
  event router hydrates ONLY from that staged copy (event-router.ts
  hydrateScopeFromState:604 — path.join(loc.hooksDir, slug, "hooks.json")).
  /reload re-enters registerHooksBridge -> hydrateCacheFromDisk -> reads the
  staged copy; only install/reinstall/update rewrite it. The UAT edited the
  MARKETPLACE SOURCE (tmp/henv-uat-mkt/.../hooks.json, mtime 00:12:51Z) 14 min
  after install (staged copy mtime == installedAt 23:59:02Z) and ran /reload
  without re-staging. The staged copy still held the FIRST fixture attempt:
  PreToolUse:[sync only] + Stop:[asyncRewake:true]. So the PreToolUse bucket
  never contained an async handler (hence only lane=sync blocks), and the staged
  async handler sat on Stop, which is inert by design (D-87-04,
  collectBucketOutcomes degrades asyncRewake to noop). Zero errors because
  nothing failed — routing executed the staged config faithfully.
  The seam test proves the corrected config spawns both children with correct
  HENV-02 env through the unmodified production path.
fix: "None applied (diagnose-only mode). Direction: re-stage the fixture (reinstall or update env-observe@henv-uat-mkt) so the staged copy carries the sync+async PreToolUse pair, then re-run UAT Test 2 live; no product code change required for G-91-2."
verification: "Seam-level: throwaway test 2/2 pass (experiment A reproduces the failure from the stale artifact; experiment B shows both spawns + full HENV key parity from the corrected artifact). Live re-verification pending re-staged fixture."
files_changed: []
