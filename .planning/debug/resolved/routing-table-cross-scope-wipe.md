---
status: resolved
trigger: "After installing a hooks-only user-scope plugin (learning-output-style, which declares only SessionStart, a bucket-A event), the bridge subscribes to session_start, the install/list rendering shows (installed), and the user-scope hydrate populates parsedConfigCache with one entry. But when Pi emits session_start, the routing table for SessionStart contains 0 entries -- the hook handler is never spawned. State.json + on-disk hooks.json are correct; the gap is between cache and dispatch."
created: 2026-06-17T02:30:00Z
updated: 2026-06-17T02:50:00Z
---

> Pre-filled from instrumented runtime trace captured by the operator on
> 2026-06-17T02:25Z (Pi launched with PI_CLAUDE_MARKETPLACE_DEBUG=1 after
> temporary hookDebugLog additions in dispatch.ts and event-router.ts).
> Instrumentation reverted before this session opened. Root cause is
> pinned -- this session is for fix application and re-verification.

## Symptoms

### Expected behavior
After `/claude:plugin install learning-output-style@claude-plugins-official`
followed by `/reload` (or full Pi relaunch), the plugin's SessionStart hook
handler should be invoked on every new Pi session. The handler emits a JSON
`additionalContext` block that injects a "learning mode" prompt into the
session.

### Actual behavior
No SessionStart hook fires. Pi-side touch-file probe (Option A from the
prior debug-step) produced no /tmp/learning-fired.log; Pi's behavioral
output (Option B) carries none of the learning-mode prompt's markers
(`★ Insight ─────`, contribution requests).

### Error messages
None. The misclassification is silent. Without PI_CLAUDE_MARKETPLACE_DEBUG=1
and added hookDebugLog instrumentation at the dispatch happy path, there
are no log lines at all -- the bridge silently treats the empty routing
bucket as a no-op (correct in the empty case, but wrong here).

### Timeline
Phase 63 v1.13 hook bridge. The bug ships in every commit since the
bridge subscribed multi-scope. Not caught by unit tests because rebuild is
exercised per-scope in isolation; not caught by UAT 3/4/5 because those
were terminally blocked on hookify's Stop event; not caught by Test 8
because Test 8 only asserts list rendering, not dispatch.

### Reproduction
1. Cold-start the pi-uat sandbox at HEAD:

       scripts/pi.sh --clear --home /home/acolomba/pi-claude-marketplace/tmp/pi-uat

2. In the Pi REPL:

       /claude:plugin install learning-output-style@claude-plugins-official
       /reload

3. Confirm the install state-side (state.json):

       cat tmp/pi-uat/agent/pi-claude-marketplace/state.json | jq '.marketplaces["claude-plugins-official"].plugins["learning-output-style"]'

   shows installable: true + resources.hooks: ["learning-output-style"].

4. Add a side-channel touch file at the top of the source handler:

       sed -i '1a echo "fired at $(date -Iseconds)" >> /tmp/learning-fired.log' tmp/pi-uat/agent/pi-claude-marketplace/sources/claude-plugins-official/plugins/learning-output-style/hooks-handlers/session-start.sh

5. Relaunch Pi (handler script is referenced via `${CLAUDE_PLUGIN_ROOT}`,
   no re-install needed):

       rm -f /tmp/learning-fired.log
       scripts/pi.sh --home /home/acolomba/pi-claude-marketplace/tmp/pi-uat
       # quit immediately

6. Confirm /tmp/learning-fired.log does NOT exist. The hook never fired.

## Current Focus

hypothesis: |
  `routingTable` in `bridges/hooks/event-router.ts:125` is a single
  module-global `Map<BucketAEvent, ReadonlyArray<RoutingEntry>>`. The
  caller pattern (in `registerHooksBridge` at line 621, `applyReconcile`
  at line 895, and the four orchestrator paths at install/uninstall/
  update/reinstall) is to invoke `rebuildRoutingTables(state, loc)` once
  per scope sequentially.

  But `rebuildRoutingTables`:
    1. Pre-seeds every bucket in a local `buckets` map to `[]`
    2. Filters `collectPluginsInScope(state, loc.scope)` to ONLY entries
       in the passed-in scope
    3. Overwrites every routingTable bucket from the filtered local map

  So when scope=user rebuild populates SessionStart with 1 entry, the
  immediately-following scope=project rebuild (which sees 0 user-scope
  entries) overwrites SessionStart with [] -- wiping the user-scope's work.

  The `parsedConfigCache` (the actual source of parsed-and-ready-to-dispatch
  configs) is properly maintained by install/uninstall/update/reinstall
  + hydrate as a cross-scope authoritative source. The bug is that
  rebuildRoutingTables filters the cache by scope when it should walk
  the entire cache, since the routing table itself is global.

test: |
  Write a unit test that:
    1. Calls addPluginConfigToCache(scope: "user", ...) for a plugin
       declaring SessionStart hooks.
    2. Calls rebuildRoutingTables(<user-state>, <user-loc>) -- assert
       _routingTableForTest().get("SessionStart").length === 1.
    3. Calls rebuildRoutingTables(<empty-project-state>, <project-loc>)
       -- assert _routingTableForTest().get("SessionStart").length === 1
       still (this currently FAILS -- it returns 0).
    4. After the fix, assert step 3 passes.

expecting: |
  After making `rebuildRoutingTables` walk the entire `parsedConfigCache`
  (across all scopes) instead of filtering by `loc.scope`, sequential
  per-scope rebuilds no longer wipe each other. The runtime probe (touch
  file from session-start.sh) writes /tmp/learning-fired.log on Pi
  launch.

next_action: |
  Confirm the diagnosis matches the trace by reading the rebuild call
  site in registerHooksBridge + the rebuild implementation, then plan
  the fix:
    1. Change `collectPluginsInScope` to `collectAllCachedPlugins` (or
       similar) -- iterate the entire `parsedConfigCache`, not state-side
       filtered by scope.
    2. Keep `rebuildRoutingTables(state, loc)` signature unchanged for
       caller compat (state/loc become unused params; document why or
       drop the params and update the 7 call sites -- session manager
       to choose).
    3. Add the per-axis regression unit test described above.
    4. Add a higher-level test exercising the full registerHooksBridge
       boot loop with one user-scope hooks plugin + empty project state,
       asserting the user-scope SessionStart entry survives.
    5. Re-run `npm run check`.
    6. Operator re-runs the touch-file runtime probe to confirm dispatch
       end-to-end.
  Apply as atomic commits per the conventional-commits style.

reasoning_checkpoint: ""
tdd_checkpoint: ""

## Evidence

- timestamp: 2026-06-17T02:25:00Z
  observation: |
    Runtime trace with PI_CLAUDE_MARKETPLACE_DEBUG=1 + temporary
    hookDebugLog instrumentation in `dispatch.ts::compositeHandlerFor`
    and `event-router.ts::{hydrateScopeFromState, rebuildRoutingTables}`,
    captured by the operator after pi-uat relaunch:

        [hooks] hydrate: scope=user extensionRoot=.../pi-uat/agent/pi-claude-marketplace marketplaces=1
        [hooks] hydrate: scope=user considering mp=claude-plugins-official mpRecord.scope=user plugins=3
        [hooks] hydrate: scope=user mp=...  plugin=commit-commands hookSlugs=[]
        [hooks] hydrate: scope=user mp=...  plugin=pr-review-toolkit hookSlugs=[]
        [hooks] hydrate: scope=user mp=...  plugin=learning-output-style hookSlugs=["learning-output-style"]
        [hooks] hydrate: scope=user reading .../hooks/learning-output-style/hooks.json
        [hooks] hydrate: scope=user after tryHydrateOnePlugin slug=learning-output-style cache-size=1
        [hooks] hydrate: scope=project extensionRoot=/home/acolomba/.pi/pi-claude-marketplace marketplaces=0
        [hooks] rebuild: scope=user    cache-size=1 collected=1
        [hooks] rebuild: scope=user    bucket SessionStart -> 1 entries     <-- user rebuild OK
        [hooks] rebuild: scope=project cache-size=1 collected=0             <-- project rebuild WIPES
        [hooks] dispatch: composite handler fired for SessionStart
        [hooks] dispatch: SessionStart routing bucket has 0 entries          <-- gone

    Then a second hydrate + rebuild cycle runs from `resources_discover`:

        [hooks] hydrate: scope=project extensionRoot=/home/acolomba/pi-claude-marketplace/.pi/pi-claude-marketplace marketplaces=0
        [hooks] rebuild: scope=project cache-size=1 collected=0
        [hooks] rebuild: scope=user    cache-size=1 collected=1
        [hooks] rebuild: scope=user    bucket SessionStart -> 1 entries
        [hooks] dispatch: composite handler fired for SessionEnd
        [hooks] dispatch: SessionEnd routing bucket has 0 entries
  conclusion: |
    Confirms the cross-scope wipe mechanically: user rebuild correctly
    populates SessionStart with 1 entry, project rebuild (which has 0
    cache entries in its scope) immediately overwrites it to []. session_start
    fires between the wipe and any subsequent rebuild, so dispatch sees
    an empty bucket. The second rebuild cycle (from resources_discover)
    restores the entry, but too late: session_start has already fired.

- timestamp: 2026-06-17T02:30:00Z
  observation: |
    Code mechanics confirm the trace:
    - `routingTable` at event-router.ts:125 is a single module-global.
    - `rebuildRoutingTables` at event-router.ts:210 starts by pre-seeding
      every bucket to `[]`, then populates only from cache entries
      matching `loc.scope` (via `collectPluginsInScope`), then overwrites
      `routingTable` (lines 227-229).
    - `collectPluginsInScope` at event-router.ts:243 filters by scope on
      both the state-side iteration (state.marketplaces[mp].scope ===
      scope) and the cache-side lookup (cacheKey includes scope).
    - 7 call sites pass a single scope's state:
        event-router.ts:621 (registerHooksBridge boot loop, per scope)
        orchestrators/plugin/install.ts:1101
        orchestrators/plugin/uninstall.ts:464
        orchestrators/plugin/update.ts:1145
        orchestrators/plugin/reinstall.ts:1149
        orchestrators/reconcile/apply.ts:895
    - `parsedConfigCache` at event-router.ts:121 is cross-scope (keyed
      by cacheKey(scope, marketplace, pluginId)) and properly maintained
      by install/uninstall/update/reinstall + hydrate.
  conclusion: |
    The cache invariant (cache holds exactly the set of currently-installed
    parseable hooks plugins across both scopes) is the right source of
    truth for the global routing table. The bug is that rebuild filters
    the cache by scope when it should walk the entire cache.

- timestamp: 2026-06-17T02:30:00Z
  observation: |
    Blast radius — bug fires unconditionally for any 2+ scope sequence:
    - boot loop in registerHooksBridge calls rebuild for [user, project]
      (or [project, user] depending on iteration order of SCOPES); the
      last one wins, and Pi always has both scopes structurally even when
      the project state.json doesn't exist (defaults to empty).
    - applyReconcile in resources_discover does the same.
    - install/uninstall/update/reinstall typically operate on one scope's
      state at a time -- so if reconcile already rebuilt the table for
      both scopes, a single-scope rebuild after install can leave the
      other scope's entries intact, depending on the orchestration order.
      But the cold-start boot path is what fails the runtime UAT.

    Net effect: every user-scope hooks plugin is broken at runtime in
    v1.13 unless the user ALSO has a project-scope hooks plugin AND the
    project-scope rebuild happens last.
  conclusion: |
    This is a v1.13 design bug shipping in every commit since the hook
    bridge landed. The hooks-only-list-disabled fix (closed in the
    previous session, commits dbad53f / 3639048 / d43b480 / b563ca7 /
    aae0e79) is a separate read-side bug; this is a dispatch-side bug
    that the runtime UAT could not surface until the read-side bug was
    fixed and we tested a real bucket-A hooks plugin install.

## Eliminated

(none — diagnosis was pinned by the instrumented runtime trace before
this session opened. No alternate hypotheses to eliminate.)

## Resolution

root_cause: |
  In bridges/hooks/event-router.ts, `routingTable` is a single module-global
  Map, but `rebuildRoutingTables(state, loc)` is per-scope and clears every
  bucket before populating only the entries from the passed-in scope. Sequential
  per-scope rebuilds (boot loop in registerHooksBridge, applyReconcile, etc.)
  wipe each other's entries. Since `parsedConfigCache` is the cross-scope
  authoritative source already maintained correctly by install/uninstall/
  update/reinstall + hydrate, the fix is to make rebuild walk the entire
  cache instead of filtering by `loc.scope`.

fix: |
  Two atomic commits on features/v1.13-hook-bridge:

      6a28bc4 test(63): regression test for cross-scope routing-table wipe
      2dbbcbd fix(63): rebuild routing table from full cross-scope cache

  Fix scope:
  - `rebuildRoutingTables` now walks the entire `parsedConfigCache` (the
    cross-scope authoritative source) instead of filtering by `loc.scope`.
    `collectPluginsInScope` is replaced by `collectAllCachedPlugins`.
    The `(state, loc)` signature is retained for caller compatibility
    (every orchestrator threads the locked transaction state through);
    params become intentionally unused at the rebuild site (renamed to
    `_state` / `_loc`).
  - JSDoc on `rebuildRoutingTables` and the new `collectAllCachedPlugins`
    helper documents the cross-scope cache walk and why the cache is the
    correct source of truth.
  - The cache-walk semantics required the disable path to drop its
    parsed-config cache entry alongside the on-disk hooks.json unstage
    (the OLD state-side filter masked this -- a disabled plugin's
    resources.hooks went to [] and the state-walk skipped it).
    `runDisableBranch` now calls `removePluginConfigFromCache` +
    `rebuildRoutingTables` in both the success arm and the
    partial-cascade-failure arm (gated on `cascade.dropped.hooks` being
    non-empty), mirroring the WR-03 invariant already in install /
    uninstall.

verification: |
  - Two new regression tests added to tests/bridges/hooks/event-router.test.ts
    that FAIL against the OLD code and PASS after the fix:
    - "rebuildRoutingTables: sequential per-scope rebuild preserves
      entries across scopes (cross-scope wipe regression)"
    - "rebuildRoutingTables: cross-scope cache walk includes BOTH
      scopes' entries simultaneously"
  - Two existing tests updated to align with the new
    cache-as-source-of-truth contract:
    - tests/bridges/hooks/event-router.test.ts cross-plugin sort + the
      renamed "empty-cache rebuild clears stale entries"
    - tests/architecture/hooks-dispatch.test.ts DISP-04 cross-plugin sort
  - `npm run check` green: 2285 passing + 1 skipped (up from 2282 + 1) +
    10 integration.
  - Pending operator runtime probe (touch-file at the source handler) to
    confirm Pi actually spawns the user-scope SessionStart handler on
    launch. Probe instructions in 63-UAT.md test 9.

files_changed:
  - extensions/pi-claude-marketplace/bridges/hooks/event-router.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
  - tests/bridges/hooks/event-router.test.ts
  - tests/architecture/hooks-dispatch.test.ts
